import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

// Types for authenticated users
export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  secondName: string;
  createdBy: string;
  role: string;
  isAuthenticated: boolean;
}

export interface AuthState {
  user: StaffUser | null;
  loading: boolean;
  error: string | null;
}

// Authentication service class
export class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    user: null,
    loading: true,
    error: null,
  };
  private listeners: ((state: AuthState) => void)[] = [];

  private constructor() {
    this.initializeAuthListener();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private initializeAuthListener() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const staffUser = await this.getStaffUserData(firebaseUser);
          this.updateAuthState({
            user: staffUser,
            loading: false,
            error: null,
          });
        } catch (error) {
          console.error("Error fetching staff user data:", error);
          this.updateAuthState({
            user: null,
            loading: false,
            error: "Failed to fetch user profile",
          });
        }
      } else {
        this.updateAuthState({
          user: null,
          loading: false,
          error: null,
        });
      }
    });
  }

  private async getStaffUserData(
    firebaseUser: FirebaseUser
  ): Promise<StaffUser> {
    // Query the administrative_staff collection for this user
    const staffQuery = query(
      collection(db, "administrative_staff"),
      where("email", "==", firebaseUser.email?.toLowerCase().trim())
    );

    const staffSnapshot = await getDocs(staffQuery);

    if (staffSnapshot.empty) {
      throw new Error("User not found in administrative staff");
    }

    const staffDoc = staffSnapshot.docs[0];
    const staffData = staffDoc.data();

    return {
      id: staffDoc.id,
      email: staffData.email,
      firstName: staffData.firstName,
      secondName: staffData.secondName,
      createdBy: staffData.createdBy,
      role: staffData.role || "staff",
      isAuthenticated: true,
    };
  }

  private updateAuthState(newState: Partial<AuthState>) {
    this.authState = { ...this.authState, ...newState };
    this.listeners.forEach((listener) => listener(this.authState));
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async signIn(email: string, password: string): Promise<StaffUser> {
    try {
      this.updateAuthState({ loading: true, error: null });

      // Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      // Verify the user exists in administrative_staff collection
      const staffUser = await this.getStaffUserData(userCredential.user);

      return staffUser;
    } catch (error: unknown) {
      console.error("Login error:", error);

      let errorMessage = "An error occurred during login. Please try again.";

      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "auth/user-not-found" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/invalid-credential")
      ) {
        errorMessage =
          "Invalid email or password. Please contact IT Admin if you need assistance.";
      } else if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "auth/too-many-requests"
      ) {
        errorMessage =
          "Too many failed login attempts. Please try again later.";
      } else if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        error.message === "User not found in administrative staff"
      ) {
        errorMessage =
          "Access denied. This login is for administrative staff only.";
      }

      this.updateAuthState({
        loading: false,
        error: errorMessage,
      });

      throw new Error(errorMessage);
    }
  }

  public async signOut(): Promise<void> {
    try {
      await signOut(auth);
      // Clear any stored user data
      localStorage.removeItem("staffUser");
      localStorage.removeItem("rememberedEmail");
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  }

  public getCurrentUser(): StaffUser | null {
    return this.authState.user;
  }

  public getAuthState(): AuthState {
    return this.authState;
  }

  public isAuthenticated(): boolean {
    return this.authState.user !== null && this.authState.user.isAuthenticated;
  }

  // Remember email functionality
  public setRememberedEmail(email: string): void {
    localStorage.setItem("rememberedEmail", email);
  }

  public getRememberedEmail(): string | null {
    return localStorage.getItem("rememberedEmail");
  }

  public clearRememberedEmail(): void {
    localStorage.removeItem("rememberedEmail");
  }
}

// Convenience functions for use in components
export const authService = AuthService.getInstance();

export const useAuth = () => {
  return authService.getAuthState();
};
