'use strict';

/**
 * Creates an in-memory rate limiter middleware for specified route patterns.
 * @param {object} [options] - Configuration options.
 * @param {number} [options.windowMs=900000] - Time window in milliseconds (default 15 minutes).
 * @param {number} [options.maxRequests=20] - Maximum requests per window per IP (default 20).
 * @returns {function} Express middleware function.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.maxRequests || 20;
  const store = new Map();

  // Periodically clean up expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(key);
      }
    }
  }, windowMs);

  // Allow the timer to not keep the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function rateLimiterMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 1 };
      store.set(ip, entry);
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, try again later' });
    }

    next();
  }

  rateLimiterMiddleware._store = store;
  rateLimiterMiddleware._cleanup = cleanupInterval;

  return rateLimiterMiddleware;
}

module.exports = { createRateLimiter };
