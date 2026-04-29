const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;

const initWebSocket = (server) => {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const protocols = req.headers['sec-websocket-protocol'];
    let userId = null;

    if (protocols) {
      const tokenList = protocols.split(',').map((p) => p.trim());
      for (const token of tokenList) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.userId;
          break;
        } catch {
        }
      }
    }

    if (!userId) {
      ws.close(4001, 'Unauthorized: Invalid or missing token');
      return;
    }

    ws.userId = userId;
    ws.isAlive = true;

    console.log(`[WS] Client connected: ${userId} | Total: ${wss.clients.size}`);

    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: { message: 'Real-time connection established' },
    }));

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        console.log(`[WS] Message from ${userId}:`, msg);
      } catch {
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${userId} | Total: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${userId}:`, err.message);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log('[WS] WebSocket server initialized');
  return wss;
};

const broadcast = (message) => {
  if (!wss) return;

  const payload = JSON.stringify(message);
  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(`[WS] Broadcast to ${sentCount} clients:`, message);
};

const getConnectionCount = () => (wss ? wss.clients.size : 0);

module.exports = { initWebSocket, broadcast, getConnectionCount };
