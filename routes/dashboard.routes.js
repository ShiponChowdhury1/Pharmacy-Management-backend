const express = require('express');
const router = express.Router();
const dashCtrl = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/stats', protect, dashCtrl.getStats);
router.get('/reports', protect, dashCtrl.reports);

module.exports = router;
