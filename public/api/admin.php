<?php
/**
 * /api/admin.php?action=...  — the dashboard's backend. Only ADMIN_EMAIL (pulidevan3@gmail.com) can sign in.
 *
 * Sign in: send-code (emails a 6-digit code, valid 10 min, 5 tries) → verify → session cookie (12 h).
 * Then: me, leads, update, sync (pull captured payments from Razorpay and match them), export (CSV), logout.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
const SESSION_HOURS = 12;

switch ($action) {

case 'send-code': {
    require_method('POST');
    if (!rate_ok('code', 5, 900)) fail('Too many codes requested. Wait 15 minutes.', 429);
    $email = norm_email(str_in(body(), 'email', 160));
    // same answer either way, so the page doesn't reveal which email is the admin
    $reply = ['ok' => true, 'message' => 'If that email can sign in, a code is on its way.'];
    if ($email !== admin_email()) send_json($reply);

    $code = (string) random_int(100000, 999999);
    db()->prepare('REPLACE INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)')
        ->execute([$email, password_hash($code, PASSWORD_DEFAULT), time() + 600]);

    if (is_local()) {
        // no mail server locally: the code goes to the PHP terminal instead
        error_log("pp admin sign-in code for {$email}: {$code}");
        $reply['message'] = 'Local mode: the code is printed in the PHP server terminal.';
        send_json($reply);
    }
    $from = (string) cfg('MAIL_FROM', 'no-reply@pulidevan.com');
    $sent = mail($email, "Your sign-in code: {$code}",
        "Your pulidevan.com dashboard code is {$code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.",
        "From: Pulidevan Prabakaran site <{$from}>\r\nContent-Type: text/plain; charset=utf-8");
    if (!$sent) error_log('admin.php: mail() failed for sign-in code');
    send_json($reply);
}

case 'verify': {
    require_method('POST');
    if (!rate_ok('verify', 10, 900)) fail('Too many tries. Wait 15 minutes.', 429);
    $in = body();
    $email = norm_email(str_in($in, 'email', 160));
    $code = preg_replace('/\D/', '', str_in($in, 'code', 12));
    $q = db()->prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?');
    $q->execute([$email]);
    $row = $q->fetch();
    if (!$row || $row['expires_at'] < time() || $row['attempts'] >= 5) fail('Code expired. Ask for a new one.', 401);
    if (!password_verify($code, $row['code_hash'])) {
        db()->prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?')->execute([$email]);
        fail('Wrong code.', 401);
    }
    db()->prepare('DELETE FROM login_codes WHERE email = ?')->execute([$email]);
    start_session();
    session_regenerate_id(true);
    $_SESSION['admin'] = $email;
    $_SESSION['until'] = time() + SESSION_HOURS * 3600;
    send_json(['ok' => true, 'email' => $email]);
}

case 'logout': {
    require_method('POST');
    start_session();
    $_SESSION = [];
    session_destroy();
    send_json(['ok' => true]);
}

case 'me': {
    require_admin();
    send_json(['email' => admin_email(), 'razorpay' => rzp_configured()]);
}

case 'leads': {
    require_admin();
    $filter = $_GET['filter'] ?? 'paid';
    $where = [
        'paid' => "(paid_verified = 1 OR status = 'paid') AND status != 'contacted'",
        'returned' => "status = 'returned'",
        'pending' => "status = 'pending'",
        'contacted' => "status = 'contacted'",
        'all' => '1 = 1',
    ][$filter] ?? 'paid_verified = 1';
    $rows = db()->query("SELECT id, created_at, name, email, phone, need, transcript, source, status, paid_verified, payment_id, amount, paid_at, notes
        FROM leads WHERE {$where} ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 500")->fetchAll();
    foreach ($rows as &$r) $r['transcript'] = json_decode($r['transcript'] ?: '[]', true);
    $counts = db()->query("SELECT
        SUM((paid_verified = 1 OR status = 'paid') AND status != 'contacted') AS paid, SUM(status = 'returned') AS returned, SUM(status = 'pending') AS pending,
        SUM(status = 'contacted') AS contacted, COUNT(*) AS total FROM leads")->fetch();
    send_json(['leads' => $rows, 'counts' => array_map('intval', $counts)]);
}

case 'update': {
    require_method('POST');
    require_admin();
    $in = body();
    $status = str_in($in, 'status', 20);
    if (!in_array($status, ['pending', 'returned', 'paid', 'contacted'], true)) fail('Unknown status.');
    db()->prepare('UPDATE leads SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
        ->execute([$status, str_in($in, 'notes', 2000), time(), str_in($in, 'id', 40)]);
    send_json(['ok' => true]);
}

case 'sync': {
    require_method('POST');
    require_admin();
    if (!rzp_configured()) fail('Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to pp-config.php first.', 400);
    $from = time() - 90 * 86400;
    $matched = 0; $seen = 0;
    for ($skip = 0; $skip < 1000; $skip += 100) {
        $page = rzp_get("payments?count=100&skip={$skip}&from={$from}");
        if ($page === null) fail('Razorpay did not answer. Check the API keys.', 502);
        foreach ($page['items'] ?? [] as $p) {
            $seen++;
            if (payment_counts($p)) { record_payment($p); $matched++; }
        }
        if (count($page['items'] ?? []) < 100) break;
    }
    send_json(['ok' => true, 'checked' => $seen, 'paid' => $matched]);
}

case 'export': {
    require_admin();
    no_cache();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pulidevan-leads-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['created', 'name', 'email', 'whatsapp', 'looking for', 'status', 'paid (verified)', 'payment id', 'amount (INR)', 'paid at', 'notes'], ',', '"', '\\');
    foreach (db()->query('SELECT * FROM leads ORDER BY created_at DESC') as $r) {
        // leading = + - @ would run as a formula in Excel/Sheets
        $safe = fn($v) => preg_match('/^[=+\-@]/', (string) $v) ? "'" . $v : $v;
        fputcsv($out, array_map($safe, [
            date('Y-m-d H:i', (int) $r['created_at']), $r['name'], $r['email'], $r['phone'], $r['need'], $r['status'],
            $r['paid_verified'] ? 'yes' : 'no', $r['payment_id'], $r['amount'] ? $r['amount'] / 100 : '',
            $r['paid_at'] ? date('Y-m-d H:i', (int) $r['paid_at']) : '', $r['notes'],
        ]), ',', '"', '\\');
    }
    exit;
}

default:
    fail('Unknown action.', 404);
}
