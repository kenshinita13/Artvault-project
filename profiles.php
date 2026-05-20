<?php
session_start();
require_once 'config.php';

// Protect page
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// Get current user ID, role, profile picture and name for navigation
$user_res = $conn->query("SELECT id, role, profile_pic, name FROM users WHERE email = '$email'");
$currentUser = $user_res->fetch_assoc();
$current_user_role = $currentUser ? $currentUser['role'] : 'user';
$current_user_initial = $currentUser ? strtoupper(substr($currentUser['name'], 0, 1)) : 'U';
$dashboard_url = ($current_user_role === 'admin') ? 'admin_page.php' : 'user_page.php';

// Helper function to sanitize user input
function sanitize($conn, $data) {
    return mysqli_real_escape_string($conn, trim($data));
}

$search = isset($_GET['search']) ? sanitize($conn, $_GET['search']) : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artists Directory - ArtVault</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #09090b 0%, #110520 60%, #03000a 100%);
            --panel-bg: rgba(24, 24, 27, 0.7);
            --panel-border: rgba(255, 255, 255, 0.08);
            --text-primary: #fafafa;
            --text-secondary: #a1a1aa;
            --accent: #a855f7;
            --accent-hover: #c084fc;
            --danger: #ef4444;
            --success: #10b981;
            --input-bg: rgba(9, 9, 11, 0.6);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Outfit', sans-serif;
        }

        body {
            background: var(--bg-gradient);
            color: var(--text-primary);
            min-height: 100vh;
            padding-top: 90px;
            overflow-x: hidden;
        }

        /* Top Navbar */
        .navbar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 80px;
            background: rgba(9, 9, 11, 0.8);
            border-bottom: 1px solid var(--panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            z-index: 9999;
            backdrop-filter: blur(12px);
        }

        /* Waffle Button styling */
        .waffle-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        .waffle-btn:hover {
            color: var(--accent-hover);
            background: rgba(255, 255, 255, 0.05);
            transform: rotate(90deg);
        }

        /* Nav Avatar Button styling */
        .nav-avatar-btn {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid var(--panel-border);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--input-bg);
            text-decoration: none;
            margin-left: 10px;
        }
        .nav-avatar-btn:hover {
            border-color: var(--accent);
            transform: scale(1.05);
            box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
        }
        .nav-avatar-btn img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .nav-avatar-initials {
            font-size: 15px;
            font-weight: 700;
            color: white;
        }

        /* Drawer Navigation styling */
        .nav-drawer {
            position: fixed;
            top: 0;
            left: -320px;
            width: 320px;
            height: 100vh;
            background: rgba(18, 18, 24, 0.98);
            border-right: 1px solid var(--panel-border);
            z-index: 100001;
            transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
            box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(20px);
        }
        .nav-drawer.open {
            left: 0;
        }
        .nav-drawer-header {
            padding: 25px;
            border-bottom: 1px solid var(--panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .nav-drawer-header h3 {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
        }
        .close-drawer {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 20px;
            cursor: pointer;
        }
        .close-drawer:hover {
            color: var(--text-primary);
        }
        .nav-drawer-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
            overflow-y: auto;
        }
        .drawer-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 14px 18px;
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        .drawer-item:hover {
            color: var(--text-primary);
            background: rgba(168, 85, 247, 0.1);
            transform: translateX(5px);
        }
        .drawer-item.logout:hover {
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }
        .drawer-icon {
            font-size: 18px;
        }
        .drawer-divider {
            border: none;
            border-top: 1px solid var(--panel-border);
            margin: 15px 0;
        }
        .drawer-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            z-index: 100000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.4s ease;
            backdrop-filter: blur(4px);
        }
        .drawer-overlay.open {
            opacity: 1;
            pointer-events: auto;
        }

        .nav-logo {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .nav-logo span {
            color: var(--accent);
        }

        /* Search Engine */
        .search-form {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            max-width: 500px;
            margin: 0 20px;
        }

        .search-input {
            width: 100%;
            padding: 10px 15px;
            background: var(--input-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            color: white;
            font-size: 14px;
            outline: none;
            transition: all 0.3s;
        }

        .search-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
        }

        /* Navigation actions */
        .nav-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .btn {
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            text-decoration: none;
        }

        .btn-primary {
            background: var(--accent);
            color: white;
        }

        .btn-primary:hover {
            background: var(--accent-hover);
            box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-primary);
            border: 1px solid var(--panel-border);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .btn-danger {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .btn-danger:hover {
            background: var(--danger);
            color: white;
        }

        /* Profiles Directory Layout */
        .directory-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .directory-header {
            margin-bottom: 40px;
            text-align: center;
        }

        .directory-header h2 {
            font-size: 32px;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff 0%, #c084fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .directory-header p {
            color: var(--text-secondary);
            font-size: 16px;
            margin-top: 8px;
        }

        .profiles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 30px;
        }

        /* Profile Cards */
        .profile-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(12px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            text-align: center;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .profile-card:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            box-shadow: 0 15px 30px rgba(168, 85, 247, 0.15);
        }

        .avatar-placeholder {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: white;
            font-weight: 700;
            margin-bottom: 20px;
            box-shadow: 0 8px 20px rgba(168, 85, 247, 0.3);
        }

        .artist-name {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 4px;
        }

        .artist-handle {
            font-size: 14px;
            color: var(--accent-hover);
            font-weight: 500;
            margin-bottom: 15px;
        }

        .artist-badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--panel-border);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 20px;
            text-transform: capitalize;
        }

        .artist-badge.admin-badge {
            border-color: rgba(239, 68, 68, 0.3);
            color: #f87171;
            background: rgba(239, 68, 68, 0.05);
        }

        .artist-stats {
            width: 100%;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 18px;
            margin-bottom: 20px;
            display: flex;
            justify-content: center;
            gap: 15px;
        }

        .stat-item {
            font-size: 14px;
            color: var(--text-secondary);
        }

        .stat-item strong {
            color: var(--text-primary);
            font-size: 16px;
        }

        .profile-card .btn {
            width: 100%;
            margin-top: auto;
        }

        @media (max-width: 768px) {
            .navbar {
                padding: 0 20px;
                flex-direction: column;
                height: auto;
                padding-bottom: 15px;
            }
            .search-form {
                margin: 10px 0;
                width: 100%;
            }
            body {
                padding-top: 155px;
            }
        }
    </style>
