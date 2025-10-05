export const userFormFields = [
  { id: "first-name", name: "firstName", label: "First Name", type: "text" },
  { id: "last-name", name: "lastName", label: "Last Name", type: "text" },
  {
    id: "identification-number",
    name: "identificationNumber",
    label: "Identification Number",
    type: "text",
  },
  { id: "email", name: "email", label: "Email Address", type: "text" },
];

export const passwordFields = [
  {
    id: "password",
    name: "password",
    label: "Create Password",
    type: "password",
  },
  {
    id: "confirmPassword",
    name: "confirmPassword",
    label: "Confirm Password",
    type: "password",
  },
];

export function checkPasswordStrength(password: string): string {
  const trimmed = password.trim();
  if (
    trimmed.length < 8 ||
    !/[A-Z]/.test(trimmed) ||
    !/[a-z]/.test(trimmed) ||
    !/[0-9]/.test(trimmed)
  ) {
    return "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number";
  }
  return "";
}

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  identificationNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistrationForm(
  formData: RegistrationFormData
): Record<string, string> {
  const errors: Record<string, string> = {
    firstName: formData.firstName.trim() ? "" : "First name is required",
    lastName: formData.lastName.trim() ? "" : "Last name is required",
    identificationNumber: formData.identificationNumber.trim()
      ? ""
      : "Identification number is required",
    email: formData.email.trim() ? "" : "Email is required",
    confirmPassword: formData.confirmPassword.trim()
      ? ""
      : "Confirm password is required",
    password: checkPasswordStrength(formData.password),
  };

  if (formData.firstName && !/^[A-Za-z]+$/.test(formData.firstName)) {
    errors.firstName = "First name must contain only letters";
  }
  if (formData.lastName && !/^[A-Za-z]+$/.test(formData.lastName)) {
    errors.lastName = "Last name must contain only letters";
  }
  if (
    formData.password &&
    formData.confirmPassword &&
    formData.password !== formData.confirmPassword
  ) {
    errors.confirmPassword = "Passwords do not match";
  }
  return errors;
}
