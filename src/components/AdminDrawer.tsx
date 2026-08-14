import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDrawer: React.FC<AdminDrawerProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Drawer Container */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-slate-950 text-white shadow-2xl z-50 p-4 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm hanken-grotesk shadow-xs">
              ADM
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white hanken-grotesk">
                CivicMap Admin App
              </h2>
              <p className="text-[10px] text-slate-400">Dispatch & Case Review System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 space-y-3">
          <div className="px-3 mb-1 text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">
            🛡️ Admin Management Modules
          </div>

          <Link
            to="/admin/ai"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/admin' || currentPath === '/admin/ai'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-lg">psychology</span>
            <span>AI Analytics & Insights</span>
          </Link>

          <Link
            to="/admin/reports"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/admin/reports'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-lg">assignment</span>
            <span>Issue Review & Dispatch</span>
          </Link>

          <Link
            to="/admin/map"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentPath === '/admin/map'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-lg">map</span>
            <span>Taiwan Dispatch Map</span>
          </Link>

          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="font-bold text-white block mb-1">⚡ Emergency Dispatch Center</span>
              <p className="text-[11px] leading-relaxed">
                Review high-priority road, traffic, or public hazard reports and issue direct work orders to municipal field offices.
              </p>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
};
