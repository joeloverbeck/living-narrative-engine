# Vampirism Mod Tests

## Testing Pattern

All vampirism mod tests use the **ModTestFixture pattern** with **ScopeResolverHelpers** for consistent, maintainable testing.

## Standard Setup

### Action Discovery Tests

```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import actionDefinition from '../../../../data/mods/vampirism/actions/{action}.action.json';

const ACTION_ID = 'vampirism:{action}';

describe('vampirism:{action} - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([actionDefinition]);

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('discovers action when conditions are met', () => {
    const scenario = testFixture.createStandardActorTarget(['Actor', 'Target']);

    // Add required components
    scenario.actor.components['vampirism:is_vampire'] = {};
    scenario.actor.components['positioning:biting_neck'] = {
      bitten_entity_id: scenario.target.id,
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).toContain(ACTION_ID);
  });
});
```

## Vampirism-Specific Components

### Marker Components

- **`vampirism:is_vampire`**: Identifies an entity as a vampire (required for most vampirism actions)

### Positioning Components (from positioning mod)

- **`positioning:biting_neck`**: Actor is currently biting a target's neck
  - `bitten_entity_id`: Entity being bitten
  - `initiated`: Whether the bite was initiated
- **`positioning:being_bitten_in_neck`**: Entity is having their neck bitten
  - `biting_entity_id`: Entity doing the biting
- **`positioning:closeness`**: Actors are in close proximity
  - `partners`: Array of entity IDs in close proximity

## Common Test Patterns

### Testing Reciprocal Bite Relationships

```javascript
// Actor biting target's neck
scenario.actor.components['positioning:biting_neck'] = {
  bitten_entity_id: scenario.target.id,
  initiated: true,
};

// Target being bitten by actor (reciprocal)
scenario.target.components['positioning:being_bitten_in_neck'] = {
  biting_entity_id: scenario.actor.id,
};
```

### Testing Without Closeness (Distance Attacks)

```javascript
const scenario = testFixture.createStandardActorTarget(['Vampire', 'Victim']);

// Remove closeness to test distance-based actions
delete scenario.actor.components['positioning:closeness'];
delete scenario.target.components['positioning:closeness'];

scenario.actor.components['vampirism:is_vampire'] = {};
```

### Testing Forbidden Components

```javascript
// Test that action is NOT available when actor has forbidden component
scenario.actor.components['sex-states:giving_blowjob'] = {
  target_id: scenario.target.id,
};

// Should not discover action
expect(ids).not.toContain(ACTION_ID);
```

## Action-Specific Scopes

### Bite Actions

- **`bite_neck_carefully`**: Uses `personal-space:close_actors_facing_each_other_or_behind_target`
  - Requires closeness and proper facing/positioning
  - Requires `vampirism:is_vampire` marker

- **`lunge_bite_neck_violently`**: Uses `core:actors_in_location`
  - NO closeness requirement (distance attack)
  - Requires `vampirism:is_vampire` marker

### Blood Actions

- **`drink_blood`**: Uses `positioning:actor_being_bitten_by_me`
  - Requires reciprocal bite relationship (biting_neck ↔ being_bitten_in_neck)
  - Requires existing bite to be established

- **`pull_out_fangs`**: Uses `positioning:actor_being_bitten_by_me`
  - Same as drink_blood (withdrawing from existing bite)
  - Requires reciprocal bite relationship

## Migration History

### 2025-10-26: Legacy Pattern Migration (TEAOUTTHR-005)

**Migrated Files:**

- `drink_blood_action_discovery.test.js`
- `bite_neck_carefully_action_discovery.test.js`
- `lunge_bite_neck_violently_action_discovery.test.js`
- `pull_out_fangs_action_discovery.test.js`

**Changes Applied:**

- ✅ Removed `createActionDiscoveryBed` legacy pattern
- ✅ Removed `SimpleEntityManager` usage
- ✅ Replaced mock-based scope resolution with `ScopeResolverHelpers`
- ✅ Adopted `ModTestFixture.forAction` pattern
- ✅ Updated entity creation to use scenario builders
- ✅ Replaced `discoverActionsWithDiagnostics` with `getAvailableActions`
- ✅ Aligned with current testing standards (see [Migration from Legacy Patterns](../../../docs/testing/mod-testing-guide.md#migration-from-legacy-patterns))

**Impact:**

- Reduced boilerplate by ~40-50 lines per file (~180 lines total)
- Improved maintainability and consistency with other mods
- Eliminated manual mock implementations
- Enabled real scope resolution with ScopeResolverHelpers

**Pattern Reference:**
Based on violence mod migration (TEAOUTTHR-004), specifically `tear_out_throat_action_discovery.test.js`

## Related Documentation

- [Mod Testing Guide](../../../docs/testing/mod-testing-guide.md) - Complete unified reference including:
  - Action discovery and diagnostics
  - Migration from legacy patterns
  - ScopeResolverHelpers usage

## Test Execution

### Run Individual Test

```bash
NODE_ENV=test npx jest tests/integration/mods/vampirism/drink_blood_action_discovery.test.js --no-coverage --verbose
```

### Run All Vampirism Tests

```bash
NODE_ENV=test npx jest tests/integration/mods/vampirism/ --no-coverage --silent
```

### Run With Coverage

```bash
NODE_ENV=test npx jest tests/integration/mods/vampirism/ --coverage
```
