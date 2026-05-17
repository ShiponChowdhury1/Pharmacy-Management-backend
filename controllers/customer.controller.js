const Customer = require('../models/customer.model');
const mongoose = require('mongoose');

exports.createCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.create(req.body);
    res.status(201).json({ success: true, customer: cust });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.aggregate([
      {
        $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'customer',
          as: 'salesList'
        }
      },
      {
        $addFields: {
          totalPurchases: { $size: '$salesList' },
          totalSpent: { $sum: '$salesList.total' },
          id: '$_id' // Frontend sometimes prefers id over _id
        }
      },
      {
        $project: {
          salesList: 0
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID format' });
    }
    const custId = new mongoose.Types.ObjectId(req.params.id);
    const customers = await Customer.aggregate([
      { $match: { _id: custId } },
      {
        $lookup: {
          from: 'sales',
          localField: '_id',
          foreignField: 'customer',
          as: 'salesList'
        }
      },
      {
        $addFields: {
          totalPurchases: { $size: '$salesList' },
          totalSpent: { $sum: '$salesList.total' },
          id: '$_id'
        }
      },
      {
        $project: {
          salesList: 0
        }
      }
    ]);
    if (!customers || customers.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ success: true, customer: customers[0] });
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cust) return res.status(404).json({ message: 'Customer not found' });
    res.json({ success: true, customer: cust });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const cust = await Customer.findByIdAndDelete(req.params.id);
    if (!cust) return res.status(404).json({ message: 'Customer not found' });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};
