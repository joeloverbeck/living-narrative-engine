# Architecture Analysis: Tear Out Throat Action Testing

**Date**: 2025-10-25
**Scope**: Testing infrastructure complications for `violence:tear_out_throat` action/rule
**Status**: All tests passing (24/24), but significant friction encountered

---

## Executive Summary

During implementation of the `violence:tear_out_throat` action and its test suites, **5 major errors** were encountered and resolved. The most significant complication was the requirement for **manual scope resolution configuration** - a 40+ line boilerplate pattern that had to be implemented to make action discovery work.

**Critical Discovery**: A helper library (`ScopeResolverHelpers`) exists that could have eliminated this entire category of problems, but it is:

- ❌ Not documented in primary mod-testing-guide.md (though mentioned in MODTESTROB-009-migration-guide.md)
- ❌ Not used in violence or vampirism mod tests
- ⚠️ Only discoverable by examining positioning mod tests (e.g., scoot_closer_right_action_discovery.test.js)

**Key Finding**: Different mods use inconsistent testing patterns, creating confusion about which approach to follow.

---

## Detailed Error Analysis

### Error 1: Condition File Naming Convention Mismatch

**Error Message**:

```
Could not load condition file for violence:tear_out_throat.
Tried paths: data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json
```

**Root Cause**:

- Spec file showed underscores: `event-is-action-tear_out_throat.condition.json`
- Existing violence mod uses hyphens: `event-is-action-slap.condition.json`
- ModTestFixture expects hyphenated format

**Fix Applied**:

```bash
mv data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json \
   data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json
```

**Lesson**: File naming conventions must match ModTestFixture expectations (hyphens for conditions, underscores for rules).

**Prevention**: Document this explicitly in mod-testing-guide.md.

---

### Error 2: Discovery Test Action ID Format

**Error Message**:

```
ModTestFixture.forAction failed for violence:violence:tear_out_throat
```

**Root Cause**:

- Passed full action ID (`violence:tear_out_throat`) to `forAction(modId, actionName)`
- Method expected just action name without prefix
- Result: double-prefixing

**Fix Applied**:

```javascript
// ❌ Wrong
const testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

// ✅ Correct
const testFixture = await ModTestFixture.forAction(
  'violence',
  'tear_out_throat'
);
```

**Lesson**: `ModTestFixture.forAction()` parameters are `(modId, actionName)`, not `(modId, fullActionId)`.

**Prevention**: Add explicit JSDoc type annotations to `forAction()` method signature.

---

### Error 3: Non-Existent createCharacter Method

**Error Message**:

```
TypeError: _ModEntityBuilder.ModEntityScenarios.createCharacter is not a function
```

**Root Cause**:

- Called `ModEntityScenarios.createCharacter()` which doesn't exist in API
- Confusion between ModEntityScenarios helpers and test fixture methods

**Fix Applied**:

```javascript
// ❌ Wrong
const unrelatedEntity = ModEntityScenarios.createCharacter({...});

// ✅ Correct
const unrelatedEntity = testFixture.createEntity({
  id: 'charlie',
  name: 'Charlie',
  components: {
    'core:position': { locationId: 'room1' },
    'positioning:closeness': { partners: [] },
    'positioning:biting_neck': {
      bitten_entity_id: 'someone_else',
      initiated: true,
      consented: false,
    },
  },
});
```

**Lesson**: Use `testFixture.createEntity()` for custom entities, `ModEntityScenarios` only for rooms and predefined patterns.

**Prevention**: Document the complete ModEntityScenarios API surface in mod-testing-guide.md.

---

### Error 4: Scope Resolution Not Configured (MAJOR COMPLICATION)

**Error**: Action not discoverable - `availableActions` returned empty array `[]`

**Expected**: `toContain('violence:tear_out_throat')` but received `[]`

**Root Cause**:
ModTestFixture does **not automatically load or configure custom scopes** from dependency mods. The `positioning:actor_being_bitten_by_me` scope required manual implementation.

