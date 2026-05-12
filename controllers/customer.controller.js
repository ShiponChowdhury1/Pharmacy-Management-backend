const Customer = require('../models/customer.model');

exports.createCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.create(req.body);
    res.status(201).json({ customer: cust });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find();
    res.json({ data: customers });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findById(req.params.id);
    if (!cust) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer: cust });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cust) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer: cust });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findByIdAndDelete(req.params.id);
    if (!cust) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};
