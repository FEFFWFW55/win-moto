const jwt = require('jsonwebtoken');

module.exports = (role) => {
  return (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.sendStatus(401);

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      if (role && user.role !== role) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };
};
