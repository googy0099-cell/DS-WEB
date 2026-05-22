import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { generateUniqueMemberCode } from "@/lib/member-code";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!ok) return null;
        await db.user.update({
          where: { id: user.id },
          data: { visitCount: { increment: 1 } },
        });
        return {
          id: String(user.id),
          email: user.email,
          name: user.username,
          role: user.role,
          username: user.username,
          memberCode: user.memberCode,
          firstName: user.firstName,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      // Credentials login — user already has our DB fields
      if (user && account?.provider === "credentials") {
        token.id = user.id!;
        token.role = (user as { role?: string }).role;
        token.username = (user as { username?: string }).username;
        token.memberCode = (user as { memberCode?: string }).memberCode;
        token.firstName = (user as { firstName?: string }).firstName;
      }
      // Google login — fetch real DB user to populate token
      if (account?.provider === "google" && user?.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.id = String(dbUser.id);
          token.role = dbUser.role;
          token.username = dbUser.username;
          token.memberCode = dbUser.memberCode;
          token.firstName = dbUser.firstName;
          token.picture = user.image ?? null;
        }
      }
      return token;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        let dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (!dbUser) {
          const memberCode = await generateUniqueMemberCode();
          const nameParts = (user.name ?? "Google User").split(" ");
          dbUser = await db.user.create({
            data: {
              email: user.email,
              googleId: account.providerAccountId,
              firstName: nameParts[0] ?? "User",
              lastName: nameParts.slice(1).join(" ") || "-",
              username: `g_${account.providerAccountId.slice(-6)}`,
              memberCode,
              role: user.email === "googy0099@gmail.com" ? "OWNER" : "USER",
            },
          });
        } else if (
          user.email === "googy0099@gmail.com" &&
          dbUser.role !== "OWNER"
        ) {
          await db.user.update({
            where: { id: dbUser.id },
            data: { role: "OWNER", googleId: account.providerAccountId },
          });
        }
        await db.user.update({
          where: { email: user.email },
          data: { visitCount: { increment: 1 } },
        });
      }
      return true;
    },
  },
});
