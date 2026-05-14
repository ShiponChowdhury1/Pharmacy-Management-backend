const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Otp = require('../models/otp.model');
const { sendMail } = require('../utils/mailer');
const crypto = require('crypto');

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
};

const generateRefreshToken = (user) => {
  const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: user._id }, secret, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  });
};

exports.register = async (req, res, next) => {
  try {
    // Register: send OTP to email/phone with registration payload
    const { name, email, password, role, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });

    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });

    const existing = await User.findOne({ $or: query });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const identifier = email || phone;
    const type = email ? 'email' : 'phone';
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) * 60000 : 10 * 60000));

    await Otp.findOneAndUpdate(
      { identifier, type, purpose: 'register' },
      { code, expiresAt, payload: { name, email, phone, password, role } },
      { upsert: true, new: true }
    );

    if (type === 'email') {
      const subject = 'Your registration OTP';
      const text = `Your registration OTP is ${code}. It expires in 10 minutes.`;
      await sendMail({ to: identifier, subject, text });
    } else {
      console.warn('Registration OTP created for phone; SMS not configured. Code:', code);
    }

    res.json({ message: 'Registration OTP sent' });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });

    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });

    const user = await User.findOne({ $or: query }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // generate and persist a refresh token
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();

    user.password = undefined;
    res.json({ user, token: generateToken(user), refreshToken });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    if (!user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ message: 'Refresh token revoked' });
    }

    // rotate refresh token
    const newRefresh = generateRefreshToken(user);
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
    user.refreshTokens.push(newRefresh);
    await user.save();

    const token = generateToken(user);
    res.json({ token, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    // verify token to get user id (but we'll remove token regardless)
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    let decoded = null;
    try { decoded = jwt.verify(refreshToken, secret); } catch (e) { /* ignore */ }

    if (decoded) {
      const user = await User.findById(decoded.id);
      if (user && user.refreshTokens && user.refreshTokens.includes(refreshToken)) {
        user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
        await user.save();
      }
    }

    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

// Send OTP to email or phone (email implemented via nodemailer)
exports.sendOtp = async (req, res, next) => {
  try {
    const { identifier, type, purpose, payload } = req.body; // type: 'email' or 'phone'
    if (!identifier || !type) return res.status(400).json({ message: 'identifier and type are required' });

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) * 60000 : 10 * 60000));

    await Otp.findOneAndUpdate(
      { identifier, type, purpose: purpose || 'login' },
      { code, expiresAt, payload },
      { upsert: true, new: true }
    );

    if (type === 'email') {
      const subject = (purpose === 'register') ? 'Your registration OTP' : 'Your OTP Code';
      const text = `Your OTP code is ${code}. It expires in 10 minutes.`;
      await sendMail({ to: identifier, subject, text });
    } else {
      console.warn('OTP created for phone; no SMS provider configured. Code:', code);
    }

    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
};

// Verify OTP and issue tokens (creates user if not exists)
exports.verifyOtp = async (req, res, next) => {
  try {
    const { identifier, type, code } = req.body;
    if (!identifier || !type || !code) return res.status(400).json({ message: 'identifier, type and code are required' });

    const otp = await Otp.findOne({ identifier, type, code });
    if (!otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });

    // handle by purpose
    if (otp.purpose === 'register') {
      const payload = otp.payload || {};
      const q = {};
      if (payload.email) q.email = payload.email;
      if (payload.phone) q.phone = payload.phone;
      const existing = await User.findOne(q);
      if (existing) {
        await Otp.deleteOne({ _id: otp._id });
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = await User.create({ name: payload.name || 'User', email: payload.email, phone: payload.phone, password: payload.password, role: payload.role || 'staff' });
      const refreshToken = generateRefreshToken(user);
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push(refreshToken);
      await user.save();
      await Otp.deleteOne({ _id: otp._id });
      user.password = undefined;
      return res.json({ user, token: generateToken(user), refreshToken });
    }

    if (otp.purpose === 'reset') {
      // for reset flow we expect reset-password endpoint to handle new password; here just acknowledge
      await Otp.deleteOne({ _id: otp._id });
      return res.json({ message: 'OTP verified' });
    }

    // default: login/create behavior
    await Otp.deleteOne({ _id: otp._id });
    const query = type === 'email' ? { email: identifier } : { phone: identifier };
    let user = await User.findOne(query);
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await User.create({ name: 'User', password: randomPassword, role: 'staff', ...query });
      const refreshToken = generateRefreshToken(user);
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push(refreshToken);
      await user.save();
      user.password = undefined;
      return res.json({ user, token: generateToken(user), refreshToken });
    }

    const refreshToken = generateRefreshToken(user);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();
    user.password = undefined;
    res.json({ user, token: generateToken(user), refreshToken });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'No user with that email' });

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) * 60000 : 10 * 60000));
    await Otp.findOneAndUpdate({ identifier: email, type: 'email', purpose: 'reset' }, { code, expiresAt }, { upsert: true, new: true });
    const subject = 'Password reset OTP';
    const text = `Your password reset OTP is ${code}. It expires in 10 minutes.`;
    await sendMail({ to: email, subject, text });
    res.json({ message: 'Password reset OTP sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp: code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ message: 'email, otp and new_password required' });
    const otp = await Otp.findOne({ identifier: email, type: 'email', purpose: 'reset', code });
    if (!otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: 'No user with that email' });
    user.password = new_password;
    user.refreshTokens = [];
    await user.save();
    await Otp.deleteOne({ _id: otp._id });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};
