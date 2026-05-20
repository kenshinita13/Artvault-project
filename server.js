const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Common search paths for PHP binary across OS configurations
const phpSearchPaths = [
    'php', // System environment PATH
    'c:\\Users\\root\\Desktop\\APACHEXAMPP\\php\\php.exe', // Custom Desktop XAMPP path
    'c:\\xampp\\php\\php.exe', // Standard Windows XAMPP path
    'C:\\Program Files\\php\\php.exe', // Standard Windows PHP path
    '/usr/bin/php', // Linux/macOS path
    '/usr/local/bin/php', // Linux/macOS path
    '/Applications/XAMPP/xamppfiles/bin/php' // macOS XAMPP path
];

let phpBinary = 'php'; // Default fallback

// Select first path that physically exists
for (const checkPath of phpSearchPaths) {
    if (checkPath !== 'php') {
        if (fs.existsSync(checkPath)) {
            phpBinary = checkPath;
            break;
        }
    }
}

console.log(`\x1b[35m[ArtVault Launcher]\x1b[0m Using PHP binary at: \x1b[32m${phpBinary}\x1b[0m`);
console.log(`\x1b[35m[ArtVault Launcher]\x1b[0m Starting local development server...`);
console.log(`\x1b[35m[ArtVault Launcher]\x1b[0m Open your browser at: \x1b[36mhttp://localhost:8000\x1b[0m\n`);

const server = spawn(phpBinary, ['-S', 'localhost:8000'], { stdio: 'inherit' });

server.on('error', (err) => {
    console.error('\x1b[31m[ArtVault Launcher Error]\x1b[0m Failed to spawn PHP development server.');
    console.error('Make sure you have XAMPP or PHP installed on your system.');
    console.error(err);
    process.exit(1);
});
