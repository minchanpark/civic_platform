import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ReportItem, IssueStatus } from '../../types';
import { getComplaintImageByCategory } from '../../utils/complaintImages';
import { UrgencyBadge } from './UrgencyBadge';
import { EvaluationModal } from './EvaluationModal';
import { evaluateReportPriority } from '../../utils/evaluation';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Calendar,
  Filter,
  Download,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Layers,
  MousePointer,
  Crop,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Anchor,
  Check,
  GripHorizontal,
  Zap
} from 'lucide-react';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface AdminDashboardViewProps {
  reports: ReportItem[];
  onUpdateStatus: (id: string, newStatus: IssueStatus) => void;
  onUpdateReportDetails?: (id: string, updates: Partial<ReportItem>) => void;
  onNavigateToList: () => void;
  targetMapReportId?: string;
}

// Controller to handle automatic map size recalculation (fixes grey map bug)
const MapAutoInvalidator: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const invalidate = () => {
      map.invalidateSize();
    };

    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 200);
    const t3 = setTimeout(invalidate, 500);

    const ro = new ResizeObserver(() => {
      invalidate();
    });
    ro.observe(container);

    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);

  return null;
};

// Controller to handle zoom and reset in Leaflet
const MapControls: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  return (
    <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200 text-xs font-semibold text-slate-700">
      <button
        onClick={() => map.setZoom(map.getZoom() + 1)}
        className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={() => map.setZoom(map.getZoom() - 1)}
        className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() => map.setView(center, zoom)}
        className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        title="Reset Map View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};

// Interactive Area Selection Handler for Leaflet Map using useMap
const AreaSelectionHandler: React.FC<{
  enabled: boolean;
  onAreaChange: (bounds: L.LatLngBounds | null) => void;
}> = ({ enabled, onAreaChange }) => {
  const map = useMap();
  const onAreaChangeRef = useRef(onAreaChange);
  const isDrawingRef = useRef(false);
  const startLatLngRef = useRef<L.LatLng | null>(null);

  useEffect(() => {
    onAreaChangeRef.current = onAreaChange;
  }, [onAreaChange]);

  useEffect(() => {
    if (!enabled) {
      map.dragging.enable();
      const container = map.getContainer();
      if (container) container.style.cursor = '';
      return;
    }

    const container = map.getContainer();
    if (container) container.style.cursor = 'crosshair';

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      map.dragging.disable();
      startLatLngRef.current = e.latlng;
      isDrawingRef.current = true;
      if (onAreaChangeRef.current) {
        onAreaChangeRef.current(L.latLngBounds(e.latlng, e.latlng));
      }
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current || !startLatLngRef.current) return;
      if (onAreaChangeRef.current) {
        onAreaChangeRef.current(L.latLngBounds(startLatLngRef.current, e.latlng));
      }
    };

    const handleMouseUp = (e?: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current) return;
      if (e && startLatLngRef.current && onAreaChangeRef.current) {
        onAreaChangeRef.current(L.latLngBounds(startLatLngRef.current, e.latlng));
      }
      isDrawingRef.current = false;
      startLatLngRef.current = null;
      map.dragging.enable();
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    const handleWindowMouseUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        startLatLngRef.current = null;
        map.dragging.enable();
      }
    };
    window.addEventListener('mouseup', handleWindowMouseUp);

    map.dragging.disable();

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      map.dragging.enable();
      if (container) container.style.cursor = '';
    };
  }, [enabled, map]);

  return null;
};

