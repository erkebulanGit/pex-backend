require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stocks');
const tradeRoutes = require('./routes/trade');
const { initWebSocket, getConnectionCount } = require('./websocket/wsServer');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/trade', tradeRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    wsConnections: getConnectionCount(),
    timestamp: new Date().toISOString(),
  });
});

initWebSocket(server);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[DB] MongoDB connected');
    server.listen(PORT, () => {
      console.log(`[SERVER] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });
