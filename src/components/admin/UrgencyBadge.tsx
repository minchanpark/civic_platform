import React from 'react';
import { ReportItem } from '../../types';
import { evaluateReportPriority } from '../../utils/evaluation';

interface UrgencyBadgeProps {
  report: ReportItem;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({
  report,
  size = 'md',
  showDetails = false,
}) => {
  const evalResult = evaluateReportPriority(report);

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${evalResult.badgeBg} ${evalResult.badgeBorder}`}
        >
          {evalResult.labelKo}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Combined Priority Grade Badge */}
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-lg border shadow-2xs ${evalResult.badgeBg} ${evalResult.badgeBorder}`}
        >
          <span className="material-symbols-outlined text-sm">
            {evalResult.isFastTrack ? 'bolt' : 'priority_high'}
          </span>
          <span>{evalResult.labelKo}</span>
          <span className="ml-1 text-[10px] opacity-90 px-1.5 py-0.2 bg-black/20 rounded font-mono">
            {evalResult.score} pts
          </span>
        </span>

        {/* Individual Urgency & Importance Pills */}
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
          <span className="text-slate-500">Urgency:</span>
          <span
            className={
              evalResult.urgency === 'High'
                ? 'text-rose-700 font-extrabold'
                : evalResult.urgency === 'Medium'
                ? 'text-amber-700 font-bold'
                : 'text-slate-600'
            }
          >
            {evalResult.urgency === 'High' ? 'High' : evalResult.urgency === 'Medium' ? 'Medium' : 'Low'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Importance:</span>
          <span
            className={
              evalResult.importance === 'High'
                ? 'text-rose-700 font-extrabold'
                : evalResult.importance === 'Medium'
                ? 'text-amber-700 font-bold'
                : 'text-slate-600'
            }
          >
            {evalResult.importance === 'High' ? 'High' : evalResult.importance === 'Medium' ? 'Medium' : 'Low'}
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 leading-relaxed mt-1 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-sm text-blue-600 shrink-0 mt-0.5">
            info
          </span>
          <span>{evalResult.reasonKo}</span>
        </div>
      )}
    </div>
  );
};
