const { requireAuth } = require('../middleware/auth');
const db = require('../lib/db');
const router = require('express').Router();

router.use(requireAuth);

// GET /api/openclaw - List agents
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM openclaw_agents ORDER BY port');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/openclaw/:slug/chat - Proxy to agent
router.post('/:slug/chat', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT port FROM openclaw_agents WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: 'Agent not found' });

    // The agent containers are named `creationhub_openclaw_{slug}` in the `ch_v2` network
    const targetUrl = `http://creationhub_openclaw_${req.params.slug}:${rows[0].port}/api/chat`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const fetchResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!fetchResponse.ok) {
        const errText = await fetchResponse.text().catch(() => 'Unknown error');
        return res.status(fetchResponse.status).json({ error: `Agent error: ${errText}` });
    }

    const data = await fetchResponse.json();
    res.json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Agent timeout (60s)' });
    }
    console.error(`[OpenClaw Proxy Error] ${req.params.slug}:`, err.message);
    res.status(503).json({ error: 'Agent is unreachable or sleeping. Is the container running?' });
  }
});

module.exports = router;
