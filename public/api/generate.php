<?php
/**
 * generate.php — Secure PHP proxy for Gemini AI requests.
 * Parses user prompt, matches direct keyword intents locally (low token/latency),
 * and proxies strategy advice requests to Google Gemini with a compact system instruction.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';

// Retrieve input
$input = json_decode(file_get_contents('php://input'), true);
$prompt = isset($input['prompt']) ? trim($input['prompt']) : '';

if (empty($prompt)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing prompt.']);
    exit;
}

/**
 * Returns predefined UI cards for local keyword routing to bypass LLM token costs.
 * Uses crisp, emoji-free intro lines matching Kunal Shah TOV.
 */
function get_fallback_response($prompt, $returnDefaultOnNoMatch = false) {
    $normalized = strtolower(trim($prompt));
    
    $contactCard = [
        'type' => 'ContactCard',
        'data' => [
            'name' => 'Pulidevan Prabakaran',
            'tagline' => 'Founder @aissentials | Upskilled 8000+ in AI leverage | Architecting brand behavior over noise | Ex-Founder, Map My Shop',
            'avatarUrl' => 'https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk',
            'linkedinUrl' => 'https://www.linkedin.com/in/pulidevan',
            'whatsappUrl' => 'https://wa.me/917401781784'
        ]
    ];

    $aboutCard = [
        'type' => 'AboutCard',
        'data' => [
            'title' => 'About Pulidevan Prabakaran',
            'summary' => 'I built my first company at 20. Co-founding an e-commerce app wasn\'t just a business venture—it was the start of a career dedicated to bridging the gap between technology and marketing. Today, I operate at the intersection of Growth Marketing, Generative AI, and Serial Entrepreneurship. My focus is simple: identify market gaps, build robust solutions, and scale them ruthlessly.'
        ]
    ];

    $appointmentCard = [
        'type' => 'AppointmentCard',
        'data' => [
            'title' => 'Book a 30-min Strategy Call',
            'description' => 'Pick a slot and I\'ll confirm via WhatsApp within 30 minutes.'
        ]
    ];

    $contactLeadCard = [
        'type' => 'LeadFormCard',
        'data' => [
            'title' => 'Reason for Contact',
            'description' => 'Drop your details and project focus to unlock my direct WhatsApp and LinkedIn.'
        ]
    ];

    $skillCard = [
        'type' => 'SkillCard',
        'data' => [
            'category' => 'Core Expertise',
            'skills' => [
                'Start-up Ventures & Early Stage Ventures',
                'Growth Marketing & Brand Strategy',
                'Generative AI & Digital Strategy',
                'Performance Marketing & SEM',
                'Aerial Cinematography'
            ]
        ]
    ];

    $serviceCard = [
        'type' => 'ServiceCard',
        'data' => [
            'category' => 'Services Offered',
            'services' => [
                'Graphic Design',
                'Brand Consulting',
                'Marketing Strategy',
                'Social Media Marketing',
                'Presentation Design',
                'Pricing Strategy',
                'Lead Generation',
                'Startup Law',
                'Performance Marketing'
            ]
        ]
    ];

    $educationCard = [
        'type' => 'EducationCard',
        'data' => [
            'institution' => 'Harvard Business School Online',
            'degree' => 'Sustainable Business Strategy',
            'duration' => '2019-2020'
        ]
    ];

    $experienceCard = [
        'type' => 'ExperienceCard',
        'data' => [
            'title' => 'Founder',
            'company' => 'AI Essentials',
            'duration' => 'Mar 2025 - Present',
            'description' => '3000+ Professionals trained in Generative AI. 100+ AI Projects. 12+ Global clients. Ex-Founder, Map My Shop'
        ]
    ];

    $postCard1 = [
        'type' => 'PostCard',
        'data' => [
            'content' => 'Google just reminded me where I parked my car. I didn\'t save the location... Because of small features that solve problems before I realize I have one.',
            'impressions' => '2,003',
            'timeAgo' => 'Recent Post'
        ]
    ];

    $postCard2 = [
        'type' => 'PostCard',
        'data' => [
            'content' => 'Kunal Shah just declared war on spam marketers... WhatsApp usernames are coming... If your WhatsApp and Instagram identities become connected, Meta knows exactly who to target.',
            'impressions' => '94,986',
            'timeAgo' => 'Recent Post'
        ]
    ];

    if (preg_match('/^lol[!.?]*$/i', $normalized)) {
        return ['responseMessage' => 'lol', 'cards' => []];
    }

    if (preg_match('/book|appointment|call|schedule|meeting|slot|calendar/i', $normalized)) {
        return [
            'responseMessage' => 'Most meetings are status updates that could be emails. Let\'s make this 30 minutes count. Pick a slot.',
            'cards' => [$appointmentCard]
        ];
    }

    if (preg_match('/hire|work|collab|join|agency|grow|scale|project|build/i', $normalized)) {
        return [
            'responseMessage' => 'Building requires leverage. Tell me what bottleneck we are solving.',
            'cards' => [$contactLeadCard]
        ];
    }

    if (preg_match('/course|class|masterclass|learn|cohort|upskill|train|teach|team/i', $normalized)) {
        return [
            'responseMessage' => 'The GenAI Full Stack program is built for builders, not spectators. It takes you from writing simple prompts to deploying autonomous multi-agent systems and automated branding engines. Choose who you want to train below to get details.',
            'cards' => [[
                'type' => 'LeadFormCard',
                'data' => [
                    'title' => 'GenAI Full Stack & Team Training',
                    'description' => 'Select your upskilling target to get customized course blueprints and direct cohort details.'
                ]
            ]]
        ];
    }

    if (preg_match('/contact|email|phone|whatsapp|linkedin|reach|call|connect|dm/i', $normalized)) {
        return [
            'responseMessage' => 'Attention is the rarest currency. Let me know what you are building to connect.',
            'cards' => [$contactLeadCard]
        ];
    }

    if (preg_match('/career|founder history|background|previous company|map my shop|uptor|lmes/i', $normalized)) {
        return [
            'responseMessage' => 'Here is my execution record. Proof over theory.',
            'cards' => [$experienceCard]
        ];
    }

    if (preg_match('/skill|expertise|what can you do|good at|tech|tools/i', $normalized)) {
        return [
            'responseMessage' => 'Skills are inputs. Business outcomes are outputs. Here is what we deploy.',
            'cards' => [$skillCard, $serviceCard]
        ];
    }

    if (preg_match('/service|offer|consult|branding|marketing|agentic|agency|requirement/i', $normalized)) {
        return [
            'responseMessage' => 'We don\'t offer standard agency services. We build high-leverage brand engines, automated marketing workflows, and custom AI agents that scale without human effort. Choose your focus area below to configure your solution.',
            'cards' => [$serviceCard, $contactLeadCard]
        ];
    }

    if (preg_match('/post|linkedin|thought|kunal|murthy|scam|tweet|write/i', $normalized)) {
        return [
            'responseMessage' => 'Here are some observations on distribution, incentives, and human behavior.',
            'cards' => [$postCard2, $postCard1]
        ];
    }

    if (preg_match('/education|school|college|harvard|degree|study/i', $normalized)) {
        return [
            'responseMessage' => 'Academic pedigree signal-matches. Execution value-matches. Here is mine.',
            'cards' => [$educationCard, $aboutCard]
        ];
    }

    if (preg_match('/about|who are you|who is|bio|story/i', $normalized)) {
        return [
            'responseMessage' => 'I build systems that scale without proportional human effort. Details below.',
            'cards' => [$aboutCard]
        ];
    }

    if ($returnDefaultOnNoMatch) {
        return [
            'responseMessage' => 'Tell me what you are building or breaking. Let\'s look at the bottlenecks.',
            'cards' => [$contactLeadCard]
        ];
    }

    return null;
}

