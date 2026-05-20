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

### B. Artwork Description and Title Management
Allows artists to assign and edit descriptions of their uploaded artworks at multiple lifecycle stages:

#### 1. Description Entry During Upload (`user_page.php`)
- Added a Description input field inside the **"Upload New Artwork"** modal.
- Submitting the form writes the title, file path, and description parameters to the database simultaneously.

#### 2. Unified Details Editing Modal (`user_page.php`)
- Redesigned the Dashboard's **"Rename"** modal to act as an **"Edit Artwork Details"** dialog.
- Allows changing the artwork's display title and writing/updating the description.
- Retains physical renaming checks on the storage volume to keep the filename aligned with the title.

#### 3. Inline Gallery Lightbox Editing (`home.php` & `profile.php`)
- Retained inline double-click editing of descriptions directly inside the public showcase lightbox.
- Employs an AJAX backend endpoint (`edit_description.php`) checking session-based owner or administrator privilege.

### C. Click-to-Zoom & Drag-to-Pan Lightbox Interactions
Enhanced public showcase viewer lightboxes (`home.php` and `profile.php`) to allow detailed inspection of artwork details.

#### 1. Interactive Lifecycle Steps
- **Cursor State Hints**: Default state indicates zoom capability with `zoom-in` cursor style.
- **Double Action click handler**: Clicking once triggers Zoomed/Fullscreen mode. Clicking again on the zoomed image (without dragging) exits zoom mode.
- **Zoom Scale Factor**: Scales up the image by `2.5x` dynamically inside its wrapper, which clips the boundaries (`overflow: hidden`) to allow focused region inspection.
- **Hold-and-Drag Pan**: Pressing down the left mouse button locks the grab cursor to `grabbing`. Moving the mouse recalculates drag translation relative to the `scale` factor to deliver a `1:1` panning ratio relative to cursor speed.

---

### D. Database Configuration & Deployment
Developed two interchangeable execution configurations depending on the local workspace environment:

#### 1. Traditional Apache Setup (Active Deployment)
- Connects through native `mysqli` in `config.php` using the local database `users_db` served over XAMPP.
- Pushed clean instructions inside `README.md` guiding users to start servers inside XAMPP Control Panel and import `users_db.sql`.

#### 2. Portable Node.js Server Setup (Optional Versioning)
- Developed a portable launcher `server.js` matching standard system environments (e.g., auto-scanning custom XAMPP folders and environment variables to launch PHP directly).
- Transitioned query structures into PDO SQLite wrapper emulators to initialize database layers dynamically inside an `artvault.sqlite` file.
- *Status*: Code has been fully reverted to Apache based on environment needs, preserving Git-tracking cleanliness.

#### 3. Execution Verification
A browser validation sweep confirmed that switching configs maintains clean state mapping without errors.

---

### E. Secure Password Updates
Users can change their accounts' login passwords directly through a dedicated security panel.

#### 1. Security Verification Requirements
- **Current Password Input**: Matches current hashed records via `password_verify()`.
- **New Password Input**: Specifies the new security key (min length: 6 characters).
- **Confirm Password Input**: Must match the new password precisely.

#### 2. Layout Structure
Renders inside a dedicated **"🔒 Change Password"** panel in the Settings view, containing a separate form and submit button to avoid collision with standard profile details updates.

### F. Sleek Waffle Navigation Drawer & Profile Avatar Link
Optimized the navigation architecture across all public gallery showcase pages (`home.php`, `profiles.php`, and `profile.php`) to introduce modern app-style controls.

#### 1. Left-Side Waffle Menu Trigger & Drawer
- **Waffle Grid Icon**: Appears on the left side of the navbar, triggering a 90-degree rotate animation on hover.
- **Slide-Out Side Drawer**: Clicking the waffle icon slides in a sleek left navigation drawer (`left: 0` from `-320px`) with a backdrop blur overlay (`backdrop-filter: blur(4px)`).
- **Navigation Shortcuts**: Provides direct items to the Global Showcase, Artists Directory, private Studio Dashboard, Profile Settings, Post New Artwork, and Logout.

#### 2. Interactive Avatar Dropdown Menu
- **Dropdown Toggle**: Clicking the circular avatar on the top right triggers a sleek, responsive dropdown menu positioned absolute to the navbar context.
- **Account Context Info**: Renders the logged-in user's display name and email address clearly at the top of the menu.
- **Quick Links**:
  - 👤 **View Public Profile**: Direct link to their profile showcase page (`profile.php?id=...`).
  - 🛡️ **Studio Dashboard**: Loads the main dashboard directory.
  - ⚙️ **Edit Profile / Settings**: Takes the user directly to the Settings tab in the dashboard via a URL query parameter (`?tab=settings`), avoiding manual tab switching.
  - 🚪 **Logout Session**: Safe logout hook shortcut.

#### 3. Dashboard Quick "View Gallery" Shortcut
- **Header Button**: Appended a **"🌐 View Gallery"** button to the top headers of both `user_page.php` and `admin_page.php`.
- **Seamless Navigation**: Allows developers, admins, and artists to return to the public gallery instantly from private views without using the sidebars.

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

---

## 💻 Core Code Implementations

