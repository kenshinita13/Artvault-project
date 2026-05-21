<?php
session_start();
require_once 'config.php';

/* 🔒 Protect page (must be logged in as admin) */
if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

// Check if user is admin
$email = $_SESSION['email'];
$result = $conn->query("SELECT * FROM users WHERE email = '$email'");
$currentUser = $result->fetch_assoc();

if (!$currentUser || $currentUser['role'] !== 'admin') {
    header("Location: user_page.php");
    exit();
}

$name = $_SESSION['name'];

// Helper function to sanitize user input
function sanitize($conn, $data) {
    return mysqli_real_escape_string($conn, trim($data));
}

// --- HANDLE POST ACTIONS ---

// 1. Delete User
if (isset($_POST['delete_user'])) {
    $user_id = (int)$_POST['user_id'];
    
    // Prevent self-deletion
    if ($user_id === (int)$currentUser['id']) {
        header("Location: admin_page.php?action=error&message=You cannot delete your own admin account!");
        exit();
    }
    
    $conn->query("DELETE FROM users WHERE id = $user_id AND role != 'admin'");
    header("Location: admin_page.php?action=user_deleted");
    exit();
}

// 2. Delete Image
if (isset($_POST['delete_image'])) {
    $image_id = (int)$_POST['image_id'];
    
    // Get file path before deleting from database
    $result = $conn->query("SELECT file_path FROM images WHERE id = $image_id");
    $image = $result->fetch_assoc();
    
    if ($image && file_exists($image['file_path'])) {
        unlink($image['file_path']); // Delete physical file
    }
    
    $conn->query("DELETE FROM images WHERE id = $image_id");
    header("Location: admin_page.php?action=image_deleted");
    exit();
}

// 3. Create User
if (isset($_POST['add_user'])) {
    $new_name = sanitize($conn, $_POST['name']);
    $new_username = sanitize($conn, $_POST['username']);
    $new_email = sanitize($conn, $_POST['email']);
    $new_password = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $new_role = sanitize($conn, $_POST['role']);
    
    // Check if email already exists
    $check_email = $conn->query("SELECT id FROM users WHERE email = '$new_email'");
    $check_username = $conn->query("SELECT id FROM users WHERE username = '$new_username'");
    
    if ($check_email->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Email is already registered!");
        exit();
    } elseif ($check_username->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Username is already taken!");
        exit();
    } else {
        $stmt = $conn->prepare("INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $new_name, $new_username, $new_email, $new_password, $new_role);
        $stmt->execute();
        header("Location: admin_page.php?action=user_added");
        exit();
    }
}

// 4. Edit User details (Name, Username, Email, Role)
if (isset($_POST['edit_user'])) {
    $user_id = (int)$_POST['user_id'];
    $edit_name = sanitize($conn, $_POST['name']);
    $edit_username = sanitize($conn, $_POST['username']);
    $edit_email = sanitize($conn, $_POST['email']);
    $edit_role = sanitize($conn, $_POST['role']);
    
    // Check email availability
    $check_email = $conn->query("SELECT id FROM users WHERE email = '$edit_email' AND id != $user_id");
    if ($check_email->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Email is already in use by another user!");
        exit();
    }
    
    // Check username availability
    $check_user = $conn->query("SELECT id FROM users WHERE username = '$edit_username' AND id != $user_id");
    if ($check_user->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Username is already in use by another user!");
        exit();
    }
    
    // If editing self and downgrade to user: prevent if it is the only admin
    if ($user_id === (int)$currentUser['id'] && $edit_role !== 'admin') {
        $admins = $conn->query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")->fetch_assoc()['count'];
        if ($admins <= 1) {
            header("Location: admin_page.php?action=error&message=Cannot change your own role. You are the only administrator left!");
            exit();
        }
    }
    
    $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, role = ? WHERE id = ?");
    $stmt->bind_param("ssssi", $edit_name, $edit_username, $edit_email, $edit_role, $user_id);
    $stmt->execute();
    
    // Update active session if editing logged-in admin
    if ($user_id === (int)$currentUser['id']) {
        $_SESSION['name'] = $edit_name;
        $_SESSION['email'] = $edit_email;
        $_SESSION['role'] = $edit_role;
    }
    
    header("Location: admin_page.php?action=user_updated");
    exit();
}

// 5. Change User Password
if (isset($_POST['change_password'])) {
    $user_id = (int)$_POST['user_id'];
    $new_password = password_hash($_POST['password'], PASSWORD_DEFAULT);
    
    $stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->bind_param("si", $new_password, $user_id);
    $stmt->execute();
    
    header("Location: admin_page.php?action=password_changed");
    exit();
}

// 6. Rename Image File
if (isset($_POST['rename_image'])) {
    $image_id = (int)$_POST['image_id'];
    $new_name_raw = trim($_POST['new_name']);
    
    $result = $conn->query("SELECT file_path FROM images WHERE id = $image_id");
    $image = $result->fetch_assoc();
    
    if ($image) {
        $old_path = $image['file_path'];
        $ext = strtolower(pathinfo($old_path, PATHINFO_EXTENSION));
        
        // Clean name (alphanumeric and dashes/underscores only)
        $new_name_clean = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $new_name_raw);
        $new_filename = time() . "_" . $new_name_clean . "." . $ext;
        $new_path = "uploads/" . $new_filename;
        
        if (file_exists($old_path)) {
            if (rename($old_path, $new_path)) {
                $stmt = $conn->prepare("UPDATE images SET file_path = ?, image_path = ?, image_name = ? WHERE id = ?");
                $stmt->bind_param("sssi", $new_path, $new_path, $new_name_clean, $image_id);
                $stmt->execute();
                header("Location: admin_page.php?action=image_renamed");
                exit();
            } else {
                header("Location: admin_page.php?action=error&message=Failed to physically rename the image file.");
                exit();
            }
        } else {
            // Update database anyway if physical file is missing
            $stmt = $conn->prepare("UPDATE images SET file_path = ?, image_path = ?, image_name = ? WHERE id = ?");
            $stmt->bind_param("sssi", $new_path, $new_path, $new_name_clean, $image_id);
            $stmt->execute();
            header("Location: admin_page.php?action=image_renamed");
            exit();
        }
    } else {
        header("Location: admin_page.php?action=error&message=Image not found.");
        exit();
    }
}

