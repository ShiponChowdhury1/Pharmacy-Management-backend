const mongoose = require('mongoose');


const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true }, // email or phone
  type: { type: String, enum: ['email', 'phone'], required: true },
  purpose: { type: String, enum: ['register', 'reset', 'login'], default: 'login' },
  code: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed }, // optional extra data (e.g., registration payload)
  expiresAt: { type: Date, required: true }
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
