import React, { useState } from "react";
import { ServiceData } from "../types";
import { LeadFormCard } from "./LeadFormCard";
import { audio } from "../utils/audio";

interface Props {
  data: ServiceData;
  chatContext?: string;
}

export const ServiceCard: React.FC<Props> = ({ data, chatContext }) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  if (selectedService) {
    return (
      <LeadFormCard
        data={{
          title: `Interested in ${selectedService}?`,
          description: "Drop your details and project scope to unlock direct contact.",
        }}
        chatContext={chatContext}
      />
    );
  }

  return (
    <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-black/6 dark:border-white/8 shadow-sm">
      <p className="text-[11px] font-semibold text-[#007AFF] uppercase tracking-wide mb-2">
        {data.category || "Services"}
      </p>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x-mandatory pb-0.5">
        {data.services.map((service, i) => (
          <button
            key={i}
            onClick={() => { audio.playTap(); setSelectedService(service); }}
            className="snap-start flex-shrink-0 px-2.5 py-1 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full text-[12px] font-medium text-black dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-95 transition-all"
          >
            {service}
          </button>
        ))}
      </div>
    </div>
  );
};