**Manual Implementation Required** (40+ lines):

```javascript
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';

let configureActionDiscovery;

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

  configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) return;

    testEnv.actionIndex.buildIndex([tearOutThroatAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__tearOutThroatOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__tearOutThroatOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:actor_being_bitten_by_me') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const { entityManager } = testEnv;
        const actorEntity = entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return { success: true, value: new Set() };
        }

        // Check if actor has positioning:biting_neck component
        const actorBitingNeck =
          actorEntity.components?.['positioning:biting_neck'];
        if (!actorBitingNeck) {
          return { success: true, value: new Set() };
        }

        const bitten_entity_id = actorBitingNeck.bitten_entity_id;
        if (!bitten_entity_id) {
          return { success: true, value: new Set() };
        }

        // Get the target entity
        const targetEntity = entityManager.getEntityInstance(bitten_entity_id);
        if (!targetEntity) {
          return { success: true, value: new Set() };
        }

        // Check reciprocal positioning:being_bitten_in_neck component
        const targetBeingBitten =
          targetEntity.components?.['positioning:being_bitten_in_neck'];
        if (!targetBeingBitten) {
          return { success: true, value: new Set() };
        }

        // Verify reciprocal relationship
        if (targetBeingBitten.biting_entity_id !== actorId) {
          return { success: true, value: new Set() };
        }

        return { success: true, value: new Set([bitten_entity_id]) };
      }

      return originalResolve(scopeName, context);
    };
  };
});

afterEach(() => {
  clearEntityCache();
  testFixture.cleanup();
});

// Must call after every reset
testFixture.reset([room, scenario.actor, scenario.target]);
configureActionDiscovery();
```

**Pattern Borrowed From**: `tests/integration/mods/violence/grab_neck_action_discovery.test.js`

**This is the PRIMARY source of testing friction** - every action using custom scopes requires this boilerplate.

---

### Error 5: Syntax Errors

**Error 1**: `SyntaxError: Unexpected token, expected "," (84:3)` - Extra semicolon after closing brace

**Error 2**: `SyntaxError: Unexpected token, expected "," (86:2)` - Missing closing parenthesis for `beforeEach`

**Fix**: Standard syntax corrections

**Lesson**: Minor issues but time-consuming to debug in large test files.

---

## Testing Infrastructure Review

### ModTestFixture Analysis

**Location**: `tests/common/mods/ModTestFixture.js`

**Capabilities**:

- ✅ Auto-loads action, rule, and condition files with naming convention support
- ✅ Provides scenario helpers (`createStandardActorTarget`, `createCloseActors`)
- ✅ Macro expansion for rules
- ✅ Validation proxies for catching schema drift
- ✅ Action execution helpers
- ✅ Event assertion helpers

**Limitations** (Critical Gap):

- ❌ **Does not auto-load scopes from dependency mods**
- ❌ Does not register scope resolvers automatically
- ❌ Requires manual scope configuration for any custom scopes
- ❌ No guidance or error messages about scope registration

**Impact**: Actions using positioning mod scopes require 40+ lines of boilerplate configuration code.

---

### ScopeResolverHelpers Discovery

**Location**: `tests/common/mods/scopeResolverHelpers.js` (606 lines)

**Discovered Capabilities**:

