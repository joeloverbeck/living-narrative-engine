# Examine Item Action Split Specification

## Overview

Split the existing `items:examine_item` action into two distinct actions to reduce LLM confusion about item locations. The current unified action causes the AI to be unclear whether items are in the actor's inventory or at the current location, leading to inappropriate action selection.

**Problem Statement**: The LLM receives mixed signals when both inventory items and location items appear under the same "examine {item}" action template, resulting in:
- Attempting to examine items that aren't accessible
- Confusion about item ownership vs. environmental objects
- Reduced narrative clarity in action selection

**Solution**: Create two purpose-specific actions with clear scoping and distinct templates:
1. **Examine Owned Item** - for items in actor's inventory
2. **Examine Item in Location** - for items at actor's current location

## Design Philosophy

- **Clear Contextual Boundaries**: Separate inventory interactions from environmental interactions
- **Improved LLM Guidance**: Distinct templates provide stronger semantic hints
- **Scope Precision**: Each action uses targeted scopes that eliminate ambiguity
- **Backward Compatibility**: Remove deprecated action only after replacements are validated
- **Comprehensive Testing**: Full test coverage for both discovery and execution

---

## Action Requirements

### 1. Examine Owned Item Action

**File**: `data/mods/items/actions/examine_owned_item.action.json`

**Purpose**: Inspect an item currently in the actor's inventory to learn its details.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:examine_owned_item",
  "name": "Examine Owned Item",
  "description": "Inspect an item in your inventory to learn its details",
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "target",
      "description": "Item in inventory to examine"
    }
  },
  "required_components": {
    "primary": ["items:item", "core:description"]
  },
  "forbidden_components": {
    "actor": ["positioning:doing_complex_performance"]
  },
  "prerequisites": [],
  "template": "examine my {target}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Design Decisions**:

1. **Scope**: `items:actor_inventory_items`
   - Explicitly targets only inventory items
   - Resolves to: `actor.components.items:inventory.items[][{"!": {"var": "itemId"}}] | actor.components.items:inventory.items[].itemId`
   - No environmental items included

2. **Template**: `"examine my {target}"`
   - Clear possessive language ("my") signals ownership
   - Distinct from environmental examination
   - Natural language: "examine my ancient scroll"

3. **Required Components**:
   - `items:item` - ensures target is a valid item entity
   - `core:description` - required for inspection (filters out items lacking descriptions)

4. **Forbidden Components**:
   - `positioning:doing_complex_performance` - prevents examination during performances (same as original)

---

### 2. Examine Item in Location Action

**File**: `data/mods/items/actions/examine_item_in_location.action.json`

**Purpose**: Inspect an item at the actor's current location to learn its details.

**Full Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:examine_item_in_location",
  "name": "Examine Item in Location",
  "description": "Inspect an item at your current location to learn its details",
  "targets": {
    "primary": {
      "scope": "items:items_at_actor_location",
      "placeholder": "target",
      "description": "Item at location to examine"
    }
  },
  "required_components": {
    "primary": ["items:item", "core:description"]
  },
  "forbidden_components": {
    "actor": ["positioning:doing_complex_performance"]
  },
  "prerequisites": [],
  "template": "examine {target} in location",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Design Decisions**:

1. **Scope**: `items:items_at_actor_location` (NEW SCOPE - see below)
   - Targets both portable and non-portable items at actor's location
   - Excludes inventory items
   - Union of location-based item scopes

2. **Template**: `"examine {target} in location"`
   - Clear environmental context
   - No possessive language
   - Natural language: "examine ancient scroll in location"

3. **Required Components**:
   - Same as `examine_owned_item` for consistency
   - Filters to items with descriptions

---

## Scope Requirements

### New Scope: items_at_actor_location

**File**: `data/mods/items/scopes/items_at_actor_location.scope`

**Purpose**: Union of all items at the actor's current location (portable and non-portable).

**Definition**:
```
items:items_at_actor_location := items:items_at_location | items:non_portable_items_at_location
```

**Rationale**:
- Combines `items:items_at_location` (portable items with `items:portable` component)
- Combines `items:non_portable_items_at_location` (items without `items:portable` component)
- Both check `entity.components.core:position.locationId` matches `actor.components.core:position.locationId`
- Provides complete coverage of environmental items without inventory pollution

**Existing Scopes Referenced**:
- `items:items_at_location` - already exists, filters for portable items at location
- `items:non_portable_items_at_location` - already exists, filters for non-portable items at location
- `items:actor_inventory_items` - already exists, used by `examine_owned_item`

---

## Condition Requirements

### 1. Examine Owned Item Condition

**File**: `data/mods/items/conditions/event-is-action-examine-owned-item.condition.json`

**CRITICAL**: Use hyphens in condition filename, even though action uses underscores.

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-examine-owned-item",
  "description": "True when event is attempting the examine_owned_item action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:examine_owned_item"
    ]
  }
}
```

---

### 2. Examine Item in Location Condition

**File**: `data/mods/items/conditions/event-is-action-examine-item-in-location.condition.json`

**CRITICAL**: Use hyphens in condition filename.

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-examine-item-in-location",
  "description": "True when event is attempting the examine_item_in_location action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:examine_item_in_location"
    ]
  }
}
```

