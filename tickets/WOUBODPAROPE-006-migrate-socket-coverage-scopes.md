# WOUBODPAROPE-006: Migrate Socket Coverage Scopes to `socketExposure`

**Goal:** Replace hand-rolled `isSocketCovered` boolean trees in sex/caressing scopes with the new `socketExposure` operator, preserving existing exposure semantics (any/all, covered vs uncovered) while reducing duplication.

## File list
- `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_penis.scope`
- `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_testicle.scope`
- `data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope`
- `data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_testicle.scope`
- `data/mods/sex-core/scopes/actors_sitting_close_with_covered_penis.scope`
- `data/mods/sex-core/scopes/actors_with_penis_facing_each_other.scope`
- `data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope`
- `data/mods/sex-core/scopes/actor_kneeling_before_target_with_covered_penis.scope`
- `data/mods/sex-core/scopes/actor_kneeling_before_target_with_testicle.scope`
- `data/mods/sex-dry-intimacy/scopes/actors_with_vagina_facing_each_other_covered.scope`
- `data/mods/sex-dry-intimacy/scopes/actors_with_exposed_ass_facing_away.scope`
- `data/mods/sex-dry-intimacy/scopes/actors_with_covered_penis_im_facing_away_from.scope`
- `data/mods/sex-dry-intimacy/scopes/actors_with_penis_facing_straddler_covered.scope`
- `data/mods/sex-vaginal-penetration/scopes/actors_with_uncovered_vagina_facing_each_other_or_target_facing_away.scope`
- `data/mods/sex-vaginal-penetration/scopes/actors_with_uncovered_penis_facing_each_other_or_target_facing_away.scope`
- `data/mods/sex-penile-manual/scopes/actors_with_penis_facing_each_other_covered.scope`
- `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other.scope`
- `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_covered.scope`
- `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_or_away.scope`
- `data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope`
- `data/mods/caressing/scopes/close_actors_with_uncovered_back.scope`
- `tests/common/mods/sex/*Fixtures.js` (update expectations/fixture operators where these scopes are referenced)

## Out of scope
- Changing narrative content, action definitions, or adding new scopes
- Altering socket IDs or anatomy definitions
- Rewriting non-socket clothing coverage scopes

## Acceptance criteria
- Tests:
  - `npm run test:integration -- --runInBand tests/integration/mods/sex*` and `tests/integration/mods/caressing` continue to pass
  - `npm run test:unit -- tests/unit/logic/jsonLogicEvaluationService.customOperators.test.js` still passes (ensures operator wiring unaffected)
- Invariants:
  - Exposure/coverage truth tables stay identical to previous `not/isSocketCovered` combinations, including treatment of missing socket IDs
  - No new mod IDs, component references, or behavior changes beyond operator substitution
  - Scope JSON formatting and ordering remain consistent with repository style
