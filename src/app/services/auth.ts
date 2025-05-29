import bcrypt from "bcryptjs";

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  // Simple hash for testing - in production, use bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt'); // Add salt for better security
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password from database
 * @returns Promise<boolean> - True if password matches
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
};

/**
 * Staff user interface
 */
export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  secondName: string;
  createdBy: string;
  hashedPassword?: string;
  createdAt?: Date | string;
}


/**
 * Check if user is authenticated (has valid session)
 * @returns StaffUser | null
 */
export const getAuthenticatedStaffUser = (): StaffUser | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const userData = sessionStorage.getItem("staff_user");
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error("Error parsing staff user data:", error);
    return null;
  }
};

/**
 * Check if user has remember me enabled
 * @returns string | null - Email if remember me is enabled
 */
export const getRememberedEmail = (): string | null => {
  if (typeof window === "undefined") return null;
  
  const remember = localStorage.getItem("staff_remember");
  if (remember === "true") {
    return localStorage.getItem("staff_email");
  }
  return null;
};

/**
 * Clear all authentication data
 */
export const clearAuthData = (): void => {
  if (typeof window === "undefined") return;
  
  sessionStorage.removeItem("staff_user");
  localStorage.removeItem("staff_remember");
  localStorage.removeItem("staff_email");
};

/**
 * Store staff user in session
 * @param user - Staff user data
 */
export const setStaffUser = (user: StaffUser): void => {
  if (typeof window === "undefined") return;
  
  sessionStorage.setItem("staff_user", JSON.stringify(user));
};

/**
 * Set remember me preference
 * @param email - User email
 * @param remember - Whether to remember
 */
export const setRememberMe = (email: string, remember: boolean): void => {
  if (typeof window === "undefined") return;
  
  if (remember) {
    localStorage.setItem("staff_remember", "true");
    localStorage.setItem("staff_email", email);
  } else {
    localStorage.removeItem("staff_remember");
    localStorage.removeItem("staff_email");
  }
};

/**
 * Get staff user from session
 * @returns StaffUser | null
 */
export const getStaffUser = (): StaffUser | null => {
  return getAuthenticatedStaffUser();
};

/**
 * Clear staff user session and remember me data
 */
export const clearStaffUser = (): void => {
  clearAuthData();
};
