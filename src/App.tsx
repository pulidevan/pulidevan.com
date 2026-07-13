import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Lock, Eye, EyeOff, ShieldAlert, Phone, PhoneOff, Mic, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { ChatMessage, UICard } from "./types";
import { geminiGenerate } from "./services/clientApi";
import { ContactCard } from "./components/ContactCard";
import { AboutCard } from "./components/AboutCard";
import { ExperienceCard } from "./components/ExperienceCard";
import { SkillCard } from "./components/SkillCard";
import { PostCard } from "./components/PostCard";
import { EducationCard } from "./components/EducationCard";
import { ServiceCard } from "./components/ServiceCard";
import { CertificationCard } from "./components/CertificationCard";
import { LeadFormCard } from "./components/LeadFormCard";
import { AppointmentCard } from "./components/AppointmentCard";
import { CRMDashboard } from "./components/CRMDashboard";
import { SiriBlob } from "./components/SiriBlob";
import { TypingMessage } from "./components/TypingMessage";
import { audio } from "./utils/audio";

// ── CRM Access Config ─────────────────────────────────────────────────────────
const CRM_PASSWORD = "Ash@123#";
const CRM_SESSION_KEY = "crm_auth_v1";
const RSHIFT_REQUIRED = 5;
const RSHIFT_WINDOW_MS = 3000;

