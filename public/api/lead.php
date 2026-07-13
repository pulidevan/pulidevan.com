<?php
/**
 * lead.php — Secure PHP handler for Lead Form submissions.
 * Saves lead data locally and dispatches a Telegram notification.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';

// Helper to escape HTML safely for Telegram
function escape_html($str) {
    if (!$str) return "";
    return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
}

// Retrieve input
$input = json_decode(file_get_contents('php://input'), true);

$name = isset($input['name']) ? trim($input['name']) : '';
$phone = isset($input['phone']) ? trim($input['phone']) : '';
$purpose = isset($input['purpose']) ? trim($input['purpose']) : '';
$brief = isset($input['brief']) ? $input['brief'] : [];
$chatSummary = isset($input['chatSummary']) ? trim($input['chatSummary']) : '';
$leadId = isset($input['leadId']) ? trim($input['leadId']) : '';
$summary = isset($input['summary']) ? trim($input['summary']) : '';

if (empty($name) || empty($phone) || empty($purpose)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields: name, phone, purpose.']);
    exit;
}

if (empty($leadId)) {
    $leadId = 'lead-' . uniqid();
}

// ── Save to local JSON backup (server-side persistence) ──────────────────────
$dataDir = __DIR__ . '/data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0755, true);
    // Write a .htaccess inside data dir to prevent direct web access to the json files
    file_put_contents($dataDir . '/.htaccess', "Order deny,allow\nDeny from all\n");
}

$leadsFile = $dataDir . '/leads.json';
$leads = [];
if (file_exists($leadsFile)) {
    $leads = json_decode(file_get_contents($leadsFile), true);
    if (!is_array($leads)) $leads = [];
}

$newLead = [
    'id' => $leadId,
    'name' => $name,
    'phone' => $phone,
    'purpose' => $purpose,
    'brief' => $brief,
    'chatSummary' => $chatSummary,
    'submittedAt' => date('c')
];
$leads[] = $newLead;
file_put_contents($leadsFile, json_encode($leads, JSON_PRETTY_PRINT));

// ── Google Form Sync ────────────────────────────────────────────────────────
submit_to_google_form($name, $phone, '', $purpose);

// ── Telegram Notification ────────────────────────────────────────────────────
if (TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here' && !empty(TELEGRAM_BOT_TOKEN)) {
    $briefText = "<i>No brief details provided.</i>";
    if (!empty($summary)) {
        $briefText = escape_html($summary);
    } else if (!empty($brief) && is_array($brief)) {
        $briefLines = [];
        foreach ($brief as $k => $v) {
            $briefLines[] = "<b>• " . escape_html($k) . ":</b>\n  " . escape_html($v);
        }
        if (!empty($briefLines)) {
            $briefText = implode("\n\n", $briefLines);
        }
    }

    $text =
        "🚨 <b>New Elite MarTech Lead!</b> 🚨\n\n" .
        "<b>👤 Name:</b> " . escape_html($name) . "\n" .
        "<b>📱 Phone:</b> <code>" . escape_html($phone) . "</code>\n" .
        "<b>🎯 Focus:</b> " . escape_html($purpose) . "\n\n" .
        "<b>📋 Project Brief:</b>\n" . $briefText . "\n\n" .
        "<b>💬 Chat Context:</b>\n<i>" . escape_html(substr($chatSummary, -500)) . "</i>\n\n" .
        "<b>🕐 Submitted:</b> " . date('Y-m-d H:i:s') . " IST\n" .
        "<b>🆔 Lead ID:</b> <code>" . substr($leadId, 0, 8) . "</code>";

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
    $res = curl_exec($ch);
    curl_close($ch);
}

echo json_encode(['success' => true, 'leadId' => $leadId]);
