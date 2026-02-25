export type CardStatus =
  | "Active"
  | "Unattributed"
  | "Expired"
  | "Unloaded"
  | "Cancelled";

export type CardDepartment =
  | "Mental Health"
  | "Emergency"
  | "Case MCT"
  | "Newcomer Volunteer"
  | "Reception"
  | "Housing"
  | "FE/Comm Bridge"
  | "FASS"
  | "Child Care"
  | "Employment"
  | "Comp Eng Dept"
  | "Transit Dept"
  | "HELP Program";

export const STATUS_OPTIONS: CardStatus[] = [
  "Unloaded",
  "Active",
  "Unattributed",
  "Expired",
  "Cancelled",
];

export const DEPARTMENT_OPTIONS: CardDepartment[] = [
  "Mental Health",
  "Emergency",
  "Case MCT",
  "Newcomer Volunteer",
  "Reception",
  "Housing",
  "FE/Comm Bridge",
  "FASS",
  "Child Care",
  "Employment",
  "Comp Eng Dept",
  "Transit Dept",
  "HELP Program",
];

export const STATUS_STYLES: Record<CardStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Unattributed: "bg-yellow-100 text-yellow-800",
  Expired: "bg-red-100 text-red-700",
  Unloaded: "bg-gray-200 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
};

export const DEPARTMENT_STYLES: Record<CardDepartment, string> = {
  "Mental Health": "bg-green-100 text-green-800",
  Emergency: "bg-red-100 text-red-800",
  "Case MCT": "bg-sky-100 text-sky-800",
  "Newcomer Volunteer": "bg-purple-100 text-purple-800",
  Reception: "bg-pink-100 text-pink-800",
  Housing: "bg-orange-100 text-orange-800",
  "FE/Comm Bridge": "bg-teal-100 text-teal-800",
  FASS: "bg-fuchsia-100 text-fuchsia-800",
  "Child Care": "bg-yellow-100 text-yellow-800",
  Employment: "bg-blue-100 text-blue-700",
  "Comp Eng Dept": "bg-cyan-100 text-cyan-700",
  "Transit Dept": "bg-gray-100 text-gray-700",
  "HELP Program": "bg-gray-800 text-white",
};

export interface ArcCard {
  id: string;
  userId?: string;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  arcCardNumber: string; // final7Digits in UI
  securityCode: string;
  passRecipient: string;
  issueDates: string[];
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ArcCardInput {
  userId?: string;
  allocationDate: string;
  status: CardStatus;
  department: CardDepartment;
  arcCardNumber: string;
  securityCode: string;
  passRecipient?: string;
  issueDates?: string[];
  notes?: string;
}
