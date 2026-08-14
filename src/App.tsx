import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IssueStatus, ReportItem } from './types';
import { INITIAL_REPORTS } from './data/initialReports';
import { getComplaintImageByCategory } from './utils/complaintImages';
import { CitizenApp } from './apps/CitizenApp';
import { AdminApp } from './apps/AdminApp';
import { Radio, RefreshCw, X, Sparkles, CheckCircle, Bell, Database } from 'lucide-react';
import { getAllDbReports, syncAllDbReports, clearDbReports } from './db/localDb';

const STORAGE_KEY = 'civicmap_reports_v1';
const CHANNEL_NAME = 'civicmap_sync_channel';

// Helper to remove hardcoded initial mock reports
const removeMockReports = (list: ReportItem[]): ReportItem[] => {
  const mockIds = [
    'REP-2026-101', 'REP-2026-102', 'REP-2026-103', 'REP-2026-104',
    'REP-2026-105', 'REP-2026-106', 'REP-2026-107', 'REP-2026-108'
  ];
  return list.filter((rep) => !mockIds.includes(rep.id));
};

// Helper to clean up old non-civil complaint images and remove mock data
const sanitizeReportImages = (list: ReportItem[]): ReportItem[] => {
  const nonMock = removeMockReports(list);
  return nonMock.map((rep) => {
    const isOldNonComplaintImage =
      !rep.imageUrl ||
      rep.imageUrl.includes('photo-1515162816999') ||
      rep.imageUrl.includes('photo-1573496359142');
    if (isOldNonComplaintImage) {
      return {
        ...rep,
        imageUrl: getComplaintImageByCategory(rep.category, rep.id),
      };
    }
    return rep;
  });
};

// Helper to safely load initial state from localStorage
const loadSavedReports = (): ReportItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sanitizeReportImages(parsed);
      }
    }
  } catch (err) {
    console.error('Failed to parse reports from localStorage', err);
  }
  return INITIAL_REPORTS;
};

