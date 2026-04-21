# Implementation Plan: GInaTor

## Overview

GInaTor is a web-based git visualization tool built with Node.js/Express, DynamoDB, Pug templates (Tailwind CSS/DaisyUI), and D3.js/Three.js. Implementation follows a foundation-first approach: project scaffolding and infrastructure, then backend modules (auth, crypto, data layer, git connector, API), then frontend framework (layout, state, timeline), then visualizations, then cross-cutting features (linking, comparison, export, bookmarks), and finally AI, digest, and documentation.

## Tasks

- [x] 1. Project scaffolding and core infrastructure
  - [x] 1.1 Initialize project structure and dependencies
    - Create `source/` directory structure: `modules/`, `public/js/`, `views/`, `__tests__/`
    - Create `terraform/` directory
    - Initialize `package.json` with latest stable Express, Passport.js, bcrypt, express-session, aws-sdk v3, D3.js, Three.js, helmet, cors, csurf, node-cron, html2canvas, jspdf, pug
    - Add dev dependencies: Jest, Supertest, fast-check
    - Create `.env.example` with all environment variables
    - _Requirements: 43.1, 43.2, 43.3, 44.1, 44.2, 44.3, 44.4_

  - [x] 1.2 Create DynamoDB table schemas and local setup
    - Create initialization script for all 8 DynamoDB tables: Users, Sessions, Commits, RepositoryConfigs, AdminSettings, SprintMarkers, Annotations, Bookmarks
    - Define key schemas, GSIs (email-index on Users, repo-date-index on Commits), and TTL on Sessions
    - Create `docker-compose.yml` with DynamoDB Local
    - Create npm scripts for local dev mode
    - _Requirements: 7.1, 7.2, 7.6, 42.1, 42.2, 42.3, 42.4, 42.5_

  - [x] 1.3 Create Dockerfile and Terraform infrastructure
    - Create `Dockerfile` for production container build
    - Create Terraform modules: VPC (public/private subnets, NAT, security groups), ECS Fargate (cluster, service, task definition), ECR repository, ALB (HTTPS listener, target group), DynamoDB tables, IAM roles/policies, CloudWatch Log Group
    - Define Terraform variables and outputs (ALB DNS, ECR URL, DynamoDB ARNs)
    - _Requirements: 41.1–41.11, 43.3_

