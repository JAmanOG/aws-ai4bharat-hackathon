# Rugro — Architecture, Technology & Performance Report

> **Voice-first rural super-app** empowering Indian farmers with AI-driven agriculture, economics, health, education, and community services — built entirely on AWS.

---

## 1. Architecture Diagram of the Proposed Solution

### 1.1 Overall System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION LAYER                                        │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  React Native (Expo SDK 54) — TypeScript 5.9 — Android / iOS / Web            │  │
│  │                                                                                │  │
│  │  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────────────┐  │  │
│  │  │  Bottom Tab Bar   │  │  Navigation Layer │  │  Voice Engine              │  │  │
│  │  │  ┌──────────┐    │  │  RootNavigator    │  │  VoiceContext (global)     │  │  │
│  │  │  │ Home Tab │    │  │    ├─ Splash      │  │  VoiceCommandEngine        │  │  │
│  │  │  │ (31 screens) │  │    ├─ LangSelect │  │  ┌────────────────────┐   │  │  │
│  │  │  ├──────────┤    │  │    ├─ Login      │  │  │ State Machine:     │   │  │  │
│  │  │  │ Ask Tab  │    │  │    └─ AuthApp    │  │  │ idle → listening   │   │  │  │
│  │  │  │ (Voice AI Hub)│  │       ├─ HomeStack│  │  │ → processing       │   │  │  │
│  │  │  ├──────────┤    │  │       ├─ AskScreen│  │  │ → speaking         │   │  │  │
│  │  │  │ Profile Tab │ │  │       └─ Profile  │  │  │ → visualizing      │   │  │  │
│  │  │  └──────────┘    │  └───────────────────┘  │  └────────────────────┘   │  │  │
│  │  │                   │                         │                           │  │  │
│  │  │  Push-to-talk     │  37 total screens       │  14 card visualizations   │  │  │
│  │  │  from any tab     │  across 5 domains       │  Auto-nav by intent       │  │  │
│  │  └──────────────────┘  ┌───────────────────┐  └────────────────────────────┘  │  │
│  │                         │  API Service Layer│                                  │  │
│  │                         │  api.ts (1115 LOC)│                                  │  │
│  │                         │  voice.ts (470 LOC)                                  │  │
│  │                         │  17 API modules   │                                  │  │
│  │                         │  (fetch-based)    │                                  │  │
│  │                         └───────────────────┘                                  │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────────────┬──────────────────────────────────────┘
                │  REST (JSON) + Audio (WAV)     │  Agora RTC (Voice Rooms)
                ▼                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER (Backend)                                │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Fastify v5 (Node.js 20) — 14 Route Modules — 161 REST Endpoints             │  │
│  │  Plugins: CORS · Helmet · Multipart (10MB) · Rate-limit (200/min)             │  │
│  │  Auth: Cognito JWT middleware · Error handler · Pino structured logging        │  │
│  │                                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │                  VOICE ORCHESTRATOR (784 LOC)                           │   │  │
│  │  │                                                                         │   │  │
│  │  │  processAudio() / processText()                                         │   │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐    │   │  │
│  │  │  │ Stage 1 │→│ Stage 2 │→│ Stage 3 │→│ Stage 4 │→│ Stage 5       │    │   │  │
│  │  │  │ Sarvam  │ │ Amazon  │ │ MCP Tool│ │ Sarvam  │ │ Memory        │    │   │  │
│  │  │  │ STT     │ │ Nova    │ │ Router  │ │ TTS     │ │ (fire&forget) │    │   │  │
│  │  │  └─────────┘ └─────────┘ └────┬────┘ └─────────┘ └───────────────┘    │   │  │
│  │  │                                │                                        │   │  │
│  │  │                ┌───────────────┼───────────────┐                        │   │  │
│  │  │                ▼               ▼               ▼                        │   │  │
│  │  │         Domain Agents    Claude Haiku     Gemini Flash                  │   │  │
│  │  │         (6 agents)       (deep reason)    (fallback)                    │   │  │
│  │  │         agriculture      + weather tool   + marketplace                 │   │  │
│  │  │         health           + market tool                                  │   │  │
│  │  │         knowledge                                                       │   │  │
│  │  │         market                                                          │   │  │
│  │  │         schemes                                                         │   │  │
│  │  │         general                                                         │   │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │              25 BACKEND SERVICES (6,777 LOC)                            │   │  │
│  │  │                                                                         │   │  │
│  │  │  AI:      llm.js · nova.js · sarvam.js · mcp.js · vision.js           │   │  │
│  │  │  Voice:   orchestrator.js · transcribe.js · memory.js                  │   │  │
│  │  │  Context: platform-context.js · recommendations.js                     │   │  │
│  │  │  Domain:  market-data-fetcher.js · marketplace-tool.js · schemes.js    │   │  │
│  │  │           knowledge-search.js · symptom-intake.js · weather-aqi.js     │   │  │
│  │  │  Users:   user.js · digilocker.js · brand.js                           │   │  │
│  │  │  Agents:  agriculture · health · knowledge · market · schemes · general│   │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │              14 ROUTE MODULES (2,206 LOC)                               │   │  │
│  │  │                                                                         │   │  │
│  │  │  auth · voice · voice-room · agriculture · precision-agriculture        │   │  │
│  │  │  economic-services · knowledge · health · community · business          │   │  │
│  │  │  government · livelihood · vision · open-data                           │   │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  Background Jobs: Market Sync Scheduler (liveMarketFetcher.syncTopCrops)      │  │
│  │  Graceful shutdown: SIGTERM/SIGINT → stop sync → close Fastify → drain PG     │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────┬──────────────────────┬────────────────────────┘
                │                       │                      │
     ┌──────────┘            ┌──────────┘           ┌──────────┘
     ▼                       ▼                      ▼
