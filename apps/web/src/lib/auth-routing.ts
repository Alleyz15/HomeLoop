export type Role = "owner" | "admin";

const OWNER_ROUTES = ["/home", "/dashboard", "/valuation", "/new-home", "/plans", "/apply"];

function matchesRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isApplicationPath(pathname: string): boolean {
  return [...OWNER_ROUTES, "/admin"].some((prefix) => matchesRoute(pathname, prefix));
}

export function landingPathFor(role: Role): string {
  return role === "admin" ? "/admin" : "/home";
}

/** Resolve navigation only; authorization still uses server-side role checks. */
export function postAuthPathFor(role: Role, next = ""): string {
  if (role === "admin") return "/admin";

  // Only homeowners' in-app destinations may override their landing page.
  // Normalizing the URL also prevents dot segments from escaping that scope.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(next)) {
    return "/home";
  }
  try {
    const target = new URL(next, "https://homeloop.invalid");
    if (target.origin === "https://homeloop.invalid" && OWNER_ROUTES.some((prefix) => matchesRoute(target.pathname, prefix))) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // A malformed destination must never prevent a successful login.
  }
  return "/home";
}

export function brandPathFor(pathname: string, role?: Role): string {
  return role && isApplicationPath(pathname) ? landingPathFor(role) : "/";
}
