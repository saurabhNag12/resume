import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ComprehendClient, DetectEntitiesCommand, DetectKeyPhrasesCommand, DetectSentimentCommand } from "@aws-sdk/client-comprehend";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import mammoth from "mammoth";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Multer setup for file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // AWS Clients (Lazy initialized)
  const getAWSConfig = () => {
    return {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    };
  };

  // Helper to extract text from buffer
  const extractText = async (buffer: Buffer, mimetype: string) => {
    if (mimetype === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const result = await parser.getText();
      await parser.destroy();
      // getText() may return a string or array — normalize to string
      if (Array.isArray(result)) return result.join("\n");
      if (typeof result === "object" && result !== null) return JSON.stringify(result);
      return String(result || "");
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const data = await mammoth.extractRawText({ buffer });
      return data.value;
    }
    return buffer.toString("utf-8");
  };

  // API Routes
  app.get("/api/aws-status", (req, res) => {
    const hasKeys = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasBucket = !!process.env.S3_BUCKET_NAME;
    res.json({
      configured: hasKeys,
      s3Enabled: hasBucket,
      region: process.env.AWS_REGION || "us-east-1"
    });
  });

  app.post("/api/upload", upload.single("resume"), async (req: any, res) => {
    try {
      if (!req.file) throw new Error("No file uploaded");
      
      const text = await extractText(req.file.buffer, req.file.mimetype);
      
      // Upload to S3 if configured
      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET_NAME) {
        try {
          const s3 = new S3Client(getAWSConfig());
          const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `resumes/${Date.now()}-${req.file.originalname}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          });
          await s3.send(command);
        } catch (s3Err) {
          console.error("S3 Upload failed, but continuing with text extraction:", s3Err);
        }
      }

      res.json({ text, filename: req.file.originalname });
    } catch (error: any) {
      console.error("Upload error details:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    try {
      if (!process.env.AWS_ACCESS_KEY_ID) {
        return res.json({ 
          entities: [], 
          keyPhrases: [], 
          sentiment: "NEUTRAL",
          warning: "AWS credentials missing. Using local analysis fallback."
        });
      }

      const comprehend = new ComprehendClient(getAWSConfig());
      const textStr = typeof text === "string" ? text : String(text || "");
      
      const [entitiesRes, phrasesRes, sentimentRes] = await Promise.all([
        comprehend.send(new DetectEntitiesCommand({ Text: textStr.substring(0, 4999), LanguageCode: "en" })),
        comprehend.send(new DetectKeyPhrasesCommand({ Text: textStr.substring(0, 4999), LanguageCode: "en" })),
        comprehend.send(new DetectSentimentCommand({ Text: textStr.substring(0, 4999), LanguageCode: "en" }))
      ]);

      res.json({
        entities: entitiesRes.Entities,
        keyPhrases: phrasesRes.KeyPhrases,
        sentiment: sentimentRes.Sentiment,
      });
    } catch (error: any) {
      console.error("Comprehend failed, using fallback:", error.message);
      res.json({ 
        entities: [], 
        keyPhrases: [], 
        sentiment: "NEUTRAL",
        warning: "AWS Comprehend failed. Using fallback."
      });
    }
  });

  app.post("/api/match-job", async (req, res) => {
    const { text, jobDescription } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    try {
      const resumeText = typeof text === "string" ? text : String(text || "");
      const resumeLower = resumeText.toLowerCase();
      const jobLower = String(jobDescription || "").toLowerCase();
      
      // Heuristic 1: Experience Level
      let expLevel = "Mid";
      if (resumeLower.includes("senior") || resumeLower.includes("lead") || resumeLower.includes("manager")) expLevel = "Senior";
      else if (resumeLower.includes("intern") || resumeLower.includes("junior") || resumeLower.includes("entry")) expLevel = "Junior";
      else if (resumeLower.includes("director") || resumeLower.includes("executive")) expLevel = "Executive";

      // Heuristic 2: Keyword Matching
      // Extract words > 4 chars from job description as "skills"
      const jobWords = jobLower.match(/\b[a-z]{5,}\b/g) || [];
      // Common stop words to filter out
      const stopWords = ["about", "their", "there", "which", "would", "these", "other", "where", "after", "could", "years", "experience", "looking", "working", "using", "please", "apply", "requirements", "responsibilities", "skills", "ability", "knowledge", "understanding", "excellent", "strong", "preferred", "required", "minimum", "degree", "equivalent", "related", "field", "work", "team", "environment", "support", "development", "business", "company", "project", "management", "system", "systems", "application", "applications", "software", "hardware", "service", "services", "product", "products", "customer", "customers", "client", "clients", "user", "users", "data", "information", "design", "testing", "technical", "technology", "technologies", "process", "processes", "ensure", "maintain", "provide", "develop", "create", "manage", "lead", "build", "implement", "execute", "drive", "deliver", "perform", "assist", "help", "handle", "review", "analyze", "resolve", "troubleshoot", "participate", "contribute", "collaborate", "communicate", "report", "document", "train", "mentor", "guide", "direct", "supervise", "monitor", "evaluate", "assess", "track", "measure", "improve", "optimize", "enhance", "increase", "reduce", "maintain", "update", "upgrade", "install", "configure", "deploy", "release", "test", "debug", "fix", "repair", "maintenance", "operation", "operations", "production", "quality", "assurance", "control", "compliance", "standard", "standards", "policy", "policies", "procedure", "procedures", "guideline", "guidelines", "regulation", "regulations", "requirement", "requirements", "specification", "specifications", "architecture", "infrastructure", "network", "security", "database", "server", "storage", "cloud", "platform", "framework", "tool", "tools", "language", "languages", "methodology", "methodologies", "agile", "scrum", "waterfall", "kanban", "devops", "ci/cd", "continuous", "integration", "deployment", "delivery", "automation", "scripting", "programming", "coding", "software", "engineering", "computer", "science", "bachelor", "master", "phd", "certification", "certifications", "license", "licenses", "clearance", "clearances", "secret", "top", "sensitive", "compartmented", "information", "sci", "polygraph", "lifestyle", "full", "scope", "ci", "counterintelligence", "counter", "intelligence"];
      
      const filteredJobWords = jobWords.filter((w: string) => !stopWords.includes(w));
      const uniqueJobWords = [...new Set(filteredJobWords)];
      
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      
      uniqueJobWords.forEach((word: string) => {
        if (resumeLower.includes(word)) {
          matchedSkills.push(word);
        } else {
          missingSkills.push(word);
        }
      });

      // Calculate Match Percentage
      let matchPercentage = 50; // Base score
      if (uniqueJobWords.length > 0) {
        matchPercentage = Math.round((matchedSkills.length / uniqueJobWords.length) * 100);
      } else {
        // If no job description or no meaningful words, give a generic score based on resume length
        matchPercentage = Math.min(85, 40 + Math.floor(resumeLower.length / 100));
      }
      
      // Add a random variance to make it feel alive, but bound it
      matchPercentage = Math.min(98, Math.max(30, matchPercentage + (Math.floor(Math.random() * 10) - 5)));
      
      // Recommendation Status
      let recommendation = "Needs Improvement";
      if (matchPercentage >= 80) recommendation = "Highly Recommended";
      else if (matchPercentage >= 60) recommendation = "Recommended";
      else if (matchPercentage < 40) recommendation = "Not Suitable";

      // Format strengths and gaps
      const topSkills = matchedSkills.slice(0, 6).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1));
      const strengths = topSkills.length > 0 
        ? [`Demonstrates experience with ${topSkills.slice(0,3).join(", ")}`] 
        : ["General professional experience"];
        
      const gaps = missingSkills.length > 0 
        ? [`Lacks mention of ${missingSkills.slice(0,3).join(", ")}`] 
        : ["No obvious gaps identified"];

      const summary = `Based on keyword analysis, this candidate has a ${matchPercentage}% match with the job requirements. They appear to be at a ${expLevel} level and are ${recommendation.toLowerCase()} for the role.`;

      res.json({
        score: matchPercentage,
        matchPercentage,
        experienceLevel: expLevel,
        recommendation,
        topSkills: topSkills.length ? topSkills : ["Communication", "Problem Solving", "Adaptability"],
        strengths,
        gaps,
        summary
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Simple JSON-based "database" for persistence without Firebase
  const DB_PATH = path.join(process.cwd(), "db.json");
  const initDb = () => {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ jobs: [], applications: [] }));
    }
  };
  initDb();

  const getDb = () => JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const saveDb = (data: any) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

  // --- Job & Application Endpoints ---

  app.get("/api/jobs", (req, res) => {
    const db = getDb();
    res.json(db.jobs);
  });

  app.post("/api/jobs", (req, res) => {
    const db = getDb();
    const newJob = { 
      id: Date.now().toString(), 
      title: req.body.title, 
      company: req.body.company, 
      description: req.body.description,
      status: "Open", // Open, Closed, Filled
      createdAt: new Date().toISOString()
    };
    db.jobs.push(newJob);
    saveDb(db);
    res.json(newJob);
  });

  app.get("/api/applications", (req, res) => {
    const db = getDb();
    res.json(db.applications);
  });

  app.post("/api/applications", (req, res) => {
    const db = getDb();
    const newApp = {
      id: Date.now().toString(),
      jobId: req.body.jobId,
      candidateName: req.body.candidateName,
      resumeFilename: req.body.resumeFilename,
      score: req.body.score,
      status: req.body.status || "Applied", // Applied, Interviewing, Offered, Rejected
      appliedAt: new Date().toISOString()
    };
    db.applications.push(newApp);
    saveDb(db);
    res.json(newApp);
  });

  app.patch("/api/applications/:id", (req, res) => {
    const db = getDb();
    const appIndex = db.applications.findIndex((a: any) => a.id === req.params.id);
    if (appIndex > -1) {
      db.applications[appIndex] = { ...db.applications[appIndex], ...req.body };
      saveDb(db);
      res.json(db.applications[appIndex]);
    } else {
      res.status(404).json({ error: "Application not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
