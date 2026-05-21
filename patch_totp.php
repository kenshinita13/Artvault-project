<?php
require 'config.php';

$queries = [
    "ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN totp_enabled TINYINT(1) DEFAULT 0"
];

foreach ($queries as $q) {
    if ($conn->query($q) === TRUE) {
        echo "Success: $q\n";
    } else {
        echo "Error: " . $conn->error . "\n";
    }
}
echo "Done.";
?>
