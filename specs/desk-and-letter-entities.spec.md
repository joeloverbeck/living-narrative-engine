# Desk and Unfinished Letter Entity Specification

**Version:** 1.0
**Date:** 2025-10-13
**Author:** System Design
**Status:** Ready for Implementation

## Executive Summary

This specification defines two entities for testing the container system in the Living Narrative Engine: a desk in Alicia Western's room at Stella Maris sanatorium and an unfinished goodbye letter to her brother Bobby. These entities test the open_container, put_in_container, and take_from_container actions within the narrative context of December 22, 1972.

## Context & Background

### Narrative Context
- **Setting:** Stella Maris sanatorium, Wisconsin, December 22, 1972
- **Character:** Alicia Western (22 years old, patient)
- **Situation:** Two days before planned suicide on December 24
- **Emotional State:** Profound grief over brother Bobby's coma, unable to finish goodbye letter
- **Character Note (line 131-135):** "Earlier today, I wrote part of a goodbye letter to Bobby, but I could not finish it. I've put it inside the desk."

### Technical Context
This implementation tests the items mod's container system, which consists of:
- **Actions:** open_container, put_in_container, take_from_container
- **Rules:** handle_open_container, handle_put_in_container, handle_take_from_container
- **Components:** items:container, items:openable, items:item, items:readable, items:portable, items:weight

## Container System Analysis

### Action Definitions

#### open_container.action.json
```json
{
  "id": "items:open_container",
  "targets": {
    "primary": {
      "scope": "items:openable_containers_at_location",
      "placeholder": "container"
    }
  },
  "template": "Open {primary.name}"
}
```

**Key Points:**
- Uses scope query to find openable containers at actor's location
- Single target: the container to open
- No required components on actor

#### put_in_container.action.json
```json
{
  "id": "items:put_in_container",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:open_containers_at_location",
      "placeholder": "container"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item"
    }
  },
  "template": "put {secondary.name} in {primary.name}"
}
```

**Key Points:**
- Requires actor to have items:inventory component
- Primary target: open containers only (not closed ones)
- Secondary target: items in actor's inventory
- Generates all valid combinations

#### take_from_container.action.json
```json
{
  "id": "items:take_from_container",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "items:openable_containers_at_location",
      "placeholder": "container"
    },
    "secondary": {
      "scope": "items:container_contents",
      "placeholder": "item",
      "contextFrom": "primary"
    }
  },
  "template": "take {secondary.name} from {primary.name}"
}
```

**Key Points:**
- Primary target: openable containers (must be open to see contents)
- Secondary target: items inside the specific container (contextFrom: primary)
- Generates all valid combinations

### Rule Processing

#### handle_open_container.rule.json
**Event:** `core:attempt_action` with condition `items:event-is-action-open-container`

**Operation Flow:**
1. `OPEN_CONTAINER` operation with key validation
   - Parameters: actorEntity, containerEntity
   - Returns: openResult with success/error
2. Branch on success:
   - **Success:** Dispatch `container_opened` perceptible event → END_TURN (success: true)
   - **Failure (missing_key):** Dispatch `container_open_failed` → END_TURN (success: false, error: "locked")
   - **Failure (other):** END_TURN (success: false, error: openResult.error)

**Key Validations:**
- Container must have `items:openable` component
- If `requiresKey: true`, actor must have keyItemId in inventory
- Container must not already be open

#### handle_put_in_container.rule.json
**Event:** `core:attempt_action` with condition `items:event-is-action-put-in-container`

**Operation Flow:**
1. `VALIDATE_CONTAINER_CAPACITY` operation
   - Parameters: containerEntity, itemEntity
   - Returns: capacityCheck with valid/reason
2. Branch on capacity valid:
   - **Valid:** `PUT_IN_CONTAINER` operation → Dispatch `item_put_in_container` → END_TURN (success: true)
   - **Invalid:** Dispatch `put_in_container_failed` → END_TURN (success: false)

**Key Validations:**
- Container capacity (maxWeight, maxItems) not exceeded
- Item must be in actor's inventory
- Container must be open

#### handle_take_from_container.rule.json
**Event:** `core:attempt_action` with condition `items:event-is-action-take-from-container`

