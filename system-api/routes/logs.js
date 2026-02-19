// ── Activity logs routes
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth, requirePermission } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/logs
router.get('/', requirePermission('view_activity'), async (req, res) => {
  try {
    const {
      type, severity, user_id, target,
      from, to, search,
      limit = 50, offset = 0,
    } = req.query;

    let where = ['1=1'];
    const params = [];
    let p = 1;

    if (type)     { where.push(`event_type=$${p++}`); params.push(type); }
    if (severity) { where.push(`severity=$${p++}`);   params.push(severity); }
    if (user_id)  { where.push(`admin_id=$${p++}`);   params.push(user_id); }
    if (target)   { where.push(`target ILIKE $${p++}`); params.push(`%${target}%`); }
    if (from)     { where.push(`timestamp>=$${p++}`); params.push(from); }
    if (to)       { where.push(`timestamp<=$${p++}`); params.push(to); }
    if (search)   { where.push(`(description ILIKE $${p++} OR user_name ILIKE $${p++} OR target ILIKE $${p++})`); params.push(`%${search}%`, `%${search}%`, `%${search}%`); p += 2; }

    const whereClause = where.join(' AND ');
    const { rows, rowCount } = await db.query(`
      SELECT * FROM activity_logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${p++} OFFSET $${p}
    `, [...params, parseInt(limit), parseInt(offset)]);

    const { rows: total } = await db.query(
      `SELECT COUNT(*) FROM activity_logs WHERE ${whereClause}`,
      params
    );

    res.json({ items: rows, total: parseInt(total[0].count), limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/export
router.get('/export', requirePermission('view_activity'), async (req, res) => {
  try {
    const { format = 'json', from, to } = req.query;
    let where = '1=1';
    const params = [];
    if (from) { where += ` AND timestamp>=$1`; params.push(from); }
    if (to)   { where += ` AND timestamp<=$${params.length+1}`; params.push(to); }

    const { rows } = await db.query(
      `SELECT timestamp, user_name, user_role, event_type, event_key, target, description, severity, ip_address
       FROM activity_logs WHERE ${where} ORDER BY timestamp DESC LIMIT 10000`,
      params
    );

    if (format === 'csv') {
      const headers = 'timestamp,user_name,user_role,event_type,event_key,target,description,severity,ip_address';
      const csv = [headers, ...rows.map(r =>
        [r.timestamp, r.user_name, r.user_role, r.event_type, r.event_key, r.target, `"${r.description}"`, r.severity, r.ip_address].join(',')
      )].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_log.csv');
      return res.send(csv);
    }

    res.setHeader('Content-Disposition', 'attachment; filename=activity_log.json');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
