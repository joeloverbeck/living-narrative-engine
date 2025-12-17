# ACTOBSPERMES-004: Implement Actor/Target Description Routing in Log Handler

## Summary

Modify `addPerceptionLogEntryHandler.js` to route perspective-aware descriptions to the appropriate recipients:
- **Actor** receives `actor_description` WITHOUT sensory filtering
- **Target** receives `target_description` WITH sensory filtering
- **Other observers** receive `description_text` WITH sensory filtering

This is the core implementation ticket for the actor/observer perception messaging feature.

## Motivation

See `specs/actor-observer-perception-messaging.spec.md` - Sections 2-4.

This handler is responsible for iterating over all recipients in a location and adding perception log entries. The routing logic must determine which description each recipient receives based on their role (actor, target, or observer).

## Files to Touch

| File | Change |
|------|--------|
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Implement recipient routing logic |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | Add unit tests for routing |
| `tests/integration/logic/operationHandlers/addPerceptionLogEntryHandler.integration.test.js` | Add integration tests |

## Out of Scope

- **DO NOT** modify schema files (ACTOBSPERMES-001, ACTOBSPERMES-002)
- **DO NOT** modify `dispatchPerceptibleEventHandler.js` (ACTOBSPERMES-003)
- **DO NOT** modify the `perceptionFilterService` or create new filter types
- **DO NOT** change the perception log component structure
- **DO NOT** add new event types or dispatch new events
- **DO NOT** update documentation (ACTOBSPERMES-005)

## Implementation Details

### 1. Extract New Parameters in execute

Add extraction of new parameters (around line 183 in execute, after existing sense_aware extraction):

```javascript
const {
  sense_aware = true,
  alternate_descriptions,
  actor_description,      // NEW
  target_description,     // NEW
  target_id,              // NEW (may already exist as originating_actor_id context)
  originating_actor_id,   // Existing - this IS the actor
} = params;
```

### 2. Modify Recipient Loop

The current recipient loop (lines 222-276) processes all recipients uniformly. Modify the entry-building logic (lines 250-262) to check recipient role:

```javascript
for (const id of entityIds) {
  if (!this.#entityManager.hasComponent(id, PERCEPTION_LOG_COMPONENT_ID)) {
    continue; // not a perceiver
  }

  // NEW: Determine which description this recipient should receive
  let descriptionForRecipient;
  let skipSenseFiltering = false;
  let perceivedVia = null;

  if (actor_description && id === originating_actor_id) {
    // Actor receives actor_description WITHOUT filtering
    descriptionForRecipient = actor_description;
    skipSenseFiltering = true;
    perceivedVia = 'self';
  } else if (target_description && id === target_id) {
    // Target receives target_description WITH filtering
    descriptionForRecipient = target_description;
  } else {
    // Observers receive description_text WITH filtering
    descriptionForRecipient = entry.descriptionText;
  }

  // Apply sense filtering if needed (unless skipped for actor)
  // ... existing filtering logic, but conditionally applied
}
```

### 3. Handle actor === target Edge Case

When `actor_id === target_id` (self-targeted action), `actor_description` takes precedence:

```javascript
if (actor_description && id === originating_actor_id) {
  // Actor always gets actor_description, even if also target
  descriptionForRecipient = actor_description;
  skipSenseFiltering = true;
  perceivedVia = 'self';
} else if (target_description && id === target_id && id !== originating_actor_id) {
  // Target gets target_description ONLY if not also actor
  descriptionForRecipient = target_description;
}
```

### 4. Add Warning for Invalid Target

When `target_description` is provided but target lacks perception log:

```javascript
if (target_description && target_id) {
  if (!this.#entityManager.hasComponent(target_id, PERCEPTION_LOG_COMPONENT_ID)) {
    log.warn(
      `ADD_PERCEPTION_LOG_ENTRY: target_description provided for entity '${target_id}' ` +
      `but entity lacks perception log component. The target_description will be ignored. ` +
      `If this target should receive messages, ensure it has the 'core:perception_log' component. ` +
      `If the target is intentionally an object, consider removing the target_description parameter.`
    );
  }
}
```

### 5. Set perceivedVia: "self" Metadata

For actor entries, ensure the log entry includes `perceivedVia: "self"`:

```javascript
const finalEntry = {
  ...entry,
  descriptionText: descriptionForRecipient,
  perceivedVia: skipSenseFiltering ? 'self' : (filtered?.sense ?? undefined),
};
```

## Acceptance Criteria

### Tests That Must Pass

**File**: `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`

1. **Test: Actor receives actor_description without filtering**
   ```javascript
   it('should deliver actor_description to actor without sense filtering', async () => {
     // Setup: Dark room, actor has no eyes
     // Action: Dispatch with actor_description
     // Assert: Actor's log entry has actor_description, perceivedVia: 'self'
   });
   ```

2. **Test: Target receives target_description with filtering**
   ```javascript
   it('should deliver target_description to target with sense filtering applied', async () => {
     // Setup: Dark room, target has no eyes but has ears
     // Action: Dispatch with target_description and auditory alternate
     // Assert: Target's log entry has auditory fallback of target message
   });
   ```

3. **Test: Observer receives description_text with filtering**
   ```javascript
   it('should deliver description_text to observers with sense filtering', async () => {
     // Setup: Dark room, observer has ears
     // Action: Dispatch with all descriptions
     // Assert: Observer's log entry has auditory fallback of description_text
   });
   ```

