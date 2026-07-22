/** Layer B (D007) — mapeamento URL ↔ abas do shell. */

export type AppTab = "home" | "client" | "maker" | "designer" | "moderator" | "admin";
export type HomeMode = "select" | "client" | "maker" | "designer";

export type AppRouteState = {
  tab: AppTab;
  homeMode: HomeMode;
};

export function pathToAppState(pathname: string): AppRouteState {
  const path = pathname.replace(/\/$/, "") || "/";
  switch (path) {
    case "/maker":
      return { tab: "maker", homeMode: "maker" };
    case "/designer":
      return { tab: "designer", homeMode: "designer" };
    case "/admin":
      return { tab: "admin", homeMode: "maker" };
    case "/quote":
      return { tab: "client", homeMode: "client" };
    case "/client":
      return { tab: "home", homeMode: "client" };
    case "/":
    default:
      return { tab: "home", homeMode: "maker" };
  }
}

export function appStateToPath(tab: AppTab, homeMode: HomeMode = "maker"): string {
  if (tab === "maker") return "/maker";
  if (tab === "designer") return "/designer";
  if (tab === "admin") return "/admin";
  if (tab === "client") return "/quote";
  if (tab === "home" && homeMode === "client") return "/client";
  if (tab === "home" && homeMode === "designer") return "/designer";
  return "/";
}