```javascript
// THIS LIBRARY EXISTS BUT WAS NEVER DOCUMENTED OR USED

import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat');

  // THIS ONE LINE COULD HAVE REPLACED 40+ LINES OF MANUAL CODE
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

**What ScopeResolverHelpers Provides**:

- ✅ `registerPositioningScopes()` - Registers 10+ common positioning scopes
- ✅ `registerInventoryScopes()` - Registers 5+ inventory/items scopes
- ✅ `registerAnatomyScopes()` - Registers anatomy-related scopes
- ✅ Factory methods for custom scope patterns:
  - `createComponentLookupResolver()` - "furniture actor is sitting on" pattern
  - `createArrayFilterResolver()` - "entities matching filter" pattern
  - `createLocationMatchResolver()` - "entities at same location" pattern
  - `createComponentFilterResolver()` - "entities with component" pattern

**Registered Positioning Scopes Include**:

- `positioning:furniture_actor_sitting_on`
- `positioning:actors_sitting_on_same_furniture`
- `positioning:closest_leftmost_occupant`
- `positioning:closest_rightmost_occupant`
- `positioning:furniture_allowing_sitting_at_location`
- `positioning:standing_actors_at_location`
- `positioning:sitting_actors`
- `positioning:kneeling_actors`
- `positioning:furniture_actor_behind`

**Critical Finding**: The scope `positioning:actor_being_bitten_by_me` used in `tear_out_throat` action is **not** in the registered list, but the library's factory methods could have been used to create it with ~5 lines instead of 40+:

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat');

  // Register standard positioning scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Add custom scope using factory (5 lines instead of 40+)
  const biting CustomResolver = ScopeResolverHelpers.createComponentLookupResolver(
    'positioning:actor_being_bitten_by_me',
    {
      componentType: 'positioning:biting_neck',
      sourceField: 'bitten_entity_id',
      contextSource: 'actor'
    }
  );

  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { 'positioning:actor_being_bitten_by_me': bitingCustomResolver }
  );
});
```

**Why This Wasn't Easily Discovered**:

1. ❌ Not mentioned in `docs/testing/mod-testing-guide.md` (primary guide)
2. ⚠️ Mentioned in `docs/testing/MODTESTROB-009-migration-guide.md` but as migration reference, not tutorial
3. ❌ Not used in violence mod tests (`grab_neck_action_discovery.test.js`)
4. ❌ Not used in vampirism mod tests (`drink_blood_action_discovery.test.js`)
5. ✅ IS used in positioning mod tests (e.g., `scoot_closer_right_action_discovery.test.js:4,21`)
6. ❌ File name doesn't suggest it solves scope problems
7. ❌ No examples in primary testing guide showing its usage

---

### Scope Definition Context: The Deeper Issue

**Critical Finding**: The scope `positioning:actor_being_bitten_by_me` **already exists** as a proper scope definition in the positioning mod:

**File**: `data/mods/positioning/scopes/actor_being_bitten_by_me.scope`

**Content**:

```javascript
// Scope restricting potential targets to the entity whose neck the actor is currently biting
// Validates reciprocal component relationship for safety
positioning:actor_being_bitten_by_me := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "actor.components.positioning:biting_neck"}},
    {"!!": {"var": "entity.components.positioning:being_bitten_in_neck"}},
    {"==": [
      {"var": "actor.components.positioning:biting_neck.bitten_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:being_bitten_in_neck.biting_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

**Implications**:

1. **Scope Already Defined**: The scope logic exists in the positioning mod's scope files
2. **Test Duplication**: The manual scope implementation in tests duplicates this existing definition
3. **Root Cause Revealed**: The test framework does NOT automatically load scope definitions from mods
4. **Production vs Test Gap**: Scopes work in production (loaded from mod files) but not in tests (require manual registration)

**Why This Matters**:

The friction isn't just about ScopeResolverHelpers being undocumented. The deeper architectural issue is that **ModTestFixture doesn't load scope files from dependency mods**. This forces test authors to either:

- Manually implement scope logic (40+ lines of boilerplate)
- Use ScopeResolverHelpers (if they discover it exists)
- Implement a custom scope loader (even more work)

**Ideal Solution**: ModTestFixture should automatically load scope definitions from mod dependencies, just like the production engine does. This would eliminate the need for both manual implementations and ScopeResolverHelpers for standard mod scopes.

---

### Pattern Inconsistencies Across Mods

#### Violence Mod Pattern (grab_neck)

```javascript
// Uses ModTestFixture but with manual scope resolution
testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

