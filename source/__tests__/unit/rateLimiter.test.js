'use strict';

const { createRateLimiter } = require('../../modules/middleware/rateLimiter');

describe('createRateLimiter', () => {
  let limiter;

  afterEach(() => {
    if (limiter && limiter._cleanup) {
      clearInterval(limiter._cleanup);
    }
  });

  test('allows requests under the limit', () => {
    limiter = createRateLimiter({ windowMs: 60000, maxRequests: 3 });
    const req = { ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  test('blocks requests over the limit with 429', () => {
    limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    const req = { ip: '10.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests, try again later' });
  });

  test('tracks different IPs independently', () => {
    limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter({ ip: '1.1.1.1' }, res, next);
    limiter({ ip: '2.2.2.2' }, res, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  test('falls back to connection.remoteAddress when ip is missing', () => {
    limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
    const req = { connection: { remoteAddress: '3.3.3.3' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
