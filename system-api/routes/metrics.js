// ── Metrics routes — real-time and historical data from host
const router = require('express').Router();
const db     = require('../lib/db');
const host   = require('../lib/host');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/metrics/current — all current host metrics
router.get('/current', async (req, res) => {
  try {
    const metrics = await host.getAllMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/history — historical data for charts
router.get('/history', async (req, res) => {
  try {
    const { range = '1h', type = 'cpu' } = req.query;

    const ranges = {
      '1h':  '1 hour',   '6h': '6 hours',
      '24h': '24 hours', '7d': '7 days', '30d': '30 days',
    };
    const interval = ranges[range] || '1 hour';

    // Downsample: 1h→30s buckets, 24h→5m, 7d→30m, 30d→2h
    const buckets = {
      '1h': '30 seconds', '6h': '2 minutes',
      '24h': '5 minutes', '7d': '30 minutes', '30d': '2 hours',
    };
    const bucket = buckets[range] || '30 seconds';

    const { rows } = await db.query(`
      SELECT
        date_trunc('minute', timestamp) +
          (EXTRACT(EPOCH FROM timestamp - date_trunc('minute', timestamp))::int
           / ${parseInt(bucket)} * ${parseInt(bucket)} || ' seconds')::interval AS time,
        AVG(cpu_percent)   AS cpu,
        AVG(ram_percent)   AS ram,
        AVG(net_rx_mbps)   AS net_rx,
        AVG(net_tx_mbps)   AS net_tx
      FROM system_metrics
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/gpu — current GPU metrics
router.get('/gpu', async (req, res) => {
  try {
    const gpus = host.getGpuMetrics();
    res.json(gpus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/gpu/history
router.get('/gpu/history', async (req, res) => {
  try {
    const { range = '1h', gpu_index = 0 } = req.query;
    const ranges = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days' };
    const interval = ranges[range] || '1 hour';

    const { rows } = await db.query(`
      SELECT
        date_trunc('minute', timestamp) AS time,
        AVG(gpu_temp_c)         AS temp,
        AVG(gpu_util_percent)   AS util,
        AVG(mem_used_mb)        AS mem_used,
        AVG(power_draw_w)       AS power
      FROM gpu_metrics
      WHERE timestamp > NOW() - INTERVAL '${interval}'
        AND gpu_index = $1
      GROUP BY 1 ORDER BY 1 ASC
    `, [gpu_index]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/disks — current disk usage
router.get('/disks', async (req, res) => {
  try {
    const disks = host.getDisks();
    res.json(disks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/network
router.get('/network', async (req, res) => {
  try {
    const net = host.getNetStats();
    const wg  = host.getWireguardStatus();
    const ip  = await host.getPublicIp().catch(() => null);
    res.json({ net, wg, public_ip: ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/health-score
router.get('/health-score', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT score, calculated_at FROM v_health_score');
    res.json(rows[0] || { score: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/public-ip
router.get('/public-ip', async (req, res) => {
  try {
    const ip = await host.getPublicIp();
    res.json(ip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
