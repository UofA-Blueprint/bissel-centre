/**
 * Firestore Collections Documentation for Bissell Centre Project
 * 
 * This file documents the Firestore collections, the data they store, and their details.
 * 
 * 📌 Collections & Fields:
 * 
 * 1️⃣ `users` - Stores user profiles and bus pass history.
 *    - `id` (string) - Firestore-generated unique user ID.
 *    - `firstName` (string) - User’s first name.
 *    - `secondName` (string) - User’s second name.
 *    - `picture` (string, URL) - Profile picture stored in Cloud Storage.
 *    - `genderIdentity` (string) - User’s gender identity.
 *    - `aliases` (array) - Alternative names the user might use.
 *    - `dateOfBirth` (string) - User’s date of birth.
 *    - `address` (string) - User’s physical address.
 *    - `postalCode` (string) - User’s postal code.
 *    - `passesIssued` (array) - List of previously issued bus passes.
 *    - `banned` (boolean) - Indicates if the user is banned.
 *    - `banReason` (string) - Reason for the ban.
 *    - `notes` (string) - Miscellaneous notes about the user.
 *    - `createdAt` (timestamp) - Profile creation date.
 *    - `createdBy` (string) - Reference to admin who created the user(Reference to `adminstrative_staff/{id}`).
 *    - `updatedAt` (timestamp) - Last profile update.
 *
 * 2️⃣ `arc_cards` - Tracks ARC cards allocated to users.
 *    - `id` (string) - Firestore-generated ARC card document ID.
 *    - `currentUserId` (string | null) - The current user holding the card.
 *    - `userId` (string) - Reference to `users/{id}`.
 *    - `allocationDate` (string) - Date the ARC card was allocated to Bissell Centre.
 *    - `department` (string) - Department responsible for the card.
 *    - `arcCardNumber` (string) - ARC card number (last 7 digits).
 *    - `securityCode` (string) - Security code for the card.
 *    - `status` (string) - Status (`Active`, `Unattributed`, `Expired`, `Unloaded`).
 *    - `monthsRemaining` (number) - Number of months before expiration (max 3).
 *    - `issuedAt` (timestamp) - Date the ARC card was assigned to the user.

 * 3️⃣ `issues` - Tracks each card issuance event.
 *    - `id` (string) - Firestore-generated issue document ID.
 *    - `cardId` (string) - Reference to `arc_cards/{id}`.
 *    - `userId` (string) - Reference to `users/{id}`.
 *    - `issueDate` (timestamp) - Date and time the card was issued.
 *    - `createdAt` (timestamp) - Same value as `issueDate`.
 *    - `issuedBy` (string) - Admin user ID who issued the card.
 *    - `notes` (string) - Free-form notes; blank when not used.
 *    - `returnedAt` (timestamp | null) - When the card was returned.
 *    - `expiresAt` (timestamp) - When the issue expires.
 *
 * 4️⃣ `banned_users` - Stores information about banned users.
 *    - `userId` (string) - Reference to `users/{id}`.
 *    - `banReason` (string) - Reason for banning.
 *    - `bannedAt` (timestamp) - Date when the ban was applied.
 *    - `bannedBy` (string) - Reference to admin who banned the user (Reference to `adminstrative_staff/{id}`) .
 *    - `notes` (string) - Additional details about the ban.
 *
 * 5️⃣ `administrative_staff` - Stores admin authentication and permissions.
 *    - `id` (string) - Firestore-generated admin ID.
 *    - `email` (string) - Admin’s email for login.
 *    - `hashedPassword` (string) - Securely hashed password.
 *    - `firstName` (string) - Admin’s first name.
 *    - `secondName` (string) - Admin’s second name.
 *    - `createdAt` (timestamp) - Account creation date.
 *    - `createdBy` (string) - Reference to IT admin who created the account(Reference to `it_admin/{id}`).
 *
 * 6️⃣ `it_admin` - Stores IT admin authentication details.
 *    - `id` (string) - Firestore-generated IT admin ID.
 *    - `email` (string) - IT admin’s email on file for any notifications or any communication.
 *    - `hashedIdentificationNumber` (string) - Securely hashed identification number.
 *    - `firstName` (string) - IT admin’s first name.
 *    - `secondName` (string) - IT admin’s second name.
 *    - `createdAt` (timestamp) - Account creation date.
 *
 * 7️⃣ `history` - Logs all modifications, bans, and administrative actions.
 *    - `id` (string) - Firestore-generated history entry ID.
 *    - `date` (timestamp) - Date and time of the event.
 *    - `userId` (string) - Reference to the affected user (Reference to users/{id}).
 *    - `modifiedBy` (string) - Admin ID of the admin who made the change (could also be the system).
 *    - `event` (string) - What is this event ('Ban' or 'Override' or 'ARC Card lost' etc)
 *    - `notes` (string) - Additional details about the modification.
 *
 * 8️⃣ `questions` - Stores responses to transit-related surveys.
 *    - `id` (string) - Firestore-generated questionnaire ID.
 *    - `userId` (string) - Reference to user who answered the questions (Reference to users/{id}).
 *    - `questions` (array) - Array of questions
 *    - `answers` (array) - Array of answers (Same length as questions)
 */