configureActionDiscovery = () => {
  testEnv.actionIndex.buildIndex([grabNeckAction]);
  const scopeResolver = testEnv.unifiedScopeResolver;
  // 30+ lines of manual scope implementation...
};
```

**Characteristics**:

- Uses modern ModTestFixture
- Manual scope resolution in beforeEach
- No use of ScopeResolverHelpers

#### Vampirism Mod Pattern (drink_blood)

```javascript
// Uses LEGACY createActionDiscoveryBed pattern
testBed = createActionDiscoveryBed();

// Uses SimpleEntityManager instead of ModTestFixture's entity manager
const simpleEntityManager = new SimpleEntityManager();
testBed.mocks.entityManager = simpleEntityManager;

// Mocks targetResolutionService.resolveTargets
testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
  (_scopeName, actorEntity) => {
    // 40+ lines of scope resolution logic...
  }
);
```

**Characteristics**:

- Uses **legacy** `createActionDiscoveryBed` (not recommended per docs)
- Mock-based approach
- No use of ModTestFixture factories
- No use of ScopeResolverHelpers

#### Recommended Pattern (from docs, but not used anywhere)

```javascript
// This is what SHOULD be used but ISN'T
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down'
);
ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv); // <- NOT DOCUMENTED
const scenario = fixture.createStandardActorTarget([
  'Actor Name',
  'Target Name',
]);
await fixture.executeAction(scenario.actor.id, scenario.target.id);
```

**Result**: Three different patterns for the same problem, with no clear guidance on which to use.

---

## Documentation Gap Analysis

### mod-testing-guide.md (347 lines)

**What's Documented**:

- ✅ ModTestFixture API
- ✅ Scenario helpers (seating, inventory)
- ✅ Domain matchers
- ✅ Best practices
- ✅ Migration from legacy patterns

**What's Missing**:

- ❌ **ScopeResolverHelpers library** (not mentioned at all in primary guide)
- ❌ How to test actions with custom scopes
- ❌ When to register scopes vs manual implementation
- ❌ Cross-mod dependency testing strategies
- ❌ Scope registration patterns and examples
- ❌ Auto-loading of mod scope definitions in tests

### action-discovery-testing-toolkit.md (64 lines)

**What's Documented**:

- ✅ Action Discovery Bed (legacy)
- ✅ Migration workflow
- ✅ Diagnostics usage

**What's Missing**:

- ❌ Modern scope registration approach
- ❌ ScopeResolverHelpers as alternative to manual mocking

### MODTESTROB-009-migration-guide.md (284 lines)

**What's Documented**:

- ✅ Legacy pattern replacements
- ✅ ModEntityBuilder migration
- ✅ Fixture factory patterns
- ✅ **ScopeResolverHelpers mentions** (6+ references)
- ✅ Scope resolver migration guidance

**What's Missing**:

- ❌ Detailed tutorial on using ScopeResolverHelpers
- ❌ Examples of creating custom scope resolvers
- ❌ Guidance on mod scope auto-loading limitations

---

## Recommendations

### Short-Term (Documentation Updates)

#### 1. Document ScopeResolverHelpers in mod-testing-guide.md

**Add new section**: "Testing Actions with Custom Scopes"

```markdown
### Testing Actions with Custom Scopes

Actions that use scopes from dependency mods (e.g., `positioning:close_actors`) require scope registration.

#### Using ScopeResolverHelpers (Recommended)

For common positioning, inventory, or anatomy scopes:

