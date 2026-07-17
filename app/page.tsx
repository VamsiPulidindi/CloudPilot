'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Layers, 
  FileText, 
  Settings as SettingsIcon, 
  Plus, 
  RefreshCw, 
  Cpu, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  ChevronRight, 
  Database, 
  HelpCircle, 
  ArrowRight,
  Sparkles,
  LayoutGrid,
  FolderKanban,
  Download,
  AlertCircle,
  Briefcase,
  Globe,
  Gauge,
  X,
  Sliders,
  Check,
  Server,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Copy,
  Printer,
  Terminal,
  FileCode
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';
import { generateTerraform } from '@/lib/terraformGenerator';

// ==========================================
// TYPES & CONTEXT (INTERNAL ONLY)
// ==========================================
enum ActiveTab {
  Dashboard = 'dashboard',
  Projects = 'projects',
  CreateProject = 'create-project',
  Comparison = 'comparison',
  InfrastructureBlueprint = 'infrastructure-blueprint',
  Reports = 'reports',
  Settings = 'settings'
}

interface QuestionnaireData {
  startupName: string;
  industry: string;
  projectType: string;
  expectedUsers: number;
  expectedGrowth: 'stable' | 'high' | 'explosive';
  budget: number;
  region: 'us-east' | 'eu-west' | 'ap-south';
  needAI: boolean;
  needKubernetes: boolean;
  needHighAvailability: boolean;
  storageRequirement: 'low' | 'medium' | 'high' | 'enterprise';
}

interface Project extends QuestionnaireData {
  id: string;
  createdAt: string;
}

interface ProviderBreakdown {
  cost: number;
  performance: number;
  scalability: number;
  easeOfUse: number;
  aiServices: number;
  kubernetes: number;
}

interface RecommendationResult {
  providerName: string;
  overallScore: number;
  breakdown: ProviderBreakdown;
  estimatedCost: number;
  instanceType: string;
  pros: string[];
  cons: string[];
  whyNot: string;
  architecture: string;
}

interface Evaluation {
  id: string;
  projectId: string;
  weights: {
    cost: number;
    performance: number;
    scalability: number;
    easeOfUse: number;
    aiServices: number;
    kubernetes: number;
  };
  recommendations: RecommendationResult[];
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
}

const DEFAULT_WEIGHTS = {
  cost: 25,
  performance: 20,
  scalability: 20,
  easeOfUse: 15,
  aiServices: 10,
  kubernetes: 10
};

