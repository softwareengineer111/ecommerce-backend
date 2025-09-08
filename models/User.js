const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'shopmanager', 'superadmin'],
      default: 'user',
    },
    shop: {
      name: {
        type: String,
        required: function () {
          return this.role === 'shopmanager';
        },
      },
      location: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
