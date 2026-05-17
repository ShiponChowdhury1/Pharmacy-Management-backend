const Sale = require('../models/sale.model');
const Medicine = require('../models/medicine.model');
const StockHistory = require('../models/stockHistory.model');

exports.createSale = async (req, res, next) => {
  try {
    const { customer, items, paymentMethod = 'Cash', tax = 0, paid = 0 } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'No items provided' });

    // calculate total and validate stock
    let calculatedSubTotal = 0;
    for (const it of items) {
      const med = await Medicine.findById(it.medicine);
      if (!med) return res.status(400).json({ message: 'Medicine not found: ' + it.medicine });
      if (med.quantity < it.quantity) return res.status(400).json({ message: `Insufficient stock for ${med.name}` });
      calculatedSubTotal += it.quantity * it.price;
    }

    const subTotal = req.body.subTotal || calculatedSubTotal;
    const total = subTotal + tax;
    const due = total - paid;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const sale = await Sale.create({ 
      invoiceNumber,
      customer, 
      items, 
      subTotal,
      tax,
      total, 
      paymentMethod,
      paid, 
      due, 
      createdBy: req.user.id 
    });

    // deduct stock and record history
    for (const it of items) {
      await Medicine.findByIdAndUpdate(it.medicine, { $inc: { quantity: -it.quantity } });
      await StockHistory.create({ medicine: it.medicine, change: -it.quantity, type: 'sale', user: req.user.id, note: `Sale ${sale.invoiceNumber || sale._id}` });
    }

    await sale.populate('customer');
    await sale.populate('items.medicine');
    await sale.populate('createdBy', 'name email');

    res.status(201).json({ success: true, sale });
  } catch (err) {
    next(err);
  }
};

exports.getSales = async (req, res, next) => {
  try {
    const sales = await Sale.find()
      .populate('customer')
      .populate('items.medicine')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (err) {
    next(err);
  }
};

exports.getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer')
      .populate('items.medicine')
      .populate('createdBy', 'name email');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ success: true, sale });
  } catch (err) {
    next(err);
  }
};
