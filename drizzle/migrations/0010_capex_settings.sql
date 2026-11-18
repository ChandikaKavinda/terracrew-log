ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.farm_settings ADD COLUMN IF NOT EXISTS capex_years numeric NOT NULL DEFAULT 5;
ALTER TABLE public.farm_settings ADD COLUMN IF NOT EXISTS cycles_per_year numeric NOT NULL DEFAULT 10;
ALTER TABLE public.farm_settings ADD COLUMN IF NOT EXISTS target_margin_pct numeric NOT NULL DEFAULT 25;