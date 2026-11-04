import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Section({ title, children, desc }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <p className="mb-3 text-sm text-muted-foreground">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export const num = (v: string) => (v.trim() === "" ? null : Number(v));
