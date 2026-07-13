/**
 * useCRM — serverless, localStorage-backed CRM store.
 *
 * All lead and appointment data is persisted in the browser's localStorage
 * under the key "crm_leads". No server required.
 *
 * Custom event "crm-updated" is dispatched on every write so any mounted
 * CRMDashboard re-renders live without needing a full page reload.
 */

export interface CRMLead {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  brief: Record<string, string>;
  chatSummary: string;
  appointmentSlot?: string;
  submittedAt: string; // ISO string
}

const STORAGE_KEY = "crm_leads_v1";
const CRM_UPDATED = "crm-updated";

function broadcast() {
  window.dispatchEvent(new CustomEvent(CRM_UPDATED));
}

function readAll(): CRMLead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CRMLead[];
  } catch {
    return [];
  }
}

function writeAll(leads: CRMLead[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    broadcast();
  } catch (e) {
    console.warn("[CRM] localStorage write failed:", e);
  }
}

export function addLead(lead: Omit<CRMLead, "submittedAt"> & { submittedAt?: string }): CRMLead {
  const all = readAll();
  const full: CRMLead = {
    ...lead,
    submittedAt: lead.submittedAt ?? new Date().toISOString(),
  };
  writeAll([...all, full]);
  return full;
}

export function updateLeadAppointment(leadId: string, slot: string): boolean {
  const all = readAll();
  const idx = all.findIndex((l) => l.id === leadId);
  if (idx === -1) return false;
  all[idx].appointmentSlot = slot;
  writeAll(all);
  return true;
}

/** Add appointment as standalone record if no matching leadId exists */
export function addAppointmentLead(
  name: string,
  phone: string,
  slot: string,
  chatSummary: string,
  leadId?: string
): void {
  if (leadId) {
    const updated = updateLeadAppointment(leadId, slot);
    if (updated) return;
  }
  addLead({
    id: leadId ?? `appt-${Date.now()}`,
    name,
    phone,
    purpose: "Appointment Booking",
    brief: {},
    chatSummary,
    appointmentSlot: slot,
  });
}

export function getLeads(): CRMLead[] {
  return readAll();
}

export function deleteLead(id: string): void {
  const all = readAll().filter((l) => l.id !== id);
  writeAll(all);
}

export function clearAllLeads(): void {
  localStorage.removeItem(STORAGE_KEY);
  broadcast();
}

export function onCRMUpdated(cb: () => void): () => void {
  window.addEventListener(CRM_UPDATED, cb);
  return () => window.removeEventListener(CRM_UPDATED, cb);
}
