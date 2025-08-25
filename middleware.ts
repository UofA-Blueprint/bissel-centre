import { NextRequest, NextResponse } from "next/server";

// Define protected routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/profile"];

// Define admin-only routes
const ADMIN_ROUTES = ["/admin"];

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/admin/login", "/admin/register"];

async function verifySessionAndClaims(sessionCookie: string, baseUrl: string) {
  try {
    // Use the session-login API to verify the session and get claims
    const response = await fetch(`${baseUrl}/api/user-session`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}

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
  if (PUBLIC_ROUTES.includes(pathname) && !isProtectedRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Get session cookie
  const sessionCookie = request.cookies.get("session")?.value;

  // If no session cookie and accessing protected route, redirect to appropriate login
  if (!sessionCookie) {
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // If session cookie exists, verify session and claims
  const userData = await verifySessionAndClaims(
    sessionCookie,
    request.nextUrl.origin
  );

  if (!userData) {
    // Invalid session, redirect to appropriate login
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Check admin routes access
  if (isAdminRoute) {
    // For admin routes, check if user has admin privileges
    if (!userData.admin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // If we get here, user has valid session and appropriate permissions
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
