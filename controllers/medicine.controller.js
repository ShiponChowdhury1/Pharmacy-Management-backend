const Medicine = require('../models/medicine.model');
const StockHistory = require('../models/stockHistory.model');

// @desc    Create a new medicine
// @route   POST /api/medicines
// @access  Private / Admin
exports.createMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.create(req.body);
    res.status(201).json({ success: true, data: med, message: 'Medicine created successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all medicines (with pagination, search, and filters)
// @route   GET /api/medicines
// @access  Private
exports.getMedicines = async (req, res, next) => {
  try {
    const { search, category, supplier, expired, lowStock, page = 1, limit = 20 } = req.query;
    const query = {};

    // Search by name or generic name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'All') {
      query.category = category;
    }

    if (supplier) query.supplier = supplier;
    if (expired === 'true') query.expiryDate = { $lte: new Date() };
    if (lowStock === 'true') query.quantity = { $lte: 10 };

    const docs = await Medicine.find(query)
      .populate('supplier', 'name email phone')
      .sort({ createdAt: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

    const total = await Medicine.countDocuments(query);

    res.json({
      success: true,
      data: docs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single medicine details
// @route   GET /api/medicines/:id
// @access  Private
exports.getMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findById(req.params.id).populate('supplier');
    if (!med) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: med });
  } catch (err) {
    next(err);
  }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
// @access  Private / Admin
exports.updateMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!med) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: med, message: 'Medicine updated successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete medicine
// @route   DELETE /api/medicines/:id
// @access  Private / Admin
exports.deleteMedicine = async (req, res, next) => {
  try {
    const med = await Medicine.findByIdAndDelete(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Adjust stock (used internally or could be an endpoint later)
exports.adjustStock = async (medicineId, change, type, userId, note) => {
  const med = await Medicine.findById(medicineId);
  if (!med) throw new Error('Medicine not found');

  med.quantity += change;
  await med.save();

  await StockHistory.create({ medicine: medicineId, change, type, user: userId, note });
};
