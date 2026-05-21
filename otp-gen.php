<?php
require_once 'TotpAuthenticator.php';
$secret = $_GET['secret'] ?? '';
if ($secret) {
    echo TotpAuthenticator::getCode($secret);
} else {
    echo "No secret provided";
}
?>
