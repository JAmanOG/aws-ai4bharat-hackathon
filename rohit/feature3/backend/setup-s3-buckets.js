/**
 * Setup S3 buckets on LocalStack for medical imaging.
 * Run from feature3/backend: node setup-s3-buckets.js
 */
const { S3Client, CreateBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
  forcePathStyle: true,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

const BUCKETS = ['rural-health-imaging'];

async function main() {
  console.log('Creating S3 buckets on LocalStack...\n');

  try {
    const { Buckets } = await client.send(new ListBucketsCommand({}));
    const existingNames = Buckets ? Buckets.map(b => b.Name) : [];

    for (const bucket of BUCKETS) {
      if (existingNames.includes(bucket)) {
        console.log(`  ✅ ${bucket} — already exists`);
        continue;
      }
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`  ✅ ${bucket} — created`);
      } catch (err) {
        console.error(`  ❌ ${bucket} — ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`  ❌ Failed to connect to LocalStack: ${err.message}`);
    console.log(`  Tip: Ensure LocalStack is running at ${process.env.S3_ENDPOINT || 'http://localhost:4566'}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
