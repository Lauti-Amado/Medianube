import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PATHS = [
  "/dashboard",
  "/compras",
  "/precios",
  "/demanda",
  "/configuracion",
];

// Routes that should redirect to dashboard if already authenticated
const AUTH_PATHS = ["/login", "/onboarding"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("cognitoIdToken")?.value;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  const isAuthPage = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // If trying to access a protected route without a token → redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated and trying to access login/onboarding → redirect to dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/compras/:path*",
    "/precios/:path*",
    "/demanda/:path*",
    "/configuracion/:path*",
    "/login",
    "/onboarding",
  ],
};