// 1. Check local fallback routing first (low latency, zero tokens)
$matched = get_fallback_response($prompt);
if ($matched !== null) {
    echo json_encode($matched);
    exit;
}

// 2. Fall back to Gemini API for complex or conversational advice
if (GEMINI_API_KEY === 'your_gemini_api_key_here' || empty(GEMINI_API_KEY)) {
    // If key is missing, return the default offline response
    echo json_encode(get_fallback_response($prompt, true));
    exit;
}

$systemInstruction = <<<TEXT
# System Instruction: Strategic AI Chief of Staff & Consultant for Pulidevan Prabakaran

You are the strategic advisor and AI consultant to Pulidevan Prabakaran, founder of AI Essentials. Respond strictly in JSON mapping the user query to the appropriate predefined UI cards.

## Core Identity & Mission
- You act as an expert on branding, agentic development, automation, and full-stack agency requirements.
- The philosophy is: "Stop studying AI. Start deploying it." AI is leverage/labor, and systems beat effort.
- Your goal is to guide users to solve business problems with AI, automate workflows, deploy AI agents, or learn AI via our cohort.

## Weekly Curriculum / Cohort Knowledge
- The "GenAI Full Stack" program is built for upskilling individuals or corporate teams to build and deploy complex multi-agent systems and branding funnels.
- If the user wants to learn or teach their team, pitch the cohort program and return the LeadFormCard pre-set for training.

