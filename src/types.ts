export type RegionGroup = 'Northern' | 'Central' | 'Southern' | 'Eastern' | 'Offshore';

export interface CityInfo {
  id: string;
  nameZh: string;
  nameEn: string;
  region: RegionGroup;
  lat: number;
  lng: number;
  zoom: number;
  reportCount?: number;
}

export type IssueCategory = 
  | 'Disaster' 
  | 'Facility issue' 
  | 'Road damage' 
  | 'Building damage' 
  | 'Environmental issue';

export type IssueStatus = 'Unresolved' | 'Proceeding' | 'Solved' | 'Denied';

export interface PhotoPin {
  id: string;
  xRatio: number; // percentage (0-100) from left
  yRatio: number; // percentage (0-100) from top
  label: string;  // text description for this pin
}

export type UrgencyLevel = 'High' | 'Medium' | 'Low';
export type ImportanceLevel = 'High' | 'Medium' | 'Low';

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  cityName: string; // e.g., "臺北市"
  districtName: string; // e.g., "中山區"
  addressText: string; // e.g., "中山區中山北路二段 102 號"
  lat: number;
  lng: number;
  createdAt: string;
  imageUrl?: string;
  photoPins?: PhotoPin[];
  priority: 'High' | 'Medium' | 'Low';
  urgency?: UrgencyLevel;       // Urgency (High, Medium, Low)
  importance?: ImportanceLevel; // Importance (High, Medium, Low)
  urgencyReason?: string;       // Reason for urgency/importance & AI evaluation notes
  assignedUnit?: string;
  upvotes?: number;
  fastTrackDispatchedAt?: string; // Timestamp of Express Fast-Track dispatch
}

export type PortalMode = 'citizen' | 'admin';

export type ActiveTab = 
  | 'citizen' 
  | 'map' 
  | 'regions' 
  | 'reports' 
  | 'admin-ai' 
  | 'admin-reports' 
  | 'admin-map';

export type Language = 'zh' | 'en' | 'ja' | 'ko';
