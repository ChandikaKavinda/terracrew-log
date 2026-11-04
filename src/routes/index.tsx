import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, ClipboardCheck, LineChart, Boxes, Wallet, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreenLog — Run your hydroponic greenhouse day by day" },
      { name: "description", content: "Team checklists, EC/pH and climate charts, plant growth, quality grading, batches, inventory and income tracking." },
      { property: "og:title", content: "GreenLog — Run your hydroponic greenhouse day by day" },
      { property: "og:description", content: "Team checklists, EC/pH and climate charts, plant growth, quality grading, batches, inventory and income tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ClipboardCheck, t: "Daily checklist", d: "Tank, water source, EC, pH, climate, PPE, leaks, insects and flow — in one form." },
  { icon: LineChart, t: "Live charts", d: "See EC, pH, water & air temperature and humidity trends to tune nutrients and foggers." },
  { icon: Sprout, t: "Growth & quality", d: "Track 10 fixed sample plants and 25 random plants for deficiencies, pests and disease." },
  { icon: Boxes, t: "Batches & inventory", d: "Follow each batch from nursery to harvest and keep stock levels in check." },
  { icon: Wallet, t: "Income & expenses", d: "Record sales and costs in rupees and see monthly profit." },
  { icon: Bell, t: "Reminders", d: "Daily checks, filter checks twice a week, and weekly inventory counts." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-primary">
          <Sprout className="h-6 w-6" /> GreenLog
        </div>
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="py-16 md:py-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">Hydroponic greenhouse manager</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-foreground md:text-6xl">
            Every plant, every reading, every rupee — logged.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Built for a 500-plant system. Your team fills the daily checklist; you see what's changing and act on it.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-xl border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
