import { env, isZoomConfigured } from "../../config/env";

/**
 * Minimal Zoom Server-to-Server OAuth client (no SDK — global fetch only).
 *
 * Requires a Zoom "Server-to-Server OAuth" app (Zoom Marketplace) with the
 * `meeting:write:meeting:admin` scope, and these env vars:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 *
 * If Zoom isn't configured, `createZoomMeeting` returns null and the caller
 * falls back to whatever manual `location` the user provided.
 */

export interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Reuse the token until ~1 min before expiry.
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${env.zoomClientId}:${env.zoomClientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: env.zoomAccountId!,
  });

  const res = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zoom auth failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface CreateZoomMeetingInput {
  topic: string;
  agenda?: string;
  startTime: Date;
  endTime: Date;
}

/**
 * Creates a scheduled Zoom meeting on the S2S app's default user ("me").
 * Returns null (never throws) when Zoom isn't configured, so meeting creation
 * still succeeds without it. Real API errors ARE thrown so the caller can
 * surface them.
 */
export async function createZoomMeeting(input: CreateZoomMeetingInput): Promise<ZoomMeetingResult | null> {
  if (!isZoomConfigured) return null;

  const token = await getAccessToken();
  const durationMin = Math.max(
    1,
    Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60_000),
  );

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2, // scheduled meeting
      start_time: input.startTime.toISOString(),
      duration: durationMin,
      agenda: input.agenda?.slice(0, 2000),
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zoom create meeting failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: number; join_url: string; start_url: string };
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    startUrl: data.start_url,
  };
}
