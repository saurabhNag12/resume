# AWS Elastic Beanstalk Deployment Guide

This guide will help you deploy the AI Resume Analyzer & Candidate Screening System to AWS Elastic Beanstalk.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Node.js 18.x or higher installed locally
- Git installed (optional, for version control)

## Pre-Deployment Steps

### 1. Configure AWS CLI

If you haven't already, install and configure the AWS CLI:

```bash
# Install AWS CLI (if not already installed)
# On Windows: Download from https://aws.amazon.com/cli/

# Configure AWS CLI
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, default region (e.g., us-east-1), and default output format (json).

### 2. Install EB CLI

Install the Elastic Beanstalk Command Line Interface:

```bash
# On Windows (using PowerShell)
pip install awsebcli

# Or using chocolatey
choco install awsebcli
```

### 3. Prepare Your Application

Ensure your project structure includes:

```
ai-resume-analyzer/
├── .ebextensions/
│   └── nodejs.config
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── routes/
│   └── analyze.js
├── uploads/
├── .env (DO NOT commit this - use environment variables in EB)
├── package.json
├── Procfile
├── server.js
└── README.md
```

### 4. Create .gitignore

Create a `.gitignore` file to exclude sensitive files:

```gitignore
node_modules/
uploads/
.env
.DS_Store
*.log
```

## Deployment Methods

### Method 1: Using AWS Management Console (GUI)

#### Step 1: Create Application

1. Log in to AWS Management Console
2. Navigate to Elastic Beanstalk service
3. Click "Create Application"
4. Enter application name: `ai-resume-analyzer`
5. Click "Create"

#### Step 2: Create Environment

1. Click "Create environment"
2. Select "Web server environment"
3. Enter environment name: `AiResumeAnalyzer-env`
4. Select domain: `ai-resume-analyzer` (or your preferred domain)
5. Platform: Node.js
6. Platform branch: Node.js 18 running on 64bit Amazon Linux 2023
7. Click "Create environment"

#### Step 3: Upload Application Code

1. After environment is created, click "Upload and deploy"
2. Choose "Upload your code"
3. Click "Choose file" and select your project ZIP file
4. Click "Deploy"

#### Step 4: Configure Environment Variables

1. Go to Configuration → Software
2. Under "Environment properties", add the following:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: Your AWS region (e.g., us-east-1)
   - `S3_BUCKET_NAME`: Your S3 bucket name
   - `NODE_ENV`: production
   - `PORT`: 8081

#### Step 5: Update Security Group

1. Go to Configuration → Security
2. Click "Edit"
3. Ensure port 80 (HTTP) is open to 0.0.0.0/0
4. Ensure port 443 (HTTPS) is open if using SSL

#### Step 6: Access Your Application

After deployment completes, your application will be available at:
```
http://ai-resume-analyzer-env.eba-xxxxx.us-east-1.elasticbeanstalk.com
```

### Method 2: Using EB CLI (Command Line)

#### Step 1: Initialize EB CLI

```bash
cd ai-resume-analyzer
eb init
```

Follow the prompts:
- Select region: us-east-1 (or your preferred region)
- Select application: Create new application
- Enter application name: ai-resume-analyzer
- Select platform: Node.js
- Select platform branch: Node.js 18 running on 64bit Amazon Linux 2023
- Set up SSH: No (or Yes if needed)

#### Step 2: Create Environment

```bash
eb create production
```

Follow the prompts:
- Enter environment name: AiResumeAnalyzer-env
- Enter DNS CNAME prefix: ai-resume-analyzer
- Select load balancer type: application
- Choose instance type: t2.micro (Free Tier eligible)

#### Step 3: Set Environment Variables

```bash
eb setenv AWS_ACCESS_KEY_ID=your_access_key
eb setenv AWS_SECRET_ACCESS_KEY=your_secret_key
eb setenv AWS_REGION=us-east-1
eb setenv S3_BUCKET_NAME=your_bucket_name
eb setenv NODE_ENV=production
eb setenv PORT=8081
```

#### Step 4: Deploy

```bash
eb deploy
```

#### Step 5: Open Application

```bash
eb open
```

This will open your deployed application in a browser.

### Method 3: Using AWS CLI

#### Step 1: Create Application Bundle

```bash
cd ai-resume-analyzer
zip -r ai-resume-analyzer.zip . -x "*.git*" "node_modules/*" "uploads/*" ".env"
```

#### Step 2: Create S3 Bucket for Application Storage

```bash
aws s3 mb s3://ai-resume-analyzer-deployments
```

#### Step 3: Upload Application Bundle

```bash
aws s3 cp ai-resume-analyzer.zip s3://ai-resume-analyzer-deployments/
```

#### Step 4: Create Elastic Beanstalk Application

```bash
aws elasticbeanstalk create-application \
  --application-name ai-resume-analyzer \
  --description "AI Resume Analyzer & Candidate Screening System"
```

#### Step 5: Create Application Version

```bash
aws elasticbeanstalk create-application-version \
  --application-name ai-resume-analyzer \
  --version-label v1 \
  --source-bundle S3Bucket="ai-resume-analyzer-deployments",S3Key="ai-resume-analyzer.zip"
```

#### Step 6: Create Environment

```bash
aws elasticbeanstalk create-environment \
  --application-name ai-resume-analyzer \
  --environment-name AiResumeAnalyzer-env \
  --version-label v1 \
  --solution-stack-name "64bit Amazon Linux 2023 v5.9.0 running Node.js 18" \
  --option-settings Namespace=aws:elasticbeanstalk:container:nodejs,OptionName=NodeCommand,Value="npm start" \
  --option-settings Namespace=aws:elasticbeanstalk:container:nodejs,OptionName=NodeVersion,Value="18.x" \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=production \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8081