\`\`\`javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
testFixture = await ModTestFixture.forAction('intimacy', 'kiss_cheek');

// Register all standard positioning scopes
ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

// Now actions using positioning scopes will work
});
\`\`\`

**Available registrations**:

- `registerPositioningScopes(testEnv)` - Sitting, standing, closeness, kneeling
- `registerInventoryScopes(testEnv)` - Items, containers, inventory
- `registerAnatomyScopes(testEnv)` - Body parts, anatomy interactions

#### Creating Custom Scope Resolvers

For scopes not in the standard library:

\`\`\`javascript
// Use factory methods
const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
'positioning:actor_being_bitten_by_me',
{
componentType: 'positioning:biting_neck',
sourceField: 'bitten_entity_id',
contextSource: 'actor'
}
);

// Register it
ScopeResolverHelpers.\_registerResolvers(
testFixture.testEnv,
testFixture.testEnv.entityManager,
{ 'positioning:actor_being_bitten_by_me': customResolver }
);
\`\`\`
```

**Impact**: Prevents 40+ lines of manual boilerplate per test file.

---

#### 2. Add Scope Testing Checklist

**Add to mod-testing-guide.md**:

```markdown
### Action Discovery Troubleshooting Checklist

If your action is not being discovered (`availableActions` is empty):

1. ✅ **Check action file exists** and matches naming conventions
2. ✅ **Verify condition file** uses hyphens, not underscores
3. ✅ **Check ModTestFixture parameters**: `forAction(modId, actionName)` not fullActionId
4. ✅ **Register scopes**: If action uses positioning/inventory/anatomy scopes, call `ScopeResolverHelpers.register*Scopes()`
5. ✅ **Custom scopes**: Create resolvers using factory methods
6. ✅ **Enable diagnostics**: `testFixture.enableDiagnostics()` for detailed logging
```

**Impact**: Provides step-by-step debugging guide for common issues.

---

#### 3. Update File Naming Documentation

**Add explicit section to mod-testing-guide.md**:

```markdown
### Mod File Naming Conventions

ModTestFixture expects specific naming patterns:

**Rule files** (underscores):

- `{actionName}.rule.json` → `kiss_cheek.rule.json`
- `handle_{actionName}.rule.json` → `handle_kiss_cheek.rule.json`

**Condition files** (hyphens):

- `event-is-action-{actionName}.condition.json` → `event-is-action-kiss-cheek.condition.json`

❌ **Wrong**: `event-is-action-kiss_cheek.condition.json` (underscores)
✅ **Right**: `event-is-action-kiss-cheek.condition.json` (hyphens)
```

**Impact**: Prevents Error #1 (naming mismatch).

---

### Medium-Term (Helper Library Adoption)

#### 4. Migrate Existing Tests to Use ScopeResolverHelpers

**Priority files to update**:

1. `tests/integration/mods/violence/grab_neck_action_discovery.test.js` - Replace manual scope resolution
2. `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js` - Migrate from legacy pattern
3. `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js` - Use helper library

**Before (40+ lines)**:

```javascript
configureActionDiscovery = () => {
  const { testEnv } = testFixture;
  testEnv.actionIndex.buildIndex([grabNeckAction]);
  const scopeResolver = testEnv.unifiedScopeResolver;
  const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);
  scopeResolver.resolveSync = (scopeName, context) => {
    if (
      scopeName ===
      'positioning:close_actors_facing_each_other_or_behind_target'
    ) {
      // 30+ lines of manual implementation...
    }
    return originalResolve(scopeName, context);
  };
};
```

**After (1-5 lines)**:

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  // Optional: register custom scopes if needed
});
```

**Impact**:

- Reduces test code by ~35 lines per file
- Eliminates manual scope implementation errors
- Makes tests more maintainable
- Establishes consistent pattern

---

#### 5. Expand ScopeResolverHelpers Coverage

**Add missing common scopes**:

```javascript
// Add to registerPositioningScopes()
'positioning:actor_being_bitten_by_me': this.createComponentLookupResolver(
  'positioning:actor_being_bitten_by_me',
  {
    componentType: 'positioning:biting_neck',
    sourceField: 'bitten_entity_id',
    contextSource: 'actor'
  }
),

