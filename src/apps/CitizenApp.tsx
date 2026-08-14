import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ReportItem, CityInfo } from '../types';
import { CitizenHeader } from '../components/CitizenHeader';
import { CitizenDrawer } from '../components/CitizenDrawer';
import { CitizenPortalView } from '../components/CitizenPortalView';
import { RegionsView } from '../components/RegionsView';
import { ReportsListView } from '../components/ReportsListView';
import { ReportSubmissionModal } from '../components/ReportSubmissionModal';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CitizenAppProps {
  reports: ReportItem[];
  onAddReport: (newReport: Omit<ReportItem, 'id' | 'createdAt' | 'status'>) => void;
  onUpvoteReport: (id: string) => void;
}

export const CitizenApp: React.FC<CitizenAppProps> = ({
  reports,
  onAddReport,
  onUpvoteReport,
}) => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [defaultCityName, setDefaultCityName] = useState<string>('臺北市');
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.8, 120.96]);
  const [mapZoom, setMapZoom] = useState(8);

  // Directly open report submission modal when choosing a region
  const handleSelectCityForReport = (city: CityInfo) => {
    setDefaultCityName(city.nameZh);
    setMapCenter([city.lat, city.lng]);
    setMapZoom(12);
    setIsReportModalOpen(true);
  };

  return (
    <div className="w-full h-screen bg-[#faf9ff] flex flex-col font-sans overflow-hidden">
      <CitizenHeader
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      <CitizenDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 pt-16 overflow-hidden relative">
        <Routes>
          {/* Home Citizen View */}
          <Route
            path="/"
            element={
              <CitizenPortalView
                reports={reports}
                onOpenReportModal={() => setIsReportModalOpen(true)}
                onUpvoteReport={onUpvoteReport}
                onSwitchToMap={() => {
                  setIsReportModalOpen(true);
                }}
              />
            }
          />
          <Route
            path="/citizen"
            element={
              <CitizenPortalView
                reports={reports}
                onOpenReportModal={() => setIsReportModalOpen(true)}
                onUpvoteReport={onUpvoteReport}
                onSwitchToMap={() => {
                  setIsReportModalOpen(true);
                }}
              />
            }
          />

          {/* Direct Map / Pinning view */}
          <Route
            path="/map"
            element={
              <div className="w-full h-full relative">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  scrollWheelZoom={true}
                  className="w-full h-full z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {reports.map((rep) => (
                    <Marker key={rep.id} position={[rep.lat, rep.lng]}>
                      <Popup>
                        <div className="p-1 space-y-1 text-xs max-w-xs">
                          <span className="font-extrabold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">
                            {rep.id}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">{rep.title}</h4>
                          <p className="text-slate-600 line-clamp-2">{rep.description}</p>
                          <div className="text-[10px] text-slate-400 pt-1">
                            📍 {rep.cityName} {rep.districtName}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                {/* Direct Floating Pin / Report Action */}
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="absolute bottom-8 right-8 z-10 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">add_location_alt</span>
                  <span>Pin Location & Submit Report</span>
                </button>
              </div>
            }
          />

          {/* Regions Directory */}
          <Route
            path="/regions"
            element={<RegionsView onSelectCity={handleSelectCityForReport} />}
          />

          {/* Public Reports Feed */}
          <Route
            path="/reports"
            element={
              <ReportsListView
                reports={reports}
                onOpenReportModal={() => setIsReportModalOpen(true)}
              />
            }
          />
        </Routes>
      </main>

      {/* Citizen Report Modal */}
      <ReportSubmissionModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitReport={onAddReport}
        defaultCityName={defaultCityName}
      />
    </div>
  );
};
