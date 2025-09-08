const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, address } = req.body;
    let total = 0;
    const processedItems = [];

    for (const it of items) {
      const prod = await Product.findById(it.product);
      if (!prod) return res.status(400).json({ msg: 'Product not found' });
      const price = prod.price;
      total += price * it.qty;
      processedItems.push({ product: prod._id, qty: it.qty, price });
    }

    const order = new Order({
      user: userId,
      items: processedItems,
      total,
      address,
    });
    await order.save();
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get orders for current user
router.get('/', auth, async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).populate(
    'items.product'
  );
  res.json(orders);
});

module.exports = router;
