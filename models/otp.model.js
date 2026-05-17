const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true },          // email or phone
  type: { type: String, enum: ['email', 'phone'], required: true },
  purpose: {
    type: String,
    enum: ['register', 'reset', 'login', 'verify'],
    default: 'login',
  },
  code: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },         // e.g. full registration data
  verified: { type: Boolean, default: false },            // mark verified for multi-step flows
  expiresAt: { type: Date, required: true },
});

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
