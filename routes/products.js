
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Get all products
router.get('/', async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

// Get single product
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ msg: 'Product not found' });
  res.json(product);
});

// Create product (protected)
router.post('/', auth, async (req, res) => {
  const data = req.body;
  try {
    const p = new Product(data);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(400).json({ msg: 'Invalid data', err: err.message });
  }
});

// Update product (protected)
router.put('/:id', auth, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(p);
  } catch (err) {
    res.status(400).json({ msg: 'Update failed' });
  }
});

// Delete (protected)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deleted' });
  } catch (err) {
    res.status(400).json({ msg: 'Delete failed' });
  }
});

module.exports = router;
