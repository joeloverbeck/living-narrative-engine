# APPLY_DAMAGE Flexibility Refactor

## Document Info

Version: 0.1 (draft)  
Owner: Gameplay Systems  
Scope: Refactor plan for `APPLY_DAMAGE` pipeline to separate orchestration from calculation, enable determinism/debuggability, and prepare for future extensibility without introducing armor/clothing mitigation in this phase.  
Primary code refs: `src/logic/operationHandlers/applyDamageHandler.js`, `src/anatomy/services/damagePropagationService.js`, `src/anatomy/services/damageTypeEffectsService.js`, `src/anatomy/services/damageAccumulator.js`

---

## Goals

- Cleanly separate orchestration (operation handler) from damage calculation and narrative so future features (e.g., mitigation layers) can slot in without touching the handler.
- Make the pipeline deterministic and debuggable (shared RNG, structured traces).
- Preserve backward compatibility with existing rules (`data/mods/**/rules/**`, `macros/**`) while enabling opt-in to richer inputs.
- Add data-model affordances for per-hit metadata for downstream effects while deferring armor/clothing mitigation to a later phase.

---

## Current State (risks/limits)

- Handler mixes concerns: target resolution, validation, amount math, health mutation, propagation, effect application, death checks, and narrative composition in one method (~900 lines).
- Damage inputs are loosely typed (`damage_entry` or legacy `amount`/`damage_type`). No way to express pre/post-processing state, source, or tags.
- Mitigation is absent: all damage goes straight to anatomy. Future armor would need to hook before `damageAmount <= 0` short-circuit and before propagation (out of scope for this refactor).
- Randomness is tied to `Math.random()` in hit selection and propagation; not seeded or injectable → non-deterministic tests and hard to replay.
- Session handling is owned by the handler; propagation relies on shared `executionContext` mutation, making reentrancy and multi-target sequences fragile.
- Event composition is tied to the handler lifecycle; queued events and narrative composition share error surface (fail-fast logs) instead of isolated reporting.

---

## Proposed Architecture

### 1) Introduce a Damage Resolution Service

`DamageResolutionService` (new) takes a normalized `DamageRequest` and returns `DamageResult`. The operation handler becomes a thin coordinator:

- Build `DamageRequest` from rule params + executionContext.
- Call `damageResolutionService.resolve(request, executionContextRng)`.
- Dispatch events/narratives from the returned result; handler no longer mutates health directly.

**DamageRequest (proposed shape)**

```ts
{
  entityId: string,
  actorId?: string,
  targetPartId?: string,        // optional; service can auto-resolve
  hitSelection?: { strategy: 'reuse_cached' | 'fresh_roll', hintPartId?: string },
  incoming: {
    amount: number,
    type: string,
    multiplier?: number,
    tags?: string[],            // e.g., ['ranged', 'fire', 'spell']
    metadata?: object,          // arbitrary source data (weapon id, action id)
    isPreMitigated?: boolean    // whether amount already accounts for armor
  },
  propagationHint?: { propagatedFrom?: string },
  options?: {
    allowPropagation?: boolean,
    allowMitigation?: boolean,  // disable when propagating internal hits
    clampFloor?: number         // min damage that still triggers effects
  }
}
```

**DamageResult (proposed shape)**

```ts
{
  target: { entityId, partId, partType, orientation },
  finalAmount: number,
  damageType: string,
  absorbed: number,           // total prevented
  mitigations: MitigationStep[], // ordered trace of reducers/deflections
  healthBefore?: number,
  healthAfter?: number,
  stateBefore?: string,
  stateAfter?: string,
  destroyed: boolean,
  effectsTriggered: string[],
  propagated: PropagationCall[], // requests for recursive calls
  events: QueuedEvent[],         // damage_applied, part_destroyed, etc.
  narrativeEntry: DamageEntry    // for accumulator/composer
}
```

### 2) Deterministic RNG Injection

- Add `executionContext.rng` (or `rngProvider`) used by hit selection, propagation rolls, and any mitigation randomness (e.g., glancing blows).
- Default to `Math.random` when absent, but allow tests to seed.
- Thread RNG through `DamageResolutionService`, `DamagePropagationService`, and hit selection helper (no local `Math.random()` calls).

### 3) Session & Narrative Isolation

- Move session lifecycle into `DamageResolutionService` (or a small `DamageSessionManager`) so recursive calls receive an explicit session token rather than mutating `executionContext`.
- Narrative composition should consume `DamageResult.narrativeEntry` arrays, keeping handler responsible only for dispatch order (narrative first, then queued legacy events, then death finalization).
- Death checks remain after top-level resolution, but consume `DamageResult` to know total damage and destroyed parts.

### 4) Operation Schema Additions (backward compatible)

Extend `data/schemas/operations/applyDamage.schema.json`:

- `metadata` (object): Source identifiers (weapon id, action id, rule id) for logging/effects.
- `damage_tags` (array<string>): For resistances/effects (e.g., `['fire','ranged']`).
- `hit_strategy`: `{ reuse_cached?: boolean, hint_part?: string }` to control hit caching.
- `rng_ref`: optional reference to deterministic RNG seed/id.
  Defaults keep existing behavior unchanged.

### 5) Error Handling & Telemetry

- Structured trace object on `DamageResult` capturing decisions (part selection source, exclusion list results, mitigation steps, propagation rolls).
- Distinguish hard errors (invalid params) from soft skips (excluded damage type, zero damage after mitigation) for test assertions.
- Keep `safeDispatchError` for user-facing issues but include trace id/session id in payloads.

---

## Migration & Rollout Plan

1. **Scaffold services**: Implement `DamageResolutionService` with existing behavior (no armor yet), inject via DI, and adapt `ApplyDamageHandler` to delegate while preserving public behavior.
2. **Deterministic RNG**: Thread `rng` through hit selection and propagation; update tests to use seeded RNG where flaky.
3. **Schema extensions**: Add optional fields (`metadata`, `damage_tags`, `hit_strategy`, `rng_ref`) with defaults; keep legacy params supported.
4. **Narrative/event parity**: Validate event ordering and composed narrative outputs remain unchanged for existing scenarios (`tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js`, etc.).
5. **Deprecations**: Announce eventual removal of `amount`/`damage_type` params after new schema adoption; add lint/check in validation suite to flag legacy usage in new content.

---

## Testing Strategy

- Unit: DamageResolutionService (RNG determinism, trace output), propagation logic, session handling.
- Integration: weapon macros/rules that call `APPLY_DAMAGE` with deterministic hit selection, propagation, and session isolation; ensure no behavior changes when RNG not provided.
- E2E: Existing flows (`swingAtTarget`, `damagePropagationFlow`) run unchanged.
- Validation: Schema validation for new fields; legacy payload compatibility checks.

---

## Open Questions

- Should mitigation randomness (glancing blows) be deterministic via RNG hook or purely data-driven probabilities (if added later)?
- How to expose trace output to debugging UI/telemetry without bloating event payloads (maybe behind debug flag)?
