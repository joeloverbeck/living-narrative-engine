# ACTOBSPERMES-003: Pass actor_description and target_description to Log Handler

**Status: ✅ COMPLETED**

## Outcome

### What Was Changed vs Originally Planned

The implementation followed the ticket plan exactly with minimal changes:

**Code Changes (2 edits):**
1. Added `actor_description` and `target_description` to destructuring block in `execute()` method (lines 118-129)
2. Added passing of `actor_description`, `target_description`, and `target_id` to log handler call (lines 259-272)

**Test Changes:**
1. Added new describe block "Actor/target description pass-through" with 6 tests:
   - `should pass actor_description to log handler when provided`
   - `should pass target_description and target_id to log handler when provided`
   - `should pass both actor_description and target_description together`
   - `should pass undefined actor_description/target_description when not provided (backward compatibility)`
   - `should not pass parameters to log handler when log_entry is false`
   - `should pass target_id to log handler even without target_description`
2. Updated existing test `should pass sense-aware params along with other log entry params` to use `expect.objectContaining()` for forward compatibility

**Verification:**
- All 29 unit tests pass
- Lint shows only pre-existing warnings (no new errors)
- No breaking changes to public API

**Files Modified:**
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- `tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js`

---

## Summary

Modify `dispatchPerceptibleEventHandler.js` to extract the new `actor_description` and `target_description` parameters and pass them through to `addPerceptionLogEntryHandler.execute()`.

## Motivation

The dispatch handler is the entry point for the `DISPATCH_PERCEPTIBLE_EVENT` operation. It must extract the new perspective-aware parameters and forward them to the log handler for recipient-specific routing.

See `specs/actor-observer-perception-messaging.spec.md` - Section 2: Handler Modifications Required.

## Files to Touch

| File | Change |
|------|--------|
| `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` | Extract and pass new parameters |
| `tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js` | Add tests for parameter pass-through |

## Out of Scope

- **DO NOT** modify schema files (ACTOBSPERMES-001)
- **DO NOT** modify `addPerceptionLogEntryHandler.js` (ACTOBSPERMES-004)
- **DO NOT** implement recipient routing logic (that's ACTOBSPERMES-004)
- **DO NOT** modify event payload structure (beyond parameters)
- **DO NOT** add validation for actor_description/target_description content
- **DO NOT** update documentation (ACTOBSPERMES-005)

## Implementation Details

### 1. Extract New Parameters

In the `execute` method, add extraction of new parameters in the destructuring block (around line 118-127):

```javascript
const {
  location_id,
  description_text,
  perception_type,
  actor_id,
  target_id = null,
  involved_entities = [],
  contextual_data = {},
  log_entry = false,
  actor_description,      // NEW
  target_description,     // NEW
} = params;
```

### 2. Pass to Log Handler

When calling `this.#logHandler.execute()` (around line 251-260), add the new parameters:

```javascript
await this.#logHandler.execute({
  location_id: validatedLocationId,
  entry,
  originating_actor_id: actor_id,
  recipient_ids: normalizedContextualData.recipientIds,
  excluded_actor_ids: normalizedContextualData.excludedActorIds,
  alternate_descriptions: params.alternate_descriptions,
  sense_aware: params.sense_aware ?? true,
  // NEW: Pass perspective-aware descriptions
  actor_description,
  target_description,
  target_id,  // Already available, ensure it's passed
});
```

**Note**: `target_id` is already extracted but may not be passed to the log handler. Verify and add if missing.

## Acceptance Criteria

### Tests That Must Pass

**File**: `tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js`

1. **Test: actor_description passed to log handler**
   ```javascript
   it('should pass actor_description to log handler when provided', async () => {
     const mockLogHandler = { execute: jest.fn() };
     const handler = new DispatchPerceptibleEventHandler({ logHandler: mockLogHandler, ... });

     await handler.execute({
       location_id: 'loc1',
       description_text: 'Alice waves.',
       perception_type: 'physical.self_action',
       actor_id: 'actor1',
       actor_description: 'I wave enthusiastically.',
       log_entry: true,
     });

     expect(mockLogHandler.execute).toHaveBeenCalledWith(
       expect.objectContaining({
         actor_description: 'I wave enthusiastically.',
       })
     );
   });
   ```

2. **Test: target_description passed to log handler**
   ```javascript
   it('should pass target_description to log handler when provided', async () => {
     const mockLogHandler = { execute: jest.fn() };
     const handler = new DispatchPerceptibleEventHandler({ logHandler: mockLogHandler, ... });

     await handler.execute({
       location_id: 'loc1',
       description_text: 'Alice touches Bob.',
       perception_type: 'physical.interaction',
       actor_id: 'actor1',
       target_id: 'target1',
       target_description: 'Someone touches my shoulder.',
       log_entry: true,
     });

     expect(mockLogHandler.execute).toHaveBeenCalledWith(
       expect.objectContaining({
         target_description: 'Someone touches my shoulder.',
         target_id: 'target1',
       })
     );
   });
   ```

3. **Test: both parameters passed together**
   ```javascript
   it('should pass both actor_description and target_description when provided', async () => {
     // ... test that both are passed correctly
   });
   ```

4. **Test: parameters are undefined when not provided (backward compatibility)**
   ```javascript
   it('should not include actor_description when not provided', async () => {
     // ... ensure undefined values don't break existing behavior
   });
   ```

5. **Test: log_entry: false skips log handler** (existing test, ensure not broken)

### Invariants That Must Remain True

1. **Existing test suite passes**: All existing tests in `dispatchPerceptibleEventHandler.test.js` must continue to pass
2. **Event dispatch unchanged**: The `core:perceptible_event` payload structure must not change
3. **Validation unchanged**: Existing parameter validation for `location_id`, `description_text`, etc. must remain
4. **log_entry: false behavior**: When `log_entry` is false, no parameters should be passed to log handler
5. **Parameter defaults**: `actor_description` and `target_description` should be `undefined` when not provided (not empty string or null)

### Verification Commands

```bash
# Run unit tests for handler
npm run test:unit -- --testPathPattern="dispatchPerceptibleEventHandler"

# Run integration tests that use DISPATCH_PERCEPTIBLE_EVENT
npm run test:integration -- --testPathPattern="perception"

# Verify no type errors
npm run typecheck
```

## Dependencies

- ACTOBSPERMES-001 (schema must accept new parameters first)

## Blocked By

- ACTOBSPERMES-001

## Blocks

- ACTOBSPERMES-004 (log handler needs to receive parameters)
