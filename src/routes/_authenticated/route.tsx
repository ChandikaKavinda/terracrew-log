import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ClipboardCheck, Sprout, Scale, Boxes, Wallet, Users, LogOut, Menu, Leaf, LineChart, Map } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/check", label: "Daily checklist", icon: ClipboardCheck },
  { to: "/batches", label: "Batches", icon: Sprout },
  { to: "/greenhouse", label: "Greenhouse map", icon: Map },
  { to: "/profiles", label: "Crop profiles", icon: Leaf },
  { to: "/harvests", label: "Harvest & grading", icon: Scale },
  { to: "/insights", label: "Insights & planning", icon: LineChart },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/finance", label: "Income & expenses", icon: Wallet, owner: true },
  { to: "/team", label: "Team", icon: Users },
] as const;

function Shell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = nav.filter((n) => !("owner" in n) || me?.isOwner);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground md:flex",
          open ? "flex" : "hidden",
        )}
      >
        <div className="flex items-center gap-2 px-6 py-6 font-display text-xl font-bold text-sidebar-primary">
          <Sprout className="h-6 w-6" /> GreenLog
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {links.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="text-sm font-semibold">{me?.name}</div>
          <div className="text-xs opacity-70">{me?.isOwner ? "Owner" : "Worker"}</div>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1 md:ml-64">
        <div className="flex items-center gap-2 border-b px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu /></Button>
          <span className="font-display font-bold text-primary">GreenLog</span>
        </div>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