// Overlay component to render the drawn Leaflet Rectangle
const DrawnRectangleOverlay: React.FC<{
  bounds: L.LatLngBounds | null;
}> = ({ bounds }) => {
  const map = useMap();
  const rectangleRef = useRef<L.Rectangle | null>(null);

  useEffect(() => {
    if (!bounds) {
      if (rectangleRef.current) {
        rectangleRef.current.remove();
        rectangleRef.current = null;
      }
      return;
    }

    if (!rectangleRef.current) {
      const rect = L.rectangle(bounds, {
        color: '#1a237e',
        fillColor: '#3f51b5',
        fillOpacity: 0.25,
        weight: 2.5,
        dashArray: '6, 6',
        interactive: false, // Critical: prevent rectangle from capturing mouse drag events
      }).addTo(map);
      rectangleRef.current = rect;
    } else {
      rectangleRef.current.setBounds(bounds);
    }
  }, [bounds, map]);

  useEffect(() => {
    return () => {
      if (rectangleRef.current) {
        rectangleRef.current.remove();
        rectangleRef.current = null;
      }
    };
  }, [map]);

  return null;
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  reports,
  onUpdateStatus,
  onUpdateReportDetails,
  onNavigateToList,
  targetMapReportId,
}) => {
  // Mode switcher: 'selected-map', 'region-status', or 'fast-track'
  const [dashboardMode, setDashboardMode] = useState<'selected-map' | 'region-status' | 'fast-track'>('selected-map');

  // Evaluation Modal state
  const [evaluatingReport, setEvaluatingReport] = useState<ReportItem | null>(null);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('Today');

  // Map selection mode: 'single', 'area', 'move'
  const [mapToolMode, setMapToolMode] = useState<'single' | 'area' | 'move'>('single');

  // Map area bounding box state for 'area' mode
  const [selectedAreaBounds, setSelectedAreaBounds] = useState<L.LatLngBounds | null>(null);

  // Switch to area mode or toggle off if already active
  const handleSelectAreaMode = () => {
    if (mapToolMode === 'area') {
      setMapToolMode('single');
      setSelectedAreaBounds(null);
    } else {
      setMapToolMode('area');
      if (!selectedAreaBounds) {
        setSelectedAreaBounds(
          L.latLngBounds([25.025, 121.545], [25.050, 121.580])
        );
      }
    }
  };

  // Filter reports contained within the selected area bounds
  const selectedAreaReports = useMemo(() => {
    if (!selectedAreaBounds) return reports;
    return reports.filter((rep) => {
      const lat = rep.lat || 25.038;
      const lng = rep.lng || 121.564;
      return selectedAreaBounds.contains([lat, lng]);
    });
  }, [reports, selectedAreaBounds]);

  // Bottom panel collapsed state & resizable height
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  const [panelHeight, setPanelHeight] = useState<number>(380);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 180 && newHeight <= window.innerHeight - 100) {
        setPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Selected report for map detail view
  const [selectedReportId, setSelectedReportId] = useState<string>(() => reports[0]?.id || '');

  // Keep selectedReportId updated if reports list changes and current selection is missing
  useEffect(() => {
    if (reports.length > 0 && !reports.some((r) => r.id === selectedReportId)) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  // Pin Feedback state for the panel
  const [pinFeedbacks, setPinFeedbacks] = useState<{ [key: string]: { status: string; feedback: string } }>({
    'pin-1': { status: 'Pending', feedback: '' },
    'pin-2': { status: 'In Progress', feedback: 'Scheduled for patching tomorrow.' },
  });

  // Find the currently focused report item
  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  // Status counts from real DB reports
  const pendingCount = reports.filter((r) => r.status === 'Unresolved').length;
  const inProgressCount = reports.filter((r) => r.status === 'Proceeding').length;
  const solvedCount = reports.filter((r) => r.status === 'Solved').length;
  const deniedCount = reports.filter((r) => r.status === 'Denied').length;

  const handlePinStatusChange = (pinId: string, status: string) => {
    setPinFeedbacks((prev) => ({
      ...prev,
      [pinId]: { ...prev[pinId], status },
    }));
  };

  const handlePinFeedbackTextChange = (pinId: string, feedback: string) => {
    setPinFeedbacks((prev) => ({
      ...prev,
      [pinId]: { ...prev[pinId], feedback },
    }));
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f4f5fa] overflow-y-auto">
      {/* Top Header Controls Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        {/* Left: Mode Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setDashboardMode('selected-map')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              dashboardMode === 'selected-map'
                ? 'bg-white text-[#1a237e] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Selected Map Area</span>
          </button>

          <button
            onClick={() => setDashboardMode('region-status')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              dashboardMode === 'region-status'
                ? 'bg-white text-[#1a237e] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Regional Complaints</span>
          </button>

          <button
            onClick={() => setDashboardMode('fast-track')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              dashboardMode === 'fast-track'
                ? 'bg-rose-600 text-white shadow-xs border border-rose-700 font-black'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>⚡ Urgent Fast-Track</span>
            <span className="ml-1 bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
              {reports.filter((r) => r.urgency === 'High' || r.importance === 'High' || r.priority === 'High' || r.category === 'Disaster').length}
            </span>
          </button>
        </div>

        {/* Middle: Dropdown Filters (Only in selected-map mode) */}
        {dashboardMode === 'selected-map' && (
          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400"
              >
                <option value="All">All Categories</option>
                <option value="Road damage">Traffic / Road</option>
                <option value="Environmental issue">Environment / Sanitation</option>
                <option value="Building damage">Architecture / Construction</option>
                <option value="Facility issue">Facility Issue</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-xl pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400"
              >
                <option value="Today">Today</option>
                <option value="7days">Past 7 Days</option>
                <option value="30days">Past 30 Days</option>
              </select>
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-xl pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400"
              >
                <option value="All">All Statuses</option>
                <option value="Unresolved">Pending</option>
                <option value="Proceeding">In Progress</option>
                <option value="Solved">Resolved</option>
                <option value="Denied">Denied</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Right: Status Counts Pill Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200/60 px-2.5 py-1 rounded-full text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Pending</span>
            <span className="font-extrabold">{pendingCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>In Progress</span>
            <span className="font-extrabold">{inProgressCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Resolved</span>
            <span className="font-extrabold">{solvedCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-slate-600">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Denied</span>
            <span className="font-extrabold">{deniedCount}</span>
          </div>
        </div>
      </div>

      {/* DASHBOARD MODE 1: Selected Region Map View */}
      {dashboardMode === 'selected-map' ? (
        <div className="flex-1 flex flex-col relative overflow-y-auto min-h-0">
          {/* Main Interactive Map Section */}
          <div className="relative w-full h-[420px] lg:h-[480px] bg-slate-900 overflow-hidden shrink-0">
            {/* Leaflet Map Container */}
            <MapContainer
              center={[25.038, 121.564]}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {/* Area Selection Drag Handler */}
              <AreaSelectionHandler
                enabled={mapToolMode === 'area'}
                onAreaChange={(bounds) => setSelectedAreaBounds(bounds)}
              />

              {/* Drawn Area Selection Box Overlay (only rendered in Area Select mode) */}
              {mapToolMode === 'area' && selectedAreaBounds && (
                <DrawnRectangleOverlay bounds={selectedAreaBounds} />
              )}

              {reports.map((rep) => {
                const markerProps: any = {
                  position: [rep.lat || 25.038, rep.lng || 121.564],
                  eventHandlers: {
                    click: () => setSelectedReportId(rep.id),
                  },
                };
                return (
                  <Marker key={rep.id} {...markerProps}>
                    <Popup>
                      <div className="p-1 max-w-xs text-xs space-y-1">
                        <div className="font-bold text-slate-900">{rep.title}</div>
                        <div className="text-slate-500">{rep.addressText}</div>
                        <span className="inline-block bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {rep.status === 'Unresolved' ? 'Pending' : rep.status}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              <MapAutoInvalidator />
              <MapControls center={[25.038, 121.564]} zoom={13} />
            </MapContainer>

            {/* Top Left Info Callout Badge on Map */}
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-lg text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span>SONGSHAN AIRPORT / ZHONGSHAN DISTRICT</span>
              </div>
            </div>

            {/* Area Mode Instruction Banner on Top Center of Map */}
            {mapToolMode === 'area' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-[90vw]">
                <div className="bg-slate-900/90 text-white backdrop-blur-md px-4 py-2 rounded-2xl border border-blue-400/40 shadow-xl text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-1.5 text-amber-300 shrink-0">
                    <Crop className="w-4 h-4" />
                    <span>Area Selection Mode</span>
                  </div>
                  <span className="text-slate-500 font-normal hidden sm:inline">|</span>
                  <span className="text-slate-200 text-[11px] truncate hidden sm:inline">
                    Drag on the map to select an area (Complaints in area: <span className="text-amber-300 font-extrabold">{selectedAreaReports.length}</span>)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAreaBounds(
                        L.latLngBounds([25.025, 121.545], [25.050, 121.580])
                      )
                    }
                    className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                  >
                    Reset Area
                  </button>
                </div>
              </div>
            )}

            {/* Hover / Selected Marker Callout Box on Map (Visible in single mode) */}
            {mapToolMode !== 'area' && activeReport && (
              <div className="absolute top-16 left-1/3 z-10 -translate-x-1/2">
                <div className="bg-[#1a237e] text-white px-4 py-2 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 border border-blue-400/40 animate-bounce">
                  <MapPin className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>{activeReport.title}</span>
                </div>
              </div>
            )}

            {/* Floating Control Toolbar at Bottom Center of Map */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
                <button
                  onClick={() => {
                    setMapToolMode('single');
                    setSelectedAreaBounds(null);
                  }}
                  className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                    mapToolMode === 'single'
                      ? 'bg-[#1a237e] text-white shadow-xs'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Single Select</span>
                </button>

                <button
                  onClick={handleSelectAreaMode}
                  className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                    mapToolMode === 'area'
                      ? 'bg-[#1a237e] text-white shadow-xs'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>Area Select</span>
                </button>

                <button
                  onClick={() => {
                    setMapToolMode('move');
                    setSelectedAreaBounds(null);
                  }}
                  className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                    mapToolMode === 'move'
                      ? 'bg-[#1a237e] text-white shadow-xs'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Pan Map</span>
                </button>
              </div>
            </div>

            {/* Right Side Overlay Card: Area / Single Selected Complaints */}
            <div className="absolute top-4 right-4 z-10 w-80 max-w-[calc(100vw-2rem)]">
              <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 text-slate-800 space-y-3">
                {/* Header line */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 font-extrabold text-sm text-[#1a237e]">
                    <Anchor className="w-4 h-4 text-blue-600" />
                    <span>{mapToolMode === 'area' ? 'Area Selected Reports' : 'Single Selected Report'}</span>
                  </div>
                  <button
                    onClick={onNavigateToList}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
                  <span>
                    Selected Reports:{' '}
                    <span className="font-bold text-slate-800">
                      {mapToolMode === 'area' ? selectedAreaReports.length : 1}
                    </span>
                  </span>
                  {mapToolMode === 'area' && (
                    <span className="text-[10px] text-blue-600 font-bold">
                      Drag to select area
                    </span>
                  )}
                </div>

                {mapToolMode === 'area' ? (
                  /* Area Selected Complaints List */
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {selectedAreaReports.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium">
                        No reports found in the selected area.
                      </div>
                    ) : (
                      selectedAreaReports.map((rep) => (
                        <div
                          key={rep.id}
                          onClick={() => setSelectedReportId(rep.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                            selectedReportId === rep.id
                              ? 'bg-blue-50/90 border-blue-500 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <img
                            src={
                              rep.imageUrl ||
                              getComplaintImageByCategory(rep.category, rep.id)
                            }
                            alt={rep.title}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-xs text-slate-900 truncate">
                                {rep.title}
                              </h4>
                              <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full shrink-0">
                                {rep.status === 'Unresolved' ? 'Pending' : rep.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">
                              {rep.category} • {rep.createdAt}
                            </div>
                            <p className="text-[10px] text-slate-600 truncate">{rep.addressText}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : !activeReport ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-xs font-bold text-slate-500">
                    No report currently selected.
                  </div>
                ) : (
                  /* Single Selected Complaint Card */
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-3">
                    <img
                      src={
                        activeReport.imageUrl ||
                        getComplaintImageByCategory(activeReport.category, activeReport.id)
                      }
                      alt="Complaint"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">
                          {activeReport.title}
                        </h4>
                        <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                          {activeReport.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2">
                        <span>{activeReport.category}</span>
                        <span>•</span>
                        <span>{activeReport.createdAt}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                        {activeReport.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Collapsible & Resizable Panel: Detailed info & Pin action panel */}
          <div className="bg-white border-t border-slate-200 shadow-xl flex flex-col shrink-0 transition-all duration-200 relative">
            {/* Drag Handle Bar for Height Adjustment */}
            {!isPanelCollapsed && (
              <div
                onMouseDown={handleMouseDown}
                className="w-full h-3 bg-slate-100 hover:bg-blue-500/20 active:bg-blue-600/30 cursor-ns-resize flex items-center justify-center transition-colors border-b border-slate-200 group select-none touch-none"
                title="Drag up/down to adjust panel height"
              >
                <div className="w-12 h-1 rounded-full bg-slate-300 group-hover:bg-blue-600 transition-colors" />
              </div>
            )}

            {/* Header bar of panel */}
            <div className="bg-slate-50/90 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                className="flex items-center gap-2 text-xs font-extrabold text-slate-800 hover:text-blue-900 cursor-pointer"
              >
                {isPanelCollapsed ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                <span>Details & Pin Actions: {activeReport ? activeReport.title : 'No Report'}</span>
              </button>

              <div className="flex items-center gap-3 text-xs flex-wrap">
                {/* Height Presets / Quick Adjuster Buttons */}
                {!isPanelCollapsed && (
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-bold">
                    <span className="text-[10px] text-slate-500 px-1 font-semibold">Height:</span>
                    <button
                      type="button"
                      onClick={() => setPanelHeight(280)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        panelHeight === 280 ? 'bg-white text-blue-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      S (280px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanelHeight(420)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        panelHeight === 420 ? 'bg-white text-blue-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      M (420px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanelHeight(600)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        panelHeight === 600 ? 'bg-white text-blue-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      L (600px)
                    </button>
                  </div>
                )}

                {/* Status Changer Dropdown */}
                {activeReport && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">Status:</span>
                    <select
                      value={activeReport.status}
                      onChange={(e) => onUpdateStatus(activeReport.id, e.target.value as IssueStatus)}
                      className="bg-red-50 text-red-700 border border-red-200 font-extrabold text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
                    >
                      <option value="Unresolved">Pending</option>
                      <option value="Proceeding">In Progress</option>
                      <option value="Solved">Resolved</option>
                      <option value="Denied">Denied</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold cursor-pointer bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                >
                  <span>{isPanelCollapsed ? 'Expand Panel' : 'Collapse Panel'}</span>
                  {isPanelCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Collapsible Panel Content */}
            {!isPanelCollapsed && (
              <div
                style={{ height: `${panelHeight}px` }}
                className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white overflow-y-auto transition-[height] duration-75"
              >
                {/* Column 1 (Left, 4 cols): Image with Photo Pins */}
                <div className="lg:col-span-4 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs min-h-[200px]">
                  <img
                    src={
                      activeReport?.imageUrl ||
                      (activeReport ? getComplaintImageByCategory(activeReport.category, activeReport.id) : getComplaintImageByCategory())
                    }
                    alt="Civil complaint detail"
                    className="w-full h-full object-cover"
                  />

                  {/* Pin Overlay 1 */}
                  <div
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer group"
                    style={{ left: '35%', top: '70%' }}
                  >
                    <div className="w-7 h-7 rounded-full bg-red-600 text-white font-extrabold text-xs flex items-center justify-center shadow-lg ring-4 ring-red-500/40 animate-pulse">
                      1
                    </div>
                  </div>

                  {/* Pin Overlay 2 */}
                  <div
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer group"
                    style={{ left: '60%', top: '85%' }}
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-lg ring-4 ring-amber-400/40">
                      2
                    </div>
                  </div>
                </div>

                {/* Column 2 (Middle, 4 cols): Report Info & Description & Urgency Matrix */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">
                      {activeReport ? activeReport.title : 'No Registered Reports'}
                    </h3>
                    <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full shrink-0">
                      {activeReport ? activeReport.status : 'N/A'}
                    </span>
                  </div>

                  {activeReport && (
                    <div className="space-y-2">
                      <UrgencyBadge report={activeReport} showDetails={true} />

                      {/* Quick Action Buttons for Urgency & Fast-Track Dispatch */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEvaluatingReport(activeReport)}
                          className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">edit_note</span>
                          <span>Evaluate Priority / AI Diagnosis</span>
                        </button>

                        {activeReport.status !== 'Solved' && (
                          <button
                            type="button"
                            onClick={() => {
                              const nowStr = new Date().toLocaleString();
                              if (onUpdateReportDetails) {
                                onUpdateReportDetails(activeReport.id, {
                                  urgency: 'High',
                                  importance: 'High',
                                  priority: 'High',
                                  status: 'Proceeding',
                                  assignedUnit: activeReport.assignedUnit || 'Emergency Response Team',
                                  urgencyReason: `[⚡ Express Fast-Track Order] Emergency team dispatched (${nowStr})`,
                                });
                              }
                              onUpdateStatus(activeReport.id, 'Proceeding');
                              alert(`⚡ [Express Dispatch Order]\nEmergency dispatch order issued for complaint [${activeReport.id}]!`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">bolt</span>
                            <span>⚡ Express Dispatch</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 space-y-1 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{activeReport ? activeReport.createdAt : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{activeReport ? (activeReport.addressText || `${activeReport.cityName || ''} ${activeReport.districtName || ''}`) : '-'}</span>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed max-h-32 overflow-y-auto">
                    <p className="whitespace-pre-wrap">
                      {activeReport ? activeReport.description : 'Select a report or submit a new report from the citizen portal.'}
                    </p>
                  </div>
                </div>

                {/* Column 3 (Right, 4 cols): Pin Actions & AI Feedback */}
                <div className="lg:col-span-4 space-y-3 pl-0 lg:pl-4 lg:border-l border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900">
                      <Anchor className="w-4 h-4 text-blue-700" />
                      <span>Pin Actions</span>
                    </div>

                    <button className="bg-[#1a237e] hover:bg-blue-900 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>AI Agent</span>
                    </button>
                  </div>

                  {/* Pin Action Item 1 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[11px] flex items-center justify-center">
                          1
                        </span>
                        <span className="font-bold text-xs text-slate-800">Main Pothole</span>
                      </div>
                      <select
                        value={pinFeedbacks['pin-1']?.status || 'Pending'}
                        onChange={(e) => handlePinStatusChange('pin-1', e.target.value)}
                        className="bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2 py-0.5 text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    <textarea
                      value={pinFeedbacks['pin-1']?.feedback || ''}
                      onChange={(e) => handlePinFeedbackTextChange('pin-1', e.target.value)}
                      placeholder="Add admin feedback..."
                      rows={2}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Pin Action Item 2 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[11px] flex items-center justify-center">
                          2
                        </span>
                        <span className="font-bold text-xs text-slate-800">Cracked Edge</span>
                      </div>
                      <select
                        value={pinFeedbacks['pin-2']?.status || 'In Progress'}
                        onChange={(e) => handlePinStatusChange('pin-2', e.target.value)}
                        className="bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2 py-0.5 text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    <textarea
                      value={pinFeedbacks['pin-2']?.feedback || ''}
                      onChange={(e) => handlePinFeedbackTextChange('pin-2', e.target.value)}
                      placeholder="Add admin feedback..."
                      rows={2}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DASHBOARD MODE 2: Taiwan Complaint Status by Region */
        <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Taiwan Complaint Status by Region
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor real-time complaint submission and processing status by region.
              </p>
            </div>

            <button className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer self-start sm:self-auto">
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export Data</span>
            </button>
          </div>

          {/* Top Row Cards: General Status Map & Overall Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* General Status Map (Left 8 cols) */}
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">General Status Map</h3>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    Urgent
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    In Progress
                  </span>
                </div>
              </div>

              {/* Dark Map Canvas Preview */}
              <div className="w-full h-64 rounded-xl bg-[#0a0f1d] relative overflow-hidden flex flex-col items-center justify-center text-slate-400">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30" />

                {/* Animated Heatmap Dots */}
                <div className="absolute top-1/3 left-1/3 w-4 h-4 rounded-full bg-red-500/80 ring-8 ring-red-500/20 animate-ping" />
                <div className="absolute top-1/3 left-1/3 w-3 h-3 rounded-full bg-red-500 shadow-lg" />

                <div className="absolute bottom-1/3 right-1/3 w-4 h-4 rounded-full bg-blue-500/80 ring-8 ring-blue-500/20 animate-ping" />
                <div className="absolute bottom-1/3 right-1/3 w-3 h-3 rounded-full bg-blue-500 shadow-lg" />

                <span className="relative z-10 text-xs font-bold text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 backdrop-blur-xs">
                  Interactive Regional Heatmap Active
                </span>

                <div className="absolute bottom-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
              </div>
            </div>

            {/* Overall Summary (Right 4 cols) */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <h3 className="font-extrabold text-sm text-slate-900">Overall Summary</h3>

                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 tracking-wider">
                    TOTAL SUBMISSIONS
                  </div>
                  <div className="text-4xl font-black text-[#1a237e] mt-1 tracking-tight">
                    1,248
                  </div>
                </div>

                <div className="w-full h-[1px] bg-slate-100 my-4" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Resolved</div>
                    <div className="text-2xl font-black text-emerald-600 mt-0.5">892</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Pending</div>
                    <div className="text-2xl font-black text-blue-600 mt-0.5">356</div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Updated 10 minutes ago across 5 administrative jurisdictions.
              </p>
            </div>
          </div>

          {/* Detailed Status by Region Section */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-900">Detailed Status by Region</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Northern Jurisdiction Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                    <span>Northern</span>
                  </div>
                  <span className="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-0.5 rounded-full border border-red-100">
                    428 cases
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Taipei</div>
                    <div className="text-xs text-slate-500 mt-0.5">156 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">New Taipei</div>
                    <div className="text-xs text-slate-500 mt-0.5">142 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Taoyuan</div>
                    <div className="text-xs text-slate-500 mt-0.5">89 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Keelung</div>
                    <div className="text-xs text-slate-500 mt-0.5">41 cases</div>
                  </div>
                </div>
              </div>

              {/* Central Jurisdiction Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <Crop className="w-4 h-4 text-slate-600" />
                    <span>Central</span>
                  </div>
                  <span className="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-0.5 rounded-full border border-red-100">
                    312 cases
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Taichung</div>
                    <div className="text-xs text-slate-500 mt-0.5">185 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Changhua</div>
                    <div className="text-xs text-slate-500 mt-0.5">76 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Nantou</div>
                    <div className="text-xs text-slate-500 mt-0.5">51 cases</div>
                  </div>
                </div>
              </div>

              {/* Southern Jurisdiction Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                    <span>Southern</span>
                  </div>
                  <span className="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-0.5 rounded-full border border-red-100">
                    285 cases
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Kaohsiung</div>
                    <div className="text-xs text-slate-500 mt-0.5">162 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Tainan</div>
                    <div className="text-xs text-slate-500 mt-0.5">88 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Chiayi</div>
                    <div className="text-xs text-slate-500 mt-0.5">35 cases</div>
                  </div>
                </div>
              </div>

              {/* Eastern Jurisdiction Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                    <span>Eastern</span>
                  </div>
                  <span className="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-0.5 rounded-full border border-red-100">
                    145 cases
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Hualien</div>
                    <div className="text-xs text-slate-500 mt-0.5">82 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Taitung</div>
                    <div className="text-xs text-slate-500 mt-0.5">63 cases</div>
                  </div>
                </div>
              </div>

              {/* Offshore Islands Jurisdiction Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <Anchor className="w-4 h-4 text-slate-600" />
                    <span>Offshore Islands</span>
                  </div>
                  <span className="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-0.5 rounded-full border border-red-100">
                    78 cases
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Penghu</div>
                    <div className="text-xs text-slate-500 mt-0.5">42 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Kinmen</div>
                    <div className="text-xs text-slate-500 mt-0.5">25 cases</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div className="font-bold text-xs text-slate-800">Matsu</div>
                    <div className="text-xs text-slate-500 mt-0.5">11 cases</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation & AI Diagnosis Modal */}
      {evaluatingReport && (
        <EvaluationModal
          report={evaluatingReport}
          onClose={() => setEvaluatingReport(null)}
          onUpdateReportDetails={(id, updates) => {
            if (onUpdateReportDetails) {
              onUpdateReportDetails(id, updates);
            }
            setEvaluatingReport(null);
          }}
          onUpdateStatus={onUpdateStatus}
        />
      )}
    </div>
  );
};
