module.exports = function (req, res, next) {
  if (!req.user.role || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Access denied. Not an admin.' });
  }
  next();
};