/** Trim chat history to the last N messages to keep payloads lean */
function buildChatContext(messages: ChatMessage[], maxMessages = 10): string {
  return messages
    .slice(-maxMessages)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function getClientCardsForInput(text: string): UICard[] {
  const normalized = text.toLowerCase();
  const cards: UICard[] = [];

  const contactLeadCard: UICard = {
    type: "LeadFormCard",
    data: {
      title: "Reason for Contact",
      description: "Drop your details and project focus to unlock my direct WhatsApp and LinkedIn.",
    },
  };

  const appointmentCard: UICard = {
    type: "AppointmentCard",
    data: {
      title: "Book a 30-min Strategy Call",
      description: "Pick a slot and I'll confirm via WhatsApp within 30 minutes.",
    },
  };

  const cohortLeadCard: UICard = {
    type: "LeadFormCard",
    data: {
      title: "GenAI Full Stack & Team Training",
      description: "Select your upskilling target to get customized course blueprints and direct cohort details.",
    },
  };

  const contactCard: UICard = {
    type: "ContactCard",
    data: {
      name: "Pulidevan Prabakaran",
      tagline: "Founder @aissentials | Upskilled 8000+ in AI leverage | Architecting brand behavior over noise",
      avatarUrl: "https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk",
      linkedinUrl: "https://www.linkedin.com/in/pulidevan",
      whatsappUrl: "https://wa.me/917401781784",
    },
  };

  const aboutCard: UICard = {
    type: "AboutCard",
    data: {
      title: "About Pulidevan Prabakaran",
      summary: "Built my first company at 20. Today, I operate at the intersection of Growth Marketing, Generative AI, and Serial Entrepreneurship. My focus is simple: replace theoretical fluff with automated cash-printing funnels.",
    },
  };

  const experienceCard: UICard = {
    type: "ExperienceCard",
    data: {
      title: "Founder",
      company: "AI Essentials",
      duration: "Mar 2025 - Present",
      description: "3000+ Professionals trained in Generative AI. 100+ AI Projects. 12+ Global clients. Ex-Founder, Map My Shop.",
    },
  };

  const skillCard: UICard = {
    type: "SkillCard",
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

  const serviceCard: UICard = {
    type: "ServiceCard",
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

  const postCard: UICard = {
    type: "PostCard",
    data: {
      content: "Google just reminded me where I parked my car. I didn't save the location... Because of small features that solve problems before I realize I have one.",
      impressions: "2,003",
      timeAgo: "Recent Post",
    },
  };

  if (/book|appointment|call|schedule|meeting|slot|calendar/i.test(normalized)) {
    cards.push(appointmentCard);
  }
  if (/course|class|masterclass|learn|cohort|upskill|train|teach|team/i.test(normalized)) {
    cards.push(cohortLeadCard);
  } else if (/hire|work|collab|join|agency|grow|scale|project|build/i.test(normalized)) {
    cards.push(contactLeadCard);
  }
  if (/contact|email|phone|whatsapp|linkedin|reach|call|connect|dm/i.test(normalized)) {
    if (!cards.some((c) => c.type === "LeadFormCard")) {
      cards.push(contactLeadCard);
    }
  }
  if (/about|who are you|who is|bio|story/i.test(normalized)) {
    cards.push(aboutCard);
  }
  if (/skill|expertise|what can you do|good at|tech|tools/i.test(normalized)) {
    cards.push(skillCard);
    cards.push(serviceCard);
  }
  if (/service|offer|consult|branding|marketing|agentic|agency|requirement/i.test(normalized)) {
    if (!cards.some((c) => c.type === "ServiceCard")) {
      cards.push(serviceCard);
    }
  }
  if (/career|founder history|background/i.test(normalized)) {
    cards.push(experienceCard);
  }
  if (/post|linkedin|thought|kunal|murthy/i.test(normalized)) {
    cards.push(postCard);
  }

  return cards;
}

export default function App() {
  return (
    <ConversationProvider agentId="agent_1901kxcrccy9f0avw0nqvbzrnrw8">
      <ChatApp />
    </ConversationProvider>
  );
}

function CardCarousel({
  cards,
  msgId,
  renderCard,
}: {
  cards: UICard[];
  msgId: string;
  renderCard: (card: UICard, msgId: string, index: number) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);



  const handleCarouselScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth
      : el.clientWidth;
    const idx = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, cards.length - 1));
  };

  const scrollToCard = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Scrollable card track */}
      <div
        ref={scrollRef}
        onScroll={handleCarouselScroll}
        className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x-mandatory pb-1"
        style={{ scrollPaddingLeft: 0 }}
      >
        {cards.map((card, idx) => (
          <div
            key={`${msgId}-carousel-${idx}`}
            className="snap-start flex-shrink-0 w-[91%]"
          >
            {renderCard(card, msgId, idx)}
          </div>
        ))}
      </div>

      {/* Dot indicators + swipe hint */}
      <div className="flex items-center justify-center gap-1.5">
        {cards.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Go to card ${idx + 1}`}
            onClick={() => scrollToCard(idx)}
            className={`rounded-full transition-all duration-200 ${
              idx === activeIndex
                ? "w-4 h-1.5 bg-[#007AFF]"
                : "w-1.5 h-1.5 bg-[#C7C7CC] dark:bg-[#48484A] hover:bg-[#8E8E93]"
            }`}
          />
        ))}
        {activeIndex === 0 && cards.length > 1 && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: [0.5, 1, 0.5], x: [0, 3, 0] }}
            transition={{ duration: 1.6, repeat: 2, ease: "easeInOut" }}
            className="ml-1 text-[10px] text-[#8E8E93] dark:text-[#636366] font-medium select-none"
          >
            swipe →
          </motion.span>
        )}
      </div>
    </div>
  );
}

function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "ai",
      content:
        "I build systems that scale without proportional human effort. What bottleneck are you solving today?",
    },
  ]);
  const [completedTypingIds, setCompletedTypingIds] = useState<Set<string>>(new Set(["1"]));
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleMessageTypingComplete = (msgId: string) => {
    setCompletedTypingIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });
  };

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const pendingMessageRef = useRef<string | null>(null);
  const ignoreFirstGreetingRef = useRef<boolean>(false);

  // ── CRM state ─────────────────────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCRM, setShowCRM] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const rshiftTimestamps = useRef<number[]>([]);

  // Check if already authenticated this session
  useEffect(() => {
    if (sessionStorage.getItem(CRM_SESSION_KEY) === "1") {
      // Don't auto-open — just silently mark as authed
    }
  }, []);

  // ── 5× RShift detector ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Shift" || e.location !== 2) return; // location 2 = right shift

      const now = Date.now();
      const recent = rshiftTimestamps.current.filter(
        (t) => now - t < RSHIFT_WINDOW_MS
      );
      recent.push(now);
      rshiftTimestamps.current = recent;

      if (recent.length >= RSHIFT_REQUIRED) {
        rshiftTimestamps.current = [];
        audio.playTap();

        // Already authed this session → open CRM directly
        if (sessionStorage.getItem(CRM_SESSION_KEY) === "1") {
          setShowCRM(true);
        } else {
          setShowPasswordModal(true);
          setPasswordInput("");
          setPasswordError("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === CRM_PASSWORD) {
      sessionStorage.setItem(CRM_SESSION_KEY, "1");
      audio.playSuccess();
      setShowPasswordModal(false);
      setPasswordInput("");
      setPasswordError("");
      setShowCRM(true);
    } else {
      setPasswordError("Wrong password. Try again.");
      setPasswordInput("");
      audio.playTap();
    }
  };

  // ── Chat scroll behavior ──────────────────────────────────────────────────
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const threshold = 150;
    const currentPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottom.current = currentPosition <= threshold;
  };

  const scrollToBottom = (force = false) => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (force) {
      isNearBottom.current = true;
    }
    if (isNearBottom.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    audio.playSend();

    // Add user's message locally so it renders immediately
    const userMessageId = `user-msg-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    if (isVoiceMode && status === "connected") {
      try {
        await sendUserMessage(text);
      } catch (err) {
        console.error("sendUserMessage failed:", err);
        setIsLoading(false);
      }
    } else {
      try {
        const data = await geminiGenerate(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-msg-${Date.now()}`,
            role: "ai",
            content: data.responseMessage || "Something went wrong.",
            cards: data.cards && data.cards.length > 0 ? data.cards : undefined,
          },
        ]);
      } catch (err) {
        console.error("geminiGenerate failed:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "ai",
            content: "I'm having trouble connecting right now. Let's try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // ── ElevenLabs Voice Call Integration ──────────────────────────────────────
  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs session connected");
      audio.playSuccess();
      setIsLoading(false);

      if (pendingMessageRef.current) {
        const msg = pendingMessageRef.current;
        pendingMessageRef.current = null;
        setTimeout(() => {
          sendUserMessage(msg);
        }, 100);
      }
    },
    onDisconnect: () => {
      console.log("ElevenLabs session disconnected");
      audio.playTap();
      setIsLoading(false);
      pendingMessageRef.current = null;
      setIsVoiceMode(false);
    },
    onMessage: (msg: any) => {
      console.log("Voice Transcript:", msg);
      const content = msg.message || msg.content || "";
      const source = msg.source || msg.role || msg.from || "ai";
      const isUser = source === "user";
      
      if (content.trim()) {
        // Skip initial agent greeting in text mode if configured
        if (ignoreFirstGreetingRef.current && !isUser) {
          ignoreFirstGreetingRef.current = false;
          return;
        }

        const id = `voice-msg-${Date.now()}-${Math.random()}`;
        setMessages((prev) => {
          // Avoid duplicating identical consecutive messages
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.content === content &&
            lastMsg.role === (isUser ? "user" : "ai")
          ) {
            return prev;
          }

          let matchedCards: UICard[] = [];
          if (!isUser) {
            // Find the last user message in the list
            const userMsgs = prev.filter((m) => m.role === "user");
            const lastUserContent = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : "";
            
            // Extract matching cards based on both user input and AI response text
            const userCards = getClientCardsForInput(lastUserContent);
            const aiCards = getClientCardsForInput(content);
            
            // Merge unique cards by card type
            const cardMap = new Map<string, UICard>();
            [...userCards, ...aiCards].forEach((card) => {
              cardMap.set(card.type, card);
            });
            matchedCards = Array.from(cardMap.values());
          }

          return [
            ...prev,
            {
              id,
              role: isUser ? "user" : "ai",
              content,
              cards: matchedCards.length > 0 ? matchedCards : undefined,
            },
          ];
        });
      }
    },
    onError: (err: any) => {
      console.error("ElevenLabs error:", err);
      setIsLoading(false);
    },
  });

  const { startSession, endSession, status, isSpeaking, isListening, sendUserMessage } = conversation;

  const handleVoiceCallToggle = async () => {
    audio.playTap();
    if (status === "connected" || status === "connecting") {
      await endSession();
      // If we were in textOnly mode, immediately transition to voice mode
      if (!isVoiceMode) {
        setIsVoiceMode(true);
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          await startSession({
            agentId: "agent_1901kxcrccy9f0avw0nqvbzrnrw8",
          });
        } catch (err) {
          console.error("Failed to start voice call:", err);
        }
      }
    } else {
      setIsVoiceMode(true);
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await startSession({
          agentId: "agent_1901kxcrccy9f0avw0nqvbzrnrw8",
        });
      } catch (err) {
        console.error("Failed to start voice call:", err);
        alert("Microphone access is required for voice calls. Please grant permission and try again.");
      }
    }
  };

  // ── ElevenLabs Client Tools (Triggers Local Widgets/Cards) ────────────────
  useConversationClientTool("trigger_lead_form", (params: any) => {
    const newMsg: ChatMessage = {
      id: `voice-lead-${Date.now()}`,
      role: "ai",
      content: params?.message || "Please fill in your details to get started:",
      cards: [
        {
          type: "LeadFormCard",
          data: {
            title: params?.title || "Reason for Contact",
            description: params?.description || "Drop your details and project focus to unlock my direct WhatsApp and LinkedIn."
          }
        }
      ]
    };
    setMessages((prev) => [...prev, newMsg]);
    return "Lead form successfully triggered in chat";
  });

  useConversationClientTool("trigger_appointment_form", (params: any) => {
    const newMsg: ChatMessage = {
      id: `voice-appt-${Date.now()}`,
      role: "ai",
      content: params?.message || "Please pick a convenient slot for our meeting:",
      cards: [
        {
          type: "AppointmentCard",
          data: {
            title: params?.title || "Book a 30-min Strategy Call",
            description: params?.description || "Pick a slot and I'll confirm via WhatsApp within 30 minutes."
          }
        }
      ]
    };
    setMessages((prev) => [...prev, newMsg]);
    return "Appointment calendar successfully triggered in chat";
  });

  useConversationClientTool("trigger_card", (params: any) => {
    const { cardType, title, description, category, skills, services } = params || {};
    let data: any = {};
    
    if (cardType === "ContactCard") {
      data = {
        name: "Pulidevan Prabakaran",
        tagline: "Founder @aissentials | Upskilled 8000+ in AI leverage | Architecting brand behavior over noise",
        avatarUrl: "https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk",
        linkedinUrl: "https://www.linkedin.com/in/pulidevan",
        whatsappUrl: "https://wa.me/917401781784"
      };
    } else if (cardType === "AboutCard") {
      data = {
        title: title || "About Pulidevan Prabakaran",
        summary: description || "Built my first company at 20. Today, I operate at the intersection of Growth Marketing, Generative AI, and Serial Entrepreneurship."
      };
    } else if (cardType === "SkillCard") {
      data = {
        category: category || "Core Expertise",
        skills: skills || ["Start-up Ventures", "Growth Marketing", "Generative AI", "Performance Marketing", "Aerial Cinematography"]
      };
    } else if (cardType === "ServiceCard") {
      data = {
        category: category || "Services Offered",
        services: services || ["Graphic Design", "Brand Consulting", "Marketing Strategy", "Social Media Marketing", "Presentation Design", "Pricing Strategy", "Lead Generation", "Startup Law", "Performance Marketing"]
      };
    } else if (cardType === "ExperienceCard") {
      data = {
        title: title || "Founder",
        company: params?.company || "AI Essentials",
        duration: params?.duration || "Mar 2025 - Present",
        description: description || "3000+ Professionals trained in Generative AI. 100+ AI Projects. 12+ Global clients."
      };
    } else if (cardType === "EducationCard") {
      data = {
        institution: params?.institution || "Harvard Business School Online",
        degree: params?.degree || "Sustainable Business Strategy",
        duration: params?.duration || "2019-2020"
      };
    } else {
      return `Unknown cardType: ${cardType}`;
    }

    const newMsg: ChatMessage = {
      id: `voice-card-${Date.now()}`,
      role: "ai",
      content: params?.message || `Here is the requested ${cardType || "information"}:`,
      cards: [{ type: cardType, data }]
    };
    setMessages((prev) => [...prev, newMsg]);
    return `${cardType} successfully triggered in chat`;
  });

  const renderCard = (card: UICard, msgId: string, index: number) => {
    const chatCtx = buildChatContext(messages);
    const key = `${msgId}-${index}`;

    switch (card.type) {
      case "ContactCard":
        return <ContactCard key={key} data={card.data as any} />;
      case "AboutCard":
        return <AboutCard key={key} data={card.data as any} />;
      case "ExperienceCard":
        return <ExperienceCard key={key} data={card.data as any} />;
      case "SkillCard":
        return <SkillCard key={key} data={card.data as any} />;
      case "PostCard":
        return <PostCard key={key} data={card.data as any} />;
      case "EducationCard":
        return <EducationCard key={key} data={card.data as any} />;
      case "ServiceCard":
        return (
          <ServiceCard key={key} data={card.data as any} chatContext={chatCtx} />
        );
      case "CertificationCard":
        return <CertificationCard key={key} data={card.data as any} />;
      case "LeadFormCard":
        return (
          <LeadFormCard
            key={key}
            data={card.data as any}
            chatContext={chatCtx}
            onTriggerAppointment={() => {
              setMessages((prev) => [
                ...prev,
                {
                  id: `appt-trigger-${Date.now()}`,
                  role: "ai",
                  content: "Pick a convenient slot from my calendar below:",
                  cards: [
                    {
                      type: "AppointmentCard",
                      data: {
                        title: "Book a 30-min Strategy Call",
                        description: "Pick a slot and I'll confirm via WhatsApp within 30 minutes."
                      }
                    }
                  ]
                }
              ]);
            }}
          />
        );
      case "AppointmentCard":
        return (
          <AppointmentCard
            key={key}
            data={card.data as any}
            chatContext={chatCtx}
          />
        );
      default:
        return null;
    }
  };

  /* Dynamic context chips — max 4, max 20 chars each */
  const getDynamicChips = (aiText: string): { label: string; action: () => void }[] => {
    const t = aiText.toLowerCase();
    const chips: { label: string; action: () => void }[] = [];

    if (/book|call|schedule|slot|meeting|calendar/i.test(t)) {
      chips.push({
        label: "📅 Book a Call",
        action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-appt-${Date.now()}`, role: "ai", content: "Pick a slot from my calendar:", cards: [{ type: "AppointmentCard" as const, data: { title: "30-min Strategy Call", description: "I'll confirm via WhatsApp within 30 min." } }] }]); }
      });
    }
    if (/agent|automate|build|workflow|system/i.test(t)) {
      chips.push({
        label: "🛠️ Build Agent",
        action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-agent-${Date.now()}`, role: "ai", content: "Let's capture your automation requirements:", cards: [{ type: "LeadFormCard" as const, data: { title: "AI Agent Project", description: "Share your stack and bottleneck to unlock direct contact." } }] }]); }
      });
    }
    if (/learn|course|cohort|train|upskill|teach/i.test(t)) {
      chips.push({
        label: "🎓 Join Cohort",
        action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-cohort-${Date.now()}`, role: "ai", content: "Let's get your training requirements:", cards: [{ type: "LeadFormCard" as const, data: { title: "GenAI Full Stack & Team Training", description: "Select your upskilling target for customized blueprints." } }] }]); }
      });
    }
    if (/connect|whatsapp|linkedin|contact|reach|dm|email/i.test(t) && chips.length < 3) {
      chips.push({
        label: "💬 Get in Touch",
        action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-contact-${Date.now()}`, role: "ai", content: "Drop your details to unlock direct contact:", cards: [{ type: "LeadFormCard" as const, data: { title: "Reason for Contact", description: "Your brief unlocks direct WhatsApp and LinkedIn." } }] }]); }
      });
    }
    if (/brand|scale|market|grow|funnel|ads|social/i.test(t) && chips.length < 3) {
      chips.push({
        label: "📈 Scale Brand",
        action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-brand-${Date.now()}`, role: "ai", content: "Tell me about your brand goals:", cards: [{ type: "LeadFormCard" as const, data: { title: "Branding & Funnel Strategy", description: "Premium conversion funnels & brand design." } }] }]); }
      });
    }
    // Always provide at least 2 fallback chips
    if (chips.length === 0) {
      chips.push(
        { label: "🛠️ Build Agent", action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-fb1-${Date.now()}`, role: "ai", content: "Let's capture your automation requirements:", cards: [{ type: "LeadFormCard" as const, data: { title: "AI Agent Project", description: "Share your stack and bottleneck." } }] }]); } },
        { label: "📅 Book a Call", action: () => { audio.playTap(); setMessages(p => [...p, { id: `c-fb2-${Date.now()}`, role: "ai", content: "Pick a slot from my calendar:", cards: [{ type: "AppointmentCard" as const, data: { title: "30-min Strategy Call", description: "I'll confirm via WhatsApp within 30 min." } }] }]); } }
      );
    }
    return chips.slice(0, 4);
  };

  return (
    <>
      {/* ── Always-on Siri Background Blob ───────────────────────────────── */}
      <SiriBlob status={status} isSpeaking={isSpeaking} isListening={isListening} isVoiceMode={isVoiceMode} />

      {/* ── Active Call Mode Glow Overlay ───────────────────────────────── */}
      {isVoiceMode && (status === "connected" || status === "connecting") && (
        <div 
          className="fixed inset-0 pointer-events-none z-50 transition-all duration-700 animate-pulse border-[3px] border-blue-500/25 rounded-none"
          style={{
            boxShadow: status === "connected"
              ? "inset 0 0 35px rgba(0, 122, 255, 0.45), inset 0 0 90px rgba(175, 82, 222, 0.3)"
              : "inset 0 0 25px rgba(255, 149, 0, 0.4)",
          }}
        />
      )}

      {/* ── Main Chat UI ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden bg-[#F2F2F7]/85 dark:bg-black/85 font-sans text-black dark:text-white flex flex-col selection:bg-blue-500/30">
        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-3 pt-9 pb-1.5 backdrop-blur-xl bg-white/75 dark:bg-black/75 border-b border-black/5 dark:border-white/8 min-h-[46px] md:grid md:grid-cols-3">
          {/* Left spacer on desktop */}
          <div className="hidden md:block" />

          {/* Profile info (centered on desktop) */}
          <div className="flex items-center gap-2 md:justify-center">
            <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm flex-shrink-0">
              <img
                src="https://media.licdn.com/dms/image/v2/D5603AQFfgpq3mC2_Ag/profile-displayphoto-crop_800_800/B56Z3SZuaBKkAI-/0/1777351455042?e=1784764800&v=beta&t=C5JHQFCXs1XBeZchAQEQYZ5eM_T9z1Y11Xf0w6oVdkk"
                alt="Pulidevan Prabakaran"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col md:items-center">
              <h1 className="text-[13px] font-semibold tracking-tight text-black dark:text-white leading-tight">
                Pulidevan Prabakaran
              </h1>
              <span className="text-[10px] text-[#34C759] font-medium leading-none mt-0.5">
                ● Active now
              </span>
            </div>
          </div>

          {/* Action buttons (right aligned) */}
          <div className="flex items-center gap-1.5 justify-end">
            {/* Share button */}
            <button
              type="button"
              onClick={() => {
                audio.playTap();
                if (navigator.share) {
                  navigator.share({ title: "Pulidevan Prabakaran - AI Essentials Portfolio", url: window.location.origin }).catch(err => console.log(err));
                } else {
                  navigator.clipboard.writeText(window.location.origin);
                }
              }}
              className="p-1.5 rounded-full bg-black/5 dark:bg-white/8 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all flex items-center justify-center"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Voice Call button */}
            <button
              type="button"
              onClick={handleVoiceCallToggle}
              className={`p-1.5 rounded-full transition-all flex items-center justify-center ${
                status === "connected"
                  ? "bg-[#FF3B30] text-white shadow-sm shadow-red-500/30 active:scale-90"
                  : status === "connecting"
                  ? "bg-amber-500 text-white animate-pulse"
                  : "bg-black/5 dark:bg-white/8 text-black dark:text-white hover:bg-black/10 active:scale-95"
              }`}
            >
              {status === "connected" ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </button>
          </div>
        </header>


        {/* Chat Area */}
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="relative z-10 flex-1 overflow-y-auto px-3 pt-4 flex flex-col gap-3 no-scrollbar pb-28"
        >
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.3, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  style={{
                    originX: msg.role === "user" ? 1 : 0,
                    originY: 1,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  className="flex flex-col w-full gap-1.5"
                >
                  {/* Bubble Row */}
                  <div
                    className={`flex w-full ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2 text-[15px] leading-[20px] tracking-[-0.2px] max-w-[82%] ${
                        msg.role === "user"
                          ? "bg-[#007AFF] text-white rounded-[18px] rounded-br-[4px]"
                          : "bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-sm text-black dark:text-white rounded-[18px] rounded-bl-[4px] border border-black/5 dark:border-white/5"
                      }`}
                    >
                      {msg.role === "user" || completedTypingIds.has(msg.id) ? (
                        <span>{msg.content}</span>
                      ) : (
                        <TypingMessage
                          content={msg.content}
                          role={msg.role}
                          onComplete={() => handleMessageTypingComplete(msg.id)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Chips Row (AI only) */}
                  {(msg.role === "user" || completedTypingIds.has(msg.id)) && msg.role === "ai" && messages[messages.length - 1]?.id === msg.id && !isLoading && !msg.cards?.some(c => c.type === "LeadFormCard" || c.type === "AppointmentCard") && (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x-mandatory pb-0.5 w-full mt-0.5">
                      {getDynamicChips(msg.content).map((chip, ci) => (
                        <button
                          key={ci}
                          type="button"
                          onClick={chip.action}
                          className="snap-start flex-shrink-0 px-2.5 py-1 text-[12px] font-semibold rounded-full bg-white/80 dark:bg-[#2C2C2E]/80 backdrop-blur-sm text-black dark:text-white border border-black/8 dark:border-white/10 active:scale-95 transition-all shadow-sm hover:bg-white dark:hover:bg-[#3A3A3C]"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cards Row (AI only) */}
                  {(msg.role === "user" || completedTypingIds.has(msg.id)) && msg.cards && msg.cards.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="w-full mt-0.5"
                    >
                      {msg.cards.length === 1 ? (
                        <div className="w-full">
                          {renderCard(msg.cards[0], msg.id, 0)}
                        </div>
                      ) : (
                        <CardCarousel cards={msg.cards} msgId={msg.id} renderCard={renderCard} />
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                style={{
                  originX: 0,
                  originY: 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 20 }}
                className="flex w-full justify-start"
              >
                <div className="px-4 py-3 bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-sm rounded-[18px] rounded-bl-[4px] border border-black/5 dark:border-white/5 flex gap-1.5 items-center shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-[#8E8E93] dark:bg-[#98989D] block"
                      animate={{
                        y: ["0%", "-60%", "0%"],
                      }}
                      transition={{
                        duration: 0.7,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pt-2 pb-7 px-3 backdrop-blur-xl bg-white/80 dark:bg-[#1C1C1E]/80 border-t border-black/5 dark:border-white/10">
          <div className="max-w-2xl mx-auto relative z-10 flex flex-col gap-2">
            {messages.length < 3 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x-mandatory pb-0.5"
              >
                {[
                  { label: "🛠️ Build AI Agent", msg: "Build Custom AI Agent" },
                  { label: "📈 Scale Brand", msg: "Scale My Brand" },
                  { label: "📅 Book a Call", msg: "Book a Strategy Call" },
                  { label: "💬 Connect", msg: "Connect & DM" },
                ].map((p) => (
                  <button
                    type="button"
                    key={p.msg}
                    onClick={() => { audio.playTap(); sendMessage(p.msg); }}
                    className="snap-start flex-shrink-0 px-3 py-1 bg-white/80 dark:bg-[#2C2C2E]/80 backdrop-blur-sm rounded-full text-[12px] font-medium text-black dark:text-white hover:bg-white dark:hover:bg-[#3A3A3C] transition-colors active:scale-95 border border-black/8 dark:border-white/10 shadow-sm"
                  >
                    {p.label}
                  </button>
                ))}
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              className="relative flex items-end gap-2"
            >
              <div className="flex-1 bg-white/95 dark:bg-[#1C1C1E]/95 border border-black/10 dark:border-[#38383A] rounded-[20px] px-3 py-1 flex items-center min-h-[38px] gap-1.5">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Message"
                  className="w-full bg-transparent text-[15px] tracking-[-0.2px] text-black dark:text-white focus:outline-none placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] py-1"
                  disabled={isLoading}
                  autoComplete="off"
                />

                {/* Voice Call Mic Toggle */}
                <button
                  type="button"
                  onClick={handleVoiceCallToggle}
                  className={`p-1 rounded-full transition-all flex items-center justify-center ${
                    status === "connected"
                      ? "text-[#FF3B30] active:scale-90"
                      : status === "connecting"
                      ? "text-amber-500 animate-pulse"
                      : "text-gray-400 dark:text-gray-500 active:scale-95"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                  inputValue.trim()
                    ? "bg-[#007AFF] text-white hover:bg-[#0062cc] active:scale-90"
                    : "bg-[#E5E5EA] dark:bg-[#2C2C2E] text-gray-400 dark:text-gray-500"
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[3]" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Password Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordInput("");
              setPasswordError("");
            }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="bg-white dark:bg-[#1C1C1E] rounded-[24px] w-full max-w-[340px] overflow-hidden shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-[#007AFF]/10 to-violet-600/10 px-6 pt-7 pb-5 flex flex-col items-center text-center border-b border-[#C6C6C8]/20 dark:border-[#38383A]">
                <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#007AFF] to-violet-600 flex items-center justify-center shadow-lg mb-3">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-[18px] font-bold text-black dark:text-white">
                  CRM Access
                </h2>
                <p className="text-[13px] text-[#8E8E93] mt-1">
                  Enter password to open dashboard
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handlePasswordSubmit} className="p-5 flex flex-col gap-4">
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter password"
                    autoFocus
                    className={`w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[12px] px-4 pr-11 py-3 text-[16px] text-black dark:text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 transition-all ${
                      passwordError
                        ? "focus:ring-[#FF3B30] ring-1 ring-[#FF3B30]/40"
                        : "focus:ring-[#007AFF]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-black dark:hover:text-white"
                  >
                    {passwordVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-[13px] text-[#FF3B30] font-medium"
                    >
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      {passwordError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={!passwordInput.trim()}
                  className="w-full bg-gradient-to-r from-[#007AFF] to-violet-600 hover:opacity-90 text-white font-bold text-[16px] py-3 rounded-[12px] transition-all active:scale-98 disabled:opacity-40 shadow-lg"
                >
                  Unlock Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput("");
                    setPasswordError("");
                  }}
                  className="w-full text-[#8E8E93] text-[14px] font-medium py-1 hover:text-black dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CRM Dashboard ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCRM && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CRMDashboard onClose={() => setShowCRM(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