- [x] 2. Crypto service and middleware stack
  - [x] 2.1 Implement AES-256-GCM crypto service
    - Create `source/modules/crypto/` with `encrypt(plaintext, key)` and `decrypt(encrypted, key)` functions
    - Return `{iv, ciphertext, authTag}` from encrypt; throw authentication error on wrong key
    - _Requirements: 3.9, 4.14_

  - [x] 2.2 Write property test for AES-256-GCM round-trip
    - **Property 6: AES-256-GCM Encryption Round-Trip**
    - **Validates: Requirements 3.9**

  - [x] 2.3 Implement Express middleware stack
    - Create `source/app.js` with middleware: helmet, cors, express.json, express.urlencoded, CSRF protection, input sanitization, express-session with DynamoDB store, Passport.js init, rate limiter on `/auth/*`
    - Configure secure, httpOnly, sameSite strict session cookies
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 3.7, 3.8_

  - [x] 2.4 Write property test for input sanitization
    - **Property 5: Input Sanitization**
    - **Validates: Requirements 3.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Authentication module
  - [x] 4.1 Implement auth service and Passport.js local strategy
    - Create `source/modules/auth/` with `AuthService.register(email, password)`, `AuthService.login(email, password)`, `AuthService.isApproved(userId)`
    - Implement email/password validation (well-formed email, password ≥ 8 chars)
    - Hash passwords with bcrypt (cost factor ≥ 10)
    - First user auto-approved as Admin; subsequent users get Pending status
    - Integrate Passport.js local strategy
    - _Requirements: 1.1–1.8, 2.1, 2.2, 3.5_

  - [x] 4.2 Write property test for email and password validation
    - **Property 1: Email and Password Validation**
    - **Validates: Requirements 1.3**

  - [x] 4.3 Write property test for password hashing round-trip
    - **Property 2: Password Hashing Round-Trip**
    - **Validates: Requirements 1.4, 3.5**

  - [x] 4.4 Implement auth routes and session management
    - Create `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/status`
    - Create session on login, invalidate on logout, clear cookie
    - Return generic error on invalid credentials (no email/password hint)
    - Handle duplicate email (409 Conflict)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 3.3_

  - [x] 4.5 Implement auth middleware for protected routes
    - Create middleware that checks session for all routes except `/auth/register`, `/auth/login`, static assets
    - Redirect unauthenticated page requests to `/auth/login`; return 401 JSON for API requests
    - Redirect pending users to `/auth/pending` page
    - Return 403 for non-admin access to `/admin`
    - _Requirements: 2.3, 3.4, 3.10, 3.11, 3.12, 3.13, 4.2, 4.3_

  - [x] 4.6 Write property test for protected route authentication enforcement
    - **Property 3: Protected Route Authentication Enforcement**
    - **Validates: Requirements 3.4**

  - [x] 4.7 Write property test for pending user access denial
    - **Property 4: Pending User Access Denial**
    - **Validates: Requirements 2.3**

  - [x] 4.8 Write property test for credential exclusion from unauthenticated responses
    - **Property 7: Credential Exclusion from Unauthenticated Responses**
    - **Validates: Requirements 3.10, 3.12, 3.13**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Admin module and repository configuration
  - [x] 6.1 Implement admin routes and panel
    - Create `source/modules/admin/` with routes for `/admin` panel rendering
    - Implement user management: list pending users, approve (`POST /admin/users/:id/approve`), reject (`POST /admin/users/:id/reject`)
    - Implement repository config CRUD: create/update (`POST /admin/repos`), delete (`DELETE /admin/repos/:id`)
    - Implement AI provider config: set provider selection, store encrypted API keys (`POST /admin/ai-config`)
    - Implement prompt template config (`POST /admin/prompt`)
    - Implement sprint marker CRUD (`POST /admin/markers`)
    - Implement digest email config (`POST /admin/digest`)
    - Implement webhook config (`POST /admin/webhooks/:repoId`)
    - _Requirements: 4.1, 4.4–4.14, 2.4, 2.5, 2.6, 6.1, 6.6, 14.1, 14.2, 14.5, 39.1–39.3_

  - [x] 6.2 Create admin panel Pug template
    - Create `source/views/pages/admin.pug` extending base layout
    - Sections: user management, repository configuration, AI provider config, prompt template, sprint markers, digest email, webhook config
    - _Requirements: 4.1, 4.4, 14.1, 14.8, 39.1_

- [x] 7. Git connector module
  - [x] 7.1 Implement Git Connector strategy pattern and providers
    - Create `source/modules/git-connector/` with `GitConnector` interface: `validate(config)`, `fetchLog(config, sinceCommitHash?)`, `parseWebhookPayload(payload)`
    - Implement `LocalGitProvider` using `child_process` git CLI
    - Implement `GitHubProvider` using GitHub REST API with PAT auth
    - Implement `GitLabProvider` using GitLab REST API with PAT auth
    - Implement `CodeCommitProvider` using AWS SDK v3 CodeCommitClient
    - Return normalized `CommitRecord[]` from all providers
    - Support incremental sync (fetch only commits newer than latest stored)
    - _Requirements: 5.1–5.8_

  - [x] 7.2 Write property test for git log parsing completeness
    - **Property 8: Git Log Parsing Completeness**
    - **Validates: Requirements 5.5**

  - [x] 7.3 Write property test for incremental sync correctness
    - **Property 9: Incremental Sync Correctness**
    - **Validates: Requirements 5.6**

- [x] 8. Webhook handler
  - [x] 8.1 Implement webhook handler module
    - Create `source/modules/webhooks/` with `POST /webhooks/:repoId` route
    - Validate HMAC-SHA256 webhook signature against stored secret
    - Extract commit refs from GitHub/GitLab webhook payloads
    - Trigger incremental sync via Git Connector
    - Return 401 on invalid signature, 404 on unknown repo (no details revealed)
    - _Requirements: 6.2–6.7_

  - [x] 8.2 Write property test for webhook signature validation
    - **Property 10: Webhook Signature Validation**
    - **Validates: Requirements 6.3**

