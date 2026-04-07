// @ts-nocheck
// ============================================================
// GOOGLE CALENDAR CLIENT — Dont Dream. Plan.
// ============================================================

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
  extendedProperties?: {
    private?: { ddp_block_id?: string; ddp_dream_id?: string };
  };
}

// Obter novo access token via refresh token
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

// Criar evento no Google Calendar
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent,
  calendarId = "primary"
): Promise<string | null> {
  try {
    const res = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}

// Actualizar evento
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Partial<CalendarEvent>,
  calendarId = "primary"
): Promise<boolean> {
  try {
    const res = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Eliminar evento
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<boolean> {
  try {
    const res = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

// Listar eventos num intervalo (para detectar conflitos)
export async function listCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarId = "primary"
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const res = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// Construir evento DDP a partir de um bloco
export function buildBlockEvent(block: {
  id: string;
  title: string;
  dream_title: string;
  scheduled_at: string;
  duration_minutes?: number;
}): CalendarEvent {
  const start = new Date(block.scheduled_at);
  const end = new Date(start.getTime() + (block.duration_minutes || 30) * 60 * 1000);
  return {
    summary: `🎯 ${block.title}`,
    description: `Dont Dream. Plan. — ${block.dream_title}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    colorId: "9", // Blueberry
    extendedProperties: {
      private: { ddp_block_id: block.id, ddp_dream_id: block.id },
    },
  };
}

// Detectar conflitos entre blocos DDP e eventos existentes
export function detectConflicts(
  ddpBlocks: Array<{ scheduled_at: string; duration_minutes?: number }>,
  calendarEvents: any[]
): number {
  let conflicts = 0;
  for (const block of ddpBlocks) {
    const blockStart = new Date(block.scheduled_at).getTime();
    const blockEnd = blockStart + (block.duration_minutes || 30) * 60 * 1000;
    for (const event of calendarEvents) {
      if (event.extendedProperties?.private?.ddp_block_id) continue; // Skip DDP events
      const evStart = new Date(event.start?.dateTime || event.start?.date).getTime();
      const evEnd = new Date(event.end?.dateTime || event.end?.date).getTime();
      if (blockStart < evEnd && blockEnd > evStart) conflicts++;
    }
  }
  return conflicts;
}
