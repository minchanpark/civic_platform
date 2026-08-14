import React, { useState } from 'react';
import { ReportItem, IssueStatus, Language } from '../types';
import { TRANSLATIONS, getCategoryLabel, getStatusLabel } from '../data/translations';
import { PhotoPinAnnotator } from './PhotoPinAnnotator';
import { getComplaintImageByCategory } from '../utils/complaintImages';

interface ReportsListViewProps {
  reports: ReportItem[];
  onOpenReportModal: () => void;
  onUpdateStatus?: (id: string, newStatus: IssueStatus) => void;
  currentLang?: Language;
}

export const ReportsListView: React.FC<ReportsListViewProps> = ({
  reports,
  onOpenReportModal,
  onUpdateStatus,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = reports.filter((rep) => {
    const matchStatus = filterStatus === 'All' || rep.status === filterStatus;
    const matchQuery =
      !searchQuery.trim() ||
      rep.title.includes(searchQuery) ||
      rep.description.includes(searchQuery) ||
      rep.cityName.includes(searchQuery) ||
      rep.districtName.includes(searchQuery);
    return matchStatus && matchQuery;
  });

  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)] bg-[#faf9ff] overflow-y-auto pt-6 pb-28 px-4 md:px-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#003d9b] tracking-tight">
            {t.reportsTitle}
          </h1>
          <p className="text-xs md:text-sm text-[#434654] mt-1 font-medium">
            {t.reportsSubtitle}
          </p>
        </div>

        <button
          onClick={onOpenReportModal}
          className="bg-[#0052cc] text-white px-5 py-2.5 rounded-full font-semibold text-sm shadow-md hover:bg-[#003d9b] transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          <span>{t.reportsNewBtn}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Unresolved', 'Proceeding', 'Solved', 'Denied'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-[#0052cc] text-white shadow-xs'
                  : 'bg-white text-[#434654] border border-[#c3c6d6] hover:bg-[#d8e2ff]/50'
              }`}
            >
              {st === 'All'
                ? t.filterAll
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

        <div className="sm:ml-auto relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.reportsSearchPlaceholder}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#c3c6d6] rounded-full text-xs text-[#051a3e] outline-none focus:border-[#003d9b]"
          />
          <span className="material-symbols-outlined text-base text-[#737685] absolute left-3 top-2.5">
            search
          </span>
        </div>
      </div>

      {/* Reports Grid / Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[#737685] bg-white rounded-2xl border border-[#c3c6d6]">
            <span className="material-symbols-outlined text-4xl mb-2">find_in_page</span>
            <p className="font-semibold text-sm">{t.noReportsFound}</p>
          </div>
        ) : (
          filtered.map((rep) => (
            <div
              key={rep.id}
              className="bg-white rounded-2xl p-5 border border-[#d8e2ff] shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row gap-4"
            >
              <div className="w-full md:w-64 shrink-0">
                <PhotoPinAnnotator
                  imageUrl={rep.imageUrl || getComplaintImageByCategory(rep.category, rep.id)}
                  pins={rep.photoPins || []}
                  readOnly={true}
                  currentLang={currentLang}
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[#003d9b] bg-[#e9edff] px-2.5 py-0.5 rounded-md">
                      {rep.id} • {getCategoryLabel(rep.category, t)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          rep.status === 'Unresolved'
                            ? 'bg-[#ffdad6] text-[#93000a]'
                            : rep.status === 'Proceeding'
                            ? 'bg-[#ffddb3] text-[#624000]'
                            : rep.status === 'Solved'
                            ? 'bg-[#c4d2ff] text-[#001848]'
                            : 'bg-[#e9edff] text-[#737685]'
                        }`}
                      >
                        ● {getStatusLabel(rep.status, t)}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-[#051a3e] mb-1 leading-snug">
                    {rep.title}
                  </h3>
                  <p className="text-xs text-[#434654] leading-relaxed mb-3 line-clamp-2">
                    {rep.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#f1f3ff] text-xs text-[#737685]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[#003d9b] font-medium">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {rep.addressText}
                    </span>
                    <span>{rep.createdAt}</span>
                  </div>

                  {/* Status Controls */}
                  {onUpdateStatus && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#434654]">{t.updateStatusLabel}</span>
                      <select
                        value={rep.status}
                        onChange={(e) =>
                          onUpdateStatus(rep.id, e.target.value as IssueStatus)
                        }
                        className="text-xs bg-[#f1f3ff] border border-[#c3c6d6] rounded-lg px-2 py-1 text-[#051a3e] font-semibold outline-none cursor-pointer"
                      >
                        <option value="Unresolved">{t.statusUnresolved}</option>
                        <option value="Proceeding">{t.statusProceeding}</option>
                        <option value="Solved">{t.statusSolved}</option>
                        <option value="Denied">{t.statusDenied}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
