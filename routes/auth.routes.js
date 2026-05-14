const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.get('/me', protect, authCtrl.me);
router.post('/refresh', authCtrl.refresh);
router.post('/logout', authCtrl.logout);
router.post('/send-otp', authCtrl.sendOtp);
router.post('/verify-otp', authCtrl.verifyOtp);

module.exports = router;
