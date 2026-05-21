<?php
/**
 * google-callback.php
 * Callback handler for Google OAuth & Sandbox simulation logins.
 */
require_once 'config.php';
session_start();

$clientId = GOOGLE_CLIENT_ID;
$clientSecret = GOOGLE_CLIENT_SECRET;
$redirectUri = GOOGLE_REDIRECT_URI;

$email = '';
$name = '';
$googleId = '';

if (empty($clientId)) {
    // Sandbox / Simulator Mode
    if (!isset($_GET['sandbox_email']) || !isset($_GET['sandbox_name'])) {
        header("Location: index.php");
        exit();
    }
    $email = trim($_GET['sandbox_email']);
    $name = trim($_GET['sandbox_name']);
    $googleId = 'google_mock_' . md5($email);
} else {
    // Production Google OAuth Token Exchange
    if (!isset($_GET['code'])) {
        header("Location: index.php");
        exit();
    }
    
    $code = $_GET['code'];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'code'          => $code,
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code'
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $tokenData = json_decode($response, true);
    if (!isset($tokenData['access_token'])) {
        $_SESSION['login_error'] = 'Failed to exchange access token from Google.';
        header("Location: index.php");
        exit();
    }
    
    $accessToken = $tokenData['access_token'];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://www.googleapis.com/oauth2/v2/userinfo');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $userResponse = curl_exec($ch);
    curl_close($ch);
    
    $userData = json_decode($userResponse, true);
    if (!isset($userData['email'])) {
        $_SESSION['login_error'] = 'Failed to retrieve user details from Google.';
        header("Location: index.php");
        exit();
    }
    
    $email = trim($userData['email']);
    $name = trim($userData['name'] ?? 'Google Artist');
    $googleId = trim($userData['id']);
}

// Locate or register user in database
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();

if (!$user) {
    // Generate clean username from email prefix
    $username = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', strstr($email, '@', true)));
    
    // Ensure username uniqueness
    $check_uname = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $check_uname->bind_param("s", $username);
    $check_uname->execute();
    $check_uname->store_result();
    if ($check_uname->num_rows > 0) {
        $username .= rand(10, 99);
    }
    
    // Create random password hash for Google federated login
    $random_password = bin2hex(random_bytes(16));
    $hashed_password = password_hash($random_password, PASSWORD_BCRYPT);
    $role = 'user';
    $profile_pic = 'uploads/default_avatar.svg';
    
    $ins = $conn->prepare("INSERT INTO users (name, username, email, password, role, profile_pic, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $ins->bind_param("sssssss", $name, $username, $email, $hashed_password, $role, $profile_pic, $googleId);
    $ins->execute();
    
    $userId = $ins->insert_id;
    $googleOtpEnabled = 0;
} else {
    $userId = $user['id'];
    $role = $user['role'];
    $googleOtpEnabled = (int)$user['google_otp_enabled'];
    
    // Link Google ID if the user previously registered via email/password
    if (empty($user['google_id'])) {
        $upd = $conn->prepare("UPDATE users SET google_id = ? WHERE id = ?");
        $upd->bind_param("si", $googleId, $userId);
        $upd->execute();
    }
}

// Enforce Google OTP verification if enabled
if ($googleOtpEnabled === 1) {
    $_SESSION['otp_pending_user_id'] = $userId;
    header("Location: otp-verify.php");
    exit();
} else {
    // Login session initialization
    $_SESSION['user_id'] = $userId;
    $_SESSION['role'] = $role;
    header("Location: user_page.php");
    exit();
}
