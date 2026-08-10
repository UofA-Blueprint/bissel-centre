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
  const firstName = formData.firstName.trim();
  const lastName = formData.lastName.trim();

  const errors: Record<string, string> = {
    firstName: firstName ? "" : "First name is required",
    lastName: lastName ? "" : "Last name is required",
    identificationNumber: formData.identificationNumber.trim()
      ? ""
      : "Identification number is required",
    email: formData.email.trim() ? "" : "Email is required",
  };

  if (firstName && !/^[A-Za-z]+$/.test(formData.firstName)) {
    errors.firstName = "First name must contain only letters";
  }
  if (lastName && !/^[A-Za-z]+$/.test(formData.lastName)) {
    errors.lastName = "Last name must contain only letters";
  }

  return errors;
}
