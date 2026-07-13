import React, { useState } from "react";
import { LeadFormData } from "../types";
import { audio } from "../utils/audio";
import { addLead, addAppointmentLead } from "../hooks/useCRM";
import { submitLead, bookAppointment } from "../services/clientApi";
import {
  Cpu,
  Megaphone,
  Video,
  Layers,
  Send,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Phone,
  User,
  Globe,
  Calendar,
  Clock,
  Briefcase,
  Share2,
  GraduationCap,
  Download,
  FileText,
} from "lucide-react";

type Step = "INTEREST" | "BRIEF" | "CONTACT" | "DONE";

type InterestKey =
  | "tech_automation"
  | "brand_funnels"
  | "content_creation"
  | "martech_agency"
  | "learning_cohort"
  | "general";

interface InterestOption {
  key: InterestKey;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
}

const INTERESTS: InterestOption[] = [
  {
    key: "tech_automation",
    label: "AI Agents & Tech Automation",
    icon: Cpu,
    description: "Automate workflows, deploy intelligent agents.",
    color: "bg-violet-500",
  },
  {
    key: "brand_funnels",
    label: "Branding & Funnel Strategy",
    icon: Layers,
    description: "Premium conversion funnels & high-converting brand design.",
    color: "bg-blue-500",
  },
  {
    key: "content_creation",
    label: "High-End Content Creation",
    icon: Video,
    description: "High-retention content & organic funnel scaling.",
    color: "bg-pink-500",
  },
  {
    key: "martech_agency",
    label: "Full MarTech Agency Scale",
    icon: Megaphone,
    description: "Ad setup, performance marketing & branding at scale.",
    color: "bg-orange-500",
  },
  {
    key: "learning_cohort",
    label: "GenAI Full Stack & Team Training",
    icon: GraduationCap,
    description: "Upskill yourself or train your team to build & deploy AI systems.",
    color: "bg-emerald-500",
  },
  {
    key: "general",
    label: "General / Quick Inquiry",
    icon: Globe,
    description: "Speaking engagements, collaborations, or quick chats.",
    color: "bg-green-500",
  },
];

// Available appointment time slots (IST)
const TIME_SLOTS = [
  "9:00 AM IST",
  "11:00 AM IST",
  "1:00 PM IST",
  "3:00 PM IST",
  "5:00 PM IST",
  "7:00 PM IST",
];

/**
 * Get next 7 available weekdays (Mon–Sat) starting tomorrow.
 */
