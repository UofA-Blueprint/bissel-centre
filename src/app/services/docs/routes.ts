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
 *    - `arcCardNumber` (string) - Assigned ARC card ID (last 7 digits) (Reference to arc_cards/{arcCardNumber}).
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
 *    - `userId` (string) - Reference to `users/{id}`.
 *    - `allocationDate` (string) - Date the ARC card was allocated to Bissell Centre.
 *    - `department` (string) - Department responsible for the card.
 *    - `arcCardNumber` (string) - ARC card number (last 7 digits).
 *    - `securityCode` (string) - Security code for the card.
 *    - `status` (string) - Status (`Active`, `Unattributed`, `Expired`, `Unloaded`).
 *    - `monthsRemaining` (number) - Number of months before expiration (max 3).
 *    - `issuedAt` (timestamp) - Date the ARC card was assigned to the user.
 *
 * 3️⃣ `banned_users` - Stores information about banned users.
 *    - `userId` (string) - Reference to `users/{id}`.
 *    - `banReason` (string) - Reason for banning.
 *    - `bannedAt` (timestamp) - Date when the ban was applied.
 *    - `bannedBy` (string) - Reference to admin who banned the user (Reference to `adminstrative_staff/{id}`) .
 *    - `notes` (string) - Additional details about the ban.
 *
 * 4️⃣ `administrative_staff` - Stores admin authentication and permissions.
 *    - `id` (string) - Firestore-generated admin ID.
 *    - `email` (string) - Admin’s email for login.
 *    - `hashedPassword` (string) - Securely hashed password.
 *    - `firstName` (string) - Admin’s first name.
 *    - `secondName` (string) - Admin’s second name.
 *    - `createdAt` (timestamp) - Account creation date.
 *    - `createdBy` (string) - Reference to IT admin who created the account(Reference to `it_admin/{id}`).
 *
 * 5️⃣ `it_admin` - Stores IT admin authentication details.
 *    - `id` (string) - Firestore-generated IT admin ID.
 *    - `email` (string) - IT admin’s email on file for any notifications or any communication.
 *    - `hashedIdentificationNumber` (string) - Securely hashed identification number.
 *    - `firstName` (string) - IT admin’s first name.
 *    - `secondName` (string) - IT admin’s second name.
 *    - `createdAt` (timestamp) - Account creation date.
 *
 * 6️⃣ `history` - Logs all modifications, bans, and administrative actions.
 *    - `id` (string) - Firestore-generated history entry ID.
 *    - `date` (timestamp) - Date and time of the event.
 *    - `userId` (string) - Reference to the affected user (Reference to users/{id}).
 *    - `modifiedBy` (string) - Admin ID of the admin who made the change (could also be the system).
 *    - `event` (string) - What is this event ('Ban' or 'Override' or 'ARC Card lost' etc)
 *    - `notes` (string) - Additional details about the modification.
 *
 * 7️⃣ `questions` - Stores responses to transit-related surveys.
 *    - `id` (string) - Firestore-generated questionnaire ID.
 *    - `userId` (string) - Reference to user who answered the questions (Reference to users/{id}).
 *    - `Question1` (string) - Answer to sustainable transit journey.
 *    - `Question2` (string) - Most common reason for bus pass use.
 *    - `Question3` (string) - Second most common reason for bus pass use.
 *    - `Question4` (string) - Most common housing option last month.
 */
