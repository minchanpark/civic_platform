import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface AdminHeaderProps {
  onToggleDrawer: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleDrawer }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-4 h-16 bg-slate-950/95 backdrop-blur-md shadow-md border-b border-slate-800 text-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDrawer}
          aria-label="Toggle Navigation Drawer"
          className="p-2 text-slate-300 hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <Link to="/admin" className="cursor-pointer flex items-center gap-2">
          <h1 className="font-black text-xl md:text-2xl text-white tracking-tight flex items-center gap-2">
            CivicMap <span className="text-amber-400">Admin</span>
          </h1>

          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-slate-900 text-amber-300 border-amber-400/30">
            <span className="material-symbols-outlined text-xs">shield_person</span>
            <span>Municipal Dispatch System</span>
          </span>
        </Link>
      </div>

      {/* Admin App Navigation Bar */}
      <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-full border border-slate-800">
        <Link
          to="/admin/ai"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/admin' || currentPath === '/admin/ai'
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
          <span>AI Analytics</span>
        </Link>

        <Link
          to="/admin/reports"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/admin/reports'
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">assignment</span>
          <span>Review & Dispatch</span>
        </Link>

        <Link
          to="/admin/map"
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentPath === '/admin/map'
              ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">map</span>
          <span>Dispatch Map</span>
        </Link>
      </nav>

      {/* Admin Info Badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-semibold hidden md:inline">
          Municipal Dispatch Center
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </header>
  );
};
