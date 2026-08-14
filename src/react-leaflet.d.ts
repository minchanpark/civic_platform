declare module 'react-leaflet' {
  import * as React from 'react';
  import * as L from 'leaflet';

  export interface MapContainerProps {
    center: [number, number] | L.LatLngExpression;
    zoom: number;
    scrollWheelZoom?: boolean;
    className?: string;
    children?: React.ReactNode;
  }

  export interface TileLayerProps {
    attribution?: string;
    url: string;
  }

  export interface MarkerProps {
    position: [number, number] | L.LatLngExpression;
    children?: React.ReactNode;
    icon?: L.Icon | L.DivIcon;
  }

  export interface PopupProps {
    children?: React.ReactNode;
  }

  export interface CircleMarkerProps {
    center: [number, number] | L.LatLngExpression;
    radius?: number;
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    children?: React.ReactNode;
  }

  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Marker: React.FC<MarkerProps>;
  export const Popup: React.FC<PopupProps>;
  export const CircleMarker: React.FC<CircleMarkerProps>;
  export function useMap(): L.Map;
}
