'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const csurf = require('csurf');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

const DynamoDBStore = require('./modules/session/DynamoDBStore');
const { sanitizeInput } = require('./modules/middleware/sanitize');
const { createRateLimiter } = require('./modules/middleware/rateLimiter');
const { requireAuth, requireApproved, requireAdmin } = require('./modules/middleware/authGuard');
const { AuthService, configurePassport, createAuthRouter } = require('./modules/auth');
const { AdminService, createAdminRouter } = require('./modules/admin');
const { WebhookHandler, createWebhookRouter } = require('./modules/webhooks');
const CommitStore = require('./modules/commit-store');
const { createApiRouter } = require('./modules/api');

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// 3. Body parsers (capture raw body for webhook HMAC signature validation)
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/webhooks')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// 4. Input sanitization (XSS / NoSQL injection prevention)
app.use(sanitizeInput);

// 5. Session with DynamoDB store
const sessionStore = new DynamoDBStore({
  tableName: 'Sessions',
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
  ttl: 86400 // 24 hours
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// 6. Passport.js initialization (before auth routes so login works)
app.use(passport.initialize());
app.use(passport.session());

// 7. Configure Passport with AuthService
const authService = new AuthService({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1'
});
configurePassport(authService);

// 8. Rate limiter on /auth/* endpoints
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20
});
app.use('/auth', authRateLimiter);

// 9. Auth routes (mounted BEFORE CSRF protection for API client compatibility)
const authRouter = createAuthRouter(authService);
app.use('/auth', authRouter);

// 9.5. Webhook routes (mounted BEFORE CSRF — webhooks are public, authenticated by signature)
const webhookHandler = new WebhookHandler({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
  encryptionKey: process.env.ENCRYPTION_KEY
});
const webhookRouter = createWebhookRouter(webhookHandler);
app.use('/webhooks', webhookRouter);

// 10. CSRF protection (applies to all routes after this point)
const csrfProtection = csurf({ cookie: false });
app.use(csrfProtection);

// 11. CSRF token endpoint (for clients that need a token for protected routes)
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// View engine setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Page routes (public — login, register)
app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.get('/register', (req, res) => {
  res.render('pages/register');
});

// Redirect /auth/login page requests to /login
app.get('/auth/login', (req, res) => {
  res.render('pages/login');
});

app.get('/auth/pending', (req, res) => {
  res.render('pages/pending');
});

// 12. Auth guard middleware for protected routes
// Checks authentication, approval status, and admin role
app.use(requireAuth);
app.use(requireApproved);

// Admin routes require admin role
app.use('/admin', requireAdmin);

// Protected page routes (authenticated + approved)
app.get('/dashboard', (req, res) => {
  res.render('pages/dashboard', { title: 'Dashboard' });
});

app.get('/diff', (req, res) => {
  res.render('pages/diff-viewer', { title: 'Diff Viewer' });
});

app.get('/credits', (req, res) => {
  res.render('pages/credits', { title: 'Credits' });
});

// Root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// 12.5. Visualization API routes (authenticated + approved, mounted before CSRF-protected admin)
const commitStore = new CommitStore({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1'
});
const apiRouter = createApiRouter({ commitStore });
app.use('/api/v1', apiRouter);

// 13. Admin panel routes
const adminService = new AdminService({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
  encryptionKey: process.env.ENCRYPTION_KEY
});
const adminRouter = createAdminRouter(adminService);
app.use('/admin', adminRouter);

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

module.exports = app;
