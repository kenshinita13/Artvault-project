<?php
session_start();
require_once 'config.php';

// If already logged in as admin, redirect to dashboard
if (isset($_SESSION['email'])) {
    $email = $_SESSION['email'];
    $result = $conn->query("SELECT role FROM users WHERE email = '$email'");
    $user = $result->fetch_assoc();
    
    if ($user && $user['role'] === 'admin') {
        header("Location: admin_page.php");
        exit();
    }
}

$error = '';

if (isset($_POST['admin_login'])) {
    $email = $_POST['email'];
    $password = $_POST['password'];

    $result = $conn->query("SELECT * FROM users WHERE email = '$email' AND role = 'admin'");

    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();

        if (password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['name'] = $user['name'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['role'] = $user['role'];

            header("Location: admin_page.php");
            exit();
        } else {
            $error = 'Invalid password for admin account';
        }
    } else {
        $error = 'Admin account not found with this email';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - ArtVault</title>
    <link rel="stylesheet" href="style.css">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .admin-login-container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
            text-align: center;
        }

        .admin-login-container h2 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .admin-login-container .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .admin-icon {
            font-size: 48px;
            margin-bottom: 20px;
            display: block;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #7494ec;
        }

        .admin-login-btn {
            width: 100%;
            padding: 12px;
            background: #7494ec;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            margin-bottom: 20px;
        }

        .admin-login-btn:hover {
            background: #6884d3;
        }

        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #f5c6cb;
        }

        .back-link {
            color: #7494ec;
            text-decoration: none;
            font-size: 14px;
        }

        .back-link:hover {
            text-decoration: underline;
        }

        .security-notice {
            background: #fff3cd;
            color: #856404;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #ffeaa7;
            font-size: 14px;
        }
    </style>
</head>
<body>

<div class="admin-login-container">
    <div class="admin-icon">🛡️</div>
    <h2>Admin Login</h2>
    <p class="subtitle">Secure access to ArtVault administration</p>

    <div class="security-notice">
        <strong>⚠️ Restricted Access:</strong> This area is for administrators only.
    </div>

    <?php if (!empty($error)): ?>
        <div class="error-message">
            <?= htmlspecialchars($error) ?>
        </div>
    <?php endif; ?>

    <form method="post">
        <div class="form-group">
            <label for="email">Admin Email</label>
            <input type="email" id="email" name="email" required placeholder="Enter your admin email">
        </div>

        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required placeholder="Enter your password">
        </div>

        <button type="submit" name="admin_login" class="admin-login-btn">
            🔐 Login as Administrator
        </button>
    </form>

    <a href="index.php" class="back-link">← Back to User Login</a>
</div>

</body>
</html>