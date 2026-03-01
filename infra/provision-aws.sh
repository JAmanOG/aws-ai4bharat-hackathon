#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Rural Ecosystem Platform — Unified AWS Resource Provisioner
#  Creates ALL shared infrastructure for Reqs 5-11 in one shot.
#
#  Usage:  bash infra/provision-aws.sh          (defaults to dev)
#          STAGE=prod bash infra/provision-aws.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
ACCT=$(aws sts get-caller-identity --query Account --output text)

echo "═══════════════════════════════════════════════════════════"
echo " Provisioning Rural Platform  |  Stage: $STAGE  Region: $REGION  Account: $ACCT"
echo "═══════════════════════════════════════════════════════════"

# ─── helper: idempotent DynamoDB table creation ───
create_table() {
  local name="$1"; shift
  if aws dynamodb describe-table --table-name "$name" --region "$REGION" &>/dev/null; then
    echo "  ✓ $name (exists)"
  else
    aws dynamodb create-table --table-name "$name" --region "$REGION" \
      --billing-mode PAY_PER_REQUEST "$@" --no-cli-pager
    echo "  + $name (created)"
  fi
}

# ─── helper: idempotent S3 bucket creation ───
create_bucket() {
  local name="$1"
  if aws s3api head-bucket --bucket "$name" --region "$REGION" 2>/dev/null; then
    echo "  ✓ s3://$name (exists)"
  else
    aws s3api create-bucket --bucket "$name" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" --no-cli-pager
    # Enable CORS
    aws s3api put-bucket-cors --bucket "$name" --cors-configuration '{
      "CORSRules": [{"AllowedHeaders":["*"],"AllowedMethods":["GET","PUT"],"AllowedOrigins":["*"],"MaxAgeSeconds":3600}]
    }' --no-cli-pager
    echo "  + s3://$name (created)"
  fi
}

# ─── helper: idempotent SNS topic ───
create_topic() {
  local name="$1"
  ARN=$(aws sns create-topic --name "$name" --region "$REGION" --query TopicArn --output text --no-cli-pager)
  echo "  ✓ $name → $ARN"
}

# ═══════════════════════════════════════════════════════════════
#  1. DynamoDB Tables  (18 total — Reqs 5-11)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "▸ DynamoDB Tables"

# ── Req 5-8: Knowledge / Agriculture / Economics (infra/template.yaml) ──
create_table "UserLearningProfile-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"}]'

create_table "PeerGroups-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"groupId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"groupId","KeyType":"HASH"}]'

create_table "LearningRecommendations-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"generatedAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"generatedAt","KeyType":"RANGE"}]'

create_table "ContentInteractions-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"interactionId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"interactionId","KeyType":"RANGE"}]'

create_table "FarmerProfiles-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"farmerId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"farmerId","KeyType":"HASH"}]'

create_table "PriceAlerts-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"alertId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"alertId","KeyType":"RANGE"}]'

create_table "PriceWatch-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"cropType","AttributeType":"S"},{"AttributeName":"timestamp","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"cropType","KeyType":"HASH"},{"AttributeName":"timestamp","KeyType":"RANGE"}]'

create_table "FarmPracticeLogs-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"loggedAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"loggedAt","KeyType":"RANGE"}]'

create_table "EconomicProfiles-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"}]'

create_table "InsuranceClaims-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"claimId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"claimId","KeyType":"RANGE"}]'

create_table "FinancialNudges-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"generatedAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"generatedAt","KeyType":"RANGE"}]'

# ── Req 11: Open Data Export (rohit/feature1) ──
create_table "ExportAudit-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"exportedAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"exportedAt","KeyType":"RANGE"}]'

# ── Req 10: Community Platform (rohit/feature2) ──
create_table "VoiceRooms-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"roomId","AttributeType":"S"},{"AttributeName":"status","AttributeType":"S"},{"AttributeName":"createdAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"roomId","KeyType":"HASH"}]' \
  --global-secondary-indexes '[{"IndexName":"ByStatus","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

create_table "VoiceRoomParticipants-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"roomId","AttributeType":"S"},{"AttributeName":"userId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"roomId","KeyType":"HASH"},{"AttributeName":"userId","KeyType":"RANGE"}]'

