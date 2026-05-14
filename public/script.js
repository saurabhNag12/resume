// Global variables
let uploadedFile = null;
let resumeText = '';
let analysisData = null;
let candidates = [];

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadSuccess = document.getElementById('uploadSuccess');
const uploadedFileName = document.getElementById('uploadedFileName');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const darkModeToggle = document.getElementById('darkModeToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadCandidatesFromStorage();
    updateDashboardStats();
});

// Event Listeners
function initializeEventListeners() {
    // Upload area events
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Navigation events
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            showSection(section);
        });
    });

    // Menu toggle
    menuToggle.addEventListener('click', toggleSidebar);

    // Dark mode toggle
    darkModeToggle.addEventListener('click', toggleDarkMode);

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// File Handler
function handleFile(file) {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const validExtensions = ['.pdf', '.docx', '.doc'];
    
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        alert('Please upload a PDF or DOCX file');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    uploadedFile = file;
    uploadFile(file);
}

// Upload File
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('resume', file);

    uploadArea.style.display = 'none';
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading...';

    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            progressFill.style.width = progress + '%';
            if (progress >= 90) {
                clearInterval(progressInterval);
            }
        }, 100);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        progressFill.style.width = '100%';

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();
        
        if (data.success) {
            resumeText = data.text;
            uploadedFileName.textContent = data.originalName;
            
            setTimeout(() => {
                uploadProgress.style.display = 'none';
                uploadSuccess.style.display = 'block';
            }, 500);
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        resetUpload();
    }
}

// Reset Upload
function resetUpload() {
    uploadArea.style.display = 'block';
    uploadProgress.style.display = 'none';
    uploadSuccess.style.display = 'none';
    uploadedFile = null;
    resumeText = '';
    fileInput.value = '';
}

// Analyze Resume
async function analyzeResume() {
    if (!resumeText) {
        alert('Please upload a resume first');
        return;
    }

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: resumeText })
        });

        if (!response.ok) {
            throw new Error('Analysis failed');
        }

        const data = await response.json();
        
        if (data.success) {
            analysisData = data.analysis;
            displayAnalysis(data.analysis);
            showSection('analysis');
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Analysis failed: ' + error.message);
    }
}

// Display Analysis
function displayAnalysis(analysis) {
    document.getElementById('noAnalysis').style.display = 'none';
    document.getElementById('analysisContainer').style.display = 'block';

    // Update score circle
    const scoreCircle = document.getElementById('scoreProgress');
    const scoreValue = document.getElementById('scoreValue');
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (analysis.score / 100) * circumference;
    
    scoreCircle.style.strokeDashoffset = offset;
    scoreValue.textContent = analysis.score;

    // Update recommendation badge
    const recommendationBadge = document.getElementById('recommendationBadge');
    const recommendationText = document.getElementById('recommendationText');
    
    recommendationBadge.className = 'recommendation-badge';
    if (analysis.recommendation === 'Highly Recommended') {
        recommendationBadge.classList.add('highly-recommended');
    } else if (analysis.recommendation === 'Recommended') {
        recommendationBadge.classList.add('recommended');
    } else {
        recommendationBadge.classList.add('needs-improvement');
    }
    recommendationText.textContent = analysis.recommendation;

    // Update skills
    const skillTags = document.getElementById('skillTags');
    skillTags.innerHTML = analysis.skills.map(skill => 
        `<span class="skill-tag">${skill}</span>`
    ).join('');

    // Update organizations
    const organizationList = document.getElementById('organizationList');
    organizationList.innerHTML = analysis.organizations.map(org => 
        `<li>${org}</li>`
    ).join('');

    // Update key phrases
    const keyPhrases = document.getElementById('keyPhrases');
    keyPhrases.innerHTML = analysis.keyPhrases.slice(0, 8).map(phrase => 
        `<span class="key-phrase">${phrase.text}</span>`
    ).join('');

    // Update sentiment
    const sentimentResult = document.getElementById('sentimentResult');
    const sentimentLabel = sentimentResult.querySelector('.sentiment-label');
    const sentimentFill = sentimentResult.querySelector('.sentiment-fill');
    
    sentimentLabel.textContent = analysis.sentiment.sentiment.charAt(0).toUpperCase() + 
                                  analysis.sentiment.sentiment.slice(1);
    sentimentFill.className = 'sentiment-fill ' + analysis.sentiment.sentiment;
    sentimentFill.style.width = (analysis.sentiment.sentimentScores[analysis.sentiment.sentiment] * 100) + '%';

    // Update language
    const languageResult = document.getElementById('languageResult');
    languageResult.textContent = `${analysis.language.LanguageCode} (${Math.round(analysis.language.Score * 100)}%)`;

    // Add to candidates
    addCandidate(analysis);
}

// Match with Job
async function matchWithJob() {
    const jobDescription = document.getElementById('jobDescription').value;
    
    if (!resumeText) {
        alert('Please upload a resume first');
        return;
    }

    if (!jobDescription.trim()) {
        alert('Please enter a job description');
        return;
    }

    try {
        const response = await fetch('/api/match-job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resumeText: resumeText,
                jobDescription: jobDescription
            })
        });

        if (!response.ok) {
            throw new Error('Job matching failed');
        }

        const data = await response.json();
        
        if (data.success) {
            displayMatchResults(data.match);
        } else {
            throw new Error(data.error || 'Job matching failed');
        }
    } catch (error) {
        console.error('Job match error:', error);
        alert('Job matching failed: ' + error.message);
    }
}

