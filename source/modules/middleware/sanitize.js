'use strict';

/**
 * Strips HTML tags, JS event handlers, and NoSQL operators from a string.
 * @param {string} str - The input string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove HTML tags
  let sanitized = str.replace(/<[^>]*>/g, '');

  // Remove JS event handler patterns (e.g., onclick=, onload=, onerror=)
  sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript\s*:/gi, '');

  // Remove NoSQL operators ($gt, $ne, $where, $lt, $gte, $lte, $in, $nin, $regex, $exists, $or, $and, $not, $nor, $eq)
  sanitized = sanitized.replace(
    /\$(?:gt|gte|lt|lte|ne|eq|in|nin|regex|exists|where|or|and|not|nor)\b/gi,
    ''
  );

  return sanitized;
}

/**
 * Recursively sanitizes all string values in an object or array.
 * @param {*} obj - The value to sanitize.
 * @returns {*} The sanitized value.
 */
function sanitizeValue(obj) {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeValue);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      // Also strip NoSQL operator keys
      if (/^\$/.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeValue(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
function sanitizeInput(req, res, next) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = { sanitizeInput, sanitizeString, sanitizeValue };
