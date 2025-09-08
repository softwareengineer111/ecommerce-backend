const multer = require('multer');

// We use memoryStorage because we are going to process the image with Cloudinary
// and don't need to save it to disk first.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
