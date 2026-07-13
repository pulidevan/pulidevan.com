<?php
/**
 * book-appointment.php — Secure PHP handler for Appointment Booking.
 * Updates local crm lead file and dispatches a Telegram notification.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';

function escape_html($str) {
    if (!$str) return "";
    return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
}

// Retrieve input
$input = json_decode(file_get_contents('php://input'), true);

$leadId = isset($input['leadId']) ? trim($input['leadId']) : '';
$name = isset($input['name']) ? trim($input['name']) : '';
$phone = isset($input['phone']) ? trim($input['phone']) : '';
$slot = isset($input['slot']) ? trim($input['slot']) : '';
$chatSummary = isset($input['chatSummary']) ? trim($input['chatSummary']) : '';

if (empty($name) || empty($phone) || empty($slot)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields: name, phone, slot.']);
    exit;
}

// ── Update local JSON backup ──────────────────────────────────────────────────
$leadsFile = __DIR__ . '/data/leads.json';
if (file_exists($leadsFile)) {
    $leads = json_decode(file_get_contents($leadsFile), true);
    if (is_array($leads)) {
        $updated = false;
        if (!empty($leadId)) {
            foreach ($leads as &$l) {
                if ($l['id'] === $leadId) {
                    $l['appointmentSlot'] = $slot;
                    $updated = true;
                    break;
                }
            }
        }
        
        if (!$updated) {
            // Add as standalone lead / appointment
            $leads[] = [
                'id' => !empty($leadId) ? $leadId : 'appt-' . uniqid(),
                'name' => $name,
                'phone' => $phone,
                'purpose' => 'Appointment Booking',
                'brief' => [],
                'chatSummary' => $chatSummary,
                'appointmentSlot' => $slot,
                'submittedAt' => date('c')
            ];
        }
        file_put_contents($leadsFile, json_encode($leads, JSON_PRETTY_PRINT));
    }
}

// ── Google Form Sync ────────────────────────────────────────────────────────
submit_to_google_form($name, $phone, $slot, 'Appointment Booking');

// ── Telegram Notification ────────────────────────────────────────────────────
if (TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here' && !empty(TELEGRAM_BOT_TOKEN)) {
    $text =
        "🗓️ <b>New Strategy Call Booked!</b>\n\n" .
        "<b>👤 Name:</b> " . escape_html($name) . "\n" .
        "<b>📱 Phone:</b> <code>" . escape_html($phone) . "</code>\n" .
        "<b>📅 Slot:</b> " . escape_html($slot) . "\n\n" .
        "<b>🕐 Booked at:</b> " . date('Y-m-d H:i:s') . " IST";

    $url = "https://api.telegram.org/bot" . TELEGRAM_BOT_TOKEN . "/sendMessage";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'chat_id' => TELEGRAM_CHAT_ID,
        'text' => $text,
        'parse_mode' => 'HTML'
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_exec($ch);
    curl_close($ch);
}

echo json_encode(['success' => true]);
