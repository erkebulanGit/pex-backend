const express = require('express');
const Stock = require('../models/Stock');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { broadcast } = require('../websocket/wsServer');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ createdAt: -1 });
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:ticker', async (req, res) => {
  try {
    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() });
    if (!stock) return res.status(404).json({ message: 'Stock not found' });
    res.json(stock);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { ticker, companyName, price } = req.body;

    if (!ticker || !companyName) {
      return res.status(400).json({ message: 'Ticker and company name are required' });
    }

    if (req.user.ownedStock) {
      return res.status(409).json({ message: 'You already have a stock listed' });
    }

    const existingTicker = await Stock.findOne({ ticker: ticker.toUpperCase() });
    if (existingTicker) {
      return res.status(409).json({ message: 'Ticker already exists' });
    }

    const stock = new Stock({
      ticker: ticker.toUpperCase(),
      companyName,
      price: price || 10.00,
      owner: req.user._id,
      ownerUsername: req.user.username,
    });

    await stock.save();

    await User.findByIdAndUpdate(req.user._id, { ownedStock: stock._id });

    res.status(201).json(stock);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Ticker already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:ticker/price', auth, async (req, res) => {
  try {
    const { price } = req.body;

    if (!price || typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    const stock = await Stock.findOne({ ticker: req.params.ticker.toUpperCase() });
    if (!stock) return res.status(404).json({ message: 'Stock not found' });

    if (stock.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You do not own this stock' });
    }

    stock.price = price;
    await stock.save();

    broadcast({
      type: 'TICKER_UPDATE',
      payload: {
        ticker: stock.ticker,
        price: stock.price,
      },
    });

    res.json(stock);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