4. **Test: Actor=Target edge case**
   ```javascript
   it('should deliver actor_description when actor equals target', async () => {
     // Setup: Self-action where actor_id === target_id
     // Action: Dispatch with both actor_description and target_description
     // Assert: Actor receives actor_description, not target_description
   });
   ```

5. **Test: Warning for target without perception log**
   ```javascript
   it('should warn when target_description provided but target lacks perception log', async () => {
     // Setup: target_id refers to an item entity without perception log
     // Action: Dispatch with target_description
     // Assert: Warning logged, no crash, other recipients still receive messages
   });
   ```

6. **Test: Backward compatibility - no new params**
   ```javascript
   it('should work unchanged when actor_description and target_description not provided', async () => {
     // Setup: Standard dispatch without new parameters
     // Assert: All recipients receive description_text with filtering (existing behavior)
   });
   ```

7. **Test: perceivedVia metadata**
   ```javascript
   it('should set perceivedVia to "self" for actor entries', async () => {
     // Assert: Actor's log entry includes perceivedVia: 'self'
   });
   ```

**File**: `tests/integration/logic/operationHandlers/addPerceptionLogEntryHandler.integration.test.js`

8. **Integration: Full flow with real entities**
   ```javascript
   it('should correctly route descriptions in a multi-entity scenario', async () => {
     // Setup: Location with actor, target, and 2 observers
     // Action: Full DISPATCH_PERCEPTIBLE_EVENT with all descriptions
     // Assert: Each entity's perception log has correct message
   });
   ```

### Invariants That Must Remain True

1. **Existing test suite passes**: All existing tests must continue to pass
2. **Backward compatibility**: When `actor_description` and `target_description` are undefined, behavior is identical to before
3. **Batch update mechanism unchanged**: The batch component update logic must remain functional
4. **Excluded actors still excluded**: `excluded_actor_ids` must still prevent delivery
5. **Explicit recipients still work**: `recipient_ids` must still limit delivery
6. **Silent filter for non-perceivers**: Recipients who can't perceive (via sense filtering) still don't receive entries
7. **Max log entries respected**: Log entry rotation/trimming must continue working

### Verification Commands

```bash
# Run unit tests for handler
npm run test:unit -- --testPathPattern="addPerceptionLogEntryHandler"

# Run integration tests
npm run test:integration -- --testPathPattern="addPerceptionLogEntryHandler"

# Run all perception-related tests
npm run test:unit -- --testPathPattern="perception"
npm run test:integration -- --testPathPattern="perception"

# Verify no type errors
npm run typecheck

# Lint modified files
npx eslint src/logic/operationHandlers/addPerceptionLogEntryHandler.js
```

## Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| `actor_description` provided, actor not in location | Actor doesn't receive message (expected - dispatch location determines recipients) |
| `target_description` provided, target not in location | Target doesn't receive message |
| `target_description` provided, target is an item | Warning logged, item doesn't receive message |
| `actor_id === target_id` | Actor receives `actor_description`, `target_description` ignored |
| Only `actor_description` provided | Actor gets it, everyone else gets `description_text` |
| Only `target_description` provided | Target gets it, everyone (including actor) gets `description_text` |
| Neither provided | Everyone gets `description_text` (current behavior) |

## Dependencies

- ACTOBSPERMES-002 (schema must accept new parameters first)
- ACTOBSPERMES-003 (dispatch handler must pass new parameters)

## Blocked By

- ACTOBSPERMES-002
- ACTOBSPERMES-003

## Blocks

- ACTOBSPERMES-005 (documentation depends on implementation)
- ACTOBSPERMES-006 (migration depends on working implementation)

---

## Outcome

**Status**: ✅ COMPLETED

**Date Completed**: 2025-12-17

### Implementation Summary

Implemented actor/target description routing in `addPerceptionLogEntryHandler.js`:

1. **Parameter extraction** (line 183): Added extraction of `actor_description`, `target_description`, `target_id`, and `originating_actor_id` from params
2. **Warning for invalid target** (after line 223): Logs warning when `target_description` is provided but target lacks perception log component
3. **Routing logic** (lines 269-319): Replaced uniform entry-building with role-based routing:
   - Actor receives `actor_description` WITHOUT filtering, with `perceivedVia: 'self'`
   - Target receives `target_description` WITH filtering (only if not also actor)
   - Observers receive `description_text` WITH filtering
4. **Referential equality preservation**: When no transformations needed, original entry object is preserved for backward compatibility

### Tests Added

**Unit Tests** (`tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`):
- 7 new tests in describe block "execute – actor/target description routing" (lines 1306-1606)
- All 50 unit tests pass (43 existing + 7 new)

**Integration Tests** (`tests/integration/logic/operationHandlers/addPerceptionLogEntryHandler.integration.test.js`):
- 3 new tests:
  - "routes actor/target descriptions correctly in multi-entity scenario"
  - "warns when target_description provided but target lacks perception log"
  - "actor receives actor_description when actor equals target"
- All 8 integration tests pass (5 existing + 3 new)

### Verification

```
Test Suites: 2 passed, 2 total
Tests:       58 passed, 58 total
```

### Ticket Corrections Made

Updated line number references in Implementation Details section:
- "around line 124-128" → "around line 183"
- "lines 220-280" → "lines 222-276"
