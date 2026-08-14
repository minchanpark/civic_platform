import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReportItem, IssueStatus } from '../../types';
import { getComplaintImageByCategory } from '../../utils/complaintImages';
import { UrgencyBadge } from './UrgencyBadge';
import { EvaluationModal } from './EvaluationModal';
import { evaluateReportPriority } from '../../utils/evaluation';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Sparkles,
  Map as MapIcon,
  ChevronDown,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';

interface AdminComplaintsListViewProps {
  reports: ReportItem[];
  onUpdateStatus: (id: string, newStatus: IssueStatus) => void;
  onUpdateReportDetails?: (id: string, updates: Partial<ReportItem>) => void;
  onSelectReportOnMap: (id: string) => void;
}

export const AdminComplaintsListView: React.FC<AdminComplaintsListViewProps> = ({
  reports,
  onUpdateStatus,
  onUpdateReportDetails,
  onSelectReportOnMap,
}) => {
  const navigate = useNavigate();
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'fast-track' | 'urgency' | 'importance' | 'newest'>('fast-track');
  const [evaluatingReport, setEvaluatingReport] = useState<ReportItem | null>(null);
  const [aiReportModalItem, setAiReportModalItem] = useState<ReportItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Status Counts
  const totalCount = reports.length;
  const pendingCount = reports.filter((r) => r.status === 'Unresolved').length;
  const inProgressCount = reports.filter((r) => r.status === 'Proceeding').length;
  const solvedCount = reports.filter((r) => r.status === 'Solved').length;
  const deniedCount = reports.filter((r) => r.status === 'Denied').length;
  const fastTrackCount = reports.filter(
    (r) => evaluateReportPriority(r).isFastTrack
  ).length;

  // Multi-select toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredList: ReportItem[]) => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((r) => r.id));
    }
  };

  // Batch Fast-Track Express Dispatch
  const handleBatchExpressDispatch = () => {
    if (selectedIds.length === 0) return;
    const nowStr = new Date().toLocaleString();
    selectedIds.forEach((id) => {
      if (onUpdateReportDetails) {
        onUpdateReportDetails(id, {
          urgency: 'High',
          importance: 'High',
          priority: 'High',
          status: 'Proceeding',
          assignedUnit: 'Emergency Response Team',
          urgencyReason: `[⚡ Batch Express Dispatch Order] Emergency dispatch order issued (${nowStr})`,
        });
      }
      onUpdateStatus(id, 'Proceeding');
    });

    alert(`⚡ [Batch Express Dispatch Order Dispatched]\nEmergency response orders issued for ${selectedIds.length} selected complaints!`);
    setSelectedIds([]);
  };

  // Filtered reports
  let filteredReports = reports.filter((rep) => {
    const evalRes = evaluateReportPriority(rep);

    const matchStatus =
      activeStatusFilter === 'All' ||
      (activeStatusFilter === 'FastTrack' && evalRes.isFastTrack) ||
      (activeStatusFilter === 'Unresolved' && rep.status === 'Unresolved') ||
      (activeStatusFilter === 'Proceeding' && rep.status === 'Proceeding') ||
      (activeStatusFilter === 'Solved' && rep.status === 'Solved') ||
      (activeStatusFilter === 'Denied' && rep.status === 'Denied');

    const matchCategory =
      selectedCategory === 'All' || rep.category === selectedCategory;

    const matchSearch =
      !searchQuery.trim() ||
      rep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.addressText.toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchCategory && matchSearch;
  });

  // Sorting
  filteredReports.sort((a, b) => {
    const evalA = evaluateReportPriority(a);
    const evalB = evaluateReportPriority(b);

    if (sortBy === 'fast-track') {
      return evalB.score - evalA.score;
    }
    if (sortBy === 'urgency') {
      const uOrder = { High: 3, Medium: 2, Low: 1 };
      return (uOrder[evalB.urgency] || 1) - (uOrder[evalA.urgency] || 1);
    }
    if (sortBy === 'importance') {
      const iOrder = { High: 3, Medium: 2, Low: 1 };
      return (iOrder[evalB.importance] || 1) - (iOrder[evalA.importance] || 1);
    }
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="w-full h-full bg-[#f4f5fa] p-6 overflow-y-auto space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Complaints Management & Priority Matrix</span>
            <span className="text-xs bg-rose-600 text-white font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Fast-Track</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Diagnose urgency & importance via AI and perform priority fast-track dispatch for critical issues.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, ID, address..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs font-extrabold text-blue-900 outline-none cursor-pointer hover:border-slate-400 shadow-2xs"
            >
              <option value="fast-track">⚡ Priority Score (Fast-Track)</option>
              <option value="urgency">🚨 Highest Urgency</option>
              <option value="importance">⚠️ Highest Importance</option>
              <option value="newest">📅 Newest First</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-xl px-3 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400 shadow-2xs"
            >
              <option value="All">All Categories</option>
              <option value="Road damage">Traffic / Road</option>
              <option value="Environmental issue">Environment / Sanitation</option>
              <option value="Building damage">Architecture / Construction</option>
              <option value="Facility issue">Facility Issue</option>
              <option value="Disaster">Disaster / Emergency</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {/* Fast-Track Tab */}
          <button
            onClick={() => setActiveStatusFilter('FastTrack')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeStatusFilter === 'FastTrack'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>⚡ Urgent Fast-Track</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900 text-white font-extrabold">
              {fastTrackCount}
            </span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeStatusFilter === 'All'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>All Complaints</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeStatusFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('Unresolved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeStatusFilter === 'Unresolved'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Pending</span>
            <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded-full text-[10px]">
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('Proceeding')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeStatusFilter === 'Proceeding'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>In Progress</span>
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-full text-[10px]">
              {inProgressCount}
            </span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('Solved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeStatusFilter === 'Solved'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Solved</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-full text-[10px]">
              {solvedCount}
            </span>
          </button>
        </div>

        {/* Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-300 p-2 rounded-2xl shadow-xs animate-fade-in">
            <span className="text-xs font-black text-rose-900 px-2">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={handleBatchExpressDispatch}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-xs cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Batch Express Dispatch Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Complaints Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredReports.length > 0 &&
                      selectedIds.length === filteredReports.length
                    }
                    onChange={() => toggleSelectAll(filteredReports)}
                    className="rounded border-slate-300 text-blue-900 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Complaint Info</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Urgency & Importance</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-sm">
                    No complaints match the specified filters.
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => {
                  const isSelected = selectedIds.includes(rep.id);
                  const isPending = rep.status === 'Unresolved';
                  const isInProgress = rep.status === 'Proceeding';
                  const isSolved = rep.status === 'Solved';
                  const priorityEval = evaluateReportPriority(rep);

                  return (
                    <tr
                      key={rep.id}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        priorityEval.isFastTrack ? 'bg-rose-50/20' : ''
                      } ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rep.id)}
                          className="rounded border-slate-300 text-blue-900 cursor-pointer"
                        />
                      </td>

                      {/* Image & Title & Ref ID & Category & Location */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-3">
                          <img
                            src={
                              rep.imageUrl ||
                              getComplaintImageByCategory(rep.category, rep.id)
                            }
                            alt={rep.title}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                                {rep.title}
                              </h3>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {rep.id}
                              </span>
                              <span className="text-[10px] font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {rep.category || 'Road damage'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{rep.addressText}</span>
                            </div>

                            {rep.assignedUnit && (
                              <div className="text-[11px] text-blue-900 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-blue-700">shield</span>
                                <span>Dept: {rep.assignedUnit}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Urgency & Importance Badge Matrix */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <UrgencyBadge report={rep} showDetails={true} />
                      </td>

                      {/* Status Pill Dropdown */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <select
                          value={rep.status}
                          onChange={(e) => onUpdateStatus(rep.id, e.target.value as IssueStatus)}
                          className={`text-xs font-extrabold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-all ${
                            isPending
                              ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                              : isInProgress
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : isSolved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <option value="Unresolved">Pending</option>
                          <option value="Proceeding">In Progress</option>
                          <option value="Solved">Resolved</option>
                          <option value="Denied">Denied</option>
                        </select>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Express Dispatch Button */}
                          {!isSolved && (
                            <button
                              type="button"
                              onClick={() => {
                                const nowStr = new Date().toLocaleString();
                                if (onUpdateReportDetails) {
                                  onUpdateReportDetails(rep.id, {
                                    urgency: 'High',
                                    importance: 'High',
                                    priority: 'High',
                                    status: 'Proceeding',
                                    assignedUnit: rep.assignedUnit || 'Emergency Response Team',
                                    urgencyReason: `[⚡ Express Fast-Track Order] Emergency dispatch (${nowStr})`,
                                  });
                                }
                                onUpdateStatus(rep.id, 'Proceeding');
                                alert(`⚡ [Fast-Track Order Dispatched]\nEmergency dispatch order issued for complaint [${rep.id}]!`);
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="Express Fast-Track Dispatch"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              <span>⚡ Dispatch</span>
                            </button>
                          )}

                          {/* Evaluate Priority Button */}
                          <button
                            type="button"
                            onClick={() => setEvaluatingReport(rep)}
                            className="bg-blue-900 hover:bg-blue-800 text-white px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">tune</span>
                            <span>Evaluate / AI</span>
                          </button>

                          {/* Show on Map Button */}
                          <button
                            type="button"
                            onClick={() => onSelectReportOnMap(rep.id)}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          >
                            <MapIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>Map</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluation Modal */}
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
