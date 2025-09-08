module.exports = function (req, res, next) {
  if (req.user.role !== 'shopmanager') {
    return res
      .status(403)
      .json({ msg: 'Access denied. Requires shop manager role.' });
  }
  next();
};
