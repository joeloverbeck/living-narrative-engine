# SENAWAPEREVE-007: Integrate PerceptionFilterService into Handlers

**Status**: Completed
**Priority**: HIGH
**Effort**: Large
**Completed**: 2025-12-17

## Summary

Modify the perception handlers to use PerceptionFilterService for sense-aware filtering. **This is the only ticket that introduces behavioral changes** - after this ticket, perception events will be filtered based on recipient sensory capabilities and environmental conditions.

## File list it expects to touch

- **Modify**: `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- **Modify**: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- **Modify**: `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`
- **Modify**: `tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js`
- **Create**: `tests/integration/perception/senseAwareFiltering.integration.test.js`

## Out of scope (must NOT change)

- Creating example rules with alternate descriptions (handled in SENAWAPEREVE-008)
- Documentation updates (handled in SENAWAPEREVE-008)
- Migration of existing rules to use alternate_descriptions
- Schema files (handled in SENAWAPEREVE-006)
- Service implementations (handled in SENAWAPEREVE-003 and SENAWAPEREVE-005)
- Any other operation handlers

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPattern="addPerceptionLogEntryHandler"` passes
- `npm run test:unit -- --testPathPattern="dispatchPerceptibleEventHandler"` passes
- `npm run test:integration -- --testPathPattern="senseAwareFiltering"` passes
- All existing handler tests continue to pass

### Invariants that must remain true

- Backward compatibility: existing rules work unchanged
- No behavioral change when `alternate_descriptions` not provided
- No behavioral change when `sense_aware: false`
- Error types (omniscient) always delivered to all recipients
- Actor always receives their own proprioceptive events
- Recipients with `canPerceive: false` don't receive log entries (silent filter)

## Implementation details

### AddPerceptionLogEntryHandler modifications

1. **Add new dependency**: Inject `IPerceptionFilterService` via constructor

```javascript
constructor({
  entityManager,
  safeEventDispatcher,
  logger,
  perceptionFilterService  // NEW
}) { ... }
```

2. **Process sense filtering** before building batch updates:

```javascript
// In execute() method, after resolving recipients:

// If sense_aware is false or not provided AND no alternate_descriptions, use existing logic
if (parameters.sense_aware === false || !parameters.alternate_descriptions) {
  // existing batch update logic
  return;
}

// Filter event for all recipients
const filteredRecipients = this.#perceptionFilterService.filterEventForRecipients(
  {
    perceptionType: entry.perceptionType,
    descriptionText: entry.descriptionText,
    alternateDescriptions: parameters.alternate_descriptions
  },
  resolvedRecipientIds,
  parameters.location_id,
  parameters.originating_actor_id
);

// Build batch only for recipients that can perceive
for (const filtered of filteredRecipients) {
  if (!filtered.canPerceive) continue;

  // Build entry with filtered description
  const filteredEntry = {
    ...entry,
    descriptionText: filtered.descriptionText,
    perceivedVia: filtered.sense  // NEW: for debugging
  };

  // Add to batch...
}
```

3. **Add `perceivedVia` field** to log entries for debugging

### DispatchPerceptibleEventHandler modifications

1. **Pass new fields** to AddPerceptionLogEntryHandler when `log_entry: true`:

```javascript
// In execute() method, when invoking log handler:
if (parameters.log_entry) {
  await this.#addPerceptionLogEntryHandler.execute({
    ...existingParams,
    alternate_descriptions: parameters.alternate_descriptions,  // NEW
    sense_aware: parameters.sense_aware  // NEW (defaults to true)
  });
}
```

### Unit test updates

**AddPerceptionLogEntryHandler tests** - add:
- Test: sense_aware false bypasses filtering
- Test: missing alternate_descriptions uses existing logic
- Test: filtering removes recipients that can't perceive
- Test: perceivedVia field added to log entries
- Test: silent filtering (no error when recipient filtered)

**DispatchPerceptibleEventHandler tests** - add:
- Test: alternate_descriptions passed to log handler
- Test: sense_aware passed to log handler
- Test: defaults work correctly

### Integration test scenarios