function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  let d = new Date(today);
  d.setDate(d.getDate() + 1);
  while (dates.length < 7) {
    const day = d.getDay();
    if (day !== 0) {
      // Skip Sunday
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDateISO(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const LeadFormCard: React.FC<{
  data: LeadFormData;
  chatContext?: string;
  onTriggerAppointment?: () => void;
}> = ({ data, chatContext, onTriggerAppointment }) => {
  const [step, setStep] = useState<Step>(
    data?.title?.toLowerCase().includes("training") || data?.title?.toLowerCase().includes("cohort")
      ? "BRIEF"
      : "INTEREST"
  );
  const [interest, setInterest] = useState<InterestKey | "">(
    data?.title?.toLowerCase().includes("training") || data?.title?.toLowerCase().includes("cohort")
      ? "learning_cohort"
      : ""
  );

  const [customFields, setCustomFields] = useState({
    techWorkflow: "",
    techBottleneck: "",
    brandProduct: "",
    brandAudience: "",
    contentChannels: "",
    contentStyle: "",
    martechBudget: "<$2.5k",
    martechGoals: "",
    generalMessage: "",
    cohortTarget: "Self",
    cohortGoals: "",
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [briefError, setBriefError] = useState("");
  const [cleanSummary, setCleanSummary] = useState("");

  // Appointment booking states
  const [wantsAppointment, setWantsAppointment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [leadId, setLeadId] = useState<string>("");

  const availableDates = getAvailableDates();

  const handleInterestSelect = (key: InterestKey) => {
    audio.playTap();
    setInterest(key);
    setStep("BRIEF");
  };

  const handleCustomFieldChange = (
    field: keyof typeof customFields,
    value: string
  ) => {
    setCustomFields((prev) => ({ ...prev, [field]: value }));
    setBriefError("");
  };

  // ── Phone validation ─────────────────────────────────────────────────────────
  const validatePhone = (num: string): boolean => {
    const cleaned = num.replace(/\D/g, "");

    if (cleaned.length < 10) {
      setPhoneError("Phone number must have at least 10 digits.");
      return false;
    }
    if (cleaned.length > 15) {
      setPhoneError("Phone number is too long (maximum 15 digits).");
      return false;
    }

    const dummyPatterns = [
      "1234567890",
      "0987654321",
      "0000000000",
      "1111111111",
      "2222222222",
      "3333333333",
      "4444444444",
      "5555555555",
      "6666666666",
      "7777777777",
      "8888888888",
      "9999999999",
    ];
    if (dummyPatterns.some((pat) => cleaned.includes(pat))) {
      setPhoneError("Please provide a legitimate, active mobile number.");
      return false;
    }

    const allSame = cleaned.split("").every((c) => c === cleaned[0]);
    if (allSame) {
      setPhoneError("Please provide a legitimate, active mobile number.");
      return false;
    }

    const phoneRegex = /^[1-9]\d{9,14}$/;
    if (!phoneRegex.test(cleaned)) {
      setPhoneError("Invalid phone format. Please enter a real number.");
      return false;
    }

    setPhoneError("");
    return true;
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setSubmitError("");
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length >= 10) setPhoneError("");
  };

  // ── Brief validation ─────────────────────────────────────────────────────────
  const validateBrief = (): boolean => {
    if (interest === "tech_automation") {
      if (!customFields.techWorkflow.trim() || !customFields.techBottleneck.trim()) {
        setBriefError("Please fill in both fields to continue.");
        return false;
      }
    } else if (interest === "brand_funnels") {
      if (!customFields.brandProduct.trim() || !customFields.brandAudience.trim()) {
        setBriefError("Please fill in both fields to continue.");
        return false;
      }
    } else if (interest === "content_creation") {
      if (!customFields.contentChannels.trim() || !customFields.contentStyle.trim()) {
        setBriefError("Please fill in both fields to continue.");
        return false;
      }
    } else if (interest === "martech_agency") {
      if (!customFields.martechGoals.trim()) {
        setBriefError("Please describe your revenue goals to continue.");
        return false;
      }
    } else if (interest === "general") {
      if (!customFields.generalMessage.trim()) {
        setBriefError("Please write your message to continue.");
        return false;
      }
    } else if (interest === "learning_cohort") {
      if (!customFields.cohortGoals.trim()) {
        setBriefError("Please describe your upskilling goals to continue.");
        return false;
      }
    }
    setBriefError("");
    return true;
  };

  // ── Submit lead ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest || !name.trim() || !phone || !profession.trim()) return;

    const isPhoneValid = validatePhone(phone);
    if (!isPhoneValid) {
      audio.playTap();
      return;
    }

    setLoading(true);
    setSubmitError("");

    let briefDetails: Record<string, string> = {
      "Profession": profession.trim(),
    };
    if (interest === "tech_automation") {
      briefDetails = {
        ...briefDetails,
        "Target Automation Workflow": customFields.techWorkflow,
        "Current Manual Bottleneck": customFields.techBottleneck,
      };
    } else if (interest === "brand_funnels") {
      briefDetails = {
        ...briefDetails,
        "Product/Service Name": customFields.brandProduct,
        "Target Audience & Funnel Bottlenecks": customFields.brandAudience,
      };
    } else if (interest === "content_creation") {
      briefDetails = {
        ...briefDetails,
        "Target Channels": customFields.contentChannels,
        "Style / Reference Ideas": customFields.contentStyle,
      };
    } else if (interest === "martech_agency") {
      briefDetails = {
        ...briefDetails,
        "Target Ad Budget (Monthly)": customFields.martechBudget,
        "Monthly Revenue & Goals": customFields.martechGoals,
      };
    } else if (interest === "learning_cohort") {
      briefDetails = {
        ...briefDetails,
        "Training Target": customFields.cohortTarget,
        "Upskilling / Cohort Goals": customFields.cohortGoals,
      };
    } else {
      briefDetails = {
        ...briefDetails,
        Message: customFields.generalMessage
      };
    }

    // Trim chatContext to last 10 messages to keep Telegram clean
    const trimmedChatContext = chatContext
      ? chatContext.split("\n").slice(-20).join("\n")
      : "";

    const selectedOption = INTERESTS.find((i) => i.key === interest);
    const purpose = selectedOption?.label || interest;
    const generatedId = `lead-${Date.now()}`;

    // Build a human-readable clean summary
    let localSummary = `Hi Pulidevan, I'm ${name.trim()} (${profession.trim()}). I'm interested in "${purpose}".\n\n`;
    const entries = Object.entries(briefDetails);
    if (entries.length > 0) {
      localSummary += `Project Details:\n`;
      entries.forEach(([key, val]) => {
        localSummary += `• ${key}: ${val}\n`;
      });
    }
    localSummary = localSummary.trim();
    setCleanSummary(localSummary);

    // ── Always save to local CRM first (serverless, works offline) ──────────
    const localLead = addLead({
      id: generatedId,
      name: name.trim(),
      phone,
      purpose,
      brief: briefDetails,
      chatSummary: trimmedChatContext,
    });

    try {
      const result = await submitLead({
        name: name.trim(),
        phone,
        purpose,
        brief: briefDetails,
        chatSummary: trimmedChatContext,
        leadId: generatedId,
        summary: localSummary,
      });

      if (result.success) {
        setLeadId(localLead.id);
        audio.playSuccess();
        setSubmitted(true);
      } else {
        setLeadId(localLead.id);
        audio.playSuccess();
        setSubmitted(true);
      }
    } catch (err) {
      console.error("submitLead error (lead saved locally):", err);
      setLeadId(localLead.id);
      audio.playSuccess();
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Book appointment ─────────────────────────────────────────────────────────
  // ── Submitted state block ──
  if (submitted) {
    return (
      <div className="bg-white/92 dark:bg-[#1C1C1E]/92 backdrop-blur-sm border border-green-500/20 rounded-2xl w-full shadow-md overflow-hidden animate-slideUp">
        <div className="px-3 pt-3 pb-2 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <Check className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-black dark:text-white leading-tight">
              Verified & Submitted!
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Your custom brief has been synced.
            </p>
          </div>
        </div>

        <div className="p-2.5 flex gap-2">
          <a
            href="https://drive.google.com/uc?export=download&id=1vIa0xTYveeKyhupjI1cAMooCfm4rCnJh"
            target="_blank"
            rel="noreferrer"
            onClick={() => audio.playTap()}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[12px] py-2 rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all text-center"
          >
            <Download className="w-3.5 h-3.5" /> Brochure
          </a>

          <button
            type="button"
            onClick={() => {
              audio.playTap();
              if (onTriggerAppointment) {
                onTriggerAppointment();
              }
            }}
            className="flex-1 bg-[#007AFF] hover:bg-[#0062cc] text-white font-bold text-[12px] py-2 rounded-xl flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
          >
            <Calendar className="w-3.5 h-3.5" /> Book Demo
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FORM STEPS
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white/92 dark:bg-[#1C1C1E]/92 backdrop-blur-sm rounded-2xl w-full shadow-sm overflow-hidden border border-black/6 dark:border-white/8 flex flex-col transition-all duration-300">
      {/* Progress header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[#C6C6C8]/30 dark:border-[#38383A]">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-semibold text-[#007AFF] uppercase tracking-wide">
            {step === "INTEREST" && (data.title || "What's your focus?")}
            {step === "BRIEF" && "Project context"}
            {step === "CONTACT" && "Your details"}
          </span>
          {/* Progress dots */}
          <div className="flex gap-1">
            {(["INTEREST", "BRIEF", "CONTACT"] as Step[]).map((s, i) => (
              <span
                key={s}
                className={`h-1 rounded-full transition-all duration-300 ${step === s
                    ? "w-3 bg-[#007AFF]"
                    : i < ["INTEREST", "BRIEF", "CONTACT"].indexOf(step)
                      ? "w-3 bg-[#34C759]"
                      : "w-1 bg-gray-300 dark:bg-gray-700"
                  }`}
              />
            ))}
          </div>
        </div>
        <p className="text-[12px] text-[#8E8E93] leading-tight mt-0.5">
          {step === "INTEREST" && (data.description || "Pick your focus to personalize the brief.")}
          {step === "BRIEF" && "Quick details — skip the back-and-forth."}
          {step === "CONTACT" && "A verified number unlocks direct WhatsApp."}
        </p>
      </div>

      <div className="px-3 py-2.5 flex-1 flex flex-col">
        {/* ── STEP 1: INTEREST ── */}
        {step === "INTEREST" && (
          <div className="flex flex-col gap-1.5 animate-fadeIn">
            {INTERESTS.map((opt) => {
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleInterestSelect(opt.key)}
                  className="w-full text-left px-2.5 py-2 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-[0.98] transition-all flex gap-2 items-center group"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${opt.color} flex-shrink-0`}>
                    <IconComp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[13px] font-medium text-black dark:text-white flex-1 truncate">
                    {opt.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* ── STEP 2: BRIEF ── */}
        {step === "BRIEF" && (
          <div className="flex flex-col gap-3 animate-fadeIn">
            {interest === "tech_automation" && (
              <>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    What workflow do you want automated?
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    placeholder="e.g., Automate email follow-ups based on cold leads status, sync with HubSpot..."
                    value={customFields.techWorkflow}
                    onChange={(e) =>
                      handleCustomFieldChange("techWorkflow", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Current biggest manual bottleneck:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., spending 3 hours daily on manual copywriting"
                    value={customFields.techBottleneck}
                    onChange={(e) =>
                      handleCustomFieldChange("techBottleneck", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>
              </>
            )}

            {interest === "brand_funnels" && (
              <>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Product / Service Name:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., SaaS platform, AI agency, e-com store"
                    value={customFields.brandProduct}
                    onChange={(e) =>
                      handleCustomFieldChange("brandProduct", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Target Audience & Funnel Bottleneck:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    placeholder="e.g., B2B founders, traffic drops after pricing page..."
                    value={customFields.brandAudience}
                    onChange={(e) =>
                      handleCustomFieldChange("brandAudience", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-20"
                  />
                </div>
              </>
            )}

            {interest === "content_creation" && (
              <>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Target Channels / Platforms:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., LinkedIn personal brand, YouTube Shorts, Instagram"
                    value={customFields.contentChannels}
                    onChange={(e) =>
                      handleCustomFieldChange("contentChannels", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Style / Reference Ideas:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    placeholder="e.g., High-energy talking head, faceless tech visuals, sleek animations..."
                    value={customFields.contentStyle}
                    onChange={(e) =>
                      handleCustomFieldChange("contentStyle", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-20"
                  />
                </div>
              </>
            )}

            {interest === "martech_agency" && (
              <>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Target Ad/Marketing Budget (Monthly):
                  </label>
                  <select
                    value={customFields.martechBudget}
                    onChange={(e) =>
                      handleCustomFieldChange("martechBudget", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  >
                    <option value="<$2.5k">&lt; $2,500 / month</option>
                    <option value="$2.5k-$10k">$2,500 – $10,000 / month</option>
                    <option value="$10k+">$10,000+ / month (High Scale)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Monthly Revenue, Niches & Launch Timeline:
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    placeholder="e.g., E-commerce at $15k/mo, targeting $50k/mo. Need Facebook ads + funnels."
                    value={customFields.martechGoals}
                    onChange={(e) =>
                      handleCustomFieldChange("martechGoals", e.target.value)
                    }
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-20"
                  />
                </div>
              </>
            )}

            {interest === "general" && (
              <div>
                <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  Your message / Proposal details:
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <textarea
                  placeholder="Tell me what you're cooking or how we can collaborate..."
                  value={customFields.generalMessage}
                  onChange={(e) =>
                    handleCustomFieldChange("generalMessage", e.target.value)
                  }
                  className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-32"
                />
              </div>
            )}

            {interest === "learning_cohort" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Who is this training for?
                  </label>
                  <select
                    value={customFields.cohortTarget}
                    onChange={(e) => handleCustomFieldChange("cohortTarget", e.target.value)}
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2.5 text-[15px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF] border-none"
                  >
                    <option value="Self">Self (Individual Cohort)</option>
                    <option value="Tech Team">My Tech Team</option>
                    <option value="Marketing Team">My Marketing / Sales Team</option>
                    <option value="Entire Organization">Entire Organization (Enterprise)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    What are your main upskilling / implementation goals?<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea
                    placeholder="e.g., Learn to build AI agents, automate workflows, upskill my team in prompt engineering."
                    value={customFields.cohortGoals}
                    onChange={(e) => handleCustomFieldChange("cohortGoals", e.target.value)}
                    className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] px-3 py-2 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none h-24"
                  />
                </div>
              </div>
            )}

            {briefError && (
              <div className="flex items-start gap-1.5 text-[12px] text-[#FF3B30] font-medium">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{briefError}</span>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setStep("INTEREST");
                  setBriefError("");
                }}
                className="flex-1 bg-[#F2F2F7] hover:bg-[#E5E5EA] dark:bg-[#2C2C2E] dark:hover:bg-[#3A3A3C] text-black dark:text-white font-medium text-[15px] py-2.5 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  if (validateBrief()) {
                    setStep("CONTACT");
                  }
                }}
                className="flex-1 bg-[#007AFF] hover:bg-[#0062cc] text-white font-semibold text-[15px] py-2.5 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "CONTACT" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 animate-fadeIn">
            {/* Name field */}
            <div>
              <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                Your Name<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Profession field */}
            <div>
              <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                Your Profession / Role<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Briefcase className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g., Founder, Growth Marketer, Developer"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  required
                />
              </div>
            </div>

            {/* Phone field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                  WhatsApp / Phone<span className="text-red-500 ml-0.5">*</span>
                </label>
                {phone && !phoneError && (
                  <span className="text-[11px] font-bold text-[#34C759]">
                    Verified ✓
                  </span>
                )}
                {phone && phoneError && (
                  <span className="text-[11px] font-bold text-[#FF3B30]">
                    Invalid
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="tel"
                  placeholder="e.g., +91 74017 81784"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#98989D] focus:outline-none focus:ring-2 ${phoneError
                      ? "focus:ring-[#FF3B30] ring-1 ring-[#FF3B30]/50"
                      : "focus:ring-[#007AFF]"
                    }`}
                  required
                  autoComplete="tel"
                />
              </div>
              {phoneError && (
                <div className="flex items-start gap-1.5 text-[12px] text-[#FF3B30] font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}
            </div>

            {/* Submit-level error (e.g. Telegram config issues) */}
            {submitError && (
              <div className="flex items-start gap-1.5 text-[12px] text-[#FF3B30] font-medium bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-[6px] px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  audio.playTap();
                  setStep("BRIEF");
                  setSubmitError("");
                }}
                className="flex-1 bg-[#F2F2F7] hover:bg-[#E5E5EA] dark:bg-[#2C2C2E] dark:hover:bg-[#3A3A3C] text-black dark:text-white font-medium text-[15px] py-2.5 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !phone.trim()}
                className="flex-1 bg-[#34C759] hover:bg-[#2ebd50] text-white font-bold text-[15px] py-2.5 rounded-[8px] flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Sending…
                  </span>
                ) : (
                  <>
                    Submit Lead <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
