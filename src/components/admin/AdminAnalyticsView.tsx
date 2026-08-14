import React from 'react';
import { ReportItem } from '../../types';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Sparkles,
  Download,
  CheckCircle2,
  PieChart,
  MapPin
} from 'lucide-react';

interface AdminAnalyticsViewProps {
  reports?: ReportItem[];
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ reports = [] }) => {
  const totalCount = reports.length;
  const resolvedCount = reports.filter(
    (r) => r.status === 'Solved'
  ).length;
  const proceedingCount = reports.filter(
    (r) => r.status === 'Proceeding'
  ).length;
  const unresolvedCount = reports.filter(
    (r) => r.status === 'Unresolved'
  ).length;

  const resolutionRate =
    totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(1) : '0.0';

  // Group by Category
  const categoryCounts: { [key: string]: number } = {};
  reports.forEach((r) => {
    const cat = r.category || 'Others';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const categoryList = Object.entries(categoryCounts).map(([cat, count]) => ({
    name: cat,
    count,
    percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
  }));

  // Group by City / Region
  const regionCounts: { [key: string]: number } = {};
  reports.forEach((r) => {
    const reg = r.cityName || r.districtName || 'Other Regions';
    regionCounts[reg] = (regionCounts[reg] || 0) + 1;
  });

  const regionList = Object.entries(regionCounts).map(([region, count]) => ({
    region,
    count,
  }));

  return (
    <div className="w-full h-full bg-[#f4f5fa] p-6 overflow-y-auto space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Analytics & Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time analytics of civic complaints, category distribution, and resolution performance
          </p>
        </div>

        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reports, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", "civic_reports_analytics.json");
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
          }}
          className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Download className="w-4 h-4 text-slate-600" />
          <span>Export Analytics JSON</span>
        </button>
      </div>

      {/* Top 4 Operational KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Complaints</span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{totalCount}</div>
            <div className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Live Local DB Sync</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{resolutionRate}%</div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              {resolvedCount} resolved out of {totalCount}
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{proceedingCount}</div>
            <div className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
              <span>Reports In Progress</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Pending (Unresolved)</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{unresolvedCount}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              Unresolved Complaints Count
            </div>
          </div>
        </div>
      </div>

      {/* Main Breakdown Section (2 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Category Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
              <PieChart className="w-4 h-4 text-[#1a237e]" />
              <span>Category Distribution</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Live Aggregate</span>
          </div>

          <div className="space-y-4">
            {categoryList.length > 0 ? (
              categoryList.map((item, idx) => {
                const colors = ['bg-[#1a237e]', 'bg-teal-600', 'bg-amber-500', 'bg-purple-600', 'bg-slate-500'];
                const colorClass = colors[idx % colors.length];
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{item.name}</span>
                      <span>
                        {item.percentage}% ({item.count} items)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${colorClass} rounded-full transition-all duration-300`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No reports registered to show category statistics.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Regional Activity Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
              <MapPin className="w-4 h-4 text-[#1a237e]" />
              <span>Regional Activity Breakdown</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {regionList.length} Regions
            </span>
          </div>

          <div className="space-y-3.5 text-xs font-semibold max-h-64 overflow-y-auto pr-1">
            {regionList.length > 0 ? (
              regionList.map((item) => (
                <div
                  key={item.region}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <span className="text-slate-800 font-extrabold">{item.region}</span>
                  <span className="text-slate-900 font-black">{item.count} complaints</span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No reports registered to show regional statistics.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
