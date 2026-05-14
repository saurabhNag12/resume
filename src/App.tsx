import React, { useState, useCallback, useEffect } from "react";
import { 
  Upload, 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  BrainCircuit, 
  User, 
  LayoutDashboard, 
  Settings, 
  HelpCircle, 
  Globe,
  Star,
  ChevronRight,
  Sun,
  Moon,
  Download,
  Terminal,
  Briefcase,
  ShieldCheck,
  ShieldAlert
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
    await uploadAndExtract(uploadedFile);
  };

  const uploadAndExtract = async (uploadedFile: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("resume", uploadedFile);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setExtractedData(data);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const startAnalysis = async () => {
    if (!extractedData?.text) {
      setAnalysisError("Please upload a resume first.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      // Step 2: Analyze with Comprehend (server-side NLP) — non-blocking
      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedData.text }),
        });
        const analyzeData = await analyzeRes.json();
        setExtractedData(prev => ({ ...prev!, ...analyzeData }));
      } catch (nlpErr) {
        console.warn("NLP analysis skipped:", nlpErr);
      }

      // Step 3: Match Job using local heuristic (backend API)
      const matchRes = await fetch("/api/match-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: extractedData.text,
          jobDescription: jobDescription
        }),
      });
      
      const matchData = await matchRes.json();
      if (!matchRes.ok) {
        throw new Error(matchData.error || "Failed to match job");
      }
      
      setAnalysis(matchData);
    } catch (err: any) {
      console.error("Analysis failed", err);
      setAnalysisError(err.message || "Analysis failed. Please try again.");
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
