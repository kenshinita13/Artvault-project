<?php
session_start();

$errors = [
    'login'    => $_SESSION['login_error'] ?? '',
    'register' => $_SESSION['register_error'] ?? ''
];

$success = $_SESSION['register_success'] ?? '';
$activeForm = $_SESSION['active_form'] ?? 'login';

// Clear session variables after reading so they only show once
unset($_SESSION['login_error']);
unset($_SESSION['register_error']);
unset($_SESSION['register_success']);
unset($_SESSION['active_form']);

function showError($error) {
    return !empty($error) ? "<div class='alert error'>❌ " . htmlspecialchars($error) . "</div>" : '';
}

function showSuccess($success) {
    return !empty($success) ? "<div class='alert success'>✅ " . htmlspecialchars($success) . "</div>" : '';
}

function isActiveForm($formName, $activeForm) {
    return $formName === $activeForm ? 'active' : '';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArtVault Studio - Login & Registration</title>
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
            --success: #10b981;
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

        /* Ambient Glowing Background Blobs */
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
            top: 10%;
            left: 15%;
        }

        .glow-2 {
            bottom: 10%;
            right: 15%;
            background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(0,0,0,0) 70%);
        }

        /* Main Container */
        .container {
            width: 100%;
            max-width: 460px;
            z-index: 10;
        }

        /* Branding Header */
        .brand-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .brand-logo {
            font-size: 42px;
            margin-bottom: 5px;
        }

        .brand-title {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff 0%, #c084fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand-subtitle {
            font-size: 14px;
            color: var(--text-secondary);
            margin-top: 5px;
        }

        /* Form Card */
        .form-box {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(12px);
            display: none;
            animation: cardFadeIn 0.5s ease;
        }

        .form-box.active {
            display: block;
        }

        @keyframes cardFadeIn {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .form-box h2 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 25px;
            text-align: center;
        }

        /* Inputs & Form Groups */
        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        .form-control {
            width: 100%;
            padding: 12px 15px;
            background: var(--input-bg);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            color: white;
            font-size: 15px;
            outline: none;
            transition: all 0.3s;
        }

        .form-control:focus {
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
        }

        select.form-control {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 16px;
            padding-right: 40px;
            color: var(--text-secondary);
        }

        select.form-control option {
            background: #18181b;
            color: white;
        }

        /* Submit Button */
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

        /* Form Footer links */
        .form-footer {
            margin-top: 25px;
            text-align: center;
            font-size: 14px;
            color: var(--text-secondary);
        }

        .form-footer a {
            color: var(--accent-hover);
            text-decoration: none;
            font-weight: 600;
            transition: color 0.3s;
        }

        .form-footer a:hover {
            text-decoration: underline;
        }

        /* Alerts styling */
        .alert {
            padding: 12px 15px;
            border-radius: 8px;
            font-size: 14.5px;
            font-weight: 500;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .alert.error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #f87171;
        }

        .alert.success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #34d399;
        }

        /* Admin Gateway link */
        .admin-link-wrapper {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
        }

        .admin-link {
            color: var(--text-secondary);
            font-size: 13.5px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s;
        }

        .admin-link:hover {
            color: var(--text-primary);
        }
    </style>
</head>
<body>

    <!-- Glow Backdrops -->
    <div class="glow-blob glow-1"></div>
    <div class="glow-blob glow-2"></div>

    <div class="container">
        
        <!-- Branding Header -->
        <div class="brand-header">
            <div class="brand-logo">🎨</div>
            <h1 class="brand-title">ArtVault Studio</h1>
            <p class="brand-subtitle">The Canvas of Digital Artists & Creators</p>
        </div>

        <!-- ================= LOGIN FORM ================= -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <h2>Artist Sign In</h2>
            
            <?= showError($errors['login']); ?>
            <?= showSuccess($success); ?>

            <form action="login_register.php" method="post">
                <div class="form-group">
                    <label for="login_email">Email Address</label>
                    <input type="email" id="login_email" name="email" class="form-control" placeholder="Enter your email" required autocomplete="email">
                </div>

                <div class="form-group">
                    <label for="login_pass">Password</label>
                    <input type="password" id="login_pass" name="password" class="form-control" placeholder="Enter your password" required>
                </div>

                <button type="submit" name="login">Enter Studio</button>

                <div class="form-footer">
                    New to ArtVault? 
                    <a href="#" onclick="showForm('register-form')">Create an Artist Profile</a>
                </div>

                <div class="admin-link-wrapper">
                    <a href="admin_login.php" class="admin-link">
                        🛡️ Administrator Gateway
                    </a>
                </div>
            </form>
        </div>

        <!-- ================= REGISTRATION FORM ================= -->
        <div class="form-box <?= isActiveForm('register', $activeForm); ?>" id="register-form">
            <h2>Register Artist</h2>
            
            <?= showError($errors['register']); ?>

            <form action="login_register.php" method="post">
                <div class="form-group">
                    <label for="reg_name">Artist/Full Name</label>
                    <input type="text" id="reg_name" name="name" class="form-control" placeholder="e.g. Leonardo da Vinci" required autocomplete="name">
                </div>

                <div class="form-group">
                    <label for="reg_username">Username</label>
                    <input type="text" id="reg_username" name="username" class="form-control" placeholder="e.g. leonardo" required autocomplete="username">
                </div>

                <div class="form-group">
                    <label for="reg_email">Email Address</label>
                    <input type="email" id="reg_email" name="email" class="form-control" placeholder="e.g. leo@artvault.com" required autocomplete="email">
                </div>

                <div class="form-group">
                    <label for="reg_pass">Password</label>
                    <input type="password" id="reg_pass" name="password" class="form-control" placeholder="Create a secure password" required minlength="4">
                </div>

                <div class="form-group">
                    <label for="reg_role">Account Privilege</label>
                    <select id="reg_role" name="role" class="form-control" required>
                        <option value="user" selected>Artist / Regular User</option>
                        <option value="admin">Administrator</option>
                    </select>
                </div>

                <button type="submit" name="register">Onboard Account</button>

                <div class="form-footer">
                    Already registered? 
                    <a href="#" onclick="showForm('login-form')">Sign In to Studio</a>
                </div>
            </form>
        </div>

    </div>

    <!-- Switcher Javascript -->
    <script>
        function showForm(formId) {
            // Fade-out all forms
            document.querySelectorAll(".form-box").forEach(form => {
                form.classList.remove("active");
            });
            // Show the target form
            const targetForm = document.getElementById(formId);
            targetForm.classList.add("active");
        }
    </script>

</body>
</html>