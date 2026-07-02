# ArtVault Premium - Digital Art Showcase Web App

ArtVault is a modern, dark-themed, glassmorphic portfolio showcase web application built for digital artists to publish, search, and view artworks. 

This project has been fully modernized and is built natively on **React**, **Vite**, **TypeScript**, and **Supabase**!

## 🚀 Key Features
- **Global Art Showcase**: High-resolution gallery display with search bar filters.
- **Maximized Lightbox Modal**: Beautiful double-column split details modal with support for click-to-zoom manual image enlargement.
- **Searchable Artists Directory**: Browse other registered creators, check their creation counts, and inspect their portfolios.
- **Public Creator Portfolios**: Specific artist-focused showcases showcasing only their respective uploads.
- **Role-based Authentication**: Secure User & Admin dashboards authenticated with **Two-Factor Authentication (TOTP)** and Supabase Row Level Security.
- **Cloud Storage**: Fast and secure image uploads powered by Supabase Cloud Buckets.

---

## 🛠️ Setup Instructions

> ⚠️ **Important Note:** This project has been migrated away from PHP/XAMPP. It is now a modern Node.js application.

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kenshinita13/Artvault-project.git Artvaultv3
   cd Artvaultv3/webapp
   ```

2. **Install Dependencies**:
   *(⚠️ **CRITICAL:** Make sure your terminal is inside the `webapp` folder before running this command. Skipping this step will result in errors when opening localhost)*
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   *Note: The project is pre-configured with public access keys to the live ArtVault Cloud Database, so you do not need to set up your own database to run it locally!*

4. **Access the Application**: Open your web browser and navigate directly to the Vite local server:
   👉 **`http://localhost:5173/`**

---

## 🛡️ Default Admin Account
- **Email**: `admin@artvault.com`
- **Password**: `admin`
- **http://localhost:5173/admin**
