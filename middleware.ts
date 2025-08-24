import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/app/services/firebaseAdmin";

// Define protected routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/setup", "/profile"];

// Define admin-only routes
const ADMIN_ROUTES = ["/dashboard", "/setup"];

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/admin/login", "/admin/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // If it's a public route, allow access
  if (PUBLIC_ROUTES.includes(pathname) && !isProtectedRoute) {
    return NextResponse.next();
  }

  // Get session cookie
  const sessionCookie = request.cookies.get("session")?.value;

  // If no session cookie and accessing protected route, redirect to appropriate login
  if (!sessionCookie && isProtectedRoute) {
    const loginUrl = isAdminRoute ? "/admin/login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // If session cookie exists, verify it
  if (sessionCookie && isProtectedRoute) {
    try {
      const admin = await initAdmin();
      const decodedClaims = await admin
        .auth()
        .verifySessionCookie(sessionCookie, true);

      // Check if user has admin privileges for admin routes
      if (isAdminRoute && !decodedClaims.admin) {
        // User is authenticated but not admin, redirect to admin login
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }

      // Valid session, allow access
      return NextResponse.next();
    } catch {
      // Invalid session, clear cookie and redirect to login
      const response = NextResponse.redirect(
        new URL(isAdminRoute ? "/admin/login" : "/login", request.url)
      );
      response.cookies.delete("session");
      return response;
    }
  }

  // For protected routes without session, redirect to login
  if (isProtectedRoute) {
    const loginUrl = isAdminRoute ? "/admin/login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