// 7. Update own admin profile settings
if (isset($_POST['update_profile'])) {
    $admin_id = (int)$currentUser['id'];
    $prof_name = sanitize($conn, $_POST['name']);
    $prof_username = sanitize($conn, $_POST['username']);
    $prof_email = sanitize($conn, $_POST['email']);
    $prof_pass = $_POST['password'];
    
    // Check constraints
    $check_email = $conn->query("SELECT id FROM users WHERE email = '$prof_email' AND id != $admin_id");
    if ($check_email->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Email is already in use!");
        exit();
    }
    
    $check_user = $conn->query("SELECT id FROM users WHERE username = '$prof_username' AND id != $admin_id");
    if ($check_user->num_rows > 0) {
        header("Location: admin_page.php?action=error&message=Username is already in use!");
        exit();
    }
    
    if (!empty($prof_pass)) {
        $hashed_pass = password_hash($prof_pass, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, password = ? WHERE id = ?");
        $stmt->bind_param("ssssi", $prof_name, $prof_username, $prof_email, $hashed_pass, $admin_id);
    } else {
        $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ? WHERE id = ?");
        $stmt->bind_param("sssi", $prof_name, $prof_username, $prof_email, $admin_id);
    }
    
    $stmt->execute();
    
    $_SESSION['name'] = $prof_name;
    $_SESSION['email'] = $prof_email;
    
    header("Location: admin_page.php?action=profile_updated");
    exit();
}


// 8. Enable TOTP MFA
if (isset($_POST['enable_totp'])) {
    $otp_code = trim($_POST['otp_code']);
    $secret = trim($_POST['otp_secret']);
    require_once 'TotpAuthenticator.php';
    if (TotpAuthenticator::verifyCode($secret, $otp_code)) {
        $stmt = $conn->prepare("UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?");
        $stmt->bind_param("si", $secret, $currentUser['id']);
        $stmt->execute();
        
        // Refresh currentUser
        $result = $conn->query("SELECT * FROM users WHERE id = " . $currentUser['id']);
        $currentUser = $result->fetch_assoc();
        
        header("Location: admin_page.php?action=profile_updated");
        exit();
    } else {
        header("Location: admin_page.php?action=error&message=Invalid OTP code. Authenticator activation failed.");
        exit();
    }
}

// 9. Disable TOTP MFA
if (isset($_POST['disable_totp'])) {
    $otp_code = trim($_POST['otp_code']);
    require_once 'TotpAuthenticator.php';
    if (TotpAuthenticator::verifyCode($currentUser['totp_secret'], $otp_code)) {
        $stmt = $conn->prepare("UPDATE users SET totp_enabled = 0 WHERE id = ?");
        $stmt->bind_param("i", $currentUser['id']);
        $stmt->execute();
        
        // Refresh currentUser
        $result = $conn->query("SELECT * FROM users WHERE id = " . $currentUser['id']);
        $currentUser = $result->fetch_assoc();
        
        header("Location: admin_page.php?action=profile_updated");
        exit();
    } else {
        header("Location: admin_page.php?action=error&message=Invalid OTP code. Authenticator deactivation failed.");
        exit();
    }
}

// --- FETCH DATA FOR DASHBOARD ---

// Get statistics
$total_users = $conn->query("SELECT COUNT(*) as count FROM users")->fetch_assoc()['count'];
$total_admins = $conn->query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")->fetch_assoc()['count'];
$total_regular_users = $conn->query("SELECT COUNT(*) as count FROM users WHERE role = 'user'")->fetch_assoc()['count'];
$total_images = $conn->query("SELECT COUNT(*) as count FROM images")->fetch_assoc()['count'];

// Get recent users
$recent_users = $conn->query("SELECT * FROM users ORDER BY id DESC LIMIT 5");

// Get recent images
$recent_images = $conn->query("SELECT * FROM images ORDER BY id DESC LIMIT 6");

// Get all users for management
$all_users = $conn->query("SELECT * FROM users ORDER BY id DESC");

// Get all images for management
$all_images = $conn->query("SELECT * FROM images ORDER BY id DESC");
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - ArtVault Premium</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            --panel-bg: rgba(30, 41, 59, 0.7);
            --panel-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --input-bg: rgba(15, 23, 42, 0.6);
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
            background: rgba(15, 23, 42, 0.85);
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
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }

        .sidebar-footer {
            margin-top: auto;
            border-top: 1px solid var(--panel-border);
            padding-top: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .admin-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 5px 10px;
        }

        .admin-avatar {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #818cf8, #c084fc);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            color: white;
        }

        .admin-details {
            display: flex;
            flex-direction: column;
        }

        .admin-details .admin-name {
            font-weight: 600;
            font-size: 15px;
            color: var(--text-primary);
        }

        .admin-details .admin-role {
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
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
            border-color: rgba(99, 102, 241, 0.2);
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
            font-size: 36px;
            font-weight: 700;
            color: var(--text-primary);
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

        /* Table Design */
        .table-responsive {
            width: 100%;
            overflow-x: auto;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        .data-table th {
            padding: 16px 20px;
            background: rgba(15, 23, 42, 0.4);
            border-bottom: 1px solid var(--panel-border);
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .data-table td {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 15px;
            color: var(--text-primary);
        }

        .data-table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        /* Badges */
        .badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
            text-align: center;
        }

        .badge-admin {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #f87171;
        }

        .badge-user {
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.2);
            color: #818cf8;
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
            margin-bottom: 0; /* Override style.css margin */
        }

        .btn-primary {
            background: var(--accent);
            color: white;
        }

        .btn-primary:hover {
            background: var(--accent-hover);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
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

        .btn-action-group {
            display: flex;
            gap: 8px;
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
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
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
            border-color: rgba(99, 102, 241, 0.3);
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
            background: rgba(15, 23, 42, 0.7);
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
            background: rgba(30, 41, 59, 0.95);
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

        /* Settings Forms */
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
            margin-bottom: 0; /* Override style.css */
        }

        .form-control:focus {
            border-color: var(--accent);
        }

        select.form-control {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 16px;
            padding-right: 40px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        /* Activity grid on overview */
        .activity-grid {
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 25px;
        }

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
            .activity-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-logo">
            🛡️ <span>ArtVault</span> Admin
        </div>

        <nav style="flex: 1;">
            <ul class="sidebar-menu">
                <li>
                    <button class="tab-btn active" onclick="showTab('overview', this)">
                        📊 Overview
                    </button>
                </li>
                <li>
                    <button class="tab-btn" onclick="showTab('users', this)">
                        👥 Manage Users
                    </button>
                </li>
                <li>
                    <button class="tab-btn" onclick="showTab('images', this)">
                        🖼️ Manage Gallery
                    </button>
                </li>
                <li>
                    <button class="tab-btn" onclick="showTab('settings', this)">
                        ⚙️ Admin Settings
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
            <div class="admin-meta">
                <div class="admin-avatar">
                    <?= strtoupper(substr($currentUser['name'], 0, 2)); ?>
                </div>
                <div class="admin-details">
                    <span class="admin-name"><?= htmlspecialchars($currentUser['name']); ?></span>
                    <span class="admin-role"><?= htmlspecialchars($currentUser['role']); ?></span>
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
                <h2 id="tab-title-text">Dashboard Overview</h2>
                <p>Real-time system state and operations</p>
            </div>
            <div class="dashboard-actions" style="display: flex; gap: 10px;">
                <a href="home.php" class="btn btn-secondary" style="text-decoration: none;">
                    🌐 View Gallery
                </a>
                <button class="btn btn-primary" onclick="openModal('addUserModal')">
                    ➕ Add User
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
                        case 'user_deleted':
                            echo "✅ User account deleted successfully.";
                            break;
                        case 'image_deleted':
                            echo "✅ Gallery image deleted successfully.";
                            break;
                        case 'user_added':
                            echo "✅ New user registered successfully.";
                            break;
                        case 'user_updated':
                            echo "✅ User credentials updated successfully.";
                            break;
                        case 'password_changed':
                            echo "✅ User password has been reset.";
                            break;
                        case 'image_renamed':
                            echo "✅ Image renamed physically and updated in database.";
                            break;
                        case 'profile_updated':
                            echo "✅ Your administrative profile details were updated.";
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
                    <span class="stat-title">Total Accounts</span>
                    <span class="stat-icon">👥</span>
                </div>
                <div class="stat-number"><?= $total_users ?></div>
                <div class="stat-gauge">
                    <div class="stat-gauge-fill" style="width: 100%;"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">Administrators</span>
                    <span class="stat-icon">🛡️</span>
                </div>
                <div class="stat-number"><?= $total_admins ?></div>
                <div class="stat-gauge">
                    <?php $admin_pct = $total_users > 0 ? ($total_admins / $total_users) * 100 : 0; ?>
                    <div class="stat-gauge-fill" style="width: <?= $admin_pct ?>%; background: var(--danger);"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">Regular Users</span>
                    <span class="stat-icon">👤</span>
                </div>
                <div class="stat-number"><?= $total_regular_users ?></div>
                <div class="stat-gauge">
                    <?php $user_pct = $total_users > 0 ? ($total_regular_users / $total_users) * 100 : 0; ?>
                    <div class="stat-gauge-fill" style="width: <?= $user_pct ?>%; background: var(--success);"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">Gallery Images</span>
                    <span class="stat-icon">🖼️</span>
                </div>
                <div class="stat-number"><?= $total_images ?></div>
                <div class="stat-gauge">
                    <div class="stat-gauge-fill" style="width: 100%; background: var(--warning);"></div>
                </div>
            </div>
        </div>

        <!-- ================= OVERVIEW TAB ================= -->
        <div id="overview" class="tab-content active">
            <div class="activity-grid">
                
                <!-- Recent Users -->
                <div class="content-card">
                    <h3>👥 Recent Users</h3>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php while ($u = $recent_users->fetch_assoc()): ?>
                                <tr>
                                    <td>
                                        <strong><?= htmlspecialchars($u['name']) ?></strong><br>
                                        <small style="color: var(--text-secondary)">@<?= htmlspecialchars($u['username']) ?></small>
                                    </td>
                                    <td><?= htmlspecialchars($u['email']) ?></td>
                                    <td>
                                        <span class="badge badge-<?= $u['role'] ?>">
                                            <?= ucfirst($u['role']) ?>
                                        </span>
                                    </td>
                                </tr>
                                <?php endwhile; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Recent Images -->
                <div class="content-card">
                    <h3>🖼️ Recent Uploads</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <?php if ($recent_images->num_rows == 0): ?>
                            <p style="grid-column: span 2; text-align: center; color: var(--text-secondary); padding: 20px;">No images uploaded yet.</p>
                        <?php else: ?>
                            <?php while ($img = $recent_images->fetch_assoc()): ?>
                            <div style="background: rgba(15, 23, 42, 0.4); border-radius: 10px; overflow: hidden; border: 1px solid var(--panel-border);">
                                <img src="<?= $img['file_path'] ?>" alt="Artwork" style="width: 100%; height: 110px; object-fit: cover;">
                                <div style="padding: 10px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ID: <?= $img['id'] ?><br>
                                    <span style="color: var(--text-secondary)"><?= basename($img['file_path']) ?></span>
                                </div>
                            </div>
                            <?php endwhile; ?>
                        <?php endif; ?>
                    </div>
                </div>

            </div>
        </div>

        <!-- ================= USERS TAB ================= -->
        <div id="users" class="tab-content">
            <div class="content-card">
                <div class="controls-header">
                    <h3>👥 Complete Directory</h3>
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="searchUsers" class="search-input" placeholder="Search by name, username, email..." oninput="filterUsersTable()">
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table" id="usersTable">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $all_users->data_seek(0); // Reset pointer
                            while ($u = $all_users->fetch_assoc()): 
                            ?>
                            <tr class="user-row">
                                <td><?= $u['id'] ?></td>
                                <td class="search-field">
                                    <strong><?= htmlspecialchars($u['name']) ?></strong><br>
                                    <small style="color: var(--text-secondary)">@<?= htmlspecialchars($u['username']) ?></small>
                                </td>
                                <td class="search-field"><?= htmlspecialchars($u['email']) ?></td>
                                <td>
                                    <span class="badge badge-<?= $u['role'] ?>">
                                        <?= ucfirst($u['role']) ?>
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <div class="btn-action-group" style="justify-content: flex-end;">
                                        <button class="btn btn-secondary btn-sm" onclick="openEditUserModal(<?= $u['id'] ?>, '<?= htmlspecialchars($u['name'], ENT_QUOTES) ?>', '<?= htmlspecialchars($u['username'], ENT_QUOTES) ?>', '<?= htmlspecialchars($u['email'], ENT_QUOTES) ?>', '<?= $u['role'] ?>')">
                                            ✏️ Edit
                                        </button>
                                        <button class="btn btn-secondary btn-sm" onclick="openPasswordModal(<?= $u['id'] ?>, '<?= htmlspecialchars($u['name'], ENT_QUOTES) ?>')">
                                            🔑 Password
                                        </button>
                                        <?php if ($u['id'] !== $currentUser['id']): ?>
                                        <form method="post" style="display: inline;" onsubmit="return confirm('Permanently delete user account? This cannot be undone.')">
                                            <input type="hidden" name="user_id" value="<?= $u['id'] ?>">
                                            <button type="submit" name="delete_user" class="btn btn-danger btn-sm">
                                                🗑️ Delete
                                            </button>
                                        </form>
                                        <?php else: ?>
                                        <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.4; cursor: not-allowed;">
                                            🛡️ Protected
                                        </button>
                                        <?php endif; ?>
                                    </div>
                                </td>
                            </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ================= GALLERY TAB ================= -->
        <div id="images" class="tab-content">
            <div class="content-card">
                <div class="controls-header">
                    <h3>🖼️ Manage Artwork Catalog</h3>
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="searchImages" class="search-input" placeholder="Search by image ID or filename..." oninput="filterImagesGrid()">
                    </div>
                </div>

                <?php if ($all_images->num_rows == 0): ?>
                    <p style="text-align: center; color: var(--text-secondary); padding: 40px;">No images in the database gallery.</p>
                <?php else: ?>
                    <div class="image-gallery-grid" id="imagesGrid">
                        <?php 
                        $all_images->data_seek(0);
                        while ($img = $all_images->fetch_assoc()): 
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
                                    <button class="btn btn-secondary btn-sm" onclick="openRenameImageModal(<?= $img['id'] ?>, '<?= htmlspecialchars($custom_name, ENT_QUOTES) ?>')">
                                        ✏️ Rename
                                    </button>
                                    <form method="post" onsubmit="return confirm('Delete this image from the server and database?')" style="display: inline;">
                                        <input type="hidden" name="image_id" value="<?= $img['id'] ?>">
                                        <button type="submit" name="delete_image" class="btn btn-danger btn-sm" style="width: 100%;">
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
                <h3>⚙️ Admin Profile Settings</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; text-align: left;">Modify your administrative profile details and security credentials.</p>
                
                <form method="post">
                    <div class="form-group">
                        <label for="prof_name">Full Name</label>
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
                            💾 Save Profile Settings
                        </button>
                    </div>
                </form>
            </div>

            <!-- TOTP settings -->
            <?php
            require_once 'TotpAuthenticator.php';
            $otp_secret = $currentUser['totp_secret'] ?? '';
            if (empty($otp_secret)) {
                $otp_secret = TotpAuthenticator::generateSecret();
                $conn->query("UPDATE users SET totp_secret = '$otp_secret' WHERE id = " . $currentUser['id']);
            }
            $qr_code_url = TotpAuthenticator::getQrCodeUrl($currentUser['email'], 'ArtVault Admin', $otp_secret);
            ?>
            <div class="content-card" style="max-width: 600px; margin: 25px auto 0 auto;">
                <h3>🔒 Two-Factor Authenticator (TOTP)</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; text-align: left;">
                    Protect your admin account sign-in with One-Time Password (OTP) multi-factor authentication.
                </p>
                
                <?php if (isset($currentUser['totp_enabled']) && $currentUser['totp_enabled'] != 1): ?>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; background: rgba(255,255,255,0.02); padding: 20px; border-radius: 12px; border: 1px dashed var(--panel-border);">
                        <img src="<?= $qr_code_url ?>" alt="Scan QR Code" style="background: white; padding: 10px; border-radius: 8px; width: 180px; height: 180px;">
                        <div style="text-align: center;">
                            <div style="font-size: 14px; font-weight: 600; margin-bottom: 5px;">Scan this QR code in any Authenticator App</div>
                            <div style="font-size: 12px; color: var(--text-secondary); font-family: monospace;">Secret: <?= htmlspecialchars($otp_secret) ?></div>
                        </div>
                        
                        <form method="post" style="width: 100%; margin-top: 10px;">
                            <input type="hidden" name="otp_secret" value="<?= htmlspecialchars($otp_secret) ?>">
                            <div class="form-group">
                                <label for="otp_code">Enter 6-Digit Verification Code</label>
                                <input type="text" id="otp_code" name="otp_code" class="form-control" placeholder="000000" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" required style="font-size: 20px; text-align: center; letter-spacing: 4px;">
                            </div>
                            <button type="submit" name="enable_totp" class="btn btn-primary" style="width: 100%;">
                                ✔️ Verify & Activate OTP
                            </button>
                        </form>
                    </div>
                <?php else: ?>
                    <div style="display: flex; flex-direction: column; gap: 15px; background: rgba(16, 185, 129, 0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.15);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 24px;">🛡️</span>
                            <div style="text-align: left;">
                                <h4 style="color: var(--success); font-weight: 600;">Two-Factor OTP is Active</h4>
                                <p style="font-size: 13px; color: var(--text-secondary); margin: 2px 0 0 0;">Your sign-in is fully secured using an Authenticator app.</p>
                            </div>
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid var(--panel-border); margin: 5px 0;">
                        
                        <h5 style="text-align: left; font-weight: 600; margin-bottom: 5px;">Deactivate Two-Factor Authenticator</h5>
                        <form method="post">
                            <div class="form-group">
                                <label for="otp_code_disable">Enter Code to Confirm Deactivation</label>
                                <input type="text" id="otp_code_disable" name="otp_code" class="form-control" placeholder="000000" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" required style="font-size: 18px; text-align: center; letter-spacing: 3px;">
                            </div>
                            <button type="submit" name="disable_totp" class="btn btn-danger" style="width: 100%;">
                                ⚠️ Turn Off 2FA
                            </button>
                        </form>
                    </div>
                <?php endif; ?>
            </div>
        </div>

    </main>

    <!-- ================= ADD USER MODAL ================= -->
    <div id="addUserModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>👥 Onboard New User</h3>
                <button class="close-modal" onclick="closeModal('addUserModal')">✕</button>
            </div>
            <div class="modal-body">
                <form method="post">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="name" class="form-control" placeholder="e.g. John Doe" required>
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" name="username" class="form-control" placeholder="e.g. johndoe" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" class="form-control" placeholder="e.g. john@example.com" required>
                    </div>
                    <div class="form-group">
                        <label>Default Password</label>
                        <input type="password" name="password" class="form-control" placeholder="Enter secure password" required>
                    </div>
                    <div class="form-group">
                        <label>Privilege Level</label>
                        <select name="role" class="form-control" required>
                            <option value="user">Regular User</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('addUserModal')">Cancel</button>
                        <button type="submit" name="add_user" class="btn btn-primary">Create Account</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ================= EDIT USER MODAL ================= -->
    <div id="editUserModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>✏️ Edit User Profile</h3>
                <button class="close-modal" onclick="closeModal('editUserModal')">✕</button>
            </div>
            <div class="modal-body">
                <form method="post">
                    <input type="hidden" name="user_id" id="edit_user_id">
                    
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="name" id="edit_user_name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" name="username" id="edit_user_username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" id="edit_user_email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Privilege Level</label>
                        <select name="role" id="edit_user_role" class="form-control" required>
                            <option value="user">Regular User</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('editUserModal')">Cancel</button>
                        <button type="submit" name="edit_user" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ================= PASSWORD RESET MODAL ================= -->
    <div id="passwordModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔑 Reset Password</h3>
                <button class="close-modal" onclick="closeModal('passwordModal')">✕</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px; text-align: left;">Reset password for <strong id="pass_user_name" style="color: var(--accent)">user</strong>.</p>
                <form method="post">
                    <input type="hidden" name="user_id" id="pass_user_id">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" name="password" class="form-control" placeholder="Enter new secure password" required minlength="4">
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('passwordModal')">Cancel</button>
                        <button type="submit" name="change_password" class="btn btn-primary">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ================= RENAME IMAGE MODAL ================= -->
    <div id="renameImageModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>🖼️ Rename Gallery Image</h3>
                <button class="close-modal" onclick="closeModal('renameImageModal')">✕</button>
            </div>
            <div class="modal-body">
                <form method="post">
                    <input type="hidden" name="image_id" id="rename_image_id">
                    <div class="form-group">
                        <label>New Image Title</label>
                        <input type="text" name="new_name" id="rename_image_title" class="form-control" required placeholder="e.g. starry_night">
                        <small style="color: var(--text-secondary); margin-top: 5px; display: block;">Note: The physical filename on disk will be updated automatically while keeping the original extension.</small>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('renameImageModal')">Cancel</button>
                        <button type="submit" name="rename_image" class="btn btn-primary">Rename File</button>
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

        // Edit User modal trigger
        function openEditUserModal(id, name, username, email, role) {
            document.getElementById('edit_user_id').value = id;
            document.getElementById('edit_user_name').value = name;
            document.getElementById('edit_user_username').value = username;
            document.getElementById('edit_user_email').value = email;
            document.getElementById('edit_user_role').value = role;
            openModal('editUserModal');
        }

        // Change Password modal trigger
        function openPasswordModal(id, name) {
            document.getElementById('pass_user_id').value = id;
            document.getElementById('pass_user_name').textContent = name;
            openModal('passwordModal');
        }

        // Rename Image modal trigger
        function openRenameImageModal(id, currentTitle) {
            document.getElementById('rename_image_id').value = id;
            document.getElementById('rename_image_title').value = currentTitle;
            openModal('renameImageModal');
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
                'overview': 'Dashboard Overview',
                'users': 'User Management Directory',
                'images': 'Artwork Catalog Registry',
                'settings': 'Administrative Profile Settings'
            };
            document.getElementById('tab-title-text').textContent = titleMap[tabId] || 'Admin Dashboard';
            
            // Save tab state to localStorage
            localStorage.setItem('activeAdminTab', tabId);
        }

        // Restore active tab from query parameter or localStorage on DOM load
        document.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            const savedTab = tabParam || localStorage.getItem('activeAdminTab') || 'overview';
            const btn = document.querySelector(`.sidebar button[onclick*="${savedTab}"]`);
            if (btn) {
                showTab(savedTab, btn);
            }
        });

        // Client-side quick filter for Users Table
        function filterUsersTable() {
            const query = document.getElementById('searchUsers').value.toLowerCase();
            const rows = document.querySelectorAll('#usersTable tbody tr');
            
            rows.forEach(row => {
                const textFields = Array.from(row.querySelectorAll('.search-field'))
                                        .map(td => td.textContent.toLowerCase())
                                        .join(' ');
                
                if (textFields.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        // Client-side quick filter for Images Grid
        function filterImagesGrid() {
            const query = document.getElementById('searchImages').value.toLowerCase();
            const cards = document.querySelectorAll('#imagesGrid .image-card');
            
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
