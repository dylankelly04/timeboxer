import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outlookIntegrations } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { getDefaultCalendarId, createCalendarSubscription } from "@/lib/outlook";

/**
 * GET /api/auth/outlook/callback - Handle Outlook OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", request.url));
    }

    // Decode state to get userId
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      userId = stateData.userId;
    } catch {
      return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri =
      process.env.OUTLOOK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/outlook/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/?error=not_configured", request.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorText);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", request.url));
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Get default calendar ID
    const calendarId = await getDefaultCalendarId(tokenData.access_token);

    // Check if integration already exists
    const [existing] = await db
      .select()
      .from(outlookIntegrations)
      .where(eq(outlookIntegrations.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing integration
      await db
        .update(outlookIntegrations)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          calendarId: calendarId || existing.calendarId,
          updatedAt: new Date(),
        })
        .where(eq(outlookIntegrations.userId, userId));
    } else {
      // Create new integration
      await db.insert(outlookIntegrations).values({
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        calendarId: calendarId || null,
        syncEnabled: true,
      });
    }

    // Automatically create webhook subscription after connection
    // This happens asynchronously to not block the redirect
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000"}/api/outlook/webhook`;
    if (calendarId) {
      createCalendarSubscription(tokenData.access_token, calendarId, webhookUrl, 4320)
        .then((subscription) => {
          if (subscription) {
            db.update(outlookIntegrations)
              .set({
                subscriptionId: subscription.id,
                subscriptionExpiresAt: new Date(subscription.expirationDateTime),
                updatedAt: new Date(),
              })
              .where(eq(outlookIntegrations.userId, userId))
              .catch((err) => console.error("Failed to save subscription:", err));
          }
        })
        .catch((err) => console.error("Failed to create subscription:", err));
    }

    return NextResponse.redirect(new URL("/?outlook_connected=true", request.url));
  } catch (error: any) {
    console.error("Error in Outlook OAuth callback:", error);
    return NextResponse.redirect(new URL("/?error=callback_error", request.url));
  }
}

