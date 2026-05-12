const express = require('express');
const router = express.Router();
const supCtrl = require('../controllers/supplier.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/', protect, adminOnly, supCtrl.createSupplier);
router.get('/', protect, supCtrl.getSuppliers);
router.get('/:id', protect, supCtrl.getSupplier);
router.put('/:id', protect, adminOnly, supCtrl.updateSupplier);
router.delete('/:id', protect, adminOnly, supCtrl.deleteSupplier);

module.exports = router;
