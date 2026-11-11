<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Agronomy formulas (dosing, VPD, forecasts, cost sharing) live as pure functions in src/lib/agronomy.ts with tests; farm-wide calibration is a single-row farm_settings table (id=1) so pages share one source.
- Keep batches.plant_count as the initial transplanted population; derive live counts by subtracting harvests and batch_losses so edits remain reversible.
- Reconcile harvest completion with database triggers on harvests and batch_losses, locking the batch to reject over-removal atomically.
- Store stage overrides on crop profiles and fixed sentinel pot assignments on batches; snapshot stage, volume, pot ID and zone with observations to preserve recorded context.
- Derive in-app nursery seeding prompts from release dates and existing nursery supply rather than creating unrequested batches or recurring jobs.
- Persist physical placements as dated per-pot allocation rows grouped by allocation ID; half-open date intervals and a database exclusion constraint prevent double booking, while an RPC replaces a group atomically. Placement release dates are explicit and independent of population records.
- Transplanting runs through the transplant_batch RPC: partial moves create a child growing batch (parent_batch_id), pots and sentinel IDs are saved atomically, and the checklist falls back to batches.sentinel_pot_ids when a plant has no prior measurement.
