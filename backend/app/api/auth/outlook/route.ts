import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/auth/outlook - Initiate Outlook OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri =
      process.env.OUTLOOK_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL}/api/auth/outlook/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: "Outlook OAuth not configured" },
        { status: 500 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(
      JSON.stringify({ userId: session.user.id })
    ).toString("base64");

    const authUrl = new URL(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    );
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("scope", "Calendars.ReadWrite offline_access");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error: any) {
    console.error("Error initiating Outlook OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
