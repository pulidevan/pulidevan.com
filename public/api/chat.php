<?php
/**
 * POST /api/chat.php  { messages: [{role: "user"|"model", text}] }
 * Streams the brand assistant's reply from Gemini as Server-Sent Events: data: {"t": "..."} ... data: {"done": true}
 * The API key stays on the server. Rate limited per visitor.
 * No key, or Gemini down: answers come from brand_fallback() so the chat never goes dead.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_brand.php';

require_method('POST');
if (!rate_ok('chat', 40, 600)) fail('You are going fast. Give it a minute and try again.', 429);

// last 12 turns, each capped, alternating roles as Gemini expects
$contents = [];
foreach (array_slice((array) (body()['messages'] ?? []), -12) as $m) {
    if (!is_array($m)) continue;
    $role = ($m['role'] ?? '') === 'model' ? 'model' : 'user';
    $text = str_in($m, 'text', 800);
    if ($text === '') continue;
    if ($contents && end($contents)['role'] === $role) { $contents[count($contents) - 1]['parts'][0]['text'] .= "\n" . $text; continue; }
    $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
}
while ($contents && $contents[0]['role'] !== 'user') array_shift($contents);
if (!$contents || end($contents)['role'] !== 'user') fail('Say something first.');

$key = (string) cfg('GEMINI_API_KEY', '');
$model = (string) cfg('GEMINI_MODEL', 'gemini-3.5-flash');
// Gemini 2.x turns thinking off with a budget; 3.x takes a level. Low thinking = fast first word.
$thinking = str_starts_with($model, 'gemini-2') ? ['thinkingBudget' => 0] : ['thinkingLevel' => (string) cfg('GEMINI_THINKING', 'minimal')];
$payload = [
    'system_instruction' => ['parts' => [['text' => brand_prompt()]]],
    'contents' => $contents,
    'generationConfig' => ['temperature' => 0.8, 'maxOutputTokens' => 400, 'thinkingConfig' => $thinking],
];

// stream: no buffering anywhere between Gemini and the browser
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
while (ob_get_level() > 0) ob_end_flush();
no_cache();
header('Content-Type: text/event-stream; charset=utf-8');
header('X-Accel-Buffering: no');

function emit(array $d): void { echo 'data: ' . json_encode($d, JSON_UNESCAPED_UNICODE) . "\n\n"; @flush(); }

$buf = '';
$sent = false;
if ($key === '') {
    emit(['t' => brand_fallback(end($contents)['parts'][0]['text'])]);
    emit(['done' => true]);
    exit;
}
$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $key],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 45,
    CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$buf, &$sent) {
        $buf .= $chunk;
        while (($pos = strpos($buf, "\n")) !== false) {
            $line = rtrim(substr($buf, 0, $pos), "\r");
            $buf = substr($buf, $pos + 1);
            if (strncmp($line, 'data:', 5) !== 0) continue;
            $j = json_decode(trim(substr($line, 5)), true);
            foreach ($j['candidates'][0]['content']['parts'] ?? [] as $part) {
                if (!empty($part['text']) && empty($part['thought'])) { emit(['t' => $part['text']]); $sent = true; }
            }
        }
        return strlen($chunk);
    },
]);
curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);

if (!$sent) {
    if ($code >= 300 || $err) error_log("chat.php: Gemini HTTP {$code} {$err} " . substr($buf, 0, 300));
    emit(['t' => brand_fallback(end($contents)['parts'][0]['text'])]);
}
emit(['done' => true]);
