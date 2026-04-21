# GInaTor — the Git Inator

Just as Dr. Doofenshmirtz builds elaborate "-inator" machines in *Phineas and Ferb*, **GInaTor** is the **G**it **Ina**tor: a web-based tool that turns raw git history into rich, interactive browser-based visualizations.

GInaTor ingests commit data from local git repos, GitHub, GitLab, and AWS CodeCommit, stores normalized records in DynamoDB, and renders **17 distinct visualization types** in the browser — from animated radial trees and 3D city metaphors to heatmaps, Sankey diagrams, and genome-sequence timelines.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser Client                                         │
│  Pug templates · Tailwind CSS / DaisyUI                 │
│  D3.js (2D) · Three.js (3D) · Timeline Scrubber        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│  Express.js Backend  (./source/)                        │
│  Auth (Passport.js) · Admin · Visualization API         │
│  Git Connector · Webhook Handler · Release Notes (AI)   │
│  Crypto (AES-256-GCM) · Digest Email (SES + cron)      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  DynamoDB  (sole data store)                            │
│  Users · Sessions · Commits · RepoConfigs               │
│  AdminSettings · SprintMarkers · Annotations · Bookmarks│
└─────────────────────────────────────────────────────────┘
```

**Key components:**

- **Express backend** — serves Pug-rendered pages, REST API (`/api/v1/*`), auth, admin panel
- **Pug frontend** — Tailwind CSS + DaisyUI layout adapted from web-template-tailadmin
- **DynamoDB** — all state lives in 8 tables (users, sessions, commits, configs, settings, markers, annotations, bookmarks)
- **Git Connector** — strategy pattern with 4 providers (Local CLI, GitHub REST, GitLab REST, CodeCommit SDK)
- **Visualization engine** — 17 viz types rendered client-side with D3.js and Three.js, synchronized via a Timeline Scrubber and cross-visualization linking

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker (for DynamoDB Local)

### Quick Start

```bash
# 1. Clone and install
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# 3. Start DynamoDB Local, init tables, and run the dev server
npm run dev:local
```

This single command runs `docker compose up -d` (DynamoDB Local on port 8000), initializes all 8 DynamoDB tables, and starts the Express server in development mode.

### Individual Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start in development mode |
| `npm run dev:local` | Docker + table init + dev server (all-in-one) |
| `npm run db:init` | Initialize DynamoDB tables against local endpoint |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:property` | Run property-based tests only |
| `npm run test:coverage` | Run tests with coverage report |

### Docker Compose

The `docker-compose.yml` provides DynamoDB Local:

```bash
docker compose up -d          # Start DynamoDB Local on port 8000
docker compose down           # Stop
```

## AWS Deployment

GInaTor deploys to AWS using Terraform and ECS Fargate.

### Infrastructure (Terraform)

The `terraform/` directory provisions:

- **VPC** — public/private subnets, NAT gateway, security groups
- **ECS Fargate** — cluster, service, task definition
- **ECR** — container image repository
- **ALB** — Application Load Balancer with HTTPS listener
- **DynamoDB** — all 8 tables with GSIs and TTL
- **IAM** — roles and policies for ECS tasks
- **CloudWatch** — log group for container logs

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Deploy a New Image

```bash
# Build and push to ECR
docker build -t ginator .
docker tag ginator:latest <account-id>.dkr.ecr.<region>.amazonaws.com/ginator:latest
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ginator:latest

# ECS will pick up the new image on next deployment
aws ecs update-service --cluster ginator --service ginator --force-new-deployment
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret for express-session cookie signing | *(required)* |
| `ENCRYPTION_KEY` | AES-256 key for stored credentials (64 hex chars = 32 bytes) | *(required)* |
| `DYNAMODB_ENDPOINT` | DynamoDB endpoint URL; set for local dev, omit for AWS | `http://localhost:8000` |
| `AWS_REGION` | AWS region for DynamoDB and other services | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key (for local dev or non-IAM-role environments) | — |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | — |
| `PORT` | Server listen port | `3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## Testing

GInaTor uses **Jest** for unit tests and **fast-check** for property-based tests. The 27 property tests validate universal correctness properties defined in the design document (encryption round-trips, pagination invariants, aggregation sums, etc.).

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:property # Property-based tests only
npm run test:coverage # With coverage
```

## Attribution and Credits

GInaTor is inspired by and built on the shoulders of these projects:

- [Gource](https://gource.io) — the original software version control visualization tool that inspired GInaTor's animated repository visualizations
- [D3.js](https://d3js.org) — powers all 2D visualizations (heatmaps, treemaps, sunbursts, Sankey diagrams, force-directed graphs, and more)
- [Three.js](https://threejs.org) — powers the 3D visualizations (TimeBloom radial tree animation and City Block city metaphor)
- [Express](https://expressjs.com) — Node.js web framework for the backend server
- [Passport.js](https://www.passportjs.org) — authentication middleware (local strategy with email/password)
- [Tailwind CSS](https://tailwindcss.com) — utility-first CSS framework for the frontend
- [DaisyUI](https://daisyui.com) — Tailwind CSS component library for UI elements and theming
- [fast-check](https://fast-check.dev) — property-based testing framework used for correctness verification

## License

MIT