- [x] 9. Commit storage layer
  - [x] 9.1 Implement commit store with DynamoDB operations
    - Create commit store module with CRUD operations against Commits table
    - Use `repositoryId` + `commitHash` composite key for deduplication
    - Implement date range queries using `repo-date-index` GSI
    - Support descending order by commitDate
    - Handle `ConditionalCheckFailedException` as success (idempotent dedup)
    - Support DynamoDB Local via `DYNAMODB_ENDPOINT` env var
    - _Requirements: 7.1–7.6_

  - [x] 9.2 Write property test for commit deduplication
    - **Property 11: Commit Deduplication**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 9.3 Write property test for date range query correctness
    - **Property 12: Date Range Query Correctness**
    - **Validates: Requirements 7.4, 7.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Visualization API endpoints
  - [x] 11.1 Implement core API routes and pagination
    - Create `source/modules/api/` with Express router under `/api/v1/`
    - Implement authentication middleware (session cookie or API token)
    - Implement pagination helper with `limit` and `offset` query params
    - Implement common query parameter parsing: `repoId`, `from`, `to`
    - Return 400/401/404/500 with appropriate error messages
    - Create API docs endpoint at `/api/v1/docs`
    - _Requirements: 40.1–40.8_

  - [x] 11.2 Write property test for API pagination correctness
    - **Property 26: API Pagination Correctness**
    - **Validates: Requirements 40.5**

  - [x] 11.3 Implement stats endpoint
    - `GET /api/v1/stats` — compute contributor count, file count, date range, commit count
    - _Requirements: 11.1_

  - [x] 11.4 Write property test for repository stats computation
    - **Property 13: Repository Stats Computation**
    - **Validates: Requirements 11.1**

  - [x] 11.5 Implement heatmap aggregation endpoint
    - `GET /api/v1/heatmap` — author × time period grid with commit counts
    - _Requirements: 19.1_

  - [x] 11.6 Write property test for contributor heatmap aggregation
    - **Property 15: Contributor Heatmap Aggregation**
    - **Validates: Requirements 19.1**

  - [x] 11.7 Implement treemap endpoint
    - `GET /api/v1/treemap` — file change frequency data
    - _Requirements: 20.1_

  - [x] 11.8 Write property test for file change frequency computation
    - **Property 16: File Change Frequency Computation**
    - **Validates: Requirements 20.1**

  - [x] 11.9 Implement sunburst endpoint
    - `GET /api/v1/sunburst` — code ownership with primary contributor per file/folder
    - _Requirements: 21.1, 21.2_

  - [x] 11.10 Write property test for primary contributor computation
    - **Property 17: Primary Contributor Computation**
    - **Validates: Requirements 21.2**

  - [x] 11.11 Implement pulse and spike detection endpoint
    - `GET /api/v1/pulse` — commit velocity time series with daily/weekly/monthly granularity
    - Include spike detection (values exceeding mean + 2×stddev)
    - _Requirements: 23.1, 23.7_

  - [x] 11.12 Write property test for commit velocity aggregation
    - **Property 18: Commit Velocity Aggregation**
    - **Validates: Requirements 23.1**

  - [x] 11.13 Write property test for activity spike detection
    - **Property 19: Activity Spike Detection**
    - **Validates: Requirements 23.7**

  - [x] 11.14 Implement collaboration endpoint
    - `GET /api/v1/collaboration` — author collaboration network (edges for shared file edits)
    - _Requirements: 25.1, 25.3_

  - [x] 11.15 Write property test for author collaboration graph
    - **Property 20: Author Collaboration Graph**
    - **Validates: Requirements 25.1, 25.3**

  - [x] 11.16 Implement file types endpoint
    - `GET /api/v1/filetypes` — file extension distribution
    - _Requirements: 26.1_

  - [x] 11.17 Write property test for file type distribution
    - **Property 21: File Type Distribution**
    - **Validates: Requirements 26.1**

  - [x] 11.18 Implement activity matrix endpoint
    - `GET /api/v1/activity-matrix` — 7×24 day-of-week × hour grid
    - _Requirements: 27.1_

  - [x] 11.19 Write property test for activity matrix aggregation
    - **Property 22: Activity Matrix Aggregation**
    - **Validates: Requirements 27.1**

  - [x] 11.20 Implement remaining visualization endpoints
    - `GET /api/v1/branches` — branch/merge graph data (_Requirements: 22.1_)
    - `GET /api/v1/impact` — impact burst data per commit (_Requirements: 24.1_)
    - `GET /api/v1/bubblemap` — bubble map data (_Requirements: 28.1_)
    - `GET /api/v1/complexity` — code complexity trend data (_Requirements: 29.1_)
    - `GET /api/v1/pr-flow` — PR/MR review flow (GitHub/GitLab only) (_Requirements: 30.1_)
    - _Requirements: 22.1, 24.1, 28.1, 29.1, 30.1_

  - [x] 11.21 Implement bus factor and stale files endpoints
    - `GET /api/v1/bus-factor` — distinct contributor count per file/directory
    - `GET /api/v1/stale-files` — files not modified within threshold months
    - _Requirements: 31.1, 32.1_

  - [x] 11.22 Write property test for bus factor computation
    - **Property 23: Bus Factor Computation**
    - **Validates: Requirements 31.1**

  - [x] 11.23 Write property test for stale file detection
    - **Property 24: Stale File Detection**
    - **Validates: Requirements 32.1**

  - [x] 11.24 Implement timeline aggregation endpoint
    - Aggregate commits into time buckets with additions/deletions/modifications sums
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 11.25 Write property test for timeline aggregation invariant
    - **Property 14: Timeline Aggregation Invariant**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x] 11.26 Implement city block metrics endpoint
    - Compute building height (line count) and footprint (change frequency) per file
    - _Requirements: 17.2_

  - [x] 11.27 Write property test for building dimension proportionality
    - **Property 27: Building Dimension Proportionality**
    - **Validates: Requirements 17.2**

  - [x] 11.28 Implement annotations and bookmarks endpoints
    - `GET /api/v1/annotations` — CRUD for annotations per repo
    - `GET /api/v1/bookmarks` — user's saved bookmarks
    - _Requirements: 15.1, 15.4, 15.5, 36.3, 36.4, 36.5_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Release notes generator and digest email
  - [x] 13.1 Implement release notes generator module
    - Create `source/modules/release-notes/` with `generate(commits, provider, apiKey, promptTemplate)`
    - Implement `OpenAIAdapter` using Chat Completions API
    - Implement `AnthropicAdapter` using Messages API
    - Delegate to correct adapter based on admin config
    - Handle missing provider/key with descriptive errors
    - _Requirements: 38.1–38.10_

  - [x] 13.2 Implement digest email service
    - Create `source/modules/digest/` with `generateDigest(repoIds, period)` and `sendDigest(userEmails, digestHtml)`
    - Compute top contributors, hottest files, commit velocity for period
    - Send via SES; log failures per user without interrupting others
    - Schedule with node-cron (weekly/monthly based on admin config)
    - Filter out opted-out users
    - _Requirements: 39.1–39.8_

