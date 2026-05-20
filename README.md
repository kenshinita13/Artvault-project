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

### 1. Prerequisites
- **XAMPP** (or any server stack with Apache, PHP 7.4+, and MySQL).

### 2. Project Clone
Clone this repository directly into your local XAMPP web server hosting folder (typically `C:\xampp\htdocs\` on Windows):
```bash
git clone https://github.com/kenshinita13/Projects.git Artvaultv3
```

### 3. Database Installation
1. Start **Apache** and **MySQL** in your XAMPP Control Panel.
2. Go to `http://localhost/phpmyadmin/`.
3. Create a new database named **`users_db`**.
4. Click on the database name, go to the **Import** tab, choose the **`users_db.sql`** file from the cloned project directory, and click **Import**.

### 4. Configuration Check
Open `config.php` and verify the MySQL credentials correspond to your environment settings:
```php
$host = "localhost";
$user = "root";
$password = ""; // Default empty password for XAMPP root
$database = "users_db";
```

### 5. Access App
Visit the application in your browser:
```
http://localhost/Artvaultv3/
```

---

## 🛡️ Default Admin Account
- **Email**: `admin@artvault.com`
- **Password**: `admin123`
