import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user in database
        let user;
        try {
          const result = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          user = result[0] || null;
        } catch (error: any) {
          console.error("Database error in auth:", error);
          console.error("Error details:", error?.message, error?.stack);
          // Return null to indicate authentication failure
          return null;
        }

        if (!user) {
          // For demo purposes, create a new user if they don't exist
          // In production, you'd want to have a separate signup flow
          try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const [newUser] = await db
              .insert(users)
              .values({
                email,
                password: hashedPassword,
                name: email.split("@")[0],
              })
              .returning();
            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name || newUser.email.split("@")[0],
              image: newUser.image || undefined,
            };
          } catch (error: any) {
            console.error("[AUTH] Database error creating user:", error);
            console.error("[AUTH] Error details:", error?.message);
            console.error("[AUTH] Error code:", error?.code);
            console.error("[AUTH] Error meta:", error?.meta);
            if (error?.stack) {
              console.error("[AUTH] Error stack:", error?.stack);
            }
            // Return null to indicate authentication failure
            return null;
          }
        }

        // Check if user has a password (OAuth users don't)
        if (!user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split("@")[0],
          image: user.image || undefined,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        try {
          // Store Google user in database
          const existingUsers = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);
          const existingUser = existingUsers[0] || null;

          if (!existingUser) {
            const [newUser] = await db.insert(users).values({
              email: user.email,
              name: user.name || user.email.split("@")[0],
              image: user.image || null,
              password: null, // OAuth users don't have passwords
            }).returning();
            // Update the user object with the database ID so it's used in JWT
            if (newUser) {
              user.id = newUser.id;
            }
          } else {
            // Update image if user exists but doesn't have one
            if (!existingUser.image && user.image) {
              await db
                .update(users)
                .set({ image: user.image })
                .where(eq(users.id, existingUser.id));
            }
            // Use the database user ID, not NextAuth's generated ID
            user.id = existingUser.id;
          }
        } catch (error) {
          console.error("Database error in Google sign in:", error);
          // Don't block sign in if database fails
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