- [x] 14. Frontend layout and base templates
  - [x] 14.1 Create Pug base layout and partials
    - Create `source/views/layout.pug` extending web-template-tailadmin layout (sidebar, header, content area)
    - Create `source/views/partials/header.pug` — repo selector, stats bar, theme toggle, compare toggle, user menu
    - Create `source/views/partials/sidebar.pug` — visualization switcher with 17 viz types
    - Create `source/views/partials/timeline-scrubber.pug` — timeline bar placeholder
    - Create `source/views/partials/footer.pug` — credits link
    - _Requirements: 8.1–8.4_

  - [x] 14.2 Create page templates
    - Create `source/views/pages/login.pug`, `register.pug`, `pending.pug`
    - Create `source/views/pages/dashboard.pug` — main visualization page
    - Create `source/views/pages/diff-viewer.pug` — file diff viewer page
    - Create `source/views/pages/credits.pug` — attribution page
    - Wire Express routes to render each template
    - _Requirements: 8.1, 8.3, 47.1–47.7_

  - [x] 14.3 Implement theme toggle
    - Create `source/public/js/theme/ThemeToggle.js`
    - Toggle dark/light Tailwind CSS + DaisyUI theme classes
    - Persist preference to DynamoDB via API call; restore on login
    - Default to light theme for new users
    - _Requirements: 9.1–9.6_

  - [x] 14.4 Implement repository selector
    - Create repository selector dropdown in header partial
    - Fetch configured repos from API; display in dropdown
    - On selection change, notify AppState, reload timeline and active visualization
    - Show single repo name without dropdown indicator if only one configured
    - _Requirements: 10.1–10.7_

  - [x] 14.5 Implement repository stats bar
    - Create stats bar component in header partial
    - Display contributor count, file count, first/last commit dates, commit count
    - Update on repo change and date range change
    - Format dates and numbers for readability
    - _Requirements: 11.1–11.7_

