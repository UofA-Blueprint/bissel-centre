import type { CardStatus, CardDepartment } from "@/app/(app)/cards/types";

// POST body for /api/reports/export
export interface ExportRequest {
  startDate: string; // ISO date, e.g. "2024-01-01"
  endDate: string;   // ISO date, e.g. "2024-12-31"
  filters?: ExportFilters;
}

export interface ExportFilters {
  statuses?: CardStatus[];
  departments?: CardDepartment[];
}

// Single row in the exported spreadsheet
export interface ExportRow {
  "Allocation Date": string;
  Status: string;
  Department: string;
  "ARC Card Number": string;
  "Security Code": string;
  "Pass Recipient": string;
  "Issue Dates": string;
  Notes: string;
}

// --- User-centric report types (for the Reports page table) ---

export interface UserReportRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: "Active" | "Inactive" | "Unknown";
  banned: boolean;
  banReason: string;
  bannedAt: string | null;
  bannedBy: string;
  genderIdentity: string;
  dateOfBirth: string;
  address: string;
  postalCode: string;
  notes: string;
  createdAt: string;
  totalCardsIssued: number;
  cardHistory: CardHistoryEntry[];
  activityHistory: ActivityEntry[];
}

export interface CardHistoryEntry {
  cardNumber: string;
  department: string;
  status: string;
  allocationDate: string;
  securityCode: string;
  issueDates: string[];
}

export interface ActivityEntry {
  date: string;
  event: string;
  notes: string;
  modifiedBy: string;
  reason?: string;
}