```

#### Step 7: Set Environment Variables

```bash
aws elasticbeanstalk update-environment \
  --environment-name AiResumeAnalyzer-env \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_ACCESS_KEY_ID,Value="your_access_key" \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_SECRET_ACCESS_KEY,Value="your_secret_key" \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_REGION,Value="us-east-1" \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=S3_BUCKET_NAME,Value="your_bucket_name"
```

## Post-Deployment Configuration

### 1. Configure S3 Bucket

Create an S3 bucket for storing uploaded resumes:

```bash
aws s3 mb s3://ai-resume-analyzer-resumes
```

Update your environment variable:
```bash
eb setenv S3_BUCKET_NAME=ai-resume-analyzer-resumes
```

### 2. Configure IAM Role

Ensure your EC2 instances have the necessary IAM permissions:

1. Go to IAM Console
2. Create a new role: `aws-elasticbeanstalk-ec2-role`
3. Attach the following policies:
   - `AmazonS3FullAccess` (or restrict to specific bucket)
   - `ComprehendFullAccess` (or restrict to specific actions)
4. Update your Elastic Beanstalk environment to use this role

### 3. Enable HTTPS (Optional but Recommended)

1. Purchase or use a free SSL certificate from AWS Certificate Manager
2. Go to Elastic Beanstalk → Configuration → Security
3. Add your certificate
4. Enable HTTPS on port 443

### 4. Set Up Custom Domain (Optional)

1. Purchase a domain from Route 53 or other registrar
2. Go to Elastic Beanstalk → Configuration → Domain
3. Add your custom domain
4. Configure DNS records

## Monitoring and Logs

### View Application Logs

Using EB CLI:
```bash
eb logs --all
```

Or download specific logs:
```bash
eb logs
```

### Monitor Health

Using EB CLI:
```bash
eb health
```

Or view in AWS Console:
- Go to Elastic Beanstalk → Your Environment → Health

### SSH into Instance (if enabled)

```bash
eb ssh
```

## Scaling Configuration

### Horizontal Scaling

1. Go to Configuration → Capacity
2. Set minimum and maximum instances
3. Choose scaling triggers (CPU, network, etc.)

### Vertical Scaling

1. Go to Configuration → Instances
2. Change instance type (e.g., t2.small, t2.medium)

## Troubleshooting

### Deployment Fails

1. Check event logs in AWS Console
2. Verify all dependencies are in package.json
3. Ensure Node.js version is compatible
4. Check for syntax errors in code

### Application Not Accessible

1. Check security group rules
2. Verify environment variables are set correctly
3. Check application health status
4. Review application logs

### AWS Credentials Error

1. Verify IAM role has correct permissions
2. Check environment variables are set
3. Ensure credentials are valid and not expired

### File Upload Issues

1. Verify S3 bucket permissions
2. Check S3 bucket name in environment variables
3. Ensure IAM role has S3 write permissions

## Cost Optimization

### Free Tier

- Use t2.micro instances (eligible for Free Tier)
- Monitor usage to stay within free tier limits
- Delete environment when not in use

### Cost Saving Tips

1. Use Spot Instances for non-critical workloads
2. Enable auto-scaling to reduce idle instances
3. Use CloudFront for CDN
4. Monitor costs using AWS Cost Explorer

## Updating Your Application

### Using EB CLI

```bash
# Make changes to your code
eb deploy
```

### Using AWS Console

1. Go to Elastic Beanstalk → Your Environment
2. Click "Upload and deploy"
3. Upload new version
4. Click "Deploy"

## Deleting the Environment

### Using EB CLI

```bash
eb terminate
```

### Using AWS Console

1. Go to Elastic Beanstalk → Your Environment
2. Click Actions → Terminate environment

### Clean Up Resources

```bash
# Delete S3 buckets
aws s3 rb s3://ai-resume-analyzer-resumes --force
aws s3 rb s3://ai-resume-analyzer-deployments --force

# Delete application
aws elasticbeanstalk delete-application --application-name ai-resume-analyzer
```

## Security Best Practices

1. **Never commit .env file** - Use environment variables
2. **Use IAM roles** instead of hardcoded credentials
3. **Enable HTTPS** for production deployments
4. **Restrict S3 bucket access** to specific IAM roles
5. **Enable VPC** for network isolation
6. **Regularly update dependencies** for security patches
7. **Monitor logs** for suspicious activity
8. **Use AWS WAF** for additional security layer

## Performance Optimization

1. **Enable compression** in nginx configuration
2. **Use CloudFront CDN** for static assets
3. **Implement caching** for frequently accessed data
4. **Use RDS** instead of local storage for persistent data
5. **Enable auto-scaling** for high traffic periods

## Backup and Recovery

1. **Regularly backup S3 buckets** using versioning
2. **Create snapshots** of any attached EBS volumes
3. **Use CloudWatch** for monitoring and alerts
4. **Implement disaster recovery plan** with multi-region deployment

## Support and Resources

- [AWS Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [EB CLI Documentation](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html)
- [AWS Node.js Platform Guide](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/nodejs-platform.html)
- [AWS Free Tier](https://aws.amazon.com/free/)

---

**Note**: This deployment guide assumes you have basic knowledge of AWS services. For production deployments, consider implementing additional security measures, monitoring, and backup strategies.
