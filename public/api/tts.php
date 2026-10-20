<?php
/**
 * POST /api/tts.php  { text: "..." }
 * Synthesizes ultra-realistic voice for Pulidevan Prabakaran using Google Gemini 3.8 Flash TTS
 * Model: gemini-3.8-flash-tts
 * Returns JSON: { audio: "data:audio/wav;base64,..." }
 * Caches output on disk by hash of voice and text to ensure instant replay and save API calls.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

require_method('POST');
if (!rate_ok('tts', 60, 300)) fail('You are going fast. Give it a moment.', 429);

$raw = str_in(body(), 'text', 1200);
if ($raw === '') fail('No text provided');

// Strip cards, chips, and markup before speaking
$text = preg_replace('/<chips>[\s\S]*?<\/chips>/i', '', $raw);
$text = preg_replace('/<(book|offer|videos)\s*\/?>/i', '', $text);
$text = strip_tags($text);
// Strip emojis to prevent them being spoken out loud awkwardly
$text = preg_replace('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{1F900}-\x{1F9FF}\x{1F018}-\x{1F270}\x{2388}\x{200D}\x{FE0F}]/u', '', $text);
$text = trim(preg_replace('/\s+/', ' ', $text));

if ($text === '') {
    send_json(['audio' => null]);
}

$cacheDir = sys_get_temp_dir() . '/pp_tts_cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);

$voice = (string) cfg('GEMINI_TTS_VOICE', 'Puck');
$cacheKey = md5($voice . ':' . $text);
$cacheFile = $cacheDir . '/pp_' . $cacheKey . '.wav';

if (is_file($cacheFile) && filesize($cacheFile) > 100) {
    send_json(['audio' => 'data:audio/wav;base64,' . base64_encode((string) file_get_contents($cacheFile))]);
}

$key = (string) cfg('GEMINI_API_KEY', '');
if ($key === '') {
    fail('Gemini TTS is not configured (missing GEMINI_API_KEY).', 503);
}

$model = (string) cfg('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts');
$payload = [
    'contents' => [
        [
            'role' => 'user',
            'parts' => [
                [
                    'text' => $text,
                    'speech_metadata' => [
                        'style' => 'warm, confident, articulate, conversational pace'
                    ]
                ]
            ]
        ]
    ],
    'generationConfig' => [
        'responseModalities' => ['AUDIO'],
        'speechConfig' => [
            'voiceConfig' => [
                'voice' => $voice
            ]
        ]
    ]
];

$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $key],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 25,
]);

$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);

if ($code !== 200 || $err) {
    error_log("tts.php: Gemini TTS HTTP {$code} {$err} " . substr((string) $res, 0, 300));
    fail('Audio generation failed.', 502);
}

$data = json_decode((string) $res, true);
$b64 = $data['candidates'][0]['content']['parts'][0]['inlineData']['data'] ?? null;
if (!$b64) {
    fail('No audio data received from Gemini.', 502);
}

$audioBytes = base64_decode((string) $b64);
@file_put_contents($cacheFile, $audioBytes);

send_json(['audio' => 'data:audio/wav;base64,' . $b64]);
