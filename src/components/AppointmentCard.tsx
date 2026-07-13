import React, { useState } from "react";
import { AppointmentData } from "../types";
import { audio } from "../utils/audio";
import { addAppointmentLead } from "../hooks/useCRM";
import { bookAppointment } from "../services/clientApi";
import { Calendar, Clock, Check, AlertCircle, User, Phone } from "lucide-react";

interface Props {
  data: AppointmentData;
  chatContext?: string;
}

const TIME_SLOTS = [
  "9:00 AM IST",
  "11:00 AM IST",
  "1:00 PM IST",
  "3:00 PM IST",
  "5:00 PM IST",
  "7:00 PM IST",
];

function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  let d = new Date(today);
  d.setDate(d.getDate() + 1);
  while (dates.length < 7) {
    if (d.getDay() !== 0) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDateISO(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type Step = "PICK_SLOT" | "CONTACT" | "DONE";

/**
 * AppointmentCard — standalone booking card triggered by the AI.
 * Collects name, phone, date + time slot, then POSTs to /api/book-appointment.
 * Sends a Telegram notification on successful booking.
 */
export const AppointmentCard: React.FC<Props> = ({ data, chatContext }) => {
  const [step, setStep] = useState<Step>("PICK_SLOT");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const availableDates = getAvailableDates();

  const validatePhone = (num: string): boolean => {
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setPhoneError("Phone must have at least 10 digits.");
      return false;
    }
    if (cleaned.length > 15) {
      setPhoneError("Phone number too long.");
      return false;
    }
    const allSame = cleaned.split("").every((c) => c === cleaned[0]);
    if (allSame) {
      setPhoneError("Please enter a legitimate number.");
      return false;
    }
    if (!/^[1-9]\d{9,14}$/.test(cleaned)) {
      setPhoneError("Invalid phone format.");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !name.trim() || !phone) return;
    if (!validatePhone(phone)) return;

    setLoading(true);
    setSubmitError("");

    const slotLabel = `${formatDateISO(selectedDate)} at ${selectedSlot}`;

    // Always save locally first (serverless CRM)
    addAppointmentLead(
      name.trim(),
      phone,
      slotLabel,
      chatContext ? chatContext.split("\n").slice(-20).join("\n") : ""
    );

    try {
      await bookAppointment({
        name: name.trim(),
        phone,
        slot: slotLabel,
      });
      audio.playSuccess();
      setConfirmed(true);
      setStep("DONE");
    } catch (_) {
      // Appointment saved locally — show success anyway
      audio.playSuccess();
      setConfirmed(true);
      setStep("DONE");
    } finally {
      setLoading(false);
    }
  };

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (step === "DONE") {
    const slotText = selectedDate && selectedSlot
      ? `${formatDateShort(selectedDate)} at ${selectedSlot}`
      : "confirmed slot";
    const waMessage = `Hi Pulidevan, I'm ${name}. I just booked a strategy call for ${slotText}. Let's connect!`;
    const waUrl = `https://wa.me/917401781784?text=${encodeURIComponent(waMessage)}`;

    return (
      <div className="bg-white/92 dark:bg-[#1C1C1E]/92 backdrop-blur-sm border border-[#007AFF]/20 rounded-2xl w-full shadow-md overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-br from-[#007AFF]/10 to-violet-500/5 p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#007AFF]/15 flex items-center justify-center mb-3 animate-pulse-ring">
            <Check className="w-7 h-7 text-[#007AFF]" />
          </div>
          <h4 className="text-[17px] font-bold text-black dark:text-white">
            Strategy Call Booked! 🗓️
          </h4>
          <p className="text-[13px] text-gray-500 mt-1">
            {selectedDate && selectedSlot
              ? `${formatDateShort(selectedDate)} · ${selectedSlot}`
              : "Slot confirmed"}
          </p>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
            A confirmation will be sent via WhatsApp. Need to reschedule?
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => audio.playTap()}
            className="flex items-center justify-center gap-2 bg-[#34C759]/10 hover:bg-[#34C759]/20 border border-[#34C759]/20 text-[#34C759] font-semibold text-[14px] py-2.5 rounded-[10px] transition-colors"
          >
            WhatsApp Pulidevan →
          </a>
        </div>
      </div>
    );
  }

  // ── PICK SLOT ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white/92 dark:bg-[#1C1C1E]/92 backdrop-blur-sm rounded-2xl w-full shadow-sm overflow-hidden border border-black/6 dark:border-white/8">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[#C6C6C8]/30 dark:border-[#38383A]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
          <span className="text-[11px] font-semibold text-[#007AFF] uppercase tracking-wide">
            {data.title || "Book a 30-min Strategy Call"}
          </span>
        </div>
        <p className="text-[12px] text-[#8E8E93] mt-0.5 leading-snug">
          {data.description || "Pick a slot — I'll confirm via WhatsApp within 30 min."}
        </p>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-3">
        {/* Date picker */}
        <div>
          <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
            Select a Date
          </p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {availableDates.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  audio.playTap();
                  setSelectedDate(d);
                  setSelectedSlot("");
                }}
                className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-[10px] border transition-all active:scale-95 ${
                  selectedDate?.toDateString() === d.toDateString()
                    ? "bg-[#007AFF] border-[#007AFF] text-white shadow-sm"
                    : "bg-[#F2F2F7] dark:bg-[#2C2C2E] border-transparent text-black dark:text-white"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="text-[20px] font-bold leading-tight">
                  {d.getDate()}
                </span>
                <span className="text-[10px] font-medium">
                  {d.toLocaleDateString("en-IN", { month: "short" })}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="animate-fadeIn">
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Select a Time (IST)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    audio.playTap();
                    setSelectedSlot(slot);
                  }}
                  className={`py-2.5 rounded-[8px] text-[13px] font-semibold border transition-all active:scale-95 ${
                    selectedSlot === slot
                      ? "bg-[#007AFF] border-[#007AFF] text-white shadow-sm"
                      : "bg-[#F2F2F7] dark:bg-[#2C2C2E] border-transparent text-black dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C]"
                  }`}
                >
                  {slot.replace(" IST", "")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contact info form — shows after slot is picked */}
        {selectedDate && selectedSlot && (
          <form onSubmit={handleBook} className="animate-fadeIn flex flex-col gap-3">
            <div className="h-px bg-[#C6C6C8]/40 dark:bg-[#38383A]" />
            <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide">
              Your Details
            </p>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="tel"
                  placeholder="WhatsApp number (e.g. +91 740...)"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSubmitError("");
                    if (e.target.value.replace(/\D/g, "").length >= 10)
                      setPhoneError("");
                  }}
                  required
                  autoComplete="tel"
                  className={`w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-black dark:text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 ${
                    phoneError
                      ? "focus:ring-[#FF3B30] ring-1 ring-[#FF3B30]/50"
                      : "focus:ring-[#007AFF]"
                  }`}
                />
              </div>
              {phoneError && (
                <div className="flex items-start gap-1 text-[12px] text-[#FF3B30] font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-1.5 text-[12px] text-[#FF3B30] font-medium bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-[6px] px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Slot summary */}
            <div className="flex items-center gap-2 bg-[#007AFF]/8 border border-[#007AFF]/15 rounded-[8px] px-3 py-2">
              <Clock className="w-4 h-4 text-[#007AFF] shrink-0" />
              <span className="text-[13px] text-black dark:text-white font-medium">
                {formatDateShort(selectedDate!)} · {selectedSlot}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || !phone.trim()}
              className="w-full bg-[#007AFF] hover:bg-[#0062cc] text-white font-bold text-[15px] py-3 rounded-[10px] flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                  Booking…
                </span>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Confirm Booking
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
