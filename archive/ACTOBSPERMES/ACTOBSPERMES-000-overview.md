# ACTOBSPERMES-000: Actor vs Observer Perception Messaging - Overview

## Feature Summary

Implement perspective-aware messaging for the perception system so that:
- **Actors** receive first-person descriptions of their own actions (without sensory filtering)
- **Targets** receive personalized descriptions from their perspective (with sensory filtering)
- **Observers** receive third-person descriptions (with sensory filtering)

## Specification

Full specification: `specs/actor-observer-perception-messaging.spec.md`

## Problem Statement

Currently, when an actor performs an action, they receive the same third-person, sense-filtered message as all other observers. This creates immersion-breaking experiences:

**Example:**
- Action: Alice does a handstand
- Environment: Room is in darkness
- **Current behavior**: Alice receives "You hear sounds of exertion nearby" (auditory fallback)
- **Expected behavior**: Alice receives "I do a handstand, balancing upside-down." (she knows what she's doing)

## Solution

Add two new optional parameters to `DISPATCH_PERCEPTIBLE_EVENT`:
- `actor_description`: First-person message for the actor (no filtering)
- `target_description`: Second-person message for the target (filtered)

## Ticket Breakdown

```
ACTOBSPERMES-001 ──┐
(Schema: dispatch) │
                   ├──► ACTOBSPERMES-003 ──┐
ACTOBSPERMES-002 ──┤   (Handler: dispatch)  │
(Schema: log)      │                        ├──► ACTOBSPERMES-004 ──► ACTOBSPERMES-005 ──► ACTOBSPERMES-006
                   │                        │   (Handler: log)        (Documentation)     (Migration)
                   └────────────────────────┘
```

## Tickets

| Ticket | Title | Type | Priority | Depends On |
|--------|-------|------|----------|------------|
| [ACTOBSPERMES-001](./ACTOBSPERMES-001-schema-dispatch-perceptible-event.md) | Add actor/target_description to dispatchPerceptibleEvent schema | Schema | High | None |
| [ACTOBSPERMES-002](./ACTOBSPERMES-002-schema-add-perception-log-entry.md) | Add actor/target_description to addPerceptionLogEntry schema | Schema | High | None |
| [ACTOBSPERMES-003](./ACTOBSPERMES-003-handler-dispatch-perceptible-event.md) | Pass new parameters in dispatch handler | Handler | High | 001 |
| [ACTOBSPERMES-004](./ACTOBSPERMES-004-handler-add-perception-log-entry.md) | Implement routing logic in log handler | Handler | High | 002, 003 |
| [ACTOBSPERMES-005](./ACTOBSPERMES-005-documentation-update.md) | Update modding documentation | Docs | Medium | 004 |
| [ACTOBSPERMES-006](./ACTOBSPERMES-006-migration-existing-rules.md) | Migrate existing dual-dispatch rules | Migration | Low | 004 |

## Implementation Order

### Phase 1: Schema Updates (Parallel)
Can be done simultaneously:
1. **ACTOBSPERMES-001**: Update dispatchPerceptibleEvent.schema.json
2. **ACTOBSPERMES-002**: Update addPerceptionLogEntry.schema.json

### Phase 2: Handler Changes (Sequential)
Must be done in order:
3. **ACTOBSPERMES-003**: Update dispatchPerceptibleEventHandler.js (depends on 001)
4. **ACTOBSPERMES-004**: Update addPerceptionLogEntryHandler.js (depends on 002, 003)

### Phase 3: Documentation & Polish
5. **ACTOBSPERMES-005**: Update sense-aware-perception.md (depends on 004)
6. **ACTOBSPERMES-006**: Migrate existing rules (optional, depends on 004)

## Files Modified

| File | Ticket(s) |
|------|-----------|
| `data/schemas/operations/dispatchPerceptibleEvent.schema.json` | 001 |
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | 002 |
| `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` | 003 |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | 004 |
| `tests/unit/logic/operationHandlers/dispatchPerceptibleEventHandler.test.js` | 003 |
| `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js` | 004 |
| `tests/integration/logic/operationHandlers/addPerceptionLogEntryHandler.integration.test.js` | 004 |
| `docs/modding/sense-aware-perception.md` | 005 |
| `data/mods/items/rules/handle_drink_from.rule.json` | 006 |
| `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` | 006 |

## Acceptance Criteria (Feature-Level)

1. **Actor perspective works**: Actor receives `actor_description` without filtering
2. **Target perspective works**: Target receives `target_description` with filtering
3. **Observer perspective unchanged**: Observers receive `description_text` with filtering
4. **Backward compatible**: Existing rules without new parameters work identically
5. **Metadata tracking**: Actor entries include `perceivedVia: "self"`
6. **Warning for invalid targets**: Warning when target lacks perception log
7. **Documentation complete**: Mod authors can use new feature

## Estimated Effort

| Ticket | Complexity | Est. Lines Changed |
|--------|------------|-------------------|
| 001 | Low | ~20 |
| 002 | Low | ~25 |
| 003 | Low | ~30 |
| 004 | Medium | ~80 |
| 005 | Low | ~150 (markdown) |
| 006 | Low | ~50 (JSON) |

**Total**: ~355 lines (excluding tests)

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backward compatibility break | Low | Extensive existing test coverage, new params optional |
| Incorrect routing logic | Medium | Comprehensive unit tests for edge cases |
| Documentation gaps | Low | Spec provides complete examples |
| Performance regression | Very Low | No new loops or searches added |

## Definition of Done

- [ ] All tickets completed
- [ ] All tests pass: `npm run test:ci`
- [ ] No type errors: `npm run typecheck`
- [ ] No lint errors: `npx eslint <modified-files>`
- [ ] Documentation reviewed
- [ ] Feature manually tested with sample rules