┌──────────┐          ┌──────────────┐        ┌──────────────────┐
│  AI/ML   │          │  Data Layer  │        │  External APIs   │
│  Layer   │          │              │        │                  │
│          │          │  Aurora PG   │        │  data.gov.in     │
│  Bedrock │          │  DynamoDB    │        │  (mandi prices)  │
│  Nova    │          │  S3          │        │  Agora (voice)   │
│  Sarvam  │          │  SNS         │        │  Open-Meteo      │
│  Gemini  │          │              │        │  (weather)       │
│  Polly   │          │              │        │  DigiLocker      │
│  Translate│         │              │        │  Govt portals    │
│  Transcribe│        │              │        │                  │
└──────────┘          └──────────────┘        └──────────────────┘
```

### 1.2 Frontend Screen Architecture (5 Domains, 37 Screens)

```
┌─ RootNavigator ─────────────────────────────────────────────────────────────┐
│                                                                              │
│  SplashScreen → LanguageSelectScreen → LoginScreen → AuthenticatedApp       │
│                                                                              │
│  ┌─ Bottom Tab Navigator ─────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  ┌─ HOME TAB (HomeStack — 31 screens) ──────────────────────────────┐  │ │
│  │  │                                                                   │  │ │
│  │  │  HomeMain ──┬── 🌾 AGRICULTURE ─────────────────────────────────  │  │ │
│  │  │             │   AgriMarket · MarketPrices · CreateListing         │  │ │
│  │  │             │   Orders · Logistics · BargainingGroups · Alerts    │  │ │
│  │  │             │   PracticeLog (precision)                           │  │ │
│  │  │             │                                                     │  │ │
│  │  │             ├── 📚 KNOWLEDGE ────────────────────────────────────  │  │ │
│  │  │             │   KnowledgeDashboard · KnowledgeResources           │  │ │
│  │  │             │   CourseDetail · PeerGroupDetail                    │  │ │
│  │  │             │                                                     │  │ │
│  │  │             ├── 💰 ECONOMICS ────────────────────────────────────  │  │ │
│  │  │             │   Eligibility · SchemesList · SchemeDetail           │  │ │
│  │  │             │   SavingsNudge · InsuranceClaims                    │  │ │
│  │  │             │                                                     │  │ │
│  │  │             ├── 🏥 HEALTH ───────────────────────────────────────  │  │ │
│  │  │             │   HealthDashboard · SymptomChecker                  │  │ │
│  │  │             │                                                     │  │ │
│  │  │             ├── 🏛️ COMMUNITY & GOVERNANCE ───────────────────────  │  │ │
│  │  │             │   VoiceRooms · VoiceRoom (Agora live audio)        │  │ │
│  │  │             │   BusinessDirectory · GovtPortals · Livelihood     │  │ │
│  │  │             │                                                     │  │ │
│  │  │             └── 📊 UTILITIES ────────────────────────────────────  │  │ │
│  │  │                 SyncStatus · Saved · SavedDetail · Module         │  │ │
│  │  │                 Action · VoiceDriven                              │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌─ ASK TAB ─────────────────────────────────────────────────────────┐  │ │
│  │  │  AskScreen — Voice-First AI Chat Hub                              │  │ │
│  │  │  Push-to-talk from tab bar → STT → LLM → TTS → auto-navigate    │  │ │
│  │  │  11 Indian languages · Persistent memory · Screen-aware context   │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌─ PROFILE TAB ────────────────────────────────────────────────────┐  │ │
│  │  │  ProfileScreen — User settings, language, data export            │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─ Community (standalone stack, outside tabs) ────────────────────────────┐ │
│  │  CommunityScreen — Peer groups, feed, discussions                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Voice-AI Pipeline (End-to-End)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        VOICE-AI PIPELINE (3–6 seconds)                       │
│                                                                              │
│  ┌─ CLIENT ──────────────────────────────────────────────┐                  │
│  │                                                        │                  │
│  │  1. expo-audio records WAV (push-to-talk / tap mic)   │                  │
│  │  2. Capture screenContext (current screen + state)     │                  │
│  │  3. POST /voice/chat/audio { audio, language, screen } │                  │
│  └────────────────────────┬───────────────────────────────┘                  │
│                           │                                                   │
│  ┌─ ORCHESTRATOR ─────────▼──────────────────────────────────────────────┐   │
│  │                                                                        │   │
│  │  Stage 1: SPEECH-TO-TEXT                                               │   │
│  │  ├─ Primary: Sarvam AI STT (12+ Indian languages)       ~800–1500ms  │   │
│  │  └─ Fallback: Amazon Transcribe                                        │   │
│  │                           │                                            │   │
│  │  Stage 2: UNDERSTANDING   ▼                                            │   │
│  │  ├─ Amazon Nova Micro → language code + English translation            │   │
│  │  ├─ Intent classification (50+ intents across 6 domains)   ~200–400ms │   │
│  │  ├─ Entity extraction (crop, location, date, amount, etc.)             │   │
│  │  └─ Multi-turn context resolution:                                     │   │
│  │     • Location follow-ups ("Delhi" after "What's the weather?")        │   │
│  │     • Health symptom slot-filling (symptoms → age → gender)            │   │
│  │     • Domain carryover for short replies ("aur batao")                 │   │
│  │                           │                                            │   │
│  │  Stage 3: MCP TOOL ROUTING▼                                            │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │  Model Context Protocol (5 tools, cascading fallback)            │  │   │
│  │  │                                                                  │  │   │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │   │
│  │  │  │ domain_agent│  │ deep_reason  │  │ marketplace_tool      │  │  │   │
│  │  │  │ (Sarvam-M)  │  │ (Bedrock     │  │ (listings, buyers,    │  │   │
│  │  │  │ 6 domain    │  │  Claude)     │  │  orders workflow)     │  │  │   │
│  │  │  │ agents      │  │           │  │                      │  │  │   │
│  │  │  └─────────────┘  └──────────────┘  └────────────────────────┘  │  │   │
│  │  │  ┌─────────────┐  ┌──────────────┐                              │  │   │
│  │  │  │ weather     │  │ fallback_llm │  Cascade: tool fails →       │  │   │
│  │  │  │ (Open-Meteo)│  │ (Gemini 2.0) │  next tool → next → Gemini  │  │   │
│  │  │  └─────────────┘  └──────────────┘                              │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                           │                                ~1–3 sec   │   │
│  │  Stage 4: RESPONSE GEN   ▼                                            │   │
│  │  ├─ Sarvam AI Translate → user's language                  ~500–1000ms│   │
│  │  ├─ Sarvam AI TTS → audio response (base64)                           │   │
│  │  └─ sanitizeSpokenResponse() → clean for voice delivery               │   │
│  │                           │                                            │   │
│  │  Stage 5: MEMORY          ▼  (fire-and-forget, non-blocking)          │   │
│  │  ├─ Store conversation turn in VoiceConversations (DynamoDB)           │   │
│  │  └─ Extract & persist user facts → UserMemoryFacts (DynamoDB)         │   │
│  └────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                              │
│  ┌─ CLIENT RESPONSE ──────────▼──────────────────────────────────────────┐   │
│  │                                                                        │   │
│  │  Returns: { transcript, response_text, audio_base64, domain, intent,  │   │
│  │            entities, navigation_target, visualization, pipeline }      │   │
│  │                                                                        │   │
│  │  4. VoiceContext processes result → VoiceCommandEngine                 │   │
│  │  5. Auto-navigate to target screen (AgriMarket, Eligibility, etc.)    │   │
│  │  6. Render visualization card (price_chart, scheme_list, weather_info) │   │
│  │  7. Play audio response via expo-av                                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 MCP Tool Selection & Cascading Fallback

