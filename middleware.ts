import { NextRequest, NextResponse } from "next/server";

// Staff-only routes (regular administrative staff, not IT admins)
const STAFF_ONLY_ROUTES = ["/dashboard", "/profile", "/cards", "/reports"];

// Admin routes that remain public for authentication/bootstrap
const ADMIN_PUBLIC_ROUTES = ["/admin/login", "/admin/register"];
const STAFF_PUBLIC_ROUTES = ["/login", "/register"];
const GLOBAL_PUBLIC_ROUTES = ["/"];

function isAdminProtectedRoute(pathname: string) {
  return pathname.startsWith("/admin") && !ADMIN_PUBLIC_ROUTES.includes(pathname);
}

function isStaffProtectedRoute(pathname: string) {
  return STAFF_ONLY_ROUTES.some((route) => pathname.startsWith(route));
}

function isPublicRoute(pathname: string) {
  return (
    GLOBAL_PUBLIC_ROUTES.includes(pathname) ||
    STAFF_PUBLIC_ROUTES.includes(pathname) ||
    ADMIN_PUBLIC_ROUTES.includes(pathname)
  );
}

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

  const isAdminRoute = isAdminProtectedRoute(pathname);
  const isStaffRoute = isStaffProtectedRoute(pathname);
  const isAdminAuthRoute = ADMIN_PUBLIC_ROUTES.includes(pathname);
  const isStaffAuthRoute = STAFF_PUBLIC_ROUTES.includes(pathname);
  const publicRoute = isPublicRoute(pathname);

  // Get session cookie
  const sessionCookie = request.cookies.get("session")?.value;

  // No session:
  // - allow public pages (/ , /login, /register, /admin/login, /admin/register)
  // - redirect protected pages to their respective login pages
  if (!sessionCookie) {
    if (publicRoute) {
      return NextResponse.next();
    }
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isStaffRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // If session cookie exists, verify session and claims
  const userData = await verifySessionAndClaims(
    sessionCookie,
    request.nextUrl.origin
  );

  if (!userData) {
    // Invalid session: send users back to the appropriate login page
    if (isAdminRoute || isAdminAuthRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isStaffRoute || isStaffAuthRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const isAdminUser = userData.admin === true;
  const isStaffUser = userData.staff === true;

  // Keep authenticated users away from login/register screens
  if (isAdminAuthRoute) {
    if (isAdminUser) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (isStaffUser) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (isStaffAuthRoute) {
    if (isAdminUser) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (isStaffUser) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin route access: IT admins only
  if (isAdminRoute) {
    if (!isAdminUser) {
      if (isStaffUser) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Staff route access: administrative staff can operate normally; IT admins are
  // allowed through in read-only "view as" mode (the pages themselves lock down
  // mutations and surface the (View only) header badge).
  if (isStaffRoute) {
    if (!isAdminUser && !isStaffUser) {
      return NextResponse.redirect(new URL("/login", request.url));
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