</head>
<body>

    <!-- Slide-out Drawer Navigation -->
    <div id="nav-drawer" class="nav-drawer">
        <div class="nav-drawer-header">
            <h3>🧭 Quick Navigation</h3>
            <button class="close-drawer" onclick="toggleNavMenu()">✕</button>
        </div>
        <div class="nav-drawer-body">
            <a href="home.php" class="drawer-item">
                <span class="drawer-icon">🖼️</span> Global Showcase
            </a>
            <a href="profiles.php" class="drawer-item">
                <span class="drawer-icon">👥</span> Artists Directory
            </a>
            <a href="<?= $dashboard_url ?>" class="drawer-item">
                <span class="drawer-icon">🛡️</span> Studio Dashboard
            </a>
            <a href="<?= $dashboard_url ?>" class="drawer-item">
                <span class="drawer-icon">⚙️</span> Profile Settings
            </a>
            <a href="<?= $dashboard_url ?>" class="drawer-item">
                <span class="drawer-icon">📤</span> Post New Artwork
            </a>
            <hr class="drawer-divider">
            <a href="logout.php" class="drawer-item logout">
                <span class="drawer-icon">🚪</span> Logout Session
            </a>
        </div>
    </div>
    <!-- Drawer overlay -->
    <div id="drawer-overlay" class="drawer-overlay" onclick="toggleNavMenu()"></div>

    <!-- Navbar -->
    <header class="navbar">
        <div style="display: flex; align-items: center; gap: 15px;">
            <!-- Waffle Icon Button -->
            <button class="waffle-btn" onclick="toggleNavMenu()" title="Navigate Menu">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <rect x="3" y="3" width="4" height="4" rx="1" />
                    <rect x="10" y="3" width="4" height="4" rx="1" />
                    <rect x="17" y="3" width="4" height="4" rx="1" />
                    <rect x="3" y="10" width="4" height="4" rx="1" />
                    <rect x="10" y="10" width="4" height="4" rx="1" />
                    <rect x="17" y="10" width="4" height="4" rx="1" />
                    <rect x="3" y="17" width="4" height="4" rx="1" />
                    <rect x="10" y="17" width="4" height="4" rx="1" />
                    <rect x="17" y="17" width="4" height="4" rx="1" />
                </svg>
            </button>
            <a href="home.php" class="nav-logo">
                🎨 <span>ArtVault</span> Gallery
            </a>
        </div>

        <!-- Search Form -->
        <form action="profiles.php" method="GET" class="search-form">
            <input type="text" name="search" class="search-input" placeholder="Search artists by name or username..." value="<?= htmlspecialchars($search) ?>">
            <button type="submit" class="btn btn-secondary" style="padding: 10px 14px;">🔍</button>
        </form>

        <div class="nav-actions">
            <a href="home.php" class="btn btn-secondary">
                🖼️ Gallery
            </a>
            <a href="<?= $dashboard_url ?>" class="nav-avatar-btn" title="Go to My Studio Dashboard">
                <?php if (!empty($currentUser['profile_pic']) && file_exists($currentUser['profile_pic'])): ?>
                    <img src="<?= htmlspecialchars($currentUser['profile_pic']) ?>" alt="Avatar">
                <?php else: ?>
                    <span class="nav-avatar-initials"><?= $current_user_initial ?></span>
                <?php endif; ?>
            </a>
        </div>
    </header>

    <!-- Main Container -->
    <main class="directory-container">
        
        <div class="directory-header">
            <?php if (!empty($search)): ?>
                <h2>🔍 Search Results</h2>
                <p>Showing creators matching "<strong><?= htmlspecialchars($search) ?></strong>"</p>
            <?php else: ?>
                <h2>👥 ArtVault Creators</h2>
                <p>Discover and browse portfolio studios of our digital artists</p>
            <?php endif; ?>
        </div>

        <div class="profiles-grid">
            <?php
            if (!empty($search)) {
                $query = "SELECT users.*, COUNT(images.id) as total_uploads 
                          FROM users 
                          LEFT JOIN images ON users.id = images.user_id 
                          WHERE users.name LIKE '%$search%' 
                             OR users.username LIKE '%$search%' 
                          GROUP BY users.id 
                          ORDER BY total_uploads DESC";
            } else {
                $query = "SELECT users.*, COUNT(images.id) as total_uploads 
                          FROM users 
                          LEFT JOIN images ON users.id = images.user_id 
                          GROUP BY users.id 
                          ORDER BY total_uploads DESC";
            }
            
            $result = $conn->query($query);

            if ($result->num_rows == 0):
            ?>
                <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: var(--text-secondary);">
                    <span style="font-size: 48px;">👥</span>
                    <h4 style="margin-top: 15px;">No Artists Found</h4>
                    <p style="margin-top: 5px;">Try checking spelling or using a different search term.</p>
                </div>
            <?php
            else:
                while ($row = $result->fetch_assoc()):
                    $name = $row['name'];
                    $username = $row['username'];
                    $initial = strtoupper(substr($name, 0, 1));
                    $total_uploads = (int)$row['total_uploads'];
                    $role = $row['role'];
                    $badge_class = ($role === 'admin') ? 'artist-badge admin-badge' : 'artist-badge';
            ?>
                <div class="profile-card">
                    <div class="avatar-placeholder" style="overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center;">
                        <?php if (!empty($row['profile_pic']) && file_exists($row['profile_pic'])): ?>
                            <img src="<?= htmlspecialchars($row['profile_pic']) ?>" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
                        <?php else: ?>
                            <?= $initial ?>
                        <?php endif; ?>
                    </div>
                    <div class="artist-name"><?= htmlspecialchars($name) ?></div>
                    <div class="artist-handle">@<?= htmlspecialchars($username) ?></div>
                    
                    <div class="<?= $badge_class ?>">
                        <?= $role === 'admin' ? '🛡️ Administrator' : '🎨 Artist' ?>
                    </div>

                    <div class="artist-stats">
                        <div class="stat-item">
                            🎨 Creations: <strong><?= $total_uploads ?></strong>
                        </div>
                    </div>

                    <a href="profile.php?id=<?= $row['id'] ?>" class="btn btn-primary">
                        View Studio Profile
                    </a>
                </div>
            <?php
                endwhile;
            endif;
            ?>
        </div>
    </main>

    <script>
        function toggleNavMenu() {
            document.getElementById('nav-drawer').classList.toggle('open');
            document.getElementById('drawer-overlay').classList.toggle('open');
        }
    </script>
</body>
</html>
