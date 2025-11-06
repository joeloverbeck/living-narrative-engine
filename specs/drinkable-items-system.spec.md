# Drinkable Items System Specification

## Overview

This specification defines a system for drinkable items in the Living Narrative Engine. The system enables actors to consume liquids from containers through two distinct actions: drinking a single serving or consuming the entire contents.

### Design Philosophy

- **Modular Components**: Separate `drinkable` (marker) and `liquid_container` (data) components for maximum flexibility
- **Realistic Consumption**: Volume-based tracking with serving sizes and capacity limits
- **Flexible Actions**: Support both measured drinking (one serving) and complete consumption
- **Deferred Complexity**: Rule implementations intentionally deferred due to validation complexity

### Why Items Mod?

This feature belongs in the `items` mod because:
- Drinkable items are portable/examinable objects
- Reuses existing item infrastructure (scopes, component patterns)
- Complements existing item interaction actions (read, examine, transfer)

---

## Component Requirements

### 1. Drinkable Component (Marker)

**File**: `data/mods/items/components/drinkable.component.json`

**Purpose**: Pure marker component indicating an entity can be consumed as a drink.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:drinkable",
  "description": "Marker component indicating an entity can be consumed as a drink by actors.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Design Rationale**:
- No data properties - purely semantic marker
- Separation of concerns: "can be drunk" (drinkable) vs "holds liquid" (liquid_container)
- Enables future non-drinkable liquid containers (vases, aquariums, etc.)

**Example Usage**:
```json
{
  "id": "waterskin_001",
  "components": {
    "items:drinkable": {},
    "items:liquid_container": {
      "currentVolumeMilliliters": 500,
      "maxCapacityMilliliters": 1000,
      "servingSizeMilliliters": 250,
      "isRefillable": true,
      "flavorText": "Cool, refreshing water quenches your thirst."
    }
  }
}
```

---

### 2. Liquid Container Component (Data)

**File**: `data/mods/items/components/liquid_container.component.json`

**Purpose**: Tracks volume, capacity, and consumption properties of liquid-holding containers.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:liquid_container",
  "description": "Defines volume tracking and consumption properties for containers that hold liquids.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "currentVolumeMilliliters": {
        "type": "number",
        "minimum": 0,
        "description": "Current volume of liquid in the container (in milliliters)."
      },
      "maxCapacityMilliliters": {
        "type": "number",
        "exclusiveMinimum": 0,
        "description": "Maximum capacity of the container (in milliliters)."
      },
      "servingSizeMilliliters": {
        "type": "number",
        "exclusiveMinimum": 0,
        "description": "Standard serving size when drinking from container (in milliliters)."
      },
      "isRefillable": {
        "type": "boolean",
        "description": "Whether the container can be refilled after being emptied."
      },
      "flavorText": {
        "type": "string",
        "minLength": 1,
        "description": "Descriptive text displayed to actors when consuming from this container."
      }
    },
    "required": [
      "currentVolumeMilliliters",
      "maxCapacityMilliliters",
      "servingSizeMilliliters",
      "isRefillable",
      "flavorText"
    ],
    "additionalProperties": false
  }
}
```

**Design Rationale**:

1. **Volume Tracking**:
   - `currentVolumeMilliliters` can be 0 (empty container still exists)
   - `maxCapacityMilliliters` must be >0 (containers have physical limits)
   - Milliliters chosen for precision and international standard

2. **Serving Size**:
   - Defines amount consumed in `drink_from` action
   - Must be >0 (can't have zero-volume servings)
   - Enables realistic portion control (sip vs gulp)

3. **Refillability**:
   - Boolean flag for future refill mechanics
   - One-use containers (potion vials) vs reusable (waterskins)
   - Simple flag defers complex liquid type matching

4. **Flavor Text**:
   - Required for rich narrative feedback
   - Rules will incorporate this into action messages
   - Allows per-container customization (water vs wine vs poison)

**Property Constraints**:
- `currentVolumeMilliliters` ≤ `maxCapacityMilliliters` (enforced by rules)
- `servingSizeMilliliters` ≤ `maxCapacityMilliliters` (logical but not schema-enforced)

**Example Variations**:
```json
// Refillable waterskin
{
  "currentVolumeMilliliters": 750,
  "maxCapacityMilliliters": 1000,
  "servingSizeMilliliters": 250,
  "isRefillable": true,
  "flavorText": "Cool, refreshing water quenches your thirst."
}

