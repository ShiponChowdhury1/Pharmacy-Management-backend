const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  change: { type: Number, required: true },
  type: { type: String, enum: ['sale', 'purchase', 'adjustment'], required: true },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);
