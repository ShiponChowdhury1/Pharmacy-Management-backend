const express = require('express');
const router = express.Router();
const custCtrl = require('../controllers/customer.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, custCtrl.createCustomer);
router.get('/', protect, custCtrl.getCustomers);
router.get('/:id', protect, custCtrl.getCustomer);
router.put('/:id', protect, custCtrl.updateCustomer);
router.delete('/:id', protect, custCtrl.deleteCustomer);

module.exports = router;
