ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS parent_batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.transplant_batch(_batch_id uuid, _qty integer, _on date, _ends_on date, _pot_ids text[], _sentinels text[])
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE src public.batches; avail integer; target uuid; n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to transplant'; END IF;
 SELECT * INTO src FROM public.batches WHERE id=_batch_id FOR UPDATE;
 IF src.id IS NULL OR src.status <> 'nursery' THEN RAISE EXCEPTION 'Choose a nursery batch'; END IF;
 avail := COALESCE(src.germinated, src.seeds_sown, 0) - COALESCE((SELECT sum(plant_count) FROM public.batches WHERE parent_batch_id=_batch_id),0);
 IF _qty IS NULL OR _qty <= 0 OR (avail > 0 AND _qty > avail) THEN RAISE EXCEPTION 'Enter 1–% plants', avail; END IF;
 IF cardinality(_pot_ids) IS DISTINCT FROM _qty OR (SELECT count(DISTINCT p) FROM unnest(_pot_ids) p) <> _qty THEN RAISE EXCEPTION 'Select exactly % different pots', _qty; END IF;
 IF NOT (_sentinels <@ _pot_ids) THEN RAISE EXCEPTION 'Sentinel pots must be among the selected pots'; END IF;
 IF _ends_on <= _on THEN RAISE EXCEPTION 'Release date must be after transplant date'; END IF;
 IF avail > 0 AND _qty < avail THEN
   SELECT count(*)+1 INTO n FROM public.batches WHERE parent_batch_id=_batch_id;
   INSERT INTO public.batches(code,crop,variety,profile_id,seeded_on,status,transplanted_on,plant_count,expected_harvest,sentinel_pot_ids,parent_batch_id,notes)
   VALUES (src.code||'-'||n, src.crop, src.variety, src.profile_id, src.seeded_on, 'growing', _on, _qty, _ends_on, _sentinels, _batch_id, 'Split from '||src.code)
   RETURNING id INTO target;
   DELETE FROM public.pot_allocations WHERE batch_id=_batch_id AND pot_id = ANY(_pot_ids);
 ELSE
   target := _batch_id;
   UPDATE public.batches SET status='growing', transplanted_on=_on, plant_count=_qty, expected_harvest=COALESCE(expected_harvest,_ends_on), sentinel_pot_ids=_sentinels WHERE id=_batch_id;
   DELETE FROM public.pot_allocations WHERE batch_id=_batch_id;
 END IF;
 INSERT INTO public.pot_allocations(allocation_id,batch_id,pot_id,starts_on,ends_on)
 SELECT gen_random_uuid(), target, p, _on, _ends_on FROM unnest(_pot_ids) p WHERE false;
 INSERT INTO public.pot_allocations(allocation_id,batch_id,pot_id,starts_on,ends_on)
 SELECT a, target, p, _on, _ends_on FROM (SELECT gen_random_uuid() a) g, unnest(_pot_ids) p;
 RETURN target;
END; $$;
GRANT EXECUTE ON FUNCTION public.transplant_batch(uuid,integer,date,date,text[],text[]) TO authenticated;