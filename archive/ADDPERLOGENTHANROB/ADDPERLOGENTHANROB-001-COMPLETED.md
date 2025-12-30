# ADDPERLOGENTHANROB-001: Extract `writeEntriesForRecipients` to Private Method

## Summary

Extract the inner closure `writeEntriesForRecipients` (currently around lines 238-512) from the `execute` method into a private class method `#writeEntriesForRecipients`. This reduces closure complexity and improves testability.

## Phase

Phase 2: Low-Risk Refactoring (Step 1 of 3)

## Status

Completed

## Prerequisites

- None (first ticket in series)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | MODIFY - extract closure to private method |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | VERIFY - ensure existing tests still pass |

## Out of Scope

**DO NOT CHANGE:**

- `RecipientSetBuilder` or its contract
- `PerceptionFilterService` or its contract
- `RecipientRoutingPolicyService` or its contract
- Operation schema (`data/schemas/operations/addPerceptionLogEntry.schema.json`)
- Component IDs (`core:perception_log`, `core:sensorial_links`, `core:name`)
- DI registrations or tokens
- Any other operation handlers
- Test assertions or test logic (only verify they pass)
- Error message wording (preserve existing)
- Debug log format (preserve existing)

## Implementation Notes

### Current Structure (around lines 238-512)

```javascript
// Inside execute() method
const writeEntriesForRecipients = async ({
  locationId: targetLocationId,
  entityIds: targetEntityIds,
  entry: targetEntry,
  // ... 10+ parameters
}) => {
  // 284 lines of implementation
};
```

### Target Structure

```javascript
class AddPerceptionLogEntryHandler {
  // ... existing private fields

  /**
   * Writes perception log entries to recipient entities.
   * @private
   */
  async #writeEntriesForRecipients({
    locationId,
    entityIds,
    entry,
    // ... parameters
  }, { log, senseAware, originatingActorId }) {
    // Same implementation, but accessing private fields via this.#
  }

  async execute(params, executionContext) {
    // ... validation
    // Call: await this.#writeEntriesForRecipients({...}, context);
  }
}
```

### Key Changes

1. Move closure body to private method `#writeEntriesForRecipients`
2. Pass additional context (log, senseAware, originatingActorId) as second parameter object
3. Replace closure variable references with `this.#` field accesses
4. Update all call sites within `execute()` to use `this.#writeEntriesForRecipients(...)`

### Variables Currently Captured by Closure

These are accessed from outer scope and must be passed explicitly:
- `log` (from executionContext)
- `sense_aware` (from params)
- `originating_actor_id` (from params)
- `this.#entityManager`, `this.#perceptionFilterService`, `this.#dispatcher` (already accessible via `this`)

## Acceptance Criteria

### Tests That Must Pass

```bash
# All existing tests must pass unchanged
npm run test:unit -- tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js

# Specific test groups to verify:
# - Constructor validation
# - Parameter validation (#validateParams)
# - Recipient mode detection (explicit/exclusion/broadcast)
# - Sense filtering paths
# - Role-based description routing
# - Batch update success/failure
# - Fallback mode execution
```

### Invariants That Must Remain True

1. **Recipient Determination First**: `RecipientSetBuilder.build()` is called before any entry writing
2. **Explicit Mode Guarantee**: `mode === 'explicit'` implies `entityIds.size > 0`
3. **No Double Processing**: Each recipient receives exactly one entry per operation
4. **Sense Filtering Consistency**: Filtered recipients never receive entries
5. **Actor Description Bypass**: `actor_description` bypasses sense filtering for actor
6. **Target Description Filtering**: `target_description` undergoes sense filtering for target
7. **Log Truncation**: `logEntries.length <= maxEntries` after every update
8. **Component Preservation**: Original component data structure preserved

### Code Quality Checks

```bash
# Linting
npx eslint src/logic/operationHandlers/addPerceptionLogEntryHandler.js

# Type checking
npm run typecheck
```

## Verification Checklist

- [x] Private method `#writeEntriesForRecipients` exists
- [x] Closure inside `execute()` is removed
- [x] Both call sites updated to use private method (primary location + sensorial links loop)
- [x] All existing tests pass without modification
- [x] No new test file created
- [x] ESLint passes (warnings only; existing JSDoc warnings remain)
- [ ] Typecheck passes (fails with pre-existing repository errors)

## Outcome

Extracted `writeEntriesForRecipients` into `#writeEntriesForRecipients` with an explicit context object for `log`, `senseAware`, and `originatingActorId`, and updated the two call sites. No behavioral changes were introduced beyond the refactor.

## Blocked By

None

## Blocks

- ADDPERLOGENTHANROB-002 (Create parameter object)
