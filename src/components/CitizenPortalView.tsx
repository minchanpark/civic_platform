import React, { useState } from 'react';
import { ReportItem, Language, IssueCategory } from '../types';
import { TRANSLATIONS, getCategoryLabel, getStatusLabel } from '../data/translations';
import { PhotoPinAnnotator } from './PhotoPinAnnotator';
import { getComplaintImageByCategory } from '../utils/complaintImages';

interface CitizenPortalViewProps {
  reports: ReportItem[];
  onOpenReportModal: () => void;
  onUpvoteReport?: (id: string) => void;
  onSwitchToMap: () => void;
  currentLang?: Language;
  onChangeLang?: (lang: Language) => void;
}

export const CitizenPortalView: React.FC<CitizenPortalViewProps> = ({
  reports,
  onOpenReportModal,
  onUpvoteReport,
  onSwitchToMap,
  currentLang = 'en',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'my' | 'community' | 'faq'>('my');
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('All');
  const [inspectReport, setInspectReport] = useState<ReportItem | null>(null);

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const handleToggleUpvote = (id: string) => {
    setUpvotedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    if (onUpvoteReport) {
      onUpvoteReport(id);
    }
  };

  // Mock Citizen's My Reports (using first 3 from reports)
  const myReports = reports.slice(0, 3);

  // Filter & Sort Community Reports
  const filteredCommunityReports = reports.filter((item) => {
    if (selectedCatFilter !== 'All' && item.category !== selectedCatFilter) {
      return false;
    }
    return true;
  });

  const sortedCommunityReports = [...filteredCommunityReports].sort((a, b) => {
    const aVotes = (a.upvotes || 0) + (upvotedIds[a.id] ? 1 : 0);
    const bVotes = (b.upvotes || 0) + (upvotedIds[b.id] ? 1 : 0);

    if (sortBy === 'votes') {
      return bVotes - aVotes;
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)] bg-[#faf9ff] overflow-y-auto pt-6 pb-28 px-4 md:px-8 max-w-5xl mx-auto space-y-6">
      {/* 1. Hero Citizen Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#003d9b] via-[#0052cc] to-[#0071e6] rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-semibold mb-3 border border-white/20">
            <span className="material-symbols-outlined text-sm">how_to_reg</span>
            <span>{t.badge}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 leading-tight">
            {t.heroTitle}
          </h1>
          <p className="text-xs md:text-sm text-[#d8e2ff] leading-relaxed mb-6">
            {t.heroSubtitle}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onOpenReportModal}
              className="bg-white text-[#003d9b] font-bold px-6 py-3 rounded-full text-sm shadow-lg hover:bg-[#d8e2ff] transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">add_a_photo</span>
              <span>{t.reportBtn}</span>
            </button>
            <button
              onClick={onSwitchToMap}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 font-semibold px-5 py-3 rounded-full text-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">map</span>
              <span>{t.mapBtn}</span>
            </button>
          </div>
        </div>

        {/* Decorative Background Circles */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-20 top-4 w-32 h-32 bg-[#c4d2ff]/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Quick Issue Category Tiles */}
      <div>
        <h2 className="text-lg font-bold text-[#051a3e] mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0052cc]">grid_view</span>
          <span>{t.categoriesTitle}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: t.catDisaster, icon: 'warning', color: 'bg-[#ffdad6] text-[#93000a]', category: 'Disaster' },
            { label: t.catFacility, icon: 'handyman', color: 'bg-[#ffddb3] text-[#624000]', category: 'Facility issue' },
            { label: t.catRoad, icon: 'edit_road', color: 'bg-[#c4d2ff] text-[#001848]', category: 'Road damage' },
            { label: t.catBuilding, icon: 'domain', color: 'bg-[#e9edff] text-[#003d9b]', category: 'Building damage' },
            { label: t.catEnvironment, icon: 'mop', color: 'bg-[#d8e2ff] text-[#003d9b]', category: 'Environmental issue' },
          ].map((cat, idx) => (
            <button
              key={idx}
              onClick={onOpenReportModal}
              className="bg-white hover:bg-[#d8e2ff]/40 border border-[#c3c6d6]/60 rounded-2xl p-4 flex flex-col items-center text-center shadow-2xs hover:shadow-md transition-all active:scale-95 cursor-pointer group"
            >
              <div className={`w-12 h-12 rounded-full ${cat.color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
              </div>
              <span className="font-bold text-xs text-[#051a3e]">{cat.label}</span>
              <span className="text-[10px] text-[#737685] mt-0.5">{cat.category}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Citizen Interactive Tabs */}
      <div className="bg-white rounded-2xl border border-[#d8e2ff] p-5 shadow-sm">
        {/* Sub Navigation */}
        <div className="flex border-b border-[#c3c6d6]/40 pb-3 mb-5 gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('my')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'my'
                ? 'bg-[#0052cc] text-white shadow-xs'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm">history</span>
            <span>{t.tabMyReports} ({myReports.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('community')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'community'
                ? 'bg-[#0052cc] text-white shadow-xs'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm">group</span>
            <span>{t.tabCommunity} ({reports.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('faq')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'faq'
                ? 'bg-[#0052cc] text-white shadow-xs'
                : 'text-[#434654] hover:bg-[#d8e2ff]/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm">help_outline</span>
            <span>{t.tabFaq}</span>
          </button>
        </div>

        {/* Tab 1: My Reports Tracker */}
        {activeSubTab === 'my' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm text-[#051a3e]">{t.trackingTitle}</h3>
              <span className="text-xs text-[#737685]">{t.trackingSubtitle}</span>
            </div>

            {myReports.map((item) => (
              <div
                key={item.id}
                className="bg-[#faf9ff] rounded-xl p-4 border border-[#c3c6d6]/60 flex flex-col md:flex-row gap-4"
              >
                <div className="w-full md:w-60 shrink-0">
                  <PhotoPinAnnotator
                    imageUrl={item.imageUrl || getComplaintImageByCategory(item.category, item.id)}
                    pins={item.photoPins || []}
                    readOnly={true}
                    currentLang={currentLang}
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#003d9b] bg-[#e9edff] px-2 py-0.5 rounded">
                        {t.caseNo}{item.id}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          item.status === 'Unresolved'
                            ? 'bg-[#ffdad6] text-[#93000a]'
                            : item.status === 'Proceeding'
                            ? 'bg-[#ffddb3] text-[#624000]'
                            : 'bg-[#c4d2ff] text-[#001848]'
                        }`}
                      >
                        ● {getStatusLabel(item.status, t)}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-[#051a3e] mb-1">{item.title}</h4>
                    <p className="text-xs text-[#434654] line-clamp-2 mb-3">{item.description}</p>
                  </div>

                  {/* Status Progress Bar */}
                  <div className="bg-white p-3 rounded-lg border border-[#c3c6d6]/40">
                    <div className="flex justify-between text-[11px] font-semibold text-[#434654] mb-1.5">
                      <span>{t.step1}</span>
                      <span className={item.status !== 'Unresolved' ? 'text-[#0052cc] font-bold' : 'text-[#737685]'}>
                        {t.step2} ({item.assignedUnit || 'Processing'})
                      </span>
                      <span className={item.status === 'Solved' ? 'text-[#0052cc] font-bold' : 'text-[#737685]'}>
                        {t.step3}
                      </span>
                    </div>
                    <div className="w-full bg-[#e9edff] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0052cc] h-full transition-all duration-500"
                        style={{
                          width:
                            item.status === 'Unresolved'
                              ? '33%'
                              : item.status === 'Proceeding'
                              ? '66%'
                              : '100%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Community Hot Issues */}
        {activeSubTab === 'community' && (
          <div className="space-y-6">
            {/* Header Banner & Controls */}
            <div className="bg-gradient-to-r from-[#002b70] via-[#003d9b] to-[#0052cc] rounded-3xl p-5 md:p-6 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-200 border border-amber-400/30 px-3 py-0.5 rounded-full text-xs font-bold mb-2 backdrop-blur-xs">
                    <span className="material-symbols-outlined text-sm text-amber-300">local_fire_department</span>
                    <span>{t.communityHeaderBadge}</span>
                  </div>
                  <h3 className="font-black text-lg md:text-xl text-white tracking-tight">{t.communityTitle}</h3>
                  <p className="text-xs text-[#c4d2ff] mt-1 max-w-xl leading-relaxed">{t.communitySubtitle}</p>
                </div>

                {/* Sort Toggle Controls */}
                <div className="flex items-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/20 shrink-0 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => setSortBy('votes')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sortBy === 'votes'
                        ? 'bg-white text-[#003d9b] shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    <span>{t.communitySortByVotes}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('newest')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      sortBy === 'newest'
                        ? 'bg-white text-[#003d9b] shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>{t.communitySortByTime}</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Horizontal Pills */}
              <div className="mt-4 pt-3 border-t border-white/15 flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'All', label: t.communityFilterCategoryAll, icon: 'apps' },
                  { id: 'Disaster', label: t.catDisaster, icon: 'warning' },
                  { id: 'Facility issue', label: t.catFacility, icon: 'handyman' },
                  { id: 'Road damage', label: t.catRoad, icon: 'edit_road' },
                  { id: 'Building damage', label: t.catBuilding, icon: 'domain' },
                  { id: 'Environmental issue', label: t.catEnvironment, icon: 'mop' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatFilter(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                      selectedCatFilter === cat.id
                        ? 'bg-amber-400 text-[#051a3e] border-amber-300 shadow-sm font-extrabold'
                        : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Community Reports List */}
            {sortedCommunityReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-[#c3c6d6]/60 text-[#737685]">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">find_in_page</span>
                <p className="text-sm font-semibold">{t.noReportsFound}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedCommunityReports.map((item, index) => {
                  const count = (item.upvotes || 10) + (upvotedIds[item.id] ? 1 : 0);
                  const isUpvoted = !!upvotedIds[item.id];
                  const isTopOne = index === 0;
                  const isTopTwo = index === 1;
                  const isTopThree = index === 2;
                  const isUrgent = count >= 50;
                  const goalProgressPercent = Math.min(100, Math.round((count / 50) * 100));

                  return (
                    <div
                      key={item.id}
                      className={`relative transition-all duration-200 rounded-3xl overflow-hidden border ${
                        isTopOne
                          ? 'bg-gradient-to-br from-[#fffdf5] via-white to-[#f2f6ff] border-2 border-amber-400/90 shadow-xl ring-2 ring-amber-300/30'
                          : 'bg-white hover:bg-[#f8faff] border-[#c3c6d6]/80 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Top Rank Badge Header Ribbon */}
                      {isTopOne && (
                        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-[#051a3e] px-4 py-1.5 flex items-center justify-between text-xs font-black tracking-wider uppercase shadow-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-[#051a3e]">workspace_premium</span>
                            <span>👑 TOP 1 {t.communityRankLabel} #1</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-white/40 px-2.5 py-0.5 rounded-full text-[11px]">
                            <span className="material-symbols-outlined text-sm text-[#93000a]">local_fire_department</span>
                            <span className="font-extrabold">{count} citizen upvotes</span>
                          </div>
                        </div>
                      )}

                      <div className="p-4 md:p-5">
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                          {/* Image Thumbnail Block */}
                          <div
                            onClick={() => setInspectReport(item)}
                            className="relative w-full md:w-44 h-36 md:h-36 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-[#c3c6d6]/60 cursor-pointer group shadow-2xs"
                          >
                            <img
                              src={item.imageUrl || getComplaintImageByCategory(item.category, item.id)}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* Ranking Badge Overlay on Thumbnail */}
                            <div className="absolute top-2 left-2 z-10">
                              {isTopOne ? (
                                <span className="w-7 h-7 rounded-xl bg-amber-400 text-[#051a3e] font-black text-xs flex items-center justify-center shadow-md border border-amber-200">
                                  #1
                                </span>
                              ) : isTopTwo ? (
                                <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center shadow-md border border-slate-300">
                                  #2
                                </span>
                              ) : isTopThree ? (
                                <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center shadow-md border border-amber-300">
                                  #3
                                </span>
                              ) : (
                                <span className="w-7 h-7 rounded-xl bg-[#003d9b]/80 text-white font-extrabold text-xs flex items-center justify-center backdrop-blur-xs">
                                  #{index + 1}
                                </span>
                              )}
                            </div>

                            {/* Photo Pins Badge Indicator */}
                            {item.photoPins && item.photoPins.length > 0 && (
                              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1 text-amber-300">
                                  <span className="material-symbols-outlined text-xs">push_pin</span>
                                  <span>{item.photoPins.length} Photo Pins</span>
                                </span>
                                <span className="material-symbols-outlined text-xs">visibility</span>
                              </div>
                            )}
                          </div>

                          {/* Main Content Area */}
                          <div className="flex-1 min-w-0 w-full space-y-2">
                            {/* Badges Bar */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-extrabold text-[#003d9b] bg-[#e9edff] px-2.5 py-0.5 rounded-lg border border-[#d8e2ff]">
                                {item.cityName} {item.districtName}
                              </span>
                              <span className="text-xs font-bold text-[#434654] bg-gray-100 px-2.5 py-0.5 rounded-lg">
                                {getCategoryLabel(item.category, t)}
                              </span>
                              <span className="text-[11px] text-[#737685]">
                                {t.caseNo}{item.id}
                              </span>

                              {isUrgent && (
                                <span className="ml-auto text-xs font-black text-orange-700 bg-orange-100 border border-orange-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                  <span>{t.communityUrgentBadge}</span>
                                </span>
                              )}
                            </div>

                            {/* Title & Address */}
                            <div>
                              <h4
                                onClick={() => setInspectReport(item)}
                                className="font-extrabold text-base md:text-lg text-[#051a3e] hover:text-[#0052cc] transition-colors cursor-pointer leading-snug line-clamp-1"
                              >
                                {item.title}
                              </h4>
                              <p className="text-xs text-[#737685] flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-sm text-red-500">location_on</span>
                                <span className="truncate">{item.addressText}</span>
                              </p>
                            </div>

                            {/* Description snippet */}
                            <p className="text-xs text-[#434654] line-clamp-2 leading-relaxed bg-[#f8f9ff] p-2.5 rounded-xl border border-[#c3c6d6]/30">
                              {item.description}
                            </p>

                            {/* Upvote Progress Bar */}
                            <div className="pt-1">
                              <div className="flex justify-between items-center text-[11px] font-bold text-[#434654] mb-1">
                                <span className="flex items-center gap-1 text-[#003d9b]">
                                  <span className="material-symbols-outlined text-xs">flag</span>
                                  <span>{t.communitySupportProgress}</span>
                                </span>
                                <span className={isUrgent ? 'text-orange-600 font-extrabold' : 'text-[#0052cc]'}>
                                  {count} / 50 票 ({goalProgressPercent}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 rounded-full ${
                                    isUrgent
                                      ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                                      : 'bg-gradient-to-r from-[#0052cc] to-[#0071e6]'
                                  }`}
                                  style={{ width: `${goalProgressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons Row */}
                            <div className="flex items-center justify-between pt-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectReport(item)}
                                className="text-xs font-bold text-[#003d9b] bg-[#e9edff] hover:bg-[#d8e2ff] px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-base">center_focus_strong</span>
                                <span>{t.communityViewDetails}</span>
                              </button>

                              {/* Upvote Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleUpvote(item.id)}
                                className={`px-5 py-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 font-extrabold text-xs shadow-xs active:scale-95 ${
                                  isUpvoted
                                    ? 'bg-gradient-to-r from-[#0052cc] to-[#003d9b] text-white border-[#002b70] shadow-md ring-2 ring-[#0052cc]/30'
                                    : 'bg-white text-[#003d9b] border-[#0052cc]/40 hover:bg-[#e9edff] hover:border-[#0052cc]'
                                }`}
                              >
                                <span
                                  className={`material-symbols-outlined text-lg transition-transform ${
                                    isUpvoted ? 'scale-125 text-amber-300' : 'text-[#0052cc]'
                                  }`}
                                >
                                  {isUpvoted ? 'thumb_up_filled' : 'thumb_up'}
                                </span>
                                <span>{isUpvoted ? t.communityUpvotedBadge : t.upvoteLabel}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                                    isUpvoted ? 'bg-white/20 text-white' : 'bg-[#e9edff] text-[#003d9b]'
                                  }`}
                                >
                                  +{count}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: FAQ */}
        {activeSubTab === 'faq' && (
          <div className="space-y-3">
            {t.faqs.map((faq, idx) => (
              <div key={idx} className="bg-[#faf9ff] p-4 rounded-xl border border-[#c3c6d6]/60">
                <h4 className="font-bold text-sm text-[#003d9b] mb-1.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">help</span>
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-[#434654] leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspect Report Photo Pin Details Modal */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 md:p-6 shadow-2xl border border-[#c3c6d6] space-y-4">
            <div className="flex justify-between items-start gap-3 pb-3 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-extrabold text-[#003d9b] bg-[#e9edff] px-2.5 py-0.5 rounded-md">
                    {inspectReport.id} • {getCategoryLabel(inspectReport.category, t)}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#e9edff] text-[#003d9b]">
                    ● {getStatusLabel(inspectReport.status, t)}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#051a3e]">{inspectReport.title}</h3>
                <p className="text-xs text-[#737685] flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-red-500">location_on</span>
                  <span>{inspectReport.addressText} ({inspectReport.cityName} {inspectReport.districtName})</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectReport(null)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Photo & Pins Annotator */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <PhotoPinAnnotator
                imageUrl={inspectReport.imageUrl || getComplaintImageByCategory(inspectReport.category, inspectReport.id)}
                pins={inspectReport.photoPins || []}
                readOnly={true}
                currentLang={currentLang}
              />
            </div>

            {/* Description */}
            <div className="bg-[#f8f9ff] p-4 rounded-2xl border border-[#c3c6d6]/40 space-y-1">
              <span className="text-xs font-extrabold text-[#003d9b] block">Detailed Description</span>
              <p className="text-xs text-[#434654] leading-relaxed whitespace-pre-wrap">
                {inspectReport.description}
              </p>
            </div>

            {/* Footer Status & Upvote */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div className="text-xs text-[#737685]">
                <span>Assigned Department: <strong className="text-[#051a3e]">{inspectReport.assignedUnit || 'Processing'}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleUpvote(inspectReport.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    upvotedIds[inspectReport.id]
                      ? 'bg-[#0052cc] text-white shadow-md'
                      : 'bg-[#e9edff] text-[#003d9b] hover:bg-[#d8e2ff]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">thumb_up</span>
                  <span>
                    {upvotedIds[inspectReport.id] ? t.communityUpvotedBadge : t.upvoteLabel} (+
                    {(inspectReport.upvotes || 10) + (upvotedIds[inspectReport.id] ? 1 : 0)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectReport(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