create_table "ChatMessages-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"roomId","AttributeType":"S"},{"AttributeName":"messageId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"roomId","KeyType":"HASH"},{"AttributeName":"messageId","KeyType":"RANGE"}]'

create_table "WebSocketConnections-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"connectionId","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"connectionId","KeyType":"HASH"}]'

# ── Req 9: Health Services (rohit/feature3) ──
create_table "HealthArticles-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"articleId","AttributeType":"S"},{"AttributeName":"topic","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"articleId","KeyType":"HASH"}]' \
  --global-secondary-indexes '[{"IndexName":"ByTopic","KeySchema":[{"AttributeName":"topic","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]'

create_table "SymptomLogs-${STAGE}" \
  --attribute-definitions '[{"AttributeName":"userId","AttributeType":"S"},{"AttributeName":"checkedAt","AttributeType":"S"}]' \
  --key-schema '[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"checkedAt","KeyType":"RANGE"}]'

# ─── Enable TTL on tables that need it ───
echo ""
echo "▸ Enabling TTL"
for TBL in "LearningRecommendations-${STAGE}" "PriceWatch-${STAGE}" "ExportAudit-${STAGE}" \
           "WebSocketConnections-${STAGE}" "HealthArticles-${STAGE}" "SymptomLogs-${STAGE}"; do
  aws dynamodb update-time-to-live --table-name "$TBL" --region "$REGION" \
    --time-to-live-specification Enabled=true,AttributeName=ttl --no-cli-pager 2>/dev/null \
    && echo "  ✓ TTL on $TBL" || echo "  ✓ TTL on $TBL (already set)"
done

# ═══════════════════════════════════════════════════════════════
#  2. S3 Buckets  (3)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "▸ S3 Buckets"
create_bucket "rural-platform-content-${STAGE}-${ACCT}"
create_bucket "rural-community-media-${STAGE}-${ACCT}"
create_bucket "rural-health-imaging-${STAGE}-${ACCT}"

# lifecycle rule: expire imaging uploads after 30 days
aws s3api put-bucket-lifecycle-configuration --bucket "rural-health-imaging-${STAGE}-${ACCT}" \
  --lifecycle-configuration '{
    "Rules":[{"ID":"ExpireUploads","Status":"Enabled","Expiration":{"Days":30},"Filter":{"Prefix":""}}]
  }' --no-cli-pager 2>/dev/null && echo "  ✓ Imaging lifecycle rule set"

# ═══════════════════════════════════════════════════════════════
#  3. SNS Topics  (4)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "▸ SNS Topics"
create_topic "rural-learning-notifications-${STAGE}"
create_topic "rural-price-alerts-${STAGE}"
create_topic "rural-financial-notifications-${STAGE}"
create_topic "rural-community-notifications-${STAGE}"

# ═══════════════════════════════════════════════════════════════
#  4. Cognito User Pool  (1 shared)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "▸ Cognito User Pool"
POOL_NAME="rural-platform-users-${STAGE}"
EXISTING_POOL=$(aws cognito-idp list-user-pools --max-results 20 --region "$REGION" \
  --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text --no-cli-pager 2>/dev/null)

if [ "$EXISTING_POOL" != "None" ] && [ -n "$EXISTING_POOL" ]; then
  POOL_ID="$EXISTING_POOL"
  echo "  ✓ $POOL_NAME (exists: $POOL_ID)"
else
  POOL_ID=$(aws cognito-idp create-user-pool --pool-name "$POOL_NAME" --region "$REGION" \
    --auto-verified-attributes phone_number \
    --username-attributes phone_number \
    --mfa-configuration OFF \
    --schema '[{"Name":"phone_number","Required":true,"Mutable":true},{"Name":"name","Required":false,"Mutable":true}]' \
    --query UserPool.Id --output text --no-cli-pager)
  echo "  + $POOL_NAME (created: $POOL_ID)"
fi

# App client
CLIENT_NAME="rural-platform-app-${STAGE}"
EXISTING_CLIENT=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$REGION" \
  --query "UserPoolClients[?ClientName=='${CLIENT_NAME}'].ClientId | [0]" --output text --no-cli-pager 2>/dev/null)

if [ "$EXISTING_CLIENT" != "None" ] && [ -n "$EXISTING_CLIENT" ]; then
  CLIENT_ID="$EXISTING_CLIENT"
  echo "  ✓ $CLIENT_NAME (exists: $CLIENT_ID)"
else
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" --client-name "$CLIENT_NAME" --region "$REGION" \
    --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --no-generate-secret \
    --query UserPoolClient.ClientId --output text --no-cli-pager)
  echo "  + $CLIENT_NAME (created: $CLIENT_ID)"
fi

# ═══════════════════════════════════════════════════════════════
#  5. Write .env with all resource references
# ═══════════════════════════════════════════════════════════════
echo ""
echo "▸ Writing .env"

PRICE_ALERTS_ARN=$(aws sns list-topics --region "$REGION" \
  --query "Topics[?contains(TopicArn,'rural-price-alerts-${STAGE}')].TopicArn | [0]" --output text --no-cli-pager)
FINANCIAL_ARN=$(aws sns list-topics --region "$REGION" \
  --query "Topics[?contains(TopicArn,'rural-financial-notifications-${STAGE}')].TopicArn | [0]" --output text --no-cli-pager)

cat > "$(dirname "$0")/../.env" <<EOF
# ─── Generated by provision-aws.sh (${STAGE}) ───
AWS_REGION=${REGION}
STAGE=${STAGE}

# Cognito
COGNITO_USER_POOL_ID=${POOL_ID}
COGNITO_APP_CLIENT_ID=${CLIENT_ID}

# S3
CONTENT_BUCKET=rural-platform-content-${STAGE}-${ACCT}
COMMUNITY_MEDIA_BUCKET=rural-community-media-${STAGE}-${ACCT}
HEALTH_IMAGING_BUCKET=rural-health-imaging-${STAGE}-${ACCT}

# SNS
PRICE_ALERT_SNS_TOPIC=${PRICE_ALERTS_ARN}
FINANCIAL_NOTIFICATIONS_TOPIC_ARN=${FINANCIAL_ARN}

# DynamoDB (table names)
USER_LEARNING_PROFILE_TABLE=UserLearningProfile-${STAGE}
PEER_GROUPS_TABLE=PeerGroups-${STAGE}
LEARNING_RECOMMENDATIONS_TABLE=LearningRecommendations-${STAGE}
CONTENT_INTERACTIONS_TABLE=ContentInteractions-${STAGE}
FARMER_PROFILES_TABLE=FarmerProfiles-${STAGE}
PRICE_ALERTS_TABLE=PriceAlerts-${STAGE}
PRICE_WATCH_TABLE=PriceWatch-${STAGE}
FARM_PRACTICE_LOGS_TABLE=FarmPracticeLogs-${STAGE}
ECONOMIC_PROFILES_TABLE=EconomicProfiles-${STAGE}
INSURANCE_CLAIMS_TABLE=InsuranceClaims-${STAGE}
FINANCIAL_NUDGES_TABLE=FinancialNudges-${STAGE}
EXPORT_AUDIT_TABLE=ExportAudit-${STAGE}
VOICE_ROOMS_TABLE=VoiceRooms-${STAGE}
VOICE_ROOM_PARTICIPANTS_TABLE=VoiceRoomParticipants-${STAGE}
CHAT_MESSAGES_TABLE=ChatMessages-${STAGE}
WEBSOCKET_CONNECTIONS_TABLE=WebSocketConnections-${STAGE}
HEALTH_ARTICLES_TABLE=HealthArticles-${STAGE}
SYMPTOM_LOGS_TABLE=SymptomLogs-${STAGE}

# AI
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
DIGILOCKER_USE_MOCK=true
EOF

echo "  ✓ .env written"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Done! Resources provisioned:"
echo "   • 18 DynamoDB tables"
echo "   • 3 S3 buckets"
echo "   • 4 SNS topics"
echo "   • 1 Cognito user pool + app client"
echo ""
echo " .env written to project root."
echo " Next: start your backend with 'docker compose up -d'"
echo "═══════════════════════════════════════════════════════════"
