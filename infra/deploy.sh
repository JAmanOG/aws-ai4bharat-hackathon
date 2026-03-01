#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy.sh — Deploy or update the Rural Platform ECS stack
# Usage: ./infra/deploy.sh [dev|staging|prod]
###############################################################################

STAGE="${1:-dev}"
REGION="ap-south-1"
ACCOUNT_ID="111418871333"
STACK_NAME="rural-platform-ecs-${STAGE}"
ECR_REPO="rural-platform-backend"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

# ── Load .env ──
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

VPC_ID="${VPC_ID:-vpc-0caeb0d2ebe85e669}"
SUBNET_IDS="${SUBNET_IDS:-subnet-00102fd8f02546f3f,subnet-0de9101cc6a6f388f,subnet-0372f717ad5bf8f18}"

echo "═══════════════════════════════════════"
echo "  Rural Platform Deploy — ${STAGE}"
echo "═══════════════════════════════════════"

# ── 1. Build & push Docker image ──
echo "▸ Building Docker image..."
IMAGE_TAG="$(git rev-parse --short HEAD)-$(date +%s)"
IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ECR_URI}"

docker build -t "${IMAGE_URI}" -t "${ECR_URI}:latest" ./backend
docker push "${IMAGE_URI}"
docker push "${ECR_URI}:latest"
echo "✅ Pushed ${IMAGE_URI}"

# ── 2. Deploy CloudFormation ──
echo "▸ Deploying CloudFormation stack: ${STACK_NAME}..."
aws cloudformation deploy \
  --region "${REGION}" \
  --template-file infra/ecs.yaml \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    Stage="${STAGE}" \
    VpcId="${VPC_ID}" \
    SubnetIds="${SUBNET_IDS}" \
    ImageUri="${IMAGE_URI}" \
    CognitoUserPoolId="${COGNITO_USER_POOL_ID}" \
    CognitoAppClientId="${COGNITO_APP_CLIENT_ID}" \
    ContentBucket="${CONTENT_BUCKET}" \
    CommunityMediaBucket="${COMMUNITY_MEDIA_BUCKET}" \
    HealthImagingBucket="${HEALTH_IMAGING_BUCKET}" \
    PriceAlertSnsTopic="${PRICE_ALERT_SNS_TOPIC}" \
    FinancialNotificationsTopic="${FINANCIAL_NOTIFICATIONS_TOPIC_ARN}" \
    LearningNotificationsTopic="${LEARNING_NOTIFICATIONS_TOPIC_ARN}" \
    CommunityNotificationsTopic="${COMMUNITY_NOTIFICATIONS_TOPIC_ARN}" \
    DbHost="${DB_HOST:-}" \
    DbPassword="${DB_PASSWORD:-}"

# ── 3. Show outputs ──
echo ""
echo "═══════════════════════════════════════"
ALB_URL=$(aws cloudformation describe-stacks \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbUrl`].OutputValue' \
  --output text)
echo "  🚀 API URL: ${ALB_URL}"
echo "  📊 Cluster: rural-${STAGE}"
echo "  🏷️  Image:   ${IMAGE_URI}"
echo "═══════════════════════════════════════"

# ── 4. Wait for service stability ──
echo "▸ Waiting for service to stabilize..."
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text)
SERVICE_NAME=$(aws cloudformation describe-stacks \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceName`].OutputValue' \
  --output text)

aws ecs wait services-stable \
  --region "${REGION}" \
  --cluster "${CLUSTER_NAME}" \
  --services "${SERVICE_NAME}" 2>/dev/null && \
  echo "✅ Service is stable" || \
  echo "⚠️  Service may still be stabilizing — check ECS console"

echo ""
echo "▸ Health check: curl ${ALB_URL}/health"
