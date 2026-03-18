const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../lib/db');
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

router.use(requireAuth);

// GET /api/telegram — list all bots with real docker status
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name, bot_username, description, deploy_type,
             github_repo, github_branch, container_name,
             dockerfile_path, env_vars, status,
             last_deploy_at, last_deploy_log, webhook_url, is_active, created_at
      FROM telegram_bots
      ORDER BY created_at DESC
    `);

    // Enrich with real Docker state
    let containers = {};
    try {
      const list = await docker.listContainers({ all: true });
      for (const c of list) {
        const name = (c.Names[0] || '').replace(/^\//, '');
        containers[name] = { state: c.State, status: c.Status };
      }
    } catch {}

    const enriched = rows.map(bot => {
      const c = bot.container_name ? containers[bot.container_name] : null;
      return {
        ...bot,
        real_status: c
          ? (c.state === 'running' ? 'running' : 'stopped')
          : (bot.status || 'stopped'),
        docker_status: c?.status || null,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[telegram] list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram — create bot
router.post('/', async (req, res) => {
  const {
    name, bot_username, bot_token, description,
    deploy_type = 'local', github_repo, github_branch = 'main',
    container_name, dockerfile_path = 'Dockerfile',
  } = req.body;

  if (!name || !bot_token) return res.status(400).json({ error: 'name and bot_token required' });

  try {
    await db.query(`
      INSERT INTO activity_logs (admin_id, user_name, user_role, event_type, event_key, target, description, ip_address, severity)
      VALUES ($1, $2, $3, 'telegram', 'bot_create', $4, $5, $6, 'info')
    `, [req.admin?.id, req.admin?.name, req.admin?.role, name, `Created Telegram bot ${name}`, req.ip]);

    const { rows } = await db.query(`
      INSERT INTO telegram_bots (name, bot_username, bot_token, description, deploy_type, github_repo, github_branch, container_name, dockerfile_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, bot_username, description, deploy_type, status, created_at
    `, [name, bot_username, bot_token, description, deploy_type, github_repo, github_branch, container_name, dockerfile_path]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/telegram/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM telegram_bots WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM telegram_bots WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bot not found' });
    const bot = rows[0];

    if (bot.container_name) {
      try {
        const c = docker.getContainer(bot.container_name);
        await c.start();
      } catch (e) {
        console.warn('[telegram] start container error:', e.message);
      }
    }

    await db.query("UPDATE telegram_bots SET status = 'running' WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM telegram_bots WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bot not found' });
    const bot = rows[0];

    if (bot.container_name) {
      try {
        const c = docker.getContainer(bot.container_name);
        await c.stop();
      } catch (e) {
        console.warn('[telegram] stop container error:', e.message);
      }
    }

    await db.query("UPDATE telegram_bots SET status = 'stopped' WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/:id/logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM telegram_bots WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bot not found' });
    const bot = rows[0];

    if (!bot.container_name) return res.json({ logs: 'Нет контейнера для этого бота' });

    const c = docker.getContainer(bot.container_name);
    const stream = await c.logs({ stdout: true, stderr: true, tail: 200 });
    res.json({ logs: stream.toString() });
  } catch (err) {
    res.status(500).json({ logs: `Ошибка: ${err.message}` });
  }
});

// POST /api/telegram/:id/deploy
router.post('/:id/deploy', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM telegram_bots WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Bot not found' });
    const bot = rows[0];

    const containerName = bot.container_name || `tg_bot_${bot.id}`;
    const imageName = `tg_bot_img_${bot.id}`;
    let deployLog = '';

    if (bot.deploy_type !== 'git' || !bot.github_repo) {
       return res.status(400).json({ error: 'Only Git deployment is supported automatically right now. Set deploy_type=git' });
    }

    const branch = bot.github_branch || 'main';
    const repo = bot.github_repo;
    const dockerfile = bot.dockerfile_path || 'Dockerfile';

    if (!/^[a-zA-Z0-9_.-]+$/.test(branch)) {
      return res.status(400).json({ error: 'Invalid branch name format' });
    }
    if (!/^[a-zA-Z0-9_:./-]+$/.test(repo)) {
      return res.status(400).json({ error: 'Invalid repository URL format' });
    }
    if (!/^[a-zA-Z0-9_./-]+$/.test(dockerfile)) {
      return res.status(400).json({ error: 'Invalid Dockerfile path format' });
    }

    const tmpDir = path.join('/tmp', `bot_deploy_${bot.id}_${Date.now()}`);
    deployLog += `>>> Starting deployment for ${bot.name}...\n`;

    try {
      // 1. Clone repository
      deployLog += `>>> Cloning repository ${repo} (branch: ${branch})...\n`;
      await execPromise(`git clone -b ${branch} ${repo} ${tmpDir}`);

      // 2. Build Docker image
      deployLog += `>>> Building docker image ${imageName} using ${dockerfile}...\n`;
      const buildOutput = await execPromise(`cd ${tmpDir} && docker build -t ${imageName} -f ${dockerfile} .`);
      deployLog += buildOutput.stdout + '\n';

      // 3. Stop and remove existing container if running
      deployLog += `>>> Stopping existing container ${containerName} (if exists)...\n`;
      try { await execPromise(`docker stop ${containerName}`); } catch(e){}
      try { await execPromise(`docker rm ${containerName}`); } catch(e){}

      // 4. Run new container
      deployLog += `>>> Running new container ${containerName}...\n`;
      // Pass the bot token as an environment variable BOT_TOKEN (safely escaped)
      const safeToken = bot.bot_token.replace(/'/g, "'\\''");
      const runCmd = `docker run -d --name ${containerName} -e BOT_TOKEN='${safeToken}' --restart unless-stopped ${imageName}`;
      await execPromise(runCmd);
      deployLog += `>>> Deployment successful!\n`;

      // Update Database
      await db.query(`
        UPDATE telegram_bots
        SET status = 'running', container_name = $1, last_deploy_at = NOW(), last_deploy_log = $2
        WHERE id = $3
      `, [containerName, deployLog, bot.id]);

       await db.query(`
        INSERT INTO activity_logs (admin_id, user_name, user_role, event_type, event_key, target, description, ip_address, severity)
        VALUES ($1, $2, $3, 'telegram', 'bot_deploy', $4, $5, $6, 'info')
      `, [req.admin?.id, req.admin?.name, req.admin?.role, bot.name, `Deployed Telegram bot ${bot.name} via Git`, req.ip]);

      res.json({ ok: true, logs: deployLog });
    } catch (deployError) {
      deployLog += `\n>>> DEPLOY ERROR: ${deployError.message || deployError.stderr}`;
      await db.query("UPDATE telegram_bots SET last_deploy_log = $1, last_deploy_at = NOW() WHERE id = $2", [deployLog, bot.id]);
      throw deployError;
    } finally {
      // Cleanup
      try { await execPromise(`rm -rf ${tmpDir}`); } catch(e){}
    }
  } catch (err) {
    console.error('[telegram] deploy error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
