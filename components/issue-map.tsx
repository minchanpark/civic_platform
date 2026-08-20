"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_STATUS_COLORS, STATUS_COLORS, TAOYUAN_BOUNDS, issueCategory, type IssueCategory, type IssueStatus } from "@/lib/issues";

export type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  status: IssueStatus;
  category: IssueCategory;
  label: string;
  urgent?: boolean;
  problemSpotCount?: number;
};

export type MapViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type Props = {
  pins?: MapPin[];
  draft?: { latitude: number; longitude: number } | null;
  selectedId?: string | null;
  center?: { latitude: number; longitude: number };
  zoom?: number;
  onMapClick?: (position: { latitude: number; longitude: number }) => void;
  onCurrentLocation?: (position: { latitude: number; longitude: number }) => void;
  onPinSelect?: (id: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  ariaLabel: string;
  palette?: "citizen" | "admin";
  currentLocation?: {
    button: string;
    locating: string;
    unavailable: string;
    outside: string;
  };
  locateOnLoad?: boolean;
};

function drawMarkers(
  leaflet: typeof import("leaflet"),
  layer: import("leaflet").LayerGroup,
  state: Pick<Props, "pins" | "draft" | "selectedId">,
  onPinSelect?: (id: string) => void,
  palette: Props["palette"] = "citizen",
) {
  layer.clearLayers();
  const pins = state.pins ?? [];
  pins.forEach((pin) => {
    const visual = document.createElement("span");
    visual.className = `map-category-pin${pin.id === state.selectedId ? " selected" : ""}${pin.urgent ? " urgent" : ""}${pin.problemSpotCount ? " problem-spot" : ""}`;
    visual.dataset.pinLatitude = String(pin.latitude);
    visual.dataset.pinLongitude = String(pin.longitude);
    const glyph = document.createElement("span");
    glyph.textContent = issueCategory(pin.category)?.icon ?? "📍";
    visual.append(glyph);
    if (pin.problemSpotCount) {
      const count = document.createElement("span");
      count.className = "map-problem-count";
      count.textContent = String(pin.problemSpotCount);
      count.setAttribute("aria-hidden", "true");
      visual.append(count);
    }
    visual.style.backgroundColor = (palette === "admin" ? ADMIN_STATUS_COLORS : STATUS_COLORS)[pin.status];
    const marker = leaflet.marker([pin.latitude, pin.longitude], {
      alt: pin.label,
      title: pin.label,
      zIndexOffset: (pin.problemSpotCount ? 1000 : 0) + (pin.urgent ? 500 : 0),
      icon: leaflet.divIcon({
        className: "map-category-marker",
        html: visual,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    });
    const label = document.createElement("span");
    label.textContent = pin.label;
    marker.bindTooltip(label);
    marker.on("click", () => onPinSelect?.(pin.id));
    marker.addTo(layer);
  });
  if (state.draft) {
    const visual = document.createElement("span");
    visual.className = "map-draft-pin";
    leaflet.marker([state.draft.latitude, state.draft.longitude], {
      alt: "PIN",
      title: "PIN",
      icon: leaflet.divIcon({
        className: "map-category-marker map-draft-marker",
        html: visual,
        iconSize: [46, 46],
        iconAnchor: [23, 46],
      }),
    }).bindTooltip("PIN").addTo(layer);
  }
}

export function IssueMap({ pins = [], draft, selectedId, center, zoom, onMapClick, onCurrentLocation, onPinSelect, onViewportChange, ariaLabel, palette = "citizen", currentLocation, locateOnLoad = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layers = useRef<import("leaflet").LayerGroup | null>(null);
  const currentLocationLayer = useRef<import("leaflet").Layer | null>(null);
  const clickHandler = useRef(onMapClick);
  const currentLocationHandler = useRef(onCurrentLocation);
  const selectHandler = useRef(onPinSelect);
  const viewportHandler = useRef(onViewportChange);
  const markerState = useRef({ pins, draft, selectedId, palette });
  const initialView = useRef({ center, zoom });
  const didLocateOnLoad = useRef(false);
  const centerLatitude = center?.latitude;
  const centerLongitude = center?.longitude;
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    clickHandler.current = onMapClick;
    currentLocationHandler.current = onCurrentLocation;
    selectHandler.current = onPinSelect;
    viewportHandler.current = onViewportChange;
    markerState.current = { pins, draft, selectedId, palette };
  }, [draft, onCurrentLocation, onMapClick, onPinSelect, onViewportChange, palette, pins, selectedId]);

  useEffect(() => {
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !container.current || map.current) return;
      const nextMap = leaflet.map(container.current, {
        center: initialView.current.center
          ? [initialView.current.center.latitude, initialView.current.center.longitude]
          : [24.94, 121.24],
        zoom: initialView.current.zoom ?? 10,
        minZoom: 10,
        maxZoom: 18,
        maxBounds: [[TAOYUAN_BOUNDS.south, TAOYUAN_BOUNDS.west], [TAOYUAN_BOUNDS.north, TAOYUAN_BOUNDS.east]],
      });
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(nextMap);
      nextMap.on("click", (event) => clickHandler.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
      const publishViewport = () => {
        const bounds = nextMap.getBounds();
        viewportHandler.current?.({
          south: bounds.getSouth(), west: bounds.getWest(),
          north: bounds.getNorth(), east: bounds.getEast(),
        });
      };
      nextMap.on("moveend", publishViewport);
      map.current = nextMap;
      const nextLayers = leaflet.layerGroup().addTo(nextMap);
      layers.current = nextLayers;
      drawMarkers(leaflet, nextLayers, markerState.current, selectHandler.current, markerState.current.palette);
      publishViewport();
      setMapReady(true);
    });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
      layers.current = null;
      currentLocationLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (centerLatitude !== undefined && centerLongitude !== undefined && map.current) {
      map.current.setView([centerLatitude, centerLongitude], zoom ?? map.current.getZoom(), { animate: false });
    }
  }, [centerLatitude, centerLongitude, zoom]);

  useEffect(() => {
    const currentLayers = layers.current;
    const currentMap = map.current;
    if (!currentMap || !currentLayers) return;
    const redraw = async () => {
      const leaflet = await import("leaflet");
      if (layers.current === currentLayers) {
        drawMarkers(leaflet, currentLayers, { pins, draft, selectedId }, selectHandler.current, palette);
      }
    };
    void redraw();
  }, [draft, palette, pins, selectedId]);

  const locate = useCallback(() => {
    if (!navigator.geolocation || !map.current || !currentLocation) {
      setLocationMessage(currentLocation?.unavailable ?? "");
      return;
    }
    setLocating(true);
    setLocationMessage(currentLocation.locating);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const activeMap = map.current;
      if (!activeMap) return;
      if (coords.latitude < TAOYUAN_BOUNDS.south || coords.latitude > TAOYUAN_BOUNDS.north
        || coords.longitude < TAOYUAN_BOUNDS.west || coords.longitude > TAOYUAN_BOUNDS.east) {
        setLocating(false);
        setLocationMessage(currentLocation.outside);
        return;
      }
      const leaflet = await import("leaflet");
      if (map.current !== activeMap) return;
      activeMap.setView([coords.latitude, coords.longitude], activeMap.getMaxZoom(), { animate: false });
      currentLocationLayer.current?.remove();
      currentLocationLayer.current = leaflet.circleMarker([coords.latitude, coords.longitude], {
        className: "map-current-location",
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#175cd3",
        fillOpacity: 1,
      }).bindTooltip(currentLocation.button).addTo(activeMap);
      (currentLocationHandler.current ?? clickHandler.current)?.({ latitude: coords.latitude, longitude: coords.longitude });
      setLocating(false);
      setLocationMessage(currentLocation.button);
    }, () => {
      setLocating(false);
      setLocationMessage(currentLocation.unavailable);
    }, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 });
  }, [currentLocation]);

  useEffect(() => {
    if (!locateOnLoad || !mapReady || didLocateOnLoad.current) return;
    didLocateOnLoad.current = true;
    locate();
  }, [locate, locateOnLoad, mapReady]);

  return (
    <div className="issue-map-frame">
      <div
        ref={container}
        className="issue-map"
        role="region"
        aria-label={ariaLabel}
        data-center-latitude={centerLatitude}
        data-center-longitude={centerLongitude}
        data-zoom={zoom}
      />
      {currentLocation && (
        <button
          className="map-location-button"
          type="button"
          disabled={locating}
          aria-label={locating ? currentLocation.locating : currentLocation.button}
          title={currentLocation.button}
          onClick={locate}
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </button>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">{locationMessage}</span>
    </div>
  );
}
