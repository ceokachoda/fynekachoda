// A template re-mounts on every navigation (unlike a layout), so the
// fade-in-up animation re-runs each time a dashboard page commits — the new
// page's content visibly flows in instead of snapping. Pairs with the top
// RouteProgress bar (in-flight indicator) and loading.tsx (slow-load skeleton).
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fs-page-enter">{children}</div>;
}