- [x] 15. Client-side state management and timeline
  - [x] 15.1 Implement AppState central state manager
    - Create `source/public/js/state/AppState.js`
    - Manage: selected repo, date range, active visualization, theme, scrub position
    - Implement pub/sub event system for state changes
    - _Requirements: 10.2, 12.4, 13.6, 13.11_

  - [x] 15.2 Implement URL state encoding/decoding
    - Encode visualization type, date range, repo ID into URL query params
    - Decode URL params on page load to restore view state
    - _Requirements: 36.1, 36.2, 36.6_

  - [x] 15.3 Write property test for view state URL round-trip
    - **Property 25: View State URL Round-Trip**
    - **Validates: Requirements 36.1, 36.2**

  - [x] 15.4 Implement Timeline Scrubber
    - Create `source/public/js/timeline/TimelineScrubber.js`
    - Render D3 stacked area chart (additions green, deletions red, modifications blue)
    - Implement left/right range slider handles for date range selection
    - Display selected start/end dates adjacent to sliders
    - Implement "Select All" control to reset range
    - Implement scrub mode: click middle area to enter, drag position indicator through commits
    - Notify all visualizations on range change and scrub position change
    - Synchronize with repository selector
    - _Requirements: 13.1–13.13_

  - [x] 15.5 Implement Sprint/Release Markers overlay
    - Create `source/public/js/timeline/SprintMarkers.js`
    - Render vertical marker lines on timeline at marker dates
    - Show tooltip on hover (label, date, description)
    - Click marker to set left slider to marker date
    - _Requirements: 14.3, 14.4, 14.6, 14.7_

  - [x] 15.6 Implement Annotation Manager
    - Create `source/public/js/annotations/AnnotationManager.js`
    - CRUD for annotations (target commit or date range, label, description)
    - Display flag/pin markers on timeline; tooltip on hover
    - Stack/offset overlapping annotations
    - _Requirements: 15.1–15.8_

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Visualization base and 2D visualizations
  - [x] 17.1 Implement VisualizationBase class
    - Create base class with common interface: `load()`, `update()`, `scrubTo()`, `highlight()`, `clearHighlight()`, `resize()`, `exportSVG()`, `destroy()`
    - Wire to AppState for date range and scrub position updates
    - _Requirements: 12.2, 12.4_

  - [x] 17.2 Implement Contributor Heatmap
    - Create `source/public/js/visualizations/ContributorHeatmap.js`
    - D3 grid: rows = authors, columns = days/weeks, color intensity = commit count
    - Tooltip on hover; daily/weekly toggle; sequential color scale
    - _Requirements: 19.1–19.7_

  - [x] 17.3 Implement File Hotspot Treemap
    - Create `source/public/js/visualizations/FileHotspotTreemap.js`
    - D3 treemap: rectangles sized by change frequency, cool-to-hot color gradient
    - Click for commit history detail panel; drill-down into directories
    - _Requirements: 20.1–20.7_

  - [x] 17.4 Implement Code Ownership Sunburst
    - Create `source/public/js/visualizations/OwnershipSunburst.js`
    - D3 sunburst: concentric rings by directory depth, colored by primary contributor
    - Tooltip with ownership percentages; click to zoom into segment; legend
    - _Requirements: 21.1–21.8_

  - [x] 17.5 Implement Branch/Merge Graph
    - Create `source/public/js/visualizations/BranchMergeGraph.js`
    - D3 network graph: branches as parallel lanes, merge/divergence edges
    - Zoom/pan; click branch for commit list; click commit for details; distinct branch colors
    - _Requirements: 22.1–22.9_

  - [x] 17.6 Implement Commit Pulse
    - Create `source/public/js/visualizations/CommitPulse.js`
    - D3 line chart: commits over time; daily/weekly/monthly granularity toggle
    - Tooltip on hover; click data point to adjust timeline; highlight spikes (>2σ)
    - _Requirements: 23.1–23.8_

  - [x] 17.7 Implement Impact Visualization
    - Create `source/public/js/visualizations/ImpactViz.js`
    - D3 radial burst: central circle sized by total lines changed, tendrils to affected files
    - Color-code tendrils by change type; sequential animation mode; tooltip on hover
    - _Requirements: 24.1–24.8_

  - [x] 17.8 Implement Author Collaboration Network
    - Create `source/public/js/visualizations/CollaborationNetwork.js`
    - D3 force-directed graph: nodes = authors (sized by commits), edges = shared files (thickness by count)
    - Tooltip on node/edge hover; click node to highlight author commits on timeline
    - _Requirements: 25.1–25.9_

  - [x] 17.9 Implement File Type Distribution Chart
    - Create `source/public/js/visualizations/FileTypeDistribution.js`
    - D3 donut chart: segments by file extension, sized by change count
    - Tooltip on hover; click segment for filtered commit list; legend
    - _Requirements: 26.1–26.8_

  - [x] 17.10 Implement Activity Matrix
    - Create `source/public/js/visualizations/ActivityMatrix.js`
    - D3 matrix: 7 rows (days) × 24 columns (hours), color intensity = commit count
    - Tooltip on hover; click cell for filtered commits; row/column labels
    - _Requirements: 27.1–27.8_

  - [x] 17.11 Implement Bubble Map
    - Create `source/public/js/visualizations/BubbleMap.js`
    - D3 bubble pack: sized by selectable metric (change freq, lines, contributors), colored by selectable dimension (contributor, file type, churn)
    - Metric/color selectors; directory clustering; drill-down with breadcrumbs; tooltip; legend
    - _Requirements: 28.1–28.13_

  - [x] 17.12 Implement Code Complexity Trend
    - Create `source/public/js/visualizations/ComplexityTrend.js`
    - D3 line chart: time vs complexity metric (file size or cyclomatic complexity)
    - File/directory selector; threshold highlighting; click data point to open diff viewer
    - _Requirements: 29.1–29.9_

  - [x] 17.13 Implement PR Review Flow
    - Create `source/public/js/visualizations/PRReviewFlow.js`
    - D3 Sankey diagram: authors → reviewers → merge targets
    - Flow band sized by PR/MR count; tooltip on hover; click reviewer for detail panel
    - Show "GitHub/GitLab only" message for other providers
    - _Requirements: 30.1–30.9_

  - [x] 17.14 Implement Bus Factor View
    - Create `source/public/js/visualizations/BusFactorView.js`
    - Tabular view: files sorted by bus factor ascending; warning color for bus factor = 1
    - Overlay mode for treemap/bubble map; tooltip with contributor list
    - _Requirements: 31.1–31.7_

  - [x] 17.15 Implement Stale File View
    - Create `source/public/js/visualizations/StaleFileView.js`
    - Tabular view: stale files sorted by last modification date ascending
    - Display file path, last mod date, last author, months since modification
    - Threshold selector (default 6 months); click to open diff viewer; overlay mode
    - _Requirements: 32.1–32.8_

  - [x] 17.16 Implement Genome Sequence
    - Create `source/public/js/visualizations/GenomeSequence.js`
    - D3 linear genome browser: horizontal time axis, files as colored tracks stacked vertically
    - Change types by color (green/red/blue); band height by magnitude; author lanes
    - Zoom in/out; click commit for details; hover tooltip; legend
    - _Requirements: 18.1–18.13_

