# ArtVault Premium - Project Development & Feature Release Report

This report documents the architectural improvements, database changes, and new features implemented in **ArtVault Premium (V3)**. This documentation is structured to support project reports, submissions, and code reviews.

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Key Feature Implementation Details](#-key-feature-implementation-details)
   - [A. Profile Picture Customization](#a-profile-picture-customization)
   - [B. Inline Gallery Description Editing](#b-inline-gallery-description-editing)
   - [C. Database Configuration & Deployment](#c-database-configuration--deployment)
3. [Database Schema Updates](#-database-schema-updates)
4. [File Inventory & Code Alteration Log](#-file-inventory--code-alteration-log)

---

## 🔍 Project Overview
ArtVault is a glassmorphic, dark-themed digital art portfolio registry designed for artists to showcase their creations. Recent iterations focused on empowering users with **self-customization capabilities (avatars)**, enhancing **collaboration (inline description management)**, and providing **flexible serving configurations (hybrid Apache/MySQL and portable setups)**.

---

## 🛠️ Key Feature Implementation Details

### A. Profile Picture Customization
Artists can now upload custom avatars to personalize their gallery page, replacing initials-based text placeholders.

#### 1. Backend Controller Logic (`user_page.php`)
- Form submission intercepts files using `$_FILES['profile_pic']`.
- **Validation**:
  - File extension must match `['jpg', 'jpeg', 'png', 'gif', 'svg']`.
  - Max file size constraint is set to **2MB**.
- **File System Sanitation**: Files are renamed matching `avatar_[userId]_[timestamp].[extension]` and saved to `/uploads`.
- **Cleanup**: To prevent disk space bloating, old user profile picture files are deleted automatically (`unlink()`) once a new one is successfully written.

#### 2. Frontend Render Adaptations
- **Studio Dashboard Sidebar**: Displays a circular miniature avatar in the footer.
- **Global Showcase Gallery (`home.php`)**: Features miniature author avatars beside the artist names.
- **Artists Directory (`profiles.php`)**: Profile card displays high-resolution user avatars with original initial placeholders as safe fallbacks.
- **Creator Studio Profile (`profile.php`)**: Displayed at the header panel next to their creations count.

---

### B. Inline Gallery Description Editing
Allows artists to edit descriptions of their uploaded artworks directly inside the gallery details lightbox without reloading the page.

#### 1. AJAX Backend Handler (`edit_description.php`)
- Accepts AJAX POST requests containing `image_id` and the new `description`.
- Checks that the user is logged in.
- **Authorization Verification**: Ensures that the editing user is either the **original posting artist** of that artwork or an **Administrator**.
- Returns JSON response outputs (`{status: "success"}` or `{status: "error", message: "..."}`).

#### 2. Inline Widgets (`home.php` & `profile.php`)
- Double-clicking the description triggers an inline transition from a paragraph element to an editable text-area input field.
- Renders **Edit / Save / Cancel** action controls.
- Employs the JavaScript `Fetch API` to submit changes asynchronously.

---

### C. Database Configuration & Deployment
Developed two interchangeable execution configurations depending on the local workspace environment:

#### 1. Traditional Apache Setup (Active Deployment)
- Connects through native `mysqli` in `config.php` using the local database `users_db` served over XAMPP.
- Pushed clean instructions inside `README.md` guiding users to start servers inside XAMPP Control Panel and import `users_db.sql`.

#### 2. Portable Node.js Server Setup (Optional Versioning)
- Developed a portable launcher `server.js` matching standard system environments (e.g., auto-scanning custom XAMPP folders and environment variables to launch PHP directly).
- Transitioned query structures into PDO SQLite wrapper emulators to initialize database layers dynamically inside an `artvault.sqlite` file.
- *Status*: Code has been fully reverted to Apache based on environment needs, preserving Git-tracking cleanliness.

---

## 🗄️ Database Schema Updates

### Table: `users`
A new column was appended to store user avatar image locations.

```sql
ALTER TABLE `users` 
ADD COLUMN `profile_pic` VARCHAR(255) DEFAULT 'uploads/default_avatar.svg';
```

- **Default State**: Initialized with a purple-to-violet linear gradient vector avatar (`uploads/default_avatar.svg`) for all users out-of-the-box.
- **SQL Schema Export (`users_db.sql`)**: Updated to include the column default inside creation scripts.

---

## 🗃️ File Inventory & Code Alteration Log

| File Path | Description of Changes Made |
| :--- | :--- |
| **`config.php`** | Restored clean MySQL connection parameters via `mysqli`. |
| **`user_page.php`** | Added profile picture upload validations, database update hooks, avatar file removals, and settings layout markup. |
| **`home.php`** | Updated SQL selects to fetch profile images, added miniature circular avatars next to author headers in art showcase cards, and added lightbox inline widgets. |
| **`profile.php`** | Added the circular header avatar showing custom profile picture details on individual portfolio showcases. |
| **`profiles.php`** | Upgraded directory cards to showcase custom artist avatars. |
| **`users_db.sql`** | Updated schema definition to add `profile_pic` details. |
| **`uploads/default_avatar.svg`** | Built a modern gradient vector graphic to serve as the default user avatar. |
| **`.gitignore`** | Removed local uploads directory exclusion to track sample database artwork images. |
| **`README.md`** | Streamlined setup documentation back to traditional Apache/XAMPP instructions. |
