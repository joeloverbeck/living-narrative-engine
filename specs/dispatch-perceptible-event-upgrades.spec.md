# Specification: DISPATCH_PERCEPTIBLE_EVENT Perspective-Aware Upgrades

## Overview

This specification defines the systematic upgrade of all `DISPATCH_PERCEPTIBLE_EVENT` operations across the codebase to support perspective-aware descriptions using the new `actor_description`, `target_description`, and `alternate_descriptions` parameters.

### Background

The perception system has been enhanced to support:
- **`actor_description`**: First-person message delivered to the actor (bypasses sensory filtering - they know what they're doing)
- **`target_description`**: Second-person message delivered to the target (subject to sensory filtering)
- **`alternate_descriptions`**: Fallback descriptions for different sensory modes (auditory, tactile, olfactory, limited)

Reference implementations:
- `data/mods/items/rules/handle_drink_from.rule.json` (actor_description with flavor)
- `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` (full actor/target/alternates)
- `docs/modding/sense-aware-perception.md` (complete documentation)

---

## Scope

**35 rule files** containing `DISPATCH_PERCEPTIBLE_EVENT` operations across these mods:

| Mod | Count | Files |
|-----|-------|-------|
| positioning | 1 | bend_over |
| movement | 3 | go, handle_teleport, handle_feel_your_way_to_an_exit |
| items | 3 | handle_drink_from, handle_drink_entirely, handle_read_item |
| writing | 2 | handle_jot_down_notes, handle_sign_document |
| warding | 3 | handle_cross_salt_boundary, handle_draw_salt_boundary, handle_extract_spiritual_corruption |
| locks | 2 | handle_lock_connection, handle_unlock_connection |
| observation | 2 | handle_examine_item_in_location, handle_examine_owned_item |
| physical-control | 3 | handle_break_free_from_restraint, handle_let_go_of_restrained_target, handle_restrain_target |
| caressing | 1 | adjust_clothing |
| companionship | 2 | dismiss, stop_following |
| containers | 3 | handle_open_container, handle_put_in_container, handle_take_from_container |
| core | 2 | entity_speech, entity_thought |
| distress | 1 | clutch_onto_upper_clothing |
| first-aid | 2 | handle_treat_my_wounded_part, handle_treat_wounded_part |
| item-handling | 1 | handle_pick_up_item |
| item-placement | 2 | handle_put_on_nearby_surface, handle_take_from_nearby_surface |
| item-transfer | 1 | handle_give_item |
| hexing | 1 | handle_corrupting_gaze (ALREADY UPGRADED - REFERENCE) |

---

## Prioritization Categories

### Priority 1: CRITICAL - Actor-to-Actor Actions (11 rules)

These rules involve interactions where **both actor and target are people**. They require full perspective support.

| Rule | Current State | Required Changes |
|------|---------------|------------------|
| **physical-control/handle_restrain_target** | Generic description only | Add actor_description, target_description, alternate_descriptions per outcome |
| **physical-control/handle_break_free_from_restraint** | Generic description only | Add actor_description, target_description, alternate_descriptions per outcome |
| **physical-control/handle_let_go_of_restrained_target** | Generic description only | Add actor_description, target_description |
| **warding/handle_draw_salt_boundary** | Generic description only | Add actor_description, target_description (target is corrupted person) |
| **item-transfer/handle_give_item** | Generic, missing perspectives | Add actor_description, target_description, alternate_descriptions |
| **caressing/adjust_clothing** | Generic description only | Add actor_description, target_description |
| **companionship/dismiss** | Generic description only | Add actor_description, target_description |
| **companionship/stop_following** | Generic description only | Add actor_description, target_description |
| **distress/clutch_onto_upper_clothing** | Generic description only | Add actor_description, target_description |
| **first-aid/handle_treat_wounded_part** | Generic description only | Add actor_description, target_description per outcome |
| **warding/handle_extract_spiritual_corruption** | Uses dual-dispatch pattern | EXEMPLAR - already sophisticated, add alternate_descriptions |

### Priority 2: HIGH - Self-Actions with Observers (8 rules)

These rules involve **self-directed actions** where the actor should receive first-person confirmation while observers see third-person.

| Rule | Current State | Required Changes |
|------|---------------|------------------|
| **positioning/bend_over** | Has minimal alternate | Add actor_description, enhance alternate_descriptions |
| **movement/handle_feel_your_way_to_an_exit** | Generic descriptions | Add actor_description per outcome, alternate_descriptions |
| **movement/go** | Generic descriptions | Add actor_description, alternate_descriptions (movement sounds) |
| **movement/handle_teleport** | Generic descriptions | Add actor_description, alternate_descriptions (magical) |
| **warding/handle_cross_salt_boundary** | Generic description | Add actor_description, alternate_descriptions (magical) |
| **first-aid/handle_treat_my_wounded_part** | Generic descriptions | Add actor_description per outcome |
| **core/entity_speech** | Generic description | Add actor_description (internal confirmation) |
| **core/entity_thought** | Generic description | Add actor_description (thought awareness) |

### Priority 3: MODERATE - Object Interactions (14 rules)

These rules involve **actor-to-object interactions**. They need `actor_description` but NOT `target_description` (objects don't perceive).

| Rule | Current State | Required Changes |
|------|---------------|------------------|
| **items/handle_drink_entirely** | Already has dual-dispatch | Convert to unified pattern, add alternate_descriptions |
| **items/handle_read_item** | Already has dual-dispatch | Convert to unified pattern, add alternate_descriptions |
| **writing/handle_jot_down_notes** | Generic description | Add actor_description, alternate_descriptions |
| **writing/handle_sign_document** | Generic description | Add actor_description, alternate_descriptions |
| **locks/handle_lock_connection** | Generic description | Add actor_description, alternate_descriptions |
| **locks/handle_unlock_connection** | Generic description | Add actor_description, alternate_descriptions |
| **observation/handle_examine_item_in_location** | Has recipientIds | Add actor_description (internal), alternate_descriptions |
| **observation/handle_examine_owned_item** | Has recipientIds | Add actor_description (internal), alternate_descriptions |
| **containers/handle_open_container** | Generic description | Add actor_description, alternate_descriptions |
| **containers/handle_put_in_container** | Generic description | Add actor_description, alternate_descriptions |
| **containers/handle_take_from_container** | Generic description | Add actor_description, alternate_descriptions |
| **item-handling/handle_pick_up_item** | Missing target_id | FIX: Add target_id, add actor_description, alternate_descriptions |
| **item-placement/handle_put_on_nearby_surface** | Generic description | Add actor_description, alternate_descriptions |
| **item-placement/handle_take_from_nearby_surface** | Generic description | Add actor_description, alternate_descriptions |

### Already Upgraded (2 rules - REFERENCE ONLY)

| Rule | Status |
|------|--------|
| **items/handle_drink_from** | COMPLETE - Reference implementation |
| **hexing/handle_corrupting_gaze** | COMPLETE - Reference implementation |

---

## Implementation Patterns

### Pattern A: Actor-to-Actor Action (Full Perspective)

Use for: Physical control, social actions, first-aid on others, item transfer

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Action with full perspective-aware descriptions",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action verb] {context.targetName}.",
    "actor_description": "I [action verb] {context.targetName}. [Internal sensory details].",
    "target_description": "{context.actorName} [action verb] me. [Recipient sensory details].",
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

Use for: Movement, positioning, self-treatment, speech, thought

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Self-action with actor awareness and observer perception",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action verb].",
    "actor_description": "I [action verb]. [Internal confirmation/sensation].",
    "perception_type": "[appropriate.type]",
    "actor_id": "{event.payload.actorId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear [appropriate sound] nearby."
    }
  }
}
```

### Pattern C: Object Interaction (Actor + Object)

Use for: Item manipulation, container operations, reading, writing

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Object interaction with actor-specific description",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} [action verb] {context.objectName}.",
    "actor_description": "I [action verb] {context.objectName}. [Tactile/visual detail].",
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

## Detailed Upgrade Specifications

### 1. physical-control/handle_restrain_target.rule.json

**Current**: 4 DISPATCH_PERCEPTIBLE_EVENT calls (one per outcome)
**Upgrade**:

```
CRITICAL_SUCCESS:
  description_text: "{context.actorName} restrains {context.targetName} with overwhelming force."
  actor_description: "I overpower {context.targetName} completely, restraining them with ease."
  target_description: "{context.actorName} overpowers me completely, restraining me with overwhelming force."
  alternate_descriptions:
    auditory: "I hear sounds of a struggle and someone being subdued nearby."
    tactile: "I feel vibrations from a physical altercation nearby."