// One-use healing potion
{
  "currentVolumeMilliliters": 50,
  "maxCapacityMilliliters": 50,
  "servingSizeMilliliters": 50,
  "isRefillable": false,
  "flavorText": "The magical elixir tingles as it flows down your throat, knitting your wounds."
}

// Wine goblet (small servings)
{
  "currentVolumeMilliliters": 200,
  "maxCapacityMilliliters": 300,
  "servingSizeMilliliters": 100,
  "isRefillable": true,
  "flavorText": "Rich, full-bodied wine with hints of oak and berries."
}
```

---

## Action Requirements

### 1. Drink From Action (Single Serving)

**File**: `data/mods/items/actions/drink_from.action.json`

**Purpose**: Consume one serving from a drinkable liquid container.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:drink_from",
  "name": "Drink From",
  "description": "Take a single serving from a drinkable container, reducing its volume by the serving size.",
  "targets": {
    "primary": {
      "scope": "items:examinable_items",
      "placeholder": "primary",
      "description": "Drinkable container to consume from"
    }
  },
  "required_components": {
    "primary": [
      "items:drinkable",
      "items:liquid_container"
    ]
  },
  "prerequisites": [],
  "template": "drink from {primary}"
}
```

**Key Design Decisions**:

1. **Scope Choice**: `items:examinable_items`
   - Reuses existing scope: `items:actor_inventory_items | items:items_at_location | items:non_portable_items_at_location`
   - Allows drinking from inventory (waterskin) or location (fountain)
   - No need for custom scope

2. **Required Components**:
   - **Both** `items:drinkable` AND `items:liquid_container` required
   - Filters out non-drinkable containers
   - Ensures volume tracking data exists

3. **Template**: `"drink from {primary}"`
   - Natural language: "drink from waterskin"
   - Placeholder matches target key

4. **Prerequisites**: Empty array
   - No upfront conditions (e.g., actor thirst, consciousness)
   - Rule will handle runtime validation (volume check)

**Scope Behavior**:
- Actor has waterskin in inventory → Action available
- Fountain at current location → Action available
- Empty container in inventory → Action available (rule will handle "empty" message)
- Container in different location → Action NOT available

**Rule Responsibilities** (Deferred):
- Validate `currentVolumeMilliliters > 0`
- Calculate consumption: `min(servingSizeMilliliters, currentVolumeMilliliters)`
- Update component data: `currentVolumeMilliliters -= consumed`
- Dispatch message with `flavorText`
- Remove container if empty AND not refillable
- End turn

---

### 2. Drink Entirely Action (Complete Consumption)

**File**: `data/mods/items/actions/drink_entirely.action.json`

