const Supplier = require('../models/supplier.model');

exports.createSupplier = async (req, res, next) => {
  try {
    const sup = await Supplier.create(req.body);
    res.status(201).json({ supplier: sup });
  } catch (err) {
    next(err);
  }
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find();
    res.json({ data: suppliers });
  } catch (err) {
    next(err);
  }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const sup = await Supplier.findById(req.params.id);
    if (!sup) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ supplier: sup });
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sup) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ supplier: sup });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndDelete(req.params.id);
    if (!sup) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    next(err);
  }
};
