import { NextRequest, NextResponse } from "next/server";

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

  // If session cookie exists for protected routes, allow access
  // Verification and claims checking will be handled by server layouts
  if (sessionCookie && isProtectedRoute) {
    return NextResponse.next();
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
