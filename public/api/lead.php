<?php
/**
 * POST /api/lead.php
 * Submits a pre-consultation lead to the SQLite database.
 * Body: { name, phone, email, need, transcript }
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

require_method('POST');

// Rate limit: max 10 leads per 10 minutes per IP
if (!rate_ok('lead_submit', 10, 600)) {
    fail('Too many requests. Please wait a few minutes.', 429);
}

$in = body();
$name = str_in($in, 'name', 100);
$phone = str_in($in, 'phone', 30);
$email = norm_email(str_in($in, 'email', 160));
$need = str_in($in, 'need', 1000);
$transcript = isset($in['transcript']) && is_array($in['transcript']) ? $in['transcript'] : [];

if (empty($name)) {
    fail('Please enter your name.', 400);
}

$cleanPhone = norm_phone($phone);
if (strlen($cleanPhone) < 10) {
    fail('Please enter a valid 10-digit WhatsApp/phone number.', 400);
}

$id = new_id();
$now = time();
$pdo = db();

$stmt = $pdo->prepare("INSERT INTO leads (id, token_hash, created_at, updated_at, name, email, phone, need, transcript, source, status, paid_verified)
    VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, 'pre_consult', 'pending', 0)");
$stmt->execute([
    $id,
    $now,
    $now,
    $name,
    $email,
    $phone,
    $need ?: 'Free pre-consultation requested',
    json_encode($transcript, JSON_UNESCAPED_UNICODE)
]);

// Notification email to admin
$adminEmail = admin_email();
$mailFrom = (string) cfg('MAIL_FROM', 'no-reply@pulidevan.com');
$subject = "New Pre-Consultation Lead: {$name}";
$message = "New Pre-Consultation Lead received on pulidevan.com:\n\n"
    . "Name: {$name}\n"
    . "Phone: {$phone}\n"
    . "Email: {$email}\n"
    . "Requirement: {$need}\n"
    . "Time: " . date('Y-m-d H:i:s') . "\n\n"
    . "View in Dashboard: https://pulidevan.com/admin.html";

@mail($adminEmail, $subject, $message, "From: Pulidevan Prabakaran site <{$mailFrom}>\r\nContent-Type: text/plain; charset=utf-8");

send_json([
    'ok' => true,
    'id' => $id,
    'message' => 'Your pre-consultation request has been received. Pulidevan\'s team will reach out shortly!'
]);
