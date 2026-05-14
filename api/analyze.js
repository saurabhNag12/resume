import {
  ComprehendClient,
  DetectEntitiesCommand,
  DetectKeyPhrasesCommand,
  DetectSentimentCommand,
} from "@aws-sdk/client-comprehend";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  const textStr = typeof text === "string" ? text : String(text || "");

  try {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      return res.json({ 
        entities: [], keyPhrases: [], sentiment: "NEUTRAL",
        warning: "AWS keys not configured."
      });
    }

    const comprehend = new ComprehendClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

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
  } catch (error) {
    console.error("Comprehend failed:", error.message);
    res.json({ 
      entities: [], keyPhrases: [], sentiment: "NEUTRAL",
      warning: "AWS Comprehend failed. Using fallback."
    });
  }
}
