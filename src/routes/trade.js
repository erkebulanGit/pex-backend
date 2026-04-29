const express = require('express');
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/buy', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ticker, shares } = req.body;

    if (!ticker || !shares || shares <= 0 || !Number.isInteger(shares)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Valid ticker and integer shares required' });
    }

    const stock = await Stock.findOne({ ticker: ticker.toUpperCase() }).session(session);
    if (!stock) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Stock not found' });
    }

    if (stock.owner.toString() === req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ message: "You can't buy your own stock" });
    }

    const totalCost = stock.price * shares;
    const buyer = await User.findById(req.user._id).session(session);

    if (buyer.walletBalance < totalCost) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Insufficient funds',
        required: totalCost,
        available: buyer.walletBalance,
      });
    }

    const availableShares = stock.totalShares - stock.sharesInCirculation;
    if (shares > availableShares) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Not enough shares available',
        available: availableShares,
      });
    }

    buyer.walletBalance -= totalCost;

    const existingHolding = buyer.holdings.find(
      (h) => h.ticker === stock.ticker
    );

    if (existingHolding) {
      existingHolding.shares += shares;
    } else {
      buyer.holdings.push({
        ticker: stock.ticker,
        stockId: stock._id,
        shares,
      });
    }

    stock.sharesInCirculation += shares;

    await buyer.save({ session });
    await stock.save({ session });

    await session.commitTransaction();

    const updatedUser = await User.findById(req.user._id)
      .populate('holdings.stockId')
      .populate('ownedStock');

    res.json({
      message: `Successfully bought ${shares} shares of $${stock.ticker}`,
      totalCost,
      user: updatedUser,
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Transaction failed', error: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/sell', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ticker, shares } = req.body;

    if (!ticker || !shares || shares <= 0 || !Number.isInteger(shares)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Valid ticker and integer shares required' });
    }

    const stock = await Stock.findOne({ ticker: ticker.toUpperCase() }).session(session);
    if (!stock) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Stock not found' });
    }

    const seller = await User.findById(req.user._id).session(session);
    const holding = seller.holdings.find((h) => h.ticker === stock.ticker);

    if (!holding || holding.shares < shares) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Insufficient shares',
        owned: holding ? holding.shares : 0,
      });
    }

    const totalValue = stock.price * shares;

    seller.walletBalance += totalValue;
    holding.shares -= shares;

    if (holding.shares === 0) {
      seller.holdings = seller.holdings.filter((h) => h.ticker !== stock.ticker);
    }

    stock.sharesInCirculation -= shares;

    await seller.save({ session });
    await stock.save({ session });

    await session.commitTransaction();

    const updatedUser = await User.findById(req.user._id)
      .populate('holdings.stockId')
      .populate('ownedStock');

    res.json({
      message: `Successfully sold ${shares} shares of $${stock.ticker}`,
      totalValue,
      user: updatedUser,
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Transaction failed', error: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;
