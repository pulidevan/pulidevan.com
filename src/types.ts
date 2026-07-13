export type CardType =
  | "ContactCard"
  | "AboutCard"
  | "ExperienceCard"
  | "SkillCard"
  | "PostCard"
  | "EducationCard"
  | "ServiceCard"
  | "CertificationCard"
  | "LeadFormCard"
  | "AppointmentCard";

export interface ContactData {
  name: string;
  tagline: string;
  avatarUrl?: string;
  linkedinUrl: string;
  whatsappUrl: string;
}

export interface AboutData {
  title: string;
  summary: string;
}

export interface ExperienceData {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface SkillData {
  category: string;
  skills: string[];
}

export interface PostData {
  content: string;
  timeAgo: string;
  impressions?: string;
  link?: string;
}

export interface EducationData {
  institution: string;
  degree: string;
  duration: string;
}

export interface ServiceData {
  category: string;
  services: string[];
}

export interface CertificationData {
  name: string;
  issuer: string;
  date: string;
}

export interface LeadFormData {
  title: string;
  description: string;
}

export interface AppointmentData {
  title: string;
  description: string;
}

export interface UICard {
  type: CardType;
  data:
    | ContactData
    | AboutData
    | ExperienceData
    | SkillData
    | PostData
    | EducationData
    | ServiceData
    | CertificationData
    | LeadFormData
    | AppointmentData;
}

export interface AIResponse {
  responseMessage: string;
  cards: UICard[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  cards?: UICard[];
  isTyping?: boolean;
}

/** CRM Lead record stored server-side */
export interface Lead {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  brief: Record<string, string>;
  chatSummary: string;
  appointmentSlot?: string;
  submittedAt: string;
}
