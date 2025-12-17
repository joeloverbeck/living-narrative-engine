# DISPEREVEUPG-000: DISPATCH_PERCEPTIBLE_EVENT Perspective-Aware Upgrades - Overview

**Status:** Ready
**Priority:** High
**Estimated Total Effort:** 5-7 days
**Spec Reference:** `specs/dispatch-perceptible-event-upgrades.spec.md`

---

## Summary

This ticket series upgrades 33 rule files across the codebase to support the new perspective-aware perception system with `actor_description`, `target_description`, and `alternate_descriptions` parameters.

---

## Background

The perception system has been enhanced to support:
- **`actor_description`**: First-person message delivered to the actor (bypasses sensory filtering)
- **`target_description`**: Second-person message delivered to the target (subject to sensory filtering)
- **`alternate_descriptions`**: Fallback descriptions for different sensory modes (auditory, tactile, olfactory, limited)

### Reference Implementations
- `data/mods/items/rules/handle_drink_from.rule.json` - Actor description with flavor text
- `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` - Full actor/target/alternates per outcome

### Documentation
- `docs/modding/sense-aware-perception.md` - Complete documentation

---

## Ticket Series

| Ticket | Description | Files | Priority |
|--------|-------------|-------|----------|
| **DISPEREVEUPG-001** | Physical control rules (restrain, break free, let go) | 3 | Critical |
| **DISPEREVEUPG-002** | Warding rules (salt boundary, cross, extract corruption) | 3 | Critical/High |
| **DISPEREVEUPG-003** | First aid rules (treat wounded part, self-treatment) | 2 | Critical/High |
| **DISPEREVEUPG-004** | Social rules (adjust clothing, dismiss, stop following, clutch) | 4 | Critical |
| **DISPEREVEUPG-005** | Item transfer (give item) + macro replacement | 1 | Critical |
| **DISPEREVEUPG-006** | Movement & positioning (go, teleport, feel way, bend over) | 4 | High |
| **DISPEREVEUPG-007** | Core rules (entity speech, thought) | 2 | High |
| **DISPEREVEUPG-008** | Containers, item-handling, item-placement + bug fix | 6 | Moderate |
| **DISPEREVEUPG-009** | Items & writing (drink entirely, read, jot notes, sign) | 4 | Moderate |
| **DISPEREVEUPG-010** | Locks & observation | 4 | Moderate |
| **DISPEREVEUPG-011** | Documentation update & final verification | 0 | Final |

**Total:** 33 rule files across 11 implementation tickets

---

## Implementation Patterns

### Pattern A: Actor-to-Actor Action (Full Perspective)
Use for: physical-control, social actions, first-aid on others, item transfer

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action] {context.targetName}.",
    "actor_description": "I [action] {context.targetName}. [internal sensory details].",
    "target_description": "{context.actorName} [action] me. [recipient sensory details].",
    "perception_type": "[appropriate.type]",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear [appropriate sound] nearby.",
      "tactile": "I feel [appropriate sensation]."
    }
  }
}
```

### Pattern B: Self-Action (Actor + Observers)
Use for: movement, positioning, self-treatment, speech, thought

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action].",
    "actor_description": "I [action]. [internal confirmation/sensation].",
    "perception_type": "[appropriate.type]",
    "actor_id": "{event.payload.actorId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear [appropriate sound] nearby."
    }
  }
}
```

### Pattern C: Object Interaction
Use for: containers, items, writing, locks, observation

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action] {context.objectName}.",
    "actor_description": "I [action] {context.objectName}. [tactile/visual detail].",
    "perception_type": "[appropriate.type]",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear [manipulation sounds] nearby."
    }
  }
}
```

---

## Special Considerations

### Macro Replacement
Rules using `core:logSuccessAndEndTurn` or similar macros must be replaced with inline operations for full perspective support:
- DISPEREVEUPG-005: handle_give_item
- DISPEREVEUPG-008: handle_open_container, handle_put_in_container, handle_take_from_container, handle_pick_up_item, handle_put_on_nearby_surface, handle_take_from_nearby_surface

### Bug Fix
DISPEREVEUPG-008 includes fixing missing `target_id` parameter in `handle_pick_up_item.rule.json`.

### Multiple Outcome Branches
Many rules have multiple outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE). Each branch requires its own complete set of perspective descriptions.

---

## Validation Checklist (Per Rule)

- [ ] `actor_description` uses first-person ("I [verb]...")
- [ ] `target_description` uses second-person ("{actor} [verb] me...")
- [ ] `description_text` uses third-person ("{actor} [verb] {target}...")
- [ ] `alternate_descriptions` has realistic sensory fallbacks
- [ ] `actor_id` is present
- [ ] `target_id` is present (if applicable)
- [ ] `perception_type` is appropriate
- [ ] Integration tests pass

---

## Global Invariants

These must remain true throughout the entire ticket series:

1. All existing functionality works identically
2. `npm run validate` passes
3. `npm run test:ci` passes
4. No changes to handler code (`src/logic/operationHandlers/`)
5. No changes to schema files (`data/schemas/`)
6. Reference implementations remain untouched

---

## Execution Order

Recommended implementation order:
1. DISPEREVEUPG-001 through DISPEREVEUPG-005 (Critical priority)
2. DISPEREVEUPG-006 and DISPEREVEUPG-007 (High priority)
3. DISPEREVEUPG-008 through DISPEREVEUPG-010 (Moderate priority)
4. DISPEREVEUPG-011 (Documentation & verification)
