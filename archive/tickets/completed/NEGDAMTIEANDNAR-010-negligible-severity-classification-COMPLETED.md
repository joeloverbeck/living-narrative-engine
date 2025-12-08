# Negligible damage severity classification

## Status: Completed

## Summary
Introduce a negligible/cosmetic damage tier with centralized thresholds and ensure `APPLY_DAMAGE` classifies both primary and propagated hits with this severity flag. Wire the severity onto hit records so downstream narrative/health systems can consume it without re-deriving thresholds.

## Current state check (2025-12-07)
- No negligible/cosmetic tier exists in code: health states start at `healthy` (81%+) and damage entries/events are untyped for severity.
- `DamageResolutionService` records hits without a severity field and `DamagePropagationService` only forwards amount/type.
- `DamageTypeEffectsService.applyEffectsForDamage` returns void and does not surface severity metadata.
- No existing negligible-focused unit tests; current service tests live under `tests/unit/anatomy/services/`.

## File list to touch
- src/logic/services/damageResolutionService.js (classify negligible hits and thread severity to records/events)
- src/anatomy/services/damageAccumulator.js (store severity on entries)
- src/anatomy/services/damageTypeEffectsService.js (return severity alongside effects payload)
- src/anatomy/constants/** or config/** (central negligible threshold + classifier helper)
- tests/unit/anatomy/services/*.negligible.test.js (new focused coverage; see acceptance criteria)

## Out of scope
- Changing macro payloads or damage numbers in `data/mods/**`
- Any armor/mitigation adjustments before damage classification
- Narrative/health description wording (covered by separate tickets)
- UI rendering changes in `game.html` or perception handlers

## Acceptance criteria
- Tests to add/run (paths reflect current repo layout):
  - `npm run test:unit -- tests/unit/anatomy/services/damageAccumulator.negligible.test.js --runInBand` (threshold boundaries + severity tagging on recorded hits)
  - `npm run test:unit -- tests/unit/anatomy/services/damagePropagationService.negligible.test.js --runInBand` (propagated hits get negligible severity once applied)
  - `npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.negligible.test.js --runInBand` (severity returned alongside effects payload for negligible hits)
- Invariants to preserve:
  - Existing injury tiers and thresholds for non-negligible damage remain unchanged.
  - Damage application math (hp deltas, clamping) behaves identically for non-negligible hits.
  - No new console logging outside existing `DAMAGE_DEBUG` pathways.

## Outcome
- Added a shared negligible damage classifier (`classifyDamageSeverity`) with 2% / 2hp floor, threaded through `DamageResolutionService` so stored entries and queued events carry severity for primary and propagated hits.
- Damage accumulator now persists severity (defaulting to standard) and `DamageTypeEffectsService.applyEffectsForDamage` returns the resolved severity alongside effects.
- New targeted unit suites cover negligible tagging on recorded hits, propagated calls, and effects handling without altering existing non-negligible thresholds or math.
