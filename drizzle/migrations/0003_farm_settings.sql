CREATE TABLE public.farm_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tank_liters numeric NOT NULL DEFAULT 500,
  albert_ec_per_g_l numeric NOT NULL DEFAULT 1.0,
  ph_down_ml numeric NOT NULL DEFAULT 5,
  ph_up_ml numeric NOT NULL DEFAULT 5,
  vpd_min numeric NOT NULL DEFAULT 0.8,
  vpd_max numeric NOT NULL DEFAULT 1.2,
  total_slots int NOT NULL DEFAULT 500,
  kg_per_crate numeric NOT NULL DEFAULT 5,
  grow_days int NOT NULL DEFAULT 35,
  nursery_days int NOT NULL DEFAULT 14,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.farm_settings TO authenticated;
GRANT ALL ON public.farm_settings TO service_role;
ALTER TABLE public.farm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.farm_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert settings" ON public.farm_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner update settings" ON public.farm_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));