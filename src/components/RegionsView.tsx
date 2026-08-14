import React from 'react';
import { TAIWAN_REGIONS } from '../data/regions';
import { CityInfo, Language } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface RegionsViewProps {
  onSelectCity: (city: CityInfo) => void;
  onOpenReportForCity?: (city: CityInfo) => void;
  currentLang?: Language;
}

export const RegionsView: React.FC<RegionsViewProps> = ({
  onSelectCity,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  return (
    <div className="w-full h-full min-h-[calc(100vh-4rem)] bg-[#faf9ff] overflow-y-auto pt-6 pb-28 px-4 md:px-8 max-w-4xl mx-auto">
      {/* Title & Description */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#003d9b] tracking-tight flex items-center gap-2">
          {t.regionsTitle}
        </h1>
        <p className="text-sm text-[#434654] mt-1 font-medium">
          {t.regionsSubtitle}
        </p>
      </div>

      {/* Region Cards Stack */}
      <div className="space-y-6">
        {TAIWAN_REGIONS.map((region) => (
          <div
            key={region.groupKey}
            className="bg-[#f1f3ff]/80 backdrop-blur-sm rounded-2xl p-5 border border-[#d8e2ff] shadow-xs hover:shadow-md transition-all"
          >
            {/* Region Group Title Header */}
            <div className="flex items-center gap-2 mb-4 text-[#003d9b] font-bold text-lg border-b border-[#c3c6d6]/30 pb-2">
              <span className="material-symbols-outlined text-2xl text-[#0052cc]">
                {region.iconName}
              </span>
              <h2>
                {region.titleZh} ({region.titleEn})
              </h2>
            </div>

            {/* City Buttons Grid (2 columns on mobile/tablet) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-3">
              {region.cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => onSelectCity(city)}
                  className="bg-[#faf9ff] hover:bg-[#d8e2ff]/50 active:scale-98 border border-[#c3c6d6] text-[#051a3e] rounded-xl py-3.5 px-4 font-semibold text-sm transition-all duration-150 flex flex-col items-center justify-center shadow-2xs hover:border-[#0052cc] hover:text-[#003d9b] cursor-pointer group"
                >
                  <span className="font-bold text-base text-[#051a3e] group-hover:text-[#003d9b] tracking-wide">
                    {city.nameZh}
                  </span>
                  <span className="text-xs text-[#737685] font-normal group-hover:text-[#0052cc] mt-0.5">
                    ({city.nameEn})
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
