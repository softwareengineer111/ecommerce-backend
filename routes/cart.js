const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// @route   GET api/cart
// @desc    Get user's shopping cart
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate(
      'items.product',
      'name price images stock'
    );

    if (!cart) {
      // If no cart exists for the user, create an empty one.
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.json(cart);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/cart
// @desc    Add/update item in cart
// @access  Private
router.post('/', auth, async (req, res) => {
  const { productId, quantity } = req.body;

  if (quantity < 1) {
    return res.status(400).json({ msg: 'Quantity must be at least 1' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ msg: 'Not enough stock available' });
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex > -1) {
      // Product exists in cart, update quantity
      cart.items[itemIndex].quantity = quantity;
    } else {
      // Product does not exist in cart, add new item
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    // Populate product details for the response
    await cart.populate('items.product', 'name price images stock');

    res.json(cart);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/cart/checkout
// @desc    Create an order from the cart (checkout)
// @access  Private
router.post('/checkout', auth, async (req, res) => {
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

// @route   DELETE api/cart/item/:productId
// @desc    Remove an item from the cart
// @access  Private
router.delete('/item/:productId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ msg: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== req.params.productId
    );

    await cart.save();
    await cart.populate('items.product', 'name price images stock');

    res.json(cart);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/cart
// @desc    Clear all items from the cart
// @access  Private
router.delete('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });

    if (cart) {
      cart.items = [];
      await cart.save();
      res.json(cart);
    } else {
      res.status(404).json({ msg: 'Cart not found' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