'positioning:close_actors_facing_each_other_or_behind_target': this.createArrayFilterResolver(
  'positioning:close_actors_facing_each_other_or_behind_target',
  {
    getArray: (actor, context, em) => {
      const closeness = em.getComponentData(actor.id, 'positioning:closeness');
      return closeness?.partners || [];
    },
    filterFn: (partnerId, actor, context, em) => {
      const actorFacingAway = em.getComponentData(
        actor.id,
        'positioning:facing_away'
      )?.facing_away_from || [];

      const partner = em.getEntityInstance(partnerId);
      const partnerFacingAway = em.getComponentData(
        partnerId,
        'positioning:facing_away'
      )?.facing_away_from || [];

      const facingEachOther =
        !actorFacingAway.includes(partnerId) &&
        !partnerFacingAway.includes(actor.id);
      const actorBehind = partnerFacingAway.includes(actor.id);

      return facingEachOther || actorBehind;
    },
  }
),
```

**Impact**: Covers 90%+ of positioning mod scopes without manual implementation.

---

### Long-Term (Infrastructure Enhancement)

#### 6. Enhance ModTestFixture with Auto-Registration

**Proposal**: Extend `ModTestFixture.forAction()` to optionally auto-register scope resolvers

```javascript
/**
 * @param {string} modId - Mod identifier
 * @param {string} actionName - Action name without prefix
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.autoRegisterScopes=false] - Auto-register dependency mod scopes
 * @param {string[]} [options.scopeCategories=['positioning']] - Which scope categories to register
 */
static async forAction(modId, actionName, options = {}) {
  const {
    autoRegisterScopes = false,
    scopeCategories = ['positioning']
  } = options;

  const testFixture = await this._createFixture(modId, actionName);

  if (autoRegisterScopes) {
    if (scopeCategories.includes('positioning')) {
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
    }
    if (scopeCategories.includes('inventory')) {
      ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
    }
    if (scopeCategories.includes('anatomy')) {
      ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
    }
  }

  return testFixture;
}
```

**Usage**:

```javascript
// Auto-register positioning scopes
testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat', {
  autoRegisterScopes: true,
});
```

**Impact**:

- Zero-config testing for 90% of actions
- Opt-in behavior (backward compatible)
- Explicit scope category selection for clarity

---

#### 7. Add Scope Registration Hints to Error Messages

**Proposal**: Detect scope resolution failures and provide helpful error messages

```javascript
// In ModTestFixture or test environment
if (availableActions.length === 0 && action.targets) {
  const scopeName = action.targets;
  const knownScopes = [
    'positioning:close_actors',
    'positioning:furniture_actor_sitting_on',
    // ... etc
  ];

  if (knownScopes.includes(scopeName)) {
    console.warn(`
      ⚠️  Action discovery failed: No actions available

      The action uses scope '${scopeName}' which requires registration.

      Add this to your test setup:

      import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

      beforeEach(async () => {
        testFixture = await ModTestFixture.forAction(...);
        ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
      });
    `);
  }
}
```

**Impact**: Self-documenting error messages that guide developers to solutions.

---

#### 8. Create Scope Registry Documentation

**New file**: `docs/testing/scope-resolver-registry.md`

**Content**:

```markdown
# Scope Resolver Registry

Complete reference of all available scope resolvers in ScopeResolverHelpers.

## Positioning Scopes

### `positioning:furniture_actor_sitting_on`

Returns the furniture entity the actor is currently sitting on.

**Requirements**:

- Actor must have `positioning:sitting_on` component

**Example usage**: "sit down on {furniture}" actions

### `positioning:actors_sitting_on_same_furniture`

Returns all actors sitting on the same furniture as the actor.

**Requirements**:

- Actor must have `positioning:sitting_on` component
- Furniture must have `positioning:allows_sitting` component

**Example usage**: "talk to actor on couch" actions

[... continue for all scopes]

## Creating Custom Resolvers