## Tone & Style
- Style: Kunal Shah style (first-principles, leverage-focused, intellectually honest).
- Tone: Professional, punchy, crisp. No emojis.
- Response format: json object with keys "responseMessage" (text string) and "cards" (array of card objects).

## Predefined Cards Schema
- LeadFormCard: data = { title: "Reason for Contact", description: "Drop your details and project focus to unlock my direct WhatsApp and LinkedIn." }
- AppointmentCard: data = { title: "Book a 30-min Strategy Call", description: "Pick a slot and I'll confirm via WhatsApp within 30 minutes." }
- ContactCard: data = { name: "Pulidevan Prabakaran", tagline: "Founder @aissentials | Upskilled 8000+ in AI leverage | Architecting brand behavior over noise", avatarUrl: "https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk", linkedinUrl: "https://www.linkedin.com/in/pulidevan", whatsappUrl: "https://wa.me/917401781784" }
- AboutCard: data = { title: "About Pulidevan Prabakaran", summary: "Built first company at 20. Ex-Founder of Map My Shop. Today, I operate at the intersection of Growth Marketing, Generative AI, and Serial Entrepreneurship." }
- ExperienceCard: data = { title: "Founder", company: "AI Essentials", duration: "Mar 2025 - Present", description: "3000+ Professionals trained in Generative AI. 100+ AI Projects. 12+ Global clients." }
- SkillCard: data = { category: "Core Expertise", skills: ["Start-up Ventures", "Growth Marketing", "Generative AI", "Performance Marketing", "Aerial Cinematography"] }
- ServiceCard: data = { category: "Services Offered", services: ["Graphic Design", "Brand Consulting", "Marketing Strategy", "Social Media Marketing", "Presentation Design", "Pricing Strategy", "Lead Generation", "Startup Law", "Performance Marketing"] }
- PostCard: data = { content: "Google just reminded me where I parked my car. I didn't save the location... Because of small features that solve problems before I realize I have one.", impressions: "2,003", timeAgo: "Recent Post" }
- EducationCard: data = { institution: "Harvard Business School Online", degree: "Sustainable Business Strategy", duration: "2019-2020" }

## Routing Rules
- If user wants to collaborate, hire, build AI agents, scale branding, or asks to contact/reach out/connect/DM → return LeadFormCard.
- If user wants to learn, study AI, join the cohort, or train/teach their team → return LeadFormCard (with title 'GenAI Full Stack & Team Training').
- If user says "book", "appointment", "schedule", "call", "meeting", "slot" → return AppointmentCard.
- If the user query is conversational, general chat, or does not match any card topics, return an empty array for cards.
TEXT;

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
                        'description' => 'Card type: ContactCard | AboutCard | ExperienceCard | SkillCard | PostCard | EducationCard | ServiceCard | LeadFormCard | AppointmentCard'
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
                            'services' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']]
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
                ['text' => $prompt]
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

$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'User-Agent: hostinger-proxy'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode >= 400) {
    // If the API call fails, cleanly fall back to the default local card
    echo json_encode(get_fallback_response($prompt, true));
    exit;
}

$responseData = json_decode($response, true);

if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
    $rawText = $responseData['candidates'][0]['content']['parts'][0]['text'];
    $parsed = json_decode($rawText, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        if (!isset($parsed['cards']) || !is_array($parsed['cards'])) {
            $parsed['cards'] = [];
        }
        echo json_encode($parsed);
    } else {
        echo $rawText;
    }
} else {
    echo json_encode(get_fallback_response($prompt, true));
}
