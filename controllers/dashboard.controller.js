const Medicine = require('../models/medicine.model');
const Sale = require('../models/sale.model');

exports.getStats = async (req, res, next) => {
  try {
    const totalMedicines = await Medicine.countDocuments();
    const lowStock = await Medicine.countDocuments({ quantity: { $lte: 10 } });
    const expired = await Medicine.countDocuments({ expiryDate: { $lte: new Date() } });
    const totalSales = await Sale.countDocuments();

    const salesAgg = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const salesTotal = salesAgg[0] ? salesAgg[0].total : 0;

    res.json({ totalMedicines, lowStock, expired, totalSales, salesTotal });
  } catch (err) {
    next(err);
  }
};

exports.reports = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);

    const sales = await Sale.find(match).populate('customer').populate('items.medicine');
    res.json({ data: sales });
  } catch (err) {
    next(err);
  }
};
