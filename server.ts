import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config();

// ── Gemini AI client (Lazy Initialization to prevent startup crashes) ─────────
let ai: GoogleGenAI | null = null;
const getGeminiClient = () => {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    return ai;
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
    return null;
  }
};

// ── In-memory CRM store ───────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  brief: Record<string, string>;
  chatSummary: string;
  appointmentSlot?: string;
  submittedAt: string;
}

const crmLeads: Lead[] = [];

// ── HTML escaping utility ─────────────────────────────────────────────────────
function escapeHTML(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Safe JSON parse ───────────────────────────────────────────────────────────
function safeJSONParse(text: string | null | undefined): any {
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Telegram send helper ──────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  let token = (process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
  let chatId = (process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || "").trim();

  // Strip accidental surrounding quotes from env values
  const stripQuotes = (s: string) =>
    s.replace(/^["']|["']$/g, "").trim();
  token = stripQuotes(token);
  chatId = stripQuotes(chatId);

  if (!token || !chatId) {
    return {
      ok: false,
      error: "Telegram configuration missing. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Secrets.",
    };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Telegram API error:", errBody);
      return { ok: false, error: `Telegram rejected: ${errBody}` };
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Telegram fetch error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── Offline fallback responses ────────────────────────────────────────────────
function getFallbackResponse(prompt: string, returnDefaultOnNoMatch = false) {
  const normalized = prompt.toLowerCase();

  const contactCard = {
    type: "ContactCard" as const,
    data: {
      name: "Pulidevan Prabakaran",
      tagline: "Founder @aissentials | Upskilled 8000+ in AI leverage | Architecting brand behavior over noise | Ex-Founder, Map My Shop",
      avatarUrl: "https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk",
      linkedinUrl: "https://www.linkedin.com/in/pulidevan",
      whatsappUrl: "https://wa.me/917401781784",
    },
  };

  const aboutCard = {
    type: "AboutCard" as const,
    data: {
      title: "About Pulidevan Prabakaran",
      summary: "I built my first company at 20. Co-founding an e-commerce app wasn't just a business venture—it was the start of a career dedicated to bridging the gap between technology and marketing. Today, I operate at the intersection of Growth Marketing, Generative AI, and Serial Entrepreneurship. My focus is simple: identify market gaps, build robust solutions, and scale them ruthlessly.",
    },
  };

  const leadCard = {
    type: "LeadFormCard" as const,
    data: {
      title: "Become 100x Productive",
      description: "Drop your number. We'll make you so productive.",
    },
  };

  const appointmentCard = {
    type: "AppointmentCard" as const,
    data: {
      title: "Book a 30-min Strategy Call",
      description: "Pick a slot and I'll confirm via WhatsApp within 30 minutes.",
    },
  };

  const contactLeadCard = {
    type: "LeadFormCard" as const,
    data: {
      title: "Reason for Contact",
      description: "Drop your details and project focus to unlock my direct WhatsApp and LinkedIn.",
    },
  };

  const skillCard = {
    type: "SkillCard" as const,
    data: {
      category: "Core Expertise",
      skills: [
        "Start-up Ventures & Early Stage Ventures",
        "Growth Marketing & Brand Strategy",
        "Generative AI & Digital Strategy",
        "Performance Marketing & SEM",
        "Aerial Cinematography",
      ],
    },
  };

  const serviceCard = {
    type: "ServiceCard" as const,
    data: {
      category: "Services Offered",
      services: [
        "Graphic Design",
        "Brand Consulting",
        "Marketing Strategy",
        "Social Media Marketing",
        "Presentation Design",
        "Pricing Strategy",
        "Lead Generation",
        "Startup Law",
        "Performance Marketing",
      ],
    },
  };

  const educationCard = {
    type: "EducationCard" as const,
    data: {
      institution: "Harvard Business School Online",
      degree: "Sustainable Business Strategy",
      duration: "2019-2020",
    },
  };

  const experienceCard = {
    type: "ExperienceCard" as const,
    data: {
      title: "Founder",
      company: "AI Essentials",
      duration: "Mar 2025 - Present",
      description: "3000+ Professionals trained in Generative AI. 100+ AI Projects architected and deployed. 12+ Global clients served via high-end branding and automation. Ex-Founder, Map My Shop.",
    },
  };

  const postCard1 = {
    type: "PostCard" as const,
    data: {
      content: "Google just reminded me where I parked my car. I didn't save the location... Because of small features that solve problems before I realize I have one.",
      impressions: "2,003",
      timeAgo: "Recent Post",
    },
  };

  const postCard2 = {
    type: "PostCard" as const,
    data: {
      content: "Kunal Shah just declared war on spam marketers... WhatsApp usernames are coming... If your WhatsApp and Instagram identities become connected, Meta knows exactly who to target.",
      impressions: "94,986",
      timeAgo: "Recent Post",
    },
  };

  if (/^lol[!.?]*$/i.test(normalized.trim())) {
    return { responseMessage: "lol", cards: [] };
  }

  if (/book|appointment|call|schedule|meeting|slot|calendar/i.test(normalized)) {
    return {
      responseMessage: "Most meetings are status updates that could be emails. Let's make this 30 minutes count. Pick a slot.",
      cards: [appointmentCard],
    };
  }

  if (/hire|work|collab|join|agency|grow|scale|project|build/i.test(normalized)) {
    return {
      responseMessage: "Building requires leverage. Tell me what bottleneck we are solving.",
      cards: [contactLeadCard],
    };
  }

  if (/course|class|masterclass|learn|cohort|upskill|train|teach|team/i.test(normalized)) {
    return {
      responseMessage: "The GenAI Full Stack program is built for builders, not spectators. It takes you from writing simple prompts to deploying autonomous multi-agent systems and automated branding engines. Choose who you want to train below to get details.",
      cards: [{
        type: "LeadFormCard" as const,
        data: {
          title: "GenAI Full Stack & Team Training",
          description: "Select your upskilling target to get customized course blueprints and direct cohort details."
        }
      }],
    };
  }

  if (/contact|email|phone|whatsapp|linkedin|reach|call|connect|dm/i.test(normalized)) {
    return {
      responseMessage: "Attention is the rarest currency. Let me know what you are building to connect.",
      cards: [contactLeadCard],
    };
  }

  if (/career|founder history|background|previous company|map my shop|uptor|lmes/i.test(normalized)) {
    return {
      responseMessage: "Here is my execution record. Proof over theory.",
      cards: [experienceCard],
    };
  }

  if (/skill|expertise|what can you do|good at|tech|tools/i.test(normalized)) {
    return {
      responseMessage: "Skills are inputs. Business outcomes are outputs. Here is what we deploy.",
      cards: [skillCard, serviceCard],
    };
  }

  if (/service|offer|consult|branding|marketing|agentic|agency|requirement/i.test(normalized)) {
    return {
      responseMessage: "We don't offer standard agency services. We build high-leverage brand engines, automated marketing workflows, and custom AI agents that scale without human effort. Choose your focus area below to configure your solution.",
      cards: [serviceCard, contactLeadCard],
    };
  }

  if (/post|linkedin|thought|kunal|murthy|scam|tweet|write/i.test(normalized)) {
    return {
      responseMessage: "Here are some observations on distribution, incentives, and human behavior.",
      cards: [postCard2, postCard1],
    };
  }

  if (/education|school|college|harvard|degree|study/i.test(normalized)) {
    return {
      responseMessage: "Academic pedigree signal-matches. Execution value-matches. Here is mine.",
      cards: [educationCard, aboutCard],
    };
  }

  if (/about|who are you|who is|bio|story/i.test(normalized)) {
    return {
      responseMessage: "I build systems that scale without proportional human effort. Details below.",
      cards: [aboutCard],
    };
  }

  if (returnDefaultOnNoMatch) {
    return {
      responseMessage: "Tell me what you are building or breaking. Let's look at the bottlenecks.",
      cards: [contactLeadCard],
    };
  }

  return null;
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: "2mb" }));

  // ── POST /api/gemini/generate ─────────────────────────────────────────────
  app.post(["/api/gemini/generate", "/api/generate.php"], async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt." });
    }

    // 1. Direct routing: If prompt matches a basic intent, resolve immediately (saves tokens, low latency)
    const matched = getFallbackResponse(prompt);
    if (matched !== null) {
      return res.json(matched);
    }

    try {
      const client = getGeminiClient();
      if (!client) {
        console.log("No Gemini API key available — returning local engine fallback.");
        return res.json(getFallbackResponse(prompt, true));
      }

      // 2. Call Gemini for strategic/conversational queries using a highly compact SOP (token-efficient)
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `# System Instruction: Strategic AI Chief of Staff & Consultant for Pulidevan Prabakaran

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
`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              responseMessage: {
                type: Type.STRING,
                description: "Conversational, punchy AI response text",
              },
              cards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description:
                        "Card type: ContactCard | AboutCard | ExperienceCard | SkillCard | PostCard | EducationCard | ServiceCard | LeadFormCard | AppointmentCard",
                    },
                    data: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        tagline: { type: Type.STRING },
                        avatarUrl: { type: Type.STRING },
                        linkedinUrl: { type: Type.STRING },
                        whatsappUrl: { type: Type.STRING },
                        title: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        company: { type: Type.STRING },
                        duration: { type: Type.STRING },
                        description: { type: Type.STRING },
                        category: { type: Type.STRING },
                        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        content: { type: Type.STRING },
                        timeAgo: { type: Type.STRING },
                        impressions: { type: Type.STRING },
                        link: { type: Type.STRING },
                        institution: { type: Type.STRING },
                        degree: { type: Type.STRING },
                        services: { type: Type.ARRAY, items: { type: Type.STRING } },
                      },
                    },
                  },
                  required: ["type", "data"],
                },
              },
            },
            required: ["responseMessage", "cards"],
          },
        },
      });

      const parsed = safeJSONParse(response.text);
      if (!parsed) {
        console.warn("Gemini returned empty/invalid JSON — using fallback");
        return res.json(getFallbackResponse(prompt, true));
      }

      if (!Array.isArray(parsed.cards)) parsed.cards = [];
      res.json(parsed);
    } catch (error: any) {
      console.warn(
        "Gemini API error, falling back to local engine:",
        error.message || error
      );
      try {
        const fallback = getFallbackResponse(prompt, true);
        res.json(fallback);
      } catch (fallbackError: any) {
        console.error("Fallback error:", fallbackError);
        res.status(500).json({ error: "Service unavailable. Try again." });
      }
    }
  });

  // ── POST /api/lead ────────────────────────────────────────────────────────
  app.post(["/api/lead", "/api/lead.php"], async (req, res) => {
    try {
      const { name, phone, purpose, brief, chatSummary } = req.body;

      if (!name || !phone || !purpose) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, phone, purpose.",
        });
      }

      // Store in CRM
      const lead: Lead = {
        id: randomUUID(),
        name,
        phone,
        purpose,
        brief: brief || {},
        chatSummary: chatSummary || "",
        submittedAt: new Date().toISOString(),
      };
      crmLeads.push(lead);
      console.log(`[CRM] Lead stored: ${lead.id} — ${name} (${phone})`);

      // Format brief for Telegram
      let briefText = "<i>No brief details provided.</i>";
      if (brief && typeof brief === "object") {
        const entries = Object.entries(brief);
        if (entries.length > 0) {
          briefText = entries
            .map(([k, v]) => `<b>• ${escapeHTML(k)}:</b>\n  ${escapeHTML(String(v))}`)
            .join("\n\n");
        }
      }

      const text =
        `🚨 <b>New Elite MarTech Lead!</b> 🚨\n\n` +
        `<b>👤 Name:</b> ${escapeHTML(name)}\n` +
        `<b>📱 Phone:</b> <code>${escapeHTML(phone)}</code>\n` +
        `<b>🎯 Focus:</b> ${escapeHTML(purpose)}\n\n` +
        `<b>📋 Project Brief:</b>\n${briefText}\n\n` +
        `<b>💬 Chat Context:</b>\n<i>${escapeHTML(chatSummary || "No chat history.")}</i>\n\n` +
        `<b>🕐 Submitted:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `<b>🆔 Lead ID:</b> <code>${lead.id.slice(0, 8)}</code>`;

      const telegramResult = await sendTelegram(text);

      if (!telegramResult.ok) {
        console.warn("Telegram delivery failed:", telegramResult.error);
        // Still return success — lead is saved in CRM even if Telegram fails
        return res.json({
          success: true,
          leadId: lead.id,
          warning: `Lead saved. Telegram notification failed: ${telegramResult.error}`,
        });
      }

      console.log("[Telegram] Lead dispatched successfully.");
      res.json({ success: true, leadId: lead.id });
    } catch (error: any) {
      console.error("Failed to process lead:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── POST /api/book-appointment ────────────────────────────────────────────
  app.post(["/api/book-appointment", "/api/book-appointment.php"], async (req, res) => {
    try {
      const { leadId, name, phone, slot, chatSummary } = req.body;

      if (!name || !phone || !slot) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, phone, slot.",
        });
      }

      // Update existing lead if leadId provided, otherwise create minimal record
      if (leadId) {
        const existing = crmLeads.find((l) => l.id === leadId);
        if (existing) {
          existing.appointmentSlot = slot;
          console.log(`[CRM] Appointment added to lead ${leadId}: ${slot}`);
        }
      } else {
        const lead: Lead = {
          id: randomUUID(),
          name,
          phone,
          purpose: "Appointment Booking",
          brief: {},
          chatSummary: chatSummary || "",
          appointmentSlot: slot,
          submittedAt: new Date().toISOString(),
        };
        crmLeads.push(lead);
        console.log(`[CRM] Appointment lead stored: ${lead.id}`);
      }

      const text =
        `🗓️ <b>New Strategy Call Booked!</b>\n\n` +
        `<b>👤 Name:</b> ${escapeHTML(name)}\n` +
        `<b>📱 Phone:</b> <code>${escapeHTML(phone)}</code>\n` +
        `<b>📅 Slot:</b> ${escapeHTML(slot)}\n\n` +
        `<b>🕐 Booked at:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;

      const telegramResult = await sendTelegram(text);

      if (!telegramResult.ok) {
        console.warn("Telegram booking alert failed:", telegramResult.error);
        // Return success anyway — booking is still recorded
        return res.json({
          success: true,
          warning: `Booking saved. Telegram alert failed: ${telegramResult.error}`,
        });
      }

      console.log("[Telegram] Appointment alert sent.");
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to process appointment:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── GET /api/crm/leads ────────────────────────────────────────────────────
  // Simple CRM export — returns all stored leads as JSON
  app.get("/api/crm/leads", (req, res) => {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = process.env.CRM_API_KEY;

    // If CRM_API_KEY is set, enforce it; otherwise allow in dev
    if (expectedKey && apiKey !== expectedKey) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    res.json({
      total: crmLeads.length,
      leads: crmLeads.map((l) => ({
        ...l,
        // Truncate chat summary for export readability
        chatSummary:
          l.chatSummary.length > 300
            ? l.chatSummary.slice(0, 300) + "…"
            : l.chatSummary,
      })),
    });
  });

  // ── Vite dev middleware / static production ────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 CRM endpoint: GET /api/crm/leads`);
    });
  }

export default app;
