import React from "react";
import { CertificationData } from "../types";

export const CertificationCard: React.FC<{ data: CertificationData }> = ({ data }) => (
  <div className="flex items-center gap-2.5 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[11px]">🏅</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold text-black dark:text-white truncate">{data.name}</p>
      <p className="text-[11px] text-[#8E8E93] truncate">{data.issuer} · {data.date}</p>
    </div>
  </div>
);
