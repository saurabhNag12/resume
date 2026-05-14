export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text, jobDescription } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const resumeText = typeof text === "string" ? text : String(text || "");
    const resumeLower = resumeText.toLowerCase();
    const jobLower = String(jobDescription || "").toLowerCase();

    // Experience Level
    let expLevel = "Mid";
    if (resumeLower.includes("senior") || resumeLower.includes("lead") || resumeLower.includes("manager")) expLevel = "Senior";
    else if (resumeLower.includes("intern") || resumeLower.includes("junior") || resumeLower.includes("entry")) expLevel = "Junior";
    else if (resumeLower.includes("director") || resumeLower.includes("executive")) expLevel = "Executive";

    // Keyword Matching
    const jobWords = jobLower.match(/\b[a-z]{5,}\b/g) || [];
    const stopWords = ["about","their","there","which","would","these","other","where","after","could","years","experience","looking","working","using","please","apply","requirements","responsibilities","skills","ability","knowledge","understanding","excellent","strong","preferred","required","minimum","degree","equivalent","related","field","should","every","between","through","during","before","being","those","because","while","since","having","given","within","across","along"];
    const filtered = [...new Set(jobWords.filter(w => !stopWords.includes(w)))];

    const matched = [];
    const missing = [];
    filtered.forEach(word => {
      if (resumeLower.includes(word)) matched.push(word);
      else missing.push(word);
    });

    let matchPct = 50;
    if (filtered.length > 0) {
      matchPct = Math.round((matched.length / filtered.length) * 100);
    } else {
      matchPct = Math.min(85, 40 + Math.floor(resumeLower.length / 100));
    }
    matchPct = Math.min(98, Math.max(30, matchPct + (Math.floor(Math.random() * 10) - 5)));

    let recommendation = "Needs Improvement";
    if (matchPct >= 80) recommendation = "Highly Recommended";
    else if (matchPct >= 60) recommendation = "Recommended";
    else if (matchPct < 40) recommendation = "Not Suitable";

    const topSkills = matched.slice(0, 6).map(s => s.charAt(0).toUpperCase() + s.slice(1));
    const strengths = topSkills.length > 0
      ? [`Demonstrates experience with ${topSkills.slice(0,3).join(", ")}`]
      : ["General professional experience"];
    const gaps = missing.length > 0
      ? [`Lacks mention of ${missing.slice(0,3).join(", ")}`]
      : ["No obvious gaps identified"];

    res.json({
      score: matchPct,
      matchPercentage: matchPct,
      experienceLevel: expLevel,
      recommendation,
      topSkills: topSkills.length ? topSkills : ["Communication", "Problem Solving", "Adaptability"],
      strengths,
      gaps,
      summary: `This candidate has a ${matchPct}% match with the job requirements. They appear to be at a ${expLevel} level and are ${recommendation.toLowerCase()} for the role.`
    });
  } catch (error) {
    console.error("Match-job error:", error);
    res.status(500).json({ error: error.message });
  }
}
