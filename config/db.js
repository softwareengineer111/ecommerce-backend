const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI ||
      'mongodb+srv://testuser:testuser@cluster0.jsgcp0p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
