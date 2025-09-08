const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

// @route   POST api/checkout
// @desc    Create an order from the cart (checkout)
// @access  Private
router.post('/', auth, async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ msg: 'Address is required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    // 1. Find user's cart
    const cart = await Cart.findOne({ user: userId }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ msg: 'Cannot create order from an empty cart' });
    }

    // 2. Process items and check stock
    let total = 0;
    const processedItems = [];
    const productUpdates = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ msg: `Product not found: ${item.product}` });
      }
      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ msg: `Not enough stock for ${product.name}` });
      }

      const price = product.price;
      total += price * item.quantity;
      processedItems.push({ product: product._id, qty: item.quantity, price });

      productUpdates.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $inc: { stock: -item.quantity } },
        },
      });
    }

    // 3. Create the order
    const order = new Order({
      user: userId,
      items: processedItems,
      total,
      address,
    });
    await order.save({ session });

    // 4. Update product stock in bulk
    await Product.bulkWrite(productUpdates, { session });

    // 5. Clear the cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 6. Populate and return the new order
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

module.exports = router;
