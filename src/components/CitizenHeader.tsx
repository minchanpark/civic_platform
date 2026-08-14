import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TRANSLATIONS } from '../data/translations';

interface CitizenHeaderProps {
  onToggleDrawer: () => void;
  onOpenReportModal: () => void;
}

export const CitizenHeader: React.FC<CitizenHeaderProps> = ({
  onToggleDrawer,
  onOpenReportModal,
}) => {
  const location = useLocation();
  const t = TRANSLATIONS.en;
  const currentPath = location.pathname;

  return (
    <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-4 h-16 bg-[#faf9ff]/90 backdrop-blur-md shadow-xs border-b border-[#c3c6d6]/40">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDrawer}
          aria-label="Toggle Navigation Drawer"
          className="p-2 text-[#003d9b] hover:bg-[#d8e2ff]/50 rounded-full cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <Link to="/" className="cursor-pointer flex items-center gap-2">
          <h1 className="font-black text-xl md:text-2xl text-[#003d9b] tracking-tight flex items-center gap-2">
            CivicMap <span className="text-[#0052cc]">Taiwan</span>
          </h1>

          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-blue-100 text-blue-900 border-blue-300">
            <span className="material-symbols-outlined text-xs">person_pin</span>
            <span>Citizen Portal</span>
          </span>
        </Link>
      </div>

      {/* Citizen App Navigation Bar */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#e9edff]/70 p-1 rounded-full border border-[#c3c6d6]/40">
        <Link
          to="/"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/' || currentPath === '/citizen'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#434654] hover:bg-[#d8e2ff]/60'
          }`}
        >
          <span className="material-symbols-outlined text-sm">person_pin</span>
          <span>{t.navCitizen}</span>
        </Link>

        <Link
          to="/map"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/map'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#434654] hover:bg-[#d8e2ff]/60'
          }`}
        >
          <span className="material-symbols-outlined text-sm">map</span>
          <span>{t.navMap}</span>
        </Link>

        <Link
          to="/regions"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/regions'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#434654] hover:bg-[#d8e2ff]/60'
          }`}
        >
          <span className="material-symbols-outlined text-sm">location_city</span>
          <span>{t.navRegions}</span>
        </Link>

        <Link
          to="/reports"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/reports'
              ? 'bg-[#0052cc] text-white shadow-xs'
              : 'text-[#434654] hover:bg-[#d8e2ff]/60'
          }`}
        >
          <span className="material-symbols-outlined text-sm">forum</span>
          <span>{t.navReports}</span>
        </Link>
      </nav>

      {/* Citizen Action Button */}
      <div className="flex items-center gap-2">
      </div>
    </header>
  );
};