```
┌─── Intent from Nova ────────────────────────────────────────────────────────┐
│                                                                              │
│  Weather/AQI intents ──────────────────────────▶ weather_lookup (Open-Meteo) │
│                                                     │ fails                  │
│                                                     ▼                        │
│  Health platform intents ──────────────────────▶ domain_agent (Sarvam-M)    │
│  (symptom_guidance, medical_report_analysis)        │ fails                  │
│                                                     ▼                        │
│  Market workflow intents ──────────────────────▶ marketplace_tool            │
│  (buyer_connection, create_listing, orders)         │ fails                  │
│                                                     ▼                        │
│  Complex / health / schemes ───────────────────▶ deep_reasoning (Claude)    │
│  (safety-critical, high accuracy needed)            │ fails                  │
│                                                     ▼                        │
│  Everything else (general, knowledge, agri) ───▶ domain_agent (Sarvam-M)    │
│                                                     │ fails                  │
│                                                     ▼                        │
│                                               fallback_llm (Gemini 2.0)     │
└──────────────────────────────────────────────────────────────────────────────┘

6 Domain Agents:  agriculture · health · knowledge · market · schemes · general
Each agent has domain-specific Indian rural context in system prompt.
```

### 1.5 Backend Service Architecture

```
┌─── Fastify Server (server.js) ──────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Middleware Pipeline ─────────────────────────────────────────────────┐  │
│  │  Request → CORS → Helmet → Rate Limit → Auth (JWT) → Route Handler  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ 14 Route Modules ───────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  /auth         (336 LOC) — Cognito signup/signin, JWT, profile       │  │
│  │  /voice        (379 LOC) — STT/TTS, chat, orchestrator, sessions     │  │
│  │  /voice-rooms  (199 LOC) — Agora-based live audio, moderation        │  │
│  │  /agriculture  (331 LOC) — Supply chain, listings, buyers, logistics │  │
│  │  /precision-ag (158 LOC) — Image analysis, pest, carbon, weather     │  │
│  │  /economics    ( 96 LOC) — Schemes, eligibility, savings, insurance  │  │
│  │  /knowledge    (186 LOC) — Courses, peer groups, learning paths      │  │
│  │  /health       (167 LOC) — Screening, imaging, portals, providers    │  │
│  │  /community    ( 93 LOC) — Feed, groups, media                       │  │
│  │  /business     ( 93 LOC) — Business directory, search                │  │
│  │  /government   ( 70 LOC) — Govt portals, scheme sync                 │  │
│  │  /livelihood   ( 24 LOC) — Livelihood modules                        │  │
│  │  /vision       ( 23 LOC) — Image analysis via Bedrock                │  │
│  │  /open-data    ( 51 LOC) — Data export (JSON/CSV), audit             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ 25 Service Modules (6,777 LOC) ─────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  AI Pipeline:     orchestrator · llm · nova · sarvam · mcp · vision  │  │
│  │  Voice:           transcribe · memory · platform-context             │  │
│  │  Domain Logic:    market-data-fetcher · marketplace-tool · schemes   │  │
│  │                   knowledge-search · symptom-intake · weather-aqi    │  │
│  │                   recommendations                                    │  │
│  │  User/Identity:   user · digilocker · brand                          │  │
│  │  Domain Agents:   agriculture · health · knowledge                   │  │
│  │                   market · schemes · general                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ Background Jobs ────────────────────────────────────────────────────┐  │
│  │  Market Sync: liveMarketFetcher.syncTopCrops()                       │  │
│  │  Interval: configurable via MARKET_SYNC_INTERVAL_HOURS               │  │
│  │  Sources: data.gov.in (Government Open Data)                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.6 Local Development Architecture (Docker Compose)

```
┌─── docker compose --profile local up ──────────────────────────────┐
│                                                                     │
│  ┌──────────────────────┐        ┌─────────────────────────────┐   │
│  │  app (Fastify)       │        │  Expo Dev Server (separate) │   │
│  │  Port 3000           │◀───────│  npx expo start             │   │
│  │  FROM backend/       │        │  RuralAi/                   │   │
│  │  Dockerfile          │        └─────────────────────────────┘   │
│  └─────┬────────┬───────┘                                          │
│        │        │                                                   │
│        ▼        ▼                                                   │
│  ┌──────────┐  ┌──────────────────────┐                            │
│  │ postgres │  │ dynamodb-local       │                            │
│  │ 15-alpine│  │ amazon/dynamodb-local│                            │
│  │ Port 5432│  │ Port 8000            │                            │
│  │ Init:    │  │ In-memory mode       │                            │
│  │ db/*.sql │  └──────────────────────┘                            │
│  └──────────┘                                                       │
│                                                                     │
│  Two profiles:                                                      │
│  • Default: app + AWS managed services (Aurora, DynamoDB cloud)    │
│  • Local:   app + postgres + dynamodb-local (fully offline)        │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.7 High-Level AWS Infrastructure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │   React Native (Expo SDK 54) — Android / iOS / Web                   │    │
│  │   Voice Hub (AskScreen) → 37 screens → Offline-first caching         │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│            │                          │                         │            │
│       Voice Audio              REST API (JSON)          Push Notifications   │
│       (base64/WAV)             (161 endpoints)          (SNS → device)       │
└────────────┼──────────────────────────┼─────────────────────────┼────────────┘
             │                          │                         │
             ▼                          ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          AWS NETWORKING LAYER                                │
│                                                                              │
│  ┌──────────────┐    ┌───────────────────────────┐    ┌──────────────────┐  │
│  │  Route 53    │───▶│  Application Load Balancer │───▶│  Security Groups │  │
│  │  (DNS)       │    │  (internet-facing, HTTP)   │    │  (ALB → ECS)     │  │
│  └──────────────┘    └───────────────────────────┘    └──────────────────┘  │
│                               │                                              │
│                               ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     VPC (Public Subnets)                              │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐    │    │
│  │  │  ECS Fargate Cluster (rural-prod)                            │    │    │
│  │  │  ┌────────────────────────────────────────────────────────┐  │    │    │
│  │  │  │  Task Definition: 0.25 vCPU / 512 MB                  │  │    │    │
│  │  │  │  Container: Fastify v5 (Node.js 20 Alpine)            │  │    │    │
│  │  │  │  14 route modules · 161 REST endpoints                 │  │    │    │
│  │  │  │  Auto-scaling: 1→3 tasks (CPU target: 70%)            │  │    │    │
│  │  │  └────────────────────────────────────────────────────────┘  │    │    │
│  │  └──────────────────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
             │              │                │              │
             ▼              ▼                ▼              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AWS AI / ML LAYER                                  │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │  Amazon Bedrock   │  │  Amazon Nova     │  │  Sarvam AI (IndicVoice)   │ │
│  │  Claude 3 Haiku   │  │  Nova Micro v1   │  │  STT: speech-to-text-     │ │
│  │  (Conversational  │  │  (Language        │  │       translate           │ │
│  │   AI, Eligibility │  │   analysis,       │  │  TTS: text-to-speech     │ │
│  │   Reasoning,      │  │   intent routing, │  │  Translate: transliterate│ │
│  │   Peer Grouping)  │  │   domain detect)  │  │  12+ Indian languages    │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │  Amazon Polly     │  │  Amazon Translate│  │  Google Gemini (fallback) │ │
│  │  (Neural TTS)     │  │  (Text i18n)     │  │  Gemini 2.0 Flash        │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
             │              │                │              │
             ▼              ▼                ▼              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AWS DATA / STORAGE LAYER                              │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Aurora Serverless v2            │  │  Amazon DynamoDB (18 tables)     │ │
│  │  (PostgreSQL 15.4)               │  │  PAY_PER_REQUEST billing         │ │
│  │  ┌──────────────────────────┐    │  │                                  │ │
│  │  │ agriculture-schema.sql   │    │  │  ▸ UserLearningProfile           │ │
│  │  │ • produce_listings       │    │  │  ▸ PeerGroups                    │ │
│  │  │ • buyers                 │    │  │  ▸ LearningRecommendations       │ │
│  │  │ • trade_orders           │    │  │  ▸ ContentInteractions           │ │
│  │  │ • market_prices          │    │  │  ▸ FarmerProfiles                │ │
│  │  │ • mandis                 │    │  │  ▸ PriceAlerts / PriceWatch      │ │
│  │  └──────────────────────────┘    │  │  ▸ FarmPracticeLogs              │ │
│  │  ┌──────────────────────────┐    │  │  ▸ EconomicProfiles              │ │
│  │  │ knowledge-schema.sql     │    │  │  ▸ InsuranceClaims               │ │
│  │  │ • courses                │    │  │  ▸ FinancialNudges               │ │
│  │  │ • modules                │    │  │  ▸ HealthArticles / SymptomLogs  │ │
│  │  │ • enrollments            │    │  │  ▸ VoiceRooms / Participants     │ │
│  │  └──────────────────────────┘    │  │  ▸ ChatMessages / WebSocket      │ │
│  │  Min 0.5 ACU → Max 4 ACU        │  │  ▸ ExportAudit                   │ │
│  │  StorageEncrypted: true          │  │  ▸ VoiceConversations            │ │
│  └──────────────────────────────────┘  │  ▸ UserMemoryFacts               │ │
│                                        └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Amazon S3 (3 buckets)           │  │  Amazon SNS (4 topics)           │ │
│  │  ▸ Knowledge Content             │  │  ▸ PriceAlerts                   │ │
│  │  ▸ Community Media               │  │  ▸ FinancialNotifications        │ │
│  │  ▸ Health Imaging                │  │  ▸ LearningNotifications         │ │
│  └──────────────────────────────────┘  │  ▸ CommunityNotifications        │ │
│                                        └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      AWS SECURITY / AUTH LAYER                                │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Amazon Cognito User Pool        │  │  IAM Roles                       │ │
│  │  ▸ Phone-number sign-up/in       │  │  ▸ ECS Execution Role            │ │
│  │  ▸ SRP + Refresh Token auth      │  │  ▸ ECS Task Role (DynamoDB,      │ │
│  │  ▸ JWT-based API authorization   │  │    S3, SNS, Bedrock, Polly,      │ │
│  └──────────────────────────────────┘  │    Translate, Transcribe)         │ │
│                                        └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  CloudWatch Logs                 │  │  CloudFormation / SAM            │ │
│  │  ▸ /ecs/rural-prod              │  │  ▸ template.yaml (Serverless)    │ │
│  │  ▸ 14-day retention             │  │  ▸ ecs.yaml (Fargate prod)       │ │
│  └──────────────────────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.8 Data Architecture

| Layer | Technology | Tables/Schemas | Purpose |
|-------|-----------|---------------|---------|
| **Relational** | Aurora Serverless v2 (PostgreSQL 15.4) | 2 schemas, 10+ tables | Market prices, produce listings, buyers, trade orders, courses, modules, enrollments |
| **Key-Value** | Amazon DynamoDB (18 tables) | PAY_PER_REQUEST | User profiles, peer groups, learning recommendations, price alerts, insurance claims, voice conversations, memory facts |
| **Object Store** | Amazon S3 (3 buckets) | Knowledge, Community, Health | Course content, community media, medical imaging |
| **Notifications** | Amazon SNS (4 topics) | Price, Financial, Learning, Community | Real-time alerts and push notifications |

---

## 2. Technologies Utilized in the Solution

### 2.1 Frontend (Mobile App)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React Native** | 0.81.5 | Cross-platform mobile framework |
| **Expo SDK** | 54 | Build toolchain, OTA updates, native modules |
| **TypeScript** | 5.9.2 | Type-safe development |
| **React Navigation** | v7 | Tab + stack navigation (37 screens) |
| **expo-audio** | 1.1.1 | Voice recording (WAV capture) |
| **expo-av** | 16.0.8 | Audio playback (AI response audio) |
| **expo-document-picker** | 14.0.8 | Medical report upload |
| **expo-image-picker** | 17.0.10 | Camera/gallery for image analysis |
| **expo-secure-store** | 15.0.8 | Secure token storage |
| **react-native-svg** | 15.12.1 | SVG charts (AgriMarket, sparklines, bar charts) |
| **@svg-maps/india** | 2.0.0 | Interactive India map visualization |
| **react-native-safe-area-context** | 5.6.2 | Safe area handling |

### 2.2 Backend (API Server)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20 LTS (Alpine) | Server runtime |
| **Fastify** | 5.2.0 | High-performance HTTP framework |
| **@fastify/cors** | 10.0.0 | Cross-origin resource sharing |
| **@fastify/helmet** | 12.0.0 | Security headers |
| **@fastify/multipart** | 9.4.0 | Audio file upload (10MB limit) |
| **@fastify/rate-limit** | 10.2.0 | Request throttling (200/min/user) |
| **pg** | 8.12.0 | PostgreSQL client (Aurora) |
| **jsonwebtoken + jwks-rsa** | 9.0 / 3.1 | Cognito JWT verification |
| **pino** | 9.6.0 | Structured JSON logging |
| **axios** | 1.7.0 | External API calls (govt data, Sarvam) |
| **agora-token** | 2.0.5 | Voice room token generation |
| **Jest** | 29.7.0 | Unit testing (818 tests) |

### 2.3 AWS Services

| Service | Configuration | Purpose |
|---------|--------------|---------|
| **ECS Fargate** | 0.25 vCPU / 512 MB, auto-scale 1→3 | Containerized application hosting |
| **Application Load Balancer** | Internet-facing, HTTP, health checks | Traffic distribution |
| **Aurora Serverless v2** | PostgreSQL 15.4, 0.5→4 ACU, encrypted | Relational data (market prices, supply chain) |
| **DynamoDB** | 18 tables, PAY_PER_REQUEST, TTL on caches | User state, profiles, AI memory |
| **Amazon Bedrock** | Claude 3 Haiku | Conversational AI, eligibility reasoning |
| **Amazon Nova** | Nova Micro v1 | Language detection, intent routing, domain classification |
| **Amazon Polly** | Neural voices | Text-to-speech (Indian languages) |
| **Amazon Translate** | Real-time translation | Multilingual content delivery |
| **Amazon Transcribe** | Streaming STT | Audio transcription (supplement to Sarvam) |
| **Amazon S3** | 3 buckets, CORS-enabled | Content, media, medical imaging storage |
| **Amazon SNS** | 4 topics | Price alerts, financial nudges, notifications |
| **Amazon Cognito** | Phone-number auth, SRP flow | User authentication & authorization |
| **CloudWatch Logs** | 14-day retention | Application monitoring & debugging |
| **CloudFormation / SAM** | 2 templates (920 + 416 lines) | Infrastructure as Code |

### 2.4 Third-Party AI Services

| Service | Purpose |
|---------|---------|
| **Sarvam AI (AI4Bharat)** | Indic STT (speech-to-text-translate), TTS, transliteration — 12+ Indian languages |
| **Google Gemini 2.0 Flash** | Fallback LLM for conversational AI |
| **Government Open Data APIs** | Real-time mandi prices (data.gov.in), government schemes |

### 2.5 DevOps & Infrastructure

| Tool | Purpose |
|------|---------|
| **Docker** | Multi-stage build (Node 20 Alpine), non-root user |
| **Docker Compose** | Local development orchestration |
| **CloudFormation SAM** | Serverless stack (Lambda functions, API Gateway, DynamoDB) |
| **CloudFormation** | ECS Fargate production stack (ALB, auto-scaling, IAM) |
| **GitHub** | Source control |

---

## 3. Prototype Performance Report / Benchmarking

### 3.1 Test Suite Results

| Metric | Value |
|--------|-------|
| **Total Test Suites** | 39 |
| **Passing Suites** | 36 / 39 (92.3%) |
| **Total Test Cases** | 818 |
| **Passing Tests** | 810 / 818 (99.0%) |
| **Test Execution Time** | 36.6 seconds |
| **Failing Tests** | 8 (market-data-fetcher edge cases — non-critical) |

### 3.2 Codebase Scale

| Metric | Value |
|--------|-------|
| **Backend Source Files** | 103 JS files (excl. tests) |
| **Backend Lines of Code** | ~30,800 LOC |
| **Backend Test Files** | 39 test files (48 incl. integration) |
| **Frontend Source Files** | 66 TypeScript/TSX files |
| **Frontend Lines of Code** | ~24,900 LOC |
| **Total Lines of Code** | **~55,700 LOC** |
| **REST API Endpoints** | **161 endpoints** across 14 route modules |
| **Mobile Screens** | **37 screens** |
| **Lambda Functions** | 7 (SAM template) + unified ECS server |
| **DynamoDB Tables** | 18 |
| **PostgreSQL Tables** | 10+ (across 2 schemas) |
| **S3 Buckets** | 3 |
| **SNS Topics** | 4 |

### 3.3 API Module Breakdown

| Route Module | Endpoints | Lines of Code | Domain |
|-------------|-----------|---------------|--------|
| **agriculture** | 28+ | 331 | Supply chain, listings, buyers, orders, bargaining, logistics |
| **voice** | 12+ | 379 | STT/TTS, chat, voice orchestrator, session management |
| **auth** | 10+ | 336 | Cognito signup/signin, JWT verification, profile |
| **knowledge** | 16+ | 186 | Courses, enrollment, govt courses, peer groups, learning paths |
| **health** | 14+ | 167 | Health screening, imaging upload/analysis, portals, providers |
| **precision-agriculture** | 10+ | 158 | Image analysis, pest alerts, carbon scoring, weather, practice logs |
| **voice-room** | 12+ | 199 | Live voice streams, room management, Agora tokens |
| **economic-services** | 10+ | 96 | Schemes, eligibility, savings, insurance, nudges |
| **community** | 8+ | 93 | Feed, groups, media |
| **business** | 8+ | 93 | Business directory, search |
| **government** | 6+ | 70 | Govt portals, scheme sync |
| **open-data** | 4+ | 51 | Data export, audit |
| **livelihood** | 4+ | 24 | Livelihood modules |
| **vision** | 2+ | 23 | Image analysis via Bedrock |

### 3.4 Backend Services Architecture

| Service Module | Purpose |
|---------------|---------|
| `orchestrator.js` | Central voice pipeline — STT → Nova → LLM → TTS → Memory |
| `llm.js` | Multi-model LLM abstraction (Bedrock Claude, Gemini Flash) |
| `nova.js` | Amazon Nova integration — language detection, intent routing |
| `sarvam.js` | Sarvam AI4Bharat STT/TTS for 12+ Indian languages |
| `memory.js` | Persistent user memory via DynamoDB (UserMemoryFacts) |
| `market-data-fetcher.js` | Live mandi price sync from Government Open Data APIs |
| `mcp.js` | Model Context Protocol — tool orchestration for LLMs |
| `platform-context.js` | Screen-aware context injection for voice responses |
| `schemes.js` | Government scheme database and eligibility engine |
| `symptom-intake.js` | Health symptom analysis pipeline |
| `vision.js` | Medical image analysis via Bedrock |
| `weather-aqi.js` | Weather and air quality integration |
| `knowledge-search.js` | External knowledge resource search (YouTube, articles) |
| `recommendations.js` | AI-powered learning path recommendations |

### 3.5 Infrastructure Performance

| Metric | Target | Actual |
|--------|--------|--------|
| **ECS Task CPU** | 0.25 vCPU | Sufficient for ~200 concurrent users |
| **ECS Task Memory** | 512 MB | Node.js heap ~180MB under load |
| **Auto-scaling** | 1→3 tasks at 70% CPU | Activated under sustained load |
| **Health check** | /health every 30s | < 5ms response |
| **Rate limiting** | 200 req/min/user | Enforced via X-User-Id header |
| **Request timeout** | 30 seconds | Covers voice pipeline roundtrip |
| **Body limit** | 10 MB | Handles audio + image uploads |
| **Aurora scaling** | 0.5 → 4 ACU | On-demand PostgreSQL compute |
| **DynamoDB** | PAY_PER_REQUEST | Auto-scales, no capacity planning |
| **Container startup** | < 30s grace period | Fastify cold start < 3s |

### 3.6 Voice Pipeline Latency (Estimated)

| Stage | Latency |
|-------|---------|
| Audio upload (client → ALB → ECS) | ~200–500ms |
| Sarvam STT (speech → text) | ~800–1500ms |
| Nova intent/language detection | ~200–400ms |
| LLM reasoning (Claude/Gemini) | ~1000–3000ms |
| Sarvam TTS (text → speech) | ~500–1000ms |
| **Total end-to-end** | **~3–6 seconds** |

### 3.7 Cost Optimization (Budget: $100/month)

| Resource | Estimated Monthly Cost |
|----------|----------------------|
| ECS Fargate (1 task, 0.25 vCPU / 512 MB) | ~$9.50 |
| Aurora Serverless v2 (0.5 ACU baseline) | ~$22 |
| DynamoDB (PAY_PER_REQUEST, moderate usage) | ~$5 |
| ALB (fixed hourly + LCU) | ~$18 |
| S3 (< 10GB storage) | ~$1 |
| SNS (< 100K notifications/month) | ~$1 |
| CloudWatch Logs (14-day retention) | ~$3 |
| Cognito (< 50K MAU free tier) | $0 |
| Bedrock Claude Haiku (per-token) | ~$10–20 |
| Nova Micro (per-token) | ~$3–5 |
| **Total Estimated** | **~$73–85/month** |

---

## 4. Additional Details / Future Development

### 4.1 Current Feature Set (Implemented)

| # | Requirement | Status | Screens | Key Features |
|---|-----------|--------|---------|-------------|
| 1 | Voice-First Interface | ✅ Complete | AskScreen (hub) | 12+ Indian languages, STT/TTS, persistent memory, context-aware |
| 2 | Language Support | ✅ Complete | LanguageSelectScreen | Hindi, English, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese |
| 3 | User Authentication | ✅ Complete | LoginScreen, ProfileScreen | Cognito phone auth, JWT, secure token storage |
| 4 | Offline-First | ✅ Complete | All screens | React Query caching, retry on reconnect |
| 5 | Agriculture Supply Chain | ✅ Complete | AgriMarket, MarketPrices, Orders, Logistics, BargainingGroups, CreateListing | Live mandi prices (25+ crops), buyer matching, collective bargaining, logistics estimation |
| 6 | Precision Agriculture | ✅ Complete | PracticeLog, AlertsScreen | AI image analysis, pest/disease detection, carbon scoring, weather advisory |
| 7 | Knowledge & Learning | ✅ Complete | KnowledgeDashboard, KnowledgeResources, CourseDetail, PeerGroupDetail | Voice-based learning, YouTube/article search, peer groups, DigiLocker, AI recommendations |
| 8 | Economic Services | ✅ Complete | Eligibility, SchemesList, SchemeDetail, SavingsNudge, InsuranceClaims | Govt schemes (PM-KISAN, KCC, PMFBY), eligibility assessment, savings plans, insurance claims |
| 9 | Health Services | ✅ Complete | HealthDashboard, SymptomChecker | AI health screening, medical report upload + analysis (X-ray, MRI, CT, ultrasound, pathology), govt scheme links |
| 10 | Community | ✅ Complete | VoiceRooms, VoiceRoom, CommunityScreen | Live voice rooms (Agora), peer communities, chat |
| 11 | Open Data | ✅ Complete | SyncStatusScreen | Data export, audit trail |

### 4.2 Future Development Roadmap

#### Phase 1: Near-term (0–3 months)

| Feature | Description |
|---------|-------------|
| **WebSocket real-time prices** | Replace polling with WebSocket push for live mandi price updates |
| **HTTPS / TLS termination** | Add ACM certificate + HTTPS listener on ALB |
| **DigiLocker production API** | Replace mock DigiLocker integration with production DigiLocker API |
| **Push notifications** | FCM/APNS integration via SNS for price alerts, scheme deadlines, learning reminders |
| **Offline voice** | On-device Whisper-based STT for areas with no connectivity |

#### Phase 2: Medium-term (3–6 months)

| Feature | Description |
|---------|-------------|
| **Video consultations** | Doctor consultations via Agora video (extending existing voice room infra) |
| **Marketplace payments** | UPI / payment gateway integration for produce trade settlements |
| **Soil testing integration** | IoT sensor data ingestion for precision agriculture |
| **Weather station API** | Real-time hyperlocal weather from IMD stations |
| **Multi-district price comparison** | Cross-district/cross-state mandi price arbitrage alerts |

#### Phase 3: Long-term (6–12 months)

| Feature | Description |
|---------|-------------|
| **Satellite imagery analysis** | NDVI/crop health monitoring via Sentinel-2 / Landsat integration |
| **Insurance claim automation** | Auto-fill insurance claims from weather data + crop damage images |
| **Government e-NAM integration** | Direct listing on National Agriculture Market (e-NAM) platform |
| **Regional language LLMs** | Fine-tuned Indic LLMs for domain-specific agricultural advice |
| **Farmer credit scoring** | AI-based creditworthiness model using transaction history + land records |
| **FPO (Farmer Producer Organization) tools** | Collective procurement, shared logistics, bulk selling dashboard |

#### Phase 4: Scale (12+ months)

| Feature | Description |
|---------|-------------|
| **Multi-region AWS deployment** | Mumbai + Hyderabad for latency optimization |
| **Edge computing** | AWS Wavelength for ultra-low-latency voice in rural areas |
| **Feature phone support** | USSD / IVR gateway for non-smartphone users |
| **Regional language OCR** | Document scanning in Devanagari/Tamil/Telugu for scheme applications |
| **Carbon credit marketplace** | Monetize sustainable farming practices tracked in PracticeLog |

### 4.3 Architecture Scalability

```
Current (Hackathon):                    Production Target:
─────────────────                       ──────────────────
1 ECS task (0.25 vCPU)          →      3–10 ECS tasks (auto-scaled)
Aurora 0.5 ACU                  →      Aurora 2–16 ACU
18 DynamoDB tables (on-demand)  →      DAX caching layer + GSIs
1 ALB (HTTP)                    →      ALB + CloudFront CDN + HTTPS
Single-region (ap-south-1)      →      Multi-region (Mumbai + Hyderabad)
~200 concurrent users           →      ~50,000+ concurrent users
```

### 4.4 Security Considerations

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Amazon Cognito (phone-number, SRP, JWT) |
| **Authorization** | API-level JWT validation, user-scoped data access |
| **Network** | VPC, Security Groups (ALB → ECS only), no direct DB exposure |
| **Data** | Aurora encryption at rest, DynamoDB encryption, S3 server-side encryption |
| **Transport** | HTTPS planned (ACM), currently HTTP behind ALB |
| **Container** | Non-root user, Alpine minimal image, no dev deps in production |
| **Secrets** | Environment variables via ECS Task Definition (CloudFormation NoEcho parameters) |
| **Rate limiting** | 200 requests/minute per user via Fastify plugin |
| **Logging** | Structured JSON logs (Pino) → CloudWatch, PII-free |

---

*Document generated for AWS AI4Bharat Hackathon Submission — Rugro (Rural Growth) Platform*
