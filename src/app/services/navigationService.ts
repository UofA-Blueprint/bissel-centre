import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";

export interface NavigationTarget {
  path: string;
  reason: string;
}

export class NavigationService {
  private static instance: NavigationService;

  private constructor() {}

  public static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  /**
   * Gets the appropriate landing page for a staff user after login
   * This replaces the hardcoded "Sunny Rain" lookup with proper logic
   */
  public async getPostLoginDestination(): Promise<NavigationTarget> {
    try {
      // Try to find the most recently created or active user
      const usersRef = collection(db, "users");

      // First, try to get the most recently created user
      const recentUserQuery = query(
        usersRef,
        orderBy("createdAt", "desc"),
        limit(1)
      );

      let querySnapshot = await getDocs(recentUserQuery);

      if (!querySnapshot.empty) {
        const recentUser = querySnapshot.docs[0];
        return {
          path: `/profile/Display-Recipient-Profile?id=${recentUser.id}`,
          reason: "Most recently created user profile",
        };
      }

      // If no users with createdAt, try to get any active user
      const activeUserQuery = query(
        usersRef,
        where("banned", "==", false),
        limit(1)
      );

      querySnapshot = await getDocs(activeUserQuery);

      if (!querySnapshot.empty) {
        const activeUser = querySnapshot.docs[0];
        return {
          path: `/profile/Display-Recipient-Profile?id=${activeUser.id}`,
          reason: "First available active user profile",
        };
      }

      // If no active users, get any user
      const anyUserQuery = query(usersRef, limit(1));
      querySnapshot = await getDocs(anyUserQuery);

      if (!querySnapshot.empty) {
        const anyUser = querySnapshot.docs[0];
        return {
          path: `/profile/Display-Recipient-Profile?id=${anyUser.id}`,
          reason: "First available user profile",
        };
      }

      // If no users exist at all, redirect to a dashboard or user management page
      return {
        path: "/admin/dashboard",
        reason: "No users found in system - redirecting to dashboard",
      };
    } catch (error) {
      console.error("Error determining post-login destination:", error);

      // Fallback to dashboard on error
      return {
        path: "/admin/dashboard",
        reason: "Error occurred - redirecting to dashboard as fallback",
      };
    }
  }

  /**
   * Gets a specific user profile URL by user ID
   */
  public getUserProfileUrl(userId: string): string {
    return `/profile/Display-Recipient-Profile?id=${userId}`;
  }

  /**
   * Gets dashboard URL for administrative functions
   */
  public getDashboardUrl(): string {
    return "/admin/dashboard";
  }

  /**
   * Validates if a user exists before navigation
   */
  public async validateUserExists(userId: string): Promise<boolean> {
    try {
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("__name__", "==", userId));
      const querySnapshot = await getDocs(userQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error validating user existence:", error);
      return false;
    }
  }

  /**
   * Search for users by name (for future search functionality)
   */
  public async searchUsers(
    searchTerm: string
  ): Promise<Array<{ id: string; firstName: string; secondName: string }>> {
    try {
      const usersRef = collection(db, "users");

      // Search by first name or second name
      const firstNameQuery = query(
        usersRef,
        where("firstName", ">=", searchTerm),
        where("firstName", "<=", searchTerm + "\uf8ff"),
        limit(10)
      );

      const secondNameQuery = query(
        usersRef,
        where("secondName", ">=", searchTerm),
        where("secondName", "<=", searchTerm + "\uf8ff"),
        limit(10)
      );

      const [firstNameSnapshot, secondNameSnapshot] = await Promise.all([
        getDocs(firstNameQuery),
        getDocs(secondNameQuery),
      ]);

      const users: Array<{
        id: string;
        firstName: string;
        secondName: string;
      }> = [];
      const seenIds = new Set<string>();

      // Combine results and deduplicate
      [...firstNameSnapshot.docs, ...secondNameSnapshot.docs].forEach((doc) => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          const data = doc.data();
          users.push({
            id: doc.id,
            firstName: data.firstName,
            secondName: data.secondName,
          });
        }
      });

      return users;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }
}

// Export singleton instance
export const navigationService = NavigationService.getInstance();
