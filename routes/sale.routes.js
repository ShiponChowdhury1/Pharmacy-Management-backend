const express = require('express');
const router = express.Router();
const saleCtrl = require('../controllers/sale.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, saleCtrl.createSale);
router.get('/', protect, saleCtrl.getSales);
router.get('/:id', protect, saleCtrl.getSale);

module.exports = router;
