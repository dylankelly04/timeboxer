import { db } from "./db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Get valid access token for a user, refreshing if necessary
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const [integration] = await db
    .select()
    .from(outlookIntegrations)
    .where(eq(outlookIntegrations.userId, userId))
    .limit(1);

  if (!integration) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(integration.expiresAt);
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - now.getTime() < buffer) {
    // Token expired or about to expire, refresh it
    const newTokens = await refreshAccessToken(integration.refreshToken);
    if (!newTokens) {
      return null;
    }

    // Update database with new tokens
    await db
      .update(outlookIntegrations)
      .set({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(outlookIntegrations.userId, userId));

    return newTokens.accessToken;
  }

  return integration.accessToken;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<OutlookTokens | null> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const redirectUri =
    process.env.OUTLOOK_REDIRECT_URI ||
    `${process.env.NEXTAUTH_URL}/api/auth/outlook/callback`;

  if (!clientId || !clientSecret) {
    console.error("Outlook OAuth credentials not configured");
    return null;
  }

  try {
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to refresh Outlook token:", error);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
    };
  } catch (error) {
    console.error("Error refreshing Outlook token:", error);
    return null;
  }
}

/**
 * Get user's default calendar ID
 */
export async function getDefaultCalendarId(
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(`${GRAPH_API_BASE}/me/calendars`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch calendars:", await response.text());
      return null;
    }

    const data = await response.json();
    const defaultCalendar =
      data.value?.find((cal: any) => cal.isDefaultCalendar) || data.value?.[0];
    return defaultCalendar?.id || null;
  } catch (error) {
    console.error("Error fetching calendar ID:", error);
    return null;
  }
}

/**
 * Create a calendar event in Outlook
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    body?: { contentType: string; content: string };
  }
): Promise<string | null> {
  try {
    console.log("Creating Outlook calendar event:", {
      calendarId,
      subject: event.subject,
      start: event.start.dateTime,
      end: event.end.dateTime,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Failed to create calendar event - HTTP",
        response.status,
        ":",
        errorText
      );
      try {
        const errorJson = JSON.parse(errorText);
        console.error("Error details:", errorJson);
      } catch {
        // Not JSON, already logged as text
      }
      return null;
    }

    const data = await response.json();
    console.log("Outlook event created successfully with ID:", data.id);
    return data.id;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Update a calendar event in Outlook
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    subject?: string;
    start?: { dateTime: string; timeZone: string };
    end?: { dateTime: string; timeZone: string };
    body?: { contentType: string; content: string };
  }
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/events/${eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to update calendar event:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return false;
  }
}

/**
 * Delete a calendar event from Outlook
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to delete calendar event:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return false;
  }
}

/**
 * Check if user has Outlook integration
 */
export async function hasOutlookIntegration(userId: string): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(outlookIntegrations)
    .where(eq(outlookIntegrations.userId, userId))
    .limit(1);

  return !!integration;
}

/**
 * Fetch calendar events from Outlook
 */
export async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  startDateTime: string,
  endDateTime: string,
  timeZone: string = "UTC"
): Promise<
  Array<{
    id: string;
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    body?: { content: string };
  }>
> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/calendars/${calendarId}/calendarView?startDateTime=${encodeURIComponent(
        startDateTime
      )}&endDateTime=${encodeURIComponent(
        endDateTime
      )}&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: `outlook.timezone="${timeZone}"`, // Request events in user's timezone
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to fetch calendar events:", error);
      return [];
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
  }
}

/**
 * Create a webhook subscription for calendar events
 */
export async function createCalendarSubscription(
  accessToken: string,
  calendarId: string,
  notificationUrl: string,
  expirationMinutes: number = 4320 // 3 days (max is 4230 for calendar subscriptions)
): Promise<{
  id: string;
  expirationDateTime: string;
} | null> {
  try {
    // Calculate expiration time
    const expirationDateTime = new Date();
    expirationDateTime.setMinutes(
      expirationDateTime.getMinutes() + expirationMinutes
    );

    const response = await fetch(`${GRAPH_API_BASE}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl,
        resource: `/me/calendars/${calendarId}/events`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: Buffer.from(calendarId).toString("base64"), // Use calendarId as client state for validation
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to create subscription:", error);
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      expirationDateTime: data.expirationDateTime,
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    return null;
  }
}

/**
 * Renew a webhook subscription
 */
export async function renewCalendarSubscription(
  accessToken: string,
  subscriptionId: string,
  expirationMinutes: number = 4320
): Promise<boolean> {
  try {
    const expirationDateTime = new Date();
    expirationDateTime.setMinutes(
      expirationDateTime.getMinutes() + expirationMinutes
    );

    const response = await fetch(
      `${GRAPH_API_BASE}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expirationDateTime: expirationDateTime.toISOString(),
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Error renewing subscription:", error);
    return false;
  }
}

/**
 * Delete a webhook subscription
 */
export async function deleteCalendarSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return false;
  }
}
