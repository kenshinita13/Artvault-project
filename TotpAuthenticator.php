<?php
/**
 * TotpAuthenticator.php
 * Native RFC-6238 compliant Time-Based One-Time Password Helper
 */

class TotpAuthenticator {
    private static $base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Generate a random Base32 secret key.
     */
    public static function generateSecret($length = 16) {
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= self::$base32Chars[random_int(0, 31)];
        }
        return $secret;
    }

    /**
     * Decode a Base32 string to binary.
     */
    private static function base32Decode($base32) {
        $base32 = strtoupper($base32);
        $base32 = str_replace('=', '', $base32);
        
        $binary = '';
        foreach (str_split($base32) as $char) {
            $pos = strpos(self::$base32Chars, $char);
            if ($pos === false) continue;
            $binary .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        
        $bytes = '';
        foreach (str_split($binary, 8) as $byte) {
            if (strlen($byte) < 8) break;
            $bytes .= chr(bindec($byte));
        }
        return $bytes;
    }

    /**
     * Generate the TOTP code for a secret and time slice.
     */
    public static function getCode($secret, $timeSlice = null) {
        if ($timeSlice === null) {
            $timeSlice = floor(time() / 30);
        }
        
        $secretKey = self::base32Decode($secret);
        
        // Pack time slice into 64-bit binary string
        $time = pack('N*', 0) . pack('N*', $timeSlice);
        
        // Calculate HMAC-SHA1 hash
        $hash = hash_hmac('sha1', $time, $secretKey, true);
        
        // Dynamic Truncation
        $offset = ord(substr($hash, -1)) & 0x0F;
        $hashpart = substr($hash, $offset, 4);
        
        // Unpack value
        $value = unpack('N', $hashpart);
        $value = $value[1] & 0x7FFFFFFF;
        
        $code = $value % 1000000;
        return str_pad($code, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Verify user code with allowed discrepancy window.
     */
    public static function verifyCode($secret, $code, $discrepancy = 1) {
        $currentTimeSlice = floor(time() / 30);
        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = self::getCode($secret, $currentTimeSlice + $i);
            if ($calculatedCode === $code) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate a quickchart QR Code URL for an Authenticator App.
     */
    public static function getQrCodeUrl($name, $issuer, $secret) {
        $url = 'otpauth://totp/' . rawurlencode($issuer) . ':' . rawurlencode($name) . '?secret=' . $secret . '&issuer=' . rawurlencode($issuer);
        return 'https://quickchart.io/chart?cht=qr&chs=250x250&chl=' . urlencode($url);
    }
}
