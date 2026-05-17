const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  genericName: { type: String },
  category: { type: String, default: 'General' },
  brand: { type: String },
  batchNumber: { type: String },
  price: { type: Number, required: true },
  costPrice: { type: Number },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, default: 'pcs' },
  expiryDate: { type: Date },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  createdAt: { type: Date, default: Date.now }
});

medicineSchema.index({ name: 'text', brand: 'text', batchNumber: 'text' });

module.exports = mongoose.model('Medicine', medicineSchema);