SUCCESS:
  description_text: "{context.actorName} restrains {context.targetName}."
  actor_description: "I restrain {context.targetName}, holding them firmly."
  target_description: "{context.actorName} restrains me, holding me firmly in place."
  alternate_descriptions:
    auditory: "I hear sounds of a struggle nearby."
    tactile: "I feel movement and scuffling nearby."

FAILURE:
  description_text: "{context.actorName} tries to restrain {context.targetName}, but they slip free."
  actor_description: "I try to restrain {context.targetName}, but they slip from my grasp."
  target_description: "{context.actorName} tries to restrain me, but I slip free from their grip."
  alternate_descriptions:
    auditory: "I hear sounds of struggling and movement nearby."

FUMBLE:
  description_text: "{context.actorName} tries to restrain {context.targetName}, but loses balance and falls."
  actor_description: "I overreach trying to restrain {context.targetName} and lose my balance, falling."
  target_description: "{context.actorName} lunges at me but loses their balance and falls."
  alternate_descriptions:
    auditory: "I hear someone stumble and fall nearby."
```

### 2. physical-control/handle_break_free_from_restraint.rule.json

**Current**: Multiple DISPATCH_PERCEPTIBLE_EVENT calls per outcome
**Upgrade**:

```
CRITICAL_SUCCESS:
  description_text: "{context.actorName} breaks free from {context.targetName} with explosive force."
  actor_description: "I break free from {context.targetName}'s grip with a surge of strength."
  target_description: "{context.actorName} breaks free from my grip with explosive force."
  alternate_descriptions:
    auditory: "I hear sudden movement and someone breaking free nearby."
    tactile: "I feel a sudden release of physical tension nearby."

