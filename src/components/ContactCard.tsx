import React from "react";
import { Linkedin, MessageCircle } from "lucide-react";
import { ContactData } from "../types";

export const ContactCard: React.FC<{ data: ContactData }> = ({ data }) => (
  <div className="flex items-center gap-2.5 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    {data.avatarUrl && (
      <img src={data.avatarUrl} alt={data.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-black dark:text-white truncate">{data.name}</p>
      <p className="text-[11px] text-[#8E8E93] truncate leading-tight mt-0.5">{data.tagline}</p>
    </div>
    <div className="flex gap-1.5 flex-shrink-0">
      <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#0077B5]/10 flex items-center justify-center text-[#0077B5] hover:bg-[#0077B5]/20 transition-colors">
        <Linkedin className="w-3.5 h-3.5" />
      </a>
      <a href={data.whatsappUrl} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
      </a>
    </div>
  </div>
);
