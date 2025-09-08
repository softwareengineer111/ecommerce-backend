const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find()
      .populate('user', 'name shop')
      .populate('category', 'name')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      'user',
      'name shop',
      'category',
      'name'
    );
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Product not found' });
    }
    res.status(500).send('Server error');
  }
});

// Helper function to upload a file buffer to Cloudinary
const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products' },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const canManageProducts = (req, res, next) => {
  if (!['admin', 'superadmin', 'shopmanager'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Access denied.' });
  }
  next();
};

// Create product (protected)
router.post(
  '/',
  [auth, canManageProducts],
  upload.array('images', 5),
  async (req, res) => {
    const { name, description, price, stock, category } = req.body;
    try {
      const imageUrls = [];
      if (req.files) {
        for (const file of req.files) {
          const result = await streamUpload(file.buffer);
          imageUrls.push({
            public_id: result.public_id,
            url: result.secure_url,
          });
        }
      }

      const p = new Product({
        user: req.user.id,
        name,
        description,
        price,
        stock,
        category,
        images: imageUrls,
      });

      await p.save();
      res.status(201).json(p);
    } catch (err) {
      console.error(err);
      res.status(400).json({ msg: 'Invalid data', err: err.message });
    }
  }
);

// Update product (protected)
router.put(
  '/:id',
  [auth, canManageProducts],
  upload.array('images', 5),
  async (req, res) => {
    const { name, description, price, stock, category, imagesToDelete } =
      req.body;
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ msg: 'Product not found' });

      // Check if user is owner or admin
      const isOwner = product.user.toString() === req.user.id;
      const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ msg: 'User not authorized' });
      }

      let images = product.images;

      // 1. Delete images from Cloudinary if requested
      if (imagesToDelete) {
        const publicIdsToDelete = Array.isArray(imagesToDelete)
          ? imagesToDelete
          : [imagesToDelete];
        if (publicIdsToDelete.length > 0) {
          await cloudinary.api.delete_resources(publicIdsToDelete);
          images = images.filter(
            (img) => !publicIdsToDelete.includes(img.public_id)
          );
        }
      }

      // 2. Upload new images if any
      if (req.files) {
        for (const file of req.files) {
          const result = await streamUpload(file.buffer);
          images.push({ public_id: result.public_id, url: result.secure_url });
        }
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { name, description, price, stock, category, images },
        { new: true }
      );

      res.json(updatedProduct);
    } catch (err) {
      console.error(err);
      res.status(400).json({ msg: 'Update failed', err: err.message });
    }
  }
);

// Delete (protected)
router.delete('/:id', [auth, canManageProducts], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });

    // Check if user is owner or admin
    const isOwner = product.user.toString() === req.user.id;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ msg: 'User not authorized' });
    }

    // Delete images from Cloudinary
    const publicIds = product.images.map((img) => img.public_id);
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds);
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ msg: 'Delete failed' });
  }
});

module.exports = router;
