const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth.routes');
const medRoutes = require('./routes/medicine.routes');
const supRoutes = require('./routes/supplier.routes');
const custRoutes = require('./routes/customer.routes');
const saleRoutes = require('./routes/sale.routes');
const dashRoutes = require('./routes/dashboard.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medRoutes);
app.use('/api/suppliers', supRoutes);
app.use('/api/customers', custRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashRoutes);

app.get('/', (req, res) => res.json({ message: 'Pharmacy Backend API' }));

app.use(errorHandler);

module.exports = app;
