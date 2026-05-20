<?php
session_start();
require_once 'config.php';

/* 🔒 Protect page (must be logged in as user/artist) */
if (!isset($_SESSION['email']) || !isset($_SESSION['user_id'])) {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$user_id = (int)$_SESSION['user_id'];

// Fetch latest user details from database
$result = $conn->query("SELECT * FROM users WHERE id = $user_id");
$currentUser = $result->fetch_assoc();

if (!$currentUser) {
    header("Location: logout.php");
    exit();
}

// Security: If admin somehow reaches user_page, redirect to admin_page
if ($currentUser['role'] === 'admin') {
    header("Location: admin_page.php");
    exit();
}

// Helper function to sanitize user input
function sanitize($conn, $data) {
    return mysqli_real_escape_string($conn, trim($data));
}

// --- HANDLE POST ACTIONS ---

// 1. Upload Artwork
if (isset($_POST['upload_art']) && isset($_FILES['image'])) {
    $art_title = sanitize($conn, $_POST['title']);
    
    $fileName = time() . "_" . $_FILES['image']['name'];
    $tmpName = $_FILES['image']['tmp_name'];
    $uploadDir = "uploads/";
    
    // Ensure directory exists
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $filePath = $uploadDir . basename($fileName);
    
    // Allowed file types
    $imageFileType = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $allowed = array("jpg", "jpeg", "png", "gif");
    
    if (in_array($imageFileType, $allowed)) {
        if (move_uploaded_file($tmpName, $filePath)) {
            // Clean title for database
            $clean_title = !empty($art_title) ? preg_replace('/[^a-zA-Z0-9_\- ]/', '', $art_title) : pathinfo($_FILES['image']['name'], PATHINFO_FILENAME);
            
            $stmt = $conn->prepare("INSERT INTO images (file_path, image_name, image_path, user_id) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("sssi", $filePath, $clean_title, $filePath, $user_id);
            $stmt->execute();
            
            header("Location: user_page.php?action=upload_success");
            exit();
        } else {
            header("Location: user_page.php?action=error&message=Failed to move uploaded file.");
            exit();
        }
    } else {
        header("Location: user_page.php?action=error&message=Only JPG, JPEG, PNG, and GIF files are allowed.");
        exit();
    }
}

// 2. Delete Artwork (Only their own)
if (isset($_POST['delete_art'])) {
    $image_id = (int)$_POST['image_id'];
    
    // Fetch and check owner
    $stmt = $conn->prepare("SELECT file_path, user_id FROM images WHERE id = ?");
    $stmt->bind_param("i", $image_id);
    $stmt->execute();
    $image = $stmt->get_result()->fetch_assoc();
    
    if ($image) {
        if ((int)$image['user_id'] === $user_id) {
            // Delete physical file
            if (file_exists($image['file_path'])) {
                unlink($image['file_path']);
            }
            
            // Delete db entry
            $del_stmt = $conn->prepare("DELETE FROM images WHERE id = ?");
            $del_stmt->bind_param("i", $image_id);
            $del_stmt->execute();
            
            header("Location: user_page.php?action=delete_success");
            exit();
        } else {
            header("Location: user_page.php?action=error&message=Unauthorized action.");
            exit();
        }
    } else {
        header("Location: user_page.php?action=error&message=Artwork not found.");
        exit();
    }
}

// 3. Rename Artwork (Only their own)
if (isset($_POST['rename_art'])) {
    $image_id = (int)$_POST['image_id'];
    $new_title = trim($_POST['new_title']);
    
    // Fetch and check owner
    $stmt = $conn->prepare("SELECT file_path, user_id FROM images WHERE id = ?");
    $stmt->bind_param("i", $image_id);
    $stmt->execute();
    $image = $stmt->get_result()->fetch_assoc();
    
    if ($image) {
        if ((int)$image['user_id'] === $user_id) {
            $old_path = $image['file_path'];
            $ext = strtolower(pathinfo($old_path, PATHINFO_EXTENSION));
            
            // Clean title
            $new_title_clean = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $new_title);
            $new_filename = time() . "_" . $new_title_clean . "." . $ext;
            $new_path = "uploads/" . $new_filename;
            
            if (file_exists($old_path)) {
                if (rename($old_path, $new_path)) {
                    $upd_stmt = $conn->prepare("UPDATE images SET file_path = ?, image_path = ?, image_name = ? WHERE id = ?");
                    $upd_stmt->bind_param("sssi", $new_path, $new_path, $new_title_clean, $image_id);
                    $upd_stmt->execute();
                    header("Location: user_page.php?action=rename_success");
                    exit();
                } else {
                    header("Location: user_page.php?action=error&message=Failed to physically rename the artwork file.");
                    exit();
                }
            } else {
                // Update db anyway if physical file is missing
                $upd_stmt = $conn->prepare("UPDATE images SET file_path = ?, image_path = ?, image_name = ? WHERE id = ?");
                $upd_stmt->bind_param("sssi", $new_path, $new_path, $new_title_clean, $image_id);
                $upd_stmt->execute();
                header("Location: user_page.php?action=rename_success");
                exit();
            }
        } else {
            header("Location: user_page.php?action=error&message=Unauthorized action.");
            exit();
        }
    } else {
        header("Location: user_page.php?action=error&message=Artwork not found.");
        exit();
    }
}

// 4. Update Profile Settings
if (isset($_POST['update_profile'])) {
    $prof_name = sanitize($conn, $_POST['name']);
    $prof_username = sanitize($conn, $_POST['username']);
    $prof_email = sanitize($conn, $_POST['email']);
    $prof_pass = $_POST['password'];
    
    // Check constraints
    $check_email = $conn->query("SELECT id FROM users WHERE email = '$prof_email' AND id != $user_id");
    if ($check_email->num_rows > 0) {
        header("Location: user_page.php?action=error&message=Email is already in use!");
        exit();
    }
    
    $check_user = $conn->query("SELECT id FROM users WHERE username = '$prof_username' AND id != $user_id");
    if ($check_user->num_rows > 0) {
        header("Location: user_page.php?action=error&message=Username is already in use!");
        exit();
    }
    
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
                    // Delete old profile picture if not default
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
    
    if (!empty($prof_pass)) {
        $hashed_pass = password_hash($prof_pass, PASSWORD_DEFAULT);
        if ($profile_pic_path) {
            $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, password = ?, profile_pic = ? WHERE id = ?");
            $stmt->bind_param("sssssi", $prof_name, $prof_username, $prof_email, $hashed_pass, $profile_pic_path, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, password = ? WHERE id = ?");
            $stmt->bind_param("ssssi", $prof_name, $prof_username, $prof_email, $hashed_pass, $user_id);
        }
    } else {
        if ($profile_pic_path) {
            $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, profile_pic = ? WHERE id = ?");
            $stmt->bind_param("ssssi", $prof_name, $prof_username, $prof_email, $profile_pic_path, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ? WHERE id = ?");
            $stmt->bind_param("sssi", $prof_name, $prof_username, $prof_email, $user_id);
        }
    }
    
    $stmt->execute();
    
    $_SESSION['name'] = $prof_name;
    $_SESSION['email'] = $prof_email;
    
    header("Location: user_page.php?action=profile_success");
    exit();
}



// --- FETCH DATA FOR DASHBOARD ---

// Fetch user's artworks
$stmt = $conn->prepare("SELECT * FROM images WHERE user_id = ? ORDER BY id DESC");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$artworks = $stmt->get_result();

// Get counts
$total_artworks = $artworks->num_rows;

// Get latest creation title
$latest_creation = "None";
if ($total_artworks > 0) {
    $artworks->data_seek(0);
    $latest = $artworks->fetch_assoc();
    $latest_creation = !empty($latest['image_name']) ? $latest['image_name'] : basename($latest['file_path']);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artist Dashboard - ArtVault Studio</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #09090b 0%, #180828 100%);
            --panel-bg: rgba(24, 24, 27, 0.7);
            --panel-border: rgba(255, 255, 255, 0.08);
            --text-primary: #fafafa;
            --text-secondary: #a1a1aa;
            --accent: #a855f7;
            --accent-hover: #c084fc;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
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
            display: flex;
            overflow-x: hidden;
        }

        /* Sidebar Navigation */
        .sidebar {
            width: 280px;
            background: rgba(9, 9, 11, 0.85);
            border-right: 1px solid var(--panel-border);
            padding: 30px 20px;
            display: flex;
            flex-direction: column;
            position: fixed;
            height: 100vh;
            z-index: 100;
            backdrop-filter: blur(10px);
        }

        .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 40px;
            padding-left: 10px;
        }

        .sidebar-logo span {
            color: var(--accent);
        }

        .sidebar-menu {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .tab-btn {
            display: flex;
            align-items: center;
            gap: 15px;
            width: 100%;
            padding: 14px 18px;
            background: transparent;
            border: none;
            border-radius: 12px;
            color: var(--text-secondary);
            font-size: 16px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .tab-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
        }

        .tab-btn.active {
            background: var(--accent);
            color: var(--text-primary);
            box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
        }

        .sidebar-footer {
            margin-top: auto;
            border-top: 1px solid var(--panel-border);
            padding-top: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .user-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 5px 10px;
        }

        .user-avatar {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #c084fc, #fda4af);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            color: white;
        }

        .user-details {
            display: flex;
            flex-direction: column;
        }

        .user-details .user-name {
            font-weight: 600;
            font-size: 15px;
            color: var(--text-primary);
        }

        .user-details .user-role {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .logout-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px;
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
        }

        .logout-link:hover {
            background: var(--danger);
            color: white;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
        }

        /* Main Content Container */
        .main-content {
            margin-left: 280px;
            flex: 1;
            padding: 40px;
            min-height: 100vh;
        }

        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 35px;
        }

        .dashboard-title h2 {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-primary);
            text-align: left;
            margin-bottom: 5px;
        }

        .dashboard-title p {
            font-size: 15px;
            color: var(--text-secondary);
            text-align: left;
            margin-bottom: 0;
        }

        /* Alerts */
        .alert-box {
            padding: 15px 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.4s ease-out;
        }

        .alert-box.success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #34d399;
        }

        .alert-box.error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #f87171;
        }

        @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        /* Stats Cards */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            padding: 25px;
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            backdrop-filter: blur(10px);
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            border-color: rgba(168, 85, 247, 0.2);
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .stat-title {
            font-size: 14px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-icon {
            font-size: 22px;
            background: rgba(255, 255, 255, 0.05);
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .stat-gauge {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            overflow: hidden;
        }

        .stat-gauge-fill {
            height: 100%;
            background: var(--accent);
            border-radius: 10px;
        }

        /* Tab Contents */
        .tab-content {
            display: none;
            animation: fadeIn 0.4s ease;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Section Layouts */
        .content-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }

        .content-card h3 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* Buttons styling */
        .btn {
            padding: 10px 20px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            margin-bottom: 0;
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
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .btn-danger:hover {
            background: var(--danger);
            color: white;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
            border-radius: 6px;
        }

        /* Search Controls */
        .controls-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            flex-wrap: wrap;
            gap: 15px;
        }

        .search-wrapper {
            position: relative;
            min-width: 300px;
        }

        .search-input {
            width: 100%;
            padding: 12px 15px;
            padding-left: 40px;
            background: var(--input-bg);
            border: 1px solid var(--panel-border);
            border-radius: 10px;
            color: white;
            font-size: 14px;
            outline: none;
            transition: all 0.3s;
            margin-bottom: 0;
        }

        .search-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
        }

        .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            pointer-events: none;
        }

        /* Image Gallery Grid */
        .image-gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 25px;
        }

        .image-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 16px;
            overflow: hidden;
            backdrop-filter: blur(10px);
            transition: transform 0.3s, border-color 0.3s;
            position: relative;
        }

        .image-card:hover {
            transform: translateY(-5px);
            border-color: rgba(168, 85, 247, 0.3);
        }

        .image-preview {
            width: 100%;
            height: 180px;
            overflow: hidden;
            position: relative;
            background: #000;
        }

        .image-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .image-card:hover .image-preview img {
            transform: scale(1.08);
        }

        .image-details {
            padding: 15px;
        }

        .image-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .image-meta {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .image-card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        /* Modal styling */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(9, 9, 11, 0.75);
            backdrop-filter: blur(8px);
            z-index: 1000;
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
            max-width: 480px;
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
            width: auto;
            margin-bottom: 0;
            padding: 0;
        }

        .close-modal:hover {
            color: var(--text-primary);
        }

        .modal-body {
            padding: 25px;
        }

        /* Forms Styling */
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
            margin-bottom: 0;
        }

        .form-control:focus {
            border-color: var(--accent);
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        /* Drag-drop or File upload area */
        .file-upload-wrapper {
            position: relative;
            width: 100%;
            height: 150px;
            border: 2px dashed var(--panel-border);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s;
            background: rgba(255,255,255,0.01);
        }

        .file-upload-wrapper:hover {
            border-color: var(--accent);
            background: rgba(168, 85, 247, 0.03);
        }

        .file-upload-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .file-upload-text {
            font-size: 14px;
            color: var(--text-secondary);
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

        /* Responsive */
        @media (max-width: 992px) {
            body {
                flex-direction: column;
            }
            .sidebar {
                width: 100%;
                height: auto;
                position: relative;
                padding: 20px;
            }
            .main-content {
                margin-left: 0;
                padding: 20px;
            }
        }
    </style>
</head>
<body>

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-logo">
            🎨 <span>ArtVault</span> Studio
        </div>

        <nav style="flex: 1;">
            <ul class="sidebar-menu">
                <li>
                    <button class="tab-btn active" onclick="showTab('studio', this)">
                        🎨 Studio Gallery
                    </button>
                </li>
                <li>
                    <button class="tab-btn" onclick="showTab('settings', this)">
                        ⚙️ Studio Settings
                    </button>
                </li>
                <li>
                    <a href="profiles.php" class="tab-btn" style="text-decoration: none;">
                        👥 Artists Directory
                    </a>
                </li>
                <li>
                    <a href="home.php" class="tab-btn" style="text-decoration: none;">
                        🌐 Global Gallery
                    </a>
                </li>
            </ul>
        </nav>

        <div class="sidebar-footer">
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
            <a href="logout.php" class="logout-link">
                🔐 Logout
            </a>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
        
        <!-- Header -->
        <div class="dashboard-header">
            <div class="dashboard-title">
                <h2 id="tab-title-text">Studio Gallery</h2>
                <p>Manage and display your creative artworks</p>
            </div>
            <div class="dashboard-actions">
                <button class="btn btn-primary" onclick="openModal('uploadArtModal')">
                    📤 Upload New Art
                </button>
            </div>
        </div>

        <!-- Alert messages -->
        <?php if (isset($_GET['action'])): ?>
            <?php if ($_GET['action'] == 'error' && isset($_GET['message'])): ?>
                <div class="alert-box error">
                    ❌ <?= htmlspecialchars($_GET['message']); ?>
                </div>
            <?php else: ?>
                <div class="alert-box success">
                    <?php
                    switch($_GET['action']) {
                        case 'upload_success':
                            echo "✅ Artwork uploaded successfully to your Studio!";
                            break;
                        case 'delete_success':
                            echo "✅ Artwork removed successfully.";
                            break;
                        case 'rename_success':
                            echo "✅ Artwork renamed physically and updated in database.";
                            break;
                        case 'profile_success':
                            echo "✅ Your profile and studio settings were updated.";
                            break;
                    }
                    ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <!-- Statistics Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">My Creations</span>
                    <span class="stat-icon">🎨</span>
                </div>
                <div class="stat-number"><?= $total_artworks ?></div>
                <div class="stat-gauge">
                    <div class="stat-gauge-fill" style="width: 100%;"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">Latest Artwork</span>
                    <span class="stat-icon">🖼️</span>
                </div>
                <div class="stat-number" title="<?= htmlspecialchars($latest_creation) ?>">
                    <?= htmlspecialchars($latest_creation) ?>
                </div>
                <div class="stat-gauge">
                    <div class="stat-gauge-fill" style="width: 100%; background: var(--accent);"></div>
                </div>
            </div>
        </div>

        <!-- ================= STUDIO GALLERY TAB ================= -->
        <div id="studio" class="tab-content active">
            <div class="content-card">
                <div class="controls-header">
                    <h3>🖼️ Studio Artworks</h3>
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="searchArt" class="search-input" placeholder="Search by ID or filename..." oninput="filterArtGrid()">
                    </div>
                </div>

                <?php if ($total_artworks == 0): ?>
                    <div style="text-align: center; padding: 60px 20px;">
                        <span style="font-size: 48px;">🎨</span>
                        <h4 style="margin-top: 15px; margin-bottom: 8px;">Your Studio is Empty</h4>
                        <p style="color: var(--text-secondary); margin-bottom: 25px;">Upload your very first artwork to showcase it in the gallery.</p>
                        <button class="btn btn-primary" onclick="openModal('uploadArtModal')">
                            📤 Upload Artwork
                        </button>
                    </div>
                <?php else: ?>
                    <div class="image-gallery-grid" id="artGrid">
                        <?php 
                        $artworks->data_seek(0);
                        while ($img = $artworks->fetch_assoc()): 
                            $filename = basename($img['file_path']);
                            $custom_name = !empty($img['image_name']) ? $img['image_name'] : str_replace('_', ' ', pathinfo($filename, PATHINFO_FILENAME));
                        ?>
                        <div class="image-card" data-search="<?= htmlspecialchars($img['id']) ?> <?= htmlspecialchars($filename) ?> <?= htmlspecialchars($custom_name) ?>">
                            <div class="image-preview">
                                <img src="<?= htmlspecialchars($img['file_path']) ?>" alt="Artwork">
                            </div>
                            <div class="image-details">
                                <div class="image-title" title="<?= htmlspecialchars($custom_name) ?>">
                                    <?= htmlspecialchars($custom_name) ?>
                                </div>
                                <div class="image-meta">
                                    <span><strong>ID:</strong> <?= $img['id'] ?></span>
                                    <span style="word-break: break-all;"><strong>File:</strong> <?= htmlspecialchars($filename) ?></span>
                                </div>
                                <div class="image-card-actions">
                                    <button class="btn btn-secondary btn-sm" onclick="openRenameArtModal(<?= $img['id'] ?>, '<?= htmlspecialchars($custom_name, ENT_QUOTES) ?>')">
                                        ✏️ Rename
                                    </button>
                                    <form method="post" onsubmit="return confirm('Permanently remove this artwork?')" style="display: inline;">
                                        <input type="hidden" name="image_id" value="<?= $img['id'] ?>">
                                        <button type="submit" name="delete_art" class="btn btn-danger btn-sm" style="width: 100%;">
                                            🗑️ Delete
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <?php endwhile; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- ================= SETTINGS TAB ================= -->
        <div id="settings" class="tab-content">
            <div class="content-card" style="max-width: 600px; margin: 0 auto;">
                <h3>⚙️ Profile & Studio Settings</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; text-align: left;">Modify your public artist details and credentials.</p>
                
                <form method="post" enctype="multipart/form-data">
                    <div class="form-group" style="text-align: center; margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600;">Profile Picture</label>
                        <div style="position: relative; display: inline-block;">
                            <img src="<?= !empty($currentUser['profile_pic']) ? htmlspecialchars($currentUser['profile_pic']) : 'uploads/default_avatar.svg' ?>" alt="Profile Picture" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--accent); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                        </div>
                        <div style="margin-top: 12px;">
                            <input type="file" name="profile_pic" accept="image/*" class="form-control" style="max-width: 300px; margin: 0 auto; font-size: 13px;">
                            <small style="color: var(--text-secondary); display: block; margin-top: 5px;">Supports: PNG, JPG, JPEG, GIF, SVG (Max 2MB)</small>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="prof_name">Artist / Display Name</label>
                        <input type="text" id="prof_name" name="name" class="form-control" value="<?= htmlspecialchars($currentUser['name']) ?>" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="prof_username">Username</label>
                            <input type="text" id="prof_username" name="username" class="form-control" value="<?= htmlspecialchars($currentUser['username']) ?>" required>
                        </div>
                        <div class="form-group">
                            <label for="prof_email">Email Address</label>
                            <input type="email" id="prof_email" name="email" class="form-control" value="<?= htmlspecialchars($currentUser['email']) ?>" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="prof_pass">Update Password <small style="color: var(--text-secondary); font-weight: normal;">(leave blank to keep current)</small></label>
                        <input type="password" id="prof_pass" name="password" class="form-control" placeholder="Enter new password">
                    </div>

                    <div style="text-align: right; margin-top: 10px;">
                        <button type="submit" name="update_profile" class="btn btn-primary">
                            💾 Save Settings
                        </button>
                    </div>
                </form>
            </div>
        </div>

    </main>

    <!-- ================= UPLOAD ART MODAL ================= -->
    <div id="uploadArtModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>📤 Upload New Artwork</h3>
                <button class="close-modal" onclick="closeModal('uploadArtModal')">✕</button>
            </div>
            <div class="modal-body">
                <form method="post" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Artwork Title</label>
                        <input type="text" name="title" class="form-control" placeholder="e.g. Starry Night Over the Rhone" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Select Image File</label>
                        <div class="file-upload-wrapper">
                            <span class="file-upload-icon">📁</span>
                            <span class="file-upload-text" id="fileNameDisplay">Choose a file or drag it here</span>
                            <span style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Supports: PNG, JPG, JPEG, GIF</span>
                            <input type="file" name="image" id="artFileInput" required onchange="handleFileSelected(this)">
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('uploadArtModal')">Cancel</button>
                        <button type="submit" name="upload_art" class="btn btn-primary">Upload Creation</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ================= RENAME ARTWORK MODAL ================= -->
    <div id="renameArtModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>✏️ Rename Artwork</h3>
                <button class="close-modal" onclick="closeModal('renameArtModal')">✕</button>
            </div>
            <div class="modal-body">
                <form method="post">
                    <input type="hidden" name="image_id" id="rename_image_id">
                    <div class="form-group">
                        <label>New Artwork Title</label>
                        <input type="text" name="new_title" id="rename_image_title" class="form-control" required placeholder="e.g. starry_night">
                        <small style="color: var(--text-secondary); margin-top: 5px; display: block;">The physical filename on the server will be updated automatically while preserving the file extension.</small>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('renameArtModal')">Cancel</button>
                        <button type="submit" name="rename_art" class="btn btn-primary">Rename</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- JavaScript logic -->
    <script>
        // Modal management
        function openModal(id) {
            const modal = document.getElementById(id);
            modal.classList.add('open');
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            modal.classList.remove('open');
        }

        // Close modal when clicking outside contents
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('open');
            }
        });

        // Trigger rename artwork modal
        function openRenameArtModal(id, title) {
            document.getElementById('rename_image_id').value = id;
            document.getElementById('rename_image_title').value = title;
            openModal('renameArtModal');
        }

        // Display selected filename in upload box
        function handleFileSelected(input) {
            const display = document.getElementById('fileNameDisplay');
            if (input.files && input.files[0]) {
                display.textContent = input.files[0].name;
                display.style.color = 'var(--accent-hover)';
            } else {
                display.textContent = 'Choose a file or drag it here';
                display.style.color = 'var(--text-secondary)';
            }
        }

        // Tab selection with persistence
        function showTab(tabId, btn) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            // Deactivate all sidebar tab buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            
            // Show selected tab and activate button
            document.getElementById(tabId).classList.add('active');
            btn.classList.add('active');
            
            // Update Title Text in Header
            const titleMap = {
                'studio': 'Studio Gallery',
                'settings': 'Studio Settings'
            };
            document.getElementById('tab-title-text').textContent = titleMap[tabId] || 'Artist Dashboard';
            
            // Save tab state to localStorage
            localStorage.setItem('activeArtistTab', tabId);
        }

        // Restore active tab from localStorage on DOM load
        document.addEventListener('DOMContentLoaded', () => {
            const savedTab = localStorage.getItem('activeArtistTab') || 'studio';
            const btn = document.querySelector(`.sidebar button[onclick*="${savedTab}"]`);
            if (btn) {
                showTab(savedTab, btn);
            }
        });

        // Client-side quick filter for Artworks Grid
        function filterArtGrid() {
            const query = document.getElementById('searchArt').value.toLowerCase();
            const cards = document.querySelectorAll('#artGrid .image-card');
            
            cards.forEach(card => {
                const searchData = card.getAttribute('data-search').toLowerCase();
                
                if (searchData.includes(query)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    </script>

</body>
</html>
