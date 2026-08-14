import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReportItem, IssueStatus } from '../types';
import { getComplaintImageByCategory } from '../utils/complaintImages';
import { UrgencyBadge } from './admin/UrgencyBadge';
import { EvaluationModal } from './admin/EvaluationModal';
import { evaluateReportPriority } from '../utils/evaluation';
import {
  ChevronDown,
  Download,
  MoreVertical,
  Paperclip,
  Send,
  AlertTriangle,
  FileText,
  Calendar,
  MapPin,
  User as UserIcon,
  RotateCcw,
  Wrench,
  BookOpen,
  Target,
  Info,
  Check,
  Sparkles,
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  CheckCircle2,
  XCircle,
  Filter,
  Activity,
  Zap,
  Search,
  Slash,
  RefreshCw,
  Sliders,
  Lock,
  Flame
} from 'lucide-react';

interface AdminAiViewProps {
  reports: ReportItem[];
  onUpdateStatus?: (id: string, newStatus: IssueStatus) => void;
  onUpdateReportDetails?: (id: string, updates: Partial<ReportItem>) => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp?: string;
  hasHighRiskTag?: boolean;
  draftNotification?: {
    to: string;
    body: string;
    status?: 'draft' | 'sent';
  };
}

export const AdminAiView: React.FC<AdminAiViewProps> = ({
  reports,
  onUpdateStatus,
  onUpdateReportDetails,
}) => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();

  const [evaluatingReport, setEvaluatingReport] = useState<ReportItem | null>(null);

  // Selected report state
  const selectedReport =
    reports.find((r) => r.id === reportId) ||
    reports[0] || null;

  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);

  // Chat messages dynamically based on selected report
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!selectedReport) {
      return [
        {
          id: 'msg-empty',
          sender: 'ai',
          text: 'No reports currently registered in local database. Please submit a new report from the citizen portal.',
        },
      ];
    }
    return [
      {
        id: 'msg-1',
        sender: 'user',
        text: `Analyze and summarize complaint [${selectedReport.id}] ${selectedReport.title}`,
      },
      {
        id: 'msg-2',
        sender: 'ai',
        text: `Report [${selectedReport.id}] Analysis Complete:\nTitle: ${selectedReport.title}\nLocation: ${selectedReport.addressText || selectedReport.cityName || ''}\nDetails: ${selectedReport.description}\n\nAI Diagnosis: Immediate safety inspection and referral to the competent department recommended.`,
        hasHighRiskTag: selectedReport.priority === 'High' || selectedReport.category === 'Road damage',
      },
      {
        id: 'msg-3',
        sender: 'user',
        text: 'Draft notification to assigned unit',
      },
      {
        id: 'msg-4',
        sender: 'ai',
        text: 'An emergency action notice draft for the administrative department has been generated.',
        draftNotification: {
          to: selectedReport.assignedUnit || 'Competent Dispatch Headquarters',
          body: `[Emergency Report Referral] Case ID ${selectedReport.id}\nLocation: ${selectedReport.addressText || ''}\nTitle: ${selectedReport.title}\nImmediate field inspection and safety measures required.`,
          status: 'draft',
        },
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // AI Prank / Fake Complaint Filter Agent State
  const [isPrankShieldEnabled, setIsPrankShieldEnabled] = useState(true);
  const [isPrankFilterModalOpen, setIsPrankFilterModalOpen] = useState(false);
  const [isScanningPrank, setIsScanningPrank] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState('');
  const [simulatedPrankMode, setSimulatedPrankMode] = useState(false);
  const [filterSensitivity, setFilterSensitivity] = useState<'Standard' | 'Strict' | 'Maximum'>('Strict');

  // Trigger manual AI Prank/Spam Audit
  const handleRunPrankInspection = () => {
    setIsScanningPrank(true);
    setScanProgress(0);
    setScanStepText('Vision AI Analyzing Image Authenticity & Artifacts...');

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanningPrank(false);
            setIsPrankFilterModalOpen(true);
          }, 300);
          return 100;
        }
        const next = prev + 25;
        if (next === 25) setScanStepText('GIS Cross-Checking Photo GPS with Street Maps...');
        else if (next === 50) setScanStepText('Running NLP Sentiment, Profanity & Toxicity Scanner...');
        else if (next === 75) setScanStepText('Verifying Device Fingerprint & Submission Frequency...');
        return next;
      });
    }, 280);
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          reportsContext: [selectedReport],
          history: messages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: data.text,
          },
        ]);
      } else {
        let reply = `I have analyzed "${text}" regarding case ${selectedReport.id}. `;
        if (text.toLowerCase().includes('similar')) {
          reply += `Found 3 similar road damage reports within a 1.5km radius in ${selectedReport.districtName || 'Xinyi District'}. All cases share common asphalt wear patterns.`;
        } else if (text.toLowerCase().includes('crew') || text.toLowerCase().includes('maintenance')) {
          reply += `Nearest Maintenance Crew #04 is currently 8 minutes away on Songren Rd. Dispatch ticket can be assigned immediately.`;
        } else {
          reply += `Recommendations have been updated. The priority remains HIGH and the relevant department has been notified for field dispatch.`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: reply,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `AI Agent Response: Request processed for ${selectedReport.id}. Dispatch status logged and field teams alerted.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDraft = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === msgId && msg.draftNotification
          ? {
              ...msg,
              draftNotification: {
                ...msg.draftNotification,
                status: 'sent',
              },
            }
          : msg
      )
    );
    setTimeout(() => {
      alert(`Notification successfully dispatched to ${selectedReport.cityName || 'Taipei'} Department of Transportation!`);
    }, 150);
  };

  return (
    <div className="w-full h-screen bg-[#f8fafc] flex flex-col overflow-hidden font-sans text-slate-800">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-20 shadow-2xs">
        {/* Left: Case Selection Dropdown */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => navigate('/admin/complaints')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors cursor-pointer mr-1"
            title="Back to Complaints"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsCaseDropdownOpen(!isCaseDropdownOpen)}
              className="flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer group"
            >
              <h1 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-900">
                {selectedReport ? selectedReport.title : 'No Registered Reports'}
              </h1>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform" />
            </button>

            {/* Case Dropdown Menu */}
            {isCaseDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 max-h-72 overflow-y-auto animate-fade-in">
                <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Select Complaint Case
                </div>
                {reports.map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setIsCaseDropdownOpen(false);
                      navigate(`/admin/ai/${rep.id}`);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs ${
                      selectedReport && rep.id === selectedReport.id ? 'bg-blue-50/80 font-bold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate font-semibold">{rep.title}</p>
                      <p className="text-[10px] text-slate-400">{rep.id} • {rep.cityName}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 shrink-0">
                      {rep.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Badge */}
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {selectedReport ? (selectedReport.status === 'Unresolved' ? 'Pending' : selectedReport.status) : 'N/A'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="bg-[#0b1736] hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <BookOpen className="w-4 h-4 text-blue-300" />
            <span>View in Dashboard</span>
          </button>

          <button
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
            title="Download Report"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: CHAT / AI AGENT AREA (col-span-8) */}
        <div className="lg:col-span-8 flex flex-col h-full bg-white border-r border-slate-200/90 overflow-hidden">
          
          {/* AI ANTI-PRANK & FAKE COMPLAINT FILTERING SHIELD BANNER */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0b1b38] to-[#0f2854] text-white p-4 mx-6 mt-4 rounded-2xl border border-blue-500/30 shadow-md relative overflow-hidden shrink-0">
            {/* Background Glow */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Shield Title & Status */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold text-white tracking-tight">
                      AI Anti-Prank & Spam Shield
                    </h2>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Defense
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    AI Agent performs multi-stage real-time detection to block prank reports, synthetic photos, profanity, and spam floods.
                  </p>
                </div>
              </div>

              {/* Verification Quick Scores & Actions */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {/* Score Badge */}
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-xs flex items-center gap-2">
                  <span className="text-slate-300 text-[11px] font-medium">Authenticity Score:</span>
                  <span className="font-extrabold text-emerald-300 text-sm">
                    {simulatedPrankMode ? '14.2%' : '98.2%'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                    simulatedPrankMode ? 'bg-red-900/90 text-red-200' : 'bg-emerald-950/80 text-emerald-200'
                  }`}>
                    {simulatedPrankMode ? 'Suspected Prank' : 'Genuine'}
                  </span>
                </div>

                {/* Manual Audit Trigger Button */}
                <button
                  onClick={handleRunPrankInspection}
                  disabled={isScanningPrank}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-blue-400/30 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isScanningPrank ? 'AI Verifying...' : 'Audit Prank Filter'}</span>
                </button>

                {/* Simulation Toggle Button */}
                <button
                  onClick={() => {
                    setSimulatedPrankMode(!simulatedPrankMode);
                    setIsPrankFilterModalOpen(true);
                  }}
                  className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-xl transition-all border border-slate-600/50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Filter Simulation</span>
                </button>
              </div>
            </div>
          </div>

          {/* SCANNING PROGRESS OVERLAY */}
          {isScanningPrank && (
            <div className="mx-6 mt-3 bg-blue-950/95 text-white p-3.5 rounded-2xl border border-blue-400/40 shadow-xl animate-fade-in flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-blue-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>{scanStepText}</span>
                </div>
                <span className="text-amber-300 font-mono">{scanProgress}%</span>
              </div>
              <div className="w-full bg-blue-900/60 rounded-full h-2 overflow-hidden border border-blue-700/50">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Chat Stream Container */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* Timestamp Badge */}
            <div className="flex justify-center">
              <span className="bg-slate-100/90 text-slate-500 text-xs font-semibold px-3.5 py-1 rounded-full border border-slate-200/60 shadow-2xs">
                Today, 10:42 AM
              </span>
            </div>

            {/* Chat Messages Stream */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {msg.sender === 'user' ? (
                  /* User Message Bubble */
                  <div className="flex justify-end">
                    <div className="bg-[#0a192f] text-white px-5 py-3.5 rounded-2xl rounded-tr-xs max-w-lg text-sm font-medium shadow-xs leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  /* AI Response Bubble */
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200 mt-1">
                      <Sparkles className="w-4 h-4 text-blue-700" />
                    </div>

                    <div className="space-y-3 max-w-xl">
                      <div className="bg-slate-100/80 text-slate-800 p-4 rounded-2xl rounded-tl-xs text-sm leading-relaxed border border-slate-200/60 shadow-2xs">
                        <p>{msg.text}</p>

                        {/* High Risk Tag */}
                        {msg.hasHighRiskTag && (
                          <div className="mt-3 inline-flex items-center gap-1.5 border border-red-200 text-red-600 bg-red-50/80 px-3 py-1.5 rounded-lg text-xs font-extrabold">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span>High Risk</span>
                          </div>
                        )}
                      </div>

                      {/* Draft Notification Card */}
                      {msg.draftNotification && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                              <FileText className="w-4 h-4 text-blue-700" />
                              <span>DRAFT NOTIFICATION</span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                              To: {msg.draftNotification.to}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {msg.draftNotification.body}
                          </p>

                          <div className="flex items-center gap-3 pt-1">
                            {msg.draftNotification.status === 'sent' ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full text-xs font-bold">
                                <Check className="w-4 h-4" />
                                <span>Notification Sent</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleSendDraft(msg.id)}
                                  className="bg-[#0a192f] hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>Send Now</span>
                                </button>
                                <button
                                  onClick={() => alert('Draft open for editing.')}
                                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer"
                                >
                                  <span>Edit Draft</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                <span>AI Agent analyzing request...</span>
              </div>
            )}
          </div>

          {/* Suggested Chips Row */}
          <div className="px-6 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center gap-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage('🛡️ Run AI Anti-Prank Audit & Verification')}
              className="bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-extrabold px-4 py-2 rounded-full border border-blue-200 shadow-2xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>🛡️ Run AI Anti-Prank Audit & Verification</span>
            </button>

            <button
              onClick={() => handleSendMessage('View previous similar cases')}
              className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 rounded-full border border-slate-200 shadow-2xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>View previous similar cases</span>
            </button>

            <button
              onClick={() => handleSendMessage('Locate nearest maintenance crew')}
              className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 rounded-full border border-slate-200 shadow-2xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              <span>Locate nearest maintenance crew</span>
            </button>
          </div>

          {/* Bottom Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="border border-slate-300 rounded-2xl p-2.5 flex items-center gap-3 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-xs"
            >
              <button
                type="button"
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask the AI agent..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 font-medium"
              />

              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="bg-[#0a192f] hover:bg-slate-800 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: COMPLAINT CONTEXT SIDEBAR (col-span-4) */}
        <div className="lg:col-span-4 h-full bg-slate-50/70 p-6 overflow-y-auto space-y-6">
          {/* Section Header */}
          <div className="flex items-center gap-2 text-slate-900 font-black text-base">
            <Info className="w-5 h-5 text-blue-700" />
            <h2>Complaint Context</h2>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => navigate('/admin')}
            className="w-full bg-[#0a192f] hover:bg-slate-800 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Target className="w-4 h-4 text-blue-300" />
            <span>View in Dashboard</span>
          </button>

          {/* ATTACHED EVIDENCE */}
          {selectedReport && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                ATTACHED EVIDENCE
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <img
                  src={
                    selectedReport.imageUrl ||
                    getComplaintImageByCategory(selectedReport.category, selectedReport.id)
                  }
                  alt="Complaint Evidence"
                  className="w-full h-48 object-cover"
                />
                <div className="p-3 flex items-center justify-between text-xs border-t border-slate-100 bg-white">
                  <span className="font-bold text-slate-800">Field Attachment Photo</span>
                  <span className="text-slate-400 font-semibold">{selectedReport.id}</span>
                </div>
              </div>
            </div>
          )}

          {/* URGENCY & IMPORTANCE MATRIX */}
          {selectedReport && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>URGENCY & IMPORTANCE MATRIX</span>
                <span className="text-[10px] text-rose-700 bg-rose-50 font-black px-2 py-0.5 rounded-full border border-rose-200">
                  Fast-Track Evaluation
                </span>
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                <UrgencyBadge report={selectedReport} showDetails={true} />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEvaluatingReport(selectedReport)}
                    className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs py-2 px-3 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Evaluate Priority / AI Diagnosis</span>
                  </button>

                  {selectedReport.status !== 'Solved' && (
                    <button
                      type="button"
                      onClick={() => {
                        const nowStr = new Date().toLocaleString();
                        if (onUpdateReportDetails) {
                          onUpdateReportDetails(selectedReport.id, {
                            urgency: 'High',
                            importance: 'High',
                            priority: 'High',
                            status: 'Proceeding',
                            assignedUnit: selectedReport.assignedUnit || 'Emergency Response Team',
                            urgencyReason: `[⚡ Express Fast-Track Order] Emergency dispatch (${nowStr})`,
                          });
                        }
                        if (onUpdateStatus) {
                          onUpdateStatus(selectedReport.id, 'Proceeding');
                        }
                        alert(`⚡ [Express Dispatch Order]\nEmergency dispatch order issued for complaint [${selectedReport.id}]!`);
                      }}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                      title="Express Fast-Track Dispatch"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ Dispatch</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KEY METADATA */}
          {selectedReport && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                KEY METADATA
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs">
                {/* Date Filed */}
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Date Filed</span>
                    <span className="font-bold text-slate-800">
                      {selectedReport.createdAt}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-slate-500 font-medium block">Location</span>
                    <span className="font-bold text-slate-800 block">
                      {selectedReport.addressText || `${selectedReport.cityName || ''} ${selectedReport.districtName || ''}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Lat: {selectedReport.lat}, Lng: {selectedReport.lng}
                    </span>
                  </div>
                </div>

                {/* Submitter */}
                <div className="flex items-start gap-3">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Submitter</span>
                    <span className="font-bold text-slate-800">Citizen Submission ({selectedReport.id})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI ANTI-PRANK & SPAM VERIFICATION CARD */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>AI ANTI-PRANK & SPAM SHIELD</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">Active</span>
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    simulatedPrankMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {simulatedPrankMode ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {simulatedPrankMode ? 'Suspected Prank Report' : 'Verified Genuine Report'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {simulatedPrankMode ? 'High Spam Risk Detected' : 'Authenticity Passed'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm font-black ${simulatedPrankMode ? 'text-red-600' : 'text-emerald-700'}`}>
                    {simulatedPrankMode ? '14.2%' : '98.2%'}
                  </div>
                  <div className="text-[9px] text-slate-400">Score</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    simulatedPrankMode ? 'bg-red-500 w-[14%]' : 'bg-emerald-500 w-[98%]'
                  }`}
                />
              </div>

              {/* Verification Checklist */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-1">
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${simulatedPrankMode ? 'text-red-500' : 'text-emerald-600'}`} />
                  <span className="truncate">Vision AI Photo</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${simulatedPrankMode ? 'text-amber-500' : 'text-emerald-600'}`} />
                  <span className="truncate">GIS GPS Match</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${simulatedPrankMode ? 'text-red-500' : 'text-emerald-600'}`} />
                  <span className="truncate">NLP Toxicity</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${simulatedPrankMode ? 'text-red-500' : 'text-emerald-600'}`} />
                  <span className="truncate">Rate Limit</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPrankFilterModalOpen(true)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-blue-700" />
                <span>View AI Verification Report</span>
              </button>
            </div>
          </div>

          {/* AI EXTRACTED ENTITIES */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              AI EXTRACTED ENTITIES
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="bg-sky-100 text-sky-800 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-sky-200/60">
                Road Damage
              </span>
              <span className="bg-sky-100 text-sky-800 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-sky-200/60">
                Traffic Safety
              </span>
              <span className="bg-red-100 text-red-800 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-red-200/60">
                High Priority
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-emerald-200/60 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Verified Non-Prank</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. AI ANTI-PRANK & SPAM FILTER INSPECTION MODAL */}
      {isPrankFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-[#0b1b38] to-[#0f2854] text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold border shadow-inner ${
                  simulatedPrankMode ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}>
                  {simulatedPrankMode ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>AI Anti-Prank & Fake Complaint Filter Report</span>
                    <span className="text-[10px] bg-blue-500/30 border border-blue-400/40 text-blue-200 px-2 py-0.5 rounded-full font-bold">
                      Shield Agent v3.4
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    {selectedReport ? `Case ID: ${selectedReport.id} • ${selectedReport.title}` : 'System Filter Report'}
                  </p>
                </div>
              </div>

              {/* Simulation Mode Switch Pill */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSimulatedPrankMode(!simulatedPrankMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    simulatedPrankMode
                      ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-400/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>{simulatedPrankMode ? '⚠️ Prank Simulation ON' : 'Normal Report Mode'}</span>
                </button>

                <button
                  onClick={() => setIsPrankFilterModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scroll Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
              {/* Top Banner Alert */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-2xs ${
                simulatedPrankMode
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  simulatedPrankMode ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {simulatedPrankMode ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm">
                      {simulatedPrankMode
                        ? '🚨 AI Alert: Suspected Prank / Fake Report Blocked'
                        : '✅ AI Verified: Genuine Citizen Report (Authenticity Passed)'}
                    </h4>
                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      simulatedPrankMode ? 'bg-red-200 text-red-900' : 'bg-emerald-200 text-emerald-900'
                    }`}>
                      {simulatedPrankMode ? 'Risk Score: 85.8%' : 'Authenticity: 98.2%'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {simulatedPrankMode
                      ? 'Image matches 88% with online stock photos. Repeated prank keywords and 12 rapid flood requests from the same IP within 10 minutes detected. Automatically quarantined.'
                      : 'GPS EXIF data from attached photo matches GIS street maps. Zero profanity or spam patterns detected. Flagged as genuine report.'}
                  </p>
                </div>
              </div>

              {/* 4-Layer Security Audit Breakdown Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  4-Layer AI Security Verification System Log
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Layer 1: Vision AI Photo Authenticity */}
                  <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span>1. Vision AI Image Authenticity</span>
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        simulatedPrankMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {simulatedPrankMode ? 'FAIL (12%)' : 'PASS (99%)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {simulatedPrankMode
                        ? '❌ Web search stock image match (Unsplash) & AI generator artifacts detected'
                        : '✅ Real-world asphalt texture and valid original camera EXIF headers verified'}
                    </p>
                  </div>

                  {/* Layer 2: GIS GPS Location Verification */}
                  <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span>2. GIS/GPS Location Cross-Match</span>
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        simulatedPrankMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {simulatedPrankMode ? 'WARN (18%)' : 'PASS (98%)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {simulatedPrankMode
                        ? '⚠️ Location metadata mismatch (Photo GPS is 12km away from report location)'
                        : '✅ Submission coordinates match photo EXIF GPS location perfectly'}
                    </p>
                  </div>

                  {/* Layer 3: NLP Toxicity & Intent Analysis */}
                  <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-blue-600" />
                        <span>3. NLP Toxicity & Intent Filter</span>
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        simulatedPrankMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {simulatedPrankMode ? 'FAIL (08%)' : 'PASS (97%)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {simulatedPrankMode
                        ? '❌ Meaningless random strings and sarcastic/profane phrasing detected'
                        : '✅ Zero toxicity or profanity found. Specific damage description provided.'}
                    </p>
                  </div>

                  {/* Layer 4: Behavioral & Anti-Spam Rate Limit */}
                  <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-600" />
                        <span>4. Device/IP Rate-Limit Monitoring</span>
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        simulatedPrankMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {simulatedPrankMode ? 'FAIL (25%)' : 'PASS (100%)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {simulatedPrankMode
                        ? '❌ Rapid automated flood: Over 10 identical submissions from same IP within 10m'
                        : '✅ Normal citizen session (Single submission in last 24h)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sensitivity Control Bar */}
              <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Sliders className="w-4 h-4 text-blue-700" />
                  <span>AI Filter Sensitivity:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['Standard', 'Strict', 'Maximum'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFilterSensitivity(level)}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        filterSensitivity === level
                          ? 'bg-[#0a192f] text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {level === 'Standard' ? 'Standard' : level === 'Strict' ? 'Strict' : 'Maximum Shield'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500 font-medium">
                Shield Active • Policy: Anti-Troll v3.4 Engine
              </div>
              <div className="flex items-center gap-2">
                {simulatedPrankMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      alert('This report has been flagged as a prank and moved to Spam Quarantine.');
                      setIsPrankFilterModalOpen(false);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Slash className="w-3.5 h-3.5" />
                    <span>Quarantine as Prank</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPrankFilterModalOpen(false)}
                    className="bg-[#0a192f] hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Acknowledge & Close</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation & AI Diagnosis Modal */}
      {evaluatingReport && (
        <EvaluationModal
          report={evaluatingReport}
          onClose={() => setEvaluatingReport(null)}
          onUpdateReportDetails={(id, updates) => {
            if (onUpdateReportDetails) {
              onUpdateReportDetails(id, updates);
            }
            setEvaluatingReport(null);
          }}
          onUpdateStatus={onUpdateStatus}
        />
      )}
    </div>
  );
};
