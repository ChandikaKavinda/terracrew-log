import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GreenLog" },
      { name: "description", content: "Sign in or join your greenhouse team on GreenLog." },
      { property: "og:title", content: "Sign in — GreenLog" },
      { property: "og:description", content: "Sign in or join your greenhouse team on GreenLog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  name: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: p.data.email,
      password: p.data.password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: p.data.name || undefined } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: "/dashboard" });
    else toast.success("Check your email to confirm your account, then sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <Sprout className="h-7 w-7" /> GreenLog
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Join team</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} /></div>
              <Button className="w-full" disabled={busy}>Sign in</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div><Label>Your name</Label><Input value={form.name} onChange={set("name")} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} /></div>
              <Button className="w-full" disabled={busy}>Create account</Button>
              <p className="text-xs text-muted-foreground">The first person to join becomes the owner. Everyone after joins as a worker.</p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
