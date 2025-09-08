const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isShopManager = require('../middleware/isShopManager');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// @route   GET api/shop/me
// @desc    Get current shop manager's profile and shop details
// @access  Private/ShopManager
router.get('/me', [auth, isShopManager], async (req, res) => {
  try {
    const manager = await User.findById(req.user.id).select('-password');
    res.json(manager);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/shop/me
// @desc    Update current shop manager's shop details
// @access  Private/ShopManager
router.put('/me', [auth, isShopManager], async (req, res) => {
  const { shopName, shopLocation } = req.body;

  const shopFields = {};
  if (shopName) shopFields['shop.name'] = shopName;
  if (shopLocation) shopFields['shop.location'] = shopLocation;

  try {
    const manager = await User.findByIdAndUpdate(
      req.user.id,
      { $set: shopFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(manager);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/shop/products
// @desc    Get all products for the current shop manager
// @access  Private/ShopManager
router.get('/products', [auth, isShopManager], async (req, res) => {
  try {
    const products = await Product.find({ user: req.user.id })
      .populate('category', 'name')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/shop/orders
// @desc    Get all orders containing products from the current shop manager
// @access  Private/ShopManager
router.get('/orders', [auth, isShopManager], async (req, res) => {
  try {
    // Find all products belonging to this manager
    const products = await Product.find({ user: req.user.id }).select('_id');
    const productIds = products.map((p) => p._id);

    // Find all orders that contain any of these products
    const orders = await Order.find({ 'items.product': { $in: productIds } })
      .populate('user', 'name email')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
