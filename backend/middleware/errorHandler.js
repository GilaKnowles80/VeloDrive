const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || (err.code === 'CIRCUIT_OPEN' ? 503 : 500);
  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = statusCode >= 500 && isProd ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  const requestId = req.id || req.headers['x-request-id'];

  // Structured server-side logging for ops/debugging (no stack in client response in prod)
  console.error(JSON.stringify({
    level: 'error',
    msg: 'api_error',
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: err.message,
    name: err.name,
    code: err.code,
    ...(isProd ? {} : { stack: err.stack }),
    ts: new Date().toISOString(),
  }));

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    requestId,
    ...(isProd ? {} : { stack: err.stack, code: err.code }),
  });
};

module.exports = errorHandler;