**Purpose**: Consume all remaining liquid from a drinkable container in one action.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:drink_entirely",
  "name": "Drink Entirely",
  "description": "Consume all remaining liquid from a drinkable container, emptying it completely.",
  "targets": {
    "primary": {
      "scope": "items:examinable_items",
      "placeholder": "primary",
      "description": "Drinkable container to empty completely"
    }
  },
  "required_components": {
    "primary": [
      "items:drinkable",
      "items:liquid_container"
    ]
  },
  "prerequisites": [],
  "template": "drink entirety of {primary}"
}
```

**Key Design Decisions**:

1. **Flexible Consumption**:
   - Drinks ALL remaining volume, regardless of `servingSizeMilliliters`
   - 1ml left? Drinks 1ml. 1000ml left? Drinks 1000ml.
   - Realistic but may have gameplay implications (chugging large volumes)

2. **Identical Scope & Components**:
   - Same as `drink_from` for consistency
   - Allows both actions on same targets
   - Player chooses consumption style

3. **Template**: `"drink entirety of {primary}"`
   - Grammatically clear intent
   - Distinguishes from partial consumption

4. **Distinct from "Drink From"**:
   - `drink_from` = measured, repeatable (sipping)
   - `drink_entirely` = complete, immediate (chugging)
   - Both actions coexist in action discovery

**Rule Responsibilities** (Deferred):
- Validate `currentVolumeMilliliters > 0`
- Consume entire volume: `consumed = currentVolumeMilliliters`
- Set `currentVolumeMilliliters = 0`
- Dispatch message with `flavorText` and volume consumed
- Remove container if not refillable
- End turn

**Gameplay Implications**:
- Faster but less controlled than multiple `drink_from` actions
- Risk/reward: quick healing potion vs careful wine tasting
- May want future stamina/capacity limits (not in scope)

---

## Rule Requirements (Deferred)

**Note**: Rule implementations are **intentionally deferred** due to their complexity. Future implementation will require:

### drink_from.rule.json Handler Considerations:
- **Volume Validation**: Check `currentVolumeMilliliters > 0`, fail gracefully if empty
- **Consumption Logic**: `consumed = min(servingSizeMilliliters, currentVolumeMilliliters)`
- **Component Mutation**: Update `items:liquid_container.currentVolumeMilliliters`
- **Container Management**: Remove entity if empty AND `isRefillable === false`
- **Message Generation**: Combine `flavorText` with volume consumed ("You drink 250ml. Cool, refreshing water...")
- **Event Dispatching**: Emit consumption event for potential effects (future hydration system)
- **Turn Management**: End turn after successful consumption

### drink_entirely.rule.json Handler Considerations:
- **Volume Validation**: Check `currentVolumeMilliliters > 0`
- **Complete Consumption**: `consumed = currentVolumeMilliliters`, then set to 0
- **Container Management**: Same removal logic as drink_from
- **Message Variation**: Emphasize complete consumption ("You gulp down the remaining 750ml...")
- **Potential Warnings**: Large volumes might trigger future stamina checks

### Shared Rule Patterns:
- Use `ComponentMutationService` for data updates
- Dispatch `ENTITY_COMPONENTS_MUTATED` event
- Follow existing item interaction patterns (read_item, examine_item)
- Leverage `flavorText` for narrative richness

---

## Testing Specification

### 1. Action Discovery Tests

**File**: `tests/integration/mods/items/drinkableItemsActionDiscovery.test.js`

**Purpose**: Verify actions appear in correct scenarios and filter properly.

**Required Test Suites**:

```javascript
describe('Drink From Action Discovery', () => {
  describe('Availability Conditions', () => {
    it('should discover drink_from when drinkable container in inventory');
    it('should discover drink_from when drinkable container at location');
    it('should discover drink_from for non-portable drinkable at location');
    it('should NOT discover when container lacks drinkable component');
    it('should NOT discover when container lacks liquid_container component');
    it('should NOT discover when container in different location');
  });

  describe('Edge Cases', () => {
    it('should discover action even if container is empty (rule handles this)');
    it('should discover for multiple drinkable containers simultaneously');
  });
});

describe('Drink Entirely Action Discovery', () => {
  // Similar test structure as drink_from
  describe('Availability Conditions', () => {
    it('should discover drink_entirely when drinkable container in inventory');
    it('should discover drink_entirely when drinkable container at location');
    // ... same component filtering tests
  });

  describe('Coexistence with Drink From', () => {
    it('should discover BOTH actions for same drinkable container');
    it('should allow player to choose consumption style');
  });
});
```

**Implementation Notes**:
- Use `ModTestFixture.forAction()` pattern
- Create test entities with both components
- Verify action appears in discovery results
- Test component filtering thoroughly

---

### 2. Rule Execution Tests (Deferred)

**Files**:
- `tests/integration/mods/items/drinkFromRuleExecution.test.js`
- `tests/integration/mods/items/drinkEntirelyRuleExecution.test.js`

**Purpose**: Verify rules correctly handle consumption, mutation, and edge cases.

**Required Test Cases** (Specification Only):

```javascript
// drinkFromRuleExecution.test.js
describe('Drink From Rule Execution', () => {
  describe('Successful Consumption', () => {
    it('should reduce volume by serving size when sufficient liquid');
    it('should reduce volume by remaining amount when less than serving');
    it('should include flavorText in success message');
    it('should dispatch ENTITY_COMPONENTS_MUTATED event');
    it('should end turn after successful drink');
  });

  describe('Container Management', () => {
    it('should preserve container when volume reaches 0 but isRefillable=true');
    it('should remove container when volume reaches 0 and isRefillable=false');
    it('should maintain container with partial volume remaining');
  });

  describe('Error Handling', () => {
    it('should fail gracefully when container is already empty');
    it('should provide helpful message when no liquid remains');
  });

  describe('Component Mutations', () => {
    it('should correctly update currentVolumeMilliliters in component data');
    it('should not modify other component properties');
  });
});

