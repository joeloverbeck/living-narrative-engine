# THIPERHEADES-002: Third-person visible injury formatter
*Status: Completed*

## Reality check (current code/tests)
- `InjuryAggregationService` already exposes `isVitalOrgan` on each part; no extra metadata plumbing is needed there.
- `InjuryNarrativeFormatterService` only formats first-person summaries and per-hit third-person damage events; there is no third-person summary formatter to reuse for descriptions.
- `BodyDescriptionComposer` currently emits descriptors/equipment/inventory only; no `Health:` line flows into descriptions, tooltips, or the world-context prompt.
- Tests cover only the first-person formatter in `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`; there is no coverage for a third-person formatter or a description-level `Health:` line.

## Task
Add a third-person visible-injury formatter and surface it as a `Health:` line in generated character descriptions, following specs/third-person-health-descriptions.md.

## Scope
- Add `formatThirdPersonVisible(summary)` to `InjuryNarrativeFormatterService` that mirrors first-person ordering (dismembered → destroyed → other states → effects), filters out `isVitalOrgan` parts, omits pain/subjective wording, and still reports obvious fractures/bleeding for non-living actors.
- Update `BodyDescriptionComposer` to insert a `Health:` line (using the aggregation + new formatter) between `Wearing:` and `Inventory:` when composing descriptions; fall back to `Health: Perfect health.` when no visible injuries survive filtering.
- Keep the first-person formatter output unchanged.

## Acceptance criteria
- Unit: `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` adds coverage for `formatThirdPersonVisible` (healthy → `Perfect health.`, ordering of dismembered/destroyed/fracture/bleeding, vital organs filtered, statue/non-living still shows visible damage).
- Integration/unit: a BodyDescriptionComposer test verifies the `Health:` line placement and fallback when only vital-organ injuries exist, without altering equipment/inventory text.
- Existing first-person formatter tests continue to pass.

## Outcome
- Added `formatThirdPersonVisible` with visibility/vital-organ filtering, dismemberment/state/effect ordering, and neutral phrasing.
- Inserted `Health:` line in `BodyDescriptionComposer` between equipment and inventory when formatter dependencies are available.
- Added targeted unit coverage for the new formatter and the health-line placement; first-person formatter behavior remains unchanged.
