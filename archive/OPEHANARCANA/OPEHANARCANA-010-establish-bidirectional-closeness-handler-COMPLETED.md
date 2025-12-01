# OPEHANARCANA-010: ESTABLISH_BIDIRECTIONAL_CLOSENESS Handler Implementation

**Status:** Completed
**Priority:** High (Phase 2)
**Estimated Effort:** 2 days
**Dependencies:** OPEHANARCANA-009 (schema)

---

## Current Reality vs Assumptions

- The handler file already exists as a stub (`src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`) and is already registered; it currently only logs a warning and receives **only** a logger via DI.
- Tokens, interpreter mapping, whitelist, and schema are already in place (handled by OPEHANARCANA-009); the remaining gap is the real handler logic plus DI wiring for its dependencies.
- No unit or integration tests exist for this handler; coverage must be added here.
- There is no `descriptionRegenerator` service. Description refreshes should flow through the existing `RegenerateDescriptionHandler` (resolved from DI) or be skipped when not requested.

---

## Objective

Implement the `EstablishBidirectionalClosenessHandler` class that:
1. Cleans up existing third-party relationships (if `clean_existing: true`)
2. Removes old relationship components from actor and target
3. Adds new relationship components to both entities
4. Optionally regenerates entity descriptions via the existing `RegenerateDescriptionHandler`

This handler will reduce hugging/hand-holding rules from ~200 lines to ~25 lines (88% reduction).

---

## Files to Touch

### Modified Files
- `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js` — replace stub with implementation
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` — supply real dependencies (entity manager, dispatcher, regenerateDescriptionHandler)

### New Files
- `tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js`

---

## Out of Scope

**DO NOT modify:**
- Other operation handlers
- Rule files
- Token definitions or interpreter registrations
- `operation.schema.json` (done in OPEHANARCANA-009)
- PREPARE_ACTION_CONTEXT files (Phase 1 complete)

---

## Implementation Details

### Handler Shape (updated)

- Extend `BaseOperationHandler`.
- Dependencies: `entityManager` (getComponentData/addComponent/removeComponent), `safeEventDispatcher` (for surfaced errors), `regenerateDescriptionHandler` (optional, call `execute` for actor/target when `regenerate_descriptions` is true), `logger`.
- Parameter flow:
  1. Validate `parameters` object and required strings (`actor_component_type`, `target_component_type`); ensure `actor_data`/`target_data` are objects.
  2. Resolve actor/target IDs from `executionContext.evaluationContext.event.payload.{actorId,targetId}`; warn/dispatch on missing.
  3. Resolve template variables in `actor_data`/`target_data` using `executionContext.evaluationContext` (supports `{event.payload.*}` and `{context.*}`).
  4. Determine `typesToClean` (provided list or `[actor_component_type, target_component_type]`).
  5. If `clean_existing`, remove reciprocal components for any existing partner references found in current components (check common ID fields like `embraced_entity_id`, `hugging_entity_id`, `holding_hand_of`, `hand_held_by`, `partner_id`, `target_id`, `actor_id`).
  6. Remove the `typesToClean` components from actor and target, ignoring missing components.
  7. Add the new components for actor and target using resolved data.
  8. When `regenerate_descriptions` is true and the dependency exists, invoke `regenerateDescriptionHandler.execute` for actor and target (best-effort).

### Key Design Decisions

1. **Third-party cleanup**: Automatically finds and cleans reciprocal relationships before applying new components.
2. **Flexible component types**: Uses provided component type IDs without hardcoding hugging/hand-holding specifics.
3. **Template resolution**: Supports `{event.payload.*}` and `{context.*}` substitutions in provided component data.
4. **Safe removal**: Gracefully handles missing components and missing regeneration dependency (logs instead of throwing).
5. **Minimal ripple**: No changes to schema, tokens, or interpreter mapping; only the handler implementation and its factory wiring change.

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests for handler logic (run in-band to avoid flakiness):**
   ```bash
   npm run test:unit -- --runInBand tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js
   ```

2. **Basic lint sanity on the new handler (file-scoped):**
   ```bash
   npx eslint src/logic/operationHandlers/establishBidirectionalClosenessHandler.js
   ```

### Invariants That Must Remain True

1. Handler extends `BaseOperationHandler`
2. Handler follows dependency injection pattern with dependency validation
3. Handler logs via injected logger and uses safe dispatcher for surfaced errors
4. Tokens/operation mapping remain unchanged
5. No modifications to other files in codebase beyond those listed

---

## Verification Steps

```bash
# 1. Run ESLint on file
npx eslint src/logic/operationHandlers/establishBidirectionalClosenessHandler.js

# 2. Run unit tests in-band
npm run test:unit -- --runInBand tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js
```

---

## Outcome

- Replaced the stub handler with real bidirectional relationship management: template resolution, reciprocal cleanup, component reset, and optional description regeneration via the existing RegenerateDescriptionHandler.
- Updated DI factory to provide entity manager, safe dispatcher, and regeneration handler dependencies already present in the container.
- Added focused unit coverage for cleanup, template handling, regeneration toggling, and validation. Verified with `npm run test:unit -- --runInBand tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js` and `npx eslint src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`.

---

## Reference Files

- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Similar handler: `src/logic/operationHandlers/establishSittingClosenessHandler.js` (500+ lines)
- Description regeneration: `src/logic/operationHandlers/regenerateDescriptionHandler.js`
- Component operations: `src/logic/operationHandlers/componentOperationHandler.js`
