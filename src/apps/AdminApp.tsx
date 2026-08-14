import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ReportItem, IssueStatus } from '../types';
import { AdminSidebar, AdminTab } from '../components/admin/AdminSidebar';
import { AdminDashboardView } from '../components/admin/AdminDashboardView';
import { AdminComplaintsListView } from '../components/admin/AdminComplaintsListView';
import { AdminAnalyticsView } from '../components/admin/AdminAnalyticsView';
import { AdminSettingsView } from '../components/admin/AdminSettingsView';
import { AdminAiView } from '../components/AdminAiView';

interface AdminAppProps {
  reports: ReportItem[];
  onUpdateStatus: (id: string, newStatus: IssueStatus) => void;
  onUpdateReportDetails: (id: string, updates: Partial<ReportItem>) => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({
  reports,
  onUpdateStatus,
  onUpdateReportDetails,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Selected report ID for focus in Dashboard Map
  const [targetMapReportId, setTargetMapReportId] = useState<string>('');

  // Derive current tab from location
  const getCurrentTab = (): AdminTab => {
    const path = location.pathname;
    if (path.includes('/complaints') || path.includes('/reports')) return 'complaints';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/ai')) return 'ai';
    if (path.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getCurrentTab();

  const handleTabChange = (tab: AdminTab) => {
    switch (tab) {
      case 'dashboard':
        navigate('/admin');
        break;
      case 'complaints':
        navigate('/admin/complaints');
        break;
      case 'analytics':
        navigate('/admin/analytics');
        break;
      case 'ai':
        navigate('/admin/ai');
        break;
      case 'settings':
        navigate('/admin/settings');
        break;
      default:
        navigate('/admin');
    }
  };

  const handleSelectReportOnMap = (id: string) => {
    setTargetMapReportId(id);
    navigate('/admin');
  };

  return (
    <div className="w-full h-screen bg-[#f4f5fa] flex overflow-hidden font-sans text-slate-800">
      {/* Left Icon Sidebar matching Images 1~6 */}
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onReturnToCitizen={() => navigate('/')}
      />

      {/* Main Admin Body Content View */}
      <main className="flex-1 h-screen overflow-y-auto relative flex flex-col">
        <Routes>
          {/* 1. Dashboard */}
          <Route
            path="/"
            element={
              <AdminDashboardView
                reports={reports}
                onUpdateStatus={onUpdateStatus}
                onUpdateReportDetails={onUpdateReportDetails}
                onNavigateToList={() => handleTabChange('complaints')}
                targetMapReportId={targetMapReportId}
              />
            }
          />

          {/* 2. Complaints List */}
          <Route
            path="/complaints"
            element={
              <AdminComplaintsListView
                reports={reports}
                onUpdateStatus={onUpdateStatus}
                onUpdateReportDetails={onUpdateReportDetails}
                onSelectReportOnMap={handleSelectReportOnMap}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <AdminComplaintsListView
                reports={reports}
                onUpdateStatus={onUpdateStatus}
                onUpdateReportDetails={onUpdateReportDetails}
                onSelectReportOnMap={handleSelectReportOnMap}
              />
            }
          />

          {/* 3. Statistical Analytics */}
          <Route path="/analytics" element={<AdminAnalyticsView reports={reports} />} />
          <Route
            path="/ai"
            element={
              <AdminAiView
                reports={reports}
                onUpdateStatus={onUpdateStatus}
                onUpdateReportDetails={onUpdateReportDetails}
              />
            }
          />
          <Route
            path="/ai/:reportId"
            element={
              <AdminAiView
                reports={reports}
                onUpdateStatus={onUpdateStatus}
                onUpdateReportDetails={onUpdateReportDetails}
              />
            }
          />

          {/* 4. Settings */}
          <Route path="/settings" element={<AdminSettingsView />} />
        </Routes>
      </main>
    </div>
  );
};
