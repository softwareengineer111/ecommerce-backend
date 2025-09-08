const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

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