export default function CloudPilotApplication() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.Dashboard);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Core Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [isReevaluating, setIsReevaluating] = useState(false);
  
  // Questionnaire Form State
  const [formData, setFormData] = useState<QuestionnaireData>({
    startupName: '',
    industry: 'Fintech',
    projectType: 'SaaS Platform',
    expectedUsers: 15000,
    expectedGrowth: 'high',
    budget: 800,
    region: 'us-east',
    needAI: false,
    needKubernetes: false,
    needHighAvailability: true,
    storageRequirement: 'medium'
  });

  // UI States
  const [selectedProviderName, setSelectedProviderName] = useState<string>('');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [recEngineLog, setRecEngineLog] = useState<string[]>([]);
  const [isRecRunning, setIsRecRunning] = useState(false);

  // Terraform States
  const [activeTfFile, setActiveTfFile] = useState<'providers.tf' | 'variables.tf' | 'main.tf' | 'outputs.tf'>('main.tf');
  const [isTfCopying, setIsTfCopying] = useState(false);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        fetchProjects(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Session sync failed', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const fetchProjects = async (currentUser?: User) => {
    setIsDataLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
        if (data.projects.length > 0) {
          const defaultProj = data.projects[0];
          setActiveProject(defaultProj);
          triggerRecommendation(defaultProj.id, weights);
        } else {
          setActiveProject(null);
          setEvaluation(null);
        }
      }
    } catch (err) {
      console.error('Failed to load portfolio', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  // ==========================================
  // SIDE EFFECTS & TELEMETRY SYNC
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // AUTH ACTION HANDLERS
  // ==========================================
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword || (authTab === 'register' && !authUsername)) {
      setAuthError('Please complete all form fields.');
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authTab,
          email: authEmail,
          username: authUsername,
          password: authPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        // Clear inputs
        setAuthEmail('');
        setAuthUsername('');
        setAuthPassword('');
        fetchProjects(data.user);
      } else {
        setAuthError(data.message || 'Authentication error occurred.');
      }
    } catch (err) {
      setAuthError('Failed to communicate with auth service.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      setUser(null);
      setProjects([]);
      setActiveProject(null);
      setEvaluation(null);
      setActiveTab(ActiveTab.Dashboard);
    } catch (err) {
      console.error('Logout request failed', err);
    }
  };

  const proceedAsGuest = async () => {
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'vamsi@cloudpilot.co',
          password: 'pbkdf2_sha256$mockhash'
        })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        fetchProjects(data.user);
      }
    } catch (err) {
      console.error('Guest access failed', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ==========================================
  // PORTFOLIO ACTION HANDLERS
  // ==========================================
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startupName.trim()) return;

    setIsRecRunning(true);
    setRecEngineLog([]);
    setActiveTab(ActiveTab.Comparison);

    const logs = [
      '🔍 Initializing multi-cloud questionnaire telemetry...',
      '🛠️ Constructing system deployment specifications...',
      '📈 Checking expected traffic profile: ' + formData.expectedUsers + ' active users...',
      '⚙️ Instantiating NodeSQL Lite database records...',
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setRecEngineLog(prev => [...prev, logs[i]]);
    }

    try {
      // Save project
      const resProj = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const dataProj = await resProj.json();

      if (dataProj.success) {
        const newProj = dataProj.project;
        setProjects(prev => [newProj, ...prev]);
        setActiveProject(newProj);

        setRecEngineLog(prev => [...prev, '⚡ Connecting server-side Infracost adapter modules...', '🤖 Querying smart Multi-Cloud Recommendation models...']);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Evaluate cloud recommendation
        await triggerRecommendation(newProj.id, weights);
        
        setRecEngineLog(prev => [...prev, '✨ Multi-cloud optimization synthesis complete!']);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reset form wizard
        setFormData({
          startupName: '',
          industry: 'Fintech',
          projectType: 'SaaS Platform',
          expectedUsers: 15000,
          expectedGrowth: 'high',
          budget: 800,
          region: 'us-east',
          needAI: false,
          needKubernetes: false,
          needHighAvailability: true,
          storageRequirement: 'medium'
        });
        setWizardStep(1);
      }
    } catch (err) {
      console.error('Failed to construct cloud evaluation', err);
    } finally {
      setIsRecRunning(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        if (activeProject?.id === id) {
          if (updated.length > 0) {
            setActiveProject(updated[0]);
            triggerRecommendation(updated[0].id, weights);
          } else {
            setActiveProject(null);
            setEvaluation(null);
          }
        }
      }
    } catch (err) {
      console.error('Delete project failed', err);
    }
  };

  const triggerRecommendation = async (projId: string, currentWeights: typeof DEFAULT_WEIGHTS) => {
    setIsReevaluating(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projId, weights: currentWeights })
      });
      const data = await res.json();
      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
        if (data.evaluation.recommendations.length > 0) {
          setSelectedProviderName(data.evaluation.recommendations[0].providerName);
        }
        // Immediately fetch printable report
        fetchReportMarkdown(projId);
      }
    } catch (err) {
      console.error('Failed to trigger recommendation engine', err);
    } finally {
      setIsReevaluating(false);
    }
  };

  const fetchReportMarkdown = async (projId: string) => {
    try {
      const res = await fetch(`/api/reports?projectId=${projId}&format=markdown`);
      const data = await res.json();
      if (data.success && data.markdown) {
        setReportMarkdown(data.markdown);
      }
    } catch (err) {
      console.error('Failed to pull report details', err);
    }
  };

  const handleWeightChange = (key: keyof typeof DEFAULT_WEIGHTS, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
  };

  const applyWeights = () => {
    if (activeProject) {
      triggerRecommendation(activeProject.id, weights);
    }
  };

  const restoreDefaultWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    if (activeProject) {
      triggerRecommendation(activeProject.id, DEFAULT_WEIGHTS);
    }
  };

  const selectActiveProject = (proj: Project) => {
    setActiveProject(proj);
    triggerRecommendation(proj.id, weights);
  };

  // ==========================================
  // UTILITY ACTIONS (CSV / COPY / PRINT)
  // ==========================================
  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<!DOCTYPE html>' + '<html>' + `
          <head>
            <title>CloudPilot Compliance & Deployment Report</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
              h1, h2, h3 { color: #0f172a; margin-top: 24px; }
              pre { background: #f1f5f9; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; overflow-x: auto; }
              hr { border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0; }
            </style>
          </head>
          <body>
            ${reportMarkdown.replace(/\n/g, '<br>')}
            <script>window.print();</script>
          </body>
        ` + '</html>');
      printWindow.document.close();
    }
  };

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.recommendations.map(r => ({
      name: r.providerName,
      Score: r.overallScore,
      Cost: r.estimatedCost
    }));
  }, [evaluation]);

  const activeProviderDetails = useMemo(() => {
    if (!evaluation || !selectedProviderName) return null;
    return evaluation.recommendations.find(r => r.providerName === selectedProviderName) || null;
  }, [evaluation, selectedProviderName]);

  // Auth Loading Screen
  if (isAuthLoading) {
    return (
      <div className="w-full min-h-screen bg-[#09090b] flex flex-col items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20 animate-pulse">
            <Layers className="w-6 h-6 animate-spin duration-3000" />
          </div>
          <p className="text-sm text-[#a1a1aa] font-mono tracking-widest animate-pulse">BOOTING CLOUDPILOT ENGINE...</p>
        </div>
      </div>
    );
  }

  // Auth Form Page
  if (!user) {
    return (
      <div className="w-full min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col items-center justify-center p-6 font-sans antialiased select-none">
        
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden p-8 shadow-2xl shadow-black/80"
          id="auth-card"
        >
          {/* Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30 mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">CloudPilot Console</h1>
            <p className="text-xs text-[#a1a1aa] mt-1 font-mono tracking-wider uppercase text-blue-500">Multi-Cloud Evaluation Platform</p>
          </div>

          {/* Tab Selection */}
          <div className="grid grid-cols-2 bg-[#09090b] p-1 rounded-lg mb-6 border border-[#27272a]">
            <button
              onClick={() => { setAuthTab('login'); setAuthError(''); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                authTab === 'login' ? 'bg-[#18181b] text-white border border-[#27272a]' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthTab('register'); setAuthError(''); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                authTab === 'register' ? 'bg-[#18181b] text-white border border-[#27272a]' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authTab === 'register' && (
              <div>
                <label className="block text-xs text-[#a1a1aa] font-medium mb-1.5 uppercase font-mono tracking-wider">Full Name</label>
                <input
                  type="text"
                  placeholder="Vamsi Pulidindi"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-[#a1a1aa] font-medium mb-1.5 uppercase font-mono tracking-wider">Email Address</label>
              <input
                type="email"
                placeholder="vamsi@cloudpilot.co"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs text-[#a1a1aa] font-medium mb-1.5 uppercase font-mono tracking-wider">Secure Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-tight shadow-lg shadow-blue-600/10 transition-all uppercase font-mono mt-2"
            >
              {authTab === 'login' ? 'Access Dashboard' : 'Complete Registration'}
            </button>
          </form>

          {/* Guest Access Section */}
          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-[#27272a]"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-mono tracking-widest text-[#52525b]">or explore directly</span>
            <div className="flex-grow border-t border-[#27272a]"></div>
          </div>

          <button
            onClick={proceedAsGuest}
            type="button"
            className="w-full border border-[#27272a] hover:bg-[#27272a]/20 text-[#a1a1aa] hover:text-white py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all uppercase font-mono"
          >
            Explore Platform as Guest
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#09090b] text-[#fafafa] flex overflow-hidden font-sans antialiased selection:bg-blue-600/30 selection:text-white">
      
      {/* ==========================================
          SIDEBAR
          ========================================== */}
      <aside className="w-64 border-r border-[#27272a] bg-[#09090b] flex flex-col shrink-0 z-10 select-none">
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-[#27272a]">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Layers className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight block">CloudPilot</span>
            <span className="text-[10px] text-blue-500 font-mono tracking-widest uppercase">Multi-Cloud Engine</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-1 text-xs font-semibold text-[#52525b] uppercase tracking-wider mb-2">Main Console</div>
          
          <button 
            id="nav-dashboard"
            onClick={() => setActiveTab(ActiveTab.Dashboard)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.Dashboard 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <LayoutGrid className="w-4.5 h-4.5" />
            Infrastructure Dashboard
          </button>
          
          <button 
            id="nav-projects"
            onClick={() => setActiveTab(ActiveTab.Projects)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.Projects 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <FolderKanban className="w-4.5 h-4.5" />
            Projects Library ({projects.length})
          </button>

          <button 
            id="nav-create-project"
            onClick={() => { setWizardStep(1); setActiveTab(ActiveTab.CreateProject); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.CreateProject 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <Plus className="w-4.5 h-4.5" />
            New Cloud Evaluation
          </button>

          <button 
            id="nav-comparison"
            onClick={() => setActiveTab(ActiveTab.Comparison)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.Comparison 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <Sliders className="w-4.5 h-4.5" />
            Recommendation Result
          </button>

          <button 
            id="nav-blueprint"
            onClick={() => setActiveTab(ActiveTab.InfrastructureBlueprint)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.InfrastructureBlueprint 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <FileCode className="w-4.5 h-4.5" />
            Infrastructure Blueprint
          </button>

          <button 
            id="nav-reports"
            onClick={() => setActiveTab(ActiveTab.Reports)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.Reports 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <FileText className="w-4.5 h-4.5" />
            Compliance Reports
          </button>

          <button 
            id="nav-settings"
            onClick={() => setActiveTab(ActiveTab.Settings)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === ActiveTab.Settings 
                ? 'bg-[#18181b] text-white border border-[#27272a]' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/50'
            }`}
          >
            <SettingsIcon className="w-4.5 h-4.5" />
            Weights & Engine Settings
          </button>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-[#27272a] mt-auto">
          <div className="flex items-center gap-3 px-2 py-3 rounded-xl bg-[#111114]/50 border border-[#27272a]/30">
            <div className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-xs text-blue-400 font-bold uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user.username}</p>
              <p className="text-[10px] text-[#a1a1aa] truncate font-mono">Registered DevOps Practitioner</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 hover:bg-[#27272a] hover:text-red-400 rounded-lg transition-all"
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN CONTENT CONTAINER
          ========================================== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
        
        {/* Dynamic Page Header */}
        <header className="h-16 border-b border-[#27272a] px-8 flex items-center justify-between shrink-0 select-none">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {activeTab === ActiveTab.Dashboard && 'Infrastructure Dashboard'}
              {activeTab === ActiveTab.Projects && 'Startup Projects Portfolio'}
              {activeTab === ActiveTab.CreateProject && 'Cloud Questionnaire Wizard'}
              {activeTab === ActiveTab.Comparison && 'Multi-Cloud Recommendation Engine'}
              {activeTab === ActiveTab.InfrastructureBlueprint && 'Infrastructure as Code Blueprint'}
              {activeTab === ActiveTab.Reports && 'Compliance Report Generator'}
              {activeTab === ActiveTab.Settings && 'Configurable Weight Parameters'}
            </h1>
            <p className="text-xs text-[#a1a1aa] flex items-center gap-1.5 mt-0.5">
              <span>Platform Mode:</span>
              <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Full Stack AI Engine with Local Rule Failover
              </span>
            </p>
          </div>
          
          <div className="flex gap-2">
            {activeProject && (
              <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="text-[#a1a1aa]">Active Focus:</span>
                <span className="text-blue-400 font-bold">{activeProject.startupName}</span>
              </div>
            )}
            
            <button 
              onClick={() => { setWizardStep(1); setActiveTab(ActiveTab.CreateProject); }} 
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              Evaluate Startup
            </button>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <div className="p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="h-full space-y-6"
            >
              
              {/* ==========================================
                  VIEW: DASHBOARD
                  ========================================== */}
              {activeTab === ActiveTab.Dashboard && (
                <div className="space-y-6">
                  {/* Banner */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start">
                    <Activity className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-300">Multi-Cloud Orchestration Sandbox Active</h4>
                      <p className="text-xs text-[#a1a1aa] mt-0.5 leading-relaxed">
                        CloudPilot maps functional constraints (growth speed, database clustering, region, and AI modules) against cost schemas and compliance metrics. Modify priority matrices under Engine Settings or view generated deployments instantly.
                      </p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">Tracked Portfolios</span>
                        <FolderKanban className="w-4.5 h-4.5 text-blue-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold tracking-tight">{projects.length}</p>
                        <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3" /> Fully Synced via NodeSQL Lite
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">Active Engine Score</span>
                        <Gauge className="w-4.5 h-4.5 text-emerald-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold tracking-tight">
                          {evaluation && evaluation.recommendations.length > 0 ? evaluation.recommendations[0].overallScore : 'N/A'}
                        </p>
                        <p className="text-[10px] text-[#a1a1aa] mt-1 font-mono">
                          Maximum suitability index
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">Compliance Adapters</span>
                        <DollarSign className="w-4.5 h-4.5 text-purple-500" />
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold tracking-tight">4/4 Active</p>
                        <p className="text-[10px] text-blue-400 mt-1 font-mono">
                          Infracost cost tables mapping
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#18181b] border border-[#27272a] p-4 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">System Diagnostics</span>
                        <Server className="w-4.5 h-4.5 text-orange-500" />
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-2 flex-1 bg-[#27272a] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[100%]"></div>
                          </div>
                          <span className="text-xs font-mono text-blue-400">Stable</span>
                        </div>
                        <p className="text-[10px] text-[#a1a1aa] mt-1 font-mono">
                          Server side telemetry active
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Split Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left: Latest Cloud Recommendation Result */}
                    <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col justify-between min-h-[400px]">
                      <div className="p-5 border-b border-[#27272a] bg-[#1c1c21] flex justify-between items-center">
                        <h2 className="font-semibold text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Top Cloud Recommendation
                        </h2>
                        {activeProject && (
                          <span className="text-xs font-mono text-[#a1a1aa] bg-[#09090b] px-2 py-1 rounded border border-[#27272a]">
                            Project: {activeProject.startupName}
                          </span>
                        )}
                      </div>
                      
                      {activeProject && evaluation && evaluation.recommendations.length > 0 ? (
                        <div className="p-6 flex-1 flex flex-col justify-center">
                          <div className="flex flex-col md:flex-row items-center gap-8">
                            
                            {/* Score circular visual */}
                            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" stroke="#27272a" strokeWidth="2.5" />
                                <circle 
                                  cx="18" 
                                  cy="18" 
                                  r="16" 
                                  fill="none" 
                                  stroke="#2563eb" 
                                  strokeWidth="2.5" 
                                  strokeDasharray={`${evaluation.recommendations[0].overallScore}, 100`} 
                                  strokeLinecap="round" 
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center">
                                <span className="text-4xl font-extrabold tracking-tight font-mono">{evaluation.recommendations[0].overallScore}</span>
                                <span className="text-[9px] uppercase tracking-wider text-[#a1a1aa]">Score</span>
                              </div>
                            </div>

                            {/* Details text */}
                            <div className="flex-1 space-y-4">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-xl font-bold text-white">{evaluation.recommendations[0].providerName}</h3>
                                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-semibold uppercase">
                                    Primary Selection
                                  </span>
                                </div>
                                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                                  Highest suitability matching startup budget (${activeProject.budget}/mo), expected traffic scope ({activeProject.expectedUsers} users), and workload capabilities.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="text-[#a1a1aa]">Cost Weight ({weights.cost}%)</span>
                                    <span className="text-white">{evaluation.recommendations[0].breakdown.cost}%</span>
                                  </div>
                                  <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${evaluation.recommendations[0].breakdown.cost}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="text-[#a1a1aa]">Performance ({weights.performance}%)</span>
                                    <span className="text-white">{evaluation.recommendations[0].breakdown.performance}%</span>
                                  </div>
                                  <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${evaluation.recommendations[0].breakdown.performance}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="text-[#a1a1aa]">Scalability ({weights.scalability}%)</span>
                                    <span className="text-white">{evaluation.recommendations[0].breakdown.scalability}%</span>
                                  </div>
                                  <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${evaluation.recommendations[0].breakdown.scalability}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="text-[#a1a1aa]">Operational Ease ({weights.easeOfUse}%)</span>
                                    <span className="text-white">{evaluation.recommendations[0].breakdown.easeOfUse}%</span>
                                  </div>
                                  <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${evaluation.recommendations[0].breakdown.easeOfUse}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-[#a1a1aa] flex-1 flex flex-col justify-center items-center">
                          <AlertCircle className="w-10 h-10 text-orange-400 stroke-1.5 mb-2" />
                          <p className="text-sm">No cloud evaluation profiles detected in this startup portfolio.</p>
                          <button 
                            onClick={() => setActiveTab(ActiveTab.CreateProject)}
                            className="mt-3 text-xs text-blue-400 hover:underline font-mono"
                          >
                            Launch Questionnaire Wizard &rarr;
                          </button>
                        </div>
                      )}

                      {activeProject && evaluation && evaluation.recommendations.length > 0 && (
                        <div className="px-6 py-4 bg-[#111114] border-t border-[#27272a] flex justify-between items-center text-xs font-mono">
                          <div className="flex gap-6">
                            <span className="text-[#a1a1aa]">Est. Monthly Cost: <strong className="text-white">${evaluation.recommendations[0].estimatedCost}</strong></span>
                            <span className="text-[#a1a1aa]">Specs Mapped: <strong className="text-white">{evaluation.recommendations[0].instanceType}</strong></span>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedProviderName(evaluation.recommendations[0].providerName);
                              setActiveTab(ActiveTab.Comparison);
                            }}
                            className="text-blue-400 hover:text-white transition-colors flex items-center gap-1 font-sans font-medium"
                          >
                            Analyze Layout <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right: Cloud Rankings List with visual Bar Chart */}
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col justify-between">
                      <div className="p-5 border-b border-[#27272a]">
                        <h3 className="font-semibold text-sm text-white">Comparative Score Spectrum</h3>
                        <p className="text-[10px] text-[#a1a1aa] mt-0.5 font-mono">Overall Index ranking computed by engine</p>
                      </div>

                      {activeProject && chartData.length > 0 ? (
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          {/* Recharts Component */}
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                <XAxis dataKey="name" stroke="#52525b" fontSize={9} tickLine={false} />
                                <YAxis stroke="#52525b" fontSize={9} domain={[0, 100]} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                  labelClassName="text-xs text-[#fafafa] font-bold"
                                />
                                <Bar dataKey="Score" radius={[4, 4, 0, 0]}>
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#2563eb'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="space-y-2 mt-4">
                            {evaluation?.recommendations.map((prov, idx) => (
                              <div key={prov.providerName} className="flex items-center justify-between text-xs font-mono">
                                <span className="text-[#a1a1aa]">{prov.providerName}</span>
                                <span className={idx === 0 ? 'text-emerald-400 font-bold' : 'text-white'}>{prov.overallScore} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 text-center text-[#a1a1aa] flex-1 flex flex-col justify-center">
                          <p className="text-xs font-mono">Rankings list requires an active evaluation profile.</p>
                        </div>
                      )}

                      <button 
                        onClick={() => setActiveTab(ActiveTab.Settings)}
                        className="m-5 py-2 border border-[#27272a] rounded-lg text-[10px] uppercase font-mono tracking-wider text-[#a1a1aa] hover:text-white hover:bg-[#111114] transition-all"
                      >
                        Configure Decision Matrix &rarr;
                      </button>
                    </div>

                  </div>

                  {/* Telemetry Indicator Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center gap-4">
                      <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-mono">Docker Build Spec</p>
                        <p className="text-sm font-semibold text-white">Next.js App Router Container</p>
                        <p className="text-[9px] text-[#52525b] font-mono">SECURE HIGH-DENSITY RUNTIME</p>
                      </div>
                    </div>
                    
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center gap-4">
                      <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-lg">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-mono font-bold">NodeSQL Lite State</p>
                        <p className="text-sm font-semibold text-white">Schema Synced & Persistent</p>
                        <p className="text-[9px] text-blue-400 font-mono">JSON PERSISTENCE | ZERO OVERHEAD</p>
                      </div>
                    </div>

                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center gap-4">
                      <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-mono">Infrastructure as Code</p>
                        <p className="text-sm font-semibold text-white">Deployment Blueprints Complete</p>
                        <p className="text-[9px] text-purple-400 font-mono">VPC, MANAGED DB, CONTAINERS MAPPED</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ==========================================
                  VIEW: PROJECTS
                  ========================================== */}
              {activeTab === ActiveTab.Projects && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white">Startup Portfolios Library</h2>
                      <p className="text-xs text-[#a1a1aa] mt-1">Manage and select startup evaluations mapped inside NodeSQL Lite</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab(ActiveTab.CreateProject)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Evaluation Profile
                    </button>
                  </div>

                  {projects.length === 0 ? (
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center text-[#a1a1aa]">
                      <FolderKanban className="w-12 h-12 stroke-1 text-[#52525b] mx-auto mb-4" />
                      <p className="font-semibold text-white text-base">Your Startup Library is Empty</p>
                      <p className="text-xs mt-1">Submit the cloud questionnaire to persist your first evaluation profile.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map(project => (
                        <div 
                          key={project.id}
                          onClick={() => selectActiveProject(project)}
                          className={`bg-[#18181b] border rounded-xl p-5 hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between min-h-[180px] ${
                            activeProject?.id === project.id ? 'border-blue-600 ring-1 ring-blue-600/30 shadow-lg shadow-blue-600/5' : 'border-[#27272a]'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-4">
                              <h3 className="font-bold text-base text-white truncate">{project.startupName}</h3>
                              <button
                                onClick={(e) => handleDeleteProject(project.id, e)}
                                className="p-1 hover:bg-[#27272a] text-[#a1a1aa] hover:text-red-400 rounded-lg transition-all shrink-0"
                                title="Delete project profile"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <p className="text-xs text-[#a1a1aa] mt-1 font-medium">{project.industry} | {project.projectType}</p>
                            
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {project.needKubernetes && <span className="bg-[#27272a] text-[#fafafa] font-mono text-[9px] px-1.5 py-0.5 rounded border border-[#52525b]/30">K8S</span>}
                              {project.needAI && <span className="bg-[#27272a] text-blue-400 font-mono text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20">AI/ML</span>}
                              {project.needHighAvailability && <span className="bg-[#27272a] text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20">HA</span>}
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-[#27272a]/40 flex justify-between items-center text-[10px] font-mono text-[#a1a1aa]">
                            <span>Budget: <strong className="text-white">${project.budget}/mo</strong></span>
                            <span>Growth: <strong className="text-white uppercase">{project.expectedGrowth}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ==========================================
                  VIEW: QUESTIONNAIRE WIZARD
                  ========================================== */}
              {activeTab === ActiveTab.CreateProject && (
                <div className="max-w-2xl mx-auto bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden p-8 shadow-xl">
                  
                  {/* Progress Header */}
                  <div className="flex justify-between items-center mb-8 border-b border-[#27272a]/60 pb-5">
                    <div>
                      <h3 className="font-bold text-lg text-white">Multi-Cloud Evaluation Questionnaire</h3>
                      <p className="text-xs text-[#a1a1aa] mt-1">Step {wizardStep} of 3: Provide core startup constraints</p>
                    </div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(step => (
                        <div 
                          key={step} 
                          className={`h-1.5 w-8 rounded-full transition-all ${
                            step <= wizardStep ? 'bg-blue-600' : 'bg-[#27272a]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleCreateProject} className="space-y-6">
                    {wizardStep === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <h4 className="text-sm font-semibold uppercase tracking-wider font-mono text-blue-400 mb-3">1. Business Profile</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Startup Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. HealthChain AI"
                              value={formData.startupName}
                              onChange={(e) => setFormData(prev => ({ ...prev, startupName: e.target.value }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Industry Sector</label>
                            <select
                              value={formData.industry}
                              onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="Fintech">Fintech</option>
                              <option value="Healthcare">Healthcare</option>
                              <option value="E-Commerce">E-Commerce</option>
                              <option value="SaaS Enterprise">SaaS Enterprise</option>
                              <option value="Education">Education</option>
                              <option value="General Tech">General Tech</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Workload Core Target</label>
                          <select
                            value={formData.projectType}
                            onChange={(e) => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                          >
                            <option value="SaaS Platform">SaaS Platform API</option>
                            <option value="Microservices Backend">Microservices Architecture</option>
                            <option value="AI/ML Platform">AI/ML Deep Inference</option>
                            <option value="Web Application">Monolithic Web Application</option>
                            <option value="Real-time Analytics">Real-time Big Data Stream</option>
                          </select>
                        </div>

                        <div className="pt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.startupName.trim()) setWizardStep(2);
                            }}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-mono tracking-tight transition-all flex items-center gap-1.5 uppercase disabled:opacity-50"
                            disabled={!formData.startupName.trim()}
                          >
                            Next Step <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 2 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <h4 className="text-sm font-semibold uppercase tracking-wider font-mono text-blue-400 mb-3">2. Traffic Scale & Finance</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Expected Monthly Users</label>
                            <input
                              type="number"
                              required
                              value={formData.expectedUsers}
                              onChange={(e) => setFormData(prev => ({ ...prev, expectedUsers: Number(e.target.value) }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">User Growth Velocity</label>
                            <select
                              value={formData.expectedGrowth}
                              onChange={(e) => setFormData(prev => ({ ...prev, expectedGrowth: e.target.value as any }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="stable">Stable / Linear</option>
                              <option value="high">High Velocity Growth</option>
                              <option value="explosive">Explosive (Viral SaaS Scaling)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Target Monthly Budget ($ USD)</label>
                            <input
                              type="number"
                              required
                              value={formData.budget}
                              onChange={(e) => setFormData(prev => ({ ...prev, budget: Number(e.target.value) }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Deployment Data Region</label>
                            <select
                              value={formData.region}
                              onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value as any }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="us-east">US East (N. Virginia / Ohio)</option>
                              <option value="eu-west">EU West (Frankfurt / Ireland)</option>
                              <option value="ap-south">Asia Pacific (Mumbai / Singapore)</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-4 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setWizardStep(1)}
                            className="px-4 py-2 border border-[#27272a] rounded-lg text-xs font-semibold text-[#a1a1aa] hover:text-white transition-all font-mono"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardStep(3)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-mono tracking-tight transition-all flex items-center gap-1.5 uppercase"
                          >
                            Next Step <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {wizardStep === 3 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <h4 className="text-sm font-semibold uppercase tracking-wider font-mono text-blue-400">3. Infrastructure Requirements</h4>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090b] border border-[#27272a]">
                            <div>
                              <span className="block font-bold text-sm text-white">Kubernetes Native Ecosystem</span>
                              <span className="block text-[11px] text-[#a1a1aa] mt-0.5">Check if deployment runs inside EKS, GKE, AKS clusters</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={formData.needKubernetes}
                              onChange={(e) => setFormData(prev => ({ ...prev, needKubernetes: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 border-[#27272a]"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090b] border border-[#27272a]">
                            <div>
                              <span className="block font-bold text-sm text-white">AI/ML GPU Acceleration Nodes</span>
                              <span className="block text-[11px] text-[#a1a1aa] mt-0.5">Need for GPU instances or integrated foundation LLM pipeline modules</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={formData.needAI}
                              onChange={(e) => setFormData(prev => ({ ...prev, needAI: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 border-[#27272a]"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#09090b] border border-[#27272a]">
                            <div>
                              <span className="block font-bold text-sm text-white">Multi-AZ High Availability Clusters</span>
                              <span className="block text-[11px] text-[#a1a1aa] mt-0.5">Deploy multiple database read replicas and ALB failover nodes</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={formData.needHighAvailability}
                              onChange={(e) => setFormData(prev => ({ ...prev, needHighAvailability: e.target.checked }))}
                              className="w-4 h-4 rounded text-blue-600 border-[#27272a]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-[#a1a1aa] font-semibold uppercase font-mono tracking-wider mb-1.5">Storage & Persistence Scale</label>
                            <select
                              value={formData.storageRequirement}
                              onChange={(e) => setFormData(prev => ({ ...prev, storageRequirement: e.target.value as any }))}
                              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="low">Low (&lt; 50GB Simple Object Store)</option>
                              <option value="medium">Medium (50GB - 500GB Relational SSD DB)</option>
                              <option value="high">High (500GB - 2TB Distributed block clusters)</option>
                              <option value="enterprise">Enterprise Redundant (&gt; 2TB Encrypted global arrays)</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-4 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setWizardStep(2)}
                            className="px-4 py-2 border border-[#27272a] rounded-lg text-xs font-semibold text-[#a1a1aa] hover:text-white transition-all font-mono"
                          >
                            Back
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-mono tracking-tight transition-all uppercase flex items-center gap-1.5"
                          >
                            Synthesize Multi-Cloud Recommendations
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </form>
                </div>
              )}

              {/* ==========================================
                  VIEW: COMPARISON ANALYSIS
                  ========================================== */}
              {activeTab === ActiveTab.Comparison && (
                <div className="space-y-6">
                  
                  {/* Evaluating Loader overlay */}
                  {isRecRunning && (
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-8 max-w-xl mx-auto space-y-4">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                        <h3 className="font-bold text-sm text-white">Synthesizing Infrastructure Models</h3>
                      </div>
                      <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 font-mono text-[11px] text-[#a1a1aa] space-y-1.5 max-h-[180px] overflow-y-auto">
                        {recEngineLog.map((log, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-blue-500">&gt;&gt;</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isRecRunning && (!activeProject || !evaluation) && (
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center text-[#a1a1aa]">
                      <AlertCircle className="w-12 h-12 stroke-1 text-[#52525b] mx-auto mb-4" />
                      <p className="font-semibold text-white">No Cloud Recommendation Generated Yet</p>
                      <button 
                        onClick={() => { setWizardStep(1); setActiveTab(ActiveTab.CreateProject); }}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg font-mono uppercase"
                      >
                        Launch Wizard Wizard &rarr;
                      </button>
                    </div>
                  )}

                  {!isRecRunning && activeProject && evaluation && (
                    <div className="space-y-6">
                      
                      {/* Projects selector dropdown & quick specs */}
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
                        <div className="flex gap-3 items-center">
                          <Sliders className="w-5 h-5 text-blue-500" />
                          <div>
                            <span className="block text-[10px] uppercase font-mono text-[#a1a1aa] tracking-widest font-bold">Active Comparison Target</span>
                            <div className="flex items-center gap-2 mt-1">
                              <select 
                                value={activeProject.id}
                                onChange={(e) => {
                                  const proj = projects.find(p => p.id === e.target.value);
                                  if (proj) selectActiveProject(proj);
                                }}
                                className="bg-[#09090b] text-white border border-[#27272a] rounded px-2.5 py-1 text-xs font-semibold focus:outline-none"
                              >
                                {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.startupName}</option>
                                ))}
                              </select>
                              <span className="text-xs text-[#a1a1aa] font-medium">({activeProject.industry})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-6 text-[11px] font-mono border-t md:border-t-0 md:border-l border-[#27272a]/60 pt-3 md:pt-0 md:pl-6">
                          <div><span className="text-[#a1a1aa]">Traffic:</span> <strong className="text-white">{activeProject.expectedUsers.toLocaleString()} users</strong></div>
                          <div><span className="text-[#a1a1aa]">Budget Limit:</span> <strong className="text-white">${activeProject.budget}/mo</strong></div>
                          <div><span className="text-[#a1a1aa]">Region:</span> <strong className="text-white uppercase">{activeProject.region}</strong></div>
                        </div>
                      </div>

                      {/* Provider layout selector Tabs */}
                      <div className="flex bg-[#18181b] p-1 border border-[#27272a] rounded-xl">
                        {evaluation.recommendations.map((r, idx) => (
                          <button
                            key={r.providerName}
                            onClick={() => setSelectedProviderName(r.providerName)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              selectedProviderName === r.providerName 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15' 
                                : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/40'
                            }`}
                          >
                            <span>{r.providerName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              selectedProviderName === r.providerName ? 'bg-blue-700 text-white' : 'bg-[#09090b] text-[#a1a1aa]'
                            }`}>
                              {r.overallScore} pts
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Tab Content Box */}
                      {activeProviderDetails && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* Core specifications card */}
                          <div className="lg:col-span-2 space-y-6">
                            
                            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-6">
                              
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {activeProviderDetails.providerName} Implementation Mappings
                                  </h3>
                                  <p className="text-xs text-[#a1a1aa] mt-1 font-mono">Telemetry specification: {activeProviderDetails.instanceType}</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2 text-center shrink-0">
                                  <span className="block text-[10px] uppercase font-mono text-[#a1a1aa] tracking-wider">Estimated Cost</span>
                                  <span className="block text-xl font-bold text-blue-400 font-mono">${activeProviderDetails.estimatedCost}/mo</span>
                                </div>
                              </div>

                              <div className="border-t border-[#27272a] pt-5">
                                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-blue-400 mb-3">Architectural Deployment Path</h4>
                                <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 font-mono text-xs text-white leading-relaxed">
                                  {activeProviderDetails.architecture}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#27272a] pt-5">
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-emerald-400 mb-3">Operational Pros</h4>
                                  <ul className="space-y-2 text-xs text-[#a1a1aa]">
                                    {activeProviderDetails.pros.map((pro, i) => (
                                      <li key={i} className="flex gap-2 items-start">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{pro}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-orange-400 mb-3">Architectural Hurdles</h4>
                                  <ul className="space-y-2 text-xs text-[#a1a1aa]">
                                    {activeProviderDetails.cons.map((con, i) => (
                                      <li key={i} className="flex gap-2 items-start">
                                        <X className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                        <span>{con}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Suitability context */}
                          <div className="space-y-6">
                            
                            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 flex flex-col justify-between h-full">
                              <div>
                                <h3 className="font-bold text-sm text-white mb-1">Comparative Suitability Logic</h3>
                                <p className="text-xs text-[#a1a1aa] font-mono mb-4">Why other provider setups scored lower</p>
                                <p className="text-xs text-[#a1a1aa] leading-relaxed italic bg-[#09090b] border border-[#27272a] p-4 rounded-lg">
                                  &ldquo;{activeProviderDetails.whyNot}&rdquo;
                                </p>
                              </div>

                              <div className="mt-6 pt-5 border-t border-[#27272a]/60 space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-[#fafafa]">Score Matrix</h4>
                                
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">Cost Effectiveness</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.cost}/100</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">Performance Level</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.performance}/100</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">Scalability Index</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.scalability}/100</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">Operational Ease</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.easeOfUse}/100</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">AI/ML Capabilities</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.aiServices}/100</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-[#a1a1aa]">Kubernetes Support</span>
                                    <span className="text-white font-bold">{activeProviderDetails.breakdown.kubernetes}/100</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ==========================================
                  VIEW: INFRASTRUCTURE BLUEPRINT
                  ========================================== */}
              {activeTab === ActiveTab.InfrastructureBlueprint && (
                <div className="space-y-6">
                  
                  {(!activeProject || !evaluation) ? (
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center text-[#a1a1aa]">
                      <AlertCircle className="w-12 h-12 stroke-1 text-[#52525b] mx-auto mb-4" />
                      <p className="font-semibold text-white">No Cloud Recommendation Generated Yet</p>
                      <p className="text-xs mt-1">Please launch the cloud questionnaire to synthesize an optimization profile first.</p>
                      <button 
                        onClick={() => { setWizardStep(1); setActiveTab(ActiveTab.CreateProject); }}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg font-mono uppercase"
                      >
                        Launch Wizard Wizard &rarr;
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-fadeIn">
                      
                      {/* Active blueprint target overview */}
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[#18181b] p-5 rounded-xl border border-[#27272a]">
                        <div className="flex gap-3 items-center">
                          <Terminal className="w-5 h-5 text-blue-500" />
                          <div>
                            <span className="block text-[10px] uppercase font-mono text-[#a1a1aa] tracking-widest font-bold">Recommended IaC Provider</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-base font-bold text-white">
                                {selectedProviderName || evaluation.recommendations[0].providerName} Terraform Workspace
                              </span>
                              <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                                Ready to deploy
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <button
                            onClick={() => {
                              const tfFiles = generateTerraform(activeProject, selectedProviderName || evaluation.recommendations[0].providerName);
                              navigator.clipboard.writeText(tfFiles[activeTfFile]);
                              setIsTfCopying(true);
                              setTimeout(() => setIsTfCopying(false), 2000);
                            }}
                            className="px-3.5 py-1.5 border border-[#27272a] hover:bg-[#27272a]/40 text-xs font-semibold rounded-lg text-[#fafafa] flex items-center gap-1.5 transition-all"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {isTfCopying ? 'Copied!' : `Copy ${activeTfFile}`}
                          </button>
                        </div>
                      </div>

                      {/* Main Blueprint Section layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Left: File list & Architecture Details */}
                        <div className="lg:col-span-4 space-y-6">
                          
                          {/* File List selection */}
                          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
                            <div>
                              <h3 className="font-semibold text-sm text-white">Terraform Blueprint Files</h3>
                              <p className="text-[10px] text-[#a1a1aa] font-mono mt-0.5">Production-style split file configuration</p>
                            </div>

                            <div className="space-y-1.5">
                              {(['providers.tf', 'variables.tf', 'main.tf', 'outputs.tf'] as const).map((file) => {
                                const isSelected = activeTfFile === file;
                                return (
                                  <button
                                    key={file}
                                    onClick={() => setActiveTfFile(file)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-mono transition-all text-left border ${
                                      isSelected 
                                        ? 'bg-blue-600/10 border-blue-600/50 text-blue-400 font-bold' 
                                        : 'bg-[#09090b]/40 border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2">
                                      <FileText className="w-3.5 h-3.5 shrink-0" />
                                      {file}
                                    </span>
                                    {isSelected && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Recommended Architecture Box */}
                          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4">
                            <div>
                              <h3 className="font-semibold text-sm text-white">Recommended Architecture</h3>
                              <p className="text-[10px] text-[#a1a1aa] font-mono mt-0.5">Automated provisioning specs summary</p>
                            </div>

                            <div className="space-y-3.5 text-xs text-[#a1a1aa] leading-relaxed">
                              <p>
                                Based on <strong className="text-white">{activeProject.startupName}</strong>&apos;s evaluation parameters,
                                we structured a modular blueprint for the recommended provider: <strong className="text-emerald-400">{selectedProviderName || evaluation.recommendations[0].providerName}</strong>.
                              </p>

                              <div className="border-t border-[#27272a] pt-3.5 space-y-2">
                                <div className="flex justify-between font-mono text-[10px]">
                                  <span>WORKLOAD TYPE:</span>
                                  <span className="text-white font-semibold">{activeProject.projectType}</span>
                                </div>
                                <div className="flex justify-between font-mono text-[10px]">
                                  <span>TARGET REGION:</span>
                                  <span className="text-white font-semibold uppercase">{activeProject.region}</span>
                                </div>
                                <div className="flex justify-between font-mono text-[10px]">
                                  <span>PERSISTENCE SIZE:</span>
                                  <span className="text-white font-semibold uppercase">{activeProject.storageRequirement}</span>
                                </div>
                              </div>

                              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-lg space-y-2">
                                <span className="block font-bold text-[10px] uppercase font-mono text-blue-400">Included Resources:</span>
                                <ul className="space-y-1.5 list-disc pl-4 text-[11px]">
                                  <li>VPC Subnets & Gateway Router</li>
                                  <li>PostgreSQL Database (Managed)</li>
                                  {activeProject.needKubernetes && <li>Kubernetes Cluster & Autoscaling Workers</li>}
                                  {!activeProject.needKubernetes && <li>Secure server VM with static IPv4</li>}
                                  {activeProject.needAI && <li>GPU compute instance & Dedicated object storage</li>}
                                  {activeProject.needHighAvailability && <li>External Load Balancer & multi-region cluster settings</li>}
                                </ul>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Right: Code editor / previewer */}
                        <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
                          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col flex-grow">
                            
                            {/* Editor Header */}
                            <div className="px-5 py-3 border-b border-[#27272a] bg-[#1c1c21] flex justify-between items-center text-xs font-mono text-[#a1a1aa]">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="ml-2 font-semibold text-[#fafafa]">{activeTfFile}</span>
                              </span>
                              <span>HCL / TERRAFORM ENGINE</span>
                            </div>

                            {/* Editor Code Textarea / display */}
                            <div className="p-6 bg-[#09090b] font-mono text-xs text-[#d4d4d8] overflow-y-auto max-h-[600px] whitespace-pre leading-relaxed flex-grow scrollbar-thin select-text">
                              {generateTerraform(activeProject, selectedProviderName || evaluation.recommendations[0].providerName)[activeTfFile]}
                            </div>

                          </div>
                        </div>

                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* ==========================================
                  VIEW: COMPLIANCE REPORTS
                  ========================================== */}
              {activeTab === ActiveTab.Reports && (
                <div className="space-y-6">
                  
                  {activeProject && evaluation ? (
                    <div className="space-y-6">
                      
                      {/* Control Panel */}
                      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-[#18181b] p-5 rounded-xl border border-[#27272a]">
                        <div>
                          <h3 className="font-bold text-sm text-white">CloudPilot Compliance Export Suite</h3>
                          <p className="text-xs text-[#a1a1aa] mt-0.5">Download real-time cost sheets and system markdown profiles</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyReport}
                            className="px-3.5 py-1.5 border border-[#27272a] hover:bg-[#27272a]/40 text-xs font-semibold rounded-lg text-[#fafafa] flex items-center gap-1.5 transition-all"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {isCopying ? 'Copied!' : 'Copy Markdown'}
                          </button>
                          
                          <button
                            onClick={handlePrintReport}
                            className="px-3.5 py-1.5 border border-[#27272a] hover:bg-[#27272a]/40 text-xs font-semibold rounded-lg text-[#fafafa] flex items-center gap-1.5 transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Report
                          </button>

                          <a
                            href={`/api/reports?projectId=${activeProject.id}&format=csv`}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/10 transition-all font-mono uppercase"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download CSV
                          </a>
                        </div>
                      </div>

                      {/* Markdown Preview Area */}
                      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-[#27272a] bg-[#1c1c21] flex justify-between items-center text-xs font-mono text-[#a1a1aa]">
                          <span>REPORT PREVIEW (MARKDOWN)</span>
                          <span>{activeProject.startupName}</span>
                        </div>
                        <div className="p-6 bg-[#09090b] font-mono text-xs text-[#a1a1aa] overflow-y-auto max-h-[500px] whitespace-pre-wrap leading-relaxed select-text">
                          {reportMarkdown}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center text-[#a1a1aa]">
                      <AlertCircle className="w-12 h-12 stroke-1 text-[#52525b] mx-auto mb-4" />
                      <p className="font-semibold text-white">No Evaluation Profile Available</p>
                      <p className="text-xs mt-1">Please launch the cloud questionnaire to generate printable compliance reports.</p>
                    </div>
                  )}

                </div>
              )}

              {/* ==========================================
                  VIEW: ENGINE SETTINGS
                  ========================================== */}
              {activeTab === ActiveTab.Settings && (
                <div className="max-w-2xl mx-auto bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden p-8 shadow-xl space-y-6">
                  
                  <div>
                    <h3 className="font-bold text-lg text-white">Configurable Engine Weights Matrix</h3>
                    <p className="text-xs text-[#a1a1aa] mt-1">
                      Customize how the scoring algorithm prioritizes various parameters. Weights must reflect business context.
                    </p>
                  </div>

                  <div className="space-y-5 bg-[#09090b] p-6 rounded-xl border border-[#27272a] select-none">
                    
                    {/* Weight: Cost */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Cost Effectiveness weight</span>
                        <span className="text-blue-400 font-bold">{weights.cost}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.cost}
                        onChange={(e) => handleWeightChange('cost', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Weight: Performance */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Raw compute performance</span>
                        <span className="text-blue-400 font-bold">{weights.performance}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.performance}
                        onChange={(e) => handleWeightChange('performance', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Weight: Scalability */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Traffic scalability headroom</span>
                        <span className="text-blue-400 font-bold">{weights.scalability}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.scalability}
                        onChange={(e) => handleWeightChange('scalability', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Weight: Ease of Use */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Developer experience / ease of use</span>
                        <span className="text-blue-400 font-bold">{weights.easeOfUse}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.easeOfUse}
                        onChange={(e) => handleWeightChange('easeOfUse', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Weight: AI Services */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Native AI/ML Model pipelines</span>
                        <span className="text-blue-400 font-bold">{weights.aiServices}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.aiServices}
                        onChange={(e) => handleWeightChange('aiServices', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Weight: Kubernetes */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#fafafa] font-bold uppercase">Kubernetes clustering ecosystems</span>
                        <span className="text-blue-400 font-bold">{weights.kubernetes}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={weights.kubernetes}
                        onChange={(e) => handleWeightChange('kubernetes', Number(e.target.value))}
                        className="w-full accent-blue-600 h-1 bg-[#27272a] rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4 border-t border-[#27272a]/60">
                    <button 
                      onClick={restoreDefaultWeights}
                      className="px-4 py-2 border border-[#27272a] rounded-lg text-xs font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/20 transition-all font-mono uppercase"
                    >
                      Restore Defaults
                    </button>
                    <button 
                      onClick={applyWeights}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/10 transition-all uppercase font-mono"
                    >
                      Apply Parameters
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
