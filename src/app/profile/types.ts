import type { User, ArcCard, HistoryEntry, BannedUser } from "@/app/services/userService";

export type ProfileTab = "overview" | "arcCard" | "history";

// Full profile data fetched for a recipient
export interface RecipientProfile {
  user: User;
  arcCards: ArcCard[];
  history: HistoryEntry[];
  bannedInfo: BannedUser | null;
}
