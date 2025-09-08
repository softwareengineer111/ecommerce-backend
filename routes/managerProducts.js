const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Get products of logged-in manager
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'shopmanager') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const products = await Product.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
