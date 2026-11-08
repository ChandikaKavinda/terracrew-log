CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE public.pot_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 allocation_id uuid NOT NULL,
 batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
 pot_id text NOT NULL CHECK (pot_id ~ '^([1-46-79][A-E]|[58][A-H])(10|[1-9])$'),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 created_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_on > starts_on),
 EXCLUDE USING gist (pot_id WITH =, daterange(starts_on,ends_on,'[)') WITH &&)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pot_allocations TO authenticated;
GRANT ALL ON public.pot_allocations TO service_role;
ALTER TABLE public.pot_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage placements" ON public.pot_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX pot_allocations_batch_idx ON public.pot_allocations(batch_id);
CREATE FUNCTION public.save_pot_allocation(_allocation_id uuid, _batch_id uuid, _pot_ids text[], _starts_on date, _ends_on date) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE aid uuid := COALESCE(_allocation_id,gen_random_uuid());
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to assign pots'; END IF;
 IF cardinality(_pot_ids) IS NULL OR cardinality(_pot_ids)=0 THEN RAISE EXCEPTION 'Select at least one pot'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.batches WHERE id=_batch_id AND status <> 'harvested') THEN RAISE EXCEPTION 'Choose a nursery or growing batch'; END IF;
 DELETE FROM public.pot_allocations WHERE allocation_id=aid;
 INSERT INTO public.pot_allocations(allocation_id,batch_id,pot_id,starts_on,ends_on)
 SELECT aid,_batch_id,pot,_starts_on,_ends_on FROM (SELECT DISTINCT unnest(_pot_ids) pot) p;
 RETURN aid;
END; $$;
REVOKE ALL ON FUNCTION public.save_pot_allocation(uuid,uuid,text[],date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_pot_allocation(uuid,uuid,text[],date,date) TO authenticated;
