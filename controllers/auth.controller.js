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
    const { name, email, password, role, phone } = req.body;

    if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });

    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });

    const existing = await User.findOne({ $or: query });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, email, phone, password, role });
    // create refresh token and save to user
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens.push(refreshToken);
    await user.save();
    user.password = undefined;
    res.status(201).json({ user, token: generateToken(user), refreshToken });
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
    const { identifier, type } = req.body; // type: 'email' or 'phone'
    if (!identifier || !type) return res.status(400).json({ message: 'identifier and type are required' });

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) * 60000 : 10 * 60000));

    await Otp.findOneAndUpdate(
      { identifier, type },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    if (type === 'email') {
      const subject = 'Your OTP Code';
      const text = `Your OTP code is ${code}. It expires in 10 minutes.`;
      await sendMail({ to: identifier, subject, text });
    } else {
      // Phone/SMS sending not implemented here — integrate your SMS provider.
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
    const { identifier, type, code, name, role } = req.body;
    if (!identifier || !type || !code) return res.status(400).json({ message: 'identifier, type and code are required' });

    const otp = await Otp.findOne({ identifier, type, code });
    if (!otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });

    // remove used otp
    await Otp.deleteOne({ _id: otp._id });

    // find or create user
    const query = type === 'email' ? { email: identifier } : { phone: identifier };
    let user = await User.findOne(query);
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      user = await User.create({ name: name || 'User', password: randomPassword, role: role || 'staff', ...query });
      // save refresh token
      const refreshToken = generateRefreshToken(user);
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push(refreshToken);
      await user.save();
      user.password = undefined;
      return res.json({ user, token: generateToken(user), refreshToken });
    }

    // existing user — issue tokens
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
