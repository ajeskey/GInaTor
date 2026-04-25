# GInaTor — The Git Inator

Just as Dr. Doofenshmirtz builds elaborate "-inator" machines in *Phineas and Ferb*, **GInaTor** is the **G**it **Ina**tor: a web-based tool that transforms raw git history into rich, interactive browser-based visualizations.

GInaTor ingests commit data from local git repos, GitHub, GitLab, and AWS CodeCommit, stores normalized records in DynamoDB, and renders **18 distinct visualization types** in the browser — from animated radial trees and 3D city metaphors to heatmaps, Sankey diagrams, and genome-sequence timelines.

## Architecture

```
Browser (Next.js + TailAdmin template)
  ├── D3.js visualizations (2D)
  ├── Three.js visualizations (3D — TimeBloom, CityBlock)
  ├── Timeline Scrubber
  └── Calls Express API via proxy
          │
Express.js API (port 3000)
  ├── Auth (Passport.js + bcrypt)
  ├── Admin panel API
  ├── Visualization API (/api/v1/*)
  ├── Git Connector (Local, GitHub, GitLab, CodeCommit)
  ├── Webhook Handler
  ├── Release Notes Generator (OpenAI / Anthropic)
  ├── Digest Email (SES + cron)
  └── Crypto (AES-256-GCM)
          │
DynamoDB (8 tables)
  ├── Users, Sessions, Commits
  ├── RepositoryConfigs, AdminSettings
  └── SprintMarkers, Annotations, Bookmarks
```

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for DynamoDB Local)

### Quick Start

```bash
# 1. Install dependencies (both backend and frontend)
npm install
cd web-template-tailadmin && npm install && cd ..

# 2. Copy environment config
cp .env.example .env

# 3. Start DynamoDB Local (requires Docker)
docker compose up -d

# 4. Create the database tables
npm run db:init

# 5. Start the API server (Terminal 1)
npm run dev

# 6. Start the frontend (Terminal 2)
cd web-template-tailadmin && npm run dev
```

Open **http://localhost:3001** in your browser. The first user to register becomes the admin.

> **Note:** Two servers run simultaneously — the Express API on port 3000 and the Next.js frontend on port 3001. The frontend proxies all API calls to the backend automatically. You only need to open port 3001 in your browser.

### GitHub OAuth (optional)

To enable "Connect GitHub" in the admin panel:

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL to `http://localhost:3000/auth/github/callback`
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to your `.env`

The Express API runs on **http://localhost:3000** and the Next.js frontend on **http://localhost:3001**.

### NPM Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm start`          | Start the production Express server              |
| `npm run dev`        | Start Express in development mode                |
| `npm run dev:local`  | Docker + table init + dev server (all-in-one)    |
| `npm run db:init`    | Initialize DynamoDB tables against local endpoint|
| `npm test`           | Run all tests (unit + property)                  |
| `npm run test:unit`  | Run unit tests only                              |
| `npm run test:property` | Run property-based tests only                 |
| `npm run test:coverage` | Run tests with coverage report                |

## AWS Deployment

Infrastructure is managed with Terraform in the `terraform/` directory:

- **VPC** — public/private subnets, NAT gateway, security groups
- **ECS Fargate** — cluster, service, task definition
- **ECR** — container image repository
- **ALB** — Application Load Balancer with HTTPS
- **DynamoDB** — all 8 tables with GSIs and TTL
- **IAM** — roles and policies for ECS tasks
- **CloudWatch** — log group

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Deploy a New Image

```bash
docker build -t ginator .
docker tag ginator:latest <account>.dkr.ecr.<region>.amazonaws.com/ginator:latest
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/ginator:latest
aws ecs update-service --cluster ginator --service ginator --force-new-deployment
```

## Environment Variables

| Variable                 | Description                                          | Default               |
| ------------------------ | ---------------------------------------------------- | --------------------- |
| `SESSION_SECRET`         | Secret for express-session cookie signing            | *(required)*          |
| `ENCRYPTION_KEY`         | AES-256 key for stored credentials (64 hex chars)    | *(required)*          |
| `DYNAMODB_ENDPOINT`      | DynamoDB endpoint URL (set for local dev)            | `http://localhost:8000` |
| `AWS_REGION`             | AWS region                                           | `us-east-1`           |
| `AWS_ACCESS_KEY_ID`      | AWS access key                                       | —                     |
| `AWS_SECRET_ACCESS_KEY`  | AWS secret key                                       | —                     |
| `PORT`                   | Express server listen port                           | `3000`                |
| `NODE_ENV`               | `development` or `production`                        | `development`         |
| `CORS_ORIGIN`            | Allowed CORS origin                                  | `http://localhost:3001` |
| `GITHUB_CLIENT_ID`       | GitHub OAuth App client ID                           | —                     |
| `GITHUB_CLIENT_SECRET`   | GitHub OAuth App client secret                       | —                     |

## Visualizations

GInaTor includes 18 visualization types:

| Visualization          | Type        | Description                                          |
| ---------------------- | ----------- | ---------------------------------------------------- |
| **Stats**              | Cards       | Contributor count, file count, commit count, dates   |
| **TimeBloom**          | Three.js    | Gource-style animated radial tree with playback      |
| **Contributor Heatmap**| D3 Grid     | Author × time grid, color intensity = commits        |
| **File Hotspot Treemap** | D3 Treemap | Rectangles sized by change frequency                |
| **Code Ownership Sunburst** | D3 Sunburst | Directory rings colored by primary contributor  |
| **Commit Pulse**       | D3 Line     | Commit velocity over time with spike detection       |
| **Collaboration Network** | D3 Force | Author nodes connected by shared file edits         |
| **File Type Distribution** | D3 Donut | Segments by file extension                          |
| **Activity Matrix**    | D3 Grid     | 7×24 day/hour heatmap                               |
| **Branch/Merge Graph** | Table       | Commits with branch info                             |
| **Impact Burst**       | D3 Radial   | Per-commit radial burst showing affected files       |
| **Bubble Map**         | D3 Pack     | Files as bubbles, clustered by directory             |
| **Complexity Trend**   | D3 Line     | File size over time with threshold                   |
| **PR Review Flow**     | Placeholder | Sankey diagram (GitHub/GitLab only)                  |
| **Bus Factor**         | Table       | Files sorted by contributor count, risk highlighting |
| **Stale Files**        | Table       | Files not modified within threshold                  |
| **Timeline**           | D3 Stacked  | Additions/deletions/modifications per period         |
| **City Block**         | D3 Bars     | Files as buildings (height=lines, width=frequency)   |

## Testing

370 tests across 46 suites — 27 property-based tests validating formal correctness properties.

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:property # Property-based tests only
npm run test:coverage # With coverage
```

## Attribution

- [Gource](https://gource.io) — the original software version control visualization tool
- [D3.js](https://d3js.org) — 2D visualizations
- [Three.js](https://threejs.org) — 3D visualizations (TimeBloom, CityBlock)
- [Express](https://expressjs.com) — backend framework
- [Passport.js](https://www.passportjs.org) — authentication
- [Tailwind CSS](https://tailwindcss.com) + [DaisyUI](https://daisyui.com) — styling
- [TailAdmin](https://tailadmin.com) — dashboard template
- [fast-check](https://fast-check.dev) — property-based testing

## License

MIT
