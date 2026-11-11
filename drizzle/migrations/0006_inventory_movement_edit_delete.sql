CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.inventory_items set quantity = quantity - old.change where id = old.item_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    update public.inventory_items set quantity = quantity + new.change where id = new.item_id;
    return new;
  end if;
  return old;
end; $$;
DROP TRIGGER IF EXISTS inventory_movement_applied ON public.inventory_movements;
CREATE TRIGGER inventory_movement_applied AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();