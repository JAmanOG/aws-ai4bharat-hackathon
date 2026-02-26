## Feature summary (Requirement 11: Open Data Standards and Interoperability
)
- Standalone microservice for user data export
- Adapter layer normalizes in Microservices API responses into stable DTO
- Aggregator makes parallel HTTP calls with per-service error isolation
- Supports JSON and CSV export formats
- Service filtering via ?services=profile,businesses query param
- Self-only authorization (403), rate limiting via DynamoDB (429)
- Audit logging with 90-day TTL
- SAM template: API Gateway + Cognito, Export Lambda, DynamoDB audit table


### Infrastructure

| Component | Files | Description |
|------------|--------|-------------|
| Infra | `infra/template.yaml` | AWS SAM template provisioning API Gateway, Lambda, DynamoDB, and Cognito |

---

### Core Utilities

| Component | Files | Description |
|------------|--------|-------------|
| Utils | `response.js`, `constants.js`, `db.js` | Response helpers, service URL registry, and DynamoDB client wrapper |

---

### Adapters

| Component | Files | Description |
|------------|--------|-------------|
| Adapters | `adapters.js` | 6 data normalizers: profile, posts, businesses, complaints, courses, learning profile |

---

### Aggregation Layer

| Component | Files | Description |
|------------|--------|-------------|
| Aggregator | `aggregator.js` | Parallel HTTP calls to feature services (feature1/2) with error isolation |

---

### CSV Export

| Component | Files | Description |
|------------|--------|-------------|
| CSV | `csv-formatter.js` | Section-based CSV export with proper field escaping |

---

### Lambda Handler

| Component | Files | Description |
|------------|--------|-------------|
| Handler | `index.js` | Authentication, rate limiting, routing, and audit logging |

---

### Test Coverage

| Component | Files | Description |
|------------|--------|-------------|
| Tests | 4 test files | 46 tests covering all modules |

---

## API Endpoints

```http
GET /api/v1/export/{userId}                             → JSON export
GET /api/v1/export/{userId}?format=csv                  → CSV export
GET /api/v1/export/{userId}?services=profile,courses    → Selective export
GET /api/v1/export/audit                                → Export history
```