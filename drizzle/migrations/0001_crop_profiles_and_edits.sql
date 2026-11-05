CREATE TABLE public.crop_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  crop text NOT NULL DEFAULT 'Lettuce',
  season text,
  ec_min numeric, ec_max numeric,
  ph_min numeric, ph_max numeric,
  water_temp_min numeric, water_temp_max numeric,
  air_temp_min numeric, air_temp_max numeric,
  humidity_min numeric, humidity_max numeric,
  grade_a_min_g numeric, grade_a_min_leaves integer,
  grade_b_min_g numeric, grade_b_min_leaves integer,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_profiles TO authenticated;
GRANT ALL ON public.crop_profiles TO service_role;
ALTER TABLE public.crop_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.crop_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "members insert" ON public.crop_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members update" ON public.crop_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "owner delete" ON public.crop_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.batches ADD COLUMN profile_id uuid REFERENCES public.crop_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.daily_checks ADD COLUMN germination_issues text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.growth_measurements ADD COLUMN variety text;
ALTER TABLE public.transactions ADD COLUMN counterparty text, ADD COLUMN handled_by text, ADD COLUMN inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;

ALTER TABLE public.growth_measurements DROP CONSTRAINT growth_measurements_batch_id_fkey, ADD CONSTRAINT growth_measurements_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
ALTER TABLE public.growth_measurements DROP CONSTRAINT growth_measurements_check_id_fkey, ADD CONSTRAINT growth_measurements_check_id_fkey FOREIGN KEY (check_id) REFERENCES public.daily_checks(id) ON DELETE SET NULL;
ALTER TABLE public.quality_inspections DROP CONSTRAINT quality_inspections_batch_id_fkey, ADD CONSTRAINT quality_inspections_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
ALTER TABLE public.quality_inspections DROP CONSTRAINT quality_inspections_check_id_fkey, ADD CONSTRAINT quality_inspections_check_id_fkey FOREIGN KEY (check_id) REFERENCES public.daily_checks(id) ON DELETE CASCADE;
ALTER TABLE public.harvests DROP CONSTRAINT harvests_batch_id_fkey, ADD CONSTRAINT harvests_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
ALTER TABLE public.daily_checks DROP CONSTRAINT daily_checks_batch_id_fkey, ADD CONSTRAINT daily_checks_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_batch_id_fkey, ADD CONSTRAINT transactions_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_item_id_fkey, ADD CONSTRAINT inventory_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

-- Any member can log a stock purchase; it adds stock and posts the matching expense.
CREATE OR REPLACE FUNCTION public.record_purchase(_item_id uuid, _qty numeric, _cost numeric, _vendor text, _date date, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cat text; _name text; _by text; _tx uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be more than 0'; END IF;
  IF _cost IS NULL OR _cost < 0 THEN RAISE EXCEPTION 'Cost cannot be negative'; END IF;
  SELECT category, name INTO _cat, _name FROM inventory_items WHERE id = _item_id;
  IF _name IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  SELECT coalesce(full_name, email) INTO _by FROM profiles WHERE id = auth.uid();
  INSERT INTO inventory_movements(item_id, change, reason) VALUES (_item_id, _qty, 'Purchased' || coalesce(' from ' || nullif(_vendor,''), ''));
  INSERT INTO transactions(tx_date, kind, category, amount, description, counterparty, handled_by, inventory_item_id)
  VALUES (coalesce(_date, current_date), 'expense', _cat, _cost,
          left(_qty || ' × ' || _name || coalesce(' — ' || nullif(_notes,''), ''), 300), nullif(_vendor,''), _by, _item_id)
  RETURNING id INTO _tx;
  RETURN _tx;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_purchase(uuid, numeric, numeric, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, numeric, numeric, text, date, text) TO authenticated;