**Operation Flow:**
1. `VALIDATE_INVENTORY_CAPACITY` operation
   - Parameters: targetEntity (actor), itemEntity
   - Returns: capacityCheck with valid/reason
2. Branch on capacity valid:
   - **Valid:** `TAKE_FROM_CONTAINER` operation → Dispatch `item_taken_from_container` → END_TURN (success: true)
   - **Invalid:** Dispatch `take_from_container_failed` → END_TURN (success: false)

**Key Validations:**
- Actor can carry the item (inventory capacity)
- Item must be in container's contents
- Container must be open (enforced by action scope)

### Component Schemas

#### items:container
```json
{
  "contents": ["entity_id_1", "entity_id_2"],
  "capacity": {
    "maxWeight": 50.0,
    "maxItems": 10
  },
  "isOpen": false,
  "requiresKey": false,
  "keyItemId": "items:brass_key"
}
```

**Required Fields:** contents, capacity, isOpen
**Optional Fields:** requiresKey, keyItemId (only if requiresKey is true)

#### items:openable
```json
{}
```
**Type:** Marker component (empty object)
**Purpose:** Identifies entities that can be opened/closed

#### items:item
```json
{}
```
**Type:** Marker component (empty object)
**Purpose:** Identifies entities as items recognized by item-related systems

#### items:readable
```json
{
  "text": "The readable text content"
}
```
**Required Fields:** text (minLength: 1)

#### items:portable
```json
{}
```
**Type:** Marker component (empty object)
**Purpose:** Identifies items that can be picked up and carried

#### items:weight
```json
{
  "weight": 0.05
}
```
**Required Fields:** weight (number, typically in kilograms)

## Entity Definitions

### 1. Alicia Western's Desk

**Entity ID:** `p_erotica:alicia_western_desk`
**Type:** Container (furniture, not portable)
**Location:** Alicia's patient room, Stella Maris sanatorium
**Status:** Initially closed, contains one item

#### Component Structure

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "p_erotica:alicia_western_desk",
  "description": "Simple wooden desk in Alicia Western's patient room at Stella Maris",
  "components": {
    "core:name": {
      "text": "Wooden Desk"
    },
    "core:description": {
      "text": "A simple wooden desk with a worn finish, the kind found in every patient room at Stella Maris. One drawer pulls out stiffly, its brass handle tarnished with age. The surface shows ring marks from years of water glasses and coffee cups. It's the sort of institutional furniture that has witnessed countless private moments—letters written, journals kept, decisions made in solitude."
    },
    "items:item": {},
    "items:openable": {},
    "items:container": {
      "contents": ["p_erotica:unfinished_goodbye_letter_instance"],
      "capacity": {
        "maxWeight": 15.0,
        "maxItems": 8
      },
      "isOpen": false,
      "requiresKey": false
    }
  }
}
```

#### Design Rationale

**Period Authenticity (1970):**
- Institutional furniture typical of mental health facilities
- Worn, utilitarian aesthetic
- No decorative flourishes
- Brass hardware showing age

**Narrative Integration:**
- Desk as witness to "private moments" (echoes Alicia's isolation)
- "Countless...decisions made in solitude" (foreshadows her suicide plan)
- Ring marks from water glasses (mundane detail grounding the setting)
- Drawer "pulls out stiffly" (physical resistance mirrors emotional difficulty)

**Capacity Settings:**
- maxWeight: 15kg (reasonable for desk drawer, can hold books, papers, personal items)
- maxItems: 8 (prevents excessive clutter, maintains realism)

**Container Configuration:**
- isOpen: false (letter is hidden, must be discovered)
- requiresKey: false (patient has access to their own desk)
- contents: Initially contains only the unfinished letter

### 2. Unfinished Goodbye Letter

**Entity ID:** `p_erotica:unfinished_goodbye_letter_instance`
**Type:** Readable item (letter/document)
**Initial Location:** Inside desk's contents array
**Purpose:** Testing take_from_container and readable item interaction

#### Component Structure

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "p_erotica:unfinished_goodbye_letter_instance",
  "description": "Unfinished goodbye letter from Alicia to Bobby, December 22, 1972",
  "components": {
    "core:name": {
      "text": "Unfinished Letter"
    },
    "core:description": {
      "text": "Two sheets of lined paper covered in Alicia's precise handwriting. The ink is slightly smudged in places—water damage, or maybe tears. The letter stops mid-sentence, as if she couldn't bear to continue."
    },
    "items:item": {},
    "items:readable": {
      "text": "December 22, 1972\n\nBobby,\n\nI keep trying to write this letter and every time I start, the words feel inadequate. How do you explain to someone in a coma why you've decided to stop existing? You can't hear me anyway. Maybe that's why I can finally try to say it.\n\nI went to the lake first. Lake Tahoe. I lasted six minutes in the water before my body betrayed me and forced me to surface. Disappointing, really. The survival instinct is stronger than I calculated.\n\nYou're in Italy right now. In a hospital bed. The doctors said you're braindead. They asked me to decide—to pull the plug. I couldn't do it, Bobby. I ran. I fled back here to Wisconsin and checked myself into this place because I didn't know where else to go.\n\nStella Maris. That's what they call it. Star of the Sea. Ironic, since we're nowhere near an ocean. Just snow and pine trees and this terrible, endless quiet.\n\nI should tell you that I understand now why you ran after every hard thing. Why you isolated yourself when you couldn't fix something. I see it clearly—the pattern. If I die while you're in that coma, you'll wake up (if you wake up) and spend the rest of your life believing you should have prevented it somehow. That's what you do. You take on responsibility for things that aren't yours to carry.\n\nBut I can't—\n\n[The letter ends here, mid-sentence. The rest of the page is blank.]"
    },
    "items:portable": {},
    "items:weight": {
      "weight": 0.02
    }
  }
}
```