export function App() {
  const [reports, setReports] = useState<ReportItem[]>(loadSavedReports);

  // Sync Toast notification state for live cross-tab updates
  const [syncToast, setSyncToast] = useState<{
    id: string;
    title: string;
    description: string;
    badgeText: string;
    badgeBg: string;
  } | null>(null);

  const instanceId = useRef<string>(`inst-${Math.random().toString(36).substring(2, 9)}`);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize and hydrate from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    getAllDbReports().then((dbReports) => {
      if (!isMounted) return;
      if (dbReports && dbReports.length > 0) {
        const sanitized = sanitizeReportImages(dbReports);
        setReports(sanitized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        syncAllDbReports(sanitized);
      } else if (reports.length > 0) {
        const sanitized = sanitizeReportImages(reports);
        setReports(sanitized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        syncAllDbReports(sanitized);
      } else {
        setReports(INITIAL_REPORTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
        syncAllDbReports(INITIAL_REPORTS);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to persist to localStorage & IndexedDB & broadcast to other tabs
  const saveAndBroadcastReports = (
    newReports: ReportItem[],
    notifyPayload?: { title: string; description: string; badgeText: string; badgeBg: string }
  ) => {
    setReports(newReports);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newReports));
      syncAllDbReports(newReports);

      // Broadcast to other tabs
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'SYNC_REPORTS',
          reports: newReports,
          notifyPayload,
          senderId: instanceId.current,
        });
      }
    } catch (err) {
      console.error('Failed to save reports:', err);
    }
  };

  // Cross-tab real-time synchronization listener
  useEffect(() => {
    // 1. BroadcastChannel API for instantaneous cross-tab sync
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (
          event.data &&
          event.data.type === 'SYNC_REPORTS' &&
          event.data.senderId !== instanceId.current
        ) {
          const updatedReports = event.data.reports as ReportItem[];
          setReports(updatedReports);

          if (event.data.notifyPayload) {
            setSyncToast({
              id: String(Date.now()),
              ...event.data.notifyPayload,
            });
          } else {
            setSyncToast({
              id: String(Date.now()),
              title: 'Live Data Sync Completed',
              description: 'Report data has been updated in another tab.',
              badgeText: 'LIVE SYNC',
              badgeBg: 'bg-blue-600',
            });
          }
        }
      };
    }

    // 2. Storage event listener fallback (fires on other tabs when localStorage is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setReports(updated);
          setSyncToast({
            id: String(Date.now()),
            title: 'Live Data Sync',
            description: 'Local storage changes received and updated automatically.',
            badgeText: 'LOCAL STORAGE',
            badgeBg: 'bg-emerald-600',
          });
        } catch (err) {
          console.error(err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Auto-dismiss Toast
  useEffect(() => {
    if (syncToast) {
      const timer = setTimeout(() => {
        setSyncToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [syncToast]);

  // Handle adding new report from citizen side
  const handleAddReport = (
    newReportData: Omit<ReportItem, 'id' | 'createdAt' | 'status'>
  ) => {
    const reportId = `REP-${Math.floor(100 + Math.random() * 900)}`;
    const newReport: ReportItem = {
      ...newReportData,
      id: reportId,
      imageUrl: newReportData.imageUrl || getComplaintImageByCategory(newReportData.category, reportId),
      status: 'Unresolved',
      createdAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      upvotes: 1,
    };

    const updated = [newReport, ...reports];
    saveAndBroadcastReports(updated, {
      title: '🔔 [Live] New Report Submitted',
      description: `[${newReport.id}] ${newReport.title} (Location: ${newReport.cityName || ''} ${newReport.districtName || ''})`,
      badgeText: 'NEW COMPLAINT',
      badgeBg: 'bg-amber-600',
    });

    alert(`Report submitted successfully! Case ID: ${newReport.id}`);
  };

  // Handle upvoting
  const handleUpvoteReport = (id: string) => {
    const updated = reports.map((rep) =>
      rep.id === id ? { ...rep, upvotes: (rep.upvotes || 0) + 1 } : rep
    );
    saveAndBroadcastReports(updated, {
      title: '👍 [Live] Upvote Added',
      description: `1 citizen support upvote added to report [${id}].`,
      badgeText: 'UPVOTE',
      badgeBg: 'bg-indigo-600',
    });
  };

  // Handle status update from admin side
  const handleUpdateStatus = (id: string, newStatus: IssueStatus) => {
    const targetRep = reports.find((r) => r.id === id);
    const updated = reports.map((rep) =>
      rep.id === id ? { ...rep, status: newStatus } : rep
    );

    saveAndBroadcastReports(updated, {
      title: '⚡ [Live] Report Status Updated',
      description: `[${id}] ${targetRep?.title || 'Report'} → ${newStatus} (Status Updated)`,
      badgeText: 'STATUS CHANGED',
      badgeBg: 'bg-[#1a237e]',
    });
  };

  // Handle full report detail updates from admin side
  const handleUpdateReportDetails = (id: string, updates: Partial<ReportItem>) => {
    const updated = reports.map((rep) =>
      rep.id === id ? { ...rep, ...updates } : rep
    );

    saveAndBroadcastReports(updated, {
      title: '📝 [Live] Report Details Updated',
      description: `Details for report [${id}] have been updated.`,
      badgeText: 'UPDATED',
      badgeBg: 'bg-blue-600',
    });
  };

  // Clear all DB data
  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all report data in local storage and database?')) {
      clearDbReports().then(() => {
        saveAndBroadcastReports([], {
          title: '🗑️ [DB] Data Cleared',
          description: 'All report data has been cleared.',
          badgeText: 'CLEARED',
          badgeBg: 'bg-red-600',
        });
      });
    }
  };

  return (
    <BrowserRouter>
      {/* Real-time Sync Toast Banner */}
      {syncToast && (
        <div className="fixed top-4 right-4 z-100 max-w-sm w-full bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white ${syncToast.badgeBg}`}>
                {syncToast.badgeText}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <button
              onClick={() => setSyncToast(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 space-y-1">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>{syncToast.title}</span>
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
              {syncToast.description}
            </p>
          </div>
        </div>
      )}

      {/* Floating Real-time Indicator & Reset Toolbar (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 shadow-lg flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-800 font-extrabold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-slate-700 font-bold">Live Sync (Active)</span>
        </div>

        <div className="h-3 w-px bg-slate-200" />

        <button
          onClick={handleClearData}
          title="Clear all local DB data"
          className="text-[10px] font-bold text-slate-500 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Clear DB Data</span>
        </button>
      </div>

      <Routes>
        {/* Isolated Standalone Admin Application Route (/admin/*) */}
        <Route
          path="/admin/*"
          element={
            <AdminApp
              reports={reports}
              onUpdateStatus={handleUpdateStatus}
              onUpdateReportDetails={handleUpdateReportDetails}
            />
          }
        />

        {/* Isolated Standalone Citizen Application Route (/*) */}
        <Route
          path="/*"
          element={
            <CitizenApp
              reports={reports}
              onAddReport={handleAddReport}
              onUpvoteReport={handleUpvoteReport}
            />
          }
        />

        {/* Fallback to Citizen App */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

