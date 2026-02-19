// ── Services routes — Docker container management
const router   = require('express').Router();
const Docker   = require('dockerode');
const db       = require('../lib/db');
const ws       = require('../lib/websocket');
const { requireAuth, requirePermission } = require('../middleware/auth');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

router.use(requireAuth);

// GET /api/services — list all services with status
router.get('/', async (req, res) => {
  try {
    const { rows: services } = await db.query(`
      SELECT s.*, su.status, su.response_time_ms, su.checked_at AS last_checked_at
      FROM services s
      LEFT JOIN LATERAL (
        SELECT status, response_time_ms, checked_at
        FROM service_uptime WHERE service_id = s.id
        ORDER BY checked_at DESC LIMIT 1
      ) su ON true
      WHERE s.is_active = true
      ORDER BY s.sort_order, s.display_name
    `);

    // Enrich with real Docker status
    const containers = await docker.listContainers({ all: true }).catch(() => []);
    const containerMap = {};
    for (const c of containers) {
      for (const name of c.Names) {
        containerMap[name.replace('/', '')] = {
          state: c.State,
          status: c.Status,
          id: c.Id,
        };
      }
    }

    const enriched = services.map(svc => {
      const container = svc.container_name ? containerMap[svc.container_name] : null;
      return {
        ...svc,
        docker_state:  container?.state  || null,
        docker_status: container?.status || null,
        real_status: container
          ? (container.state === 'running' ? 'online' : 'offline')
          : (svc.status || 'unknown'),
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/services/:name — single service
router.get('/:name', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM v_service_status WHERE name=$1', [req.params.name]);
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/services/:name/start
router.post('/:name/start', requirePermission('manage_services'), async (req, res) => {
  await containerAction(req, res, 'start');
});

// POST /api/services/:name/stop
router.post('/:name/stop', requirePermission('manage_services'), async (req, res) => {
  await containerAction(req, res, 'stop');
});

// POST /api/services/:name/restart
router.post('/:name/restart', requirePermission('manage_services'), async (req, res) => {
  await containerAction(req, res, 'restart');
});

async function containerAction(req, res, action) {
  try {
    const { rows } = await db.query('SELECT * FROM services WHERE name=$1', [req.params.name]);
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });

    const svc = rows[0];
    if (!svc.container_name) return res.status(400).json({ error: 'No container name' });

    const container = docker.getContainer(svc.container_name);
    await container[action]();

    // Log action
    await db.query(
      `INSERT INTO activity_logs (admin_id, user_name, user_role, event_type, event_key, target, description, severity)
       VALUES ($1,$2,$3,'service','service_${action}',$4,$5,'info')`,
      [req.user.id, req.user.name, req.user.role, svc.display_name, `${action} → ${svc.display_name}`]
    );

    // Broadcast update
    ws.broadcast('service_action', { name: req.params.name, action });

    res.json({ message: `${svc.display_name} ${action} ok` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/services/:name/logs
router.get('/:name/logs', requirePermission('view_services'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM services WHERE name=$1', [req.params.name]);
    if (!rows[0]?.container_name) return res.status(404).json({ error: 'Not found' });

    const container = docker.getContainer(rows[0].container_name);
    const logs = await container.logs({
      stdout: true, stderr: true,
      tail: parseInt(req.query.tail || '200'),
      timestamps: true,
    });

    res.setHeader('Content-Type', 'text/plain');
    res.send(logs.toString('utf8').replace(/[\x00-\x08\x0e-\x1f]/g, ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/services/:name/uptime — uptime history (last 24h)
router.get('/:name/uptime', async (req, res) => {
  try {
    const { rows: svc } = await db.query('SELECT id FROM services WHERE name=$1', [req.params.name]);
    if (!svc[0]) return res.status(404).json({ error: 'Not found' });

    const { rows } = await db.query(`
      SELECT status, response_time_ms, checked_at
      FROM service_uptime
      WHERE service_id=$1 AND checked_at > NOW() - INTERVAL '24 hours'
      ORDER BY checked_at DESC
    `, [svc[0].id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background: check all services every 30s
async function checkAllServices() {
  try {
    const { rows: services } = await db.query(
      "SELECT * FROM services WHERE is_active=true AND container_name IS NOT NULL"
    );
    const containers = await docker.listContainers({ all: true }).catch(() => []);
    const containerMap = {};
    for (const c of containers) {
      for (const name of c.Names) containerMap[name.replace('/', '')] = c.State;
    }

    for (const svc of services) {
      const dockerState = svc.container_name ? containerMap[svc.container_name] : null;
      const status = dockerState === 'running' ? 'online' : (dockerState ? 'offline' : 'unknown');
      await db.query(
        'INSERT INTO service_uptime (service_id, status) VALUES ($1,$2)',
        [svc.id, status]
      );
    }
  } catch {}
}

// Start the health checker
setInterval(checkAllServices, 30000);
setTimeout(checkAllServices, 3000);

module.exports = router;
