<?php
/**
 * config.php — Secure configuration for PHP backend on Hostinger.
 *
 * Stored as a PHP file so that even if requested directly, the server
 * executes it and outputs nothing, keeping keys 100% hidden.
 */

// Define your secrets here (Hostinger production values)
// First, check if environment variables are set on the server,
// otherwise fallback to the hardcoded production keys.
$gemini_key = getenv('GEMINI_API_KEY') ?: getenv('VITE_GEMINI_API_KEY') ?: 'AIzaSyDXqBo5wgywEgrJc81vTgRDEjEilHEz--o';
$telegram_token = getenv('TELEGRAM_BOT_TOKEN') ?: getenv('VITE_TELEGRAM_BOT_TOKEN') ?: '8553652279:AAHaQqdxeJmxymkyD6b83LuhmpIPzDNkyuk';
$telegram_chat_id = getenv('TELEGRAM_CHAT_ID') ?: getenv('VITE_TELEGRAM_CHAT_ID') ?: '5335324120';

define('GEMINI_API_KEY', $gemini_key);
define('TELEGRAM_BOT_TOKEN', $telegram_token);
define('TELEGRAM_CHAT_ID', $telegram_chat_id);

// Optional: Set to true if you want to log debug info to a file
define('DEBUG_MODE', false);

/**
 * Submits lead or appointment details to the specified Google Form.
 */
function submit_to_google_form($name, $phone, $slot = '', $purpose = '') {
    $formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSf2gFuWNcklR8HxVlRPGTdDgeOVOehaWp24rOV4G8x_cT4CPg/formResponse";
    
    $postData = [
        'entry.260752886' => $name,
        'entry.1424095713' => $phone,
        'entry.1576619686' => $slot,
        'entry.2107841368' => $purpose,
    ];
    
    $ch = curl_init($formUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    if (DEBUG_MODE) {
        error_log("Google Form Sync Response: " . print_r($response, true));
    }
    
    return $response !== false;
}

