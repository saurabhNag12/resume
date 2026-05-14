# AI Resume Analyzer & Candidate Screening System

## Overview
A professional recruiter dashboard that leverages AI to screen candidates efficiently. 
Built for **SDG 8: Decent Work and Economic Growth**, this application reduces recruitment friction and objective bias using cloud-based NLP.

## Features
- **Smart Text Extraction**: Extracts data from PDF and DOCX files.
- **AWS Comprehend Integration**: Uses NLP to detect entities, key phrases, and sentiment.
- **Gemini AI Analysis**: Provides structured candidate evaluations, scoring, and matching for specific job descriptions.
- **Professional Dashboard**: Clean, responsive UI with metrics for scores, match percentage, and skills.
- **SDG 8 Focus**: Dedicated section highlighting the impact on employment and economic growth.

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express.js.
- **AI/ML**: AWS Comprehend, Google Gemini API.
- **Storage**: Amazon S3.

## Setup
1. Define your environment variables in `.env`:
   - `GEMINI_API_KEY`: For candidate analysis.
   - `AWS_ACCESS_KEY_ID`: For S3 and Comprehend.
   - `AWS_SECRET_ACCESS_KEY`: For S3 and Comprehend.
   - `AWS_REGION`: e.g., `us-east-1`.
   - `S3_BUCKET_NAME`: For resume storage.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

## SDG 8 Impact
This project supports Sustained, Inclusive and Sustainable Economic Growth, Full and Productive Employment and Decent Work for All by providing tools that make hiring more objective and faster, helping candidates find the right fit sooner.
