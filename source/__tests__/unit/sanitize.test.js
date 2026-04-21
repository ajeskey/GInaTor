'use strict';

const { sanitizeString, sanitizeValue, sanitizeInput } = require('../../modules/middleware/sanitize');

describe('sanitizeString', () => {
  test('removes HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeString('hello <b>world</b>')).toBe('hello world');
    expect(sanitizeString('<img src=x onerror=alert(1)>')).toBe('');
  });

  test('removes JS event handlers', () => {
    expect(sanitizeString('onclick=doEvil()')).toBe('doEvil()');
    expect(sanitizeString('onload = init()')).toBe(' init()');
    expect(sanitizeString('ONMOUSEOVER=hack()')).toBe('hack()');
  });

  test('removes javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeString('JAVASCRIPT:void(0)')).toBe('void(0)');
  });

  test('removes NoSQL operators', () => {
    expect(sanitizeString('$gt')).toBe('');
    expect(sanitizeString('$ne')).toBe('');
    expect(sanitizeString('$where')).toBe('');
    expect(sanitizeString('$regex')).toBe('');
    expect(sanitizeString('$exists')).toBe('');
    expect(sanitizeString('value $gte 5')).toBe('value  5');
  });

  test('returns non-string values unchanged', () => {
    expect(sanitizeString(42)).toBe(42);
    expect(sanitizeString(null)).toBe(null);
    expect(sanitizeString(undefined)).toBe(undefined);
  });

  test('leaves clean strings unchanged', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
    expect(sanitizeString('user@example.com')).toBe('user@example.com');
  });
});

describe('sanitizeValue', () => {
  test('sanitizes nested objects', () => {
    const input = { name: '<b>test</b>', nested: { val: '$ne' } };
    const result = sanitizeValue(input);
    expect(result.name).toBe('test');
    expect(result.nested.val).toBe('');
  });

  test('sanitizes arrays', () => {
    const input = ['<script>x</script>', 'clean'];
    const result = sanitizeValue(input);
    expect(result).toEqual(['x', 'clean']);
  });

  test('strips keys starting with $', () => {
    const input = { $gt: 5, name: 'test' };
    const result = sanitizeValue(input);
    expect(result).toEqual({ name: 'test' });
  });

  test('handles primitives', () => {
    expect(sanitizeValue(42)).toBe(42);
    expect(sanitizeValue(true)).toBe(true);
    expect(sanitizeValue(null)).toBe(null);
  });
});

describe('sanitizeInput middleware', () => {
  test('sanitizes body, query, and params', () => {
    const req = {
      body: { name: '<script>x</script>' },
      query: { search: '$ne' },
      params: { id: '<b>1</b>' }
    };
    const res = {};
    const next = jest.fn();

    sanitizeInput(req, res, next);

    expect(req.body.name).toBe('x');
    expect(req.query.search).toBe('');
    expect(req.params.id).toBe('1');
    expect(next).toHaveBeenCalled();
  });

  test('handles missing body/query/params gracefully', () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    sanitizeInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
