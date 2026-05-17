const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Otp = require('../models/otp.model');
const { sendMail } = require('../utils/mailer');
const crypto = require('crypto');

// ────────────────────────────────────────────
//  Helper: token generators
// ────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

const generateRefreshToken = (user) => {
  const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: user._id }, secret, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });
};

const OTP_EXPIRY_MS = () =>
  (process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) : 10) * 60000;

const generateOtpCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ────────────────────────────────────────────
//  1. REGISTER  →  sends OTP to email
// ────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const {
      fullName, email, phone, password, confirmPassword, role,
      pharmacyName, address, city, district, pharmacyPhone,
      licenseNumber, pharmacyEmail, nidNumber, drugLicenseNo, ownerName,
    } = req.body;

    // Validations
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'fullName, email and password are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Create OTP and store full registration payload
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS());

    await Otp.findOneAndUpdate(
      { identifier: email, type: 'email', purpose: 'register' },
      {
        code,
        expiresAt,
        verified: false,
        payload: {
          fullName, email, phone, password, role,
          pharmacyName, address, city, district, pharmacyPhone,
          licenseNumber, pharmacyEmail, nidNumber, drugLicenseNo, ownerName,
        },
      },
      { upsert: true, new: true }
    );

    // Send OTP email
    await sendMail({
      to: email,
      subject: '🔐 Registration OTP – Pharmacy Management',
      text: `Hello ${fullName},\n\nYour registration OTP is: ${code}\nIt will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          <div style="background:#2563eb;padding:20px;text-align:center;color:#fff">
            <h2 style="margin:0">Pharmacy Management</h2>
          </div>
          <div style="padding:24px">
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>Your registration OTP is:</p>
            <div style="text-align:center;margin:20px 0">
              <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#2563eb">${code}</span>
            </div>
            <p style="color:#666;font-size:14px">This code will expire in <strong>10 minutes</strong>.</p>
          </div>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: 'Registration OTP sent to your email' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  2. VERIFY REGISTRATION OTP  →  creates user + issues tokens
// ────────────────────────────────────────────
exports.verifyRegisterOtp = async (req, res, next) => {
  try {
    const { email, otp: code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'email and otp are required' });
    }

    const otpDoc = await Otp.findOne({ identifier: email, type: 'email', purpose: 'register', code });
    if (!otpDoc) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (otpDoc.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });

    // Double-check user doesn't already exist
    const existing = await User.findOne({ email });
    if (existing) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const p = otpDoc.payload || {};

    // Create the user
    const user = await User.create({
      fullName: p.fullName || 'User',
      email: p.email,
      phone: p.phone,
      password: p.password,
      role: p.role || 'staff',
      pharmacyName: p.pharmacyName,
      address: p.address,
      city: p.city,
      district: p.district,
      pharmacyPhone: p.pharmacyPhone,
      pharmacyEmail: p.pharmacyEmail,
      licenseNumber: p.licenseNumber,
      nidNumber: p.nidNumber,
      drugLicenseNo: p.drugLicenseNo,
      ownerName: p.ownerName,
    });

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });

    await Otp.deleteOne({ _id: otpDoc._id });

    user.password = undefined;
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
      token,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  3. RESEND OTP  →  resend OTP for any purpose
// ────────────────────────────────────────────
exports.resendOtp = async (req, res, next) => {
  try {
    const { email, purpose } = req.body; // purpose: 'register' | 'reset'
    if (!email || !purpose) {
      return res.status(400).json({ success: false, message: 'email and purpose are required' });
    }

    const otpDoc = await Otp.findOne({ identifier: email, type: 'email', purpose });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'No pending OTP found. Please start the process again.' });
    }

    // Generate new code
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS());
    otpDoc.code = code;
    otpDoc.expiresAt = expiresAt;
    otpDoc.verified = false;
    await otpDoc.save();

    await sendMail({
      to: email,
      subject: '🔐 Resend OTP – Pharmacy Management',
      text: `Your new OTP is: ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          <div style="background:#2563eb;padding:20px;text-align:center;color:#fff">
            <h2 style="margin:0">Pharmacy Management</h2>
          </div>
          <div style="padding:24px">
            <p>Your new OTP is:</p>
            <div style="text-align:center;margin:20px 0">
              <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#2563eb">${code}</span>
            </div>
            <p style="color:#666;font-size:14px">This code will expire in <strong>10 minutes</strong>.</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  4. LOGIN  →  email + password
// ────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens.push(refreshToken);
    await user.save();

    user.password = undefined;
    user.refreshTokens = undefined;

    res.json({
      success: true,
      message: 'Login successful',
      user,
      token,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  5. LOGIN AS ROLE  →  quick role-based login (email + role)
// ────────────────────────────────────────────
exports.loginAsRole = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'email, password and role are required' });
    }

    const validRoles = ['admin', 'pharmacist', 'manager', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const user = await User.findOne({ email, role }).select('+password +refreshTokens');
    if (!user) return res.status(401).json({ success: false, message: `No ${role} account found with this email` });

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens.push(refreshToken);
    await user.save();

    user.password = undefined;
    user.refreshTokens = undefined;

    res.json({
      success: true,
      message: `Logged in as ${role}`,
      user,
      token,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  6. FORGOT PASSWORD  →  send reset OTP
// ────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS());

    await Otp.findOneAndUpdate(
      { identifier: email, type: 'email', purpose: 'reset' },
      { code, expiresAt, verified: false },
      { upsert: true, new: true }
    );

    await sendMail({
      to: email,
      subject: '🔑 Password Reset OTP – Pharmacy Management',
      text: `Your password reset OTP is: ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          <div style="background:#dc2626;padding:20px;text-align:center;color:#fff">
            <h2 style="margin:0">Password Reset</h2>
          </div>
          <div style="padding:24px">
            <p>Hello <strong>${user.fullName}</strong>,</p>
            <p>Your password reset OTP is:</p>
            <div style="text-align:center;margin:20px 0">
              <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#dc2626">${code}</span>
            </div>
            <p style="color:#666;font-size:14px">This code will expire in <strong>10 minutes</strong>.<br/>If you did not request this, please ignore.</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true, message: 'Password reset OTP sent to your email' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  7. VERIFY RESET OTP  →  just verifies, does NOT reset password yet
// ────────────────────────────────────────────
exports.verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp: code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'email and otp are required' });
    }

    const otpDoc = await Otp.findOne({ identifier: email, type: 'email', purpose: 'reset', code });
    if (!otpDoc) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (otpDoc.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'OTP expired' });

    // Mark as verified so reset-password endpoint can proceed
    otpDoc.verified = true;
    otpDoc.expiresAt = new Date(Date.now() + 5 * 60000); // give 5 more minutes for new password
    await otpDoc.save();

    res.json({ success: true, message: 'OTP verified. You can now set a new password.' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  8. RESET PASSWORD  →  set new password (after OTP verified)
// ────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'email and newPassword are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Check for a verified reset OTP
    const otpDoc = await Otp.findOne({ identifier: email, type: 'email', purpose: 'reset', verified: true });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Please verify OTP first' });
    }
    if (otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Session expired. Please restart the process.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });

    user.password = newPassword;
    user.refreshTokens = []; // invalidate all sessions
    await user.save();

    await Otp.deleteOne({ _id: otpDoc._id });

    res.json({ success: true, message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
//  9. CHANGE PASSWORD  →  (logged-in user)
// ────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
// 10. GET ME  →  current user profile
// ────────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
// 11. REFRESH TOKEN
// ────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

    if (!user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Refresh token revoked' });
    }

    // Rotate refresh token
    const newRefresh = generateRefreshToken(user);
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    user.refreshTokens.push(newRefresh);
    await user.save();

    const token = generateToken(user);
    res.json({ success: true, token, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────
// 12. LOGOUT
// ────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    let decoded = null;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch {
      /* ignore */
    }

    if (decoded) {
      const user = await User.findById(decoded.id).select('+refreshTokens');
      if (user && user.refreshTokens && user.refreshTokens.includes(refreshToken)) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
        await user.save();
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};