SUCCESS:
  description_text: "{context.actorName} breaks free from {context.targetName}."
  actor_description: "I break free from {context.targetName}'s restraint."
  target_description: "{context.actorName} breaks free from my restraint."
  alternate_descriptions:
    auditory: "I hear struggling sounds and someone breaking free."

FAILURE:
  description_text: "{context.actorName} struggles against {context.targetName}'s restraint but fails to break free."
  actor_description: "I struggle against {context.targetName}'s grip but cannot break free."
  target_description: "{context.actorName} struggles against my grip but I hold them firm."
  alternate_descriptions:
    auditory: "I hear sounds of struggling nearby."

FUMBLE:
  description_text: "{context.actorName} struggles against {context.targetName}'s restraint and injures themselves."
  actor_description: "I struggle violently against {context.targetName}'s grip and hurt myself in the process."
  target_description: "{context.actorName} struggles wildly against my grip and hurts themselves."
  alternate_descriptions:
    auditory: "I hear someone struggling and a pained sound."
```

### 3. physical-control/handle_let_go_of_restrained_target.rule.json

**Current**: Single DISPATCH_PERCEPTIBLE_EVENT
**Upgrade**:

```
description_text: "{context.actorName} lets go of {context.targetName}, leaving them unrestrained."
actor_description: "I release my hold on {context.targetName}."
target_description: "{context.actorName} releases their hold on me. I am free."
alternate_descriptions:
  auditory: "I hear movement and someone being released nearby."
```

### 4. warding/handle_draw_salt_boundary.rule.json

**Current**: 4 DISPATCH_PERCEPTIBLE_EVENT calls (one per outcome)
**Upgrade**:

```
CRITICAL_SUCCESS:
  description_text: "{context.actorName} draws a powerful salt boundary around {context.targetName}."
  actor_description: "I draw a powerful salt boundary around {context.targetName}. The ward glows with protective energy."
  target_description: "{context.actorName} draws a salt boundary around me. I feel contained by its power."
  alternate_descriptions:
    auditory: "I hear a faint crystalline sound and sense magical energy nearby."
    tactile: "I feel a wave of protective energy emanating from nearby."

SUCCESS:
  description_text: "{context.actorName} draws a salt boundary around {context.targetName}."
  actor_description: "I draw a salt boundary around {context.targetName}. The ward takes hold."
  target_description: "{context.actorName} draws a salt boundary around me. I feel its protective presence."
  alternate_descriptions:
    auditory: "I hear a faint crystalline sound nearby."
    tactile: "I feel a subtle magical presence nearby."

