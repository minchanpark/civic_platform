import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ReportItem, Language } from '../types';
import { TRANSLATIONS, getStatusLabel } from '../data/translations';
import { PhotoPinAnnotator } from './PhotoPinAnnotator';
import { getComplaintImageByCategory } from '../utils/complaintImages';

interface MapViewProps {
  reports: ReportItem[];
  onOpenReportModal: () => void;
  onSelectReport: (report: ReportItem) => void;
  selectedCity?: { nameZh: string; lat: number; lng: number; zoom: number } | null;
  currentLang?: Language;
}

export const MapView: React.FC<MapViewProps> = ({
  reports,
  onOpenReportModal,
  onSelectReport,
  selectedCity,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportPopup, setSelectedReportPopup] = useState<ReportItem | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat =
        selectedCity && typeof selectedCity.lat === 'number' && !isNaN(selectedCity.lat)
          ? selectedCity.lat
          : 24.1500;
      const initialLng =
        selectedCity && typeof selectedCity.lng === 'number' && !isNaN(selectedCity.lng)
          ? selectedCity.lng
          : 120.9000;
      const initialZoom = selectedCity?.zoom || 8;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
      });

      // Clean Light Basemap tiles (CartoDB Light)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);

      // Add zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    const currentMap = mapInstanceRef.current;

    // Helper function to force Leaflet recalculate container size
    const invalidate = () => {
      if (currentMap) {
        currentMap.invalidateSize();
      }
    };

    // Scheduled invalidation to guarantee layout completion
    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 200);
    const t3 = setTimeout(invalidate, 500);
    const t4 = setTimeout(invalidate, 1000);

    // ResizeObserver to detect container size changes
    const ro = new ResizeObserver(() => {
      invalidate();
    });
    if (mapContainerRef.current) {
      ro.observe(mapContainerRef.current);
    }

    // Window resize handler
    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      ro.disconnect();
      window.removeEventListener('resize', invalidate);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when selectedCity changes
  useEffect(() => {
    if (
      mapInstanceRef.current &&
      selectedCity &&
      typeof selectedCity.lat === 'number' &&
      typeof selectedCity.lng === 'number' &&
      !isNaN(selectedCity.lat) &&
      !isNaN(selectedCity.lng)
    ) {
      mapInstanceRef.current.setView(
        [selectedCity.lat, selectedCity.lng],
        selectedCity.zoom || 12,
        { animate: true }
      );
    }
  }, [selectedCity]);

  // Render markers on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter reports if query present
    const filtered = searchQuery.trim()
      ? reports.filter(
          (r) =>
            r.title.includes(searchQuery) ||
            r.cityName.includes(searchQuery) ||
            r.districtName.includes(searchQuery) ||
            r.addressText.includes(searchQuery)
        )
      : reports;

    filtered.forEach((report) => {
      if (
        typeof report.lat !== 'number' ||
        typeof report.lng !== 'number' ||
        isNaN(report.lat) ||
        isNaN(report.lng)
      ) {
        return;
      }

      let colorClass = '#ba1a1a'; // Red for Unresolved
      if (report.status === 'Proceeding') colorClass = '#7d5200'; // Amber
      if (report.status === 'Solved') colorClass = '#0052cc'; // Blue
      if (report.status === 'Denied') colorClass = '#737685'; // Grey

      const customHtml = `
        <div class="flex items-center justify-center cursor-pointer group">
          <div style="color: ${colorClass}; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));" class="transform transition-transform group-hover:scale-125">
            <span class="material-symbols-outlined text-3xl material-symbols-fill">location_on</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: customHtml,
        className: 'custom-leaflet-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([report.lat, report.lng], { icon: customIcon }).addTo(
        map
      );

      marker.on('click', () => {
        setSelectedReportPopup(report);
      });

      markersRef.current.push(marker);
    });
  }, [reports, searchQuery]);

  // Compute stats dynamically from real DB reports
  const totalCount = reports.length;
  const unresolvedCount = reports.filter((r) => r.status === 'Unresolved').length;
  const proceedingCount = reports.filter((r) => r.status === 'Proceeding').length;
  const solvedCount = reports.filter((r) => r.status === 'Solved').length;

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Map Element */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-[#e1e8ff]" />

      {/* Top Floating Controls Container (Stats + Search) */}
      <div className="absolute top-3 left-4 right-4 md:left-6 md:right-auto md:w-[640px] z-20 flex flex-col gap-3 pointer-events-none">
        {/* Floating Summary Stats Bar */}
        <div className="flex flex-wrap gap-2.5 pointer-events-auto">
          <div className="bg-[#faf9ff]/90 backdrop-blur-md shadow-md rounded-xl p-3 flex-1 min-w-[120px] border border-[#d8e2ff]">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-[#434654] uppercase tracking-wider">
                {t.mapTotal}
              </h3>
              <span className="material-symbols-outlined text-[#003d9b] text-sm">
                analytics
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#003d9b] hanken-grotesk">
              {totalCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#faf9ff]/90 backdrop-blur-md shadow-md rounded-xl p-3 flex-1 min-w-[120px] border border-[#d8e2ff]">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-[#434654] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a] inline-block animate-pulse"></span>
                {t.mapUnresolved}
              </h3>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#ba1a1a] hanken-grotesk">
              {unresolvedCount}
            </div>
          </div>

          <div className="bg-[#faf9ff]/90 backdrop-blur-md shadow-md rounded-xl p-3 flex-1 min-w-[120px] border border-[#d8e2ff] hidden sm:block">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-[#434654] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ffb950] inline-block"></span>
                {t.mapInProgress}
              </h3>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#7d5200] hanken-grotesk">
              {proceedingCount}
            </div>
          </div>

          <div className="bg-[#faf9ff]/90 backdrop-blur-md shadow-md rounded-xl p-3 flex-1 min-w-[120px] border border-[#d8e2ff] hidden lg:block">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-[#434654] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#003d9b] inline-block"></span>
                {t.mapSolved}
              </h3>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#0052cc] hanken-grotesk">
              {solvedCount}
            </div>
          </div>
        </div>

        {/* Floating Search Bar */}
        <div className="pointer-events-auto self-start">
          <div className="bg-[#faf9ff]/95 backdrop-blur-xl shadow-md rounded-full flex items-center px-4 py-2 border border-[#c3c6d6] w-72 md:w-80">
            <span className="material-symbols-outlined text-[#434654] mr-2 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.mapSearchPlaceholder}
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-[#051a3e] placeholder-[#434654]/70 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#737685] hover:text-[#051a3e]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Issue Floating Action Button (FAB) */}
      <button
        onClick={onOpenReportModal}
        className="fixed bottom-24 md:bottom-8 right-5 z-30 bg-[#0052cc] text-[#ffffff] font-semibold px-5 py-3.5 rounded-full shadow-xl hover:bg-[#003d9b] hover:shadow-2xl active:scale-95 transition-all flex items-center gap-2 text-sm border border-white/20 cursor-pointer"
      >
        <span className="material-symbols-outlined text-xl">add_location_alt</span>
        <span>{t.reportBtn}</span>
      </button>

      {/* Selected Marker Report Popup Modal */}
      {selectedReportPopup && (
        <div className="absolute bottom-24 md:bottom-8 left-4 right-4 md:left-8 md:right-auto md:w-96 z-30 bg-[#faf9ff] rounded-2xl shadow-2xl border border-[#d8e2ff] p-4 transition-all animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-1.5 ${
                  selectedReportPopup.status === 'Unresolved'
                    ? 'bg-[#ffdad6] text-[#93000a]'
                    : selectedReportPopup.status === 'Proceeding'
                    ? 'bg-[#ffddb3] text-[#624000]'
                    : 'bg-[#c4d2ff] text-[#001848]'
                }`}
              >
                ● {getStatusLabel(selectedReportPopup.status, t)}
              </span>
              <h3 className="font-bold text-base text-[#051a3e] leading-snug">
                {selectedReportPopup.title}
              </h3>
            </div>
            <button
              onClick={() => setSelectedReportPopup(null)}
              className="text-[#737685] hover:text-[#051a3e] p-1 rounded-full"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <p className="text-xs text-[#434654] mb-3 line-clamp-2">
            {selectedReportPopup.description}
          </p>

          <div className="flex items-center text-xs text-[#737685] mb-3 gap-1">
            <span className="material-symbols-outlined text-sm text-[#003d9b]">
              location_on
            </span>
            <span className="truncate">{selectedReportPopup.addressText}</span>
          </div>

          <div className="w-full mb-3">
            <PhotoPinAnnotator
              imageUrl={selectedReportPopup.imageUrl || getComplaintImageByCategory(selectedReportPopup.category, selectedReportPopup.id)}
              pins={selectedReportPopup.photoPins || []}
              readOnly={true}
              currentLang={currentLang}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onSelectReport(selectedReportPopup);
                setSelectedReportPopup(null);
              }}
              className="flex-1 py-2 bg-[#0052cc] text-white rounded-xl text-xs font-semibold hover:bg-[#003d9b] transition-colors cursor-pointer"
            >
              {t.mapViewDetails}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