- [x] 18. 3D visualizations (Three.js)
  - [x] 18.1 Implement TimeBloom visualization
    - Create `source/public/js/visualizations/TimeBloom.js`
    - Three.js WebGL radial tree: root at center, directories as branches, files as leaf nodes
    - Force-directed elastic layout with configurable elasticity
    - Animate: bloom on add, pulse on modify, shrink/fade on delete
    - Contributor avatars moving to modified files; idle fade-out/re-appear
    - File idle timeout with fade-out and re-bloom
    - Playback controls: Play, Pause, speed (0.5x, 1x, 2x, 4x), progress indicator
    - Camera controls: zoom, pan, auto-follow most active area
    - _Requirements: 16.1–16.16_

  - [x] 18.2 Implement City Block visualization
    - Create `source/public/js/visualizations/CityBlock.js`
    - Three.js 3D city: files as buildings (height = line count, footprint = change frequency)
    - Directory grouping as city blocks with streets; glow on modification
    - Color-coding selector (contributor, file type, file age); camera controls
    - Tooltip on hover; click for commit history; legend
    - _Requirements: 17.1–17.12_

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Cross-cutting visualization features
  - [x] 20.1 Implement Cross-Visualization Linking
    - Create `source/public/js/linking/CrossVizLinker.js`
    - Pub/sub system: click author in heatmap → highlight in collaboration network + filter pulse
    - Click author in collaboration → highlight in heatmap + filter pulse
    - Click file in treemap → highlight in sunburst + bubble map
    - Show active filter indicator on each viz; "Clear All Filters" control
    - _Requirements: 34.1–34.7_

  - [x] 20.2 Implement Comparison Mode
    - Create `source/public/js/comparison/ComparisonMode.js`
    - Side-by-side dual viz rendering: two date ranges or two repos
    - "Compare" toggle in header; config controls for left/right sides
    - Synchronized zoom/pan; labels above each side
    - Deactivate returns to single-viz layout preserving left-side config
    - _Requirements: 35.1–35.9_

  - [x] 20.3 Implement Export Service
    - Create `source/public/js/export/ExportService.js`
    - PNG export via html2canvas; SVG serialization; PDF via jsPDF
    - Include title, date range, repo name as header in exports
    - PNG/SVG at viewport dimensions; PDF at A4/Letter
    - Static snapshot for animated/interactive elements
    - _Requirements: 37.1–37.8_

  - [x] 20.4 Implement File Diff Viewer
    - Create `source/public/js/diff/DiffViewer.js`
    - Side-by-side and unified diff modes
    - Additions green, deletions red, unchanged default
    - Constrain timeline to file's commit history; scrub through file commits
    - Restore timeline range on close
    - _Requirements: 33.1–33.8_

  - [x] 20.5 Implement Bookmarkable Views
    - Create bookmark save/load UI: "Save Bookmark" control, "My Bookmarks" panel
    - Store bookmarks in DynamoDB (userId, vizType, dateRange, repoId)
    - Load bookmark restores full view state; "Copy Link" copies URL to clipboard
    - Access denied message for unauthorized repo URLs (no details revealed)
    - _Requirements: 36.1–36.8_

