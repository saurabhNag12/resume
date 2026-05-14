import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// Vercel needs this to disable default body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) return reject(new Error("No boundary found"));

      const boundary = boundaryMatch[1];
      const bodyStr = buffer.toString("binary");
      const parts = bodyStr.split("--" + boundary).filter(p => p.trim() && p.trim() !== "--");

      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        const headers = part.substring(0, headerEnd);
        const body = part.substring(headerEnd + 4).replace(/\r\n$/, "");
        
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/i);
        
        if (filenameMatch) {
          return resolve({
            originalname: filenameMatch[1],
            mimetype: contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream",
            buffer: Buffer.from(body, "binary"),
          });
        }
      }
      reject(new Error("No file found in request"));
    });
    req.on("error", reject);
  });
}

async function extractText(buffer, mimetype) {
  if (mimetype === "application/pdf") {
    try {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const result = await parser.getText();
      await parser.destroy();
      if (Array.isArray(result)) return result.join("\n");
      return String(result || "");
    } catch (e) {
      return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }
  return buffer.toString("utf-8");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const file = await parseMultipart(req);
    const text = await extractText(file.buffer, file.mimetype);
    res.json({ text, filename: file.originalname });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}
