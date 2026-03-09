# Rugro

![Rugro](./Rugro.jpeg)

Voice-first rural super-app built for the AWS AI for Bharat Hackathon. Rugro combines agriculture workflows, market access, health guidance, learning resources, economics services, and community interactions in a single multilingual mobile experience.

## Quick Links

| Resource | Link |
|---|---|
| Demo APK | [Download Android APK](./RuralAi/build-1773085235935.apk) |
| Demo Video | [Watch Demo Video](https://drive.google.com/file/d/1Goe-CNFJ-4YeB8auV_xDWaF8C-35eLGh/view?usp=sharing) |
| Presentation Deck | [Prototype Development Submission PDF](./.kiro/ppt-deck/Prototype%20Development%20Submission%20_%20AWS%20AI%20for%20Bharat%20Hackathon.pdf) |
| Architecture & Tech Report | [ARCHITECTURE_AND_TECH.md](./ARCHITECTURE_AND_TECH.md) |
| Documentation Hub | [docs/README.md](./docs/README.md) |
| Backend API Reference | [docs/backend-api.md](./docs/backend-api.md) |
| Frontend Guide | [docs/frontend-guide.md](./docs/frontend-guide.md) |
| Deployment Guide | [docs/deployment-guide.md](./docs/deployment-guide.md) |
| AWS Infrastructure Notes | [docs/aws-infrastructure.md](./docs/aws-infrastructure.md) |
| Requirements | [requirements.md](./requirements.md) |
| Frontend Contract Test Report | [RuralAi/FRONTEND-INTEGRATION-TEST-REPORT.md](./RuralAi/FRONTEND-INTEGRATION-TEST-REPORT.md) |
| Backend Integration Test Report | [backend/tests/integration/INTEGRATION-TEST-REPORT.md](./backend/tests/integration/INTEGRATION-TEST-REPORT.md) |

## What Rugro Does

- Lets rural users interact by voice in Indian languages instead of relying on typing.
- Covers five practical domains: agriculture, economics, health, knowledge, and community.
- Supports AI-led workflows such as symptom screening, crop guidance, scheme eligibility, learning discovery, and buyer-seller coordination.
- Includes low-data and Android-first considerations for real rural connectivity constraints.

## Key Product Areas

| Area | What users can do |
|---|---|
| Agriculture | Ask for crop advice, check mandi prices, create listings, manage orders, and plan logistics |
| Economics | Explore schemes, assess eligibility, generate savings plans, and manage insurance claim flows |
| Health | Use voice-led symptom screening and analyze medical report uploads |
| Knowledge | Discover videos, articles, courses, and learning pathways in local languages |
| Community | Join voice rooms and community spaces for peer support and local collaboration |

## Architecture Snapshot

- Frontend: React Native 0.81, Expo SDK 54, TypeScript 5.9
- Backend: Fastify 5.2 on Node.js 20
- AI stack: Amazon Bedrock, Sarvam AI, Polly, Translate, Transcribe
- Data and infra: DynamoDB, S3, SNS, Cognito, ECS Fargate, ALB
- Voice pipeline: push-to-talk recording, STT, intent routing, domain tools, TTS playback

The full breakdown, architecture diagrams, pipeline details, and performance notes are documented in [ARCHITECTURE_AND_TECH.md](./ARCHITECTURE_AND_TECH.md).

## Demo Video

- Public demo video: [Google Drive demo link](https://drive.google.com/file/d/1Goe-CNFJ-4YeB8auV_xDWaF8C-35eLGh/view?usp=sharing)

## Presentation

- Submission deck: [Prototype Development Submission _ AWS AI for Bharat Hackathon.pdf](./.kiro/ppt-deck/Prototype%20Development%20Submission%20_%20AWS%20AI%20for%20Bharat%20Hackathon.pdf)

## APK

The current Android build artifact available in this workspace is:

- [RuralAi/build-1773085235935.apk](./RuralAi/build-1773085235935.apk)

If you plan to share this README on GitHub, upload the APK to a GitHub Release or commit the artifact so the link remains accessible to others.

## Documentation

- [docs/README.md](./docs/README.md): project overview and architecture summary
- [docs/backend-api.md](./docs/backend-api.md): backend endpoints and contracts
- [docs/frontend-guide.md](./docs/frontend-guide.md): app structure, screens, and frontend integration notes
- [docs/deployment-guide.md](./docs/deployment-guide.md): local and deployment setup
- [docs/aws-infrastructure.md](./docs/aws-infrastructure.md): AWS resource layout
- [ARCHITECTURE_AND_TECH.md](./ARCHITECTURE_AND_TECH.md): submission-ready architecture and performance report

## Validation and Test Reports

- Frontend contract coverage: [RuralAi/FRONTEND-INTEGRATION-TEST-REPORT.md](./RuralAi/FRONTEND-INTEGRATION-TEST-REPORT.md)
- Backend integration coverage: [backend/tests/integration/INTEGRATION-TEST-REPORT.md](./backend/tests/integration/INTEGRATION-TEST-REPORT.md)

## Local Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd RuralAi
npm install
npx expo start
```

### Useful Build Note

The frontend is configured to allow HTTP traffic to the current backend endpoint, which is required for the Android release build path in this repo.

## Repository Layout

```text
.
├── README.md
├── ARCHITECTURE_AND_TECH.md
├── docs/
├── backend/
├── RuralAi/
├── infra/
└── requirements.md
```

## Team

- Aman Jaiswal
- Rohit Rathod
- Bhavik Prajapati

## Submission Note

This repository contains the mobile app, backend services, documentation, test reports, and a local APK artifact for the AWS AI for Bharat Hackathon submission.
