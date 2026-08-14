import React, { useState } from 'react';
import { ReportItem, UrgencyLevel, ImportanceLevel, IssueStatus } from '../../types';
import { evaluateReportPriority, autoEvaluateReport } from '../../utils/evaluation';

interface EvaluationModalProps {
  report: ReportItem;
  onClose: () => void;
  onUpdateReportDetails: (id: string, updates: Partial<ReportItem>) => void;
  onUpdateStatus?: (id: string, newStatus: IssueStatus) => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  report,
  onClose,
  onUpdateReportDetails,
  onUpdateStatus,
}) => {
  const [urgency, setUrgency] = useState<UrgencyLevel>(
    report.urgency || (report.priority === 'High' ? 'High' : 'Medium')
  );
  const [importance, setImportance] = useState<ImportanceLevel>(
    report.importance || (report.category === 'Disaster' ? 'High' : 'Medium')
  );
  const [reason, setReason] = useState<string>(
    report.urgencyReason || ''
  );
  const [assignedUnit, setAssignedUnit] = useState<string>(
    report.assignedUnit || 'Emergency Response Team'
  );
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Government Units
  const governmentUnits = [
    'Emergency Response Team',
    'Public Works Dept (Road Repair)',
    'Environmental Protection Bureau',
    'Traffic Management Bureau',
    'Water Resources Bureau',
    'Parks & Public Lighting Division',
    'Traffic Police Division',
  ];

  // Current preview evaluation
  const previewEval = evaluateReportPriority({
    ...report,
    urgency,
    importance,
    urgencyReason: reason,
  });

  // Run AI Auto-Evaluation
  const handleRunAiEvaluation = () => {
    setIsAiLoading(true);
    setTimeout(() => {
      const result = autoEvaluateReport(report);
      setUrgency(result.urgency);
      setImportance(result.importance);
      setReason(result.urgencyReason);
      setIsAiLoading(false);
    }, 400);
  };

  // One-Click Express Fast-Track Dispatch
  const handleExpressFastTrackDispatch = () => {
    const nowStr = new Date().toLocaleString();
    onUpdateReportDetails(report.id, {
      urgency: 'High',
      importance: 'High',
      priority: 'High',
      urgencyReason: `[⚡ Fast-Track Express Order] Designated as top priority. Emergency order dispatched to ${assignedUnit}. (${nowStr})`,
      assignedUnit: assignedUnit || governmentUnits[0],
      status: 'Proceeding',
      fastTrackDispatchedAt: nowStr,
    });

    if (onUpdateStatus) {
      onUpdateStatus(report.id, 'Proceeding');
    }

    alert(`⚡ [Fast-Track Order Dispatched]\n\nComplaint ID: ${report.id}\nAssigned Unit: ${assignedUnit}\nUrgency: High | Importance: High\n\nWork order dispatched immediately!`);
    onClose();
  };

  // Save Standard Evaluation
  const handleSaveEvaluation = () => {
    onUpdateReportDetails(report.id, {
      urgency,
      importance,
      priority: urgency === 'High' || importance === 'High' ? 'High' : urgency === 'Medium' ? 'Medium' : 'Low',
      urgencyReason: reason || `[Admin Evaluation] Urgency: ${urgency}, Importance: ${importance} saved.`,
      assignedUnit,
    });
    alert(`Complaint [${report.id}] Urgency (${urgency}) & Importance (${importance}) saved successfully.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-300 space-y-5 text-slate-800">
        {/* Header */}
        <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-200">
                {report.id}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                {report.category}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900">{report.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Location: {report.cityName} {report.districtName} ({report.addressText})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* AI Auto-Evaluation Trigger Button */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-black text-xs text-amber-300">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              <span>AI Urgency & Importance Diagnosis</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-normal">
              Analyses photo pins, category keywords, description, and community votes to recommend priority tier.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunAiEvaluation}
            disabled={isAiLoading}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-md shrink-0 flex items-center gap-1 cursor-pointer"
          >
            {isAiLoading ? (
              <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-base">bolt</span>
            )}
            <span>Run AI Assessment</span>
          </button>
        </div>

        {/* Evaluation Selectors Form */}
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {/* 1. Urgency Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1 text-blue-900">
                <span className="material-symbols-outlined text-base text-rose-600">timer</span>
                <span>1. Urgency Level - How fast is field repair required?</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">High: Within 2 hours</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['High', 'Medium', 'Low'] as UrgencyLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setUrgency(lvl)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    urgency === lvl
                      ? lvl === 'High'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-300'
                        : lvl === 'Medium'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                        : 'bg-slate-700 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{lvl === 'High' ? '🚨 High' : lvl === 'Medium' ? '⚡ Medium' : '🟢 Low'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Importance Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1 text-blue-900">
                <span className="material-symbols-outlined text-base text-amber-600">warning</span>
                <span>2. Importance Level - High risk or community impact?</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">High: Safety Hazard</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['High', 'Medium', 'Low'] as ImportanceLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setImportance(lvl)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    importance === lvl
                      ? lvl === 'High'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-300'
                        : lvl === 'Medium'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                        : 'bg-slate-700 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{lvl === 'High' ? '⚠️ High' : lvl === 'Medium' ? '🔷 Medium' : '🟢 Low'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Combined Preview Badge */}
          <div className="p-3 bg-white rounded-xl border border-slate-300 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-500 font-bold block">Assessment Grade:</span>
              <span className="font-extrabold text-slate-900 text-sm">{previewEval.labelKo}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Priority Score</span>
              <span className="text-base font-black text-rose-600">{previewEval.score} / 100 pts</span>
            </div>
          </div>

          {/* Assigned Unit Selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Assigned Department:</label>
            <select
              value={assignedUnit}
              onChange={(e) => setAssignedUnit(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
            >
              {governmentUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Reason / Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Assessment Notes & Instructions:</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Record evaluation reason and work instructions..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* One-Click Fast Track Express Dispatch */}
          <button
            type="button"
            onClick={handleExpressFastTrackDispatch}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span>⚡ Express Fast-Track Dispatch</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEvaluation}
              className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-sm"
            >
              Save Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
