import React, { useState, useRef } from 'react';
import { PhotoPin, Language } from '../types';
import { TRANSLATIONS } from '../data/translations';

interface PhotoPinAnnotatorProps {
  imageUrl: string;
  pins: PhotoPin[];
  onChangePins?: (newPins: PhotoPin[]) => void;
  readOnly?: boolean;
  currentLang?: Language;
}

export const PhotoPinAnnotator: React.FC<PhotoPinAnnotatorProps> = ({
  imageUrl,
  pins,
  onChangePins,
  readOnly = false,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const imageRef = useRef<HTMLDivElement>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onChangePins || !imageRef.current) return;

    // Prevent duplicate pin when clicking existing pin or interactive UI
    const target = e.target as HTMLElement;
    if (target.closest('.photo-pin-element')) return;

    const rect = imageRef.current.getBoundingClientRect();
    const xRatio = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const yRatio = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));

    const newPin: PhotoPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      xRatio: Math.round(xRatio * 10) / 10,
      yRatio: Math.round(yRatio * 10) / 10,
      label: '',
    };

    const updated = [...pins, newPin];
    onChangePins(updated);
    setActivePinId(newPin.id);
  };

  const handleUpdateLabel = (id: string, newLabel: string) => {
    if (!onChangePins) return;
    onChangePins(
      pins.map((p) => (p.id === id ? { ...p, label: newLabel } : p))
    );
  };

  const handleRemovePin = (id: string) => {
    if (!onChangePins) return;
    onChangePins(pins.filter((p) => p.id !== id));
    if (activePinId === id) setActivePinId(null);
  };

  return (
    <div className="w-full flex flex-col gap-3.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-800 px-0.5">
        <div className="flex items-center gap-1.5 text-blue-900">
          <span className="material-symbols-outlined text-base text-blue-700">photo_camera</span>
          <span>Field Photo & Damage Annotations</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-blue-100 text-blue-900 border border-blue-200/80 px-2.5 py-0.5 rounded-full font-extrabold shadow-2xs">
            {pins.length} {pins.length === 1 ? 'Pin' : 'Pins'}
          </span>
        </div>
      </div>

      {!readOnly && (
        <div className="text-[11px] text-blue-950 bg-blue-50/90 p-2.5 rounded-xl border border-blue-200/80 flex items-start gap-2">
          <span className="material-symbols-outlined text-base text-blue-600 shrink-0 mt-0.5">touch_app</span>
          <span className="font-medium leading-relaxed">
            Click anywhere on the photo below to place a damage pin, then describe the issue in the list below.
          </span>
        </div>
      )}

      {/* Main Image Container */}
      <div
        ref={imageRef}
        onClick={handleImageClick}
        className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-300 shadow-sm select-none flex items-center justify-center p-1.5 min-h-[180px] max-h-[420px] ${
          !readOnly ? 'cursor-crosshair group hover:border-blue-500' : ''
        }`}
      >
        {/* Main Photo - Preserves Original Aspect Ratio */}
        <img
          src={imageUrl}
          alt="Field photo"
          className="w-full h-auto max-h-[380px] object-contain rounded-xl block mx-auto transition-all"
        />

        {!readOnly && (
          <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-full pointer-events-none border border-white/20 flex items-center gap-1.5 font-bold shadow-lg animate-pulse z-10">
            <span className="material-symbols-outlined text-sm text-amber-300">add_location_alt</span>
            <span>Click photo to place a pin</span>
          </div>
        )}

        {/* Pin Markers */}
        {pins.map((pin, index) => {
          const isActive = activePinId === pin.id;
          return (
            <div
              key={pin.id}
              style={{ left: `${pin.xRatio}%`, top: `${pin.yRatio}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 photo-pin-element z-20 group/pin"
            >
              {/* Pin Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePinId(isActive ? null : pin.id);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs shadow-lg transition-transform cursor-pointer ${
                  isActive ? 'scale-125 ring-2 ring-white ring-offset-2' : 'hover:scale-110'
                } ${
                  index % 3 === 0
                    ? 'bg-rose-600 text-white'
                    : index % 3 === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-700 text-white'
                }`}
              >
                {index + 1}
              </button>

              {/* Pin Label Tooltip */}
              {(pin.label || isActive || !readOnly) && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-8 whitespace-nowrap bg-black/90 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-lg shadow-md border border-white/20 transition-all pointer-events-none ${
                    isActive ? 'opacity-100 scale-100 z-30' : 'opacity-90 group-hover/pin:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-300">#{index + 1}</span>
                    <span>{pin.label || (readOnly ? '(No note)' : 'Enter note below')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pin Description List */}
      <div className="flex flex-col gap-2">
        {pins.length === 0 ? (
          <div className="py-3.5 px-3 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-xl text-amber-500 mb-0.5">
              pin_drop
            </span>
            <div className="text-xs font-bold text-slate-700">
              No damage pins placed yet
            </div>
            <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
              {!readOnly
                ? 'Click on the photo above to mark damage locations.'
                : 'No pin annotations provided for this photo.'}
            </p>
          </div>
        ) : (
          pins.map((pin, index) => (
            <div
              key={pin.id}
              className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                activePinId === pin.id
                  ? 'bg-blue-50/90 border-blue-600 shadow-2xs ring-1 ring-blue-500/30'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-2xs ${
                      index % 3 === 0
                        ? 'bg-rose-600'
                        : index % 3 === 1
                        ? 'bg-blue-600'
                        : 'bg-amber-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    Pin #{index + 1} Note
                  </span>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemovePin(pin.id)}
                    title="Remove Pin"
                    className="w-5 h-5 rounded-full hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                )}
              </div>

              {!readOnly ? (
                <input
                  type="text"
                  value={pin.label}
                  onChange={(e) => handleUpdateLabel(pin.id, e.target.value)}
                  onFocus={() => setActivePinId(pin.id)}
                  placeholder="Describe damage at this pin (e.g. 5cm deep pothole)..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none placeholder-slate-400"
                />
              ) : (
                <div className="text-xs text-slate-800 font-medium px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200/60 leading-normal">
                  {pin.label || '(No description provided)'}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