---

## Rule Requirements

### 1. Examine Owned Item Rule

**File**: `data/mods/items/rules/handle_examine_owned_item.rule.json`

**Purpose**: Process examination of inventory items with detailed description output.

**Definition** (adapted from existing `handle_examine_item.rule.json`):
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_examine_owned_item",
  "comment": "Handles examine_owned_item action with detailed item description in perception and brief success message",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-examine-owned-item"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get actor name",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get item name",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "itemName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get item description",
      "parameters": {
        "entity_ref": "target",
        "component_type": "core:description",
        "result_variable": "itemDescription"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "comment": "Log examination with full description for observers",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} examines their {context.itemName}: {context.itemDescription.text}",
        "perception_type": "item_examined",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}",
        "contextual_data": {
          "recipientIds": ["{event.payload.actorId}"]
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare brief success message",
      "parameters": {
        "variable_name": "successMessage",
        "value": "{context.actorName} examines their {context.itemName}."
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Display brief success message to UI",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": {
          "message": "{context.successMessage}"
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End turn after examination",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

**Key Changes from Original**:
- Line 3: `"rule_id": "handle_examine_owned_item"`
- Line 4: Comment updated to reflect new action name
- Line 7: `"condition_ref": "items:event-is-action-examine-owned-item"`
- Line 49: Description text includes "their" for possessive clarity: `"...examines their {context.itemName}..."`
- Line 65: Success message includes "their": `"...examines their {context.itemName}."`

---

### 2. Examine Item in Location Rule

**File**: `data/mods/items/rules/handle_examine_item_in_location.rule.json`

**Purpose**: Process examination of location items with detailed description output.

**Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_examine_item_in_location",
  "comment": "Handles examine_item_in_location action with detailed item description in perception and brief success message",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-examine-item-in-location"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get actor name",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get item name",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "itemName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get item description",
      "parameters": {
        "entity_ref": "target",
        "component_type": "core:description",
        "result_variable": "itemDescription"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor position for logging",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "comment": "Log examination with full description for observers",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "description_text": "{context.actorName} examines {context.itemName}: {context.itemDescription.text}",
        "perception_type": "item_examined",
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}",
        "contextual_data": {
          "recipientIds": ["{event.payload.actorId}"]
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Prepare brief success message",
      "parameters": {
        "variable_name": "successMessage",
        "value": "{context.actorName} examines {context.itemName}."
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Display brief success message to UI",
      "parameters": {
        "eventType": "core:display_successful_action_result",
        "payload": {
          "message": "{context.successMessage}"
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End turn after examination",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

**Key Changes from Original**:
- Line 3: `"rule_id": "handle_examine_item_in_location"`
- Line 4: Comment updated to reflect new action name
- Line 7: `"condition_ref": "items:event-is-action-examine-item-in-location"`
- Line 49: Description text maintains original format without possessive: `"...examines {context.itemName}..."`
- Line 65: Success message maintains original format: `"...examines {context.itemName}."`

---

## Testing Specification

### Test Structure

Following the established mod testing patterns documented in `docs/testing/mod-testing-guide.md`, create comprehensive test suites for both action discovery and rule execution.

---

### 1. Examine Owned Item - Action Discovery Tests

**File**: `tests/integration/mods/items/examineOwnedItemActionDiscovery.test.js`

**Purpose**: Verify `items:examine_owned_item` action appears only for inventory items with descriptions.

**Required Test Suites**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import examineOwnedItemAction from '../../../../data/mods/items/actions/examine_owned_item.action.json' assert { type: 'json' };

describe('items:examine_owned_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:examine_owned_item');

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([examineOwnedItemAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(examineOwnedItemAction).toBeDefined();
      expect(examineOwnedItemAction.id).toBe('items:examine_owned_item');
      expect(examineOwnedItemAction.name).toBe('Examine Owned Item');
      expect(examineOwnedItemAction.description).toBe(
        'Inspect an item in your inventory to learn its details'
      );
      expect(examineOwnedItemAction.template).toBe('examine my {target}');
    });

    it('should use correct scope for primary targets (actor inventory items)', () => {
      expect(examineOwnedItemAction.targets).toBeDefined();
      expect(examineOwnedItemAction.targets.primary).toBeDefined();
      expect(examineOwnedItemAction.targets.primary.scope).toBe(
        'items:actor_inventory_items'
      );
      expect(examineOwnedItemAction.targets.primary.placeholder).toBe('target');
      expect(examineOwnedItemAction.targets.primary.description).toBe(
        'Item in inventory to examine'
      );
    });

    it('should require item and description components on primary target', () => {
      expect(examineOwnedItemAction.required_components).toBeDefined();
      expect(examineOwnedItemAction.required_components.primary).toBeDefined();
      expect(examineOwnedItemAction.required_components.primary).toEqual([
        'items:item',
        'core:description',
      ]);
    });

    it('should forbid action during complex performance', () => {
      expect(examineOwnedItemAction.forbidden_components).toBeDefined();
      expect(examineOwnedItemAction.forbidden_components.actor).toEqual([
        'positioning:doing_complex_performance',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(examineOwnedItemAction.prerequisites).toBeDefined();
      expect(Array.isArray(examineOwnedItemAction.prerequisites)).toBe(true);
      expect(examineOwnedItemAction.prerequisites).toEqual([]);
    });
  });

  describe('Action discovery behavior', () => {
    it('should appear when items with description exist in actor inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test_item_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('test_item_1')
        .withName('ancient scroll')
        .withDescription('A yellowed parchment with faded text')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:actor_inventory_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['test_item_1']);
    });

    it('should NOT appear when items are at location but not in inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('test_item_2')
        .withName('rusty key')
        .withDescription('An old key covered in rust')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:actor_inventory_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toHaveLength(0);
    });

    it('should NOT appear when inventory is empty', () => {
      const room = ModEntityScenarios.createRoom('empty_location', 'Empty Room');

      const actor = new ModEntityBuilder('lonely_actor')
        .withName('Lonely')
        .atLocation('empty_location')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('lonely_actor');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for inventory items lacking core:description component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['incomplete_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('incomplete_item')
        .withName('nameless object')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should appear for multiple inventory items with descriptions', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item1', 'item2'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item1 = new ModEntityBuilder('item1')
        .withName('pocket watch')
        .withDescription('A golden pocket watch')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const item2 = new ModEntityBuilder('item2')
        .withName('compass')
        .withDescription('A brass compass')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item1, item2]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:actor_inventory_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(new Set(scopeResult.value)).toEqual(new Set(['item1', 'item2']));
    });
  });
});
```

**Test Coverage Summary**:
- ✅ Action structure validation (ID, name, template, scope)
- ✅ Component requirements validation
- ✅ Forbidden components validation
- ✅ Discovery with inventory items (positive case)
- ✅ No discovery for location items (negative case)
- ✅ No discovery for empty inventory (negative case)
- ✅ No discovery for items without descriptions (negative case)
- ✅ Multiple inventory items discovery (edge case)

---

### 2. Examine Item in Location - Action Discovery Tests

**File**: `tests/integration/mods/items/examineItemInLocationActionDiscovery.test.js`

**Purpose**: Verify `items:examine_item_in_location` action appears only for location items with descriptions.

**Required Test Suites**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import examineItemInLocationAction from '../../../../data/mods/items/actions/examine_item_in_location.action.json' assert { type: 'json' };

describe('items:examine_item_in_location action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:examine_item_in_location');

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([examineItemInLocationAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(examineItemInLocationAction).toBeDefined();
      expect(examineItemInLocationAction.id).toBe('items:examine_item_in_location');
      expect(examineItemInLocationAction.name).toBe('Examine Item in Location');
      expect(examineItemInLocationAction.description).toBe(
        'Inspect an item at your current location to learn its details'
      );
      expect(examineItemInLocationAction.template).toBe('examine {target} in location');
    });

    it('should use correct scope for primary targets (items at location)', () => {
      expect(examineItemInLocationAction.targets).toBeDefined();
      expect(examineItemInLocationAction.targets.primary).toBeDefined();
      expect(examineItemInLocationAction.targets.primary.scope).toBe(
        'items:items_at_actor_location'
      );
      expect(examineItemInLocationAction.targets.primary.placeholder).toBe('target');
      expect(examineItemInLocationAction.targets.primary.description).toBe(
        'Item at location to examine'
      );
    });

    it('should require item and description components on primary target', () => {
      expect(examineItemInLocationAction.required_components).toBeDefined();
      expect(examineItemInLocationAction.required_components.primary).toBeDefined();
      expect(examineItemInLocationAction.required_components.primary).toEqual([
        'items:item',
        'core:description',
      ]);
    });

    it('should forbid action during complex performance', () => {
      expect(examineItemInLocationAction.forbidden_components).toBeDefined();
      expect(examineItemInLocationAction.forbidden_components.actor).toEqual([
        'positioning:doing_complex_performance',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(examineItemInLocationAction.prerequisites).toBeDefined();
      expect(Array.isArray(examineItemInLocationAction.prerequisites)).toBe(true);
      expect(examineItemInLocationAction.prerequisites).toEqual([]);
    });
  });

  describe('Action discovery behavior', () => {
    it('should appear when portable items with description exist at actor location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('test_item_2')
        .withName('rusty key')
        .withDescription('An old key covered in rust')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['test_item_2']);
    });

    it('should appear when non-portable items with description exist at actor location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Frank')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('heavy_furniture')
        .withName('oak wardrobe')
        .withDescription('A massive oak wardrobe')
        .atLocation('room1')
        .withComponent('items:item', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['heavy_furniture']);
    });

    it('should NOT appear when items are in inventory but not at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test_item_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('test_item_1')
        .withName('ancient scroll')
        .withDescription('A yellowed parchment with faded text')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear when no items present at location', () => {
      const room = ModEntityScenarios.createRoom('empty_location', 'Empty Room');

      const actor = new ModEntityBuilder('lonely_actor')
        .withName('Lonely')
        .atLocation('empty_location')
        .asActor()
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('lonely_actor');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for items lacking core:description component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('incomplete_item')
        .withName('nameless object')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for items at different locations', () => {
      const roomA = ModEntityScenarios.createRoom('location_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('location_b', 'Room B');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('location_a')
        .asActor()
        .build();

      const item = new ModEntityBuilder('distant_item')
        .withName('far away object')
        .withDescription('Too far to examine')
        .atLocation('location_b')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([roomA, roomB, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should appear for both portable and non-portable items at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Eve')
        .atLocation('room1')
        .asActor()
        .build();

      const portableItem = new ModEntityBuilder('portable_item')
        .withName('floor lamp')
        .withDescription('A tall standing lamp')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const nonPortableItem = new ModEntityBuilder('non_portable_item')
        .withName('stone statue')
        .withDescription('An ancient carved statue')
        .atLocation('room1')
        .withComponent('items:item', {})
        .build();

      testFixture.reset([room, actor, portableItem, nonPortableItem]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(new Set(scopeResult.value)).toEqual(
        new Set(['portable_item', 'non_portable_item'])
      );
    });
  });
});
```

**Test Coverage Summary**:
- ✅ Action structure validation (ID, name, template, scope)
- ✅ Component requirements validation
- ✅ Forbidden components validation
- ✅ Discovery with portable location items (positive case)
- ✅ Discovery with non-portable location items (positive case)
- ✅ No discovery for inventory items (negative case)
- ✅ No discovery for empty location (negative case)
- ✅ No discovery for items without descriptions (negative case)
- ✅ No discovery for items at different location (negative case)
- ✅ Mixed portable/non-portable discovery (edge case)

---

### 3. Examine Owned Item - Rule Execution Tests

**File**: `tests/integration/mods/items/examineOwnedItemRuleExecution.test.js`

**Purpose**: Verify `handle_examine_owned_item` rule correctly processes inventory item examination.

**Required Test Suites**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import examineOwnedItemRule from '../../../../data/mods/items/rules/handle_examine_owned_item.rule.json' assert { type: 'json' };
import eventIsActionExamineOwnedItem from '../../../../data/mods/items/conditions/event-is-action-examine-owned-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized examine owned item scenario with actor and inventory item.
 */
function setupExamineOwnedItemScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  item = { id: 'letter-1', description: 'A weathered letter.' }
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: [item.id],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const itemEntity = new ModEntityBuilder(item.id)
    .withName(item.id)
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('core:description', { text: item.description })
    .build();

  return { room, actor, item: itemEntity };
}

/**
 * Asserts that the provided events include a successful turn end.
 */
function expectSuccessfulTurnEnd(events) {
  const turnEndedEvent = events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEndedEvent).toBeDefined();
  expect(turnEndedEvent.payload.success).toBe(true);
  return turnEndedEvent;
}

