import React from "react";
import { PostData } from "../types";

export const PostCard: React.FC<{ data: PostData }> = ({ data }) => (
  <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] font-semibold text-[#0077B5]">LinkedIn</span>
      {data.timeAgo && <span className="text-[11px] text-[#8E8E93]">{data.timeAgo}</span>}
    </div>
    <p className="text-[13px] text-[#3A3A3C] dark:text-[#EBEBF5] leading-[1.45] line-clamp-3">{data.content}</p>
    {data.impressions && (
      <p className="text-[11px] text-[#8E8E93] mt-1.5">{data.impressions} impressions</p>
    )}
  </div>
);
