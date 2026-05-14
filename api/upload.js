import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

async function extractText(buffer, mimetype) {
  if (mimetype === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    await parser.destroy();
    if (Array.isArray(result)) return result.join("\n");
    return String(result || "");
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }
  return buffer.toString("utf-8");
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await runMiddleware(req, res, upload.single("resume"));
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const text = await extractText(req.file.buffer, req.file.mimetype);

    // Upload to S3 if configured (non-blocking)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET_NAME) {
      try {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `resumes/${Date.now()}-${req.file.originalname}`,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }));
      } catch (s3Err) {
        console.error("S3 upload failed:", s3Err.message);
      }
    }

    res.json({ text, filename: req.file.originalname });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}
