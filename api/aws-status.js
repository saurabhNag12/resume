export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const hasKeys = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const hasBucket = !!process.env.S3_BUCKET_NAME;
  res.json({
    configured: hasKeys,
    s3Enabled: hasBucket,
    region: process.env.AWS_REGION || "us-east-1"
  });
}
