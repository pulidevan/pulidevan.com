import React from "react";
import { SkillData } from "../types";

export const SkillCard: React.FC<{ data: SkillData }> = ({ data }) => (
  <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    <p className="text-[11px] font-semibold text-[#007AFF] uppercase tracking-wide mb-2">{data.category}</p>
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x-mandatory pb-0.5">
      {data.skills.map((skill) => (
        <span key={skill} className="snap-start flex-shrink-0 px-2.5 py-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full text-[12px] font-medium text-black dark:text-white">
          {skill}
        </span>
      ))}
    </div>
  </div>
);
