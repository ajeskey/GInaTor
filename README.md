# GInaTor  
### *(pronounced: gee-NAY-tor)*  
## The Git Inator

Ah, yes. **The GInaTor**.  
Or, if you insist on saying it correctly, **gee-NAY-tor**.

Just as Dr. Doofenshmirtz builds elaborate "-inator" machines to solve wildly specific problems with questionable levels of drama, **GInaTor** is the **G**it **Ina**tor: a web-based tool that transforms raw git history into rich, interactive, browser-based visualizations.

Because sometimes a simple commit log is not enough. Sometimes you need to stare directly into the branching madness and say, "Aha! So *that* is where everything went wrong."

GInaTor ingests commit data from local git repositories, GitHub, GitLab, and AWS CodeCommit, stores normalized records in DynamoDB, and renders **17 distinct visualization types** in the browser. These range from animated radial trees and 3D city metaphors to heatmaps, Sankey diagrams, and genome-sequence timelines.

In other words, it is not merely a Git visualization tool.

It is a **Git visualization INATOR**.

---

## What This Machine Actually Does

GInaTor is designed to take the tangled, mysterious, occasionally cursed history of a source repository and make it visible in a way a human can actually understand.

It provides:

- Commit ingestion from multiple repository sources
- Normalized storage in DynamoDB
- A browser-based visualization experience
- Multiple synchronized views of repository history
- Timeline-based exploration and cross-visualization linking

---

## Architecture Overview

```text
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

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker

### Quick Start

```bash
npm install
cp .env.example .env
npm run dev:local
```

## Commands

| Command | Description |
|---------|-------------|
| npm start | Start production |
| npm run dev | Dev mode |
| npm run dev:local | Full local setup |
| npm test | Run tests |

## AWS Deployment

```bash
cd terraform
terraform init
terraform apply
```

## License

MIT
