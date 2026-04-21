# Requirements Document

## Introduction

GInaTor is a web-based git version control visualization tool inspired by [Gource](https://gource.io), built with Node.js, Express, DynamoDB, and a Tailwind CSS frontend. The name is a playful reference to Doofenshmirtz from Phineas and Ferb — just as Dr. Doofenshmirtz builds elaborate "-inator" machines, GInaTor is the Git Inator: a tool that turns raw git history into rich, interactive visualizations. GInaTor allows users to visualize git repository history through an interactive browser-based experience, select date ranges and scrub through commits via an enhanced timeline, switch between multiple visualization types from a sidebar, and generate AI-powered release notes using OpenAI or Anthropic. The application supports multiple repositories selectable from a top-left dropdown, uses Passport.js for email-based authentication with an approval workflow, and supports fetching git logs from local git repositories, GitHub, GitLab, and AWS CodeCommit. All application source code resides in `./source/` and Terraform infrastructure configuration resides in `./terraform/`.

## Glossary

- **GInaTor_Server**: The Node.js Express backend application that serves the API and frontend
- **Auth_System**: The Passport.js-based authentication module handling email registration, login, and session management
- **Admin_Panel**: The administrative interface accessible at the /admin route for system configuration
- **Git_Connector**: The module responsible for fetching git log data from four provider types: local git repositories (filesystem path), GitHub repositories (via Personal Access Token), GitLab repositories (via Personal Access Token), and AWS CodeCommit repositories (via ARN)
- **Commit_Store**: The DynamoDB-backed storage layer for persisted git commit history
- **Visualization_Engine**: The browser-based frontend module that renders the TimeBloom interactive visualization of repository history
- **TimeBloom**: The primary animated visualization showing repository file structure as a dynamic tree or graph that evolves over time as commits are played back, with files blooming into view as they are added, pulsing when modified, and fading when deleted
- **Commit_Selector**: The commit selection mechanism integrated into the Timeline_Scrubber, allowing users to select date ranges via left/right sliders and scrub through individual commits by clicking in the middle of the selected range
- **Release_Notes_Generator**: The module that sends selected commit data to the configured AI provider (OpenAI or Anthropic) and returns formatted release notes
- **AI_Provider**: The admin-selected AI service used for release notes generation, either OpenAI (using the Chat Completions API) or Anthropic (using the Messages API)
- **Anthropic_API**: The Anthropic Messages API used to generate release notes when Anthropic is selected as the AI_Provider
- **User**: A registered individual who has been approved and can access the visualization and release notes features
- **Admin**: The first registered user who has automatic approval and can approve subsequent users, configure repositories, set the OpenAI API key, and define the release notes prompt
- **Pending_User**: A registered individual whose account has not yet been approved by the Admin
- **Repository_Config**: The admin-defined configuration specifying which git repository to fetch logs from, including provider type (Local, GitHub, GitLab, or CodeCommit) and associated credentials
- **Timeline_Scrubber**: The interactive timeline bar UI component displayed above the visualization that shows a stacked area chart of commit activity (additions, deletions, modifications) over time, with left and right range sliders for date range selection and a scrub mode activated by clicking in the middle of the selected range
- **Repository_Selector**: The dropdown UI component in the top-left corner of the application that allows the user to switch between available configured repositories
- **Visualization_Switcher**: The left sidebar navigation component that allows the user to switch between different visualization views (e.g., TimeBloom animation, heatmap, treemap, sunburst, network graph, etc.)
- **Contributor_Heatmap**: A grid-based visualization component showing commit frequency per author over time, with rows representing authors, columns representing days or weeks, and color intensity reflecting commit count
- **File_Hotspot_Treemap**: A treemap visualization component where each rectangle represents a file or directory, sized by change frequency and color-coded from cool to hot to indicate churn level
- **Code_Ownership_Sunburst**: A radial sunburst chart visualization component showing the directory tree as concentric rings, color-coded by the primary contributor (most commits) to each file or folder
- **Branch_Merge_Graph**: An interactive network graph visualization component showing branches as parallel lanes with merge points and divergence points, supporting zoom, pan, and click interactions
- **Commit_Pulse**: A line chart visualization component showing commit velocity over time (commits per day, week, or month) with a granularity toggle
- **Impact_Visualization**: A radial burst visualization component that renders each commit as an explosion where size represents total lines changed and tendrils reach out to each affected file
- **Author_Collaboration_Network**: A force-directed graph visualization component where author nodes are connected by edges representing shared file edits, with edge thickness proportional to shared file count and node size proportional to total commits
- **File_Type_Distribution_Chart**: A donut or pie chart visualization component showing the breakdown of file types (by extension) changed across commits
- **Activity_Matrix**: A matrix or heatmap visualization component showing commit activity by day of week (rows) and hour of day (columns), with color intensity reflecting commit count per time slot
- **Infrastructure_Config**: The Terraform configuration located in `./terraform/` that provisions all AWS resources required to deploy and run GInaTor, including ECS Fargate, DynamoDB tables, ALB, ECR, VPC networking, and IAM roles
- **File_Diff_Viewer**: A side-by-side or unified diff view component that displays file changes between versions, with a constrained timeline scrubber scoped to the file's history
- **DynamoDB_Local**: The local development instance of DynamoDB used for offline development and testing, included in the docker-compose setup and toggled via environment variable
- **Bubble_Map**: A bubble-based visualization component where each bubble represents a file or directory, sized by a selectable metric (change frequency, line count, or contributor count), clustered by directory structure, and color-coded by a selectable dimension (primary contributor, file type, or churn level)
- **Repository_Stats_Bar**: A compact statistics bar displayed in the application header area showing at-a-glance repository metrics including total contributor count, total file count, first commit date, last commit date, and total number of commits
- **Credits_Page**: The attribution page accessible from the application footer or about page that credits Gource, visualization libraries, and other significant open-source dependencies used by GInaTor
- **Code_Complexity_Trend**: A line chart visualization component tracking cyclomatic complexity or file size over time for a selected file or directory, helping users identify when code is becoming unwieldy
- **PR_Review_Flow**: A Sankey diagram visualization component showing how code flows from author to reviewer to merge for GitHub and GitLab repositories, highlighting review bottlenecks
- **Cross_Visualization_Linking**: The linked brushing system that synchronizes selections and highlights across all active visualization components, so that interacting with an element in one view updates related views
- **Bookmarkable_View**: A saved combination of a specific visualization type, date range, and repository selection that can be recalled via a shareable URL or a named bookmark stored per user
- **Comparison_Mode**: A side-by-side display mode that renders two instances of the same visualization for two different date ranges or two different repositories, enabling before/after or cross-project comparison
- **Export_Service**: The module responsible for exporting any active visualization as a PNG, SVG, or PDF file for use in reports and presentations
- **Digest_Email**: A scheduled email containing key repository statistics (top contributors, hottest files, commit velocity) sent to approved users on a weekly or monthly cadence as configured by the Admin
- **Annotation**: A user-created note pinned to a specific commit or date range on the Timeline_Scrubber, used to mark significant events such as releases, refactors, or milestones
- **Webhook_Sync**: An integration mode where GitHub or GitLab webhooks automatically trigger commit ingestion in the Git_Connector, replacing or supplementing manual sync
- **Visualization_API**: A set of REST API endpoints exposed by the GInaTor_Server that return visualization data in JSON format for programmatic consumption by external dashboards or CI/CD pipelines
- **Theme_Toggle**: A UI control that switches the application between dark and light visual themes, applying the corresponding Tailwind CSS and DaisyUI theme classes from the web-template-tailadmin template
- **Bus_Factor_Calculator**: An analysis module that computes the number of distinct contributors who have modified each file or directory, highlighting files with a bus factor of one as high-risk
- **Stale_File_Detector**: An analysis module that identifies files in the repository that have not been modified within a configurable number of months, surfacing potential dead code
- **Sprint_Release_Marker**: A vertical marker overlaid on the Timeline_Scrubber representing an admin-defined release tag or sprint boundary date, providing temporal context for visualizations
- **City_Block**: A 3D city-metaphor visualization component where the repository is rendered as a city viewed from above, with files represented as buildings (height for line count or complexity, footprint for change frequency), grouped into city blocks by directory structure, and streets representing the directory hierarchy
- **Genome_Sequence**: A linear genome-browser-inspired visualization component where the commit history is rendered as a horizontal sequence with time on the horizontal axis, files as colored annotation tracks stacked vertically, and change types encoded by color (green for additions, red for deletions, blue for modifications)

## Requirements

### Requirement 1: Email Registration and Login

**User Story:** As a visitor, I want to register and log in with my email address, so that I can access the GInaTor application.

#### Acceptance Criteria

1. THE Auth_System SHALL provide an email and password registration endpoint at POST /auth/register
2. THE Auth_System SHALL provide an email and password login endpoint at POST /auth/login
3. WHEN a visitor submits a registration request, THE Auth_System SHALL validate that the email is a well-formed email address and the password is at least 8 characters long
4. WHEN a visitor submits a registration request with a valid email and password, THE Auth_System SHALL create a new user record in DynamoDB with a hashed password
5. WHEN a visitor submits a registration request with an email that already exists, THE Auth_System SHALL return an error indicating the email is already registered
6. WHEN a user submits valid login credentials, THE Auth_System SHALL create an authenticated session and return a session cookie
7. WHEN a user submits invalid login credentials, THE Auth_System SHALL return an authentication error without revealing whether the email or password was incorrect
8. THE Auth_System SHALL use Passport.js local strategy for all authentication operations

### Requirement 2: User Approval Workflow

**User Story:** As an admin, I want to approve new user registrations, so that only authorized individuals can access the application.

#### Acceptance Criteria

1. WHEN the first user registers and no other users exist in the system, THE Auth_System SHALL automatically mark that user as approved and assign the Admin role
2. WHEN a subsequent user registers, THE Auth_System SHALL create the account with a Pending_User status
3. WHILE a user has Pending_User status, THE Auth_System SHALL deny access to all application routes except a "pending approval" status page
4. WHEN the Admin approves a Pending_User via the Admin_Panel, THE Auth_System SHALL update the user status to approved
5. WHEN the Admin rejects a Pending_User via the Admin_Panel, THE Auth_System SHALL remove the user record from DynamoDB
6. THE Admin_Panel SHALL display a list of all Pending_Users with options to approve or reject each one

### Requirement 3: Session and Security

**User Story:** As a user, I want my session to be secure and the application to follow security best practices, so that my account and data are protected.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL use express-session with a secure, HTTP-only session cookie
2. THE GInaTor_Server SHALL store session data in DynamoDB
3. WHEN a user session expires or the user logs out, THE Auth_System SHALL invalidate the session and clear the session cookie
4. THE GInaTor_Server SHALL protect all application routes (except /auth/register, /auth/login, and static assets) with authentication middleware
5. THE GInaTor_Server SHALL hash all passwords using bcrypt with a minimum cost factor of 10 before storing them in DynamoDB
6. THE GInaTor_Server SHALL sanitize all user inputs to prevent injection attacks (XSS, SQL injection, NoSQL injection)
7. THE GInaTor_Server SHALL implement CSRF protection on all state-changing endpoints
8. THE GInaTor_Server SHALL implement rate limiting on authentication endpoints to prevent brute-force attacks
9. THE GInaTor_Server SHALL encrypt all stored Personal Access Tokens, ARNs, and API keys (OpenAI and Anthropic) using AES-256-GCM with a server-side encryption key
10. THE GInaTor_Server SHALL exclude all API keys (OpenAI, Anthropic), Personal Access Tokens, and ARNs from any API response served to unauthenticated users
11. THE GInaTor_Server SHALL exclude all API keys, Personal Access Tokens, and ARNs from frontend source code and client-side JavaScript bundles
12. THE GInaTor_Server SHALL exclude all API keys, Personal Access Tokens, and ARNs from error messages returned to unauthenticated users
13. IF an unauthenticated user requests any endpoint that would return sensitive credentials, THEN THE GInaTor_Server SHALL return a 401 Unauthorized response without including any credential values in the response body

### Requirement 4: Admin Panel

**User Story:** As an admin, I want a configuration panel at a hidden route, so that I can manage the application settings without exposing admin functionality to regular users.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL serve the Admin_Panel at the /admin route
2. WHEN an unauthenticated visitor accesses /admin, THE GInaTor_Server SHALL redirect to the login page
3. WHEN a non-Admin authenticated user accesses /admin, THE GInaTor_Server SHALL return a 403 Forbidden response
4. WHEN the Admin accesses /admin, THE Admin_Panel SHALL display sections for repository configuration, user management, AI provider configuration, and release notes prompt configuration
5. THE Admin_Panel SHALL allow the Admin to set and update the OpenAI API key, storing it encrypted in DynamoDB
6. THE Admin_Panel SHALL allow the Admin to set and update the Anthropic API key, storing it encrypted in DynamoDB
7. THE Admin_Panel SHALL allow the Admin to select which AI_Provider (OpenAI or Anthropic) to use for release notes generation, storing the selection in DynamoDB
8. THE Admin_Panel SHALL allow the Admin to set and update a custom prompt template that guides the Release_Notes_Generator
9. THE Admin_Panel SHALL allow the Admin to configure one or more Repository_Configs, each specifying a provider type of Local (filesystem path), GitHub (repository URL and Personal Access Token), GitLab (repository URL and Personal Access Token), or CodeCommit (repository name and ARN)
10. WHEN the Admin configures a GitHub repository, THE Admin_Panel SHALL require a repository URL and a Personal Access Token (PAT) for authentication
11. WHEN the Admin configures a GitLab repository, THE Admin_Panel SHALL require a repository URL and a Personal Access Token (PAT) for authentication
12. WHEN the Admin configures a CodeCommit repository, THE Admin_Panel SHALL require a repository name and an ARN for authentication
13. WHEN the Admin configures a Local repository, THE Admin_Panel SHALL require a filesystem directory path
14. THE Admin_Panel SHALL store all Personal Access Tokens, ARNs, and API keys (OpenAI and Anthropic) encrypted in DynamoDB

### Requirement 5: Git Log Retrieval

**User Story:** As an admin, I want to configure git repositories from multiple providers and fetch their commit history, so that the application has data to visualize.

#### Acceptance Criteria

1. WHEN the Admin configures a Local repository path in the Admin_Panel, THE Git_Connector SHALL validate that the path exists and contains a valid git repository
2. WHEN the Admin configures a GitHub repository in the Admin_Panel, THE Git_Connector SHALL validate connectivity to the GitHub repository using the provided Personal Access Token via the GitHub REST API
3. WHEN the Admin configures a GitLab repository in the Admin_Panel, THE Git_Connector SHALL validate connectivity to the GitLab repository using the provided Personal Access Token via the GitLab REST API
4. WHEN the Admin configures a CodeCommit repository in the Admin_Panel, THE Git_Connector SHALL validate connectivity to the CodeCommit repository using the provided ARN via the AWS SDK
5. WHEN the Admin triggers a sync for a configured repository, THE Git_Connector SHALL retrieve the full git log including commit hash, author name, author email, commit date, commit message, and list of changed files with their change type (added, modified, deleted)
6. THE Git_Connector SHALL support incremental sync by fetching only commits newer than the most recent commit stored in the Commit_Store for that repository
7. IF the Git_Connector encounters an error during log retrieval, THEN THE Git_Connector SHALL log the error and return a descriptive error message to the Admin_Panel
8. THE Git_Connector SHALL execute git log retrieval using the git CLI for Local repositories, the GitHub REST API for GitHub repositories, the GitLab REST API for GitLab repositories, and the AWS SDK for CodeCommit repositories

### Requirement 6: Webhook-Triggered Sync

**User Story:** As an admin, I want to configure GitHub or GitLab webhooks to automatically ingest new commits in real time, so that the application stays up to date without manual sync operations.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a Webhook_Sync configuration section for each GitHub or GitLab Repository_Config, displaying a unique webhook URL and a webhook secret
2. WHEN the GInaTor_Server receives a valid webhook POST request with a matching webhook secret, THE Git_Connector SHALL fetch and ingest the new commits referenced in the webhook payload
3. THE GInaTor_Server SHALL validate the webhook signature using the configured webhook secret before processing the payload
4. IF the webhook signature validation fails, THEN THE GInaTor_Server SHALL return a 401 Unauthorized response and log the failed attempt
5. WHEN new commits are ingested via Webhook_Sync, THE Commit_Store SHALL persist them following the same deduplication rules as manual sync
6. THE Admin_Panel SHALL display the last successful webhook sync timestamp for each configured webhook
7. IF the webhook payload references a repository that is not configured in the Admin_Panel, THEN THE GInaTor_Server SHALL return a 404 Not Found response without revealing configured repository details

### Requirement 7: Commit Storage in DynamoDB

**User Story:** As a system operator, I want git commit history stored in DynamoDB, so that the application can serve visualization data without repeated git operations.

#### Acceptance Criteria

1. THE Commit_Store SHALL persist each commit record in DynamoDB with the following attributes: repository identifier, commit hash, author name, author email, commit date, commit message, and changed files list
2. THE Commit_Store SHALL use the repository identifier and commit hash as a composite key to prevent duplicate entries
3. WHEN a duplicate commit hash for the same repository is encountered during sync, THE Commit_Store SHALL skip the duplicate without error
4. THE Commit_Store SHALL support querying commits by repository identifier and date range
5. THE Commit_Store SHALL support querying commits by repository identifier ordered by commit date in descending order
6. THE Commit_Store SHALL support connecting to DynamoDB_Local when the DYNAMODB_ENDPOINT environment variable is set, and to AWS DynamoDB when the variable is not set

### Requirement 8: Frontend Template Integration

**User Story:** As a developer, I want the application to use the existing Tailwind template, so that the UI is consistent and visually polished without building styles from scratch.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL serve the frontend using the Tailwind CSS, DaisyUI, and Pug template structure from the web-template-tailadmin directory
2. THE GInaTor_Server SHALL use the existing layout templates (sidebar navigation, header, content area) from web-template-tailadmin as the base layout for all application pages
3. THE GInaTor_Server SHALL render all pages using Pug templates that extend the web-template-tailadmin layout
4. THE GInaTor_Server SHALL serve compiled Tailwind CSS and static assets (fonts, images, scripts) from the web-template-tailadmin dist directory

### Requirement 9: Dark/Light Theme Toggle

**User Story:** As a user, I want to toggle between dark and light themes, so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL provide a Theme_Toggle control in the application header that switches between dark and light themes
2. WHEN the user activates the Theme_Toggle, THE GInaTor_Server SHALL apply the corresponding dark or light Tailwind CSS and DaisyUI theme classes from the web-template-tailadmin template to all application pages
3. THE GInaTor_Server SHALL persist the user's theme preference in DynamoDB so that the selected theme is restored on subsequent logins
4. WHEN a user logs in without a previously saved theme preference, THE GInaTor_Server SHALL default to the light theme
5. THE Theme_Toggle SHALL update all visualization components to use color palettes appropriate for the active theme so that visualizations remain legible in both dark and light modes
6. THE Theme_Toggle control SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 10: Repository Selector

**User Story:** As a user, I want a dropdown in the top-left corner to switch between available repositories, so that I can visualize different projects without navigating to a separate page.

#### Acceptance Criteria

1. THE Repository_Selector SHALL display a dropdown component in the top-left corner of the application header listing all repositories configured by the Admin
2. WHEN the user selects a repository from the Repository_Selector dropdown, THE GInaTor_Server SHALL load the commit data for the selected repository from the Commit_Store
3. WHEN a new repository is selected, THE Timeline_Scrubber SHALL reset its date range sliders to span the full date range of commits for the newly selected repository
4. WHEN a new repository is selected, THE Visualization_Switcher SHALL refresh the active visualization with data from the newly selected repository
5. THE Repository_Selector SHALL display the currently selected repository name in the dropdown trigger
6. IF only one repository is configured, THEN THE Repository_Selector SHALL display that repository name without a dropdown indicator
7. THE Repository_Selector SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 11: Repository Stats Bar

**User Story:** As a user, I want to see a compact stats bar in the header area showing at-a-glance repository statistics, so that I can quickly understand the scope and activity of the current repository.

#### Acceptance Criteria

1. THE Repository_Stats_Bar SHALL display a compact horizontal bar in the application header area showing the following statistics: total contributor count, total file count, first commit date, last commit date, and total number of commits
2. THE Repository_Stats_Bar SHALL display each statistic with a descriptive label and its corresponding value
3. WHEN the user selects a different repository via the Repository_Selector, THE Repository_Stats_Bar SHALL update all displayed statistics to reflect the newly selected repository
4. WHEN the user changes the date range via the Timeline_Scrubber, THE Repository_Stats_Bar SHALL recalculate and update all displayed statistics to reflect only the commits within the selected date range
5. WHEN the Timeline_Scrubber date range is reset to the full range, THE Repository_Stats_Bar SHALL display the overall repository statistics
6. THE Repository_Stats_Bar SHALL format dates in a human-readable format and format counts with appropriate number formatting
7. THE Repository_Stats_Bar SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 12: Visualization Switcher Sidebar

**User Story:** As a user, I want a left sidebar dedicated to selecting between different visualization views, so that I can easily switch visualizations while the main content area is fully devoted to the active view.

#### Acceptance Criteria

1. THE Visualization_Switcher SHALL display a left sidebar listing all available visualization views: TimeBloom animation, Contributor Heatmap, File Hotspot Treemap, Code Ownership Sunburst, Branch and Merge Network Graph, Commit Pulse, Impact Visualization, Author Collaboration Network, File Type Distribution Chart, Day/Hour Activity Matrix, Bubble Map, Code Complexity Trend, PR/MR Review Flow, Bus Factor Calculator, Stale File Detector, City Block, and Genome Sequence
2. WHEN the user selects an item in the Visualization_Switcher sidebar, THE Visualization_Switcher SHALL display the corresponding visualization in the main content area while hiding the previously active visualization
3. THE Visualization_Switcher SHALL visually indicate which visualization is currently active in the sidebar
4. THE Visualization_Switcher SHALL preserve the current Timeline_Scrubber date range and selection state when switching between visualizations
5. THE Visualization_Switcher SHALL be collapsible so the user can maximize the visualization content area when desired
6. THE Visualization_Switcher SHALL be positioned as the left sidebar on all application pages where visualizations are displayed
7. THE Visualization_Switcher SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 13: Timeline Scrubber and Commit Selection

**User Story:** As a user, I want an interactive timeline above the visualization with range sliders, a stacked area chart of commit activity, and a scrub mode, so that I can select date ranges and scrub through individual commits from a single control.

#### Acceptance Criteria

1. THE Timeline_Scrubber SHALL display a horizontal bar above the Visualization_Engine showing a stacked area chart of commit activity over time, with distinct visual layers for additions, deletions, and modifications
2. THE Timeline_Scrubber SHALL render the horizontal axis as a time scale spanning the full date range of commits loaded from the Commit_Store for the active repository
3. THE Timeline_Scrubber SHALL use color-coded layers (green for additions, red for deletions, blue for modifications) to distinguish change types in the stacked area chart
4. THE Commit_Selector SHALL be integrated into the Timeline_Scrubber as left and right range slider handles that define the start and end of the selected date range
5. THE Commit_Selector SHALL display the currently selected start date and end date adjacent to the range sliders
6. WHEN the user drags the left or right range slider on the Timeline_Scrubber, THE Commit_Selector SHALL update the selected date range and notify all active visualizations to filter to commits within that range
7. THE Commit_Selector SHALL provide a "Select All" control that resets the range sliders to span the full date range of the loaded repository
8. WHEN the user clicks in the middle area between the two range sliders, THE Timeline_Scrubber SHALL enter scrub mode, displaying a position indicator that the user can drag to scrub through individual commits chronologically
9. WHILE the user drags the position indicator in scrub mode, THE Visualization_Engine SHALL update the visualization in real time to reflect the commit at the current scrub position
10. WHEN the user clicks outside the selected range on the Timeline_Scrubber, THE Timeline_Scrubber SHALL exit scrub mode and allow the user to adjust the range sliders
11. WHEN the user changes the selected date range, THE Commit_Selector SHALL notify the Visualization_Engine and all active visualization components to update their rendered data
12. THE Timeline_Scrubber SHALL synchronize with the Repository_Selector so that switching repositories reloads the timeline data for the newly selected repository
13. THE Timeline_Scrubber SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 14: Sprint/Release Boundary Markers

**User Story:** As an admin, I want to define release tags or sprint dates and see them as vertical markers on the Timeline_Scrubber, so that the team can correlate commit activity with project milestones.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a Sprint_Release_Marker configuration section where the Admin can define markers by specifying a label, a date, and an optional description
2. THE Admin_Panel SHALL allow the Admin to import Sprint_Release_Markers from git tags in the repository, using the tag name as the label and the tag date as the marker date
3. WHEN Sprint_Release_Markers are defined, THE Timeline_Scrubber SHALL display each marker as a vertical line at the corresponding date position on the timeline
4. WHEN the user hovers over a Sprint_Release_Marker on the Timeline_Scrubber, THE Timeline_Scrubber SHALL display a tooltip showing the marker label, date, and description
5. THE Admin_Panel SHALL allow the Admin to edit or delete existing Sprint_Release_Markers
6. THE Sprint_Release_Markers SHALL be visible across all visualization views when the Timeline_Scrubber is displayed
7. WHEN the user clicks on a Sprint_Release_Marker, THE Timeline_Scrubber SHALL adjust the left range slider to the marker date, allowing the user to quickly scope the view from that milestone forward
8. THE Sprint_Release_Marker display and configuration controls SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 15: Annotation System

**User Story:** As a user, I want to pin notes to specific commits or date ranges on the Timeline_Scrubber, so that I can mark significant events like releases or major refactors and share context with my team.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL allow users to create an Annotation by specifying a target commit or a date range, a label, and an optional description
2. WHEN an Annotation is created, THE Timeline_Scrubber SHALL display a visual marker (such as a flag or pin icon) at the corresponding commit position or date range on the timeline
3. WHEN the user hovers over an Annotation marker on the Timeline_Scrubber, THE Timeline_Scrubber SHALL display a tooltip showing the Annotation label, description, author, and creation date
4. THE GInaTor_Server SHALL store Annotations in DynamoDB associated with the repository identifier
5. THE GInaTor_Server SHALL allow the Annotation author or the Admin to edit or delete an existing Annotation
6. WHEN multiple Annotations overlap on the Timeline_Scrubber, THE Timeline_Scrubber SHALL stack or offset the markers to keep each one visible and accessible
7. THE GInaTor_Server SHALL display Annotations across all visualization views when the Timeline_Scrubber is visible
8. THE Annotation creation and display controls SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 16: TimeBloom Visualization

**User Story:** As a user, I want to see a Gource-style interactive, animated visualization of repository activity called TimeBloom rendered in the browser using WebGL, so that I can watch the codebase evolve over time as a living radial tree with contributors moving between files.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL render the TimeBloom visualization using WebGL via Three.js as a radial tree where the repository root directory is positioned at the center, directories extend outward as branches, and files appear as glowing leaf nodes at the branch tips
2. THE Visualization_Engine SHALL use a force-directed elastic layout for the radial tree so that branches spread organically and nodes have configurable elasticity controlling how rigidly branches hold their shape
3. WHEN a file is added in a commit during playback, THE Visualization_Engine SHALL animate the file blooming into existence with an expanding glow or particle effect at the corresponding branch tip
4. WHEN a file is modified in a commit during playback, THE Visualization_Engine SHALL animate the file node with a pulse or glow effect to indicate modification
5. WHEN a file is deleted in a commit during playback, THE Visualization_Engine SHALL animate the file node shrinking and fading out of the tree
6. THE Visualization_Engine SHALL render each active contributor as a labeled avatar that moves toward the file nodes the contributor is modifying during playback
7. WHEN a contributor has no commit activity for a configurable idle duration during playback, THE Visualization_Engine SHALL fade the contributor avatar out of the scene
8. WHEN a contributor reappears in a subsequent commit after fading out, THE Visualization_Engine SHALL fade the contributor avatar back into the scene near the file being modified
9. THE Visualization_Engine SHALL apply a file idle timeout so that files not modified within a configurable idle period fade out and disappear from the radial tree during playback
10. WHEN a faded-out file is modified again in a subsequent commit, THE Visualization_Engine SHALL re-bloom the file back into the tree at its branch position
11. WHEN the user selects a date range via the Timeline_Scrubber sliders and presses the Play button, THE Visualization_Engine SHALL begin animated playback of commits within the selected date range in chronological order
12. THE Visualization_Engine SHALL provide playback controls including Play, Pause, and speed selection at 0.5x, 1x, 2x, and 4x rates
13. THE Visualization_Engine SHALL display a progress indicator showing the current playback position within the selected date range
14. THE Visualization_Engine SHALL provide camera controls for zoom and pan, and an auto-follow mode that automatically tracks the most active area of the tree during playback
15. WHEN the user selects a date range via the Timeline_Scrubber, THE Visualization_Engine SHALL scope the TimeBloom visualization to commits within that date range
16. THE Visualization_Engine SHALL use Tailwind CSS classes from the web-template-tailadmin template for all surrounding UI chrome and layout

### Requirement 17: City Block Visualization

**User Story:** As a user, I want to see the repository rendered as a 3D city where files are buildings and directories are city blocks, so that I can intuitively grasp the structure, size, and activity of the codebase through a familiar urban metaphor.

#### Acceptance Criteria

1. THE City_Block SHALL render the repository as a 3D city using Three.js, viewable from an isometric or perspective camera angle, where each file is represented as a building and each directory is represented as a city block grouping its child buildings
2. THE City_Block SHALL set each building's height proportionally to the file's line count or cyclomatic complexity, and each building's footprint area proportionally to the file's change frequency
3. THE City_Block SHALL arrange buildings into city blocks grouped by directory structure, with streets or paths between blocks representing the directory hierarchy
4. WHEN a file is modified in the current commit during playback, THE City_Block SHALL cause the corresponding building to glow or light up to indicate the modification
5. THE City_Block SHALL provide a color-coding selector allowing the user to color buildings by primary contributor, file type, or file age
6. THE City_Block SHALL support camera controls for rotating, zooming, and panning the 3D city view
7. WHEN the user hovers over a building in the City_Block, THE City_Block SHALL display a tooltip showing the file path, line count, change frequency, primary contributor, and file type
8. WHEN the user clicks on a building in the City_Block, THE City_Block SHALL display a detail panel showing the commit history for that file
9. WHEN the user selects a date range via the Timeline_Scrubber, THE City_Block SHALL recalculate building heights, footprints, and color coding using only commits within that date range
10. THE City_Block SHALL be accessible from the Visualization_Switcher
11. THE City_Block SHALL display a legend mapping building colors to their corresponding values for the selected color-coding dimension
12. THE City_Block SHALL use Tailwind CSS classes from the web-template-tailadmin template for all surrounding UI chrome and layout

### Requirement 18: Genome Sequence Visualization

**User Story:** As a user, I want to see the commit history rendered as a linear genome sequence inspired by genome browsers, so that I can scan the full project timeline at a glance, spot dense regions of activity, and drill into individual commits.

#### Acceptance Criteria

1. THE Genome_Sequence SHALL render the commit history as a horizontal linear genome sequence where the horizontal axis represents time (commit sequence) and each position along the axis represents a single commit
2. THE Genome_Sequence SHALL render files changed in each commit as colored bands stacked vertically at each commit position, where each horizontal track represents a file or directory
3. THE Genome_Sequence SHALL encode change types by band color: green for additions, red for deletions, and blue for modifications
4. THE Genome_Sequence SHALL scale band height or thickness proportionally to the magnitude of change (lines added or removed) for each file in each commit
5. THE Genome_Sequence SHALL render author activity as distinct colored lanes running horizontally, showing when each author was active across the commit timeline
6. THE Genome_Sequence SHALL display regions of high commit activity as dense, colorful segments and regions of low activity as sparse segments
7. THE Genome_Sequence SHALL support zooming in to see individual commit details and zooming out to see the full project history at a glance
8. WHEN the user clicks on a commit position in the Genome_Sequence, THE Genome_Sequence SHALL display a detail panel showing the commit hash, author, date, message, and list of changed files
9. WHEN the user hovers over a commit position in the Genome_Sequence, THE Genome_Sequence SHALL display a tooltip showing the commit hash, author, date, and summary of changes
10. WHEN the user selects a date range via the Timeline_Scrubber, THE Genome_Sequence SHALL filter the displayed sequence to only commits within that date range
11. THE Genome_Sequence SHALL be accessible from the Visualization_Switcher
12. THE Genome_Sequence SHALL display a legend mapping track colors to authors and band colors to change types
13. THE Genome_Sequence SHALL use Tailwind CSS classes from the web-template-tailadmin template for all surrounding UI chrome and layout

### Requirement 19: Contributor Heatmap

**User Story:** As a user, I want to see a GitHub-style heatmap grid showing commit frequency per author over time, so that I can spot activity patterns and identify when each contributor is most active.

#### Acceptance Criteria

1. THE Contributor_Heatmap SHALL render a grid where rows represent authors and columns represent days or weeks, with each cell color intensity reflecting the commit count for that author in that time period
2. THE Contributor_Heatmap SHALL be accessible from the Visualization_Switcher
3. WHEN the user hovers over a cell in the Contributor_Heatmap, THE Contributor_Heatmap SHALL display a tooltip showing the author name, time period, and exact commit count
4. WHEN the user selects a date range via the Timeline_Scrubber, THE Contributor_Heatmap SHALL filter the displayed data to only commits within that date range
5. THE Contributor_Heatmap SHALL provide a toggle to switch the column granularity between daily and weekly views
6. THE Contributor_Heatmap SHALL use a sequential color scale from light (low activity) to dark (high activity) for cell coloring
7. THE Contributor_Heatmap SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 20: File Hotspot Treemap

**User Story:** As a user, I want to see a treemap showing which files and directories are changed most frequently, so that I can identify code hotspots and areas of high churn.

#### Acceptance Criteria

1. THE File_Hotspot_Treemap SHALL render a treemap where each rectangle represents a file or directory, sized proportionally to the number of times that file has been modified across commits
2. THE File_Hotspot_Treemap SHALL color each rectangle on a cool-to-hot gradient where cool colors indicate low churn and hot colors indicate high churn
3. THE File_Hotspot_Treemap SHALL be accessible from the Visualization_Switcher
4. WHEN the user clicks a file rectangle in the File_Hotspot_Treemap, THE File_Hotspot_Treemap SHALL display a detail panel showing the commit history for that file including commit hash, author, date, and message
5. WHEN the user selects a date range via the Timeline_Scrubber, THE File_Hotspot_Treemap SHALL recalculate change frequencies using only commits within that date range
6. THE File_Hotspot_Treemap SHALL support drill-down navigation so that clicking a directory rectangle expands it to show its child files and subdirectories
7. THE File_Hotspot_Treemap SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 21: Code Ownership Sunburst

**User Story:** As a user, I want to see a sunburst chart showing which contributors own which parts of the codebase, so that I can understand code ownership distribution across the directory tree.

#### Acceptance Criteria

1. THE Code_Ownership_Sunburst SHALL render a radial sunburst chart where concentric rings represent directory depth levels and each segment represents a file or folder
2. THE Code_Ownership_Sunburst SHALL color each segment by the primary contributor (the author with the most commits) to that file or folder
3. THE Code_Ownership_Sunburst SHALL be accessible from the Visualization_Switcher
4. WHEN the user hovers over a segment in the Code_Ownership_Sunburst, THE Code_Ownership_Sunburst SHALL display a tooltip showing the file or folder path, the primary contributor, and ownership percentages for all contributors
5. WHEN the user selects a date range via the Timeline_Scrubber, THE Code_Ownership_Sunburst SHALL recalculate ownership using only commits within that date range
6. THE Code_Ownership_Sunburst SHALL assign a distinct color to each unique contributor and display a legend mapping colors to contributor names
7. WHEN the user clicks a segment in the Code_Ownership_Sunburst, THE Code_Ownership_Sunburst SHALL zoom into that segment, making it the new root of the sunburst
8. THE Code_Ownership_Sunburst SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 22: Branch and Merge Network Graph

**User Story:** As a user, I want to see an interactive network graph of branches and merges, so that I can understand the branching strategy and how code flows between branches.

#### Acceptance Criteria

1. THE Branch_Merge_Graph SHALL render an interactive network graph showing branches as parallel horizontal lanes with commits as nodes along each lane
2. THE Branch_Merge_Graph SHALL display merge points as edges connecting nodes across branch lanes and divergence points where branches fork from a parent branch
3. THE Branch_Merge_Graph SHALL be accessible from the Visualization_Switcher
4. THE Branch_Merge_Graph SHALL support zoom and pan interactions so the user can navigate large branch histories
5. WHEN the user clicks on a branch lane in the Branch_Merge_Graph, THE Branch_Merge_Graph SHALL highlight that branch and display a list of its commits in a detail panel
6. WHEN the user clicks on a commit node in the Branch_Merge_Graph, THE Branch_Merge_Graph SHALL display the commit details including hash, author, date, message, and changed files
7. WHEN the user selects a date range via the Timeline_Scrubber, THE Branch_Merge_Graph SHALL filter the displayed graph to only commits and branches active within that date range
8. THE Branch_Merge_Graph SHALL assign a distinct color to each branch for visual differentiation
9. THE Branch_Merge_Graph SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 23: Commit Pulse Activity Stream

**User Story:** As a user, I want to see a line chart of commit velocity over time, so that I can identify periods of high and low development activity.

#### Acceptance Criteria

1. THE Commit_Pulse SHALL render a line chart showing the number of commits over time on the vertical axis and time on the horizontal axis
2. THE Commit_Pulse SHALL provide a granularity toggle allowing the user to switch between daily, weekly, and monthly aggregation
3. THE Commit_Pulse SHALL be accessible from the Visualization_Switcher
4. WHEN the user hovers over a data point on the Commit_Pulse chart, THE Commit_Pulse SHALL display a tooltip showing the time period and exact commit count
5. WHEN the user selects a date range via the Timeline_Scrubber, THE Commit_Pulse SHALL filter the displayed chart to only the selected date range
6. WHEN the user clicks on a data point or time period in the Commit_Pulse chart, THE Timeline_Scrubber SHALL adjust its range sliders to the corresponding time period
7. THE Commit_Pulse SHALL visually highlight spikes in activity that exceed two standard deviations above the mean commit rate for the displayed range
8. THE Commit_Pulse SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 24: Impact Visualization

**User Story:** As a user, I want to see a radial burst visualization for each commit showing its size and the files it affected, so that I can quickly gauge the impact of individual commits.

#### Acceptance Criteria

1. THE Impact_Visualization SHALL render each commit as a radial burst where the central circle size represents the total number of lines changed in that commit
2. THE Impact_Visualization SHALL extend tendrils or rays from the central circle to each affected file, with tendril length proportional to the number of lines changed in that file
3. THE Impact_Visualization SHALL be accessible from the Visualization_Switcher
4. THE Impact_Visualization SHALL color-code tendrils by change type: green for additions, red for deletions, and blue for modifications
5. WHEN the user selects a date range via the Timeline_Scrubber, THE Impact_Visualization SHALL render the radial bursts for only the commits within that date range
6. WHEN the user enables sequential animation mode, THE Impact_Visualization SHALL animate commits one after another in chronological order
7. WHEN the user hovers over a tendril in the Impact_Visualization, THE Impact_Visualization SHALL display a tooltip showing the file path, change type, and lines changed
8. THE Impact_Visualization SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 25: Author Collaboration Network

**User Story:** As a user, I want to see a force-directed graph showing how authors collaborate through shared file edits, so that I can understand team collaboration patterns.

#### Acceptance Criteria

1. THE Author_Collaboration_Network SHALL render a force-directed graph where each node represents an author and each edge connects two authors who have edited at least one common file
2. THE Author_Collaboration_Network SHALL scale node size proportionally to the total number of commits by that author
3. THE Author_Collaboration_Network SHALL scale edge thickness proportionally to the number of files shared between the two connected authors
4. THE Author_Collaboration_Network SHALL be accessible from the Visualization_Switcher
5. WHEN the user hovers over a node in the Author_Collaboration_Network, THE Author_Collaboration_Network SHALL display a tooltip showing the author name, total commits, and list of top collaborators
6. WHEN the user hovers over an edge in the Author_Collaboration_Network, THE Author_Collaboration_Network SHALL display a tooltip showing the two connected authors and the count of shared files
7. WHEN the user selects a date range via the Timeline_Scrubber, THE Author_Collaboration_Network SHALL recalculate collaboration data using only commits within that date range
8. WHEN the user clicks on a node in the Author_Collaboration_Network, THE Timeline_Scrubber SHALL highlight commits by that author within the current date range
9. THE Author_Collaboration_Network SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 26: File Type Distribution Chart

**User Story:** As a user, I want to see a donut chart showing the breakdown of file types changed across commits, so that I can understand the technology mix and focus areas of the project.

#### Acceptance Criteria

1. THE File_Type_Distribution_Chart SHALL render a donut or pie chart where each segment represents a file extension and the segment size is proportional to the number of file changes with that extension
2. THE File_Type_Distribution_Chart SHALL be accessible from the Visualization_Switcher
3. WHEN the user selects a date range via the Timeline_Scrubber, THE File_Type_Distribution_Chart SHALL recalculate the distribution using only commits within that date range
4. WHEN the user scrubs to a specific commit via the Timeline_Scrubber, THE File_Type_Distribution_Chart SHALL recalculate the distribution using only the scrubbed-to commit
5. WHEN the user hovers over a segment in the File_Type_Distribution_Chart, THE File_Type_Distribution_Chart SHALL display a tooltip showing the file extension, change count, and percentage of total changes
6. WHEN the user clicks a segment in the File_Type_Distribution_Chart, THE File_Type_Distribution_Chart SHALL display a filtered list of commits that include changes to files with that extension
7. THE File_Type_Distribution_Chart SHALL assign a distinct color to each file extension and display a legend mapping colors to extensions
8. THE File_Type_Distribution_Chart SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 27: Day and Hour Activity Matrix

**User Story:** As a user, I want to see a heatmap matrix showing commit activity by day of week and hour of day, so that I can understand when the team is most productive.

#### Acceptance Criteria

1. THE Activity_Matrix SHALL render a matrix where rows represent days of the week (Monday through Sunday) and columns represent hours of the day (0 through 23), with each cell color intensity reflecting the commit count for that day-hour combination
2. THE Activity_Matrix SHALL be accessible from the Visualization_Switcher
3. WHEN the user hovers over a cell in the Activity_Matrix, THE Activity_Matrix SHALL display a tooltip showing the day of week, hour of day, and exact commit count
4. WHEN the user selects a date range via the Timeline_Scrubber, THE Activity_Matrix SHALL recalculate the matrix using only commits within that date range
5. THE Activity_Matrix SHALL use a sequential color scale from light (low activity) to dark (high activity) for cell coloring
6. WHEN the user clicks a cell in the Activity_Matrix, THE Activity_Matrix SHALL display a filtered list of commits made on that day of week during that hour
7. THE Activity_Matrix SHALL display row labels for days of the week and column labels for hours of the day
8. THE Activity_Matrix SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 28: Bubble Map Visualization

**User Story:** As a user, I want to see a bubble map of the repository where each bubble represents a file or directory, so that I can visually explore the structure and characteristics of the codebase at a glance.

#### Acceptance Criteria

1. THE Bubble_Map SHALL render a bubble layout where each bubble represents a file or directory from the repository
2. THE Bubble_Map SHALL size each bubble proportionally to a selectable metric, with available metrics being change frequency, number of lines, and number of contributors
3. THE Bubble_Map SHALL group and cluster bubbles by directory structure so that files within the same directory appear visually adjacent
4. THE Bubble_Map SHALL color each bubble based on a selectable dimension, with available dimensions being primary contributor, file type, and churn level
5. THE Bubble_Map SHALL provide a metric selector control allowing the user to switch the bubble sizing metric between change frequency, number of lines, and number of contributors
6. THE Bubble_Map SHALL provide a color dimension selector control allowing the user to switch the bubble coloring between primary contributor, file type, and churn level
7. WHEN the user hovers over a bubble in the Bubble_Map, THE Bubble_Map SHALL display a tooltip showing the file or directory path, the current sizing metric value, the current color dimension value, and the list of contributors
8. WHEN the user clicks on a directory bubble in the Bubble_Map, THE Bubble_Map SHALL drill down into that directory, rendering its child files and subdirectories as the new bubble layout
9. WHEN the user has drilled down into a directory, THE Bubble_Map SHALL provide a breadcrumb navigation allowing the user to navigate back to any parent directory level
10. WHEN the user selects a date range via the Timeline_Scrubber, THE Bubble_Map SHALL recalculate all metrics and colors using only commits within that date range
11. THE Bubble_Map SHALL be accessible from the Visualization_Switcher
12. THE Bubble_Map SHALL display a legend mapping bubble colors to their corresponding values for the selected color dimension
13. THE Bubble_Map SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 29: Code Complexity Trend

**User Story:** As a user, I want to see a line chart tracking cyclomatic complexity or file size over time for a selected file or directory, so that I can spot when code is getting unwieldy and take action before it becomes unmanageable.

#### Acceptance Criteria

1. THE Code_Complexity_Trend SHALL render a line chart with time on the horizontal axis and the selected complexity metric on the vertical axis
2. THE Code_Complexity_Trend SHALL support two metric modes: file size (in lines of code) and cyclomatic complexity, selectable via a toggle control
3. THE Code_Complexity_Trend SHALL allow the user to select a specific file or directory to chart, displaying one trend line per file when a directory is selected
4. THE Code_Complexity_Trend SHALL be accessible from the Visualization_Switcher
5. WHEN the user hovers over a data point on the Code_Complexity_Trend chart, THE Code_Complexity_Trend SHALL display a tooltip showing the commit hash, date, author, and metric value at that point
6. WHEN the user selects a date range via the Timeline_Scrubber, THE Code_Complexity_Trend SHALL filter the displayed chart to only data points within that date range
7. THE Code_Complexity_Trend SHALL visually highlight data points where the metric value exceeds a configurable threshold, indicating the file may need refactoring
8. WHEN the user clicks on a data point in the Code_Complexity_Trend chart, THE File_Diff_Viewer SHALL open showing the diff for that file at the corresponding commit
9. THE Code_Complexity_Trend SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 30: PR/MR Review Flow

**User Story:** As a user, I want to see a Sankey diagram showing how code flows from author to reviewer to merge for GitHub and GitLab repositories, so that I can visualize review bottlenecks and understand the review process.

#### Acceptance Criteria

1. THE PR_Review_Flow SHALL render a Sankey diagram with three vertical stages: authors on the left, reviewers in the middle, and merge targets (branches) on the right
2. THE PR_Review_Flow SHALL size each flow band proportionally to the number of pull requests or merge requests flowing through that path
3. THE PR_Review_Flow SHALL be accessible from the Visualization_Switcher
4. WHEN the user hovers over a flow band in the PR_Review_Flow, THE PR_Review_Flow SHALL display a tooltip showing the author name, reviewer name, target branch, and count of pull requests or merge requests for that path
5. WHEN the user selects a date range via the Timeline_Scrubber, THE PR_Review_Flow SHALL filter the displayed diagram to only pull requests or merge requests within that date range
6. THE PR_Review_Flow SHALL assign a distinct color to each author for visual differentiation of flow bands
7. IF the active repository is not a GitHub or GitLab repository, THEN THE PR_Review_Flow SHALL display a message indicating that PR/MR review flow data is only available for GitHub and GitLab repositories
8. WHEN the user clicks on a reviewer node in the PR_Review_Flow, THE PR_Review_Flow SHALL display a detail panel listing all pull requests or merge requests reviewed by that reviewer within the selected date range
9. THE PR_Review_Flow SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 31: Bus Factor Calculator

**User Story:** As a user, I want to see the bus factor for each file and directory, so that I can identify risky areas of the codebase where only one contributor has knowledge.

#### Acceptance Criteria

1. THE Bus_Factor_Calculator SHALL compute the number of distinct contributors who have modified each file and each directory in the repository
2. THE Bus_Factor_Calculator SHALL display the bus factor metric alongside file entries in the File_Hotspot_Treemap and the Bubble_Map as an optional overlay
3. THE Bus_Factor_Calculator SHALL highlight files with a bus factor of one using a distinct warning color or icon to indicate high risk
4. THE Bus_Factor_Calculator SHALL be accessible from the Visualization_Switcher as a standalone tabular view listing all files sorted by bus factor in ascending order
5. WHEN the user hovers over a bus factor indicator, THE Bus_Factor_Calculator SHALL display a tooltip listing the distinct contributors for that file or directory
6. WHEN the user selects a date range via the Timeline_Scrubber, THE Bus_Factor_Calculator SHALL recalculate bus factors using only commits within that date range
7. THE Bus_Factor_Calculator SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 32: Stale File Detector

**User Story:** As a user, I want to see which files have not been modified in a long time, so that I can identify potential dead code or neglected areas of the codebase.

#### Acceptance Criteria

1. THE Stale_File_Detector SHALL identify files in the repository that have not been modified within a configurable staleness threshold specified in months
2. THE Stale_File_Detector SHALL provide a threshold selector control allowing the user to set the staleness threshold (default of 6 months)
3. THE Stale_File_Detector SHALL be accessible from the Visualization_Switcher as a standalone tabular view listing all stale files sorted by last modification date in ascending order
4. THE Stale_File_Detector SHALL display for each stale file: the file path, last modification date, last modifying author, and the number of months since last modification
5. WHEN the user clicks on a stale file in the Stale_File_Detector list, THE File_Diff_Viewer SHALL open showing the last modification diff for that file
6. THE Stale_File_Detector SHALL provide a visual overlay mode that highlights stale files in the File_Hotspot_Treemap and Bubble_Map with a distinct stale indicator
7. WHEN the user selects a date range via the Timeline_Scrubber, THE Stale_File_Detector SHALL evaluate staleness relative to the end date of the selected range rather than the current date
8. THE Stale_File_Detector SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 33: File Diff Viewer

**User Story:** As a user, I want to click on a file from any visualization and see a diff view of its changes over time, so that I can understand exactly what changed in each version of a file.

#### Acceptance Criteria

1. WHEN the user clicks on a file from any visualization that displays files, THE File_Diff_Viewer SHALL open a diff view for that file
2. THE File_Diff_Viewer SHALL allow the user to select a specific version or commit to view the diff for
3. WHEN a file is opened in the File_Diff_Viewer, THE Timeline_Scrubber SHALL constrain its range to span from the first commit where the file appeared to the last commit where the file was modified
4. WHILE the File_Diff_Viewer is open, THE Timeline_Scrubber SHALL allow the user to scrub through the file's commit history, updating the displayed diff at each position
5. THE File_Diff_Viewer SHALL support both side-by-side and unified diff display modes
6. THE File_Diff_Viewer SHALL display additions in green, deletions in red, and unchanged lines in the default text color
7. WHEN the user closes the File_Diff_Viewer, THE Timeline_Scrubber SHALL restore its range to the previously selected repository-wide date range
8. THE File_Diff_Viewer SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 34: Cross-Visualization Linking

**User Story:** As a user, I want clicking an author in the Contributor Heatmap to highlight them in the Author Collaboration Network and filter the Commit Pulse, so that I can explore related data across multiple views without manually re-filtering.

#### Acceptance Criteria

1. THE Cross_Visualization_Linking SHALL synchronize selection state across all active visualization components so that selecting an element in one view highlights or filters corresponding elements in other views
2. WHEN the user clicks an author row in the Contributor_Heatmap, THE Cross_Visualization_Linking SHALL highlight that author's node in the Author_Collaboration_Network and filter the Commit_Pulse to show only that author's commits
3. WHEN the user clicks an author node in the Author_Collaboration_Network, THE Cross_Visualization_Linking SHALL highlight that author's row in the Contributor_Heatmap and filter the Commit_Pulse to show only that author's commits
4. WHEN the user clicks a file in the File_Hotspot_Treemap, THE Cross_Visualization_Linking SHALL highlight the corresponding segment in the Code_Ownership_Sunburst and the corresponding bubble in the Bubble_Map
5. THE Cross_Visualization_Linking SHALL provide a visible indicator on each visualization showing when a cross-visualization filter is active
6. THE Cross_Visualization_Linking SHALL provide a "Clear All Filters" control that removes all cross-visualization selections and restores all views to their unfiltered state
7. WHEN the user clears a selection in the originating visualization, THE Cross_Visualization_Linking SHALL remove the corresponding highlights and filters from all other visualizations

### Requirement 35: Comparison Mode

**User Story:** As a user, I want a side-by-side view comparing two date ranges or two repositories for the same visualization, so that I can compare activity before and after a release or across projects.

#### Acceptance Criteria

1. THE Comparison_Mode SHALL render two instances of the same visualization side by side in the main content area
2. THE Comparison_Mode SHALL allow the user to select two different date ranges for the same repository, one for each side
3. THE Comparison_Mode SHALL allow the user to select two different repositories with the same date range, one for each side
4. THE Comparison_Mode SHALL be activatable via a "Compare" toggle control accessible from the application header
5. WHEN the user activates Comparison_Mode, THE GInaTor_Server SHALL display configuration controls for selecting the left-side and right-side date ranges or repositories
6. THE Comparison_Mode SHALL synchronize zoom and pan interactions between the two side-by-side views so that navigating one view mirrors the navigation in the other
7. THE Comparison_Mode SHALL display labels above each side indicating the selected date range or repository name for that side
8. WHEN the user deactivates Comparison_Mode, THE GInaTor_Server SHALL return to the standard single-visualization layout preserving the left-side configuration as the active view
9. THE Comparison_Mode SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 36: Bookmarkable Views

**User Story:** As a user, I want to save a specific visualization, date range, and repository combination as a shareable URL or named bookmark, so that I can quickly return to a specific view or share it with teammates.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL encode the current visualization type, selected date range, and active repository into the browser URL as query parameters so that the URL is shareable and reproducible
2. WHEN a user navigates to a URL containing visualization state query parameters, THE GInaTor_Server SHALL restore the visualization type, date range, and repository selection to match the encoded state
3. THE GInaTor_Server SHALL provide a "Save Bookmark" control that allows the user to save the current view state as a named Bookmarkable_View stored in DynamoDB associated with the user's account
4. THE GInaTor_Server SHALL provide a "My Bookmarks" panel listing all saved Bookmarkable_Views for the current user, with options to load or delete each bookmark
5. WHEN the user loads a saved Bookmarkable_View, THE GInaTor_Server SHALL restore the visualization type, date range, and repository selection to match the saved state
6. THE GInaTor_Server SHALL provide a "Copy Link" control that copies the current shareable URL to the clipboard
7. IF a shared URL references a repository the user does not have access to, THEN THE GInaTor_Server SHALL display an access denied message without revealing repository details
8. THE Bookmarkable_View controls SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 37: Export to PNG/SVG/PDF

**User Story:** As a user, I want to export any visualization as a PNG, SVG, or PDF file, so that I can include visualizations in reports and presentations.

#### Acceptance Criteria

1. THE Export_Service SHALL provide an export control on each visualization that offers PNG, SVG, and PDF as format options
2. WHEN the user selects PNG export, THE Export_Service SHALL render the current visualization to a PNG image file and trigger a browser download
3. WHEN the user selects SVG export, THE Export_Service SHALL render the current visualization to an SVG file and trigger a browser download
4. WHEN the user selects PDF export, THE Export_Service SHALL render the current visualization to a PDF document and trigger a browser download
5. THE Export_Service SHALL include the visualization title, selected date range, and repository name as a header in the exported file
6. THE Export_Service SHALL export the visualization at the current viewport dimensions for PNG and SVG, and at a standard A4 or Letter page size for PDF
7. IF the visualization contains interactive or animated elements, THEN THE Export_Service SHALL export a static snapshot of the current state
8. THE Export_Service export control SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout

### Requirement 38: AI-Powered Release Notes Generation

**User Story:** As a user, I want to select commits and generate polished release notes using AI, so that I can quickly produce professional documentation of changes.

#### Acceptance Criteria

1. WHEN the user requests release notes generation, THE Release_Notes_Generator SHALL send the commit messages and changed file lists for all commits within the currently selected Timeline_Scrubber date range to the Admin-configured AI_Provider
2. WHEN OpenAI is selected as the AI_Provider, THE Release_Notes_Generator SHALL use the OpenAI Chat Completions API to generate release notes
3. WHEN Anthropic is selected as the AI_Provider, THE Release_Notes_Generator SHALL use the Anthropic Messages API to generate release notes
4. THE Release_Notes_Generator SHALL include the Admin-configured custom prompt template in the AI_Provider API request to guide the tone and format of the generated notes
5. WHEN the AI_Provider API returns a response, THE Release_Notes_Generator SHALL display the formatted release notes to the user in a dedicated panel
6. IF no AI_Provider is selected by the Admin, THEN THE Release_Notes_Generator SHALL display a message indicating that the Admin must select an AI provider before release notes can be generated
7. IF the API key for the selected AI_Provider is not configured, THEN THE Release_Notes_Generator SHALL display a message indicating which provider (OpenAI or Anthropic) API key the Admin must configure
8. IF the selected AI_Provider API returns an error, THEN THE Release_Notes_Generator SHALL display a descriptive error message to the user that identifies which provider returned the error
9. THE Release_Notes_Generator SHALL allow the user to copy the generated release notes to the clipboard
10. THE Release_Notes_Generator SHALL allow the user to regenerate release notes for the same selection of commits

### Requirement 39: Scheduled Digest Emails

**User Story:** As an admin, I want to configure weekly or monthly email digests with key repository statistics sent to approved users, so that the team stays informed about project activity without needing to log in.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a Digest_Email configuration section where the Admin can enable or disable scheduled digests
2. THE Admin_Panel SHALL allow the Admin to select a digest frequency of weekly or monthly
3. THE Admin_Panel SHALL allow the Admin to select which repositories to include in the Digest_Email
4. WHEN the scheduled digest time arrives, THE GInaTor_Server SHALL generate a Digest_Email containing the top contributors by commit count, the hottest files by change frequency, and the commit velocity trend for the configured period
5. THE GInaTor_Server SHALL send the Digest_Email to all approved users who have not opted out of digest emails
6. THE GInaTor_Server SHALL provide each user with an opt-out control in their profile settings to stop receiving Digest_Emails
7. IF the email delivery fails for a specific user, THEN THE GInaTor_Server SHALL log the failure and continue sending to remaining users without interruption
8. THE Digest_Email SHALL include a link to the GInaTor application for each included repository

### Requirement 40: API Endpoints for Visualization Data

**User Story:** As a user, I want REST API endpoints that return visualization data in JSON format, so that I can pull data programmatically for custom dashboards or CI/CD integrations.

#### Acceptance Criteria

1. THE Visualization_API SHALL expose REST endpoints under the /api/v1/ path prefix that return visualization data in JSON format
2. THE Visualization_API SHALL require authentication via session cookie or API token for all endpoints
3. THE Visualization_API SHALL provide endpoints for each visualization type, accepting repository identifier and date range as query parameters
4. WHEN a valid request is made to a Visualization_API endpoint, THE GInaTor_Server SHALL return the corresponding visualization data as a JSON response with appropriate Content-Type headers
5. THE Visualization_API SHALL support pagination for endpoints that return large datasets, using limit and offset query parameters
6. IF the requested repository identifier does not exist or the user does not have access, THEN THE Visualization_API SHALL return a 404 Not Found response without revealing repository details
7. THE Visualization_API SHALL return appropriate HTTP error codes (400 for invalid parameters, 401 for unauthenticated requests, 404 for not found, 500 for server errors) with descriptive error messages
8. THE Visualization_API SHALL include API documentation accessible at /api/v1/docs describing all available endpoints, parameters, and response schemas

### Requirement 41: Infrastructure as Code (Terraform)

**User Story:** As a DevOps engineer, I want Terraform configurations that provision all AWS infrastructure for GInaTor, so that the application can be deployed repeatably and reliably to ECS Fargate.

#### Acceptance Criteria

1. THE Infrastructure_Config SHALL define all Terraform files within the `./terraform/` directory
2. THE Infrastructure_Config SHALL define a Terraform module that provisions an ECS Fargate cluster, service, and task definition for running the GInaTor_Server container
3. THE Infrastructure_Config SHALL define an ECR repository for storing the GInaTor Docker container image
4. THE Infrastructure_Config SHALL define all DynamoDB tables required by the application (users, sessions, commits, repository configs, and admin settings) with appropriate key schemas and capacity settings
5. THE Infrastructure_Config SHALL define an Application Load Balancer (ALB) with HTTPS listener and target group routing traffic to the ECS Fargate service
6. THE Infrastructure_Config SHALL define a VPC with public and private subnets, NAT gateway, and security groups that restrict inbound traffic to the ALB on ports 80 and 443 only
7. THE Infrastructure_Config SHALL define IAM roles and policies granting the ECS task execution role access to ECR, CloudWatch Logs, and DynamoDB, and granting the application task role access to DynamoDB and CodeCommit
8. THE Infrastructure_Config SHALL define a CloudWatch Log Group for capturing application logs from the ECS Fargate tasks
9. THE Infrastructure_Config SHALL use Terraform variables for all environment-specific values including AWS region, VPC CIDR, container image tag, desired task count, and DynamoDB table names
10. THE Infrastructure_Config SHALL include a Dockerfile in the project root that builds the GInaTor_Server application into a production-ready container image
11. THE Infrastructure_Config SHALL define Terraform outputs for the ALB DNS name, ECR repository URL, and DynamoDB table ARNs

### Requirement 42: Local Development Support

**User Story:** As a developer, I want to run the full application locally using DynamoDB Local, so that I can develop and test without requiring an AWS account or internet connectivity.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL support running against DynamoDB_Local when the DYNAMODB_ENDPOINT environment variable is set to the DynamoDB_Local URL
2. WHEN the DYNAMODB_ENDPOINT environment variable is not set, THE GInaTor_Server SHALL connect to AWS DynamoDB using standard AWS credential resolution
3. THE GInaTor_Server SHALL include a docker-compose.yml file that starts DynamoDB_Local alongside the application for local development
4. THE GInaTor_Server SHALL include an initialization script that creates all required DynamoDB tables in DynamoDB_Local on first startup
5. THE GInaTor_Server SHALL provide npm scripts for starting the application in local development mode with DynamoDB_Local

### Requirement 43: Project Structure

**User Story:** As a developer, I want a well-organized project structure, so that the codebase is easy to navigate and maintain.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL place all application source code within the `./source/` directory
2. THE Infrastructure_Config SHALL place all Terraform configuration files within the `./terraform/` directory
3. THE GInaTor_Server SHALL place the Dockerfile, docker-compose.yml, package.json, and README.md in the project root directory

### Requirement 44: Latest Stable Dependencies

**User Story:** As a developer, I want the application to use the latest stable versions of all libraries, so that the codebase benefits from the most recent features, performance improvements, and security patches.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL use the latest stable versions of all core dependencies at the time of initial development, including Express, Passport.js, bcrypt, express-session, and the AWS SDK v3
2. THE GInaTor_Server SHALL use the latest stable versions of all frontend visualization libraries at the time of initial development, including D3.js and Three.js
3. THE GInaTor_Server SHALL use the latest stable versions of all testing libraries at the time of initial development, including Jest, Supertest, and fast-check
4. THE GInaTor_Server SHALL specify exact dependency versions in package.json to ensure reproducible builds

### Requirement 45: Testing and Code Quality

**User Story:** As a developer, I want comprehensive test coverage and clear code documentation, so that the codebase is maintainable, reliable, and easy to contribute to.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL include unit tests for all backend modules (authentication, admin, git connector, release notes, API routes) using Jest and Supertest
2. THE GInaTor_Server SHALL include property-based tests using fast-check for all data transformation functions (commit parsing, visualization data transformations, date range filtering, aggregation functions)
3. THE GInaTor_Server SHALL include integration tests that verify end-to-end flows (registration through login, git sync through visualization data retrieval, release notes generation)
4. THE GInaTor_Server SHALL include JSDoc comments on all exported functions, classes, and modules describing purpose, parameters, and return values
5. THE GInaTor_Server SHALL achieve a minimum of 80 percent statement coverage across all backend modules as measured by Jest coverage reporting

### Requirement 46: Project README

**User Story:** As a developer or contributor, I want a comprehensive README.md, so that I can understand what GInaTor is, how to set it up locally, and how to deploy it to AWS.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL include a README.md file in the project root
2. THE README.md SHALL include an introduction explaining that GInaTor is a Git visualization tool and the Phineas and Ferb "-inator" naming reference
3. THE README.md SHALL include instructions for local development setup including DynamoDB_Local, docker-compose, and npm scripts
4. THE README.md SHALL include instructions for deploying to AWS using Terraform, including ECR image push and ECS deployment steps
5. THE README.md SHALL include a reference table of all environment variables used by the application
6. THE README.md SHALL include an architecture overview describing the major components (Express backend, Pug frontend, DynamoDB, Git_Connector providers, visualization engine)

### Requirement 47: Attribution and Credits

**User Story:** As a user or contributor, I want to see proper attribution for the tools and libraries that GInaTor builds upon, so that the project is a good open-source citizen and gives credit where it is due.

#### Acceptance Criteria

1. THE GInaTor_Server SHALL include a credits and attribution page accessible from the application footer or an about page link
2. THE credits page SHALL credit Gource (https://gource.io) as the inspiration for the TimeBloom visualization, with a clickable link to the Gource website
3. THE credits page SHALL list and link to all visualization libraries used by the application, including D3.js and Three.js
4. THE credits page SHALL list and link to all other significant open-source libraries used by the application (including Express, Passport.js, Tailwind CSS, DaisyUI, and fast-check)
5. THE README.md SHALL include an attribution and credits section that credits Gource as the inspiration for the TimeBloom visualization with a link to https://gource.io
6. THE README.md attribution section SHALL list and link to all significant open-source libraries used by the application
7. THE credits page SHALL use Tailwind CSS classes from the web-template-tailadmin template for all styling and layout
