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
- A Supabase Project (Database & Storage)

### Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kenshinita13/Artvault-project.git Artvaultv3
   cd Artvaultv3/webapp
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file in the root of the `webapp` directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
5. **Access the Application**: Open your web browser and navigate directly to the Vite local server:
   👉 **`http://localhost:5173/`**

---

## 🛡️ Default Admin Account
- **Email**: `admin@artvault.com`
- **Password**: `admin123`
