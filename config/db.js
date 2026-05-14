const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy';

  try {
    const connectOptions = { serverSelectionTimeoutMS: 10000 };
    console.log('Mongoose version:', mongoose.version);
    console.log('Connecting to MongoDB at:', uri.replace(/(mongodb\+srv:\/\/[^:]+):[^@]+@/, '$1:*****@'));
    console.log('Connect options:', connectOptions);

    await mongoose.connect(uri, connectOptions);
    console.log('MongoDB connected');
    return;
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    console.error(err && err.stack ? err.stack : 'no stack');

    // If the primary URI is an Atlas +srv string, attempt a local fallback before giving up.
    const localFallback = process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/pharmacy';
    if (uri && uri.startsWith('mongodb+srv://')) {
      console.warn('Primary +srv connect failed — attempting local fallback:', localFallback);
      try {
        await mongoose.connect(localFallback, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to local MongoDB fallback');
        return;
      } catch (err2) {
        console.error('Local MongoDB fallback failed:', err2 && err2.message ? err2.message : err2);
      }
    }

    throw err;
  }
};

module.exports = connectDB;