- [x] 21. Visualization Switcher wiring
  - [x] 21.1 Wire all 17 visualizations to the sidebar switcher
    - Register all visualization modules with the Visualization Switcher sidebar
    - Show/hide visualizations on sidebar selection; indicate active viz
    - Preserve timeline state when switching; collapsible sidebar
    - _Requirements: 12.1–12.7_

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Documentation and credits
  - [x] 23.1 Create README.md
    - Introduction with GInaTor name explanation (Phineas and Ferb "-inator" reference)
    - Local development setup: DynamoDB Local, docker-compose, npm scripts
    - AWS deployment: Terraform, ECR image push, ECS deployment
    - Environment variables reference table
    - Architecture overview (Express backend, Pug frontend, DynamoDB, Git Connector, visualization engine)
    - Attribution and credits section: Gource link, D3.js, Three.js, Express, Passport.js, Tailwind CSS, DaisyUI, fast-check
    - _Requirements: 46.1–46.6, 47.5, 47.6_

  - [x] 23.2 Add JSDoc comments to all exported modules
    - Add JSDoc comments on all exported functions, classes, and modules
    - Describe purpose, parameters, and return values
    - _Requirements: 45.4_

- [x] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 27 universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The implementation language is JavaScript (Node.js) as specified in the design document
- Testing uses Jest + Supertest + fast-check as specified in the design
- All frontend styling uses Tailwind CSS + DaisyUI classes from the web-template-tailadmin template
