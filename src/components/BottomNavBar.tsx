import React from 'react';
import { ActiveTab, Language, PortalMode } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface BottomNavBarProps {
  portalMode: PortalMode;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentLang?: Language;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  portalMode,
  activeTab,
  onSelectTab,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  if (portalMode === 'admin') {
    return (
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center pt-2 pb-safe px-3 h-20 bg-slate-900 text-white backdrop-blur-xl border-t border-slate-800 shadow-xl lg:hidden">
        <button
          onClick={() => onSelectTab('admin-ai')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'admin-ai'
              ? 'bg-amber-400 text-slate-900 font-bold rounded-full px-3.5 py-1 shadow-sm scale-105'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-xl">psychology</span>
          <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[65px]">
            AI 分析
          </span>
        </button>

        <button
          onClick={() => onSelectTab('admin-reports')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'admin-reports'
              ? 'bg-amber-400 text-slate-900 font-bold rounded-full px-3.5 py-1 shadow-sm scale-105'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-xl">assignment</span>
          <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[65px]">
            案件派工
          </span>
        </button>

        <button
          onClick={() => onSelectTab('admin-map')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'admin-map'
              ? 'bg-amber-400 text-slate-900 font-bold rounded-full px-3.5 py-1 shadow-sm scale-105'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-xl">map</span>
          <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[65px]">
            派工地圖
          </span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center pt-2 pb-safe px-4 h-20 bg-[#faf9ff]/95 backdrop-blur-xl border-t border-[#c3c6d6] shadow-lg lg:hidden">
      <button
        onClick={() => onSelectTab('citizen')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'citizen'
            ? 'bg-[#0052cc] text-[#c4d2ff] rounded-full px-4 py-1 shadow-sm scale-105'
            : 'text-[#434654] hover:text-[#003d9b]'
        }`}
      >
        <span
          className={`material-symbols-outlined text-xl ${
            activeTab === 'citizen' ? 'material-symbols-fill' : ''
          }`}
        >
          person_pin
        </span>
        <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[60px]">
          {t.navCitizen}
        </span>
      </button>

      <button
        onClick={() => onSelectTab('map')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'map'
            ? 'bg-[#0052cc] text-[#c4d2ff] rounded-full px-4 py-1 shadow-sm scale-105'
            : 'text-[#434654] hover:text-[#003d9b]'
        }`}
      >
        <span
          className={`material-symbols-outlined text-xl ${
            activeTab === 'map' ? 'material-symbols-fill' : ''
          }`}
        >
          map
        </span>
        <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[60px]">
          {t.navMap}
        </span>
      </button>

      <button
        onClick={() => onSelectTab('regions')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'regions'
            ? 'bg-[#0052cc] text-[#c4d2ff] rounded-full px-4 py-1 shadow-sm scale-105'
            : 'text-[#434654] hover:text-[#003d9b]'
        }`}
      >
        <span
          className={`material-symbols-outlined text-xl ${
            activeTab === 'regions' ? 'material-symbols-fill' : ''
          }`}
        >
          location_city
        </span>
        <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[60px]">
          {t.navRegions}
        </span>
      </button>

      <button
        onClick={() => onSelectTab('reports')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'reports'
            ? 'bg-[#0052cc] text-[#c4d2ff] rounded-full px-4 py-1 shadow-sm scale-105'
            : 'text-[#434654] hover:text-[#003d9b]'
        }`}
      >
        <span
          className={`material-symbols-outlined text-xl ${
            activeTab === 'reports' ? 'material-symbols-fill' : ''
          }`}
        >
          assignment
        </span>
        <span className="text-[10px] font-semibold mt-0.5 tracking-wide truncate max-w-[60px]">
          {t.navReports}
        </span>
      </button>
    </nav>
  );
};

