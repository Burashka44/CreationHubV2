// ── Auth routes: login, logout, refresh, profile, 2FA
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db      = require('../lib/db');
const { signAccess, signRefresh, verifyRefresh, requireAuth } = require('../middleware/auth');
const { hashToken, generateToken, decrypt } = require('../lib/crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, totp_code } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { rows } = await db.query(
      'SELECT * FROM admins WHERE email=$1 AND is_active=true',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    if (!user) {
      await bcrypt.compare('dummy', '$2b$12$dummy.hash.to.prevent.timing.attack.xx');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Log failed login
      await db.query(
        `INSERT INTO activity_logs (user_name, event_type, event_key, description, ip_address, severity)
         VALUES ($1,'auth','login_failed','Failed login attempt',$2,'warning')`,
        [email, req.ip]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2FA check
    if (user.totp_enabled && user.totp_secret) {
      if (!totp_code) {
        return res.status(200).json({ requires_2fa: true, message: 'Enter 2FA code' });
      }
      const secret = decrypt(user.totp_secret);
      const valid2fa = authenticator.check(totp_code, secret);
      if (!valid2fa) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    // Generate tokens
    const payload = { id: user.id, role: user.role };
    const accessToken  = signAccess(payload);
    const refreshToken = generateToken(48);
    const tokenHash    = hashToken(refreshToken);

    // Save refresh token
    await db.query(
      `INSERT INTO refresh_tokens (admin_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1,$2,$3,$4, NOW() + INTERVAL '7 days')`,
      [user.id, tokenHash, req.headers['user-agent'], req.ip]
    );

    // Update last login
    await db.query(
      'UPDATE admins SET last_login_at=NOW(), last_login_ip=$2 WHERE id=$1',
      [user.id, req.ip]
    );

    // Log successful login
    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, user_role, event_type, event_key, description, ip_address, severity)
       VALUES ($1,$2,$3,'auth','login','User logged in',$4,'info')`,
      [user.id, user.name, user.role, req.ip]
    );

    // Telegram notification (if enabled)
    if (user.telegram_notify_login && user.telegram_chat_id) {
      notifyLoginTelegram(user, req.ip).catch(() => {});
    }

    res.json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      user: {
        id:          user.id,
        email:       user.email,
        name:        user.name,
        role:        user.role,
        permissions: user.permissions,
        avatar_url:  user.avatar_url,
      },
    });
  } catch (err) {
    console.error('[Auth Login]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const tokenHash = hashToken(refresh_token);
    const { rows } = await db.query(
      `SELECT rt.*, a.id as admin_id, a.role, a.permissions, a.is_active
       FROM refresh_tokens rt
       JOIN admins a ON a.id = rt.admin_id
       WHERE rt.token_hash=$1 AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = rows[0];
    const accessToken = signAccess({ id: user.admin_id, role: user.role });

    res.json({ access_token: accessToken });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.query(
        'DELETE FROM refresh_tokens WHERE token_hash=$1',
        [hashToken(refresh_token)]
      );
    }

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, user_role, event_type, event_key, description, ip_address)
       VALUES ($1,$2,$3,'auth','logout','User logged out',$4)`,
      [req.user.id, req.user.name, req.user.role, req.ip]
    );

    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const { id, email, name, role, permissions, avatar_url } = req.user;
  res.json({ id, email, name, role, permissions, avatar_url });
});

// ── POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Valid passwords required (min 8 chars)' });
    }

    const { rows } = await db.query('SELECT password_hash FROM admins WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);

    // Invalidate all refresh tokens
    await db.query('DELETE FROM refresh_tokens WHERE admin_id=$1', [req.user.id]);

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, description, ip_address, severity)
       VALUES ($1,$2,'security','password_changed','Password changed',$3,'warning')`,
      [req.user.id, req.user.name, req.ip]
    );

    res.json({ message: 'Password changed. Please log in again.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 2FA Setup
router.post('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, 'CreationHub V2', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    // Temp store in session — return to client to confirm
    res.json({ secret, qrCode, message: 'Scan QR code, then confirm with /2fa/verify' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) return res.status(400).json({ error: 'Secret and code required' });

    const valid = authenticator.check(code, secret);
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    const { encrypt } = require('../lib/crypto');
    await db.query(
      'UPDATE admins SET totp_secret=$1, totp_enabled=true WHERE id=$2',
      [encrypt(secret), req.user.id]
    );

    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, event_type, event_key, description, severity)
       VALUES ($1,$2,'security','2fa_enabled','2FA enabled','warning')`,
      [req.user.id, req.user.name]
    );

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const { rows } = await db.query('SELECT password_hash FROM admins WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    await db.query(
      'UPDATE admins SET totp_secret=NULL, totp_enabled=false WHERE id=$1',
      [req.user.id]
    );
    res.json({ message: '2FA disabled' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Sessions
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, user_agent, ip_address, created_at, expires_at
       FROM refresh_tokens WHERE admin_id=$1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM refresh_tokens WHERE id=$1 AND admin_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Session terminated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/sessions', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM refresh_tokens WHERE admin_id=$1', [req.user.id]);
    res.json({ message: 'All sessions terminated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Telegram login notification
async function notifyLoginTelegram(user, ip) {
  const axios = require('axios');
  // Get Burashka's telegram token
  const { rows } = await db.query(
    "SELECT telegram_bot_token FROM openclaw_agents WHERE slug='burashka' AND is_system_agent=true"
  );
  if (!rows[0]?.telegram_bot_token) return;
  const { decrypt } = require('../lib/crypto');
  const token = decrypt(rows[0].telegram_bot_token);
  if (!token || !user.telegram_chat_id) return;

  const text = `🔐 *Новый вход в CreationHub V2*\n👤 ${user.name}\n🌐 IP: \`${ip}\`\n🕐 ${new Date().toLocaleString('ru-RU')}`;
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: user.telegram_chat_id,
    text, parse_mode: 'Markdown',
  });
}

module.exports = router;
