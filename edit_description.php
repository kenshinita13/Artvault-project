<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email'])) {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized access.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_SESSION['email'];
    $image_id = isset($_POST['image_id']) ? (int)$_POST['image_id'] : 0;
    $description = isset($_POST['description']) ? mysqli_real_escape_string($conn, trim($_POST['description'])) : '';
    
    // Fetch user role and ID
    $user_res = $conn->query("SELECT id, role FROM users WHERE email = '$email'");
    $user = $user_res->fetch_assoc();
    
    if (!$user) {
        echo json_encode(['status' => 'error', 'message' => 'User account not found.']);
        exit();
    }
    
    $user_id = (int)$user['id'];
    $role = $user['role'];
    
    // Fetch image details
    $img_res = $conn->query("SELECT user_id FROM images WHERE id = $image_id");
    if ($img_res->num_rows == 0) {
        echo json_encode(['status' => 'error', 'message' => 'Target artwork not found.']);
        exit();
    }
    
    $image = $img_res->fetch_assoc();
    $owner_id = (int)$image['user_id'];
    
    // Authorize: user must be the uploader or an administrator
    if ($role === 'admin' || $user_id === $owner_id) {
        $stmt = $conn->prepare("UPDATE images SET description = ? WHERE id = ?");
        $stmt->bind_param("si", $description, $image_id);
        if ($stmt->execute()) {
            echo json_encode(['status' => 'success']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to update description in database.']);
        }
        $stmt->close();
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Access denied: You do not have permission to edit this description.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
