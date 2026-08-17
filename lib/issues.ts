export const REPORT_CATEGORIES = [
  { id: "public_utility", icon: "💧", tone: "sky", department: "public_facilities" },
  { id: "road_obstruction", icon: "🚧", tone: "green", department: "road_maintenance" },
  { id: "streetlight_failure", icon: "💡", tone: "orange", department: "public_facilities" },
  { id: "abandoned_vehicle", icon: "🚙", tone: "red", department: "environmental_services" },
  { id: "road_sidewalk", icon: "🛣️", tone: "purple", department: "road_maintenance" },
  { id: "bus_issue", icon: "🚌", tone: "pink", department: "traffic_safety" },
  { id: "traffic_safety", icon: "🚦", tone: "teal", department: "traffic_safety" },
  { id: "other", icon: "•••", tone: "blue", department: "general_services" },
] as const;

export const ISSUE_CATEGORIES = [
  ...REPORT_CATEGORIES,
  { id: "waste_pollution", icon: "🗑️", department: "environmental_services" },
  { id: "park_facility", icon: "🌳", department: "public_facilities" },
] as const;

export type IssueCategory = typeof ISSUE_CATEGORIES[number]["id"];
export type ReportCategory = typeof REPORT_CATEGORIES[number]["id"];
export type IssueStatus = "received" | "viewed" | "in_progress" | "on_hold" | "completed";
export type IssueVisibility = "private" | "pending_publication" | "public";
export type FieldStatus = "active" | "verification_pending" | "resolved_confirmed" | "recurrence_confirmed";

