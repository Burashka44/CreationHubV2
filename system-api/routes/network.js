const express  = require('express');
const router   = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const db       = require('../lib/db');
const { execSync, exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');

// ── Multer for config upload
const upload = multer({
  dest: '/tmp/vpn-uploads/',
  limits: { fileSize: 1024 * 1024 }, // 1MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.conf', '.json', '.ovpn'].includes(ext)) cb(null, true);
    else cb(new Error('Unsupported VPN config format'));
  },
});

// GET /api/network — interfaces + speeds, WG status
router.get('/', requireAuth, async (req, res) => {
  try {
    // Interfaces raw from /proc/net/dev
    const procNet = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines   = procNet.trim().split('\n').slice(2); // skip 2 header lines
    const ifaces  = {};
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const name  = parts[0].replace(':', '');
      ifaces[name] = {
        rx_bytes: parseInt(parts[1], 10),
        tx_bytes: parseInt(parts[9], 10),
      };
    }

    // WireGuard detection
    let wgInterfaces = [];
    try {
      const out = execSync('ip link show type wireguard 2>/dev/null', { timeout: 2000 }).toString();
      wgInterfaces = (out.match(/^\d+:\s+(\S+):/gm) || []).map(m => m.split(/\s+/)[1].replace(':', ''));
    } catch {}

    res.json({
      interfaces: ifaces,
      wg: { active: wgInterfaces.length > 0, interfaces: wgInterfaces },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/network/vpn — list VPN configs
router.get('/vpn', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, protocol, server_ip, is_connected, created_at FROM vpn_configs WHERE is_active ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/network/vpn/upload — save VPN config file
router.post('/vpn/upload', requireAuth, requireRole('admin'), upload.single('config'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

  try {
    const content  = fs.readFileSync(req.file.path, 'utf8');
    const ext      = path.extname(req.file.originalname).toLowerCase();
    const protocol = ext === '.ovpn' ? 'openvpn' : ext === '.json' ? 'v2ray' : 'wireguard';

    // Parse server IP from WireGuard config
    let serverIp = null;
    const endpointMatch = content.match(/Endpoint\s*=\s*([^:\s]+)/);
    if (endpointMatch) serverIp = endpointMatch[1];

    // Save config content to dedicated location
    const configDir  = process.env.VPN_CONFIG_DIR || '/etc/vpn-configs';
    const configPath = path.join(configDir, path.basename(req.file.originalname));
    try {
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(configPath, content);
    } catch { /* If can't write to /etc, store only in DB */ }

    const { rows } = await db.query(
      `INSERT INTO vpn_configs (name, protocol, server_ip, config_content, file_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [path.basename(req.file.originalname, path.extname(req.file.originalname)), protocol, serverIp, content, configPath, req.user.id]
    );

    fs.unlinkSync(req.file.path); // cleanup tmp
    res.json({ id: rows[0].id, message: 'VPN конфиг сохранён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/network/vpn/:id/connect
router.post('/vpn/:id/connect', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vpn_configs WHERE id = $1 AND is_active', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'VPN конфиг не найден' });

    const config = rows[0];
    if (config.protocol === 'wireguard') {
      // Save temp config and bring up interface
      const tmpConf = `/tmp/wg-${config.id}.conf`;
      fs.writeFileSync(tmpConf, config.config_content);
      exec(`wg-quick up ${tmpConf}`, async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        await db.query('UPDATE vpn_configs SET is_connected = true WHERE id = $1', [config.id]);
        res.json({ message: 'WireGuard подключён' });
      });
    } else {
      res.status(501).json({ message: `Подключение ${config.protocol} будет реализовано в следующей версии` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/network/vpn/:id/disconnect
router.post('/vpn/:id/disconnect', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vpn_configs WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Не найден' });

    const config = rows[0];
    if (config.protocol === 'wireguard') {
      exec(`wg-quick down /tmp/wg-${config.id}.conf`, async (err) => {
        await db.query('UPDATE vpn_configs SET is_connected = false WHERE id = $1', [config.id]);
        res.json({ message: 'Отключено' });
      });
    } else {
      await db.query('UPDATE vpn_configs SET is_connected = false WHERE id = $1', [config.id]);
      res.json({ message: 'Отключено' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/network/vpn/:id
router.delete('/vpn/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.query('UPDATE vpn_configs SET is_active = false WHERE id = $1', [req.params.id]);
  res.json({ message: 'Удалено' });
});

module.exports = router;