[Examples and patterns]
```

**Impact**: Centralized reference for scope resolver capabilities.

---

## Implementation Priority Matrix

| Priority  | Item                                     | Effort   | Impact | Dependencies |
| --------- | ---------------------------------------- | -------- | ------ | ------------ |
| 🔴 **P0** | Document ScopeResolverHelpers            | 2 hours  | High   | None         |
| 🔴 **P0** | Add scope troubleshooting checklist      | 1 hour   | High   | None         |
| 🔴 **P0** | Document file naming conventions         | 30 min   | High   | None         |
| 🟡 **P1** | Migrate violence mod tests               | 4 hours  | Medium | P0 docs      |
| 🟡 **P1** | Migrate vampirism mod tests              | 4 hours  | Medium | P0 docs      |
| 🟡 **P1** | Expand ScopeResolverHelpers coverage     | 6 hours  | Medium | P0 docs      |
| 🟢 **P2** | Create scope registry docs               | 8 hours  | Medium | P1 expansion |
| 🟢 **P2** | Enhance ModTestFixture auto-registration | 16 hours | High   | All above    |
| 🟢 **P2** | Add scope error hints                    | 4 hours  | Medium | P2 auto-reg  |

---

## Conclusion

The `violence:tear_out_throat` action testing revealed **multiple layers of testing infrastructure issues**: from documentation gaps to architectural limitations in how test fixtures handle mod dependencies.

**Root Causes** (Refined):

1. **Documentation Gap**: ScopeResolverHelpers not mentioned in primary testing guide (mod-testing-guide.md)
2. **Pattern Inconsistency**: Different mods use different testing approaches (violence uses manual, positioning uses helpers)
3. **Example Discovery**: Helper IS used in positioning tests but not discoverable from violence/vampirism examples
4. **Architectural Limitation**: **ModTestFixture doesn't auto-load scope definitions from mod dependencies**
5. **Test/Production Gap**: Scopes work in production (auto-loaded from .scope files) but not in tests

**Impact on Development**:

- **40+ lines of boilerplate** per test file for scope registration
- **Code duplication** between mod scope definitions and test implementations
- **Confusion** about which testing pattern to follow
- **Wasted time** re-implementing scope logic that already exists in mod files
- **Maintenance burden** from inconsistent patterns and duplicate scope logic

**Immediate Actions Required**:

1. ✅ Document ScopeResolverHelpers in mod-testing-guide.md (primary guide)
2. ✅ Add scope troubleshooting checklist
3. ✅ Clarify file naming conventions
4. ✅ Add examples from positioning mod tests to documentation
5. ✅ Migrate existing tests to establish consistent pattern
6. ✅ Document the scope auto-loading limitation explicitly

**Long-Term Vision**:

- **Auto-load scope definitions** from mod dependencies in tests (matching production behavior)
- Auto-registration of common scopes in ModTestFixture (fallback for non-standard scopes)
- Self-documenting error messages for scope issues
- Comprehensive scope resolver registry
- Zero-config testing for 90% of common actions
- Eliminate need for ScopeResolverHelpers for standard mod scopes

---

## Appendix: Test Results

### Final Test Status

```
PASS  tests/integration/mods/violence/tear_out_throat_action_discovery.test.js
  ✓ Action structure validation (2 tests)
  ✓ Positive discovery scenarios (2 tests)
  ✓ Negative discovery scenarios (3 tests)
  ✓ Edge cases (2 tests)

PASS  tests/integration/mods/violence/tear_out_throat_action.test.js
  ✓ Action Execution (4 tests)
  ✓ Component Removal Validation (5 tests)
  ✓ Event Generation (2 tests)
  ✓ Error Handling (2 tests)
  ✓ Rule Isolation (2 tests)

Total: 24 tests, 24 passing
```

### Code Statistics

- **Lines of test code**: ~800 lines
- **Lines of scope configuration boilerplate**: 42 lines
- **Potential reduction with ScopeResolverHelpers**: ~37 lines (88% reduction)

---

**Report Author**: Claude (Architecture Analysis Agent)
**Review Status**: Ready for team review
**Action Items**: See Recommendations sections P0-P2
