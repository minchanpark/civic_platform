import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { IssueCategory, ReportItem, Language, PhotoPin } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { PhotoPinAnnotator } from './PhotoPinAnnotator';
import { TAIWAN_CITIES_AND_DISTRICTS } from '../data/taiwanDistricts';

interface ReportSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (newReport: Omit<ReportItem, 'id' | 'createdAt' | 'status'>) => void;
  defaultCityName?: string;
  currentLang?: Language;
}

export const ReportSubmissionModal: React.FC<ReportSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSubmitReport,
  defaultCityName = 'Taipei City',
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Step state: 1 = Choose location & map, 2 = Describe issue
  const [step, setStep] = useState<1 | 2>(1);

  const [selectedCityName, setSelectedCityName] = useState<string>(defaultCityName);
  const [district, setDistrict] = useState('Zhongshan Dist.');

  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('Facility issue');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPins, setPhotoPins] = useState<PhotoPin[]>([]);
  const [hasPlacedPin, setHasPlacedPin] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: 25.0583,
    lng: 121.5235,
  });

  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Camera Viewfinder States & Refs
  const [isCameraViewfinderOpen, setIsCameraViewfinderOpen] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPhotoSourceModalOpen, setIsPhotoSourceModalOpen] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [submittedCaseId, setSubmittedCaseId] = useState<string>('');
  const [submittedTime, setSubmittedTime] = useState<string>('');

  // Sync city name when modal opens or default city changes
  useEffect(() => {
    if (defaultCityName && isOpen) {
      setSelectedCityName(defaultCityName);
      const foundCity = TAIWAN_CITIES_AND_DISTRICTS.find(
        (c) => c.nameZh === defaultCityName || c.nameZh.includes(defaultCityName) || defaultCityName.includes(c.nameZh)
      );
      if (foundCity && foundCity.districts.length > 0) {
        setDistrict(foundCity.districts[0].nameZh);
        const initLat = foundCity.districts[0].lat;
        const initLng = foundCity.districts[0].lng;
        if (typeof initLat === 'number' && typeof initLng === 'number' && !isNaN(initLat) && !isNaN(initLng)) {
          setCurrentCoords({ lat: initLat, lng: initLng });
          if (hasPlacedPin && markerRef.current) {
            markerRef.current.setLatLng([initLat, initLng]);
          }
          if (miniMapRef.current) {
            miniMapRef.current.setView([initLat, initLng], 15);
            setTimeout(() => {
              miniMapRef.current?.invalidateSize();
            }, 100);
          }
        }
      }
    }
  }, [defaultCityName, isOpen]);

  // Reset to step 1 and clear state when opening modal
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setHasPlacedPin(false);
      setIsSubmittedSuccess(false);
      setPhotos([]);
      setPhotoPins([]);
      setDescription('');
      if (markerRef.current && miniMapRef.current) {
        if (miniMapRef.current.hasLayer(markerRef.current)) {
          miniMapRef.current.removeLayer(markerRef.current);
        }
      }
    }
  }, [isOpen]);

  // Categories list
  const categories: { id: IssueCategory; label: string; icon: string }[] = [
    { id: 'Disaster', label: t.catDisaster, icon: 'warning' },
    { id: 'Facility issue', label: t.catFacility, icon: 'handyman' },
    { id: 'Road damage', label: t.catRoad, icon: 'edit_road' },
    { id: 'Building damage', label: t.catBuilding, icon: 'domain' },
    { id: 'Environmental issue', label: t.catEnvironment, icon: 'mop' },
  ];

  // Current city object & district list
  const currentCityObj = TAIWAN_CITIES_AND_DISTRICTS.find((c) => c.nameZh === selectedCityName) || TAIWAN_CITIES_AND_DISTRICTS[0];

  // Helper to create or move pin on map
  const placePinOnMap = (map: L.Map, lat: number, lng: number) => {
    if (!markerRef.current) {
      const pinIcon = L.divIcon({
        className: 'report-map-pin-icon',
        html: `
          <div style="position: relative; width: 0; height: 0;">
            <div style="
              position: absolute;
              bottom: 0;
              left: -22px;
              width: 44px;
              height: 44px;
              background: linear-gradient(135deg, #0052cc, #003d9b);
              color: white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 8px 24px rgba(0, 61, 155, 0.5);
              border: 3px solid white;
              cursor: grab;
              animation: bouncePin 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            ">
              <span class="material-symbols-outlined" style="transform: rotate(45deg); font-size: 26px;">
                location_on
              </span>
            </div>
            <div style="
              position: absolute;
              top: -8px;
              left: -16px;
              width: 32px;
              height: 16px;
              border-radius: 50%;
              background: rgba(0, 82, 204, 0.25);
              border: 2px solid #0052cc;
              animation: pinRipple 1.5s infinite ease-out;
            "></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        if (pos) {
          setCurrentCoords({ lat: pos.lat, lng: pos.lng });
        }
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
      if (!map.hasLayer(markerRef.current)) {
        markerRef.current.addTo(map);
      }
    }

    setCurrentCoords({ lat, lng });
    setHasPlacedPin(true);
  };

  // Initialize mini interactive map with automatic resize invalidation
  useEffect(() => {
    if (!isOpen || !miniMapContainerRef.current) return;

    const safeLat = typeof currentCoords.lat === 'number' && !isNaN(currentCoords.lat) ? currentCoords.lat : 25.0583;
    const safeLng = typeof currentCoords.lng === 'number' && !isNaN(currentCoords.lng) ? currentCoords.lng : 121.5235;

    if (!miniMapRef.current) {
      const map = L.map(miniMapContainerRef.current, {
        center: [safeLat, safeLng],
        zoom: 15,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (e && e.latlng) {
          placePinOnMap(map, e.latlng.lat, e.latlng.lng);
        }
      });

      miniMapRef.current = map;
    } else {
      miniMapRef.current.setView([safeLat, safeLng], 15);
      if (hasPlacedPin && markerRef.current) {
        markerRef.current.setLatLng([safeLat, safeLng]);
      }
    }

    const currentMap = miniMapRef.current;
    const invalidate = () => {
      if (currentMap) currentMap.invalidateSize();
    };

    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 150);
    const t3 = setTimeout(invalidate, 300);
    const t4 = setTimeout(invalidate, 600);

    const ro = new ResizeObserver(() => {
      invalidate();
    });
    if (miniMapContainerRef.current) {
      ro.observe(miniMapContainerRef.current);
    }

    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      ro.disconnect();
      window.removeEventListener('resize', invalidate);

      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // Recalculate map container layout whenever step switches to Step 1
  useEffect(() => {
    if (step === 1 && miniMapRef.current) {
      const invalidate = () => miniMapRef.current?.invalidateSize();
      invalidate();
      const timer = setTimeout(invalidate, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle City Change -> Auto pan map
  const handleCityChange = (newCityName: string) => {
    setSelectedCityName(newCityName);
    const cityObj = TAIWAN_CITIES_AND_DISTRICTS.find((c) => c.nameZh === newCityName) || TAIWAN_CITIES_AND_DISTRICTS[0];
    const firstDist = cityObj.districts[0];
    setDistrict(firstDist ? firstDist.nameZh : '');
    const newLat = firstDist?.lat ?? cityObj.lat;
    const newLng = firstDist?.lng ?? cityObj.lng;

    if (typeof newLat === 'number' && typeof newLng === 'number' && !isNaN(newLat) && !isNaN(newLng)) {
      setCurrentCoords({ lat: newLat, lng: newLng });
      if (hasPlacedPin && markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
      if (miniMapRef.current) {
        miniMapRef.current.flyTo([newLat, newLng], 15, { duration: 0.8 });
      }
    }
  };

  // Handle District Change -> Auto pan map to selected district
  const handleDistrictChange = (newDistrictName: string) => {
    setDistrict(newDistrictName);
    const cityObj = TAIWAN_CITIES_AND_DISTRICTS.find((c) => c.nameZh === selectedCityName) || TAIWAN_CITIES_AND_DISTRICTS[0];
    const distObj = cityObj.districts.find((d) => d.nameZh === newDistrictName);
    const targetLat = distObj?.lat ?? cityObj.lat;
    const targetLng = distObj?.lng ?? cityObj.lng;

    if (typeof targetLat === 'number' && typeof targetLng === 'number' && !isNaN(targetLat) && !isNaN(targetLng)) {
      setCurrentCoords({ lat: targetLat, lng: targetLng });
      if (hasPlacedPin && markerRef.current) {
        markerRef.current.setLatLng([targetLat, targetLng]);
      }
      if (miniMapRef.current) {
        miniMapRef.current.flyTo([targetLat, targetLng], 15, { duration: 0.8 });
      }
    }
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const startCameraStream = async (facing: 'user' | 'environment' = 'environment') => {
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.log('Video play error:', err));
      }
    } catch (err: any) {
      console.error('Camera stream error:', err);
      setCameraError(t.cameraErrorText || 'Cannot access camera. Please check camera permissions or select a photo from your device.');
    }
  };

  useEffect(() => {
    if (isCameraViewfinderOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraViewfinderOpen, cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const closeCameraViewfinder = () => {
    stopCameraStream();
    setIsCameraViewfinderOpen(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (cameraFacingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setPhotos((prev) => [...prev, dataUrl]);
    }
    closeCameraViewfinder();
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCameraStream(nextFacing);
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setPhotos((prev) => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }

    e.target.value = '';
    setIsPhotoSourceModalOpen(false);
  };

  const handleOpenCamera = () => {
    setIsPhotoSourceModalOpen(false);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsCameraViewfinderOpen(true);
      setCameraFacingMode('environment');
      startCameraStream('environment');
    } else {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const handleOpenDeviceFiles = () => {
    setIsPhotoSourceModalOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAddSamplePhoto = () => {
    setIsPhotoSourceModalOpen(false);
    const samplePhotos = [
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80', // Road pavement damage / pothole
      'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=800&q=80', // Building wall crack
      'https://images.unsplash.com/photo-1578991624414-276ef23a534f?auto=format&fit=crop&w=800&q=80', // Asphalt cracks
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80', // Sidewalk damage
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80', // Structural damage
      'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80', // Illegal dumping
    ];
    const newPic = samplePhotos[photos.length % samplePhotos.length];
    setPhotos((prev) => [...prev, newPic]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      alert(t.alertRequirePhoto);
      return;
    }
    if (!description.trim()) {
      alert(t.alertEnterDesc);
      return;
    }

    const caseId = `REP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowStr = new Date().toLocaleString();

    onSubmitReport({
      title: `${district} - ${selectedCategory} Report`,
      description,
      category: selectedCategory,
      cityName: selectedCityName,
      districtName: district,
      addressText: `Near ${selectedCityName} ${district}`,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      imageUrl: photos[0],
      photoPins: photoPins.length > 0 ? photoPins : undefined,
      priority: selectedCategory === 'Disaster' ? 'High' : 'Medium',
      assignedUnit: 'Processing by Agency',
    });

    setSubmittedCaseId(caseId);
    setSubmittedTime(nowStr);
    setIsSubmittedSuccess(true);
  };

  const handleZoomIn = () => {
    if (miniMapRef.current) miniMapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (miniMapRef.current) miniMapRef.current.zoomOut();
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
            setCurrentCoords({ lat: latitude, lng: longitude });
            if (miniMapRef.current) {
              miniMapRef.current.flyTo([latitude, longitude], 16, { duration: 0.8 });
              placePinOnMap(miniMapRef.current, latitude, longitude);
            }
          }
        },
        (err) => {
          console.warn('Geolocation failed:', err);
        }
      );
    }
  };

  const handleNextStep = () => {
    if (!hasPlacedPin && miniMapRef.current) {
      const center = miniMapRef.current.getCenter();
      placePinOnMap(miniMapRef.current, center.lat, center.lng);
    }
    setStep(2);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Step Progress Bar */}
      <header className="absolute top-0 left-0 w-full z-40 flex items-center justify-between px-4 h-16 bg-white/90 backdrop-blur-md border-b border-[#c3c6d6]/60 shadow-xs">
        <button
          onClick={onClose}
          aria-label="Go back"
          className="w-9 h-9 flex items-center justify-center bg-[#d8e2ff]/80 rounded-full text-[#051a3e] hover:bg-[#d8e2ff] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Step Indicator Pills or Success Banner */}
        {isSubmittedSuccess ? (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-xl font-bold">check_circle</span>
            <span className="text-sm font-extrabold text-emerald-950">{t.successTitle}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                step === 1
                  ? 'bg-[#003d9b] text-white shadow-xs'
                  : 'bg-[#e9edff] text-[#003d9b]'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">1</span>
              <span>{t.step1Title.split('：')[1] || t.step1Title}</span>
            </div>

            <span className="text-[#c3c6d6] text-xs font-bold">→</span>

            <div
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                step === 2
                  ? 'bg-[#003d9b] text-white shadow-xs'
                  : 'bg-[#e9edff] text-[#737685]'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">2</span>
              <span>{t.step2Title.split('：')[1] || t.step2Title}</span>
            </div>
          </div>
        )}

        <div className="w-9 h-9" /> {/* Spacer */}
      </header>

      {/* Main Container Area */}
      <div className="w-full h-full pt-16 flex flex-col relative bg-[#faf9ff] overflow-y-auto">
        {isSubmittedSuccess ? (
          /* SUCCESS CONFIRMATION STEP */
          <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg relative mb-4">
              <span className="material-symbols-outlined text-5xl material-symbols-fill">verified</span>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400 opacity-40 animate-ping" />
            </div>

            <h2 className="text-xl font-extrabold text-[#051a3e] mb-1.5">{t.successTitle}</h2>
            <p className="text-xs text-[#434654] max-w-sm mb-5 leading-relaxed">{t.successSubTitle}</p>

            {/* Case Details Card */}
            <div className="w-full max-w-md bg-white rounded-2xl border border-[#c3c6d6] p-4 shadow-sm mb-6 text-left space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#c3c6d6]/60">
                <span className="text-xs font-semibold text-[#434654] flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-[#0052cc]">confirmation_number</span>
                  {t.successCaseNo}
                </span>
                <span className="font-mono font-extrabold text-sm text-[#003d9b] bg-[#e9edff] px-3 py-1 rounded-lg border border-[#003d9b]/20 shadow-2xs">
                  {submittedCaseId}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737685] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  Report Location
                </span>
                <span className="font-bold text-[#051a3e]">{selectedCityName} {district}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737685] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">category</span>
                  Category
                </span>
                <span className="font-semibold text-[#0052cc] bg-[#e9edff] px-2.5 py-0.5 rounded-full border border-[#003d9b]/20">
                  {selectedCategory}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737685] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  Submission Time
                </span>
                <span className="text-[#051a3e] font-medium">{submittedTime}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed border-[#c3c6d6]/60">
                <span className="text-[#737685] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-amber-600">pending</span>
                  Status
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Received (Assigning Department)
                </span>
              </div>

              {photos.length > 0 && (
                <div className="flex items-center gap-3 pt-2.5 border-t border-[#c3c6d6]/60">
                  <img src={photos[0]} alt="Attachment preview" className="w-12 h-12 rounded-lg object-cover border border-[#c3c6d6]" />
                  <div className="text-xs">
                    <div className="font-bold text-[#051a3e]">Attached Photos ({photos.length}) Received</div>
                    <div className="text-[11px] text-[#737685]">Includes field damage pin annotations</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="w-full max-w-md flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsSubmittedSuccess(false);
                  setStep(1);
                  setDescription('');
                  setPhotos([]);
                  setPhotoPins([]);
                  setHasPlacedPin(false);
                }}
                className="w-full sm:flex-1 py-3 rounded-xl border border-[#003d9b] text-[#003d9b] font-semibold text-xs hover:bg-[#e9edff] transition-all cursor-pointer"
              >
                {t.successNewReportBtn}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 py-3 rounded-xl bg-[#0052cc] text-white font-bold text-xs hover:bg-[#003d9b] shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>{t.successCloseBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* STEP 1: SELECT REGION & MAP POSITION */}
        <div className={`w-full flex-1 flex flex-col relative ${step === 1 ? 'flex' : 'hidden'}`}>
          {/* Region Selectors Bar */}
          <div className="p-3.5 bg-white border-b border-[#c3c6d6]/60 z-30 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#051a3e]">
              <span className="material-symbols-outlined text-base text-[#003d9b]">map</span>
              <span>{t.step1Title}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* City Dropdown */}
              <select
                value={selectedCityName}
                onChange={(e) => handleCityChange(e.target.value)}
                className="text-xs bg-[#e9edff] border border-[#003d9b]/40 font-bold text-[#003d9b] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:bg-[#d8e2ff]"
              >
                {TAIWAN_CITIES_AND_DISTRICTS.map((c) => (
                  <option key={c.nameZh} value={c.nameZh}>
                    {c.nameZh}
                  </option>
                ))}
              </select>

              {/* District Dropdown */}
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="text-xs bg-[#003d9b] border border-[#003d9b] font-bold text-white rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:bg-[#0052cc]"
              >
                {currentCityObj.districts.map((d) => (
                  <option key={d.nameZh} value={d.nameZh}>
                    {d.nameZh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Map Area */}
          <div className={`relative flex-1 w-full bg-[#d8e2ff] ${!hasPlacedPin ? 'cursor-crosshair' : ''}`}>
            <div ref={miniMapContainerRef} className="w-full h-full" />

            {/* Top Guidance Instruction Banner */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none max-w-[92vw]">
              <div className={`px-4 py-2 rounded-full shadow-lg text-xs font-extrabold border transition-all flex items-center gap-2 ${
                hasPlacedPin
                  ? 'bg-emerald-50/95 text-emerald-900 border-emerald-400'
                  : 'bg-amber-50/95 text-amber-900 border-amber-400 animate-bounce'
              }`}>
                <span className={`material-symbols-outlined text-base ${hasPlacedPin ? 'text-emerald-600' : 'text-amber-600 animate-spin'}`}>
                  {hasPlacedPin ? 'check_circle' : 'ads_click'}
                </span>
                <span>
                  {hasPlacedPin
                    ? (currentLang === 'zh'
                        ? '✅ 已成功標記通報位置 📍 (可拖曳調整)'
                        : '✅ Location Pin Placed! (Drag pin to adjust)')
                    : (currentLang === 'zh'
                        ? '📍 請點擊地圖任意位置以放置通報 Pin 針！'
                        : '📍 Click anywhere on the map to set location pin!')}
                </span>
              </div>
            </div>

            {/* Center Reticle & Direct "Drop Pin Here" Overlay (Only active when pin is NOT placed yet) */}
            {!hasPlacedPin && (
              <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                {/* Crosshair Target Ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#0052cc] bg-[#0052cc]/15 animate-[pulseReticle_1.8s_infinite] flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#0052cc] shadow-lg shadow-[#0052cc]/60" />
                  </div>

                  {/* Floating Instruction Tooltip */}
                  <div className="absolute -top-11 bg-[#051a3e] text-white px-3 py-1.5 rounded-xl shadow-2xl text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1.5 border border-white/30 animate-pulse">
                    <span className="material-symbols-outlined text-amber-300 text-sm">touch_app</span>
                    <span>
                      {currentLang === 'zh'
                        ? '點擊地圖任意位置以設定地點'
                        : 'Click anywhere on map to set pin'}
                    </span>
                  </div>
                </div>

                {/* Direct Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (miniMapRef.current) {
                      const center = miniMapRef.current.getCenter();
                      placePinOnMap(miniMapRef.current, center.lat, center.lng);
                    }
                  }}
                  className="pointer-events-auto mt-6 bg-[#0052cc] hover:bg-[#003d9b] active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-full shadow-2xl transition-all border-2 border-white flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">pin_drop</span>
                  <span>
                    {currentLang === 'zh'
                      ? '🎯 在目前地圖中心放置 Pin 針'
                      : '🎯 Drop Pin at Map Center'}
                  </span>
                </button>
              </div>
            )}

            {/* Current Coordinates Bar Overlay at Bottom of Map */}
            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#c3c6d6] shadow-sm text-[11px] font-semibold text-[#051a3e] z-20 flex items-center gap-1.5">
              <span className={`material-symbols-outlined text-sm ${hasPlacedPin ? 'text-[#003d9b] material-symbols-fill' : 'text-amber-600'}`}>
                {hasPlacedPin ? 'push_pin' : 'touch_app'}
              </span>
              <span>
                {hasPlacedPin
                  ? `Near ${selectedCityName} ${district} (${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)})`
                  : 'Click map to place pin'}
              </span>
            </div>

            {/* Map Control Buttons */}
            <button
              onClick={handleLocateMe}
              className="absolute bottom-3 right-3 w-10 h-10 bg-white text-[#003d9b] rounded-full shadow-md flex items-center justify-center hover:bg-[#d8e2ff] transition-colors z-20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">my_location</span>
            </button>

            <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
              <button
                onClick={handleZoomIn}
                className="w-9 h-9 bg-white text-[#051a3e] rounded-full shadow-md flex items-center justify-center hover:bg-[#d8e2ff] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
              </button>
              <button
                onClick={handleZoomOut}
                className="w-9 h-9 bg-white text-[#051a3e] rounded-full shadow-md flex items-center justify-center hover:bg-[#d8e2ff] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">remove</span>
              </button>
            </div>
          </div>

          {/* Step 1 Bottom Action Bar */}
          <div className="p-4 bg-white border-t border-[#c3c6d6]/60 flex gap-3 z-30">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#c3c6d6] text-[#434654] font-semibold text-sm hover:bg-[#e9edff]/50 transition-colors text-center cursor-pointer"
            >
              {t.modalCancel}
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-[2] py-3 rounded-xl bg-[#0052cc] text-white font-semibold text-sm shadow-md hover:bg-[#003d9b] transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{t.nextStepBtn}</span>
            </button>
          </div>
        </div>

        {/* STEP 2: DESCRIBE WHAT HAPPENED */}
        <div className={`w-full flex-1 flex flex-col overflow-y-auto p-5 ${step === 2 ? 'flex' : 'hidden'}`}>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
            {/* Selected Location Summary Card */}
            <div className="mb-5 p-3.5 bg-[#e9edff] rounded-2xl border border-[#003d9b]/30 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-[#003d9b] material-symbols-fill">
                  location_on
                </span>
                <div>
                  <div className="text-[10px] font-bold text-[#737685] uppercase">Location</div>
                  <div className="text-sm font-extrabold text-[#051a3e]">
                    {selectedCityName} {district}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-[#003d9b] bg-white px-3 py-1.5 rounded-xl border border-[#003d9b]/30 hover:bg-[#d8e2ff] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit_location</span>
                <span>Reselect</span>
              </button>
            </div>

            <h2 className="text-lg font-bold text-[#051a3e] mb-3">
              {t.step2Title}
            </h2>

            {/* Category Chips Scroll Container */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-[#434654] mb-2">
                {t.categoriesTitle}
              </label>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'border border-[#003d9b] bg-[#0052cc] text-[#ffffff] shadow-sm'
                        : 'border border-[#c3c6d6] bg-white text-[#434654] hover:bg-[#d8e2ff]/50'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg ${
                        selectedCategory === cat.id ? 'material-symbols-fill' : ''
                      }`}
                    >
                      {cat.icon}
                    </span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hidden file inputs for camera capture and device gallery upload */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Photo Upload & Pin Annotation Area */}
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <label className="block text-xs font-semibold text-[#434654]">
                  {t.modalPhotoLabel}
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    className="text-[11px] font-bold text-[#003d9b] bg-[#e9edff] hover:bg-[#d8e2ff] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title={t.photoCameraDesc}
                  >
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                    <span>{t.photoDirectCamera}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenDeviceFiles}
                    className="text-[11px] font-bold text-[#003d9b] bg-[#e9edff] hover:bg-[#d8e2ff] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title={t.photoDeviceDesc}
                  >
                    <span className="material-symbols-outlined text-sm">photo_library</span>
                    <span>{t.photoFromDevice}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 items-center overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setIsPhotoSourceModalOpen(true)}
                  className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-[#c3c6d6] rounded-xl text-[#737685] hover:bg-[#d8e2ff]/50 hover:text-[#003d9b] hover:border-[#003d9b] transition-all bg-white cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-xl mb-0.5">
                    add_a_photo
                  </span>
                  <span className="text-[9px] font-semibold">{t.photoAddBtn}</span>
                </button>

                {photos.map((pic, idx) => (
                  <div
                    key={idx}
                    className="w-16 h-16 rounded-xl bg-slate-950 relative overflow-hidden shadow-xs border-2 border-[#003d9b] shrink-0 flex items-center justify-center p-0.5"
                  >
                    <img src={pic} alt="Uploaded damage" className="w-full h-full object-contain rounded-lg" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#ba1a1a] text-white rounded-full flex items-center justify-center shadow-md cursor-pointer z-10"
                    >
                      <span className="material-symbols-outlined text-[10px]">close</span>
                    </button>
                  </div>
                ))}
              </div>

              {photos.length === 0 && (
                <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200/90">
                  <span className="material-symbols-outlined text-sm text-amber-600">priority_high</span>
                  <span>{t.alertRequirePhoto}</span>
                </p>
              )}

              {/* Photo Pin Annotator Component */}
              {photos.length > 0 && (
                <div className="mt-1 pt-3 border-t border-[#c3c6d6]/60">
                  <PhotoPinAnnotator
                    imageUrl={photos[0]}
                    pins={photoPins}
                    onChangePins={setPhotoPins}
                    readOnly={false}
                    currentLang={currentLang}
                  />
                </div>
              )}
            </div>

            {/* Detailed Description */}
            <div className="mb-6">
              <label htmlFor="issue-description" className="block text-xs font-semibold text-[#434654] mb-1.5">
                {t.modalDetailLabel}
              </label>
              <textarea
                id="issue-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.modalDescPlaceholder}
                className="w-full p-3.5 bg-white border border-[#c3c6d6] rounded-xl focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none transition-all resize-none text-sm text-[#051a3e] shadow-2xs placeholder-[#737685]"
              />
            </div>

            {/* Sticky Bottom Actions for Step 2 */}
            <div className="pt-3 border-t border-[#c3c6d6]/60 flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-[#003d9b] text-[#003d9b] font-semibold text-sm hover:bg-[#d8e2ff]/50 transition-colors text-center cursor-pointer flex items-center justify-center gap-1"
              >
                <span>{t.prevStepBtn}</span>
              </button>
              <button
                type="submit"
                className="flex-[2] py-3 rounded-xl bg-[#0052cc] text-white font-semibold text-sm shadow-md hover:bg-[#003d9b] transition-all text-center cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                <span>{t.modalSubmit}</span>
              </button>
            </div>
          </form>
        </div>
      </>
    )}
  </div>

      {/* Photo Source Selector Sheet Modal */}
      {isPhotoSourceModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[#c3c6d6]/60 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d6]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc]">add_a_photo</span>
                <h3 className="font-extrabold text-base text-[#051a3e]">{t.photoSourceTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoSourceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-[#434654] flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleOpenCamera}
                className="w-full p-3.5 rounded-2xl border border-[#003d9b]/30 bg-[#e9edff] hover:bg-[#d8e2ff] transition-all flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#0052cc] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <span className="material-symbols-outlined text-xl">photo_camera</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#051a3e]">{t.photoCameraTitle}</div>
                  <div className="text-[11px] text-[#434654]">{t.photoCameraDesc}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleOpenDeviceFiles}
                className="w-full p-3.5 rounded-2xl border border-[#c3c6d6] bg-white hover:bg-[#e9edff]/50 transition-all flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#d8e2ff] text-[#003d9b] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-xl">photo_library</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#051a3e]">{t.photoDeviceTitle}</div>
                  <div className="text-[11px] text-[#434654]">{t.photoDeviceDesc}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleAddSamplePhoto}
                className="w-full p-3.5 rounded-2xl border border-dashed border-[#c3c6d6] bg-gray-50 hover:bg-gray-100 transition-all flex items-center gap-3 text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-200 text-[#434654] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-xl">wallpaper</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#051a3e]">{t.photoSampleTitle}</div>
                  <div className="text-[11px] text-[#434654]">{t.photoSampleDesc}</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPhotoSourceModalOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl border border-[#c3c6d6] text-[#434654] font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer text-center"
            >
              {t.photoSourceClose}
            </button>
          </div>
        </div>
      )}

      {/* Real Live WebRTC Camera Viewfinder Modal */}
      {isCameraViewfinderOpen && (
        <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex flex-col justify-between items-center p-4 animate-in fade-in duration-200">
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Header */}
          <div className="w-full max-w-lg flex items-center justify-between text-white py-2 px-1 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-bold text-sm text-white/90">{t.cameraViewfinderTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center"
                title={t.cameraSwitchBtn}
              >
                <span className="material-symbols-outlined text-xl">cameraswitch</span>
              </button>
              <button
                type="button"
                onClick={closeCameraViewfinder}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          {/* Viewfinder Main Viewport */}
          <div className="relative w-full max-w-lg flex-1 min-h-[320px] my-2 bg-black rounded-3xl overflow-hidden border border-white/15 flex items-center justify-center shadow-2xl">
            {cameraError ? (
              <div className="p-6 text-center text-white max-w-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">videocam_off</span>
                </div>
                <p className="text-xs text-gray-300 font-medium">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => {
                    closeCameraViewfinder();
                    if (cameraInputRef.current) cameraInputRef.current.click();
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {t.photoFromDevice}
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />

                {/* Viewfinder Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-3xl">
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/10" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/10" />
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/10" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/10" />

                  {/* Corner reticles */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/60 rounded-br-lg" />
                </div>
              </>
            )}
          </div>

          {/* Viewfinder Controls Bar */}
          <div className="w-full max-w-lg py-4 flex items-center justify-around z-10">
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title={t.cameraSwitchBtn}
            >
              <span className="material-symbols-outlined text-2xl">flip_camera_ios</span>
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapturePhoto}
              disabled={!!cameraError}
              className="w-20 h-20 rounded-full border-4 border-white bg-transparent p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg disabled:opacity-50"
              title={t.cameraShutterBtn}
            >
              <div className="w-full h-full rounded-full bg-white active:bg-red-500 transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-gray-800">photo_camera</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                closeCameraViewfinder();
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title={t.photoFromDevice}
            >
              <span className="material-symbols-outlined text-2xl">photo_library</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
