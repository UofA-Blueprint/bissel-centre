import {
  userFormFields,
  validateRegistrationForm,
  RegistrationFormData,
} from "@/utils/registrationUtils"

describe("Registration Utilities", () => {
  
  describe("userFormFields configuration", () => {
    it("should contain exactly four field configurations", () => {
      expect(userFormFields).toHaveLength(4);
    });

    it("should have correct properties for each field", () => {
      userFormFields.forEach((field) => {
        expect(field).toHaveProperty("id");
        expect(field).toHaveProperty("name");
        expect(field).toHaveProperty("label");
        expect(field).toHaveProperty("type");
      });
    });
  });

  describe("validateRegistrationForm", () => {
    // Helper function to generate clean, valid dummy data
    const getValidData = (): RegistrationFormData => ({
      firstName: "John",
      lastName: "Doe",
      identificationNumber: "12345",
      email: "john.doe@example.com",
    });

    it("should return no error messages when all fields are valid", () => {
      const validData = getValidData();
      const errors = validateRegistrationForm(validData);

      expect(errors.firstName).toBe("");
      expect(errors.lastName).toBe("");
      expect(errors.identificationNumber).toBe("");
      expect(errors.email).toBe("");
    });

    it("should catch empty or whitespace-only inputs as required errors", () => {
      const invalidData: RegistrationFormData = {
        firstName: "",
        lastName: "   ", // tests the .trim() logic
        identificationNumber: "",
        email: "   ",
      };

      const errors = validateRegistrationForm(invalidData);

      expect(errors.firstName).toBe("First name is required");
      expect(errors.lastName).toBe("Last name is required");
      expect(errors.identificationNumber).toBe("Identification number is required");
      expect(errors.email).toBe("Email is required");
    });

    it("should flag first names that contain numbers or special characters", () => {
      const dataWithInvalidFirstName = {
        ...getValidData(),
        firstName: "John123", // numbers
      };

      let errors = validateRegistrationForm(dataWithInvalidFirstName);
      expect(errors.firstName).toBe("First name must contain only letters");

      dataWithInvalidFirstName.firstName = "John!"; // special character
      errors = validateRegistrationForm(dataWithInvalidFirstName);
      expect(errors.firstName).toBe("First name must contain only letters");
    });

    it("should flag last names that contain numbers or special characters", () => {
      const dataWithInvalidLastName = {
        ...getValidData(),
        lastName: "Doe-Smith", // contains a hyphen, which is rejected by /^[A-Za-z]+$/
      };

      let errors = validateRegistrationForm(dataWithInvalidLastName);
      expect(errors.lastName).toBe("Last name must contain only letters");

      dataWithInvalidLastName.lastName = "Doe2"; // numbers
      errors = validateRegistrationForm(dataWithInvalidLastName);
      expect(errors.lastName).toBe("Last name must contain only letters");
    });

    it("should not trigger validation errors if optional/invalid inputs are completely empty", () => {
      // If firstName and lastName are completely empty, the "required" validation
      // is expected to fire, but NOT the regex "must contain only letters" validation.
      const emptyData: RegistrationFormData = {
        firstName: "",
        lastName: "",
        identificationNumber: "12345",
        email: "test@example.com",
      };

      const errors = validateRegistrationForm(emptyData);
      expect(errors.firstName).toBe("First name is required");
      expect(errors.lastName).toBe("Last name is required");
    });
  });
});