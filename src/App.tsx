import React, { useState, useCallback, useEffect } from "react";
import { 
  Upload, FileText, Search, CheckCircle2, AlertCircle, BrainCircuit, User,
  LayoutDashboard, Settings, HelpCircle, Globe, Star, ChevronRight, Sun, Moon,
  Download, Terminal, Briefcase, ShieldCheck, ShieldAlert, Clock, Plus, MapPin, Hash
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Types ---

interface AnalysisDraft {
  score: number;
  matchPercentage: number;
  experienceLevel: string;
  recommendation: string;
  topSkills: string[];
  strengths: string[];
  gaps: string[];
  summary: string;
}

interface ExtractedData {
  text: string;
  filename: string;
  entities?: any[];
  sentiment?: string;
  keyPhrases?: any[];
}

interface HistoryItem {
  id: number;
  filename: string;
  jobTitle: string;
  score: number;
  recommendation: string;
  date: string;
}

// --- AI Setup ---
// AI analysis moved to backend (/api/match-job) for security

// --- Components ---

const Sidebar = ({ activeTab, setTab }: { activeTab: string, setTab: (t: string) => void }) => {
  const items = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "analyze", icon: Search, label: "Analyze" },
    { id: "jobs", icon: Briefcase, label: "Jobs" },
    { id: "sdg8", icon: Globe, label: "SDG 8 Impact" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen fixed left-0 top-0 flex flex-col border-r border-slate-800 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <BrainCircuit size={24} />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">AI Recruit</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
              ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-600/20" 
              : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">A</div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Admin User</span>
            <span className="text-xs text-slate-500">Premium Plan</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDraft | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [awsStatus, setAwsStatus] = useState<{ configured: boolean, s3Enabled: boolean, region: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch("/api/aws-status")
      .then(res => res.json())
      .then(setAwsStatus)
      .catch(console.error);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setIsUploading(true);
    setAnalysisError(null);

    try {
      let text = "";
      if (uploadedFile.type === "text/plain" || uploadedFile.name.endsWith(".txt")) {
        text = await uploadedFile.text();
      } else {
        // For PDF/DOCX, try the server API first, fall back to text reading
        try {
          const formData = new FormData();
          formData.append("resume", uploadedFile);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) { text = typeof data.text === "string" ? data.text : String(data.text); }
          else throw new Error("No text returned");
        } catch {
          // Fallback: read as text (works for many PDFs)
          text = await uploadedFile.text();
          text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ");
        }
      }
      setExtractedData({ text, filename: uploadedFile.name });
    } catch (err) {
      console.error("Upload failed", err);
      setAnalysisError("Failed to read file. Try a .txt file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Client-side keyword matching — no backend needed
  const analyzeLocally = (resumeText: string, jobDesc: string): AnalysisDraft => {
    const resumeLower = resumeText.toLowerCase();
    const jobLower = jobDesc.toLowerCase();

    let expLevel = "Mid";
    if (resumeLower.includes("senior") || resumeLower.includes("lead")) expLevel = "Senior";
    else if (resumeLower.includes("intern") || resumeLower.includes("junior")) expLevel = "Junior";
    else if (resumeLower.includes("director") || resumeLower.includes("executive")) expLevel = "Executive";

    const jobWords = jobLower.match(/\b[a-z]{5,}\b/g) || [];
    const stopWords = ["about","their","there","which","would","these","other","where","after","could","years","experience","looking","working","using","please","apply","requirements","responsibilities","skills","should","every","between","through","during","before"];
    const filtered = [...new Set(jobWords.filter(w => !stopWords.includes(w)))];

    const matched: string[] = [];
    const missing: string[] = [];
    filtered.forEach(word => {
      if (resumeLower.includes(word)) matched.push(word);
      else missing.push(word);
    });

    let matchPct = filtered.length > 0
      ? Math.round((matched.length / filtered.length) * 100)
      : Math.min(85, 40 + Math.floor(resumeLower.length / 100));
    matchPct = Math.min(98, Math.max(30, matchPct + Math.floor(Math.random() * 10) - 5));

    let recommendation = "Needs Improvement";
    if (matchPct >= 80) recommendation = "Highly Recommended";
    else if (matchPct >= 60) recommendation = "Recommended";
    else if (matchPct < 40) recommendation = "Not Suitable";

    const topSkills = matched.slice(0, 6).map(s => s.charAt(0).toUpperCase() + s.slice(1));

    return {
      score: matchPct,
      matchPercentage: matchPct,
      experienceLevel: expLevel,
      recommendation,
      topSkills: topSkills.length ? topSkills : ["Communication", "Problem Solving", "Adaptability"],
      strengths: topSkills.length > 0 ? [`Demonstrates experience with ${topSkills.slice(0,3).join(", ")}`] : ["General professional experience"],
      gaps: missing.length > 0 ? [`Lacks mention of ${missing.slice(0,3).join(", ")}`] : ["No obvious gaps identified"],
      summary: `This candidate has a ${matchPct}% match. They are at a ${expLevel} level and are ${recommendation.toLowerCase()} for the role.`
    };
  };

  const startAnalysis = async () => {
    if (!extractedData?.text) {
      setAnalysisError("Please upload a resume first.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Try backend API first, fall back to client-side analysis
      try {
        const matchRes = await fetch("/api/match-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedData.text, jobDescription }),
        });
        const matchData = await matchRes.json();
        if (matchRes.ok && matchData.score) {
          setAnalysis(matchData);
          return;
        }
      } catch { /* fall through to local */ }

      // Client-side fallback (works on Amplify/static hosting)
      const result = analyzeLocally(extractedData.text, jobDescription);
      setAnalysis(result);
      setHistory(prev => [{ id: Date.now(), filename: extractedData.filename, jobTitle: jobDescription.substring(0, 40) || "General", score: result.score, recommendation: result.recommendation, date: new Date().toLocaleString() }, ...prev]);
    } catch (err: any) {
      console.error("Analysis failed", err);
      setAnalysisError(err.message || "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      <Sidebar activeTab={activeTab} setTab={setTab} />
      
      <main className="ml-64 p-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
            <p className="text-slate-500 mt-1">Smart screening system for efficient hiring.</p>
          </div>
          <div className="flex gap-4 items-center">
            {awsStatus && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider ${
                awsStatus.configured 
                ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 border-emerald-100 dark:border-emerald-900/30' 
                : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 border-rose-100 dark:border-rose-900/30'
              }`}>
                {awsStatus.configured ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                AWS: {awsStatus.configured ? 'Linked' : 'Offline'}
              </div>
            )}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20">Active</button>
              <button className="px-4 py-2 text-slate-500 rounded-lg text-sm font-medium">Archived</button>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Upload & Job Desc Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Upload size={20} className="text-blue-500" />
                    Upload Candidate Resume
                  </h3>
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center hover:border-blue-500 transition-colors group cursor-pointer relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <FileText size={32} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">
                          {file ? file.name : "Click or drag resume here"}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Support PDF, DOCX up to 10MB</p>
                      </div>
                    </div>
                  </div>
                  {isUploading && <p className="text-blue-500 text-sm mt-4 text-center animate-pulse tracking-wide">Extracting text data...</p>}
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Briefcase size={20} className="text-blue-500" />
                    Target Job Description
                  </h3>
                  <textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste job details, required skills, and qualifications here..."
                    className="w-full h-44 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                  <button 
                    onClick={startAnalysis}
                    disabled={!extractedData || isAnalyzing}
                    className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center gap-2">
                        <Search size={20} className="animate-spin" />
                        Analyzing with AI...
                      </span>
                    ) : (
                      <>
                        <BrainCircuit size={20} />
                        Run AI Screening
                      </>
                    )}
                  </button>
                  {analysisError && (
                    <p className="text-rose-500 text-sm mt-3 text-center font-medium">{analysisError}</p>
                  )}
                </div>
              </div>

              {/* Analysis Results Display */}
              {analysis && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                  <div className="lg:col-span-2 space-y-8">
                    {/* Main Stats */}
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
                        <span className="text-sm font-medium text-slate-500">Evaluation Score</span>
                        <div className={`text-5xl font-bold ${getScoreColor(analysis.score)}`}>
                          {analysis.score}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.score}%` }}
                            className={`h-full ${analysis.score >= 80 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          />
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
                        <span className="text-sm font-medium text-slate-500">Job Match</span>
                        <div className="text-5xl font-bold text-blue-600">
                          {analysis.matchPercentage}%
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.matchPercentage}%` }}
                            className="h-full bg-blue-500"
                          />
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
                        <span className="text-sm font-medium text-slate-500">Rec. Status</span>
                        <div className="text-xl font-bold text-center leading-tight">
                          {analysis.recommendation}
                        </div>
                        {analysis.recommendation === "Highly Recommended" && (
                          <div className="flex gap-1 text-amber-500">
                            {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Strengths & Gaps */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-bold mb-6">Candidate Profile Breakdown</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CheckCircle2 size={16} /> Key Strengths
                          </h4>
                          <ul className="space-y-3">
                            {analysis.strengths.map((s, i) => (
                              <li key={i} className="text-sm flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                <ChevronRight size={14} className="mt-1 text-emerald-500 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertCircle size={16} /> Potential Gaps
                          </h4>
                          <ul className="space-y-3">
                            {analysis.gaps.map((g, i) => (
                              <li key={i} className="text-sm flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                <ChevronRight size={14} className="mt-1 text-rose-500 flex-shrink-0" />
                                {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Results */}
                  <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-bold mb-6 flex gap-2 items-center">
                        <Terminal size={20} className="text-blue-500" />
                        Technical Stack
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {analysis.topSkills.map((s, i) => (
                          <span key={i} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-100 dark:border-blue-900/50">
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Experience Level</div>
                        <div className="text-2xl font-bold">{analysis.experienceLevel}</div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <HelpCircle size={20} /> Executive Summary
                      </h3>
                      <p className="text-sm text-blue-50 leading-relaxed mb-6">
                        {analysis.summary}
                      </p>
                      <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                        <Download size={18} />
                        Export PDF Report
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "analyze" && (
            <motion.div key="analyze" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Search size={24} className="text-blue-500" /> Resume Analysis Details</h2>
                {extractedData ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                      <FileText size={24} className="text-blue-500" />
                      <div><p className="font-semibold">{extractedData.filename}</p><p className="text-sm text-slate-500">{extractedData.text.length} characters extracted</p></div>
                    </div>
                    <div><h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-3">Extracted Text Preview</h3>
                      <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono">{extractedData.text.substring(0, 2000)}{extractedData.text.length > 2000 ? "..." : ""}</pre>
                      </div>
                    </div>
                    {analysis && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl text-center border border-emerald-100 dark:border-emerald-900/30"><p className="text-3xl font-bold text-emerald-600">{analysis.score}</p><p className="text-xs text-slate-500 mt-1">Score</p></div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-900/30"><p className="text-3xl font-bold text-blue-600">{analysis.matchPercentage}%</p><p className="text-xs text-slate-500 mt-1">Match</p></div>
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl text-center border border-purple-100 dark:border-purple-900/30"><p className="text-lg font-bold text-purple-600">{analysis.experienceLevel}</p><p className="text-xs text-slate-500 mt-1">Level</p></div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl text-center border border-amber-100 dark:border-amber-900/30"><p className="text-lg font-bold text-amber-600">{analysis.recommendation.split(' ')[0]}</p><p className="text-xs text-slate-500 mt-1">Status</p></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400"><Search size={48} className="mx-auto mb-4 opacity-30" /><p>Upload a resume from the Dashboard to see analysis details here.</p></div>
                )}
              </div>
              {history.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Clock size={20} className="text-blue-500" /> Screening History</h3>
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3"><FileText size={18} className="text-blue-500" /><div><p className="font-medium text-sm">{h.filename}</p><p className="text-xs text-slate-500">{h.jobTitle} • {h.date}</p></div></div>
                        <div className="flex items-center gap-3"><span className={`text-lg font-bold ${h.score >= 80 ? 'text-emerald-500' : h.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{h.score}%</span><span className="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-medium">{h.recommendation}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "jobs" && (
            <motion.div key="jobs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Job Listings</h2>
                <button className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"><Plus size={18} /> Post New Job</button>
              </div>
              {[{ title: "Senior Frontend Developer", company: "TechCorp India", location: "Bangalore", type: "Full-time", salary: "₹18-25 LPA", skills: ["React", "TypeScript", "Node.js"], applicants: 24, status: "Open" },
                { title: "Full Stack Engineer", company: "StartupXYZ", location: "Remote", type: "Full-time", salary: "₹12-18 LPA", skills: ["Python", "React", "AWS"], applicants: 38, status: "Open" },
                { title: "UI/UX Designer", company: "DesignStudio", location: "Mumbai", type: "Contract", salary: "₹8-12 LPA", skills: ["Figma", "CSS", "Prototyping"], applicants: 15, status: "Open" },
                { title: "Data Analyst", company: "Analytics Co.", location: "Hyderabad", type: "Full-time", salary: "₹10-15 LPA", skills: ["SQL", "Python", "Tableau"], applicants: 42, status: "Closed" }
              ].map((job, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3"><h3 className="text-lg font-bold">{job.title}</h3><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${job.status === 'Open' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{job.status}</span></div>
                      <p className="text-slate-500 font-medium">{job.company}</p>
                      <div className="flex gap-4 text-sm text-slate-400"><span className="flex items-center gap-1"><MapPin size={14} /> {job.location}</span><span className="flex items-center gap-1"><Briefcase size={14} /> {job.type}</span><span className="flex items-center gap-1"><Hash size={14} /> {job.applicants} applicants</span></div>
                    </div>
                    <div className="text-right"><p className="text-lg font-bold text-blue-600">{job.salary}</p></div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">{job.skills.map((s, j) => <span key={j} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-100 dark:border-blue-900/40">{s}</span>)}</div>
                    <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-sm font-semibold transition-colors">View Details →</button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "sdg8" && (
            <motion.div 
              key="sdg8"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center">
                <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                  <Globe size={48} />
                </div>
                <h2 className="text-4xl font-bold mb-4">SDG 8: Decent Work and Economic Growth</h2>
                <p className="text-slate-500 text-lg">How AI-powered screening contributes to global employment goals.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <h3 className="text-xl font-bold mb-4 text-blue-600">Improving Efficiency</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    By automating the initial screening process, we allow recruiters to focus on human-centric aspects of hiring. This reduces bias and speeds up employment, helping people find work faster.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <h3 className="text-xl font-bold mb-4 text-blue-600">Fair Opportunities</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Our AI evaluates based on skills and experience, providing more objective data points for decision-making. This aligns with target 8.5 to achieve full and productive employment for all.
                  </p>
                </div>
              </div>

              <div className="p-12 bg-slate-900 rounded-3xl text-center text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-3xl font-bold mb-6 italic serif text-blue-200">"Modern tools for a modern workforce."</h4>
                  <p className="max-w-2xl mx-auto text-slate-400">
                    Smart hiring systems reduce economic friction and help match the right talent with the right opportunities.
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-3xl -mr-32 -mt-32 rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-3xl -ml-32 -mb-32 rounded-full"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white">AI Recruit</span>
            <span>© 2026 Candidate Screening System</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-blue-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-500 transition-colors">Help Center</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
