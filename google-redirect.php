<?php
/**
 * google-redirect.php
 * Handles Google OAuth Redirection (Production vs Sandbox Simulator)
 */
require_once 'config.php';
session_start();

$clientId = GOOGLE_CLIENT_ID;
$redirectUri = GOOGLE_REDIRECT_URI;

if (empty($clientId)) {
    // Redirect to sandbox simulator if credentials are not configured yet
    header("Location: google-sandbox.php");
    exit();
} else {
    // Real Google OAuth 2.0 Auth Redirect
    $scope = 'email profile';
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;

    $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
        'response_type' => 'code',
        'client_id'     => $clientId,
        'redirect_uri'  => $redirectUri,
        'scope'         => $scope,
        'state'         => $state
    ]);
    header("Location: " . $authUrl);
    exit();
}