// drinkEntirelyRuleExecution.test.js
describe('Drink Entirely Rule Execution', () => {
  describe('Complete Consumption', () => {
    it('should consume all remaining volume regardless of serving size');
    it('should set currentVolumeMilliliters to 0 after drinking');
    it('should include volume consumed in message (e.g., "750ml")');
    it('should dispatch ENTITY_COMPONENTS_MUTATED event');
  });

  describe('Container Management', () => {
    it('should preserve container when isRefillable=true');
    it('should remove container when isRefillable=false');
  });

  describe('Edge Cases', () => {
    it('should handle very small volumes (1ml) correctly');
    it('should handle very large volumes (2000ml) correctly');
    it('should fail gracefully on already-empty container');
  });
});
```

**Testing Patterns**:
- Follow existing item interaction test patterns (read_item, examine_item tests)
- Use domain matchers from `tests/common/mods/domainMatchers.js`
- Create scenario fixtures for common setups (actor with waterskin, etc.)
- Verify both success messages and component state changes
- Test boundary conditions (empty, full, partial)

---

## Manifest & Documentation Updates

### mod-manifest.json Updates

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "components": [
    // ... existing components ...
    "components/drinkable.component.json",
    "components/liquid_container.component.json"
  ],
  "actions": [
    // ... existing actions ...
    "actions/drink_from.action.json",
    "actions/drink_entirely.action.json"
  ]
  // Note: Rules will be added in future when implemented
}
```

### Documentation Files

No additional documentation files required. This specification serves as the primary reference.

---

## Modder Usage Examples

### Example 1: Simple Water Container

```json
{
  "id": "waterskin_tavern",
  "components": {
    "items:item": {},
    "items:portable": {},
    "items:drinkable": {},
    "items:liquid_container": {
      "currentVolumeMilliliters": 1000,
      "maxCapacityMilliliters": 1000,
      "servingSizeMilliliters": 250,
      "isRefillable": true,
      "flavorText": "Cool, refreshing water quenches your thirst."
    },
    "core:identifiable": {
      "name": "Leather Waterskin",
      "description": "A well-worn leather waterskin, full of water."
    }
  }
}
```

**Player Experience**:
- "drink from Leather Waterskin" → Drinks 250ml (750ml remains)
- "drink from Leather Waterskin" → Drinks 250ml (500ml remains)
- "drink entirely of Leather Waterskin" → Drinks 500ml (0ml remains, container preserved)

---

### Example 2: One-Use Healing Potion

```json
{
  "id": "healing_potion_minor",
  "components": {
    "items:item": {},
    "items:portable": {},
    "items:drinkable": {},
    "items:liquid_container": {
      "currentVolumeMilliliters": 50,
      "maxCapacityMilliliters": 50,
      "servingSizeMilliliters": 50,
      "isRefillable": false,
      "flavorText": "The magical elixir tingles as it flows down your throat, knitting your wounds."
    },
    "core:identifiable": {
      "name": "Minor Healing Potion",
      "description": "A small vial of glowing red liquid."
    }
  }
}
```

**Player Experience**:
- "drink from Minor Healing Potion" → Drinks 50ml, container removed (not refillable)
- "drink entirely of Minor Healing Potion" → Drinks 50ml, container removed (equivalent for single-serving)

---

### Example 3: Non-Portable Fountain

```json
{
  "id": "town_square_fountain",
  "components": {
    "items:item": {},
    "items:drinkable": {},
    "items:liquid_container": {
      "currentVolumeMilliliters": 999999,
      "maxCapacityMilliliters": 999999,
      "servingSizeMilliliters": 250,
      "isRefillable": true,
      "flavorText": "Fresh spring water from the fountain, cool and pure."
    },
    "core:identifiable": {
      "name": "Stone Fountain",
      "description": "A grand fountain in the town square, water flowing freely."
    },
    "positioning:positioned": {
      "location": "town_square"
    }
  }
}
```

**Player Experience**:
- At town square: "drink from Stone Fountain" → Drinks 250ml (effectively infinite water)
- Cannot use "drink entirely" practically (would drink 999,999ml!)

---