// Display Match Results
function displayMatchResults(match) {
    document.getElementById('matchResults').style.display = 'block';

    // Update match circle
    const matchProgress = document.getElementById('matchProgress');
    const matchValue = document.getElementById('matchValue');
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (match.matchPercentage / 100) * circumference;
    
    matchProgress.style.strokeDashoffset = offset;
    matchValue.textContent = match.matchPercentage + '%';

    // Update matched skills
    const matchedSkills = document.getElementById('matchedSkills');
    matchedSkills.innerHTML = match.matchedSkills.map(skill => 
        `<span class="skill-tag match">${skill}</span>`
    ).join('');

    // Update missing skills
    const missingSkills = document.getElementById('missingSkills');
    missingSkills.innerHTML = match.missingSkills.map(skill => 
        `<span class="skill-tag missing">${skill}</span>`
    ).join('');

    // Update experience level
    document.getElementById('experienceLevel').textContent = match.experienceLevel;

    // Update overall score
    document.getElementById('overallScore').textContent = match.overallScore + '/100';
}

// Add Candidate
function addCandidate(analysis) {
    const candidate = {
        id: Date.now(),
        name: uploadedFileName ? uploadedFileName.textContent.replace(/\.[^/.]+$/, '') : 'Unknown',
        score: analysis.score,
        matchPercentage: 0,
        experience: 'Mid Level',
        recommendation: analysis.recommendation,
        timestamp: new Date().toISOString()
    };

    candidates.push(candidate);
    candidates.sort((a, b) => b.score - a.score);
    
    saveCandidatesToStorage();
    updateCandidatesTable();
    updateDashboardStats();
}

// Update Candidates Table
function updateCandidatesTable() {
    const tbody = document.getElementById('candidatesTableBody');
    
    if (candidates.length === 0) {
        tbody.innerHTML = '<tr class="no-candidates"><td colspan="7">No candidates analyzed yet</td></tr>';
        return;
    }

    tbody.innerHTML = candidates.map((candidate, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${candidate.name}</td>
            <td>${candidate.score}</td>
            <td>${candidate.matchPercentage}%</td>
            <td>${candidate.experience}</td>
            <td><span class="recommendation-badge ${getRecommendationClass(candidate.recommendation)}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">${candidate.recommendation}</span></td>
            <td>
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="viewCandidate(${candidate.id})">View</button>
            </td>
        </tr>
    `).join('');
}

// Get Recommendation Class
function getRecommendationClass(recommendation) {
    if (recommendation === 'Highly Recommended') return 'highly-recommended';
    if (recommendation === 'Recommended') return 'recommended';
    return 'needs-improvement';
}

// View Candidate
function viewCandidate(id) {
    const candidate = candidates.find(c => c.id === id);
    if (candidate) {
        alert(`Candidate: ${candidate.name}\nScore: ${candidate.score}\nRecommendation: ${candidate.recommendation}`);
    }
}

// Update Dashboard Stats
function updateDashboardStats() {
    document.getElementById('totalResumes').textContent = candidates.length;
    
    const recommended = candidates.filter(c => c.recommendation === 'Recommended' || c.recommendation === 'Highly Recommended').length;
    document.getElementById('recommendedCount').textContent = recommended;
    
    const avgScore = candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length) : 0;
    document.getElementById('avgScore').textContent = avgScore + '%';
    
    const avgMatch = candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.matchPercentage, 0) / candidates.length) : 0;
    document.getElementById('matchRate').textContent = avgMatch + '%';
}

// Save Candidates to Storage
function saveCandidatesToStorage() {
    localStorage.setItem('candidates', JSON.stringify(candidates));
}

// Load Candidates from Storage
function loadCandidatesFromStorage() {
    const stored = localStorage.getItem('candidates');
    if (stored) {
        candidates = JSON.parse(stored);
        updateCandidatesTable();
    }
}

// Show Section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
    }
}

// Toggle Sidebar
function toggleSidebar() {
    sidebar.classList.toggle('open');
}

// Toggle Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    const toggleIcon = darkModeToggle.querySelector('.toggle-icon');
    toggleIcon.textContent = isDarkMode ? '☀️' : '🌙';
    
    localStorage.setItem('darkMode', isDarkMode);
}

// Load Dark Mode Preference
function loadDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const toggleIcon = darkModeToggle.querySelector('.toggle-icon');
        toggleIcon.textContent = '☀️';
    }
}

// Export Report
function exportReport() {
    if (candidates.length === 0) {
        alert('No candidates to export');
        return;
    }

    let report = 'AI Resume Analyzer - Candidate Report\n';
    report += '=' .repeat(50) + '\n\n';
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Total Candidates: ${candidates.length}\n\n`;

    candidates.forEach((candidate, index) => {
        report += `${index + 1}. ${candidate.name}\n`;
        report += `   Score: ${candidate.score}/100\n`;
        report += `   Match: ${candidate.matchPercentage}%\n`;
        report += `   Experience: ${candidate.experience}\n`;
        report += `   Recommendation: ${candidate.recommendation}\n\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate-report.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize dark mode preference
loadDarkModePreference();
