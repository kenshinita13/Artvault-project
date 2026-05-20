<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email'])) {
    header("Location: index.php");
    exit();
}

if (isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $email = $_SESSION['email'];
    
    // Check user info and role
    $user_res = $conn->query("SELECT id, role FROM users WHERE email = '$email'");
    $user = $user_res->fetch_assoc();
    
    if ($user) {
        $user_id = (int)$user['id'];
        $role = $user['role'];
        
        // Check image info
        $img_res = $conn->query("SELECT file_path, user_id FROM images WHERE id = $id");
        $image = $img_res->fetch_assoc();
        
        if ($image) {
            // Admins can delete anything; regular users can only delete their own
            if ($role === 'admin' || (int)$image['user_id'] === $user_id) {
                if (file_exists($image['file_path'])) {
                    unlink($image['file_path']); // Delete physical file
                }
                $conn->query("DELETE FROM images WHERE id = $id"); // Delete from DB
            }
        }
    }
}

// Redirect dynamically
$redirect = isset($_GET['redirect']) ? $_GET['redirect'] : 'home';
if ($redirect === 'profile' && isset($_GET['profile_id'])) {
    $profile_id = (int)$_GET['profile_id'];
    header("Location: profile.php?id=$profile_id");
} elseif ($redirect === 'user_page') {
    header("Location: user_page.php");
} elseif ($redirect === 'admin_page') {
    header("Location: admin_page.php");
} else {
    header("Location: home.php");
}
exit();
?>