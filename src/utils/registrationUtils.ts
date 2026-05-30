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

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  identificationNumber: string;
  email: string;
}

export function validateRegistrationForm(
  formData: RegistrationFormData,
): Record<string, string> {
  const errors: Record<string, string> = {
    firstName: formData.firstName.trim() ? "" : "First name is required",
    lastName: formData.lastName.trim() ? "" : "Last name is required",
    identificationNumber: formData.identificationNumber.trim()
      ? ""
      : "Identification number is required",
    email: formData.email.trim() ? "" : "Email is required",
  };

  if (formData.firstName && !/^[A-Za-z]+$/.test(formData.firstName)) {
    errors.firstName = "First name must contain only letters";
  }
  if (formData.lastName && !/^[A-Za-z]+$/.test(formData.lastName)) {
    errors.lastName = "Last name must contain only letters";
  }

  return errors;
}