#### Design Rationale

**Letter Content:**
- **Opening:** Acknowledges the absurdity of writing to someone in a coma (meta-awareness)
- **Lake Tahoe Reference:** Direct callback to Alicia's notes (line 161-162 in character file)
- **Italy/Coma:** Consistent with notes about Bobby's crash (lines 155-159)
- **Stella Maris Location:** Matches character context (line 167-170)
- **Pattern Recognition:** Demonstrates Alicia's analytical mind ("I see it clearly—the pattern")
- **Emotional Breakdown:** Letter stops mid-sentence when emotions overwhelm intellect
- **Bobby's Coping:** References notes about Bobby's patterns (lines 191-195)

**Stylistic Elements:**
- **Clinical Precision:** "I lasted six minutes" (exact measurement)
- **Self-Analysis:** "my body betrayed me" (dissociation from physical self)
- **Dark Humor:** "Disappointing, really" (Alicia's characteristic detachment)
- **Mathematical Framing:** "stronger than I calculated" (everything becomes data)
- **Parenthetical Doubt:** "(if you wake up)" (acknowledges uncertainty)
- **Incomplete Thought:** Letter ends at "I can't—" (unable to articulate)

**Physical Details:**
- **Water Damage/Tears:** Ambiguity mirrors emotional state
- **Precise Handwriting:** Reflects Alicia's controlled personality
- **Stops Mid-Sentence:** Visual representation of emotional breakdown
- **Lined Paper:** Institutional, not personal stationery
- **December 22, 1972:** Two days before planned suicide (December 24)

**Weight & Portability:**
- weight: 0.02kg (two sheets of paper, realistic)
- portable: true (can be picked up, moved, hidden)

## Testing Scenarios

### Scenario 1: Initial Discovery
**Preconditions:**
- Desk is in location (same as actor)
- Desk container.isOpen = false
- Letter is in desk contents array
- Actor has items:inventory component

**Test Steps:**
1. Attempt to take letter from closed desk → Should fail (container not open)
2. Open desk → Should succeed (no key required)
3. Verify desk container.isOpen = true
4. Take letter from open desk → Should succeed
5. Verify letter is now in actor's inventory
6. Verify letter is removed from desk contents

**Expected Perceptible Events:**
- "Alicia Western opened Wooden Desk." (container_opened)
- "Alicia Western took Unfinished Letter from Wooden Desk." (item_taken_from_container)

### Scenario 2: Putting Letter Back
**Preconditions:**
- Desk is open
- Letter is in actor's inventory
- Desk has capacity for letter

**Test Steps:**
1. Put letter in desk → Should succeed
2. Verify letter is in desk contents
3. Verify letter is removed from actor's inventory

**Expected Perceptible Events:**
- "Alicia Western put Unfinished Letter in Wooden Desk." (item_put_in_container)

### Scenario 3: Closing and Reopening
**Preconditions:**
- Desk is open
- Letter is in desk

**Test Steps:**
1. Close desk (if close_container action exists)
2. Verify desk container.isOpen = false
3. Reopen desk → Should succeed
4. Verify desk container.isOpen = true

**Expected Perceptible Events:**
- "Alicia Western opened Wooden Desk." (container_opened)

### Scenario 4: Capacity Validation (Edge Case)
**Preconditions:**
- Desk is open
- Desk is at or near capacity

**Test Steps:**
1. Attempt to put item exceeding weight capacity → Should fail
2. Attempt to put item when maxItems reached → Should fail

**Expected Perceptible Events:**
- "Alicia Western tried to put [item] in Wooden Desk, but it won't fit." (put_in_container_failed)

### Scenario 5: Reading the Letter
**Preconditions:**
- Letter is in actor's inventory or observable location
- Actor attempts to read

**Test Steps:**
1. Read letter → Should succeed
2. Verify letter.readable.text is displayed to actor
3. Verify perceptible event logged

**Expected Behavior:**
- Full letter text displayed
- Emotional narrative context conveyed
- Demonstrates items:readable component functionality

## Implementation Steps

### Step 1: Create Desk Entity Definition
**File:** `.private/data/mods/p_erotica/entities/definitions/alicia_western_desk.entity.json`

**Tasks:**
1. Create entity definition with proper schema reference
2. Add all required components (name, description, item, openable, container)
3. Set container.isOpen to false
4. Set container.requiresKey to false
5. Add letter instance ID to container.contents array
6. Set realistic capacity values (maxWeight: 15, maxItems: 8)

**Validation:**
- Verify JSON schema compliance
- Check component references are valid
- Confirm namespace uses `p_erotica:` prefix

### Step 2: Create Letter Entity Instance
**File:** `.private/data/mods/p_erotica/entities/instances/unfinished_goodbye_letter.json`

**Tasks:**
1. Create entity definition with proper schema reference
2. Add all required components (name, description, item, readable, portable, weight)
3. Write letter text with narrative consistency
4. Set weight to realistic value (0.02kg)
5. Ensure description mentions visual details

**Validation:**
- Verify JSON schema compliance
- Check letter text for narrative consistency with character file
- Confirm emotional tone matches Alicia's character
- Validate date reference (December 22, 1972)

### Step 3: Integration Testing
**Manual Test Script:**
1. Load game with p_erotica mod enabled
2. Ensure Alicia Western is in same location as desk
3. Verify desk appears in available actions for open_container
4. Execute open_container action on desk
5. Verify take_from_container action appears with letter as option
6. Execute take_from_container action
7. Verify letter is in inventory
8. Attempt to read letter (if read_item action exists)
9. Execute put_in_container action to return letter
10. Close desk (if possible)
11. Verify take_from_container no longer available when desk closed

**Automated Test Considerations:**
- Create integration test in `tests/integration/mods/items/`
- Test container open/close state transitions
- Test item movement between container and inventory
- Test capacity validation with multiple items
- Test error cases (closed container, missing key, capacity exceeded)

## Technical Considerations

### Namespace Consistency
- Both entities use `p_erotica:` namespace
- Letter instance ID: `p_erotica:unfinished_goodbye_letter_instance`
- Desk entity ID: `p_erotica:alicia_western_desk`
- Consistent with mod structure in `.private/data/mods/p_erotica/`

### Component Dependencies
**Desk Requirements:**
- Must have both `items:openable` and `items:container` for open_container action
- Must have `items:item` to be recognized by item systems
- Does NOT need `items:portable` (desk is furniture, not carried)
- Does NOT need `items:weight` (not portable)

**Letter Requirements:**
- Must have `items:item` to be recognized as an item
- Must have `items:readable` for read_item action
- Must have `items:portable` to be picked up
- Must have `items:weight` for capacity calculations

### Scope Query Compatibility
**items:openable_containers_at_location:**
- Queries for entities with both items:openable AND items:container
- Filters by actor's current location
- Used by: open_container, take_from_container actions

**items:open_containers_at_location:**
- Queries for entities with items:container where isOpen = true
- Filters by actor's current location
- Used by: put_in_container action

**items:container_contents:**
- Queries for entities in container's contents array
- Uses contextFrom: primary to specify which container
- Used by: take_from_container action

**items:actor_inventory_items:**
- Queries for entities in actor's inventory
- Used by: put_in_container action

### Error Handling
**Container System:**
- Open closed container → Success (if no key required)
- Open locked container without key → Fail ("locked and you don't have the key")
- Take from closed container → Action not available (scope filters)
- Put in closed container → Action not available (scope filters)
- Exceed capacity → Fail ("won't fit")
- Exceed inventory weight → Fail ("can't carry it")

**Readable System:**
- Read item without items:readable → Fail (component missing)
- Read item with empty text → Should be prevented by schema validation (minLength: 1)

## Future Considerations

### Potential Extensions
1. **close_container action:** Currently no close action defined; would complete the open/close cycle
2. **lock_container action:** Allow re-locking containers (if key system implemented)
3. **destroy_item action:** Allow letter to be torn up or destroyed (narrative choice)
4. **annotate_letter action:** Add notes or corrections to letter text
5. **Character Reaction System:** NPCs react to seeing Alicia reading the letter
6. **Quest Integration:** Letter reading triggers quest events or character development

### Narrative Extensions
1. **Multiple Draft Letters:** Several unfinished versions showing Alicia's attempts
2. **Hidden Compartment:** Secret drawer in desk requiring special action
3. **Key Mechanic:** Future locked items in desk (diary, medication)
4. **Environmental Storytelling:** Other items in desk revealing character history
5. **Temporal Progression:** Letter changes if game advances past December 24

### Performance Considerations
- **Entity Limit:** If desk contains many items, scope queries may be slow
- **Letter Text Length:** Current letter is ~1,500 characters; consider truncation for UI display
- **Perceptible Event Spam:** Multiple container operations generate many events; monitor performance
- **Component Query Caching:** Consider caching openable_containers_at_location results

## Validation Checklist

### Desk Entity
- [ ] JSON schema validated
- [ ] Namespace prefix correct (`p_erotica:`)
- [ ] All required components present
- [ ] Description evokes 1970 sanatorium atmosphere
- [ ] Container capacity realistic
- [ ] isOpen set to false
- [ ] requiresKey set to false (or omitted)
- [ ] contents array includes letter instance ID

### Letter Entity
- [ ] JSON schema validated
- [ ] Namespace prefix correct (`p_erotica:`)
- [ ] All required components present
- [ ] Letter text narratively consistent with character
- [ ] Date reference accurate (December 22, 1972)
- [ ] Emotional tone matches Alicia's profile
- [ ] Letter ends mid-sentence as specified
- [ ] Weight realistic (0.02kg)
- [ ] Visual description mentions physical details

### Integration Testing
- [ ] Desk discoverable at location
- [ ] Open action available for closed desk
- [ ] Open action succeeds without key
- [ ] Take action available after opening
- [ ] Take action moves letter to inventory
- [ ] Put action returns letter to desk
- [ ] Letter text readable from inventory
- [ ] Perceptible events logged correctly
- [ ] Capacity validation prevents overflow

## References

### Project Files
- `/data/mods/items/actions/open_container.action.json`
- `/data/mods/items/actions/put_in_container.action.json`
- `/data/mods/items/actions/take_from_container.action.json`
- `/data/mods/items/rules/handle_open_container.rule.json`
- `/data/mods/items/rules/handle_put_in_container.rule.json`
- `/data/mods/items/rules/handle_take_from_container.rule.json`
- `/data/mods/items/components/container.component.json`
- `/data/mods/items/components/openable.component.json`
- `/data/mods/items/components/readable.component.json`
- `/data/mods/items/entities/definitions/treasure_chest.entity.json` (reference example)
- `/data/mods/items/entities/definitions/letter_to_sheriff.entity.json` (reference example)
- `/.private/data/mods/p_erotica/entities/definitions/alicia_western.character.json`

### Character Context
- Alicia Western profile (lines 13-195)
- December 22, 1972 note (lines 125-135)
- Lake Tahoe suicide attempt (lines 161-165)
- Bobby's coma context (lines 107-110, 155-159, 178-195)
- Stella Maris sanatorium (lines 167-177)

---

**End of Specification**
