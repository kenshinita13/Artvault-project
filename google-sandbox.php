<?php
/**
 * google-sandbox.php
 * Beautiful simulated Google Account Selector screen for sandbox testing
 */
session_start();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in - Google Accounts</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap">
    <style>
        body {
            font-family: 'Roboto', sans-serif;
            background: #f0f4f9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .login-card {
            background: #ffffff;
            border-radius: 28px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            text-align: center;
        }
        .google-logo {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: 400;
            color: #1f1f1f;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 16px;
            color: #444746;
            margin-bottom: 30px;
        }
        .account-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #e3e3e3;
            cursor: pointer;
            text-align: left;
            transition: background 0.2s;
        }
        .account-item:hover {
            background: #f7f9fc;
        }
        .account-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #a855f7;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            font-size: 18px;
            margin-right: 15px;
        }
        .account-details {
            display: flex;
            flex-direction: column;
        }
        .account-name {
            font-size: 14px;
            font-weight: 500;
            color: #1f1f1f;
        }
        .account-email {
            font-size: 12px;
            color: #444746;
        }
        .form-group {
            margin-top: 25px;
            text-align: left;
        }
        .form-control {
            width: 100%;
            padding: 14px;
            border: 1px solid #747775;
            border-radius: 4px;
            font-size: 16px;
            margin-top: 8px;
            outline: none;
            box-sizing: border-box;
        }
        .form-control:focus {
            border-color: #0b57d0;
            border-width: 2px;
        }
        .btn-submit {
            background: #0b57d0;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            border-radius: 100px;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
            transition: background 0.2s;
        }
        .btn-submit:hover {
            background: #0842a0;
        }
        .badge-sandbox {
            background: #fff0d4;
            color: #8f4f00;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

    <div class="login-card">
        <div class="google-logo">
            <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
        </div>
        <div class="badge-sandbox">🛠️ Google Login Sandbox Simulator</div>
        <h1 class="title">Choose an account</h1>
        <p class="subtitle">to continue to ArtVault Studio</p>

        <div class="account-item" onclick="selectAccount('Test Artist', 'testartist@artvault.com')">
            <div class="account-avatar">T</div>
            <div class="account-details">
                <span class="account-name">Test Artist</span>
                <span class="account-email">testartist@artvault.com</span>
            </div>
        </div>
        
        <div class="account-item" onclick="selectAccount('Jane Doe', 'janedoe@artvault.com')">
            <div class="account-avatar" style="background:#db2777;">J</div>
            <div class="account-details">
                <span class="account-name">Jane Doe</span>
                <span class="account-email">janedoe@artvault.com</span>
            </div>
        </div>

        <form action="google-callback.php" method="GET" id="sandbox-form">
            <!-- Sandbox parameters -->
            <input type="hidden" name="code" value="sandbox_auth_code_12345">
            <input type="hidden" name="sandbox_name" id="sandbox_name">
            <input type="hidden" name="sandbox_email" id="sandbox_email">
            
            <div class="form-group">
                <label style="font-size: 13px; font-weight: 500; color: #444746;">Or use a custom Google Account:</label>
                <input type="text" id="custom_name" placeholder="Enter Full Name" class="form-control" style="margin-bottom: 10px;">
                <input type="email" id="custom_email" placeholder="Enter Gmail Address" class="form-control">
            </div>

            <button type="button" class="btn-submit" onclick="submitCustomAccount()">Continue</button>
        </form>
    </div>

    <script>
        function selectAccount(name, email) {
            document.getElementById('sandbox_name').value = name;
            document.getElementById('sandbox_email').value = email;
            document.getElementById('sandbox-form').submit();
        }

        function submitCustomAccount() {
            const name = document.getElementById('custom_name').value.trim();
            const email = document.getElementById('custom_email').value.trim();
            if (!name || !email) {
                alert('Please enter both name and email.');
                return;
            }
            document.getElementById('sandbox_name').value = name;
            document.getElementById('sandbox_email').value = email;
            document.getElementById('sandbox-form').submit();
        }
    </script>
</body>
</html>
