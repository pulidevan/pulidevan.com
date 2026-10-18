<?php
/**
 * Shared setup for every endpoint: config, SQLite database, JSON helpers, rate limits, admin session.
 * Files starting with "_" are blocked from the web by api/.htaccess.
 *
 * Secrets come from environment variables, else pp-config.php two levels up (outside the web root:
 * next to public_html on Hostinger, the project root locally), else api/_config.php (blocked from the web
 * by .htaccess, and a PHP file that prints nothing even if it were served). Never commit either file.
 * Data (the SQLite file) goes to pp-data/ two levels up, outside the web root.
 */

declare(strict_types=1);

// errors go to the server log, never into a response
ini_set('display_errors', '0');
ini_set('log_errors', '1');
date_default_timezone_set((string) (getenv('TZ') ?: 'Asia/Kolkata'));

// shared include, not an endpoint (the .htaccess blocks this too, PHP's dev server ignores .htaccess)
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

const PP_ROOT_UP = 2;

function cfg(string $key, $default = null) {
    static $file = null;
    if ($file === null) {
        $file = [];
        foreach ([dirname(__DIR__, PP_ROOT_UP) . '/pp-config.php', __DIR__ . '/_config.php'] as $path) {
            if (is_file($path)) { $file = (array) (require $path); break; }
        }
    }
    $env = getenv($key);
    if ($env !== false && $env !== '') return $env;
    return $file[$key] ?? $default;
}

function data_dir(): string {
    $dir = cfg('DATA_DIR', dirname(__DIR__, PP_ROOT_UP) . '/pp-data');
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0700, true)) {
            $fallback = __DIR__ . '/_data';
            if (!is_dir($fallback)) { @mkdir($fallback, 0700, true); }
            return $fallback;
        }
    }
    return $dir;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new PDO('sqlite:' . data_dir() . '/pp.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
    $pdo->exec(<<<SQL
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            need TEXT NOT NULL DEFAULT '',
            transcript TEXT NOT NULL DEFAULT '[]',
            source TEXT NOT NULL DEFAULT 'chat',
            status TEXT NOT NULL DEFAULT 'pending',      -- pending | returned | paid | contacted
            paid_verified INTEGER NOT NULL DEFAULT 0,      -- 1 once Razorpay confirmed the payment
            payment_id TEXT,
            amount INTEGER,
            paid_at INTEGER,
            notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS leads_email ON leads(email);
        CREATE INDEX IF NOT EXISTS leads_phone ON leads(phone);
        CREATE UNIQUE INDEX IF NOT EXISTS leads_payment ON leads(payment_id) WHERE payment_id IS NOT NULL;
        CREATE TABLE IF NOT EXISTS login_codes (
            email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS hits (
            bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
        );
    SQL);
    return $pdo;
}

/* ---------- request / response ---------- */

function no_cache(): void {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

function send_json($data, int $status = 200): void {
    http_response_code($status);
    no_cache();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): void { send_json(['error' => $message], $status); }

function require_method(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) fail('Method not allowed.', 405);
}

function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, 200000);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function str_in(array $src, string $key, int $max): string {
    $v = isset($src[$key]) && is_scalar($src[$key]) ? trim((string) $src[$key]) : '';
    return mb_substr(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? '', 0, $max);
}

function client_key(): string {
    return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '0', (string) cfg('APP_SECRET', 'pp-local'));
}

/** Fixed-window rate limit. Returns false when the caller is over the limit. */
function rate_ok(string $name, int $limit, int $windowSec): bool {
    $bucket = $name . ':' . client_key();
    $now = time();
    $pdo = db();
    $row = $pdo->prepare('SELECT count, reset_at FROM hits WHERE bucket = ?');
    $row->execute([$bucket]);
    $r = $row->fetch();
    if (!$r || $r['reset_at'] <= $now) {
        $pdo->prepare('REPLACE INTO hits (bucket, count, reset_at) VALUES (?, 1, ?)')->execute([$bucket, $now + $windowSec]);
        return true;
    }
    if ($r['count'] >= $limit) return false;
    $pdo->prepare('UPDATE hits SET count = count + 1 WHERE bucket = ?')->execute([$bucket]);
    return true;
}

/* ---------- normalising contact details, so payments can be matched to leads ---------- */

function norm_email(string $e): string { return strtolower(trim($e)); }

/** Last 10 digits: "+91 74017 81784", "917401781784" and "07401781784" all match. */
function norm_phone(string $p): string {
    $d = preg_replace('/\D+/', '', $p) ?? '';
    return strlen($d) > 10 ? substr($d, -10) : $d;
}

