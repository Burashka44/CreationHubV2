// ── Admins/Users management
const router = require('express').Router();
const bcrypt = require('bcrypt');
const db     = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateToken, hashToken } = require('../lib/crypto');

router.use(requireAuth);

// All user management requires admin
// GET /api/admins — list all users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, email, name, role, permissions, avatar_url,
             telegram_username, is_active, totp_enabled,
             last_login_at, created_at
      FROM admins ORDER BY created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admins — create user
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, name, password, role = 'viewer', permissions = {} } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Only admin and viewer allowed — no superadmin
    if (!['admin', 'user', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Use: admin | user | viewer' });
    }
    // Only admin can create another admin
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(`
      INSERT INTO admins (email, name, password_hash, role, permissions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, permissions, created_at
    `, [email.toLowerCase().trim(), name, hash, role, JSON.stringify(permissions)]);

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, target, description, severity)
       VALUES ($1,$2,'security','user_created',$3,'New user created','info')`,
      [req.user.id, req.user.name, name]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admins/:id — update user
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, role, permissions, is_active, telegram_chat_id, telegram_username } = req.body;
    if (role && !['admin', 'user', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { rows } = await db.query(`
      UPDATE admins SET
        name               = COALESCE($1, name),
        email              = COALESCE($2, email),
        role               = COALESCE($3, role),
        permissions        = COALESCE($4::jsonb, permissions),
        is_active          = COALESCE($5, is_active),
        telegram_chat_id   = COALESCE($6, telegram_chat_id),
        telegram_username  = COALESCE($7, telegram_username)
      WHERE id=$8
      RETURNING id, email, name, role, permissions, is_active
    `, [name, email, role, permissions ? JSON.stringify(permissions) : null,
        is_active, telegram_chat_id, telegram_username, req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, target, description, severity)
       VALUES ($1,$2,'security','user_updated',$3,'User updated','info')`,
      [req.user.id, req.user.name, rows[0].name]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admins/:id — delete user
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Cannot delete yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { rows } = await db.query(
      'DELETE FROM admins WHERE id=$1 RETURNING name, role',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, target, description, severity)
       VALUES ($1,$2,'security','user_deleted',$3,'User deleted','warning')`,
      [req.user.id, req.user.name, rows[0].name]
    );

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Tokens (Ollama API for mobile)

// GET /api/admins/tokens
router.get('/tokens/list', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name, token_prefix, permissions, last_used_at, expires_at, is_active, created_at
      FROM api_tokens WHERE admin_id=$1 ORDER BY created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admins/tokens
router.post('/tokens', async (req, res) => {
  try {
    const { name, permissions = { models: ['*'] }, expires_days } = req.body;
    if (!name) return res.status(400).json({ error: 'Token name required' });

    const rawToken = generateToken(48);
    const tokenHash  = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 8);
    const expiresAt = expires_days
      ? new Date(Date.now() + expires_days * 86400000)
      : null;

    const { rows } = await db.query(`
      INSERT INTO api_tokens (admin_id, name, token_hash, token_prefix, permissions, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, name, token_prefix, permissions, expires_at, created_at
    `, [req.user.id, name, tokenHash, tokenPrefix, JSON.stringify(permissions), expiresAt]);

    // Return RAW token ONCE — never again
    res.status(201).json({ ...rows[0], token: `chv2_${rawToken}`, _note: 'Save this token now — it will never be shown again' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admins/tokens/:id
router.delete('/tokens/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM api_tokens WHERE id=$1 AND admin_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Token revoked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── External API Keys (OpenAI, Anthropic etc.)

// GET /api/admins/api-keys
router.get('/api-keys', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT key, LEFT(value, 4) || '****' AS value_masked, description, updated_at FROM app_settings WHERE is_secret=true"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admins/api-keys/:key
router.put('/api-keys/:key', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    const { encrypt } = require('../lib/crypto');
    await db.query(
      `INSERT INTO app_settings (key, value, is_secret, updated_at)
       VALUES ($1,$2,true,NOW())
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
      [req.params.key, encrypt(value)]
    );
    res.json({ message: 'API key saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
