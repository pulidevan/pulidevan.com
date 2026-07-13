/**
 * clientApi.ts — Production-ready client-side API routing.
 *
 * Fetches from standard backend endpoints:
 *  - `/api/gemini/generate`
 *  - `/api/lead`
 *  - `/api/book-appointment`
 *
 * In local dev (Express server.ts): Handled by Express Node.js routes.
 * In production (Hostinger static): Rewritten by .htaccess to PHP proxy scripts,
 * securing all API keys from the client JS bundle.
 */

export async function geminiGenerate(prompt: string) {
  try {
    const res = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      throw new Error("Invalid response or non-JSON content");
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn("[clientApi] Clean API route failed, trying direct PHP fallback:", err);
    try {
      const fallbackRes = await fetch("/api/generate.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!fallbackRes.ok) {
        throw new Error(`Fallback failed: ${fallbackRes.statusText}`);
      }

      const data = await fallbackRes.json();
      return data;
    } catch (fallbackErr: any) {
      console.error("[clientApi] Both API routes failed:", fallbackErr);
      throw fallbackErr;
    }
  }
}

export async function submitLead(payload: {
  name: string;
  phone: string;
  purpose: string;
  brief: Record<string, string>;
  chatSummary: string;
  leadId: string;
  summary?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/lead.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Lead submit failed");
    }
    return { success: true };
  } catch (err: any) {
    console.error("[clientApi] submitLead error:", err);
    return { success: false, error: err.message };
  }
}

export async function bookAppointment(payload: {
  name: string;
  phone: string;
  slot: string;
  leadId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/book-appointment.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Appointment booking failed");
    }
    return { success: true };
  } catch (err: any) {
    console.error("[clientApi] bookAppointment error:", err);
    return { success: false, error: err.message };
  }
}
