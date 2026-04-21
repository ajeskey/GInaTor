'use strict';

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

/**
 * Configure Passport.js with a local strategy backed by AuthService.
 * @param {import('./AuthService').AuthService} authService
 */
function configurePassport(authService) {
  // Local strategy: authenticate with email + password
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await authService.login(email, password);
          return done(null, user);
        } catch (err) {
          if (err.statusCode === 401) {
            return done(null, false, { message: 'Invalid credentials' });
          }
          return done(err);
        }
      }
    )
  );

  // Serialize user into session (store userId)
  passport.serializeUser((user, done) => {
    done(null, user.userId);
  });

  // Deserialize user from session (look up by userId)
  passport.deserializeUser(async (userId, done) => {
    try {
      const user = await authService._getUserById(userId);
      if (!user) {
        return done(null, false);
      }
      const { passwordHash: _, ...safeUser } = user;
      done(null, safeUser);
    } catch (err) {
      done(err);
    }
  });
}

module.exports = { configurePassport };
