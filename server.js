const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const AWS = require('aws-sdk');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Initialize AWS services
const comprehend = new AWS.Comprehend();
const s3 = new AWS.S3();

// Make AWS services available globally
global.AWS = {
  comprehend,
  s3,
  bucketName: process.env.S3_BUCKET_NAME
};

// Import routes
const analyzeRoutes = require('./routes/analyze');

// Use routes
app.use('/api', analyzeRoutes);

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Resume Analyzer API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from public directory`);
  console.log(`🤖 AWS Comprehend configured for region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`📦 S3 Bucket: ${process.env.S3_BUCKET_NAME || 'Not configured'}`);
});