FAILURE/FUMBLE: (similar pattern with appropriate outcome descriptions)
```

### 5. item-transfer/handle_give_item.rule.json

**Current**: Single DISPATCH_PERCEPTIBLE_EVENT (failure case)
**Upgrade for failure case**:

```
description_text: "{context.actorName} tried to give {context.itemName} to {context.targetName}, but they can't carry it."
actor_description: "I try to give {context.itemName} to {context.targetName}, but they can't carry it."
target_description: "{context.actorName} tries to give me {context.itemName}, but I can't carry it."
alternate_descriptions:
  auditory: "I hear the sound of an item being offered and refused nearby."
```

**Note**: Success case uses macro - needs inline DISPATCH_PERCEPTIBLE_EVENT added.

### 6. caressing/adjust_clothing.rule.json

**Upgrade**:

```
description_text: "{context.perceptibleLogMessage}"
actor_description: "I adjust {context.targetName}'s clothing, my hands [descriptive action]."
target_description: "{context.actorName} adjusts my clothing. I feel their hands [sensation]."
alternate_descriptions:
  auditory: "I hear the rustle of fabric being adjusted nearby."
  tactile: "I sense someone's clothing being adjusted nearby."
```

### 7. companionship/dismiss.rule.json

**Upgrade**:

```
description_text: "{context.actorName} has dismissed {context.targetName} from their service."
actor_description: "I dismiss {context.targetName} from my service."
target_description: "{context.actorName} dismisses me from their service."
alternate_descriptions:
  auditory: "I hear a formal dismissal spoken nearby."
```

### 8. companionship/stop_following.rule.json

**Upgrade**:

```
description_text: "{context.actorName.text} is no longer following {context.oldLeaderName.text}."
actor_description: "I stop following {context.oldLeaderName.text}. I am on my own now."
target_description: "{context.actorName.text} stops following me."
alternate_descriptions:
  auditory: "I hear a declaration of independence nearby."
```

### 9. distress/clutch_onto_upper_clothing.rule.json

**Upgrade**:

```
description_text: "{context.perceptibleLogMessage}"
actor_description: "I clutch onto {context.targetName}'s clothing desperately, seeking comfort."
target_description: "{context.actorName} clutches onto my clothing desperately. I can feel their distress."
alternate_descriptions:
  auditory: "I hear fabric being gripped and a distressed sound nearby."
  tactile: "I sense desperate movement and grasping nearby."
```

### 10. first-aid/handle_treat_wounded_part.rule.json

**Upgrade per outcome** (CRITICAL_SUCCESS example):

```
description_text: "{context.logMessage}"
actor_description: "I treat {context.targetName}'s wound with expert precision. The wound responds well."
target_description: "{context.actorName} treats my wound with expert precision. I feel relief."
alternate_descriptions:
  auditory: "I hear sounds of medical treatment being administered nearby."
  tactile: "I sense careful medical attention being given nearby."
```

### 11. positioning/bend_over.rule.json

**Current**: Has auditory alternate only
**Upgrade**:

```
description_text: "{context.actorName} bends over {context.surfaceName}."
actor_description: "I bend over {context.surfaceName}, adjusting my position."
alternate_descriptions:
  auditory: "I hear the rustle of clothing and shifting of weight as someone changes position nearby."
  tactile: "I feel vibrations from someone shifting their position nearby."
```

### 12-14. Movement rules (go, teleport, feel_your_way)

**Pattern for go.rule.json**:

```
Departure:
  description_text: "{context.actorName} leaves towards {context.destinationName}."
  actor_description: "I head towards {context.destinationName}."
  alternate_descriptions:
    auditory: "I hear footsteps heading away."

Arrival:
  description_text: "{context.actorName} arrives from {context.originName}."
  actor_description: "I arrive at my destination."
  alternate_descriptions:
    auditory: "I hear footsteps approaching."
```

**Pattern for handle_teleport.rule.json**:

```
Departure:
  description_text: "{context.actorName} vanishes in a flash of light."
  actor_description: "I feel the world shift as I teleport away."
  alternate_descriptions:
    auditory: "I hear a crackling sound as someone teleports."
    tactile: "I feel a sudden displacement of air nearby."

Arrival:
  description_text: "{context.actorName} appears in a flash of light."
  actor_description: "I materialize at my destination."
  alternate_descriptions:
    auditory: "I hear a crackling sound as someone appears."
    tactile: "I feel a sudden displacement of air as someone appears."
