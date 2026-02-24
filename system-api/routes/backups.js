const express = require('express');
const router  = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const db  = require('../lib/db');
const fs  = require('fs');
const path = require('path');
const { execFile, exec } = require('child_process');

const BACKUP_DIR = process.env.BACKUP_PATH || '/backups';

// GET /api/backups
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, backup_type, status, targets, file_path, file_size_bytes,
              started_at, finished_at, error_message, triggered_by
       FROM backup_history ORDER BY started_at DESC LIMIT 100`
    );
    res.json({ backups: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backups — trigger manual backup
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { targets = ['database'], type = 'manual' } = req.body;
  if (!Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: 'targets required' });
  }

  // Create DB record first
  const { rows } = await db.query(
    `INSERT INTO backup_history (backup_type, status, targets, triggered_by, started_at)
     VALUES ($1, 'running', $2, $3, NOW()) RETURNING id`,
    [type, JSON.stringify(targets), req.user.name]
  );
  const backupId = rows[0].id;

  // Respond immediately — backup runs in background
  res.json({ id: backupId, status: 'running', message: 'Бэкап запущен' });

  // Background execution
  runBackup(backupId, targets).catch(async err => {
    await db.query(
      `UPDATE backup_history SET status = 'failed', finished_at = NOW(), error_message = $1 WHERE id = $2`,
      [err.message, backupId]
    );
  });
});

async function runBackup(backupId, targets) {
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `backup-${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const parts = [];

  // Database dump
  if (targets.includes('database')) {
    const dumpFile = path.join(BACKUP_DIR, `db-${timestamp}.sql`);
    await new Promise((resolve, reject) => {
      const host = (process.env.POSTGRES_HOST || 'postgres').replace(/'/g, "'\\''");
      const user = (process.env.POSTGRES_USER || 'postgres').replace(/'/g, "'\\''");
      const dbName = (process.env.POSTGRES_DB || '').replace(/'/g, "'\\''");
      exec(
        `pg_dump -h '${host}' -U '${user}' '${dbName}' > "${dumpFile}"`,
        { timeout: 60000, env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD } },
        (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else { parts.push(dumpFile); resolve(); }
        }
      );
    });
  }

  // Configs backup (docker volumes path)
  if (targets.includes('configs')) {
    const srcDir = process.env.CONFIGS_PATH || '/home/inno/creationhubv2';
    parts.push(srcDir);
  }

  // Create tarball
  if (parts.length > 0) {
    await new Promise((resolve, reject) => {
      exec(
        `tar -czf "${backupPath}" --ignore-failed-read ${parts.map(p => `"${p}"`).join(' ')} 2>/dev/null`,
        { timeout: 120000 },
        err => { if (err && err.code !== 1) reject(err); else resolve(); }
      );
    });
  }

  // Get file size
  let fileSize = null;
  try { fileSize = fs.statSync(backupPath).size; } catch {}

  // Cleanup temp db dump
  if (targets.includes('database')) {
    const dumpFile = path.join(BACKUP_DIR, `db-${timestamp}.sql`);
    try { fs.unlinkSync(dumpFile); } catch {}
  }

  await db.query(
    `UPDATE backup_history SET status = 'success', finished_at = NOW(), file_path = $1, file_size_bytes = $2 WHERE id = $3`,
    [backupPath, fileSize, backupId]
  );
}

// GET /api/backups/:id/download
router.get('/:id/download', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM backup_history WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Не найден' });
    const b = rows[0];
    if (b.status !== 'success' || !b.file_path) return res.status(400).json({ error: 'Файл недоступен' });
    if (!fs.existsSync(b.file_path)) return res.status(404).json({ error: 'Файл удалён с диска' });

    res.download(b.file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/backups/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT file_path FROM backup_history WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Не найден' });
    try { if (rows[0].file_path) fs.unlinkSync(rows[0].file_path); } catch {}
    await db.query('DELETE FROM backup_history WHERE id = $1', [req.params.id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backups/schedule — get cron schedule from settings
router.get('/schedule', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT value FROM settings WHERE key = 'backup_schedule'"
    );
    res.json(rows[0]?.value ? JSON.parse(rows[0].value) : { enabled: false, cron: '0 3 * * *', retention: 30 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backups/schedule — save schedule
router.post('/schedule', requireAuth, requireRole('admin'), async (req, res) => {
  const { enabled, cron, retention } = req.body;
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ('backup_schedule', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2`,
      [JSON.stringify({ enabled, cron, retention }), req.user.id]
    );
    res.json({ message: 'Расписание сохранено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
