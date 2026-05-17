const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ── Personal Info ──
    fullName: { type: String, required: true, trim: true },
    email: { type: String, unique: true, lowercase: true, sparse: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'staff', 'pharmacist', 'manager'],
      default: 'staff',
    },
    nidNumber: { type: String, trim: true },

    // ── Pharmacy Info ──
    pharmacyName: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    pharmacyPhone: { type: String, trim: true },
    pharmacyEmail: { type: String, lowercase: true, trim: true },
    licenseNumber: { type: String, trim: true },
    drugLicenseNo: { type: String, trim: true },
    ownerName: { type: String, trim: true },

    // ── Status & Tokens ──
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
