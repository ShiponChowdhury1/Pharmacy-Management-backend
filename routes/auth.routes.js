const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// ── Public Routes ──
router.post('/register', authCtrl.register);                  // Step 1: send registration OTP
router.post('/verify-register-otp', authCtrl.verifyRegisterOtp); // Step 2: verify OTP → create user
router.post('/resend-otp', authCtrl.resendOtp);                // Resend OTP (register or reset)

router.post('/login', authCtrl.login);                         // Login with email + password
router.post('/login-as-role', authCtrl.loginAsRole);           // Login with specific role

router.post('/forgot-password', authCtrl.forgotPassword);      // Step 1: send reset OTP
router.post('/verify-reset-otp', authCtrl.verifyResetOtp);     // Step 2: verify reset OTP
router.post('/reset-password', authCtrl.resetPassword);        // Step 3: set new password

router.post('/refresh', authCtrl.refresh);                     // Refresh access token
router.post('/refresh-token', authCtrl.refresh);               // Alias
router.post('/logout', authCtrl.logout);                       // Logout (revoke refresh token)

// ── Protected Routes ──
router.get('/me', protect, authCtrl.me);                       // Get current user profile
router.post('/change-password', protect, authCtrl.changePassword); // Change password (logged in)

module.exports = router;
