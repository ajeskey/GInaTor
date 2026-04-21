'use strict';

const { AuthService, isValidEmail, isValidPassword } = require('./AuthService');
const { configurePassport } = require('./passport-config');
const { createAuthRouter } = require('./routes');

module.exports = {
  AuthService,
  isValidEmail,
  isValidPassword,
  configurePassport,
  createAuthRouter
};
