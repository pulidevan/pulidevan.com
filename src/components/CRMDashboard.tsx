import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Download,
  FileJson,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Phone,
  User,
  Target,
  Clock,
  Trash2,
  AlertTriangle,
  Filter,
  RefreshCw,
  TrendingUp,
  Users,
  CalendarCheck,
  Zap,
  ChevronRight,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import {
  CRMLead,
  getLeads,
  deleteLead,
  clearAllLeads,
  onCRMUpdated,
} from "../hooks/useCRM";

interface Props {
  onClose: () => void;
}

type SortKey = "submittedAt" | "name" | "purpose" | "appointmentSlot";
type SortDir = "asc" | "desc";

const PURPOSE_OPTIONS = [
  "All",
  "AI Agents & Tech Automation",
  "Branding & Funnel Strategy",
  "High-End Content Creation",
  "Full MarTech Agency Scale",
  "General / Quick Inquiry",
  "Appointment Booking",
];

const APPT_OPTIONS = ["All", "Has Appointment", "No Appointment"];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso;
  }
}

function isToday(iso: string): boolean {
  try {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

/** Convert leads array to CSV string */
function toCSV(leads: CRMLead[]): string {
  const headers = [
    "ID",
    "Name",
    "Phone",
    "Purpose",
    "Appointment Slot",
    "Brief",
    "Submitted At (IST)",
  ];
  const rows = leads.map((l) => {
    const briefStr = Object.entries(l.brief || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    return [
      `"${l.id}"`,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${l.phone || ""}"`,
      `"${(l.purpose || "").replace(/"/g, '""')}"`,
      `"${(l.appointmentSlot || "").replace(/"/g, '""')}"`,
      `"${briefStr.replace(/"/g, '""')}"`,
      `"${formatDateTime(l.submittedAt)}"`,
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const purposeColor: Record<string, string> = {
  "AI Agents & Tech Automation": "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "Branding & Funnel Strategy": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "High-End Content Creation": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Full MarTech Agency Scale": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "General / Quick Inquiry": "bg-green-500/15 text-green-700 dark:text-green-300",
  "Appointment Booking": "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
};

function PurposeBadge({ purpose }: { purpose: string }) {
  const cls =
    purposeColor[purpose] ||
    "bg-gray-200/60 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {purpose}
    </span>
  );
}

export const CRMDashboard: React.FC<Props> = ({ onClose }) => {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [search, setSearch] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("All");
  const [filterAppt, setFilterAppt] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"leads" | "stats">("leads");

  const refresh = useCallback(() => {
    setLeads(getLeads());
  }, []);

  useEffect(() => {
    refresh();
    return onCRMUpdated(refresh);
  }, [refresh]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Filter + sort pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = [...leads];

    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
      );
    }

    if (filterPurpose !== "All") {
      arr = arr.filter((l) => l.purpose === filterPurpose);
    }

    if (filterAppt === "Has Appointment") {
      arr = arr.filter((l) => !!l.appointmentSlot);
    } else if (filterAppt === "No Appointment") {
      arr = arr.filter((l) => !l.appointmentSlot);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      arr = arr.filter((l) => new Date(l.submittedAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      arr = arr.filter((l) => new Date(l.submittedAt) <= to);
    }

    arr.sort((a, b) => {
      let aVal = a[sortKey] ?? "";
      let bVal = b[sortKey] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return arr;
  }, [leads, search, filterPurpose, filterAppt, dateFrom, dateTo, sortKey, sortDir]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayLeads = leads.filter((l) => isToday(l.submittedAt)).length;
    const totalAppts = leads.filter((l) => !!l.appointmentSlot).length;
    const purposeCounts: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.purpose) purposeCounts[l.purpose] = (purposeCounts[l.purpose] || 0) + 1;
    });
    const topPurpose =
      Object.entries(purposeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "—";
    const convRate =
      leads.length > 0
        ? Math.round((totalAppts / leads.length) * 100)
        : 0;
    return { todayLeads, totalAppts, topPurpose, convRate, purposeCounts };
  }, [leads]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )
    ) : (
      <ChevronDown className="w-3 h-3 opacity-30" />
    );

  const handleExportCSV = () => {
    const csv = toCSV(filtered);
    const ts = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `pulidevan-crm-${ts}.csv`, "text/csv");
  };

  const handleExportJSON = () => {
    const ts = new Date().toISOString().slice(0, 10);
    downloadFile(
      JSON.stringify({ total: leads.length, exported: filtered.length, leads: filtered }, null, 2),
      `pulidevan-crm-${ts}.json`,
      "application/json"
    );
  };

  const handleDelete = (id: string) => {
    deleteLead(id);
    if (expandedRow === id) setExpandedRow(null);
    setShowDeleteId(null);
  };

  const handleClearAll = () => {
    clearAllLeads();
    setShowConfirmClear(false);
    setExpandedRow(null);
  };

  const resetFilters = () => {
    setSearch("");
    setFilterPurpose("All");
    setFilterAppt("All");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    search || filterPurpose !== "All" || filterAppt !== "All" || dateFrom || dateTo;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      {/* Panel */}
      <div
        className="m-auto w-full max-w-5xl h-[92vh] flex flex-col bg-[#F2F2F7] dark:bg-[#0A0A0A] rounded-[20px] overflow-hidden shadow-2xl border border-white/10 animate-slideUp"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-[#1C1C1E] border-b border-[#C6C6C8]/40 dark:border-[#38383A] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#007AFF] to-violet-600 flex items-center justify-center shadow-sm">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-black dark:text-white leading-none">
                Pulidevan CRM
              </h2>
              <p className="text-[11px] text-[#8E8E93] leading-none mt-0.5">
                {leads.length} total · {stats.todayLeads} today
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] p-0.5 mr-1">
              {(["leads", "stats"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-all capitalize ${
                    activeTab === t
                      ? "bg-white dark:bg-[#3A3A3C] text-black dark:text-white shadow-sm"
                      : "text-[#8E8E93]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#34C759] rounded-[8px] text-[12px] font-semibold transition-colors border border-[#34C759]/20"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handleExportJSON}
              title="Export JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] rounded-[8px] text-[12px] font-semibold transition-colors border border-[#007AFF]/20"
            >
              <FileJson className="w-3.5 h-3.5" /> JSON
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E] text-[#8E8E93] hover:text-black dark:hover:text-white hover:bg-[#D1D1D6] dark:hover:bg-[#3A3A3C] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="flex gap-3 px-5 pt-4 pb-2 shrink-0">
          {[
            {
              icon: Users,
              label: "Total Leads",
              value: leads.length,
              color: "text-[#007AFF]",
              bg: "bg-[#007AFF]/8",
            },
            {
              icon: CalendarCheck,
              label: "Appointments",
              value: stats.totalAppts,
              color: "text-[#34C759]",
              bg: "bg-[#34C759]/8",
            },
            {
              icon: TrendingUp,
              label: "Today",
              value: stats.todayLeads,
              color: "text-[#FF9F0A]",
              bg: "bg-[#FF9F0A]/8",
            },
            {
              icon: Zap,
              label: "Appt Rate",
              value: `${stats.convRate}%`,
              color: "text-violet-500",
              bg: "bg-violet-500/8",
            },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div
              key={label}
              className={`flex-1 ${bg} rounded-[12px] p-3 flex flex-col gap-1`}
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[22px] font-bold text-black dark:text-white leading-none">
                {value}
              </span>
              <span className="text-[11px] text-[#8E8E93] font-medium">{label}</span>
            </div>
          ))}
        </div>

        {activeTab === "stats" ? (
          /* ── STATS TAB ─────────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
            <h3 className="text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider mb-3">
              Leads by Interest
            </h3>
            <div className="flex flex-col gap-2">
              {Object.entries(stats.purposeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([purpose, count]) => {
                  const pct = leads.length
                    ? Math.round((count / leads.length) * 100)
                    : 0;
                  return (
                    <div key={purpose} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-black dark:text-white font-medium">
                          {purpose}
                        </span>
                        <span className="text-[13px] text-[#8E8E93] font-semibold">
                          {count} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#007AFF] to-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {leads.length === 0 && (
                <p className="text-[14px] text-[#8E8E93] text-center py-8">
                  No leads yet. Share the chatbot link to start collecting! 🚀
                </p>
              )}
            </div>

            {leads.length > 0 && (
              <>
                <h3 className="text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider mt-6 mb-3">
                  Recent Activity
                </h3>
                <div className="flex flex-col gap-2">
                  {[...leads]
                    .sort(
                      (a, b) =>
                        new Date(b.submittedAt).getTime() -
                        new Date(a.submittedAt).getTime()
                    )
                    .slice(0, 8)
                    .map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between bg-white dark:bg-[#1C1C1E] rounded-[10px] px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#007AFF]/15 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-[#007AFF]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-black dark:text-white">
                              {l.name}
                            </p>
                            <p className="text-[11px] text-[#8E8E93]">
                              {l.purpose}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {l.appointmentSlot && (
                            <span className="text-[10px] font-bold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full block mb-0.5">
                              📅 Booked
                            </span>
                          )}
                          <span className="text-[11px] text-[#8E8E93]">
                            {formatDateShort(l.submittedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── LEADS TAB ─────────────────────────────────────────────────── */
          <>
            {/* Filters bar */}
            <div className="px-5 py-3 bg-white dark:bg-[#1C1C1E] border-b border-[#C6C6C8]/30 dark:border-[#38383A] shrink-0">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E8E93]" />
                  <input
                    type="text"
                    placeholder="Search name or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] text-[13px] text-black dark:text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>

                {/* Date from */}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] text-[13px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
                <span className="text-[#8E8E93] text-[12px]">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] text-[13px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />

                {/* Purpose filter */}
                <select
                  value={filterPurpose}
                  onChange={(e) => setFilterPurpose(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] text-[13px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                >
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                {/* Appointment filter */}
                <select
                  value={filterAppt}
                  onChange={(e) => setFilterAppt(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-[8px] text-[13px] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                >
                  {APPT_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[#FF3B30] text-[12px] font-semibold hover:bg-[#FF3B30]/10 rounded-[8px] transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}

                <button
                  onClick={refresh}
                  title="Refresh"
                  className="p-1.5 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] rounded-[8px] text-[#8E8E93] transition-colors ml-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-[#8E8E93] mt-1.5">
                Showing {filtered.length} of {leads.length} leads
                {hasActiveFilters && " (filtered)"}
              </p>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <Filter className="w-10 h-10 text-[#C6C6C8]" />
                  <p className="text-[15px] font-semibold text-[#8E8E93]">
                    {leads.length === 0
                      ? "No leads yet — share the chatbot to start collecting!"
                      : "No leads match your filters"}
                  </p>
                  {leads.length > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-[#007AFF] text-[13px] font-medium"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[#F2F2F7] dark:bg-[#0A0A0A]">
                    <tr>
                      {[
                        { key: "name" as SortKey, label: "Name" },
                        { key: "submittedAt" as SortKey, label: "Phone / Date" },
                        { key: "purpose" as SortKey, label: "Interest" },
                        { key: "appointmentSlot" as SortKey, label: "Appointment" },
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="px-4 py-2.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider cursor-pointer hover:text-black dark:hover:text-white transition-colors select-none"
                        >
                          <span className="flex items-center gap-1">
                            {label} <SortIcon col={key} />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead, i) => (
                      <React.Fragment key={lead.id}>
                        <tr
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === lead.id ? null : lead.id
                            )
                          }
                          className={`cursor-pointer border-t border-[#C6C6C8]/20 dark:border-[#38383A] transition-colors ${
                            expandedRow === lead.id
                              ? "bg-[#007AFF]/5 dark:bg-[#007AFF]/8"
                              : "bg-white dark:bg-[#1C1C1E] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]"
                          }`}
                        >
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#007AFF] to-violet-600 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-white">
                                  {(lead.name || "?")[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-black dark:text-white">
                                  {lead.name || "—"}
                                </p>
                                {isToday(lead.submittedAt) && (
                                  <span className="text-[10px] bg-[#FF9F0A]/15 text-[#FF9F0A] font-bold px-1.5 py-0.5 rounded-full">
                                    Today
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Phone / Date */}
                          <td className="px-4 py-3">
                            <p className="text-[13px] text-black dark:text-white font-mono">
                              {lead.phone || "—"}
                            </p>
                            <p className="text-[11px] text-[#8E8E93]">
                              {formatDateTime(lead.submittedAt)}
                            </p>
                          </td>

                          {/* Purpose */}
                          <td className="px-4 py-3">
                            <PurposeBadge purpose={lead.purpose || "—"} />
                          </td>

                          {/* Appointment */}
                          <td className="px-4 py-3">
                            {lead.appointmentSlot ? (
                              <span className="flex items-center gap-1 text-[12px] font-medium text-[#34C759]">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                {lead.appointmentSlot.length > 30
                                  ? lead.appointmentSlot.slice(0, 30) + "…"
                                  : lead.appointmentSlot}
                              </span>
                            ) : (
                              <span className="text-[12px] text-[#C6C6C8] dark:text-[#545458]">
                                —
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td
                            className="px-3 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setShowDeleteId(lead.id)}
                              className="p-1.5 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-[6px] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedRow === lead.id && (
                          <tr className="bg-[#007AFF]/5 dark:bg-[#007AFF]/8">
                            <td colSpan={5} className="px-4 pb-4 pt-0">
                              <div className="flex gap-4 flex-wrap mt-1">
                                {/* Brief */}
                                {Object.keys(lead.brief || {}).length > 0 && (
                                  <div className="flex-1 min-w-[200px]">
                                    <p className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5">
                                      Project Brief
                                    </p>
                                    <div className="bg-white dark:bg-[#1C1C1E] rounded-[8px] p-3 flex flex-col gap-2">
                                      {Object.entries(lead.brief).map(([k, v]) => (
                                        <div key={k}>
                                          <p className="text-[11px] font-bold text-[#007AFF]">
                                            {k}
                                          </p>
                                          <p className="text-[13px] text-black dark:text-white">
                                            {v}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Chat Context */}
                                {lead.chatSummary && (
                                  <div className="flex-1 min-w-[200px]">
                                    <p className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> Chat Context
                                    </p>
                                    <div className="bg-white dark:bg-[#1C1C1E] rounded-[8px] p-3 max-h-32 overflow-y-auto no-scrollbar">
                                      <p className="text-[12px] text-black dark:text-white whitespace-pre-wrap leading-relaxed font-mono">
                                        {lead.chatSummary}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Lead ID */}
                                <div className="w-full mt-1">
                                  <p className="text-[10px] text-[#8E8E93] font-mono">
                                    ID: {lead.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-white dark:bg-[#1C1C1E] border-t border-[#C6C6C8]/30 dark:border-[#38383A] flex items-center justify-between shrink-0">
              <button
                onClick={() => setShowConfirmClear(true)}
                className="flex items-center gap-1.5 text-[12px] text-[#FF3B30] font-medium hover:bg-[#FF3B30]/10 px-2 py-1 rounded-[6px] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All Data
              </button>
              <p className="text-[11px] text-[#8E8E93]">
                Data stored locally · {filtered.length} shown
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Delete single lead confirm ──────────────────────────────────── */}
      {showDeleteId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => setShowDeleteId(null)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-[16px] p-6 w-full max-w-xs shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle className="w-8 h-8 text-[#FF3B30] mx-auto mb-3" />
            <h3 className="text-[16px] font-bold text-center text-black dark:text-white">
              Delete this lead?
            </h3>
            <p className="text-[13px] text-[#8E8E93] text-center mt-1">
              This cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowDeleteId(null)}
                className="flex-1 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] text-black dark:text-white rounded-[8px] text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteId)}
                className="flex-1 py-2 bg-[#FF3B30] text-white rounded-[8px] text-[14px] font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear all confirm ───────────────────────────────────────────── */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => setShowConfirmClear(false)}>
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-[16px] p-6 w-full max-w-xs shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle className="w-8 h-8 text-[#FF3B30] mx-auto mb-3" />
            <h3 className="text-[16px] font-bold text-center text-black dark:text-white">
              Clear ALL leads?
            </h3>
            <p className="text-[13px] text-[#8E8E93] text-center mt-1">
              This will permanently delete {leads.length} lead
              {leads.length !== 1 ? "s" : ""}. Cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 py-2 bg-[#F2F2F7] dark:bg-[#2C2C2E] text-black dark:text-white rounded-[8px] text-[14px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2 bg-[#FF3B30] text-white rounded-[8px] text-[14px] font-bold"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