Create `tests/integration/perception/senseAwareFiltering.integration.test.js`:

1. **Dark location + visual event**
   - Setup: Location with lighting='dark', entity with healthy eyes
   - Action: Dispatch visual perception event with auditory fallback
   - Assert: Entity receives auditory description

2. **Blind entity + visual event**
   - Setup: Entity with destroyed eyes, healthy ears
   - Action: Dispatch visual event with auditory fallback
   - Assert: Entity receives auditory text

3. **Actor always perceives own proprioceptive events**
   - Setup: Actor performs action
   - Action: Dispatch proprioceptive event
   - Assert: Actor receives visual description regardless of conditions

4. **Multiple recipients get different descriptions**
   - Setup: Three entities - one sighted, one blind (with ears), one deaf+blind
   - Action: Dispatch visual event with auditory and limited fallbacks
   - Assert:
     - Sighted gets visual
     - Blind+hearing gets auditory
     - Deaf+blind gets limited

5. **Omniscient events bypass filtering**
   - Setup: Entity in darkness with destroyed senses
   - Action: Dispatch error.system_error
   - Assert: Entity receives the message

6. **Silent filtering with no fallback**
   - Setup: Entity in darkness, no alternate_descriptions
   - Action: Dispatch visual event
   - Assert: Entity receives no log entry (silent filter)

7. **sense_aware: false bypasses all filtering**
   - Setup: Entity in darkness
   - Action: Dispatch visual event with sense_aware: false
   - Assert: Entity receives full visual description

## Dependencies

- SENAWAPEREVE-005 (PerceptionFilterService registered in DI)
- SENAWAPEREVE-006 (schemas extended with new fields)

## Dependent tickets

- SENAWAPEREVE-008 (example rule demonstrates these changes)

---

## Outcome

**Assessment Date**: 2025-12-17

### What Was Found

Upon reassessing the ticket assumptions against the actual codebase, **all implementation work was already complete** from prior development. The ticket accurately described what needed to be done, but the work had already been performed.

### Evidence of Completion

#### Code Implementation (Verified Present)

1. **`addPerceptionLogEntryHandler.js`**:
   - Has `perceptionFilterService` as optional constructor dependency (lines 43-45)
   - Implements complete sense-aware filtering logic (lines 196-231)
   - Adds `perceivedVia` field to filtered entries (line 274)
   - Silent filtering when recipient can't perceive (lines 243-248)
   - Backward compatible with optional service injection

2. **`dispatchPerceptibleEventHandler.js`**:
   - Passes `alternate_descriptions` to log handler (line 272)
   - Passes `sense_aware` to log handler with default `true` (line 273)

#### Test Verification (All Passing)

| Test Suite | Tests | Status |
|------------|-------|--------|
| `addPerceptionLogEntryHandler.test.js` | 43 | ✅ PASSED |
| `dispatchPerceptibleEventHandler.test.js` | 23 | ✅ PASSED |
| `senseAwareFiltering.integration.test.js` | 11 | ✅ PASSED |

**Total: 77 tests covering all acceptance criteria**

#### Integration Tests Cover All 7 Scenarios

1. ✅ Dark location + visual event
2. ✅ Blind entity + visual event
3. ✅ Actor proprioceptive events
4. ✅ Multiple recipients different descriptions
5. ✅ Omniscient events bypass
6. ✅ Silent filtering
7. ✅ sense_aware: false bypass

### What Changed vs Originally Planned

**Originally Planned**: Implement handler integration from scratch
**Actual Outcome**: No code changes required - work was already complete

### Verification Commands Run

```bash
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js --no-coverage --silent
# Result: 43 tests passed

NODE_ENV=test npx jest tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js --no-coverage --silent
# Result: 23 tests passed

NODE_ENV=test npx jest tests/integration/perception/senseAwareFiltering.integration.test.js --no-coverage --silent
# Result: 11 tests passed
```

### Conclusion

Ticket marked complete with no additional code changes. All handler integration work, unit tests, and integration tests were implemented in prior development cycles. The acceptance criteria and invariants are fully satisfied.
