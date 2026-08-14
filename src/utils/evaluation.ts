import { ReportItem, UrgencyLevel, ImportanceLevel } from '../types';

export interface PriorityEvaluation {
  urgency: UrgencyLevel;
  importance: ImportanceLevel;
  score: number; // 0 - 100
  level: 'Critical' | 'High' | 'Medium' | 'Low';
  labelKo: string;
  labelEn: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isFastTrack: boolean;
  reasonKo: string;
  reasonEn: string;
}

// Extract or compute Urgency level
export const getReportUrgency = (report: ReportItem): UrgencyLevel => {
  if (report.urgency) return report.urgency;
  if (report.category === 'Disaster' || report.priority === 'High' || report.category === 'Road damage') {
    return 'High';
  }
  if (report.category === 'Building damage' || report.category === 'Facility issue') {
    return 'Medium';
  }
  return 'Low';
};

// Extract or compute Importance level
export const getReportImportance = (report: ReportItem): ImportanceLevel => {
  if (report.importance) return report.importance;
  if (report.category === 'Disaster' || report.category === 'Building damage' || (report.upvotes && report.upvotes >= 15)) {
    return 'High';
  }
  if (report.category === 'Road damage' || (report.photoPins && report.photoPins.length >= 2)) {
    return 'Medium';
  }
  return 'Low';
};

// Evaluate Priority Matrix
export const evaluateReportPriority = (report: ReportItem): PriorityEvaluation => {
  const urgency = getReportUrgency(report);
  const importance = getReportImportance(report);

  let score = 50;
  let level: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
  let labelKo = '⚡ Fast-Track Critical';
  let labelEn = '🚨 Fast-Track Critical';
  let badgeBg = 'bg-slate-100';
  let badgeText = 'text-slate-700';
  let badgeBorder = 'border-slate-300';
  let isFastTrack = false;
  let reasonKo = 'Queued for standard department processing.';
  let reasonEn = 'Queued for standard processing workflow.';

  // Scoring matrix logic
  if (urgency === 'High' && importance === 'High') {
    score = 98;
    level = 'Critical';
    labelKo = '🚨 Critical (Fast-Track)';
    labelEn = '🚨 Fast-Track Critical';
    badgeBg = 'bg-rose-600 text-white shadow-xs';
    badgeText = 'text-white';
    badgeBorder = 'border-rose-700';
    isFastTrack = true;
    reasonKo = 'High urgency & high importance. Instant fast-track dispatch required within 2 hours.';
    reasonEn = 'High urgency & high importance. Instant fast-track dispatch required within 2 hours.';
  } else if (urgency === 'High' && importance === 'Medium') {
    score = 82;
    level = 'High';
    labelKo = '⚡ Urgent Priority';
    labelEn = '⚡ Urgent Priority';
    badgeBg = 'bg-amber-500 text-white';
    badgeText = 'text-white';
    badgeBorder = 'border-amber-600';
    isFastTrack = true;
    reasonKo = 'High urgency for field repair. Same-day express dispatch recommended.';
    reasonEn = 'High urgency for field repair. Same-day express dispatch recommended.';
  } else if (urgency === 'Medium' && importance === 'High') {
    score = 80;
    level = 'High';
    labelKo = '⚠️ Important Priority';
    labelEn = '⚠️ Important Priority';
    badgeBg = 'bg-orange-100 text-orange-900';
    badgeText = 'text-orange-900';
    badgeBorder = 'border-orange-300';
    isFastTrack = true;
    reasonKo = 'High structural importance. Priority department allocation recommended.';
    reasonEn = 'High structural importance. Priority department allocation recommended.';
  } else if (urgency === 'Medium' && importance === 'Medium') {
    score = 60;
    level = 'Medium';
    labelKo = '🔷 Standard Issue';
    labelEn = '🔷 Standard Issue';
    badgeBg = 'bg-blue-50 text-blue-800';
    badgeText = 'text-blue-800';
    badgeBorder = 'border-blue-200';
    isFastTrack = false;
    reasonKo = 'Standard queue for routine department inspection.';
    reasonEn = 'Standard queue for routine department inspection.';
  } else {
    score = 35;
    level = 'Low';
    labelKo = '🟢 Low Urgency';
    labelEn = '🟢 Low Urgency';
    badgeBg = 'bg-slate-100 text-slate-700';
    badgeText = 'text-slate-700';
    badgeBorder = 'border-slate-300';
    isFastTrack = false;
    reasonKo = 'Low immediate risk. Scheduled for periodic maintenance.';
    reasonEn = 'Low immediate risk. Scheduled for periodic maintenance.';
  }

  // Boost for high upvotes or photo pin annotations
  if (report.upvotes && report.upvotes >= 30) {
    score = Math.min(100, score + 10);
    reasonKo += ` (Boosted due to ${report.upvotes} community upvotes)`;
  }

  if (report.urgencyReason) {
    reasonKo = report.urgencyReason;
  }

  return {
    urgency,
    importance,
    score,
    level,
    labelKo,
    labelEn,
    badgeBg,
    badgeText,
    badgeBorder,
    isFastTrack,
    reasonKo,
    reasonEn,
  };
};

// Auto evaluate report with AI / rule heuristics
export const autoEvaluateReport = (report: ReportItem): {
  urgency: UrgencyLevel;
  importance: ImportanceLevel;
  urgencyReason: string;
} => {
  let urgency: UrgencyLevel = 'Medium';
  let importance: ImportanceLevel = 'Medium';
  const text = (report.title + ' ' + report.description).toLowerCase();

  const isDisaster = report.category === 'Disaster' || text.includes('재난') || text.includes('붕괴') || text.includes('낙석') || text.includes('침수') || text.includes('sinkhole') || text.includes('collapse') || text.includes('flood');
  const isPotholeRoad = report.category === 'Road damage' || text.includes('파손') || text.includes('도로') || text.includes('싱크홀') || text.includes('보도블록') || text.includes('pothole') || text.includes('asphalt');
  const hasPins = report.photoPins && report.photoPins.length > 0;

  if (isDisaster) {
    urgency = 'High';
    importance = 'High';
  } else if (isPotholeRoad) {
    urgency = 'High';
    importance = hasPins || (report.upvotes && report.upvotes > 10) ? 'High' : 'Medium';
  } else if (report.category === 'Building damage') {
    urgency = 'Medium';
    importance = 'High';
  } else {
    urgency = 'Medium';
    importance = 'Medium';
  }

  const reason = `[AI Auto Evaluation] Category: ${report.category}, pins: ${report.photoPins?.length || 0}, upvotes: ${report.upvotes || 0}. Urgency [${urgency}], Importance [${importance}].`;

  return {
    urgency,
    importance,
    urgencyReason: reason,
  };
};
