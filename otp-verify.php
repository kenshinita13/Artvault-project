<?php
/**
 * otp-verify.php
 * Two-Factor OTP Verification page.
 */
require_once 'config.php';
require_once 'TotpAuthenticator.php';
session_start();

if (!isset($_SESSION['otp_pending_user_id'])) {
    header("Location: index.php");
    exit();
}

$userId = $_SESSION['otp_pending_user_id'];
$error = '';

// Load user details
$stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || $user['totp_enabled'] != 1) {
    header("Location: index.php");
    exit();
}

if (isset($_POST['verify_otp'])) {
    $code = trim($_POST['otp_code']);
    
    if (empty($code)) {
        $error = 'Please enter the verification code.';
    } elseif (TotpAuthenticator::verifyCode($user['totp_secret'], $code)) {
        // Authenticated! Initialize user session
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role'] = $user['role'];
        unset($_SESSION['otp_pending_user_id']);
        
        if ($user['role'] === 'admin') {
            header("Location: admin_page.php");
        } else {
            header("Location: user_page.php");
        }
        exit();
    } else {
        $error = 'Invalid OTP code. Please try again.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Two-Factor Verification - ArtVault</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #09090b 0%, #16072b 50%, #03000a 100%);
            --panel-bg: rgba(24, 24, 27, 0.7);
            --panel-border: rgba(255, 255, 255, 0.08);
            --text-primary: #fafafa;
            --text-secondary: #a1a1aa;
            --accent: #a855f7;
            --accent-hover: #c084fc;
            --input-bg: rgba(9, 9, 11, 0.6);
            --danger: #ef4444;
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
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-x: hidden;
            position: relative;
        }

        .glow-blob {
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(0,0,0,0) 70%);
            border-radius: 50%;
            z-index: 0;
            filter: blur(40px);
        }

        .glow-1 {
            top: 20%;
            left: 20%;
        }

        .container {
            width: 100%;
            max-width: 420px;
            z-index: 10;
        }

        .form-box {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(12px);
            text-align: center;
        }

        .icon-wrapper {
            font-size: 50px;
            margin-bottom: 20px;
        }

        h2 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 10px;
        }

        p {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 30px;
            line-height: 1.5;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .form-control {
            width: 100%;
            padding: 14px;
            background: var(--input-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            color: white;
            font-size: 24px;
            letter-spacing: 6px;
            text-align: center;
            font-weight: 600;
            outline: none;
            transition: all 0.3s;
        }

        .form-control:focus {
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
        }

        button[type="submit"] {
            width: 100%;
            padding: 13px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }

        button[type="submit"]:hover {
            background: var(--accent-hover);
            box-shadow: 0 5px 15px rgba(168, 85, 247, 0.4);
        }

        .alert {
            padding: 12px 15px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 20px;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #f87171;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .cancel-link {
            display: block;
            margin-top: 25px;
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 14px;
            transition: color 0.3s;
        }

        .cancel-link:hover {
            color: var(--text-primary);
            text-decoration: underline;
        }
    </style>
</head>
<body>

    <div class="glow-blob glow-1"></div>

    <div class="container">
        <div class="form-box">
            <div class="icon-wrapper">🔒</div>
            <h2>Security Check</h2>
            <p>Enter the 6-digit verification code from your Authenticator app for <strong><?= htmlspecialchars($user['email']) ?></strong>.</p>

            <?php if (!empty($error)): ?>
                <div class="alert">❌ <?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <form method="post">
                <div class="form-group">
                    <label for="otp_code">Verification Code</label>
                    <input type="text" id="otp_code" name="otp_code" class="form-control" placeholder="000000" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" required autocomplete="one-time-code" autofocus>
                </div>

                <button type="submit" name="verify_otp">Verify & Sign In</button>

                <a href="index.php" class="cancel-link">Cancel and Sign In with another account</a>
            </form>
        </div>
    </div>

</body>
</html>
