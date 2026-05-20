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

### Option A: Using NPM (Easiest & Portable)
This option allows you to run the project from **any folder** on your computer without putting the code inside XAMPP's `htdocs` directory.

1. **Prerequisites**: Ensure you have Node.js/NPM and the PHP interpreter installed and registered on your system path.
2. **Clone the repository** to any folder:
   ```bash
   git clone https://github.com/kenshinita13/Projects.git Artvaultv3
   ```
3. **Start local database**: Start MySQL in your XAMPP Control Panel.
4. **Import Database Schema**: Create a database named `users_db` in `http://localhost/phpmyadmin/` and import `users_db.sql`.
5. **Start server**: Inside the project directory, run:
   ```bash
   npm start
   ```
6. **Open browser**: Visit `http://localhost:8000/`.

---

### Option B: Using XAMPP / Apache (Traditional)
This option serves the project directly through XAMPP's built-in Apache server.

1. **Clone the repository** inside your XAMPP `htdocs` folder:
   - *Windows*: `C:\xampp\htdocs\Artvaultv3`
   - *macOS*: `/Applications/XAMPP/xamppfiles/htdocs/Artvaultv3`
   ```bash
   git clone https://github.com/kenshinita13/Projects.git Artvaultv3
   ```
2. **Start Servers**: Start Apache and MySQL in your XAMPP Control Panel.
3. **Import Database Schema**: Create a database named `users_db` in `http://localhost/phpmyadmin/` and import `users_db.sql`.
4. **Open browser**: Visit `http://localhost/Artvaultv3/`.

---

## 🛡️ Default Admin Account
- **Email**: `admin@artvault.com`
- **Password**: `admin123`