export const CITIZEN_GENDERS = ["male", "female", "other"] as const;
export const CITIZEN_AGE_GROUPS = ["20_or_younger", "21_30", "31_40", "41_50", "51_60", "61_or_older"] as const;
export type CitizenGender = typeof CITIZEN_GENDERS[number];
export type CitizenAgeGroup = typeof CITIZEN_AGE_GROUPS[number];
export const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCellPhone(input: string) {
  const compact = input.trim().replace(/[()\s-]/g, "");
  if (/^09\d{8}$/.test(compact)) return `+886${compact.slice(1)}`;
  if (/^8869\d{8}$/.test(compact)) return `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

export const TAOYUAN_BOUNDS = {
  south: 24.589,
  west: 120.966,
  north: 25.124,
  east: 121.477,
} as const;

export const ISSUE_STATUSES: readonly IssueStatus[] = ["received", "viewed", "in_progress", "on_hold", "completed"];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  received: "접수",
  viewed: "열람",
  in_progress: "처리 중",
  on_hold: "보류",
  completed: "완료",
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  received: "#b54708",
  viewed: "#175cd3",
  in_progress: "#25798a",
  on_hold: "#b42318",
  completed: "#087a4b",
};

export const ADMIN_STATUS_COLORS: Record<IssueStatus, string> = {
  received: "#9e6a00",
  viewed: "#0b78cb",
  in_progress: "#256ef4",
  on_hold: "#d63d4a",
  completed: "#228738",
};

export const FIELD_STATUS_LABELS: Record<FieldStatus, string> = {
  active: "현장 문제 있음",
  verification_pending: "현장 확인 필요",
  resolved_confirmed: "해결 확인",
  recurrence_confirmed: "재발 확인",
};

export const RISK_LEVEL_LABELS: Record<number, string> = {
  1: "1 · 낮음",
  2: "2 · 보통",
  3: "3 · 주의",
  4: "4 · 높음",
  5: "5 · 긴급",
};

export const AI_REASON_LABELS: Record<string, string> = {
  immediate_life_risk: "즉각적인 인명 위험 가능성",
  accident_risk: "사고 위험",
  health_risk: "건강 위험",
  spreading_pollution: "확산되는 오염",
  pedestrian_obstruction: "보행 방해",
  repeated_contamination: "반복 오염",
  service_disruption: "시설 이용 장애",
  cosmetic_only: "경미한 미관 문제",
  possible_personal_data: "개인정보 가능성",
  advertising_irrelevant: "광고·무관 내용 가능성",
  repetition: "반복 내용 가능성",
  harmful_content: "유해 내용 가능성",
};

export const DISTRICTS = [
  { id: "taoyuan", label: "桃園區", latitude: 24.99735, longitude: 121.29602 },
  { id: "zhongli", label: "中壢區", latitude: 24.97669, longitude: 121.20916 },
  { id: "pingzhen", label: "平鎮區", latitude: 24.92211, longitude: 121.21758 },
  { id: "bade", label: "八德區", latitude: 24.94798, longitude: 121.29172 },
  { id: "yangmei", label: "楊梅區", latitude: 24.91564, longitude: 121.12332 },
  { id: "daxi", label: "大溪區", latitude: 24.87098, longitude: 121.29991 },
  { id: "luzhu", label: "蘆竹區", latitude: 25.05533, longitude: 121.29371 },
  { id: "dayuan", label: "大園區", latitude: 25.06201, longitude: 121.21264 },
  { id: "guishan", label: "龜山區", latitude: 25.02144, longitude: 121.35392 },
  { id: "longtan", label: "龍潭區", latitude: 24.84663, longitude: 121.20882 },
  { id: "xinwu", label: "新屋區", latitude: 24.97633, longitude: 121.07385 },
  { id: "guanyin", label: "觀音區", latitude: 25.02393, longitude: 121.09404 },
  { id: "fuxing", label: "復興區", latitude: 24.71617, longitude: 121.36159 },
] as const;

export type DistrictId = typeof DISTRICTS[number]["id"];

export const DEPARTMENTS = [
  { id: "road_maintenance", label: "도로 유지보수" },
  { id: "public_facilities", label: "공공시설 관리" },
  { id: "traffic_safety", label: "교통안전" },
  { id: "environmental_services", label: "환경관리" },
  { id: "general_services", label: "일반 민원" },
] as const;

export type Department = typeof DEPARTMENTS[number]["id"];

export interface Issue {
  id: string;
  ticketNumber: string;
  reporterId: string;
  submissionKey: string;
  category: IssueCategory;
  districtId: DistrictId;
  latitude: number;
  longitude: number;
  address: string | null;
  title: string;
  body: string;
  status: IssueStatus;
  visibility: IssueVisibility;
  assignedDepartment: Department | null;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueEvent {
  id: string;
  issueId: string;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus;
  reason: string;
  holdReason: string | null;
  nextCheckAt: string | null;
  finalAnswer: string | null;
  createdAt: string;
}

export type IssueRow = {
  id: string;
  ticket_number: string;
  reporter_id: string;
  submission_key: string;
  category: IssueCategory;
  district_id: DistrictId;
  latitude: number;
  longitude: number;
  address: string | null;
  title: string;
  body: string;
  status: IssueStatus;
  visibility: IssueVisibility;
  assigned_department: Department | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};

export type IssueEventRow = {
  id: string;
  issue_id: string;
  from_status: IssueStatus | null;
  to_status: IssueStatus;
  reason: string;
  hold_reason: string | null;
  next_check_at: string | null;
  final_answer: string | null;
  created_at: string;
};

export const issueFromRow = (row: IssueRow): Issue => ({
  id: row.id,
  ticketNumber: row.ticket_number,
  reporterId: row.reporter_id,
  submissionKey: row.submission_key,
  category: row.category,
  districtId: row.district_id,
  latitude: row.latitude,
  longitude: row.longitude,
  address: row.address,
  title: row.title,
  body: row.body,
  status: row.status,
  visibility: row.visibility,
  assignedDepartment: row.assigned_department,
  statusChangedAt: row.status_changed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const eventFromRow = (row: IssueEventRow): IssueEvent => ({
  id: row.id,
  issueId: row.issue_id,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  reason: row.reason,
  holdReason: row.hold_reason,
  nextCheckAt: row.next_check_at,
  finalAnswer: row.final_answer,
  createdAt: row.created_at,
});

export type IssueSubmissionInput = {
  submissionKey: string;
  category: string;
  districtId: string;
  latitude: number;
  longitude: number;
  title: string;
  body: string;
};

export type CitizenContactInput = {
  realName: string;
  gender: string;
  ageGroup: string;
  cellPhone: string;
  lineId: string;
  contactEmail: string;
};

export class IssueInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateIssueSubmission(input: IssueSubmissionInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!UUID.test(input.submissionKey)) throw new IssueInputError("제출 키가 올바르지 않습니다.");
  if (!ISSUE_CATEGORIES.some((category) => category.id === input.category)) throw new IssueInputError("카테고리를 선택해 주세요.");
  if (!DISTRICTS.some((district) => district.id === input.districtId)) throw new IssueInputError("지원하지 않는 행정구입니다.");
  if (!Number.isFinite(input.latitude) || input.latitude < TAOYUAN_BOUNDS.south || input.latitude > TAOYUAN_BOUNDS.north
    || !Number.isFinite(input.longitude) || input.longitude < TAOYUAN_BOUNDS.west || input.longitude > TAOYUAN_BOUNDS.east) {
    throw new IssueInputError("타오위안 지도 안에 PIN을 놓아 주세요.");
  }
  if ([...title].length < 5 || [...title].length > 80) throw new IssueInputError("제목은 5~80자로 입력해 주세요.");
  if ([...body].length < 10 || [...body].length > 2000) throw new IssueInputError("내용은 10~2,000자로 입력해 주세요.");
  return { ...input, category: input.category as IssueCategory, districtId: input.districtId as DistrictId, title, body };
}

export function validateCitizenContact(input: CitizenContactInput) {
  const realName = input.realName.trim();
  const cellPhone = normalizeCellPhone(input.cellPhone);
  const lineId = input.lineId.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if ([...realName].length < 1 || [...realName].length > 100) throw new IssueInputError("실명을 입력해 주세요.");
  if (!CITIZEN_GENDERS.includes(input.gender as CitizenGender)) throw new IssueInputError("성별을 선택해 주세요.");
  if (!CITIZEN_AGE_GROUPS.includes(input.ageGroup as CitizenAgeGroup)) throw new IssueInputError("연령대를 선택해 주세요.");
  if (!cellPhone) throw new IssueInputError("휴대전화 번호를 확인해 주세요.");
  if ([...lineId].length > 50) throw new IssueInputError("LINE ID는 50자 이하여야 합니다.");
  if (contactEmail && ([...contactEmail].length > 320 || !CONTACT_EMAIL_PATTERN.test(contactEmail))) {
    throw new IssueInputError("연락용 이메일 주소를 확인해 주세요.");
  }
  return {
    realName,
    gender: input.gender as CitizenGender,
    ageGroup: input.ageGroup as CitizenAgeGroup,
    cellPhone,
    lineId: lineId || null,
    contactEmail: contactEmail || null,
  };
}

export const issueCategory = (id: string) => ISSUE_CATEGORIES.find((category) => category.id === id);
export const district = (id: string) => DISTRICTS.find((item) => item.id === id);
