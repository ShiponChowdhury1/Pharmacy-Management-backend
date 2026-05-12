const express = require('express');
const router = express.Router();
const medCtrl = require('../controllers/medicine.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/', protect, adminOnly, medCtrl.createMedicine);
router.get('/', protect, medCtrl.getMedicines);
router.get('/:id', protect, medCtrl.getMedicine);
router.put('/:id', protect, adminOnly, medCtrl.updateMedicine);
router.delete('/:id', protect, adminOnly, medCtrl.deleteMedicine);

module.exports = router;
