import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TRANSLATIONS } from '../data/translations';

interface CitizenDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReportModal: () => void;
}

export const CitizenDrawer: React.FC<CitizenDrawerProps> = ({
  isOpen,
  onClose,
  onOpenReportModal,
}) => {
  const location = useLocation();
  const t = TRANSLATIONS.en;
  const currentPath = location.pathname;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Drawer Container */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-[#faf9ff] shadow-2xl z-50 p-4 flex flex-col transition-transform duration-300 ease-in-out border-r border-[#c3c6d6]/40 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Citizen Portal Header */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-[#003d9b] to-[#0052cc] text-white rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#003d9b] flex items-center justify-center font-black text-sm hanken-grotesk shadow-xs">
              CP
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white hanken-grotesk">
                CivicMap Citizen Portal
              </h2>
              <p className="text-[10px] text-blue-200">Public Infrastructure Reporting</p>
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

        {/* Navigation Options */}
        <nav className="flex-1 space-y-3">
          <div className="px-3 mb-1 text-[11px] font-extrabold text-[#003d9b] uppercase tracking-wider">
            👤 Citizen Services
          </div>

          <Link
            to="/"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/' || currentPath === '/citizen'
                ? 'bg-[#0071e6] text-white shadow-xs font-black'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">person_pin</span>
            <span className="flex-1">{t.navCitizen}</span>
            <span className="text-[10px] font-bold bg-[#ffdad6] text-[#93000a] px-1.5 py-0.5 rounded-full">
              HOT
            </span>
          </Link>

          <Link
            to="/map"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/map'
                ? 'bg-[#0071e6] text-white shadow-xs font-black'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">map</span>
            <span>{t.navMap}</span>
          </Link>

          <Link
            to="/regions"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/regions'
                ? 'bg-[#0071e6] text-white shadow-xs font-black'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">location_city</span>
            <span>{t.navRegions}</span>
          </Link>

          <Link
            to="/reports"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/reports'
                ? 'bg-[#0071e6] text-white shadow-xs font-black'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">forum</span>
            <span>{t.navReports}</span>
          </Link>

          <div className="pt-4 border-t border-[#c3c6d6]/40">
            <button
              onClick={() => {
                onClose();
                onOpenReportModal();
              }}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-4 py-3 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Submit New Civic Report</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};
