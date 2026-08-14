import React from 'react';
import { ActiveTab, Language, PortalMode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface HeaderProps {
  onToggleDrawer: () => void;
  portalMode: PortalMode;
  onChangePortalMode: (mode: PortalMode) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentLang: Language;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleDrawer,
  portalMode,
  onChangePortalMode,
  activeTab,
  onSelectTab,
  currentLang,
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const langFlags: Record<Language, string> = {
    zh: '🇹🇼 繁中',
    en: '🇺🇸 EN',
    ja: '🇯🇵 日本語',
    ko: '🇰🇷 한국어',
  };

  return (
    <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-4 h-16 bg-[#faf9ff]/90 backdrop-blur-md shadow-xs border-b border-[#c3c6d6]/40">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDrawer}
          aria-label="Toggle Navigation Drawer"
          className="p-2 text-[#003d9b] active:scale-95 transition-transform hover:bg-[#d8e2ff]/50 rounded-full cursor-pointer"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <div
          onClick={() => onSelectTab(portalMode === 'citizen' ? 'citizen' : 'admin-ai')}
          className="cursor-pointer flex items-center gap-2"
        >
          <h1 className="font-black text-xl md:text-2xl text-[#003d9b] tracking-tight flex items-center gap-2">
            CivicMap <span className="text-[#0052cc]">Taiwan</span>
          </h1>

          {/* Current Mode Badge */}
          <span
            className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              portalMode === 'citizen'
                ? 'bg-blue-100 text-blue-900 border-blue-300'
                : 'bg-slate-900 text-amber-300 border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-xs">
              {portalMode === 'citizen' ? 'person_pin' : 'shield_person'}
            </span>
            <span>{portalMode === 'citizen' ? 'Citizen Portal' : 'Admin System'}</span>
          </span>
        </div>
      </div>

      {/* Desktop Main Navigation Tabs */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#e9edff]/70 p-1 rounded-full border border-[#c3c6d6]/40">
        {portalMode === 'citizen' ? (
          <>
            <button
              onClick={() => onSelectTab('citizen')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'citizen'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">person_pin</span>
              <span>{t.navCitizen}</span>
            </button>
            <button
              onClick={() => onSelectTab('map')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              <span>{t.navMap}</span>
            </button>
            <button
              onClick={() => onSelectTab('regions')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'regions'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">location_city</span>
              <span>{t.navRegions}</span>
            </button>
            <button
              onClick={() => onSelectTab('reports')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reports'
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">forum</span>
              <span>{t.navReports}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('admin-ai')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin-ai'
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              <span>AI Smart Analytics</span>
            </button>
            <button
              onClick={() => onSelectTab('admin-reports')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin-reports'
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">assignment</span>
              <span>Review & Dispatch</span>
            </button>
            <button
              onClick={() => onSelectTab('admin-map')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin-map'
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'text-[#434654] hover:bg-[#d8e2ff]/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              <span>Dispatch Map</span>
            </button>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        {/* Role/Portal Mode Switch Toggle Button */}
        <button
          onClick={() =>
            onChangePortalMode(portalMode === 'citizen' ? 'admin' : 'citizen')
          }
          className={`px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
            portalMode === 'citizen'
              ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700'
              : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500'
          }`}
          title={
            portalMode === 'citizen'
              ? 'Switch to Admin Dispatch System'
              : 'Switch to Citizen Portal'
          }
        >
          <span className="material-symbols-outlined text-sm">
            {portalMode === 'citizen' ? 'admin_panel_settings' : 'group'}
          </span>
          <span className="hidden sm:inline">
            {portalMode === 'citizen' ? 'Switch to Admin' : 'Switch to Citizen'}
          </span>
          <span className="sm:hidden">
            {portalMode === 'citizen' ? 'Admin' : 'Citizen'}
          </span>
        </button>

        {/* Language Switch Button */}
        <button
          onClick={onToggleDrawer}
          className="px-2.5 py-1.5 rounded-full bg-[#e9edff] text-[#003d9b] border border-[#0052cc]/30 font-bold text-xs flex items-center gap-1 hover:bg-[#d8e2ff] transition-all cursor-pointer"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-sm">language</span>
          <span className="hidden sm:inline">{langFlags[currentLang]}</span>
        </button>
      </div>
    </header>
  );
};


