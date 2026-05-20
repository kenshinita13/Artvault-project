<?php
session_start();
require_once 'config.php';

// Protect page
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// Get current user ID and role
$user_res = $conn->query("SELECT id, role FROM users WHERE email = '$email'");
$currentUser = $user_res->fetch_assoc();
$current_user_id = $currentUser ? (int)$currentUser['id'] : 0;
$current_user_role = $currentUser ? $currentUser['role'] : 'user';

// Determine dashboard redirect URL
$dashboard_url = ($current_user_role === 'admin') ? 'admin_page.php' : 'user_page.php';

// Helper function to sanitize user input
function sanitize($conn, $data) {
    return mysqli_real_escape_string($conn, trim($data));
}

// --- HANDLE POST ACTIONS ---

// 1. Upload Artwork
if (isset($_POST['upload_art']) && isset($_FILES['image'])) {
    $art_title = sanitize($conn, $_POST['title']);
    $art_desc = sanitize($conn, $_POST['description']);
    
    $fileName = time() . "_" . $_FILES['image']['name'];
    $tmpName = $_FILES['image']['tmp_name'];
    $uploadDir = "uploads/";
    
    // Ensure uploads directory exists
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $filePath = $uploadDir . basename($fileName);
    $imageFileType = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $allowed = array("jpg", "jpeg", "png", "gif");
    
    if (in_array($imageFileType, $allowed)) {
        if (move_uploaded_file($tmpName, $filePath)) {
            $clean_title = !empty($art_title) ? preg_replace('/[^a-zA-Z0-9_\- ]/', '', $art_title) : pathinfo($_FILES['image']['name'], PATHINFO_FILENAME);
            
            $stmt = $conn->prepare("INSERT INTO images (file_path, image_name, image_path, description, user_id) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssi", $filePath, $clean_title, $filePath, $art_desc, $current_user_id);
            $stmt->execute();
            
            header("Location: home.php?upload=success");
            exit();
        } else {
            header("Location: home.php?upload=failed&reason=move_failed");
            exit();
        }
    } else {
        header("Location: home.php?upload=failed&reason=type_disallowed");
        exit();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Global Gallery - ArtVault</title>
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

        /* Gallery Grid Layout */
        .gallery-container {
            max-width: 1300px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .gallery-header {
            margin-bottom: 30px;
        }

        .gallery-header h2 {
            font-size: 28px;
            font-weight: 700;
        }

        .gallery-header p {
            color: var(--text-secondary);
            font-size: 15px;
            margin-top: 5px;
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 30px;
        }

        .art-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 16px;
            overflow: hidden;
            backdrop-filter: blur(10px);
            transition: transform 0.3s, border-color 0.3s;
            display: flex;
            flex-direction: column;
            cursor: pointer;
        }

        .art-card:hover {
            transform: translateY(-6px);
            border-color: rgba(168, 85, 247, 0.3);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .art-preview {
            width: 100%;
            height: 290px;
            overflow: hidden;
            background: #000;
        }

        .art-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .art-card:hover .art-preview img {
            transform: scale(1.06);
        }

        .art-details {
            padding: 20px;
            display: flex;
            flex-direction: column;
            flex: 1;
        }

        .art-title {
            font-size: 17px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .art-desc-preview {
            font-size: 13.5px;
            color: var(--text-secondary);
            margin-bottom: 15px;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            height: 38px;
        }

        .art-meta {
            margin-top: auto;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
        }

        .art-author {
            color: var(--accent-hover);
            font-weight: 600;
        }

        .art-date {
            color: var(--text-secondary);
        }

        .art-actions {
            display: flex;
            gap: 8px;
            margin-top: 15px;
        }

        .art-actions .btn {
            flex: 1;
            padding: 8px;
            font-size: 12px;
            border-radius: 6px;
        }

        /* Modal / Dialog styling */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(9, 9, 11, 0.8);
            backdrop-filter: blur(8px);
            z-index: 10000;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .modal.open {
            display: flex;
            opacity: 1;
        }

        .modal-content {
            background: rgba(24, 24, 27, 0.95);
            border: 1px solid var(--panel-border);
            width: 90%;
            max-width: 500px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transform: translateY(-30px);
            transition: transform 0.3s ease;
        }

        .modal.open .modal-content {
            transform: translateY(0);
        }

        .modal-header {
            padding: 20px 25px;
            border-bottom: 1px solid var(--panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h3 {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .close-modal {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 20px;
            cursor: pointer;
        }

        .close-modal:hover {
            color: var(--text-primary);
        }

        .modal-body {
            padding: 25px;
        }

        /* Form elements */
        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        .form-control {
            width: 100%;
            padding: 12px;
            background: var(--input-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            color: white;
            font-size: 15px;
            outline: none;
        }

        .form-control:focus {
            border-color: var(--accent);
        }

        /* File input upload wrapper */
        .file-upload-wrapper {
            position: relative;
            width: 100%;
            height: 120px;
            border: 2px dashed var(--panel-border);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s;
        }

        .file-upload-wrapper:hover {
            border-color: var(--accent);
            background: rgba(168, 85, 247, 0.02);
        }

        .file-upload-wrapper input[type="file"] {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            cursor: pointer;
        }

        /* Lightbox specific styling */
        .lightbox-content {
            background: rgba(24, 24, 27, 0.95);
            border: 1px solid var(--panel-border);
            width: 95%;
            max-width: 1600px;
            height: 85vh;
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6);
            transform: translateY(-30px);
            transition: transform 0.3s ease;
        }

        .modal.open .lightbox-content {
            transform: translateY(0);
        }

        .lightbox-img-wrapper {
            flex: 1.6;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            max-height: 100% !important;
            cursor: zoom-in;
            position: relative;
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .lightbox-img-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            max-height: 100% !important;
            user-select: none;
            -webkit-user-drag: none;
        }

        /* Fullscreen Image Zoom Mode */
        .lightbox-img-wrapper.fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            max-width: 100vw !important;
            max-height: 100vh !important;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.96);
            cursor: grab;
            overflow: hidden;
        }

        .lightbox-img-wrapper.fullscreen img {
            max-height: 100vh !important;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .zoom-indicator {
            position: absolute;
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.6);
            color: #fafafa;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            pointer-events: none;
            transition: opacity 0.3s;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .lightbox-img-wrapper.fullscreen .zoom-indicator {
            display: none;
        }

        .lightbox-info {
            flex: 1;
            padding: 50px;
            display: flex;
            flex-direction: column;
            border-left: 1px solid var(--panel-border);
            overflow-y: auto;
            height: 100%;
            max-height: 100% !important;
        }

        .lightbox-title {
            font-size: 34px;
            font-weight: 700;
            margin-bottom: 10px;
            color: var(--text-primary);
        }

        .lightbox-artist {
            font-size: 19px;
            font-weight: 600;
            color: var(--accent-hover);
            margin-bottom: 25px;
        }

        .lightbox-desc-title {
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            margin-bottom: 10px;
            font-weight: 600;
        }

        .lightbox-desc {
            font-size: 18px;
            line-height: 1.7;
            color: var(--text-primary);
            margin-bottom: 30px;
            white-space: pre-wrap;
        }

        .lightbox-meta {
            margin-top: auto;
            padding-top: 25px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 15px;
            color: var(--text-secondary);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        /* Responsive Layouts */
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
            .lightbox-content {
                flex-direction: column;
            }
            .lightbox-info {
                border-left: none;
                border-top: 1px solid var(--panel-border);
            }
        }
    </style>
</head>
<body>

    <!-- Navbar -->
    <header class="navbar">
        <a href="home.php" class="nav-logo">
            🎨 <span>ArtVault</span> Gallery
        </a>

        <!-- Search Engine Form -->
        <form action="home.php" method="GET" class="search-form">
            <input type="text" name="search" class="search-input" placeholder="Search by title, description, or artist..." value="<?= isset($_GET['search']) ? htmlspecialchars($_GET['search']) : '' ?>">
            <button type="submit" class="btn btn-secondary" style="padding: 10px 14px;">🔍</button>
        </form>

        <div class="nav-actions">
            <a href="profiles.php" class="btn btn-secondary">
                👥 Artists
            </a>
            <button class="btn btn-primary" onclick="openModal('uploadModal')">
                📤 Post Image
            </button>
            <a href="<?= $dashboard_url ?>" class="btn btn-secondary">
                🛡️ Dashboard
            </a>
            <a href="logout.php" class="btn btn-danger">
                Logout
            </a>
        </div>
    </header>

    <!-- Main Container -->
    <main class="gallery-container">
        
        <div class="gallery-header">
            <?php if (isset($_GET['search']) && !empty($_GET['search'])): ?>
                <h2>🔍 Search Results</h2>
                <p>Displaying results for "<strong><?= htmlspecialchars($_GET['search']) ?></strong>"</p>
            <?php else: ?>
                <h2>🌟 Global Showcase</h2>
                <p>Explore creative artworks published by our artists</p>
            <?php endif; ?>
        </div>

        <!-- Success/Error Banners -->
        <?php if (isset($_GET['upload'])): ?>
            <div style="margin-bottom: 25px; padding: 12px 18px; border-radius: 8px; font-weight: 500; text-align: left;
                <?= $_GET['upload'] == 'success' ? 'background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.2); color: #34d399;' : 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171;' ?>">
                <?= $_GET['upload'] == 'success' ? '✅ Image published successfully!' : '❌ Failed to upload image. Make sure file type is valid (PNG/JPG/JPEG/GIF).' ?>
            </div>
        <?php endif; ?>

        <!-- Art Grid -->
        <div class="gallery-grid">
            <?php
            $search = isset($_GET['search']) ? sanitize($conn, $_GET['search']) : '';
            
            if (!empty($search)) {
                $query = "SELECT images.*, users.name as artist_name, users.username as artist_username, users.profile_pic as artist_profile_pic 
                          FROM images 
                          LEFT JOIN users ON images.user_id = users.id 
                          WHERE images.image_name LIKE '%$search%' 
                             OR images.description LIKE '%$search%' 
                             OR users.name LIKE '%$search%' 
                             OR users.username LIKE '%$search%' 
                          ORDER BY images.id DESC";
            } else {
                $query = "SELECT images.*, users.name as artist_name, users.username as artist_username, users.profile_pic as artist_profile_pic 
                          FROM images 
                          LEFT JOIN users ON images.user_id = users.id 
                          ORDER BY images.id DESC";
            }
            
            $result = $conn->query($query);

            if ($result->num_rows == 0):
            ?>
                <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: var(--text-secondary);">
                    <span style="font-size: 48px;">🔍</span>
                    <h4 style="margin-top: 15px;">No Artworks Found</h4>
                    <p style="margin-top: 5px;">Try refining your query or search term.</p>
                </div>
            <?php
            else:
                while ($row = $result->fetch_assoc()):
                    $filename = basename($row['file_path']);
                    $title = !empty($row['image_name']) ? $row['image_name'] : str_replace('_', ' ', pathinfo($filename, PATHINFO_FILENAME));
                    $artist = !empty($row['artist_name']) ? $row['artist_name'] : 'Unknown Artist';
                    $username = !empty($row['artist_username']) ? '@' . $row['artist_username'] : 'guest';
                    $date = date("F j, Y, g:i A", strtotime($row['created_at']));
                    $description = $row['description'];
                    
                    // Show delete action to admins OR the owner of the image
                    $can_delete = ($current_user_role === 'admin' || (int)$row['user_id'] === $current_user_id);
            ?>
                <div class="art-card" onclick="openLightbox(
                    '<?= $row['id'] ?>',
                    '<?= $row['user_id'] ?>',
                    '<?= htmlspecialchars($row['file_path'], ENT_QUOTES) ?>', 
                    '<?= htmlspecialchars($title, ENT_QUOTES) ?>', 
                    '<?= htmlspecialchars($description ?? '', ENT_QUOTES) ?>', 
                    '<?= htmlspecialchars($artist, ENT_QUOTES) ?> (<?= htmlspecialchars($username, ENT_QUOTES) ?>)', 
                    '<?= htmlspecialchars($date, ENT_QUOTES) ?>'
                )">
                    <div class="art-preview">
                        <img src="<?= htmlspecialchars($row['file_path']) ?>" alt="Artwork">
                    </div>
                    <div class="art-details">
                        <div class="art-title" title="<?= htmlspecialchars($title) ?>">
                            <?= htmlspecialchars($title) ?>
                        </div>
                        <div class="art-desc-preview">
                            <?= !empty($description) ? htmlspecialchars($description) : 'No description provided.' ?>
                        </div>
                        
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

                        <!-- Actions block -->
                        <div class="art-actions" onclick="event.stopPropagation();">
                            <a href="<?= htmlspecialchars($row['file_path']) ?>" download class="btn btn-secondary">
                                💾 Download
                            </a>
                            <?php if ($can_delete): ?>
                                <a href="delete.php?id=<?= $row['id'] ?>" onclick="return confirm('Delete this image?')" class="btn btn-danger">
                                    🗑️ Delete
                                </a>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php
                endwhile;
            endif;
            ?>
        </div>
    </main>

    <!-- ================= POST / UPLOAD IMAGE MODAL ================= -->
    <div id="uploadModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>📤 Post New Artwork</h3>
                <button class="close-modal" onclick="closeModal('uploadModal')">✕</button>
            </div>
            <div class="modal-body">
                <form action="home.php" method="post" enctype="multipart/form-data">
                    <input type="hidden" name="upload_art" value="1">
                    
                    <div class="form-group">
                        <label for="art_title">Artwork Title</label>
                        <input type="text" id="art_title" name="title" class="form-control" placeholder="e.g. Starry Night" required>
                    </div>

                    <div class="form-group">
                        <label for="art_desc">Description / Story</label>
                        <textarea id="art_desc" name="description" class="form-control" style="height: 100px; resize: vertical;" placeholder="Tell the showcase community about your artwork..."></textarea>
                    </div>

                    <div class="form-group">
                        <label>Select Artwork Image</label>
                        <div class="file-upload-wrapper">
                            <span style="font-size: 24px; margin-bottom: 5px;">📁</span>
                            <span id="fileNameDisplay" style="font-size: 13px; color: var(--text-secondary);">Click to choose file</span>
                            <input type="file" name="image" required onchange="handleFileChange(this)">
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('uploadModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Publish Showcase</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ================= LIGHTBOX / DETAILS MODAL ================= -->
    <div id="lightbox-modal" class="modal" onclick="closeLightbox()">
        <div class="lightbox-content" onclick="event.stopPropagation();">
            <div class="lightbox-img-wrapper" onclick="toggleImageZoom(event)">
                <img id="lightbox-img" src="" alt="Artwork Enlarged">
                <div class="zoom-indicator">🔍 Click Image to Zoom</div>
            </div>
            <div class="lightbox-info">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <h2 id="lightbox-title" class="lightbox-title">Artwork Title</h2>
                    <button class="close-modal" onclick="closeLightbox()" style="font-size: 24px; padding: 0;">✕</button>
                </div>
                <div id="lightbox-artist" class="lightbox-artist">By Artist Name</div>
                
                <div class="lightbox-desc-title">Description</div>
                <div id="lightbox-desc-container" style="display: flex; flex-direction: column;">
                    <div id="lightbox-desc" class="lightbox-desc">Full description of the artwork.</div>
                    <button id="edit-desc-btn" class="btn btn-secondary" style="display: none; margin-top: -15px; margin-bottom: 20px; align-self: flex-start; padding: 6px 12px; font-size: 13px;" onclick="startEditDescription()">📝 Edit Description</button>
                </div>

                <div id="lightbox-desc-edit-form" style="display: none; flex-direction: column; gap: 10px; margin-bottom: 30px;">
                    <textarea id="lightbox-desc-textarea" class="form-control" style="height: 120px; resize: vertical; background: var(--input-bg); border: 1px solid var(--panel-border); color: white; padding: 10px; border-radius: 8px; outline: none;"></textarea>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="cancelEditDescription()">Cancel</button>
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;" onclick="saveDescription()">Save Changes</button>
                    </div>
                </div>
                
                <div class="lightbox-meta">
                    <span id="lightbox-date">Published on: May 20, 2026</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Modal management
        function openModal(id) {
            document.getElementById(id).classList.add('open');
        }

        function closeModal(id) {
            document.getElementById(id).classList.remove('open');
        }

        function handleFileChange(input) {
            const display = document.getElementById('fileNameDisplay');
            if (input.files && input.files[0]) {
                display.textContent = input.files[0].name;
                display.style.color = 'var(--accent-hover)';
            } else {
                display.textContent = 'Click to choose file';
                display.style.color = 'var(--text-secondary)';
            }
        }

        // User identity context for JS authorization checks
        const currentUserId = <?= (int)$current_user_id ?>;
        const currentUserRole = '<?= $current_user_role ?>';
        let activeImageId = null;

        // Lightbox management
        function openLightbox(id, ownerId, src, title, description, artist, date) {
            activeImageId = id;
            document.getElementById('lightbox-img').src = src;
            document.getElementById('lightbox-title').textContent = title;
            
            const descElement = document.getElementById('lightbox-desc');
            const descVal = description || '';
            descElement.textContent = descVal || 'No description provided for this artwork.';
            document.getElementById('lightbox-desc-textarea').value = descVal;
            
            document.getElementById('lightbox-artist').textContent = 'By ' + artist;
            document.getElementById('lightbox-date').textContent = 'Published: ' + date;
            
            // Show/Hide Edit button based on role or ownership
            const editBtn = document.getElementById('edit-desc-btn');
            if (currentUserRole === 'admin' || currentUserId === parseInt(ownerId)) {
                editBtn.style.display = 'inline-flex';
            } else {
                editBtn.style.display = 'none';
            }
            
            cancelEditDescription();
            openModal('lightbox-modal');
        }

        function startEditDescription() {
            document.getElementById('lightbox-desc-container').style.display = 'none';
            document.getElementById('lightbox-desc-edit-form').style.display = 'flex';
            document.getElementById('lightbox-desc-textarea').focus();
        }

        function cancelEditDescription() {
            document.getElementById('lightbox-desc-container').style.display = 'flex';
            document.getElementById('lightbox-desc-edit-form').style.display = 'none';
        }

        function saveDescription() {
            const newDesc = document.getElementById('lightbox-desc-textarea').value;
            
            const formData = new FormData();
            formData.append('image_id', activeImageId);
            formData.append('description', newDesc);
            
            fetch('edit_description.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    location.reload();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error saving description:', error);
                alert('An error occurred while saving the description.');
            });
        }

        // Zoom and Pan variables
        let isZoomed = false;
        let isDragging = false;
        let startX = 0, startY = 0;
        let currentTranslateX = 0, currentTranslateY = 0;
        let startTranslateX = 0, startTranslateY = 0;
        let hasDragged = false;

        const lightboxWrapper = document.querySelector('.lightbox-img-wrapper');
        const lightboxImg = document.getElementById('lightbox-img');

        function resetZoom() {
            isZoomed = false;
            isDragging = false;
            currentTranslateX = 0;
            currentTranslateY = 0;
            if (lightboxImg) {
                lightboxImg.style.transform = 'none';
                lightboxImg.style.cursor = 'zoom-in';
            }
            if (lightboxWrapper) {
                lightboxWrapper.classList.remove('fullscreen');
            }
        }

        function closeLightbox() {
            closeModal('lightbox-modal');
            resetZoom();
        }

        function toggleImageZoom(e) {
            e.stopPropagation();
            if (isZoomed) {
                if (hasDragged) {
                    hasDragged = false;
                    return;
                }
                resetZoom();
            } else {
                isZoomed = true;
                if (lightboxWrapper) {
                    lightboxWrapper.classList.add('fullscreen');
                }
                if (lightboxImg) {
                    lightboxImg.style.transform = 'scale(2.5) translate(0px, 0px)';
                    lightboxImg.style.cursor = 'grab';
                }
            }
        }

        // Mouse pan event handlers
        if (lightboxWrapper && lightboxImg) {
            lightboxWrapper.addEventListener('mousedown', (e) => {
                if (!isZoomed) return;
                if (e.button !== 0) return; // Left mouse click only
                e.preventDefault();
                isDragging = true;
                hasDragged = false;
                startX = e.clientX;
                startY = e.clientY;
                startTranslateX = currentTranslateX;
                startTranslateY = currentTranslateY;
                lightboxImg.style.cursor = 'grabbing';
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.hypot(dx, dy) > 5) {
                    hasDragged = true;
                }
                currentTranslateX = startTranslateX + dx;
                currentTranslateY = startTranslateY + dy;
                // Move image smoothly by correcting for scale factor
                lightboxImg.style.transform = `scale(2.5) translate(${currentTranslateX / 2.5}px, ${currentTranslateY / 2.5}px)`;
            });

            window.addEventListener('mouseup', (e) => {
                if (!isDragging) return;
                isDragging = false;
                lightboxImg.style.cursor = 'grab';
            });
        }

        // Close modals on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal('uploadModal');
                closeLightbox();
            }
        });
    </script>

</body>
</html>