// ── WebSocket server for real-time updates
const WebSocket = require('ws');
const host = require('./host');
const db   = require('./db');

let wss = null;
const clients = new Set();

function attach(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    clients.add(ws);
    console.log(`[WS] Client connected: ${ip} (total: ${clients.size})`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (total: ${clients.size})`);
    });

    ws.on('error', () => clients.delete(ws));

    // Send current metrics immediately on connect
    sendMetrics(ws);
  });

  // Broadcast metrics every 5 seconds
  setInterval(broadcastMetrics, 5000);

  return wss;
}

async function sendMetrics(ws) {
  try {
    const metrics = await host.getAllMetrics();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'metrics', data: metrics }));
    }
  } catch {}
}

async function broadcastMetrics() {
  if (clients.size === 0) return;
  try {
    const metrics = await host.getAllMetrics();
    const msg = JSON.stringify({ type: 'metrics', data: metrics });
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  } catch {}
}

// Broadcast any event to all connected clients
function broadcast(type, data) {
  if (!wss || clients.size === 0) return;
  const msg = JSON.stringify({ type, data });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// Broadcast terminal output
function broadcastTerminal(sessionId, data, done = false) {
  broadcast('terminal', { sessionId, data, done });
}

module.exports = { attach, broadcast, broadcastTerminal };
