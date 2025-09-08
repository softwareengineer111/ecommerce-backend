const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Create order
router.post('/', auth, async (req, res) => {
  const { items, address } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ msg: 'No order items' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    let total = 0;
    const processedItems = [];
    const productUpdates = [];

    for (const it of items) {
      const prod = await Product.findById(it.product).session(session);
      if (!prod) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ msg: `Product not found: ${it.product}` });
      }
      if (prod.stock < it.qty) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ msg: `Not enough stock for ${prod.name}` });
      }

      const price = prod.price;
      total += price * it.qty;
      processedItems.push({ product: prod._id, qty: it.qty, price });

      // Prepare stock update
      productUpdates.push({
        updateOne: {
          filter: { _id: prod._id },
          update: { $inc: { stock: -it.qty } },
        },
      });
    }

    // Update product stock in bulk
    await Product.bulkWrite(productUpdates, { session });

    const order = new Order({
      user: userId,
      items: processedItems,
      total,
      address,
    });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate product details for the response
    const populatedOrder = await Order.findById(order._id).populate(
      'items.product',
      'name images'
    );
    res.status(201).json(populatedOrder);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get orders for current user
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ADMIN: Get all orders
router.get('/all', [auth, admin], async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get single order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name price images');

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Check if user is admin or owner of the order
    if (
      order.user._id.toString() !== req.user.id &&
      !['admin', 'superadmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ msg: 'User not authorized' });
    }

    res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Order not found' });
    }
    res.status(500).send('Server Error');
  }
});

// ADMIN: Update order status
router.put('/:id/status', [auth, admin], async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Check if status is valid based on the schema enum
    const validStatuses = Order.schema.path('status').enumValues;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