## Acceptance Criteria

### Component Definitions
- [ ] `items:drinkable` component defined as pure marker (no data properties)
- [ ] `items:liquid_container` component defined with all 5 required properties
- [ ] Both components follow existing schema patterns
- [ ] Component IDs use proper namespace format (`items:identifier`)

### Action Definitions
- [ ] `items:drink_from` action defined with correct scope and template
- [ ] `items:drink_entirely` action defined with correct scope and template
- [ ] Both actions require both `items:drinkable` AND `items:liquid_container` components
- [ ] Both actions use `items:examinable_items` scope
- [ ] Templates use natural language with proper placeholders

### Testing Coverage
- [ ] Action discovery test specifications complete
- [ ] Rule execution test specifications complete (implementation deferred)
- [ ] Edge cases identified and documented

### Documentation
- [ ] Specification document complete with all sections
- [ ] Modder usage examples provided
- [ ] Design rationale explained for key decisions
- [ ] Manifest update requirements documented

### Quality Standards
- [ ] Follows existing naming conventions (underscores in filenames)
- [ ] Follows existing ID format (`modId:identifier`)
- [ ] JSON schema patterns match existing components/actions
- [ ] Specification follows existing spec file format

---

## Implementation Checklist

### Phase 1: Component Creation
1. [ ] Create `data/mods/items/components/drinkable.component.json`
2. [ ] Create `data/mods/items/components/liquid_container.component.json`
3. [ ] Validate components against schema: `npm run validate:quick`
4. [ ] Add components to `data/mods/items/mod-manifest.json`

### Phase 2: Action Creation
1. [ ] Create `data/mods/items/actions/drink_from.action.json`
2. [ ] Create `data/mods/items/actions/drink_entirely.action.json`
3. [ ] Validate actions against schema: `npm run validate:quick`
4. [ ] Add actions to `data/mods/items/mod-manifest.json`

### Phase 3: Testing (Action Discovery Only)
1. [ ] Create `tests/integration/mods/items/drinkableItemsActionDiscovery.test.js`
2. [ ] Implement drink_from discovery tests
3. [ ] Implement drink_entirely discovery tests
4. [ ] Verify both actions coexist for same container
5. [ ] Run tests: `npm run test:integration`

### Phase 4: Validation
1. [ ] Run full validation suite: `npm run validate:mod:items`
2. [ ] Verify no schema errors
3. [ ] Verify no broken references
4. [ ] Check manifest completeness

### Phase 5: Example Entities (Optional)
1. [ ] Create example waterskin entity in `data/mods/items/entities/instances/`
2. [ ] Create example healing potion entity
3. [ ] Test in-game discovery with examples

### Future Phases (Deferred)
- [ ] **Phase 6**: Rule implementation for `drink_from`
- [ ] **Phase 7**: Rule implementation for `drink_entirely`
- [ ] **Phase 8**: Rule execution testing
- [ ] **Phase 9**: Integration with future systems (hydration, effects, refilling)

---

## Future Enhancements (Out of Scope)

These are potential features for future iterations:

1. **Liquid Type Tracking**: Add `liquidType` property (water, wine, potion, poison)
2. **Quality/Temperature**: Track liquid state beyond volume
3. **Refill Action**: Implement `items:refill_container` action
4. **Mix Liquids**: Combine liquids from multiple containers
5. **Pouring**: Transfer liquid between containers without drinking
6. **Contamination**: Liquids can become spoiled/poisoned
7. **Container Effects**: Special containers that modify liquid properties
8. **Hydration System**: Track actor thirst and hydration needs
9. **Dosage Limits**: Prevent over-consumption (stamina/capacity limits)
10. **Liquid Physics**: Spillage, evaporation, freezing

---

## Revision History

- **v1.0** (2025-01-06): Initial specification
  - Two-component design (drinkable + liquid_container)
  - Two actions (drink_from + drink_entirely)
  - Flexible complete consumption
  - Simple volume tracking
  - Rules deferred to future implementation

---

## Questions & Clarifications

For implementation questions, refer to:
- Existing item components in `data/mods/items/components/`
- Existing item actions in `data/mods/items/actions/`
- Component schema at `data/schemas/component.schema.json`
- Action schema at `data/schemas/action.schema.json`
- CLAUDE.md for testing patterns and conventions
