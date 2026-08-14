import React from 'react';
import { ActiveTab, Language, PortalMode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  portalMode: PortalMode;
  onChangePortalMode: (mode: PortalMode) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentLang: Language;
  onChangeLang: (lang: Language) => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  portalMode,
  onChangePortalMode,
  activeTab,
  onSelectTab,
  currentLang,
  onChangeLang,
}) => {
  const handleNav = (tab: ActiveTab, mode?: PortalMode) => {
    if (mode && mode !== portalMode) {
      onChangePortalMode(mode);
    }
    onSelectTab(tab);
    onClose();
  };

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'zh', label: '繁體中文', flag: '🇹🇼' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-[#faf9ff] shadow-2xl z-50 p-4 flex flex-col transition-transform duration-300 ease-in-out border-r border-[#c3c6d6]/40 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* User / Mode Info Header */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-[#003d9b] to-[#0052cc] text-white rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#003d9b] flex items-center justify-center font-black text-sm hanken-grotesk shadow-xs">
              {portalMode === 'citizen' ? 'CP' : 'ADM'}
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white hanken-grotesk">
                {portalMode === 'citizen' ? 'CivicMap Citizen Services' : 'CivicMap Admin System'}
              </h2>
              <p className="text-[10px] text-blue-200">
                {portalMode === 'citizen' ? 'Citizen Complaint Portal' : 'Admin Dispatch System'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Portal Switcher Banner */}
        <div className="mb-4 p-2 bg-slate-200 rounded-2xl flex gap-1 border border-slate-300">
          <button
            onClick={() => {
              onChangePortalMode('citizen');
              onSelectTab('citizen');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              portalMode === 'citizen'
                ? 'bg-blue-600 text-white shadow-xs font-black'
                : 'text-slate-700 hover:bg-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">person_pin</span>
            <span>Citizen</span>
          </button>
          <button
            onClick={() => {
              onChangePortalMode('admin');
              onSelectTab('admin-ai');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              portalMode === 'admin'
                ? 'bg-slate-900 text-amber-300 shadow-xs font-black'
                : 'text-slate-700 hover:bg-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">shield_person</span>
            <span>Admin</span>
          </button>
        </div>

        {/* Multi-language Selector Box */}
        <div className="mb-4 p-3 bg-white rounded-2xl border border-[#d8e2ff] shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#003d9b]">
            <span className="material-symbols-outlined text-base">language</span>
            <span>{t.navLangSelect}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onChangeLang(lang.code)}
                className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  currentLang === lang.code
                    ? 'bg-[#0052cc] text-white shadow-xs'
                    : 'bg-[#f1f3ff] text-[#434654] hover:bg-[#d8e2ff]'
                }`}
              >
                <span>{lang.flag}</span>
                <span className="truncate">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-4">
          {/* Section 1: Citizen Services */}
          <div>
            <div className="px-3 mb-1 text-[11px] font-extrabold text-[#003d9b] uppercase tracking-wider flex items-center justify-between">
              <span>👤 Citizen Services</span>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('citizen', 'citizen')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'citizen' && portalMode === 'citizen'
                    ? 'bg-[#0071e6] text-white shadow-xs font-black'
                    : 'text-[#434654] hover:bg-[#d8e2ff]/50'
                }`}
              >
                <span className="material-symbols-outlined text-lg">person_pin</span>
                <span className="flex-1">{t.navCitizen}</span>
                <span className="text-[10px] font-bold bg-[#ffdad6] text-[#93000a] px-1.5 py-0.5 rounded-full">
                  HOT
                </span>
              </button>

              <button
                onClick={() => handleNav('map', 'citizen')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'map' && portalMode === 'citizen'
                    ? 'bg-[#0071e6] text-white shadow-xs font-black'
                    : 'text-[#434654] hover:bg-[#d8e2ff]/50'
                }`}
              >
                <span className="material-symbols-outlined text-lg">map</span>
                <span>{t.navMap}</span>
              </button>

              <button
                onClick={() => handleNav('regions', 'citizen')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'regions' && portalMode === 'citizen'
                    ? 'bg-[#0071e6] text-white shadow-xs font-black'
                    : 'text-[#434654] hover:bg-[#d8e2ff]/50'
                }`}
              >
                <span className="material-symbols-outlined text-lg">location_city</span>
                <span>{t.navRegions}</span>
              </button>

              <button
                onClick={() => handleNav('reports', 'citizen')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'reports' && portalMode === 'citizen'
                    ? 'bg-[#0071e6] text-white shadow-xs font-black'
                    : 'text-[#434654] hover:bg-[#d8e2ff]/50'
                }`}
              >
                <span className="material-symbols-outlined text-lg">forum</span>
                <span>{t.navReports}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Admin Management */}
          <div>
            <div className="px-3 mb-1 text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>🛡️ Admin Management</span>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('admin-ai', 'admin')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'admin-ai' && portalMode === 'admin'
                    ? 'bg-slate-900 text-amber-300 shadow-xs font-black'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg">psychology</span>
                <span>AI Smart Analytics</span>
              </button>

              <button
                onClick={() => handleNav('admin-reports', 'admin')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'admin-reports' && portalMode === 'admin'
                    ? 'bg-slate-900 text-amber-300 shadow-xs font-black'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg">assignment</span>
                <span>Review & Dispatch</span>
              </button>

              <button
                onClick={() => handleNav('admin-map', 'admin')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'admin-map' && portalMode === 'admin'
                    ? 'bg-slate-900 text-amber-300 shadow-xs font-black'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg">map</span>
                <span>Dispatch Map</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#c3c6d6]/40">
            <button
              onClick={() => alert('CivicMap Taiwan v2.5.0\nIntegrated Citizen Complaint & Admin Dispatch System.')}
              className="w-full flex items-center gap-3 px-3.5 py-2 text-[#434654] hover:bg-[#d8e2ff]/40 rounded-xl text-left text-xs font-medium transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">info</span>
              <span>System Version v2.5.0</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};