describe('items:examine_owned_item rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:examine_owned_item',
      examineOwnedItemRule,
      eventIsActionExamineOwnedItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful examination operations', () => {
    it('successfully executes examine owned item action on inventory item', async () => {
      // Arrange: Setup scenario with item in inventory
      const scenario = setupExamineOwnedItemScenario('Alice', 'saloon1', {
        id: 'letter-1',
        description: 'A weathered letter.',
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Act: Examine letter from inventory
      await testFixture.executeAction('test:actor1', 'letter-1');

      // Assert: Verify perceptible event with full description and possessive language
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Alice examines their letter-1: A weathered letter.'
      );
      expect(examineEvent.payload.locationId).toBe('saloon1');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('letter-1');

      // Assert: Verify brief success message with possessive language
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe('Alice examines their letter-1.');

      // Assert: Verify turn ended successfully
      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify item state unchanged (still in inventory)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('letter-1');
    });

    it('handles examination with detailed multi-sentence description', async () => {
      const scenario = setupExamineOwnedItemScenario('Charlie', 'library', {
        id: 'old-book',
        description:
          'An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.',
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'old-book');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Charlie examines their old-book: An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.'
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupExamineOwnedItemScenario('Dave', 'workshop', {
        id: 'tool-1',
        description: 'A well-worn hammer.',
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'tool-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );

      // Verify all required fields
      expect(examineEvent.payload.locationId).toBe('workshop');
      expect(examineEvent.payload.perceptionType).toBe('item_examined');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('tool-1');
      expect(examineEvent.payload.descriptionText).toContain('Dave');
      expect(examineEvent.payload.descriptionText).toContain('their');
      expect(examineEvent.payload.descriptionText).toContain('tool-1');
      expect(examineEvent.payload.descriptionText).toContain('A well-worn hammer.');

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupExamineOwnedItemScenario('Eve', 'cellar', {
        id: 'wine-bottle',
        description: 'A dusty wine bottle.',
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'wine-bottle');

      // Count event types
      const eventTypes = testFixture.events.map((e) => e.eventType);

      // Should have exactly these event types
      expect(eventTypes).toContain('core:perceptible_event');
      expect(eventTypes).toContain('core:display_successful_action_result');
      expect(eventTypes).toContain('core:turn_ended');

      // Should NOT have any item state change events
      expect(eventTypes).not.toContain('items:item_picked_up');
      expect(eventTypes).not.toContain('items:item_dropped');
      expect(eventTypes).not.toContain('items:item_transferred');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('no state changes', () => {
    it('does not modify inventory for inventory items', async () => {
      const scenario = setupExamineOwnedItemScenario('Grace', 'kitchen', {
        id: 'key-1',
        description: 'A brass key.',
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Get initial inventory state
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const inventoryBefore = [
        ...actorBefore.components['items:inventory'].items,
      ];

      await testFixture.executeAction('test:actor1', 'key-1');

      // Get inventory after examination
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');

      // Inventory should be unchanged
      expect(actorAfter.components['items:inventory'].items).toEqual(
        inventoryBefore
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('multiple items scenarios', () => {
    it('can examine multiple inventory items sequentially', async () => {
      const room = new ModEntityBuilder('study').asRoom('Study').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Henry')
        .atLocation('study')
        .asActor()
        .withComponent('items:inventory', {
          items: ['map-1', 'compass-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const map = new ModEntityBuilder('map-1')
        .withName('map-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:description', { text: 'A treasure map.' })
        .build();

      const compass = new ModEntityBuilder('compass-1')
        .withName('compass-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:description', { text: 'A brass compass.' })
        .build();

      testFixture.reset([room, actor, map, compass]);

      // Examine first item
      const firstActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'map-1');

      const firstActionEvents = testFixture.events.slice(firstActionStart);
      expectSuccessfulTurnEnd(firstActionEvents);

      const firstExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'map-1'
      );
      expect(firstExamineEvent).toBeDefined();
      expect(firstExamineEvent.payload.descriptionText).toContain(
        'A treasure map.'
      );
      expect(firstExamineEvent.payload.descriptionText).toContain('their');

      // Examine second item
      const secondActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'compass-1');

      const secondActionEvents = testFixture.events.slice(secondActionStart);
      expectSuccessfulTurnEnd(secondActionEvents);

      const secondExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'compass-1'
      );
      expect(secondExamineEvent).toBeDefined();
      expect(secondExamineEvent.payload.descriptionText).toContain(
        'A brass compass.'
      );
      expect(secondExamineEvent.payload.descriptionText).toContain('their');

      const examineEvents = testFixture.events.filter(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'item_examined'
      );
      expect(examineEvents).toHaveLength(2);
    });
  });
});
```

**Test Coverage Summary**:
- ✅ Successful examination with possessive language ("their")
- ✅ Multi-sentence descriptions
- ✅ Event structure validation
- ✅ No unexpected side effects
- ✅ No state changes to inventory
- ✅ Multiple sequential examinations

---

### 4. Examine Item in Location - Rule Execution Tests

**File**: `tests/integration/mods/items/examineItemInLocationRuleExecution.test.js`

**Purpose**: Verify `handle_examine_item_in_location` rule correctly processes location item examination.

**Required Test Suites**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import examineItemInLocationRule from '../../../../data/mods/items/rules/handle_examine_item_in_location.rule.json' assert { type: 'json' };
import eventIsActionExamineItemInLocation from '../../../../data/mods/items/conditions/event-is-action-examine-item-in-location.condition.json' assert { type: 'json' };

/**
 * Creates a standardized examine item in location scenario with actor and location item.
 */
function setupExamineItemInLocationScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  item = { id: 'horseshoe-1', description: 'A rusty iron horseshoe.', portable: true }
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const itemBuilder = new ModEntityBuilder(item.id)
    .withName(item.id)
    .atLocation(locationId)
    .withComponent('items:item', {})
    .withComponent('core:description', { text: item.description });

  if (item.portable) {
    itemBuilder.withComponent('items:portable', {});
  }

  const itemEntity = itemBuilder.build();

  return { room, actor, item: itemEntity };
}

/**
 * Asserts that the provided events include a successful turn end.
 */
function expectSuccessfulTurnEnd(events) {
  const turnEndedEvent = events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEndedEvent).toBeDefined();
  expect(turnEndedEvent.payload.success).toBe(true);
  return turnEndedEvent;
}

describe('items:examine_item_in_location rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:examine_item_in_location',
      examineItemInLocationRule,
      eventIsActionExamineItemInLocation
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful examination operations', () => {
    it('successfully executes examine item in location action on portable location item', async () => {
      // Arrange: Setup scenario with portable item at location
      const scenario = setupExamineItemInLocationScenario('Bob', 'stable', {
        id: 'horseshoe-1',
        description: 'A rusty iron horseshoe.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Act: Examine horseshoe at location
      await testFixture.executeAction('test:actor1', 'horseshoe-1');

      // Assert: Verify perceptible event with full description (no possessive)
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Bob examines horseshoe-1: A rusty iron horseshoe.'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify item still at location (no state change)
      const item = testFixture.entityManager.getEntityInstance('horseshoe-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('stable');
    });

    it('successfully executes examine item in location action on non-portable location item', async () => {
      // Arrange: Setup scenario with non-portable item at location
      const scenario = setupExamineItemInLocationScenario('Frank', 'room1', {
        id: 'heavy_furniture',
        description: 'A massive oak wardrobe',
        portable: false,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Act: Examine furniture at location
      await testFixture.executeAction('test:actor1', 'heavy_furniture');

      // Assert: Verify perceptible event with full description (no possessive)
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Frank examines heavy_furniture: A massive oak wardrobe'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify item still at location (no state change)
      const item = testFixture.entityManager.getEntityInstance('heavy_furniture');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('room1');
    });

    it('handles examination with detailed multi-sentence description', async () => {
      const scenario = setupExamineItemInLocationScenario('Charlie', 'library', {
        id: 'old-book',
        description:
          'An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'old-book');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Charlie examines old-book: An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupExamineItemInLocationScenario('Dave', 'workshop', {
        id: 'tool-1',
        description: 'A well-worn hammer.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'tool-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );

      // Verify all required fields
      expect(examineEvent.payload.locationId).toBe('workshop');
      expect(examineEvent.payload.perceptionType).toBe('item_examined');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('tool-1');
      expect(examineEvent.payload.descriptionText).toContain('Dave');
      expect(examineEvent.payload.descriptionText).not.toContain('their');
      expect(examineEvent.payload.descriptionText).toContain('tool-1');
      expect(examineEvent.payload.descriptionText).toContain('A well-worn hammer.');

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupExamineItemInLocationScenario('Eve', 'cellar', {
        id: 'wine-bottle',
        description: 'A dusty wine bottle.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'wine-bottle');

      // Count event types
      const eventTypes = testFixture.events.map((e) => e.eventType);

      // Should have exactly these event types
      expect(eventTypes).toContain('core:perceptible_event');
      expect(eventTypes).toContain('core:display_successful_action_result');
      expect(eventTypes).toContain('core:turn_ended');

      // Should NOT have any item state change events
      expect(eventTypes).not.toContain('items:item_picked_up');
      expect(eventTypes).not.toContain('items:item_dropped');
      expect(eventTypes).not.toContain('items:item_transferred');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('no state changes', () => {
    it('does not modify item position for location items', async () => {
      const scenario = setupExamineItemInLocationScenario('Frank', 'barn', {
        id: 'hay-bale',
        description: 'A large bale of hay.',
        portable: false,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Get initial item state
      const itemBefore = testFixture.entityManager.getEntityInstance('hay-bale');
      const positionBefore = itemBefore.components['core:position'];

      await testFixture.executeAction('test:actor1', 'hay-bale');

      // Get item state after examination
      const itemAfter = testFixture.entityManager.getEntityInstance('hay-bale');

      // Position should be unchanged
      expect(itemAfter.components['core:position']).toEqual(positionBefore);
      expect(itemAfter.components['core:position'].locationId).toBe('barn');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('multiple items scenarios', () => {
    it('can examine multiple location items sequentially', async () => {
      const room = new ModEntityBuilder('study').asRoom('Study').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Henry')
        .atLocation('study')
        .asActor()
        .build();

      const map = new ModEntityBuilder('map-1')
        .withName('map-1')
        .atLocation('study')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:description', { text: 'A treasure map.' })
        .build();

      const compass = new ModEntityBuilder('compass-1')
        .withName('compass-1')
        .atLocation('study')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:description', { text: 'A brass compass.' })
        .build();

      testFixture.reset([room, actor, map, compass]);

      // Examine first item
      const firstActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'map-1');

      const firstActionEvents = testFixture.events.slice(firstActionStart);
      expectSuccessfulTurnEnd(firstActionEvents);

      const firstExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'map-1'
      );
      expect(firstExamineEvent).toBeDefined();
      expect(firstExamineEvent.payload.descriptionText).toContain(
        'A treasure map.'
      );
      expect(firstExamineEvent.payload.descriptionText).not.toContain('their');

      // Examine second item
      const secondActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'compass-1');

      const secondActionEvents = testFixture.events.slice(secondActionStart);
      expectSuccessfulTurnEnd(secondActionEvents);

      const secondExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'compass-1'
      );
      expect(secondExamineEvent).toBeDefined();
      expect(secondExamineEvent.payload.descriptionText).toContain(
        'A brass compass.'
      );
      expect(secondExamineEvent.payload.descriptionText).not.toContain('their');

      const examineEvents = testFixture.events.filter(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'item_examined'
      );
      expect(examineEvents).toHaveLength(2);
    });
  });
});
```

**Test Coverage Summary**:
- ✅ Successful examination of portable location items (no possessive language)
- ✅ Successful examination of non-portable location items
- ✅ Multi-sentence descriptions
- ✅ Event structure validation
- ✅ No unexpected side effects
- ✅ No state changes to item position
- ✅ Multiple sequential examinations

---

## Cleanup Requirements

After implementing and validating the new actions, remove all references to the original `items:examine_item` action:

### Files to Remove

1. **Action Definition**:
   - `data/mods/items/actions/examine_item.action.json`

2. **Condition Definition**:
   - `data/mods/items/conditions/event-is-action-examine-item.condition.json`

3. **Rule Definition**:
   - `data/mods/items/rules/handle_examine_item.rule.json`

4. **Test Files**:
   - `tests/integration/mods/items/examineItemActionDiscovery.test.js`
   - `tests/integration/mods/items/examineItemRuleExecution.test.js`

5. **Scope Definition**:
   - `data/mods/items/scopes/examinable_items.scope` (deprecated, no longer needed)

### Manifest Updates

Remove old entries and add new ones in `data/mods/items/mod-manifest.json`:

**Remove**:
```json
{
  "actions": [
    "actions/examine_item.action.json"  // REMOVE
  ],
  "scopes": [
    "scopes/examinable_items.scope"  // REMOVE
  ],
  "rules": [
    "rules/handle_examine_item.rule.json"  // REMOVE
  ],
  "conditions": [
    "conditions/event-is-action-examine-item.condition.json"  // REMOVE
  ]
}
```

**Add**:
```json
{
  "actions": [
    "actions/examine_owned_item.action.json",
    "actions/examine_item_in_location.action.json"
  ],
  "scopes": [
    "scopes/items_at_actor_location.scope"
  ],
  "rules": [
    "rules/handle_examine_owned_item.rule.json",
    "rules/handle_examine_item_in_location.rule.json"
  ],
  "conditions": [
    "conditions/event-is-action-examine-owned-item.condition.json",
    "conditions/event-is-action-examine-item-in-location.condition.json"
  ]
}
```

### Code References

Search for and update any references to the old action ID in:
- Other test files
- Specs/documentation
- README files

**Search Command**:
```bash
grep -r "examine_item" --include="*.js" --include="*.json" --include="*.md"
```

---

## Acceptance Criteria

### New Action Definitions
- [ ] `items:examine_owned_item` action defined with `items:actor_inventory_items` scope
- [ ] `items:examine_item_in_location` action defined with `items:items_at_actor_location` scope
- [ ] Both actions use correct template syntax ("examine my {target}" vs "examine {target} in location")
- [ ] Both actions require `items:item` and `core:description` components
- [ ] Both actions forbid `positioning:doing_complex_performance` on actor

### New Scope Definition
- [ ] `items:items_at_actor_location` scope created as union of location item scopes
- [ ] Scope correctly combines portable and non-portable items at location
- [ ] Scope validates successfully with `npm run scope:lint`

### New Condition Definitions
- [ ] `event-is-action-examine-owned-item.condition.json` created (hyphens!)
- [ ] `event-is-action-examine-item-in-location.condition.json` created (hyphens!)
- [ ] Conditions reference correct action IDs
- [ ] Conditions validate successfully with `npm run validate:quick`

### New Rule Definitions
- [ ] `handle_examine_owned_item.rule.json` created with possessive language
- [ ] `handle_examine_item_in_location.rule.json` created without possessive language
- [ ] Rules reference correct condition IDs
- [ ] Rules dispatch appropriate perceptible events
- [ ] Rules validate successfully with `npm run validate:quick`

### Testing Coverage
- [ ] Action discovery tests complete for `examine_owned_item`
- [ ] Action discovery tests complete for `examine_item_in_location`
- [ ] Rule execution tests complete for `examine_owned_item`
- [ ] Rule execution tests complete for `examine_item_in_location`
- [ ] All tests pass: `npm run test:integration`
- [ ] Test coverage meets 80% threshold

### Cleanup
- [ ] Original `examine_item.action.json` removed
- [ ] Original `event-is-action-examine-item.condition.json` removed
- [ ] Original `handle_examine_item.rule.json` removed
- [ ] Original `examinable_items.scope` removed
- [ ] Original test files removed
- [ ] Manifest updated with new entries
- [ ] No references to old action remain in codebase

### Quality Standards
- [ ] Files follow naming conventions (underscores in actions/rules, hyphens in conditions)
- [ ] IDs use proper namespace format (`items:identifier`)
- [ ] JSON validates against schemas
- [ ] Tests follow ModTestFixture patterns from `docs/testing/mod-testing-guide.md`
- [ ] Spec follows existing spec file format

---

## Implementation Checklist

### Phase 1: Create New Scope
1. [ ] Create `data/mods/items/scopes/items_at_actor_location.scope`
2. [ ] Validate scope syntax: `npm run scope:lint`
3. [ ] Add scope to `mod-manifest.json`

### Phase 2: Create Examine Owned Item Action
1. [ ] Create `data/mods/items/actions/examine_owned_item.action.json`
2. [ ] Create `data/mods/items/conditions/event-is-action-examine-owned-item.condition.json`
3. [ ] Create `data/mods/items/rules/handle_examine_owned_item.rule.json`
4. [ ] Validate files: `npm run validate:quick`
5. [ ] Add to `mod-manifest.json`

### Phase 3: Create Examine Item in Location Action
1. [ ] Create `data/mods/items/actions/examine_item_in_location.action.json`
2. [ ] Create `data/mods/items/conditions/event-is-action-examine-item-in-location.condition.json`
3. [ ] Create `data/mods/items/rules/handle_examine_item_in_location.rule.json`
4. [ ] Validate files: `npm run validate:quick`
5. [ ] Add to `mod-manifest.json`

### Phase 4: Testing - Examine Owned Item
1. [ ] Create `tests/integration/mods/items/examineOwnedItemActionDiscovery.test.js`
2. [ ] Create `tests/integration/mods/items/examineOwnedItemRuleExecution.test.js`
3. [ ] Run tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/items/examineOwnedItem*.test.js`
4. [ ] Verify all tests pass

### Phase 5: Testing - Examine Item in Location
1. [ ] Create `tests/integration/mods/items/examineItemInLocationActionDiscovery.test.js`
2. [ ] Create `tests/integration/mods/items/examineItemInLocationRuleExecution.test.js`
3. [ ] Run tests: `NODE_ENV=test npm run test:integration -- tests/integration/mods/items/examineItemInLocation*.test.js`
4. [ ] Verify all tests pass

### Phase 6: Validation
1. [ ] Run full validation suite: `npm run validate:mod:items`
2. [ ] Run full test suite: `npm run test:integration`
3. [ ] Verify no schema errors
4. [ ] Verify no broken references
5. [ ] Check manifest completeness

### Phase 7: Cleanup
1. [ ] Remove `data/mods/items/actions/examine_item.action.json`
2. [ ] Remove `data/mods/items/conditions/event-is-action-examine-item.condition.json`
3. [ ] Remove `data/mods/items/rules/handle_examine_item.rule.json`
4. [ ] Remove `data/mods/items/scopes/examinable_items.scope`
5. [ ] Remove `tests/integration/mods/items/examineItemActionDiscovery.test.js`
6. [ ] Remove `tests/integration/mods/items/examineItemRuleExecution.test.js`
7. [ ] Update `mod-manifest.json` to remove old entries
8. [ ] Search for remaining references: `grep -r "examine_item" --include="*.js" --include="*.json"`
9. [ ] Remove any remaining references found

### Phase 8: Final Validation
1. [ ] Run full validation: `npm run validate`
2. [ ] Run full test suite: `npm run test:ci`
3. [ ] Run linter: `npx eslint tests/integration/mods/items/examine*.test.js`
4. [ ] Verify no errors or warnings

---

## Benefits Summary

### Improved LLM Clarity
- **Before**: Single "examine {item}" action with mixed inventory/location items causing confusion
- **After**: Two distinct actions with clear templates indicating context

### Better Action Discovery
- **Before**: LLM must infer item location from unclear scope
- **After**: Explicit scopes eliminate ambiguity
  - `examine my {target}` → clearly inventory
  - `examine {target} in location` → clearly environmental

### Enhanced Player Experience
- More intuitive action naming
- Reduced false positives in action discovery
- Clearer narrative intent

### Maintainability
- Separate concerns for inventory vs. location interactions
- Easier to extend with location-specific or inventory-specific rules
- Simpler scope definitions

---

## Future Enhancements (Out of Scope)

These are potential features for future iterations:

1. **Context-Aware Descriptions**: Different description text based on lighting, distance, or actor perception skills
2. **Repeated Examination Diminishing Returns**: Track examined state, provide shorter descriptions on re-examination
3. **Examination Skills**: Add perception/observation skill checks for hidden details
4. **Interactive Examination**: Branch to specialized examine actions (examine lock on chest, examine inscription on statue)
5. **Examination Time**: Add time cost based on item complexity
6. **Group Examination**: Examine multiple items simultaneously
7. **Comparison Examination**: Compare two items side-by-side

---

## Revision History

- **v1.0** (2025-01-10): Initial specification
  - Split examine_item into examine_owned_item and examine_item_in_location
  - Create new items_at_actor_location scope
  - Define comprehensive test suites
  - Specify cleanup requirements

---

## Questions & Clarifications

For implementation questions, refer to:
- Existing item actions in `data/mods/items/actions/`
- Existing item rules in `data/mods/items/rules/`
- Existing test patterns in `tests/integration/mods/items/`
- Mod testing guide at `docs/testing/mod-testing-guide.md`
- Action schema at `data/schemas/action.schema.json`
- Rule schema at `data/schemas/rule.schema.json`
- CLAUDE.md for development guidelines
