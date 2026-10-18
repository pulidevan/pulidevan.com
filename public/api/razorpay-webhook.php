<?php
/**
 * POST /api/razorpay-webhook.php — optional, the most reliable way to catch payments.
 * Razorpay Dashboard → Settings → Webhooks → URL https://pulidevan.com/api/razorpay-webhook.php,
 * event "payment.captured", secret = RAZORPAY_WEBHOOK_SECRET in pp-config.php.
 * The signature is checked, so only Razorpay can mark someone as paid here.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

require_method('POST');
$secret = (string) cfg('RAZORPAY_WEBHOOK_SECRET', '');
if ($secret === '') fail('Webhook not configured.', 503);

$raw = file_get_contents('php://input') ?: '';
$sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
if (!hash_equals(hash_hmac('sha256', $raw, $secret), $sig)) fail('Bad signature.', 401);

$event = json_decode($raw, true);
$p = $event['payload']['payment']['entity'] ?? null;
if (($event['event'] ?? '') === 'payment.captured' && is_array($p) && payment_counts($p)) {
    record_payment($p);
}
send_json(['ok' => true]);
