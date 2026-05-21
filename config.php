<?php

$host = "localhost";
$user = "root";
$password = "";
$database = "users_db";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    die("Connection failed: ". $conn->connect_error);
}

// Google OAuth API Configuration
// Define your Google API keys here. If left empty, Sandbox/Simulator mode will run automatically.
define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_CLIENT_SECRET', '');
define('GOOGLE_REDIRECT_URI', 'http://localhost/Artvaultv3/google-callback.php');

// Automatic Database Migration for Google OAuth & OTP columns
$cols_check = $conn->query("SHOW COLUMNS FROM `users` LIKE 'google_id'");
if ($cols_check && $cols_check->num_rows == 0) {
    $conn->query("ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(255) DEFAULT NULL");
    $conn->query("ALTER TABLE `users` ADD COLUMN `google_otp_secret` VARCHAR(32) DEFAULT NULL");
    $conn->query("ALTER TABLE `users` ADD COLUMN `google_otp_enabled` TINYINT(1) DEFAULT 0");
}

?>