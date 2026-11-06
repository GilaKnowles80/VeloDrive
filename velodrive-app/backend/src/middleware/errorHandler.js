const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = statusCode >= 500 && isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  // Structured server-side logging for ops/debugging (no stack in client response in prod)
  console.error('[api_error]', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    name: err.name,
    ...(isProd ? {} : { stack: err.stack }),
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;