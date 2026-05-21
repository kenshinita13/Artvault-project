# ArtVault Premium - Digital Art Showcase Web App

ArtVault is a modern, dark-themed, glassmorphic portfolio showcase web application built for digital artists to publish, search, and view artworks.

## 🚀 Key Features
- **Global Art Showcase**: High-resolution gallery display with search bar filters.
- **Maximized Lightbox details Modal**: Beautiful double-column split details modal with support for click-to-zoom manual image enlargement.
- **Searchable Artists Directory**: Browse other registered creators, check their creation counts, and inspect their portfolios.
- **Public Creator Portfolios**: Specific artist-focused showcases showcasing only their respective uploads.
- **Artist & Admin Dashboards**: Role-based access control allowing creators to manage their own uploads, and admins to manage all users, uploads, database states, and descriptions.

---

## 🛠️ Setup Instructions

> ⚠️ **Important Note:** This is a native PHP project, not a Node.js project. You do **NOT** need to run `npm install` or `npm start`.

### Running with XAMPP / Apache

To run this application, you must use a local web server stack like XAMPP:

1. **Clone the repository** inside your XAMPP `htdocs` folder:
   - *Windows*: `C:\xampp\htdocs\Artvaultv3` (or your local custom XAMPP installation directory, e.g., `C:\Users\root\Desktop\APACHEXAMPP\htdocs\Artvaultv3`)
   - *macOS*: `/Applications/XAMPP/xamppfiles/htdocs/Artvaultv3`
   ```bash
   git clone https://github.com/kenshinita13/Projects.git Artvaultv3
   ```
2. **Start Servers**: Open your **XAMPP Control Panel** and start both **Apache** and **MySQL**.
3. **Database Configuration**: Open `http://localhost/phpmyadmin/`, create a new database named `users_db`, and import the provided `users_db.sql` file. (Note: A patch script `patch_totp.php` is available to add 2FA table columns if needed).
4. **Access the Application**: Open your web browser and navigate directly to the project URL:
   👉 **`http://localhost/Artvaultv3/`**

---

## 🛡️ Default Admin Account
- **Email**: `admin@artvault.com`
- **Password**: `admin123`
