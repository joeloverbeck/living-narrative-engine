# APPLY_DAMAGE End-to-End Coverage

## Document Info

Version: 0.1 (draft)  
Owner: Gameplay Systems QA  
Scope: Map the full APPLY_DAMAGE execution path (from macro call to final narrative/status output), summarize current e2e coverage, and call out gaps to close for future regressions.

## Entry Points

- Primary triggers: `data/mods/weapons/macros/handleMeleeHit.macro.json` and `handleMeleeCritical.macro.json` loop over `weaponDamage.entries`, dispatch success UI events, then call `APPLY_DAMAGE` (critical path adds `damage_multiplier: 1.5`) followed by `REGENERATE_DESCRIPTION` and `core:endTurnOnly`.
- Other callers: ranged throw macros also invoke APPLY_DAMAGE (same handler path) but aren’t covered by the melee-focused e2e suites below.

## Workflow (end-to-end)

1. **Operation dispatch**
   - Macros enqueue `APPLY_DAMAGE` with `entity_ref`, `damage_entry`, optional `damage_multiplier`, `exclude_damage_types`, and a shared `executionContext` (hit cache + rng).
   - Success text is emitted before damage details (queueMicrotask ordering), then per-hit descriptions are regenerated.
2. **ApplyDamageHandler** (`src/logic/operationHandlers/applyDamageHandler.js`)
   - Resolves entity via placeholders/JSON Logic; resolves part via `part_ref`/`hint_part`/`hit_strategy` or weighted random (`filterEligibleHitTargets`).
   - Supports named RNG (`rng_ref`), reuse of cached hit locations, and exclusion lists.
   - Validates/normalizes `damage_entry`, applies `damage_multiplier`, resolves `metadata` and `damage_tags`, then delegates to DamageResolutionService with `applyDamage` callback for propagation recursion.
3. **DamageResolutionService** (`src/logic/services/damageResolutionService.js`)
   - Creates/reuses a `damageSession` (stored on `executionContext`) to accumulate damage/events across propagated calls; optional tracing.
   - Clamps damage to remaining health, updates `anatomy:part_health`, dispatches `anatomy:part_health_changed` and `anatomy:part_destroyed`.
   - Invokes `DamageTypeEffectsService` to attach immediate effects (bleed/burn/poison/fracture/dismember/stun) and queues their events on the session.
   - Records `anatomy:damage_applied`, then calls `DamagePropagationService` to fan out to children (`propagatedFrom` tagging).
   - Top-level: runs `DeathCheckService.evaluateDeathConditions`, finalizes the damage session, composes narrative text via `DamageNarrativeComposer`, dispatches `core:perceptible_event` (`perceptionType: damage_received`, with location resolution fallback to actor), flushes queued events, and if `shouldFinalize`, calls `finalizeDeathFromEvaluation`.
4. **DamageTypeEffectsService** (`src/anatomy/services/damageTypeEffectsService.js`)
   - Ordered processing: dismember (skip-only-after), fracture (+optional stun), bleed, burn (stack/refresh), poison (part/entity scope). Effects are recorded into the session (`effectsTriggered`) for downstream narrative.
5. **DamagePropagationService** (`src/anatomy/services/damagePropagationService.js`)
   - Reads propagation rules (component or part property), resolves sockets to entities, applies probability/modifiers, calculates fractions, dispatches `anatomy:internal_damage_propagated`, and returns children for recursive APPLY_DAMAGE calls.
6. **DeathCheckService & Narrative**
   - Immediate death on vital organ destruction (`shouldFinalize` → `finalizeDeathFromEvaluation`), dying state below 10% overall health (`processDyingTurn` ticks).
   - `DamageNarrativeComposer` builds primary + propagated sentences using `effectsTriggered`; dispatched as a perceptible event with `totalDamage`.

## Existing E2E Coverage (current suites using real APPLY_DAMAGE)

- `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js`: Success-before-damage messaging, exclude_damage_types skip, critical `damage_multiplier`, bleed capability call-through, fumble drop recovery.
- `tests/e2e/actions/damageEffectsTriggers.e2e.test.js`: Immediate effects for bleed/fracture/stun/dismember plus burning and entity-scope poison; validates effect components and started events.
- `tests/e2e/actions/burnPoisonExtended.e2e.test.js`: Burn stacking across targets, part- vs entity-scope poison with tick systems, multi-turn tick damage accumulation.
- `tests/e2e/actions/damagePropagationFlow.e2e.test.js`: Propagation via sockets and legacy rules, probability modifiers by damage type, recursive grandchild propagation.
- `tests/e2e/actions/damagePropagationMultiTarget.e2e.test.js`: Independent propagation chains per target with differing probabilities/modifiers.
- `tests/e2e/actions/deathMechanics.e2e.test.js`: Vital-organ kill paths, dying threshold, dying countdown expiry, death event payload shape.
- `tests/e2e/actions/multiTurnCombatScenario.e2e.test.js`: Multi-turn accumulation, bleed ticks, entering/stabilizing/expiring dying, and ordering of success text vs damage logs.

## Coverage Gaps to Close

- **Narrative dispatch**: No e2e assertion that `DamageNarrativeComposer` output is emitted via `core:perceptible_event` (damage_received), with `totalDamage`, effects-driven phrasing, or location fallback when target lacks position.
- **Hit resolution controls**: Missing coverage for `hit_strategy` (`reuse_cached` toggles, `hint_part`), named RNG (`rng_ref`), and multi-entry weapons hitting different parts when caching is disabled.
- **Metadata & tags**: `metadata` and `damage_tags` on `damage_entry` are never exercised end-to-end (session recording, propagation to effects, or narrative inclusion).
- **Propagation bookkeeping**: No assertions on `propagatedFrom` metadata, `anatomy:internal_damage_propagated` payloads, or that propagated entries appear in the composed narrative with grouped sentences.
- **Session event queueing**: Lacks a test that queued effect events (`bleeding_started`, `burning_started`, `poisoned_started`, `fractured`, `dismembered`) flush after narrative composition and preserve order vs death finalization.
- **Non-health / zero-damage paths**: No coverage for parts without `anatomy:part_health`, zero/negative damage early-return, or exclusion lists when multiple entries mix excluded + allowed damage types.
- **Regeneration side-effects**: `REGENERATE_DESCRIPTION` after APPLY_DAMAGE is not validated (entity descriptions/log updates after damage).
- **Death ordering with damage narrative**: No e2e confirming the `shouldFinalize` path (vital organ) still composes and dispatches damage narrative before death events, or that dying-state evaluations don’t suppress narrative when a session exists.
