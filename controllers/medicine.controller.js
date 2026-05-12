const Medicine = require('../models/medicine.model');
const StockHistory = require('../models/stockHistory.model');

exports.createMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.create(req.body);
    res.status(201).json({ medicine: med });
  } catch (err) {
    next(err);
  }
};

exports.getMedicines = async (req, res, next) => {
  try {
    const { search, supplier, expired, lowStock, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) query.$text = { $search: search };
    if (supplier) query.supplier = supplier;
    if (expired === 'true') query.expiryDate = { $lte: new Date() };
    if (lowStock === 'true') query.quantity = { $lte: 10 };

    const docs = await Medicine.find(query)
      .populate('supplier')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

    const total = await Medicine.countDocuments(query);

    res.json({ data: docs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

exports.getMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findById(req.params.id).populate('supplier');
    if (!med) return res.status(404).json({ message: 'Medicine not found' });
    res.json({ medicine: med });
  } catch (err) {
    next(err);
  }
};

exports.updateMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!med) return res.status(404).json({ message: 'Medicine not found' });
    res.json({ medicine: med });
  } catch (err) {
    next(err);
  }
};

exports.deleteMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findByIdAndDelete(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medicine not found' });
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    next(err);
  }
};

// Adjust stock (used internally)
exports.adjustStock = async (medicineId, change, type, userId, note) => {
  const med = await Medicine.findById(medicineId);
  if (!med) throw new Error('Medicine not found');

  med.quantity += change;
  await med.save();

  await StockHistory.create({ medicine: medicineId, change, type, user: userId, note });
};
