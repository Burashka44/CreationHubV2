const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const fetch = require('node-fetch');
const db    = require('../lib/db');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';

// GET /api/ai/models
router.get('/models', requireAuth, async (req, res) => {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!resp.ok) return res.status(502).json({ error: 'Ollama недоступна' });
    const data = await resp.json();
    res.json(data); // { models: [...] }
  } catch (err) {
    res.status(502).json({ error: 'Ollama недоступна', detail: err.message });
  }
});

// POST /api/ai/chat  — streaming proxy
router.post('/chat', requireAuth, async (req, res) => {
  const { model, messages, temperature = 0.7, max_tokens, stream = true } = req.body;
  if (!model || !messages?.length) return res.status(400).json({ error: 'model + messages required' });

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role:    m.role,
          content: m.content,
          ...(m.images?.length ? { images: m.images } : {}),
        })),
        options: { temperature, ...(max_tokens ? { num_predict: max_tokens } : {}) },
        stream,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    if (!stream) {
      const data = await resp.json();
      return res.json(data);
    }

    // Forward Ollama NDJSON stream → SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let buffer = '';

    resp.body.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      
      // Process all complete lines
      // The last element is either empty string (if buffer ended with \n) 
      // or an incomplete line (which we keep in buffer)
      buffer = lines.pop(); 

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const delta = json.message?.content || '';
          
          // re-emit as OpenAI-compatible SSE
          res.write(`data: ${JSON.stringify({
            choices: [{ delta: { content: delta }, finish_reason: json.done ? 'stop' : null }],
          })}\n\n`);

          if (json.done) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } catch (e) {
          console.error('[AI Stream Parse Error]', e.message, line);
        }
      }
    });

    resp.body.on('end', () => {
      // If there's anything left in buffer (unlikely for valid NDJSON but possible)
      if (buffer && buffer.trim()) {
        try {
            const json = JSON.parse(buffer);
            const delta = json.message?.content || '';
            res.write(`data: ${JSON.stringify({
                choices: [{ delta: { content: delta }, finish_reason: json.done ? 'stop' : null }],
            })}\n\n`);
             if (json.done) {
                res.write('data: [DONE]\n\n');
             }
        } catch {}
      }
      res.end();
    });

    resp.body.on('error', err => { 
        console.error('[AI Stream Error]', err);
        res.write(`data: [ERROR] ${err.message}\n\n`); 
        res.end(); 
    });
    
    req.on('close', () => resp.body.destroy());

  } catch (err) {
    console.error('[AI Proxy Error]', err);
    res.status(502).json({ error: err.message });
  }
});

// POST /api/ai/generate  (raw generation)
router.post('/generate', requireAuth, async (req, res) => {
  const { model, prompt, stream = false, options = {} } = req.body;
  if (!model || !prompt) return res.status(400).json({ error: 'model + prompt required' });

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream, options }),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/ai/history — last N AI chat log entries
router.get('/history', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, model, prompt_preview, response_preview, tokens_used, duration_ms, created_at
       FROM ai_usage_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
