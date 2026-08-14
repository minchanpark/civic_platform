import React, { useState } from 'react';
import { ReportItem, IssueStatus, Language } from '../types';
import { TRANSLATIONS, getCategoryLabel, getStatusLabel } from '../data/translations';
import { PhotoPinAnnotator } from './PhotoPinAnnotator';
import { getComplaintImageByCategory } from '../utils/complaintImages';

interface AdminReportsViewProps {
  reports: ReportItem[];
  onUpdateStatus: (id: string, newStatus: IssueStatus) => void;
  onUpdateReportDetails?: (id: string, updates: Partial<ReportItem>) => void;
  onNavigateToAi?: () => void;
  currentLang?: Language;
}

export const AdminReportsView: React.FC<AdminReportsViewProps> = ({
  reports,
  onUpdateStatus,
  onUpdateReportDetails,
  onNavigateToAi,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterUnit, setFilterUnit] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectReport, setInspectReport] = useState<ReportItem | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Government Units Options
  const governmentUnits = [
    '工務局新建工程處',
    '環境保護局清潔隊',
    '交通局交通管制工程處',
    '水利工程處',
    '公園路燈工程管理處',
    '警察局交通警察大隊',
  ];

  // Filtered reports
  const filtered = reports.filter((rep) => {
    const matchStatus = filterStatus === 'All' || rep.status === filterStatus;
    const matchPriority = filterPriority === 'All' || rep.priority === filterPriority;
    const matchUnit =
      filterUnit === 'All'
        ? true
        : filterUnit === 'Unassigned'
        ? !rep.assignedUnit || rep.assignedUnit === 'Unassigned'
        : rep.assignedUnit === filterUnit;
    const matchQuery =
      !searchQuery.trim() ||
      rep.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.title.includes(searchQuery) ||
      rep.description.includes(searchQuery) ||
      rep.cityName.includes(searchQuery) ||
      rep.districtName.includes(searchQuery);

    return matchStatus && matchPriority && matchUnit && matchQuery;
  });

  // Calculate statistics
  const totalCount = reports.length;
  const unresolvedCount = reports.filter((r) => r.status === 'Unresolved').length;
  const proceedingCount = reports.filter((r) => r.status === 'Proceeding').length;
  const solvedCount = reports.filter((r) => r.status === 'Solved').length;
  const highPriorityCount = reports.filter((r) => r.priority === 'High' && r.status !== 'Solved').length;

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((r) => r.id));
    }
  };

  // Batch Status Update
  const handleBatchStatusUpdate = (newStatus: IssueStatus) => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => onUpdateStatus(id, newStatus));
    setSelectedIds([]);
    alert(`已將選取的 ${selectedIds.length} 件通報更新為「${getStatusLabel(newStatus, t)}」！`);
  };

  // Dispatch Work Order for single report
  const handleDispatchWorkOrder = (rep: ReportItem, unitName?: string) => {
    const targetUnit = unitName || rep.assignedUnit || governmentUnits[0];
    if (onUpdateReportDetails) {
      onUpdateReportDetails(rep.id, {
        assignedUnit: targetUnit,
        status: 'Proceeding',
      });
    } else {
      onUpdateStatus(rep.id, 'Proceeding');
    }
    alert(`【緊急派工單發出成功】\n案號：${rep.id}\n派工單位：${targetUnit}\n狀態更新為：處理中`);
  };

  // Assign unit
  const handleAssignUnit = (id: string, unitName: string) => {
    if (onUpdateReportDetails) {
      onUpdateReportDetails(id, { assignedUnit: unitName });
    }
  };

  // Change priority
  const handleChangePriority = (id: string, priority: 'High' | 'Medium' | 'Low') => {
    if (onUpdateReportDetails) {
      onUpdateReportDetails(id, { priority });
    }
  };

  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)] bg-[#faf9ff] overflow-y-auto pt-6 pb-28 px-4 md:px-8 max-w-6xl mx-auto space-y-6">
      {/* Admin Top Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3.5 py-1 rounded-full text-xs font-bold mb-3 backdrop-blur-xs">
              <span className="material-symbols-outlined text-sm">shield_person</span>
              <span>CivicMap 管理者派工與案件審查系統</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              市政通報審查與緊急派工中心
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              即時審查民眾通報案件、指派權責機關（工務局、環保局、交通局）、調派緊急工務單，並隨時追蹤各縣市處理成效。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onNavigateToAi && (
              <button
                onClick={onNavigateToAi}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">psychology</span>
                <span>AI 智慧分析報告</span>
              </button>
            )}
          </div>
        </div>

        {/* Background Gradient Accent */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none" />
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-bold text-slate-500">總通報案件數</span>
          <span className="text-2xl font-black text-slate-900 mt-1 hanken-grotesk">{totalCount}</span>
          <span className="text-[10px] text-slate-400 mt-1">全台累計民意通報</span>
        </div>

        <div className="bg-red-50/80 p-4 rounded-2xl border border-red-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            待審查 / 未處理
          </span>
          <span className="text-2xl font-black text-red-700 mt-1 hanken-grotesk">{unresolvedCount}</span>
          <span className="text-[10px] text-red-600 mt-1">需優先釐清與派工</span>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-bold text-amber-800">單位處理中</span>
          <span className="text-2xl font-black text-amber-800 mt-1 hanken-grotesk">{proceedingCount}</span>
          <span className="text-[10px] text-amber-700 mt-1">工務團隊執行現場作業</span>
        </div>

        <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-bold text-blue-800">已修復結案</span>
          <span className="text-2xl font-black text-blue-800 mt-1 hanken-grotesk">{solvedCount}</span>
          <span className="text-[10px] text-blue-700 mt-1">現場審查通過</span>
        </div>

        <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200 shadow-2xs flex flex-col col-span-2 md:col-span-1">
          <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-purple-700">warning</span>
            高優先極急件
          </span>
          <span className="text-2xl font-black text-purple-900 mt-1 hanken-grotesk">{highPriorityCount}</span>
          <span className="text-[10px] text-purple-700 mt-1">建議限時 24h 內完成</span>
        </div>
      </div>

      {/* Control Filter Bar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {['All', 'Unresolved', 'Proceeding', 'Solved', 'Denied'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'All'
                  ? '全部狀態'
                  : st === 'Unresolved'
                  ? t.statusUnresolved
                  : st === 'Proceeding'
                  ? t.statusProceeding
                  : st === 'Solved'
                  ? t.statusSolved
                  : t.statusDenied}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋案號、名稱、地點或行政區..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-2.5">
              search
            </span>
          </div>
        </div>

        {/* Secondary Filter Dropdowns & View Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">優先級:</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold outline-none cursor-pointer"
              >
                <option value="All">全部優先級</option>
                <option value="High">⚡ 高優先級 (High)</option>
                <option value="Medium">中優先級 (Medium)</option>
                <option value="Low">低優先級 (Low)</option>
              </select>
            </div>

            {/* Assigned Unit Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500">派工單位:</span>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-semibold outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="All">全部機關單位</option>
                <option value="Unassigned">未指定派工單位</option>
                {governmentUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>卡片檢視</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">table_rows</span>
              <span>表格檢視</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch Actions Bar (Visible when items selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-900 text-white p-3.5 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-xs bg-blue-700 px-3 py-1 rounded-full">
              已勾選 {selectedIds.length} 案
            </span>
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-200 hover:text-white underline cursor-pointer"
            >
              {selectedIds.length === filtered.length ? '取消全選' : '全選所有案件'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchStatusUpdate('Proceeding')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">engineering</span>
              <span>批次更新為「處理中」</span>
            </button>
            <button
              onClick={() => handleBatchStatusUpdate('Solved')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">task_alt</span>
              <span>批次結案 (已解決)</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              清除勾選
            </button>
          </div>
        </div>
      )}

      {/* Reports Display: Card View or Table View */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2">find_in_page</span>
          <p className="font-semibold text-sm">尚無符合條件的民意通報案件。</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View Layout */
        <div className="space-y-4">
          {filtered.map((rep) => (
            <div
              key={rep.id}
              className={`bg-white rounded-2xl p-5 border transition-all flex flex-col md:flex-row gap-4 shadow-xs hover:shadow-md ${
                selectedIds.includes(rep.id)
                  ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Checkbox & Photo Thumbnail */}
              <div className="flex items-start gap-3 shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(rep.id)}
                  onChange={() => handleToggleSelect(rep.id)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />

                <div
                  onClick={() => setInspectReport(rep)}
                  className="w-24 md:w-44 h-24 md:h-32 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 cursor-pointer relative group"
                >
                  <img
                    src={rep.imageUrl || getComplaintImageByCategory(rep.category, rep.id)}
                    alt={rep.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {rep.photoPins && rep.photoPins.length > 0 && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs text-amber-300">push_pin</span>
                        {rep.photoPins.length}
                      </span>
                    )}
                  </div>
              </div>

              {/* Main Info Area */}
              <div className="flex-1 flex flex-col justify-between min-w-0 space-y-2">
                <div>
                  {/* Badges Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {rep.id}
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {getCategoryLabel(rep.category, t)}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        📍 {rep.cityName} {rep.districtName}
                      </span>

                      {/* Priority Tag */}
                      <span
                        className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          rep.priority === 'High'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : rep.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rep.priority === 'High' && '⚡ '}
                        優先級: {rep.priority || 'Medium'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        rep.status === 'Unresolved'
                          ? 'bg-red-100 text-red-800'
                          : rep.status === 'Proceeding'
                          ? 'bg-amber-100 text-amber-900'
                          : rep.status === 'Solved'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      ● {getStatusLabel(rep.status, t)}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3
                    onClick={() => setInspectReport(rep)}
                    className="text-base font-extrabold text-slate-900 hover:text-blue-700 transition-colors cursor-pointer leading-snug line-clamp-1"
                  >
                    {rep.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {rep.description}
                  </p>
                </div>

                {/* Management Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Address & Date */}
                  <div className="text-slate-500 font-medium">
                    <span>{rep.addressText}</span>
                    <span className="mx-2">•</span>
                    <span>{rep.createdAt}</span>
                  </div>

                  {/* Controls: Assign Unit & Status Select & Quick Dispatch */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Unit Selector */}
                    <select
                      value={rep.assignedUnit || ''}
                      onChange={(e) => handleAssignUnit(rep.id, e.target.value)}
                      className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-medium outline-none cursor-pointer max-w-[170px] truncate"
                    >
                      <option value="">-- 指派權責單位 --</option>
                      {governmentUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>

                    {/* Priority Selector */}
                    <select
                      value={rep.priority || 'Medium'}
                      onChange={(e) =>
                        handleChangePriority(rep.id, e.target.value as 'High' | 'Medium' | 'Low')
                      }
                      className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-semibold outline-none cursor-pointer"
                    >
                      <option value="High">⚡ 高</option>
                      <option value="Medium">中</option>
                      <option value="Low">低</option>
                    </select>

                    {/* Status Dropdown */}
                    <select
                      value={rep.status}
                      onChange={(e) => onUpdateStatus(rep.id, e.target.value as IssueStatus)}
                      className="text-xs bg-slate-900 text-white border border-slate-700 rounded-lg px-2.5 py-1 font-bold outline-none cursor-pointer"
                    >
                      <option value="Unresolved">未處理</option>
                      <option value="Proceeding">處理中</option>
                      <option value="Solved">已解決</option>
                      <option value="Denied">已退回</option>
                    </select>

                    {/* Dispatch Work Order Button */}
                    <button
                      onClick={() => handleDispatchWorkOrder(rep)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="發出緊急工務單"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>派工</span>
                    </button>

                    {/* Inspect Details Button */}
                    <button
                      onClick={() => setInspectReport(rep)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                      title="查看詳細內容與相片標註"
                    >
                      <span className="material-symbols-outlined text-base">visibility</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View Layout */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                </th>
                <th className="p-3">案號 / 分類</th>
                <th className="p-3">通報標題與地點</th>
                <th className="p-3">地區</th>
                <th className="p-3">優先級</th>
                <th className="p-3">指派權責機關</th>
                <th className="p-3">處置狀態</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(rep.id)}
                      onChange={() => handleToggleSelect(rep.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                  </td>
                  <td className="p-3 font-bold text-blue-900 whitespace-nowrap">
                    <div>{rep.id}</div>
                    <span className="text-[10px] font-normal text-slate-500">
                      {getCategoryLabel(rep.category, t)}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs">
                    <div
                      onClick={() => setInspectReport(rep)}
                      className="font-extrabold text-slate-900 truncate hover:text-blue-600 cursor-pointer"
                    >
                      {rep.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{rep.addressText}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-slate-700">
                    {rep.cityName} {rep.districtName}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${
                        rep.priority === 'High'
                          ? 'bg-red-100 text-red-800'
                          : rep.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rep.priority || 'Medium'}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <select
                      value={rep.assignedUnit || ''}
                      onChange={(e) => handleAssignUnit(rep.id, e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 max-w-[150px] truncate"
                    >
                      <option value="">未指派</option>
                      {governmentUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <select
                      value={rep.status}
                      onChange={(e) => onUpdateStatus(rep.id, e.target.value as IssueStatus)}
                      className="text-xs bg-slate-100 font-bold border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="Unresolved">未處理</option>
                      <option value="Proceeding">處理中</option>
                      <option value="Solved">已解決</option>
                      <option value="Denied">已退回</option>
                    </select>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap space-x-1">
                    <button
                      onClick={() => handleDispatchWorkOrder(rep)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded text-xs"
                    >
                      派工
                    </button>
                    <button
                      onClick={() => setInspectReport(rep)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2.5 py-1 rounded text-xs"
                    >
                      詳情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Detail Modal */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-300 space-y-4">
            <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                  【管理者審查】{inspectReport.id} • {getCategoryLabel(inspectReport.category, t)}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{inspectReport.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  📍 {inspectReport.addressText} ({inspectReport.cityName} {inspectReport.districtName})
                </p>
              </div>

              <button
                onClick={() => setInspectReport(null)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-blue-600">push_pin</span>
                <span>現場相片與標點分析 (Photo Pins)</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-300 bg-black">
                <PhotoPinAnnotator
                  imageUrl={inspectReport.imageUrl || getComplaintImageByCategory(inspectReport.category, inspectReport.id)}
                  pins={inspectReport.photoPins || []}
                  readOnly={true}
                  currentLang={currentLang}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <span className="font-bold text-slate-700 block">民意通報內容</span>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                {inspectReport.description}
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 space-y-3">
              <span className="font-bold text-blue-900 text-xs block">管理者指派處置</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">權責機關單位：</label>
                  <select
                    value={inspectReport.assignedUnit || ''}
                    onChange={(e) => handleAssignUnit(inspectReport.id, e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                  >
                    <option value="">-- 未指派機關 --</option>
                    {governmentUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">處置狀態：</label>
                  <select
                    value={inspectReport.status}
                    onChange={(e) =>
                      onUpdateStatus(inspectReport.id, e.target.value as IssueStatus)
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    <option value="Unresolved">未處理</option>
                    <option value="Proceeding">處理中</option>
                    <option value="Solved">已解決</option>
                    <option value="Denied">已退回</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleDispatchWorkOrder(inspectReport)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">task_alt</span>
                <span>派發緊急派工單</span>
              </button>
              <button
                onClick={() => setInspectReport(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
