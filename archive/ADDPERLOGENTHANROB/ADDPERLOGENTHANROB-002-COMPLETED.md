# ADDPERLOGENTHANROB-002: Create Parameter Object for `#writeEntriesForRecipients`

## Summary

The parameter object refactor for `#writeEntriesForRecipients` is already in place; the remaining work is to formalize it with JSDoc typedefs and explicit `@param` annotations. Keep the method behavior unchanged while making the signature and context types explicit.

## Phase

Phase 2: Low-Risk Refactoring (Step 2 of 3)

## Prerequisites

- ADDPERLOGENTHANROB-001 must be completed first

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | MODIFY - refactor parameter signature |

## Out of Scope

**DO NOT CHANGE:**

- `RecipientSetBuilder` or its contract
- `PerceptionFilterService` or its contract
- `RecipientRoutingPolicyService` or its contract
- Operation schema (`data/schemas/operations/addPerceptionLogEntry.schema.json`)
- Component IDs or their data shapes
- DI registrations or tokens
- Any other operation handlers
- Test files (they should pass unchanged)
- Error message wording
- Debug log format
- The actual logic inside `#writeEntriesForRecipients` (only parameter handling)

## Implementation Notes

### Current State (after ADDPERLOGENTHANROB-001)

```javascript
async #writeEntriesForRecipients({
  locationId,
  entityIds,
  entry,
  alternateDescriptions,
  actorDescription,
  targetDescription,
  targetId,
  usingExplicitRecipients,
  usingExclusions,
  logLabel,
}, { log, senseAware, originatingActorId }) {
  // ...
}
```

### Target Structure

```javascript
/**
 * @typedef {Object} WriteEntriesParams
 * @property {string} locationId - Target location for perception entries
 * @property {Set<string>} entityIds - Set of recipient entity IDs
 * @property {Object} entry - The perception entry to write
 * @property {Object|undefined} alternateDescriptions - Sense-based alternates
 * @property {string|undefined} actorDescription - Description for the actor
 * @property {string|undefined} targetDescription - Description for the target
 * @property {string|undefined} targetId - ID of the target entity
 * @property {boolean} usingExplicitRecipients - Whether explicit targeting is used
 * @property {boolean} usingExclusions - Whether exclusion mode is active
 * @property {string|undefined} logLabel - Label for debug logging
 */

/**
 * @typedef {Object} WriteEntriesContext
 * @property {ILogger} log - Logger instance
 * @property {boolean} senseAware - Whether sense filtering is enabled
 * @property {string|undefined} originatingActorId - Actor who initiated the event
 */

/**
 * Writes perception log entries to recipient entities.
 * @private
 * @param {WriteEntriesParams} params - Entry parameters
 * @param {WriteEntriesContext} context - Execution context
 */
async #writeEntriesForRecipients(params, context) {
  const {
    locationId,
    entityIds,
    entry,
    alternateDescriptions,
    actorDescription,
    targetDescription,
    targetId,
    usingExplicitRecipients,
    usingExclusions,
    logLabel,
  } = params;
  const { log, senseAware, originatingActorId } = context;
  // ... existing implementation
}
```

### Key Changes

1. Define `@typedef` for `WriteEntriesParams` with all entry-related parameters
2. Define `@typedef` for `WriteEntriesContext` with execution context
3. Add JSDoc `@param` annotations to method
4. Move destructuring to the method body to align with the typed `params/context` signature
5. Leave call sites as-is (they already pass structured objects)

## Acceptance Criteria

### Tests That Must Pass

```bash
# All existing tests must pass unchanged
npm run test:unit -- tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js
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

# Type checking (JSDoc types)
npm run typecheck
```

## Verification Checklist

- [x] `@typedef WriteEntriesParams` defined with all 10 properties
- [x] `@typedef WriteEntriesContext` defined with 3 properties
- [x] Method has JSDoc `@param` annotations
- [x] Signature accepts `params` + `context` and destructures internally
- [x] All existing tests pass without modification
- [x] ESLint passes (file-scoped lint)
- [ ] Typecheck passes (fails due to pre-existing repo issues)

## Blocked By

- ADDPERLOGENTHANROB-001

## Blocks

- ADDPERLOGENTHANROB-003 (Add explicit early returns)

## Status

Completed

## Outcome

Originally planned to consolidate individual parameters; the method already accepted a parameter object, so the work focused on adding JSDoc typedefs, clarifying `@param` annotations, and aligning the signature to `params/context` with internal destructuring. No logic changes were made.
