const { randomUUID } = require('crypto');

const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming.trim()) ? incoming.trim().slice(0, 128) : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};

module.exports = { requestId };
