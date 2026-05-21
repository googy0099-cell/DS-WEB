import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      username: string;
      memberCode: string;
      firstName: string;
    };
  }
  interface User {
    role?: string;
    username?: string;
    memberCode?: string;
    firstName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    username?: string;
    memberCode?: string;
    firstName?: string;
  }
}