```

### 15-16. Container/Item rules

All object interactions follow **Pattern C**. Add `actor_description` for internal experience (e.g., "I open the chest" vs "Alice opens the chest") and appropriate `alternate_descriptions` for sounds.

### Critical Fix: item-handling/handle_pick_up_item.rule.json

**Current Bug**: Missing `target_id` in DISPATCH_PERCEPTIBLE_EVENT
**Fix**: Add `"target_id": "{event.payload.targetId}"` to parameters

---

## Test Updates Required

### Integration Tests to Update

For each modified rule, the corresponding integration test file must be updated to verify:

1. **Actor receives `actor_description`** (not `description_text`)
2. **Target receives `target_description`** (if actor target)
3. **Observers receive `description_text`**
4. **Sensory fallbacks work** via `alternate_descriptions`

| Rule File | Test File |
|-----------|-----------|
| handle_restrain_target.rule.json | tests/integration/mods/physical-control/restrain_target_*.test.js |
| handle_break_free_from_restraint.rule.json | tests/integration/mods/physical-control/break_free_*.test.js |
| handle_let_go_of_restrained_target.rule.json | tests/integration/mods/physical-control/let_go_*.test.js |
| handle_draw_salt_boundary.rule.json | tests/integration/mods/warding/draw_salt_boundary_*.test.js |
| handle_give_item.rule.json | tests/integration/mods/item-transfer/give_item_*.test.js |
| adjust_clothing.rule.json | tests/integration/mods/caressing/adjust_clothing_*.test.js |
| dismiss.rule.json | tests/integration/mods/companionship/dismiss_*.test.js |
| stop_following.rule.json | tests/integration/mods/companionship/stop_following_*.test.js |
| clutch_onto_upper_clothing.rule.json | tests/integration/mods/distress/clutch_*.test.js |
| handle_treat_wounded_part.rule.json | tests/integration/mods/first-aid/treat_wounded_part_*.test.js |
| bend_over.rule.json | tests/integration/mods/positioning/bend_over_*.test.js |
| go.rule.json | tests/integration/mods/movement/go_*.test.js |
| handle_teleport.rule.json | tests/integration/mods/movement/teleport_*.test.js |
| handle_feel_your_way_to_an_exit.rule.json | tests/integration/mods/movement/feel_your_way_*.test.js |
| handle_pick_up_item.rule.json | tests/integration/mods/item-handling/pick_up_item_*.test.js |
| (etc. for all 33 rules requiring upgrades) |

### Test Pattern for Perspective Verification

```javascript
describe('DISPATCH_PERCEPTIBLE_EVENT perspective handling', () => {
  it('should deliver actor_description to the actor', async () => {
    // Execute action
    // Verify actor's perception log contains actor_description text
  });

  it('should deliver target_description to the target (if actor)', async () => {
    // Execute action
    // Verify target's perception log contains target_description text
  });

  it('should deliver description_text to observers', async () => {
    // Execute action with observer present
    // Verify observer's perception log contains description_text
  });

  it('should fall back to alternate_descriptions when primary sense unavailable', async () => {
    // Execute action with observer who cannot see
    // Verify observer receives auditory alternate description
  });
});
```

---

## Implementation Order

### Phase 1: Critical Actor-to-Actor (Week 1)
1. physical-control/* (3 rules)
2. warding/handle_draw_salt_boundary
3. item-transfer/handle_give_item

### Phase 2: High-Priority Self-Actions (Week 2)
1. positioning/bend_over
2. movement/* (3 rules)
3. warding/handle_cross_salt_boundary
4. first-aid/handle_treat_my_wounded_part

### Phase 3: Social/Emotional Actor Interactions (Week 3)
1. caressing/adjust_clothing
2. companionship/* (2 rules)
3. distress/clutch_onto_upper_clothing
4. first-aid/handle_treat_wounded_part

### Phase 4: Object Interactions (Week 4)
1. containers/* (3 rules)
2. items/* (2 rules - drink_entirely, read_item)
3. item-handling/handle_pick_up_item (includes target_id fix)
4. item-placement/* (2 rules)
5. writing/* (2 rules)
6. locks/* (2 rules)
7. observation/* (2 rules)

### Phase 5: Core Rules (Week 5)
1. core/entity_speech
2. core/entity_thought
3. warding/handle_extract_spiritual_corruption (add alternate_descriptions)

---

## Validation Checklist

For each upgraded rule:

- [ ] `actor_description` uses first-person ("I [verb]...")
- [ ] `target_description` uses second-person perspective ("{actor} [verb] me...")
- [ ] `description_text` uses third-person ("{actor} [verb] {target}...")
- [ ] `alternate_descriptions` has realistic sensory fallbacks
- [ ] `actor_id` is present
- [ ] `target_id` is present (if applicable)
- [ ] `perception_type` is appropriate
- [ ] Integration test updated and passing
- [ ] Manual testing confirms correct perspective delivery

---

## Notes

### Rules Requiring Macro Replacement

Several rules use macros (`core:logSuccessAndEndTurn`, `core:logSuccessOutcomeAndEndTurn`) which internally use `DISPATCH_EVENT` instead of `DISPATCH_PERCEPTIBLE_EVENT`. For full perspective support, these need inline implementation:

- containers/handle_open_container (success case)
- containers/handle_put_in_container (success case)
- containers/handle_take_from_container (success case)
- item-handling/handle_pick_up_item (success case)
- item-placement/handle_put_on_nearby_surface (success case)
- item-placement/handle_take_from_nearby_surface (success case)
- item-transfer/handle_give_item (success case)

### Edge Cases

1. **Actor = Target**: When self-targeting, `actor_description` takes precedence
2. **Target is Object**: `target_description` should NOT be added (warning logged if present)
3. **Multiple Outcomes**: Each outcome branch needs its own perspective descriptions
4. **Existing dual-dispatch**: Convert to single unified dispatch with actor_description

---

## Appendix: Complete File List

### Priority 1 - CRITICAL (11 files)
1. `data/mods/physical-control/rules/handle_restrain_target.rule.json`
2. `data/mods/physical-control/rules/handle_break_free_from_restraint.rule.json`
3. `data/mods/physical-control/rules/handle_let_go_of_restrained_target.rule.json`
4. `data/mods/warding/rules/handle_draw_salt_boundary.rule.json`
5. `data/mods/item-transfer/rules/handle_give_item.rule.json`
6. `data/mods/caressing/rules/adjust_clothing.rule.json`
7. `data/mods/companionship/rules/dismiss.rule.json`
8. `data/mods/companionship/rules/stop_following.rule.json`
9. `data/mods/distress/rules/clutch_onto_upper_clothing.rule.json`
10. `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json`
11. `data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json`

### Priority 2 - HIGH (8 files)
12. `data/mods/positioning/rules/bend_over.rule.json`
13. `data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json`
14. `data/mods/movement/rules/go.rule.json`
15. `data/mods/movement/rules/handle_teleport.rule.json`
16. `data/mods/warding/rules/handle_cross_salt_boundary.rule.json`
17. `data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json`
18. `data/mods/core/rules/entity_speech.rule.json`
19. `data/mods/core/rules/entity_thought.rule.json`

### Priority 3 - MODERATE (14 files)
20. `data/mods/items/rules/handle_drink_entirely.rule.json`
21. `data/mods/items/rules/handle_read_item.rule.json`
22. `data/mods/writing/rules/handle_jot_down_notes.rule.json`
23. `data/mods/writing/rules/handle_sign_document.rule.json`
24. `data/mods/locks/rules/handle_lock_connection.rule.json`
25. `data/mods/locks/rules/handle_unlock_connection.rule.json`
26. `data/mods/observation/rules/handle_examine_item_in_location.rule.json`
27. `data/mods/observation/rules/handle_examine_owned_item.rule.json`
28. `data/mods/containers/rules/handle_open_container.rule.json`
29. `data/mods/containers/rules/handle_put_in_container.rule.json`
30. `data/mods/containers/rules/handle_take_from_container.rule.json`
31. `data/mods/item-handling/rules/handle_pick_up_item.rule.json`
32. `data/mods/item-placement/rules/handle_put_on_nearby_surface.rule.json`
33. `data/mods/item-placement/rules/handle_take_from_nearby_surface.rule.json`

### Already Complete (2 files - REFERENCE)
34. `data/mods/items/rules/handle_drink_from.rule.json`
35. `data/mods/hexing/rules/handle_corrupting_gaze.rule.json`
