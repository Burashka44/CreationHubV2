// ── Settings routes
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT key, value, description FROM app_settings WHERE is_secret=false ORDER BY key"
    );
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update one or many settings (admin only)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    const protectedKeys = ['language','theme','ui_scale','timezone','date_format','time_format',
      'log_retention_days','backup_path','auto_update_enabled','auto_update_cron',
      'health_check_interval','metrics_interval','quiet_hours_enabled',
      'quiet_hours_start','quiet_hours_end','nextcloud_url','nextcloud_talk_enabled',
      'burashka_telegram_enabled','pwa_enabled','global_search_enabled',
      'terminal_enabled','health_score_enabled','ntp_server'];

    for (const [key, value] of Object.entries(updates)) {
      if (!protectedKeys.includes(key)) continue;
      await db.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [key, String(value)]
      );
    }

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, description)
       VALUES ($1,$2,'settings','settings_updated','Settings updated')`,
      [req.user.id, req.user.name]
    );

    res.json({ message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/language — anyone can change their UI language
router.put('/language', async (req, res) => {
  try {
    const { language } = req.body;
    if (!['ru', 'en'].includes(language)) {
      return res.status(400).json({ error: 'Supported languages: ru, en' });
    }
    await db.query(
      "UPDATE app_settings SET value=$1, updated_at=NOW() WHERE key='language'",
      [language]
    );
    res.json({ language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/theme — anyone can change theme
router.put('/theme', async (req, res) => {
  try {
    const { theme } = req.body;
    if (!['dark', 'light'].includes(theme)) {
      return res.status(400).json({ error: 'Supported themes: dark, light' });
    }
    await db.query(
      "UPDATE app_settings SET value=$1, updated_at=NOW() WHERE key='theme'",
      [theme]
    );
    res.json({ theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/ui-scale
router.put('/ui-scale', async (req, res) => {
  try {
    const { scale } = req.body;
    const allowed = ['80', '90', '100', '110', '125'];
    if (!allowed.includes(String(scale))) {
      return res.status(400).json({ error: `Allowed scales: ${allowed.join(', ')}` });
    }
    await db.query(
      "UPDATE app_settings SET value=$1, updated_at=NOW() WHERE key='ui_scale'",
      [String(scale)]
    );
    res.json({ scale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
