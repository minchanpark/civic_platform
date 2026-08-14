import React, { useState } from 'react';
import {
  LayoutGrid,
  ListFilter,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronLeft,
  User,
  Shield,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

export type AdminTab = 'dashboard' | 'complaints' | 'analytics' | 'ai' | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onReturnToCitizen?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onTabChange,
  onReturnToCitizen,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={`h-screen shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between py-4 z-30 select-none relative transition-all duration-300 ease-in-out overflow-y-auto ${
        isExpanded ? 'w-64 md:w-72 px-4' : 'w-16 md:w-20 px-2 items-center'
      }`}
    >
      {/* Top Profile & Navigation Section */}
      <div className="flex flex-col gap-4 w-full">
        {/* Profile Card / Header with Expand Toggle Button */}
        {isExpanded ? (
          /* Expanded Header & Admin Profile Card */
          <div className="space-y-3 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm text-slate-900">Admin Control Menu</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-5 h-5 text-blue-600" />
              </button>
            </div>

            {/* Admin Profile Details */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
                alt="Admin Profile"
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-2xs shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-xs truncate">Manager Minjun Kim</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0">
                    Super Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">Civic Dispatch Command Center</p>
              </div>
            </div>

            {/* System Status Pill */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-100">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Live Session Connected
              </span>
              <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-extrabold">
                Active
              </span>
            </div>
          </div>
        ) : (
          /* Collapsed Icon Header */
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="relative group">
              <div
                onClick={() => setIsExpanded(true)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden border-2 border-slate-200 shadow-xs cursor-pointer hover:ring-2 hover:ring-blue-600 transition-all"
                title="Expand sidebar"
              >
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
                  alt="Admin Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white border border-slate-300 rounded-full p-1 shadow-xs hover:bg-blue-50 text-slate-700 hover:text-blue-700 cursor-pointer transition-all duration-200 z-10"
                title="Expand side menu"
              >
                <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
              </button>
            </div>

            {/* Jurisdiction Badge */}
            <div
              onClick={() => setIsExpanded(true)}
              className="w-9 h-9 rounded-full bg-[#1a237e] text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
              title="Jurisdiction: Nationwide"
            >
              <span className="text-sm">🌐</span>
            </div>

            <div className="w-8 h-[1px] bg-slate-200 my-0.5" />
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 w-full">
          {isExpanded && (
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-1">
              Main Control Menu
            </span>
          )}

          {/* 1. Dashboard */}
          <button
            onClick={() => onTabChange('dashboard')}
            title="Dashboard"
            className={`w-full flex items-center transition-all cursor-pointer rounded-xl font-bold text-xs ${
              isExpanded ? 'p-3 justify-between' : 'h-11 md:h-12 justify-center'
            } ${
              activeTab === 'dashboard'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 shrink-0" />
              {isExpanded && <span>Dashboard (Map Control)</span>}
            </div>
            {isExpanded && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>

          {/* 2. Complaints List */}
          <button
            onClick={() => onTabChange('complaints')}
            title="Complaints List"
            className={`w-full flex items-center transition-all cursor-pointer rounded-xl font-bold text-xs ${
              isExpanded ? 'p-3 justify-between' : 'h-11 md:h-12 justify-center relative'
            } ${
              activeTab === 'complaints'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <ListFilter className="w-5 h-5 shrink-0" />
              {isExpanded && <span>Complaints & AI Diagnosis</span>}
            </div>
            {isExpanded ? (
              <div className="flex items-center gap-1.5">
                <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  12
                </span>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </div>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* 3. Analytics */}
          <button
            onClick={() => onTabChange('analytics')}
            title="Analytics"
            className={`w-full flex items-center transition-all cursor-pointer rounded-xl font-bold text-xs ${
              isExpanded ? 'p-3 justify-between' : 'h-11 md:h-12 justify-center'
            } ${
              activeTab === 'analytics'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 shrink-0" />
              {isExpanded && <span>Analytics</span>}
            </div>
            {isExpanded && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>

          {/* 3.5 AI Agent Workspace */}
          <button
            onClick={() => onTabChange('ai')}
            title="AI Agent"
            className={`w-full flex items-center transition-all cursor-pointer rounded-xl font-bold text-xs ${
              isExpanded ? 'p-3 justify-between' : 'h-11 md:h-12 justify-center'
            } ${
              activeTab === 'ai'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 shrink-0 text-amber-500" />
              {isExpanded && <span>AI Agent Workspace</span>}
            </div>
            {isExpanded && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>

          {/* 4. Settings */}
          <button
            onClick={() => onTabChange('settings')}
            title="Settings"
            className={`w-full flex items-center transition-all cursor-pointer rounded-xl font-bold text-xs ${
              isExpanded ? 'p-3 justify-between' : 'h-11 md:h-12 justify-center'
            } ${
              activeTab === 'settings'
                ? 'bg-[#1a237e] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 shrink-0" />
              {isExpanded && <span>System Settings</span>}
            </div>
            {isExpanded && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>
        </nav>

        {/* AI Monitoring Banner when Expanded */}
        {isExpanded && (
          <div className="mt-2 bg-blue-50/80 border border-blue-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>AI Live Monitoring</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
              <div className="bg-white p-1.5 rounded-lg border border-blue-100">
                <div className="text-[10px] text-slate-500 font-medium">Accuracy</div>
                <div className="text-xs font-extrabold text-blue-900">94.8%</div>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-blue-100">
                <div className="text-[10px] text-slate-500 font-medium">Avg Time</div>
                <div className="text-xs font-extrabold text-blue-900">3.2h</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Switch Portal & Version Section */}
      <div className="w-full pt-3 border-t border-slate-100">
        {onReturnToCitizen && (
          <button
            onClick={onReturnToCitizen}
            className={`w-full flex items-center justify-center font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ${
              isExpanded ? 'p-2.5 gap-2 text-xs border border-slate-200 bg-slate-50' : 'p-2 text-[11px] text-center leading-tight'
            }`}
            title="Switch to Citizen Portal"
          >
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            {isExpanded ? (
              <>
                <span>Switch to Citizen Portal</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              </>
            ) : (
              <span>Citizen<br />Portal</span>
            )}
          </button>
        )}

        {isExpanded && (
          <div className="mt-3 text-center text-[10px] text-slate-400 font-medium">
            Control System v2.4
          </div>
        )}
      </div>
    </aside>
  );
};


