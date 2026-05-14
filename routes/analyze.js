const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

// Extract text from uploaded file
async function extractText(filePath, fileType) {
  try {
    if (fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error('Failed to extract text from file');
  }
}

// Upload endpoint
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    
    // Extract text from the file
    const text = await extractText(filePath, fileType);

    // Upload to S3 if configured
    let s3Url = null;
    if (global.AWS.bucketName) {
      const fileContent = fs.readFileSync(filePath);
      const s3Key = `resumes/${req.file.filename}`;
      
      const params = {
        Bucket: global.AWS.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: req.file.mimetype
      };

      try {
        const s3Result = await global.AWS.s3.upload(params).promise();
        s3Url = s3Result.Location;
      } catch (s3Error) {
        console.error('S3 upload error:', s3Error);
        // Continue without S3 if upload fails
      }
    }

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      text: text,
      s3Url: s3Url,
      fileType: fileType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze endpoint using AWS Comprehend
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided for analysis' });
    }

    // Truncate text if too long (Comprehend has limits)
    const maxLength = 5000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // Run Comprehend analyses in parallel
    const [entitiesResult, keyPhrasesResult, sentimentResult, languageResult] = await Promise.all([
      global.AWS.comprehend.detectEntities({ Text: truncatedText, LanguageCode: 'en' }).promise(),
      global.AWS.comprehend.detectKeyPhrases({ Text: truncatedText, LanguageCode: 'en' }).promise(),
      global.AWS.comprehend.detectSentiment({ Text: truncatedText, LanguageCode: 'en' }).promise(),
      global.AWS.comprehend.detectDominantLanguage({ Text: truncatedText }).promise()
    ]);

    // Process entities
    const entities = entitiesResult.Entities.map(entity => ({
      text: entity.Text,
      type: entity.Type,
      score: entity.Score
    }));

    // Process key phrases
    const keyPhrases = keyPhrasesResult.KeyPhrases.map(phrase => ({
      text: phrase.Text,
      score: phrase.Score
    }));

    // Process sentiment
    const sentiment = {
      sentiment: sentimentResult.Sentiment,
      sentimentScores: sentimentResult.SentimentScore
    };

    // Process language
    const language = languageResult.Languages[0];

    // Extract specific information
    const skills = entities.filter(e => e.type === 'TITLE' || e.type === 'ORGANIZATION').map(e => e.text);
    const organizations = entities.filter(e => e.type === 'ORGANIZATION').map(e => e.text);
    const dates = entities.filter(e => e.type === 'DATE').map(e => e.text);

    // Calculate resume score
    let score = 60; // Base score
    score += Math.min(entities.length * 2, 20); // Up to 20 points for entities
    score += Math.min(keyPhrases.length * 2, 15); // Up to 15 points for key phrases
    
    // Normalize score to 0-100
    score = Math.min(Math.max(score, 0), 100);

    // Determine recommendation
    let recommendation = 'Needs Improvement';
    if (score >= 80) recommendation = 'Highly Recommended';
    else if (score >= 60) recommendation = 'Recommended';

    res.json({
      success: true,
      analysis: {
        entities,
        keyPhrases,
        sentiment,
        language,
        skills: skills.slice(0, 10),
        organizations: organizations.slice(0, 10),
        dates: dates.slice(0, 5),
        score: Math.round(score),
        recommendation
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Match job endpoint
router.post('/match-job', async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    
    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: 'Resume text and job description are required' });
    }

    // Extract key phrases from both
    const maxLength = 5000;
    const truncatedResume = resumeText.length > maxLength ? resumeText.substring(0, maxLength) : resumeText;
    const truncatedJob = jobDescription.length > maxLength ? jobDescription.substring(0, maxLength) : jobDescription;

    const [resumeKeyPhrases, jobKeyPhrases] = await Promise.all([
      global.AWS.comprehend.detectKeyPhrases({ Text: truncatedResume, LanguageCode: 'en' }).promise(),
      global.AWS.comprehend.detectKeyPhrases({ Text: truncatedJob, LanguageCode: 'en' }).promise()
    ]);

    const resumeKeywords = resumeKeyPhrases.KeyPhrases.map(kp => kp.Text.toLowerCase());
    const jobKeywords = jobKeyPhrases.KeyPhrases.map(kp => kp.Text.toLowerCase());

    // Calculate match percentage
    let matches = 0;
    const matchedSkills = [];
    
    jobKeywords.forEach(keyword => {
      if (resumeKeywords.some(rk => rk.includes(keyword) || keyword.includes(rk))) {
        matches++;
        if (!matchedSkills.includes(keyword)) {
          matchedSkills.push(keyword);
        }
      }
    });

    const matchPercentage = jobKeywords.length > 0 ? Math.round((matches / jobKeywords.length) * 100) : 0;

    // Determine experience level based on resume content
    let experienceLevel = 'Entry Level';
    const yearMatches = truncatedResume.match(/\d+\s*(years?|yrs?)\s*(of\s*)?(experience)?/gi);
    if (yearMatches) {
      const years = yearMatches.map(match => parseInt(match.match(/\d+/)[0]));
      const maxYears = Math.max(...years);
      if (maxYears >= 10) experienceLevel = 'Senior Level';
      else if (maxYears >= 5) experienceLevel = 'Mid Level';
      else if (maxYears >= 2) experienceLevel = 'Junior Level';
    }

    // Calculate overall score based on match
    const overallScore = Math.round(matchPercentage * 0.7 + (matchedSkills.length * 5));

    res.json({
      success: true,
      match: {
        matchPercentage,
        matchedSkills: matchedSkills.slice(0, 10),
        missingSkills: jobKeywords.filter(kw => !matchedSkills.includes(kw)).slice(0, 10),
        experienceLevel,
        overallScore: Math.min(overallScore, 100)
      }
    });
  } catch (error) {
    console.error('Job match error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