Here are the primary code modifications implemented across the project files:

### 1. Database Schema (`users_db.sql`)
```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL UNIQUE,
  `email` varchar(100) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `profile_pic` varchar(255) DEFAULT 'uploads/default_avatar.svg',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Avatar File Upload and Processing Controller (`user_page.php`)
```php
// Handle profile picture upload if selected
$profile_pic_path = null;
if (isset($_FILES['profile_pic']) && $_FILES['profile_pic']['error'] == 0) {
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
    $ext = strtolower(pathinfo($_FILES['profile_pic']['name'], PATHINFO_EXTENSION));
    if (in_array($ext, $allowed)) {
        // Check size (max 2MB)
        if ($_FILES['profile_pic']['size'] <= 2 * 1024 * 1024) {
            $new_avatar_name = "avatar_" . $user_id . "_" . time() . "." . $ext;
            $upload_dir = "uploads/";
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }
            $dest_path = $upload_dir . $new_avatar_name;
            if (move_uploaded_file($_FILES['profile_pic']['tmp_name'], $dest_path)) {
                $profile_pic_path = $dest_path;
                // Delete old profile picture if not the default one to save space
                if (!empty($currentUser['profile_pic']) && $currentUser['profile_pic'] !== 'uploads/default_avatar.svg' && file_exists($currentUser['profile_pic'])) {
                    @unlink($currentUser['profile_pic']);
                }
            }
        } else {
            header("Location: user_page.php?action=error&message=Profile picture exceeds maximum size of 2MB.");
            exit();
        }
    } else {
        header("Location: user_page.php?action=error&message=Invalid file type for profile picture.");
        exit();
    }
}
```

### 3. Sidebar Avatar Rendering Code (`user_page.php`)
```html
<div class="user-meta">
    <div class="user-avatar" style="overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center;">
        <?php if (!empty($currentUser['profile_pic']) && file_exists($currentUser['profile_pic'])): ?>
            <img src="<?= htmlspecialchars($currentUser['profile_pic']) ?>" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
        <?php else: ?>
            <?= strtoupper(substr($currentUser['name'], 0, 2)); ?>
        <?php endif; ?>
    </div>
    <div class="user-details">
        <span class="user-name"><?= htmlspecialchars($currentUser['name']); ?></span>
        <span class="user-role">Artist</span>
    </div>
</div>
```

### 4. Showcase Gallery Author Avatar Badge (`home.php`)
```html
<div class="art-meta" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
    <div class="art-author-wrapper" style="display: flex; align-items: center; gap: 8px;">
        <div class="art-author-avatar" style="width: 22px; height: 22px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);">
            <?php if (!empty($row['artist_profile_pic']) && file_exists($row['artist_profile_pic'])): ?>
                <img src="<?= htmlspecialchars($row['artist_profile_pic']) ?>" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
            <?php else: ?>
                <span style="font-size: 10px; font-weight: 700; color: var(--text-secondary);"><?= strtoupper(substr($artist, 0, 1)) ?></span>
            <?php endif; ?>
        </div>
        <span class="art-author" style="font-size: 13px; font-weight: 500; color: var(--text-secondary);"><?= htmlspecialchars($artist) ?></span>
    </div>
    <span class="art-date"><?= date("M d, Y", strtotime($row['created_at'])) ?></span>
</div>
```

### 5. Change Password Form Controller & Markup (`user_page.php`)
```php
// PHP Backend POST Handler
if (isset($_POST['change_password'])) {
    $current_pass = $_POST['current_password'];
    $new_pass = $_POST['new_password'];
    $confirm_pass = $_POST['confirm_password'];
    
    $user_res = $conn->query("SELECT password FROM users WHERE id = $user_id");
    $user_data = $user_res->fetch_assoc();
    
    if ($user_data && password_verify($current_pass, $user_data['password'])) {
        if ($new_pass === $confirm_pass) {
            if (strlen($new_pass) >= 6) {
                $hashed_new = password_hash($new_pass, PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
                $stmt->bind_param("si", $hashed_new, $user_id);
                $stmt->execute();
                header("Location: user_page.php?action=password_success");
                exit();
            } else {
                header("Location: user_page.php?action=error&message=New password must be at least 6 characters.");
                exit();
            }
        } else {
            header("Location: user_page.php?action=error&message=Passwords do not match.");
            exit();
        }
    } else {
        header("Location: user_page.php?action=error&message=Incorrect current password.");
        exit();
    }
}
```

```html
<!-- HTML Frontend Card Form -->
<div class="content-card" style="max-width: 600px; margin: 0 auto;">
    <h3>🔒 Change Password</h3>
    <form method="post">
        <div class="form-group">
            <label for="curr_pass">Current Password</label>
            <input type="password" id="curr_pass" name="current_password" class="form-control" required>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="new_pass">New Password</label>
                <input type="password" id="new_pass" name="new_password" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="confirm_pass">Confirm New Password</label>
                <input type="password" id="confirm_pass" name="confirm_password" class="form-control" required>
            </div>
        </div>
        <div style="text-align: right; margin-top: 10px;">
            <button type="submit" name="change_password" class="btn btn-primary">
                🔑 Update Password
            </button>
        </div>
    </form>
</div>
```


