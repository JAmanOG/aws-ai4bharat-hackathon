# Rural Ecosystem Platform

> AI-powered voice-first platform for rural communities — agriculture, finance, health, and education.

## Quick Links

| Document | Description |
|----------|-------------|
| [Project Overview](docs/README.md) | Architecture, tech stack, project structure |
| [Backend API Reference](docs/backend-api.md) | All 72 REST endpoints with request/response examples |
| [Deployment Guide](docs/deployment-guide.md) | Local dev, Docker, and AWS production deployment |
| [CI/CD Pipeline](docs/ci-cd-pipeline.md) | GitHub Actions workflows, secrets, and troubleshooting |
| [Frontend Guide](docs/frontend-guide.md) | React Native screens, navigation, API integration |
| [AWS Infrastructure](docs/aws-infrastructure.md) | DynamoDB tables, S3, SNS, Cognito, ECS resources |

## Quick Start

```bash
# Backend (local)
cd backend && npm install && npm run dev

# Backend (Docker — uses AWS managed services)
docker compose up -d

# Backend (Docker — fully local with DynamoDB-local + Postgres)
docker compose --profile local up -d

# Frontend (Expo)
cd RuralAi && npm install && npx expo start

# Run tests
cd backend && npm test       # 85 tests, 20 suites
cd RuralAi && npx tsc --noEmit   # 0 TypeScript errors
```

## Live Environment

| Resource | Value |
|----------|-------|
| **API URL** | `http://rural-alb-dev-2139845854.ap-south-1.elb.amazonaws.com` |
| **Health** | `GET /health` → `{"status":"healthy","version":"2.0.0"}` |
| **Region** | `ap-south-1` (Mumbai) |
| **ECS Cluster** | `rural-dev` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Fastify 5.2, AWS SDK v3 |
| Frontend | React Native 0.81, Expo SDK 54, TypeScript 5.9 |
| Database | DynamoDB (18 tables, on-demand billing) |
| AI | Amazon Bedrock (Claude 3 Haiku), Polly, Translate |
| Auth | Amazon Cognito |
| Storage | S3 (3 buckets) |
| Messaging | SNS (4 topics) |
| Infra | ECS Fargate, ALB, CloudFormation |
| CI/CD | GitHub Actions |

## License

Hackathon project — AWS AI4Bharat 2026.
