const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 1,
    maxlength: 5,
    match: /^[A-Z]+$/,
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  price: {
    type: Number,
    required: true,
    min: 0.01,
    default: 10.00,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ownerUsername: {
    type: String,
    required: true,
  },
  totalShares: {
    type: Number,
    default: 1000000, 
  },
  sharesInCirculation: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Stock', stockSchema);
