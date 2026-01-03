# Cascade Destruction Architecture Analysis

## 1. Problem Statement

Cascade destruction closes the gap where destroying a parent body part (e.g., torso) would otherwise leave internal organs intact. That outcome is inconsistent with expected anatomy behavior and user expectations for damage realism. The goal is to ensure that when a parent part reaches zero health, living descendants are also destroyed and downstream systems (narrative, death checks, events) reflect that outcome.

## 2. Solution Architecture

### Service Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DamageResolutionService                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ resolve() - damage application pipeline                  │    │
│  │   ↓                                                      │    │
│  │ Part destroyed (health → 0)                              │    │
│  │   ↓                                                      │    │
│  │ dispatch PART_DESTROYED_EVENT                            │    │
│  │   ↓                                                      │    │
│  │ CascadeDestructionService.executeCascade()   ←───────────┼───┤
│  │   ↓                                                      │    │
│  │ DamageAccumulator.recordCascadeDestruction()             │    │
│  │   ↓                                                      │    │
│  │ finalize() → compose narrative (includes cascades)       │    │
│  │   ↓                                                      │    │
│  │ dispatch queued DAMAGE_APPLIED events                    │    │
│  │   ↓                                                      │    │
│  │ DeathCheckService.finalizeDeathFromEvaluation()          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CascadeDestructionService                       │
│  1. BodyGraphService.getAllDescendants(partId)                   │
│  2. Filter: currentHealth > 0                                    │
│  3. For each: set health = 0, dispatch PART_DESTROYED            │
│  4. Dispatch CASCADE_DESTRUCTION_EVENT                           │
│  5. Return { destroyedPartIds, destroyedParts, vitalOrgan }     │
└─────────────────────────────────────────────────────────────────┘
```

### Event Flow Diagram

```
Attack Applied
      │
      ▼
┌─────────────┐
│ PART_       │──→ Primary destruction when health → 0
│ DESTROYED   │
└─────────────┘
      │
      ▼ (cascade triggered)
┌─────────────┐
│ PART_       │──→ For each living descendant
│ DESTROYED   │
│ (cascaded)  │
└─────────────┘
      │
      ▼
┌─────────────┐
│ CASCADE_    │──→ Summary of cascade destructions
│ DESTRUCTION │
└─────────────┘
      │
      ▼ (session finalization)
┌─────────────┐
│ DAMAGE_     │──→ queued, dispatched after narrative
│ APPLIED     │
└─────────────┘
      │
      ▼ (death evaluation finalized)
┌─────────────┐
│ DEATH_      │
│ OCCURRED    │
└─────────────┘
```

## 3. Implementation Summary

- Existing implementation already in repo:
  - `src/anatomy/services/cascadeDestructionService.js`
  - `src/anatomy/services/damageAccumulator.js`
  - `src/anatomy/services/damageNarrativeComposer.js`
  - `src/logic/services/damageResolutionService.js`
  - `src/dependencyInjection/tokens/tokens-core.js`
  - `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`
  - `tests/unit/anatomy/services/cascadeDestructionService.test.js`
  - `tests/integration/anatomy/cascadeDestruction.integration.test.js`

- This ticket adds:
  - `tests/e2e/actions/cascadeDestructionFlow.e2e.test.js`

Key design decisions already implemented:
- Cascade is synchronous within the damage resolution flow.
- Cascade uses BodyGraphService descendant traversal.
- Cascade summary is a distinct event (`anatomy:cascade_destruction`).
- Narrative composition accepts cascade entries for appended segments.

## 4. Backward Compatibility

- Public APIs remain stable; cascade data is added as optional context.
- `PART_DESTROYED_EVENT` is unchanged; cascade-specific data is emitted via the summary event.
- Default behavior remains unchanged if cascade service is not injected.

## 5. Testing Coverage

- Unit tests: existing coverage for CascadeDestructionService.
- Integration tests: existing coverage for cascade destruction flow and narrative output.
- E2E tests: 3 scenarios in `tests/e2e/actions/cascadeDestructionFlow.e2e.test.js` (run via `npm run test:e2e -- --runInBand tests/e2e/actions/cascadeDestructionFlow.e2e.test.js`).
- Coverage metrics (E2E run): 5.96% statements, 3.01% branches, 5.56% functions, 6.04% lines.
