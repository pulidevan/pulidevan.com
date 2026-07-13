<?php
/**
 * test-api.php — Server-side diagnostics for Gemini API connection.
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/api/config.php';

echo "=== DIAGNOSTICS START ===\n\n";

echo "1. Checking Configured Constants:\n";
echo "GEMINI_API_KEY length: " . strlen(GEMINI_API_KEY) . "\n";
echo "GEMINI_API_KEY prefix: " . substr(GEMINI_API_KEY, 0, 7) . "...\n";
if (GEMINI_API_KEY === 'your_gemini_api_key_here' || empty(GEMINI_API_KEY)) {
    echo "❌ ERROR: Gemini API Key is still set to placeholder or empty.\n";
} else {
    echo "✅ Gemini API Key is set.\n";
}

echo "TELEGRAM_BOT_TOKEN length: " . strlen(TELEGRAM_BOT_TOKEN) . "\n";
echo "TELEGRAM_CHAT_ID: " . TELEGRAM_CHAT_ID . "\n\n";

echo "2. Checking cURL Extension:\n";
if (!function_exists('curl_init')) {
    echo "❌ ERROR: cURL extension is disabled on this server.\n\n";
} else {
    echo "✅ cURL is enabled.\n\n";
}

echo "3. Testing Gemini API Request with full system instructions & schema:\n";
$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;

$systemInstruction = "You are an AI assistant representing Pulidevan Prabakaran. You speak in the tone of a viral, highly strategic LinkedIn shitposter who relentlessly tethers high-performing brand design with tech automation. Your vibe is elite, high-converting, and THUG but NOT cringe. Drop punchy startup jokes, Kunal Shah references, Cred coin sarcasm, and Infy 70-hour work week comments, while keeping the focus entirely on scaling brands, building custom AI agents, conversion funnels, and organic performance marketing. Use emojis generously! 🚀🔥💸\n\nBased on EVERY chat message from the user, you MUST respond strictly in JSON mapping the user query to the appropriate predefined UI cards from the context below. YOU MUST ALWAYS RETURN AT LEAST ONE CARD in every single response to keep users highly engaged.\n\nNever output raw text outside the JSON schema. Be highly conversational, sarcastic, and punchy in 'responseMessage'.\n\nCONTEXT - PULIDEVAN PRABAKARAN:\nName: Pulidevan Prabakaran\nTagline: Founder @aissentials | Elite MarTech Architect | Building brand behavior over corporate noise | Ex-Founder, Map My Shop\nLocation: Chennai, Tamil Nadu, India\nAbout: \"I built my first company at 20. Co-founding an e-commerce app wasn't just a business venture—it was the start of a career dedicated to bridging the gap between deep tech automation and high-converting marketing. Today, I operate at the intersection of Growth Marketing, Custom AI Agent systems, and conversion-optimized branding. My focus is simple: replace theoretical fluff with automated cash-printing funnels.\"\n\nContact details:\nLinkedIn: https://www.linkedin.com/in/pulidevan\nWhatsApp: https://wa.me/917401781784\nAvatarUrl: https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk\n\nExperience:\n1. Founder at AI Essentials (Mar 2025 - Present). \"3000+ Professionals trained in Generative AI. 100+ AI Projects. 12+ Global clients.\"\n2. Brand Manager at Uptor (May 2024 - Mar 2026).\n3. Brand Manager at LMES Academy (Nov 2023 - Mar 2026).\n4. Digital Marketing Manager at Whoa Mama (Jun 2022 - Nov 2023).\n5. Aerial Cinematographer at Kollywood (Dec 2017 - Nov 2023).\n\nEducation:\n1. Harvard Business School Online: Sustainable Business Strategy (2019-2020)\n2. St' Joseph's Institute Of Technology: B.E. Electronics and Communications (2012-2016)\n\nSkills: Start-up Ventures, Growth Marketing & Brand Strategy, Generative AI & Digital Strategy, Performance Marketing & SEM, Aerial Cinematography\n\nServices: Graphic Design, Brand Consulting, Marketing Strategy, Social Media Marketing, Presentation Design, Pricing Strategy, Lead Generation, Startup Law, Performance Marketing\n\nCRITICAL ROUTING RULES:\n1. If user wants to collaborate, hire, build AI agents, scale branding, or asks to contact/reach out/connect/DM → return LeadFormCard (title: \"Reason for Contact\", description: \"Drop your details and project focus to unlock my direct WhatsApp and LinkedIn.\") — NEVER return ContactCard directly.\n2. If user says \"book\", \"appointment\", \"schedule\", \"call\", \"meeting\", \"slot\" → return AppointmentCard.\n3. If user says \"lol\" or makes a casual non-serious statement → respond with " . '"lol" and empty cards array.' . "\n4. Always return at least one card per response.\n\nCARD FIELD MAPPING:\n- ContactCard → name, tagline, avatarUrl, linkedinUrl, whatsappUrl\n- AboutCard → title, summary\n- ExperienceCard → title, company, duration, description\n- EducationCard → institution, degree, duration\n- SkillCard → category, skills[]\n- ServiceCard → category, services[]\n- PostCard → content, impressions, timeAgo\n- LeadFormCard → title, description\n- AppointmentCard → title, description\n- CertificationCard → name, issuer, date";

$responseSchema = [
    'type' => 'OBJECT',
    'properties' => [
        'responseMessage' => [
            'type' => 'STRING',
            'description' => 'Conversational, punchy AI response text'
        ],
        'cards' => [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'type' => [
                        'type' => 'STRING',
                        'description' => 'Card type: ContactCard | AboutCard | ExperienceCard | SkillCard | PostCard | EducationCard | ServiceCard | CertificationCard | LeadFormCard | AppointmentCard'
                    ],
                    'data' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'name' => ['type' => 'STRING'],
                            'tagline' => ['type' => 'STRING'],
                            'avatarUrl' => ['type' => 'STRING'],
                            'linkedinUrl' => ['type' => 'STRING'],
                            'whatsappUrl' => ['type' => 'STRING'],
                            'title' => ['type' => 'STRING'],
                            'summary' => ['type' => 'STRING'],
                            'company' => ['type' => 'STRING'],
                            'duration' => ['type' => 'STRING'],
                            'description' => ['type' => 'STRING'],
                            'category' => ['type' => 'STRING'],
                            'skills' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                            'content' => ['type' => 'STRING'],
                            'timeAgo' => ['type' => 'STRING'],
                            'impressions' => ['type' => 'STRING'],
                            'link' => ['type' => 'STRING'],
                            'institution' => ['type' => 'STRING'],
                            'degree' => ['type' => 'STRING'],
                            'services' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                            'issuer' => ['type' => 'STRING'],
                            'date' => ['type' => 'STRING']
                        ]
                    ]
                ],
                'required' => ['type', 'data']
            ]
        ]
    ],
    'required' => ['responseMessage', 'cards']
];

$payload = [
    'contents' => [
        [
            'role' => 'user',
            'parts' => [
                ['text' => 'hi']
            ]
        ]
    ],
    'systemInstruction' => [
        'parts' => [
            ['text' => $systemInstruction]
        ]
    ],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'responseSchema' => $responseSchema
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'User-Agent: hostinger-proxy-test'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    echo "❌ ERROR: Curl connection failed: " . $curlError . "\n";
} else {
    echo "HTTP Status Code: " . $httpCode . "\n";
    echo "Raw Response: " . $response . "\n\n";
    
    $responseData = json_decode($response, true);
    if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
        $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'];
        echo "Raw Gemini text response:\n" . $rawText . "\n\n";
        
        $parsed = json_decode($rawText, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            echo "✅ SUCCESS: Response parsed into JSON successfully:\n";
            print_r($parsed);
        } else {
            echo "❌ ERROR: Failed to parse raw text response as JSON: " . json_last_error_msg() . "\n";
        }
    } else {
        echo "❌ ERROR: Response does not contain candidates/content/parts/text.\n";
    }
}

echo "\n=== DIAGNOSTICS END ===\n";
