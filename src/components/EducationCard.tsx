import React from "react";
import { EducationData } from "../types";

export const EducationCard: React.FC<{ data: EducationData }> = ({ data }) => (
  <div className="flex items-center gap-2.5 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[11px] font-bold">🎓</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-black dark:text-white truncate">{data.degree}</p>
      <p className="text-[11px] text-[#8E8E93] truncate">{data.institution} · {data.duration}</p>
    </div>
  </div>
);
