import React from "react";
import { AboutData } from "../types";

export const AboutCard: React.FC<{ data: AboutData }> = ({ data }) => (
  <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    <p className="text-[12px] font-semibold text-[#007AFF] uppercase tracking-wide mb-1">{data.title}</p>
    <p className="text-[13px] text-[#3A3A3C] dark:text-[#EBEBF5] leading-[1.45]">{data.summary}</p>
  </div>
);