/* ---------- admin session (one allowed email, one-time code by email) ---------- */

function admin_email(): string { return norm_email((string) cfg('ADMIN_EMAIL', 'pulidevan3@gmail.com')); }

function is_local(): bool {
    $h = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    return in_array($h, ['localhost', '127.0.0.1'], true);
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('pp_admin');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict',
        'secure' => !is_local(),
    ]);
    session_start();
}

function require_admin(): void {
    start_session();
    $ok = ($_SESSION['admin'] ?? '') === admin_email() && ($_SESSION['until'] ?? 0) > time();
    if (!$ok) fail('Not signed in.', 401);
    // state-changing admin calls must come from our own page (blocks cross-site form posts)
    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && ($_SERVER['HTTP_X_PP'] ?? '') !== '1') fail('Bad request.', 400);
}

/* ---------- Razorpay ---------- */

function rzp_configured(): bool { return (bool) cfg('RAZORPAY_KEY_ID') && (bool) cfg('RAZORPAY_KEY_SECRET'); }

/** GET a Razorpay API path with the account keys. Returns decoded JSON or null. */
function rzp_get(string $path): ?array {
    if (!rzp_configured()) return null;
    $ch = curl_init('https://api.razorpay.com/v1/' . ltrim($path, '/'));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
        CURLOPT_USERPWD => cfg('RAZORPAY_KEY_ID') . ':' . cfg('RAZORPAY_KEY_SECRET'),
    ]);
    $out = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    if ($out === false || $code >= 300) return null;
    $j = json_decode($out, true);
    return is_array($j) ? $j : null;
}

function price_paise(): int { return (int) cfg('PRICE_PAISE', 99900); }

/** A captured payment for at least the consultation price counts as paid. */
function payment_counts(array $p): bool {
    return ($p['status'] ?? '') === 'captured' && (int) ($p['amount'] ?? 0) >= price_paise() && ($p['currency'] ?? 'INR') === 'INR';
}

/**
 * Attach a verified Razorpay payment to the best matching lead (by email, else phone, newest first).
 * If nobody matches, the payer still becomes a lead, so every paid person shows up in the dashboard.
 * Returns the lead id.
 */
function record_payment(array $p, ?string $preferLeadId = null): string {
    $pdo = db();
    $pid = (string) $p['id'];
    $now = time();
    $paidAt = (int) ($p['created_at'] ?? $now);

    $existing = $pdo->prepare('SELECT id FROM leads WHERE payment_id = ?');
    $existing->execute([$pid]);
    if ($id = $existing->fetchColumn()) return (string) $id;

    $email = norm_email((string) ($p['email'] ?? ''));
    $phone = norm_phone((string) ($p['contact'] ?? ''));
    $id = null;
    if ($preferLeadId) $id = $preferLeadId;
    if (!$id && $email) {
        $q = $pdo->prepare("SELECT id FROM leads WHERE email = ? AND payment_id IS NULL ORDER BY created_at DESC LIMIT 1");
        $q->execute([$email]); $id = $q->fetchColumn() ?: null;
    }
    if (!$id && $phone) {
        $q = $pdo->prepare("SELECT id FROM leads WHERE phone = ? AND payment_id IS NULL ORDER BY created_at DESC LIMIT 1");
        $q->execute([$phone]); $id = $q->fetchColumn() ?: null;
    }
    if ($id) {
        $pdo->prepare("UPDATE leads SET status = CASE WHEN status = 'contacted' THEN status ELSE 'paid' END,
            paid_verified = 1, payment_id = ?, amount = ?, paid_at = ?, updated_at = ? WHERE id = ?")
            ->execute([$pid, (int) $p['amount'], $paidAt, $now, $id]);
        return (string) $id;
    }
    $id = new_id();
    $name = (string) ($p['notes']['name'] ?? $p['notes']['full_name'] ?? '');
    $pdo->prepare("INSERT INTO leads (id, token_hash, created_at, updated_at, name, email, phone, need, source, status, paid_verified, payment_id, amount, paid_at)
        VALUES (?, '', ?, ?, ?, ?, ?, '', 'razorpay', 'paid', 1, ?, ?, ?)")
        ->execute([$id, $paidAt, $now, $name ?: '(paid on Razorpay)', $email, $phone, $pid, (int) $p['amount'], $paidAt]);
    return $id;
}

function new_id(): string { return 'ld_' . bin2hex(random_bytes(8)); }
