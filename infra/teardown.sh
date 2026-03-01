#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# teardown.sh — Destroy the ECS stack (keeps DynamoDB/S3/SNS/Cognito intact)
# Usage: ./infra/teardown.sh [dev|staging|prod]
###############################################################################

STAGE="${1:-dev}"
REGION="ap-south-1"
STACK_NAME="rural-platform-ecs-${STAGE}"

echo "⚠️  This will DELETE stack: ${STACK_NAME}"
echo "   (DynamoDB tables, S3 buckets, SNS topics, and Cognito are NOT affected)"
read -p "   Continue? [y/N] " -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo "▸ Deleting CloudFormation stack: ${STACK_NAME}..."
aws cloudformation delete-stack \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}"

echo "▸ Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete \
  --region "${REGION}" \
  --stack-name "${STACK_NAME}"

echo "✅ Stack ${STACK_NAME} deleted."
echo ""
echo "Remaining resources (managed by provision-aws.sh):"
echo "  • 18 DynamoDB tables"
echo "  • 3 S3 buckets"
echo "  • 4 SNS topics"
echo "  • 1 Cognito user pool"
echo ""
echo "To remove everything: see docs/aws-infrastructure.md cleanup section"
