# Mod Testing Guide

> **Documentation Update (2025-10-26)**: This guide consolidates all mod testing guidance into a single source of truth. The following files have been removed as redundant: `TEAOUTTHR-008-auto-registration-migration.md`, `action-discovery-testing-toolkit.md`, and `MODTESTROB-009-migration-guide.md`. All unique content from these files has been preserved in this guide.

## Overview

This guide is the canonical reference for writing and maintaining **mod action tests** in the Living Narrative Engine. It unifies the fixture, scenario, discovery, and matcher guidance so authors have a single source of truth when building or modernizing suites. Every contemporary mod test relies on the following building blocks:

- [`ModTestFixture`](../../tests/common/mods/ModTestFixture.js) for fast action execution harnesses.
- Scenario builders from [`ModEntityScenarios`](../../tests/common/mods/ModEntityBuilder.js) for seated, inventory, and bespoke entity graphs.
- The validation proxy (`createActionValidationProxy`) for catching schema drift before the engine executes.
- Discovery tooling (`fixture.enableDiagnostics()`, `fixture.discoverWithDiagnostics()`, and the Action Discovery Bed helpers) for resolver introspection.
- Domain matchers from [`tests/common/mods/domainMatchers.js`](../../tests/common/mods/domainMatchers.js) and [`tests/common/actionMatchers.js`](../../tests/common/actionMatchers.js) for readable assertions.
- Scope registry from [`ScopeResolverHelpers` Registry](./scope-resolver-registry.md) for discovering available scopes and factory methods.

## Mod File Naming Conventions

ModTestFixture expects specific naming patterns for mod content files. Following these conventions is **critical** for test discovery to work correctly.

### Rule Files (Underscores)

Rule files use **underscores** to separate words in action names:

```
Format: {actionName}.rule.json
Examples:
  ✅ tear_out_throat.rule.json
  ✅ kiss_cheek.rule.json
  ✅ grab_neck.rule.json
  ❌ tear-out-throat.rule.json  (hyphens not allowed)
```

**Handler Rule Files** (also underscores):
```
Format: handle_{actionName}.rule.json
Examples:
  ✅ handle_tear_out_throat.rule.json
  ✅ handle_kiss_cheek.rule.json
  ❌ handle-tear-out-throat.rule.json  (hyphens not allowed)
```

### Condition Files (Hyphens)

Condition files use **hyphens** to separate words, regardless of whether the action name uses underscores:

```
Format: event-is-action-{actionName-with-hyphens}.condition.json
Examples:
  ✅ event-is-action-tear-out-throat.condition.json
  ✅ event-is-action-kiss-cheek.condition.json
  ✅ event-is-action-grab-neck.condition.json
  ❌ event-is-action-tear_out_throat.condition.json  (underscores not allowed)
  ❌ event_is_action_tear_out_throat.condition.json  (underscores not allowed)
```

**Key Rule**: Condition files **always** use hyphens, even if the action name itself uses underscores.

### Action Files (Underscores)

Action definition files use **underscores**:

```
Format: {actionName}.action.json
Examples:
  ✅ tear_out_throat.action.json
  ✅ kiss_cheek.action.json
  ❌ tear-out-throat.action.json  (hyphens not allowed)
```

### Component Files (Underscores)

Component definition files use **underscores**:

```
Format: {componentName}.component.json
Examples:
  ✅ biting_neck.component.json
  ✅ being_bitten_in_neck.component.json
  ❌ biting-neck.component.json  (hyphens not allowed)
```

### Scope Files (Underscores)

Scope definition files use **underscores**:

```
Format: {scopeName}.scope
Examples:
  ✅ actor_being_bitten_by_me.scope
  ✅ close_actors.scope
  ❌ actor-being-bitten-by-me.scope  (hyphens not allowed)
```

### Quick Reference Table

| File Type | Naming Convention | Example |
|-----------|------------------|---------|
| **Rule** | `{action_name}.rule.json` | `tear_out_throat.rule.json` |
| **Handler Rule** | `handle_{action_name}.rule.json` | `handle_tear_out_throat.rule.json` |
| **Condition** | `event-is-action-{action-name}.condition.json` | `event-is-action-tear-out-throat.condition.json` |
| **Action** | `{action_name}.action.json` | `tear_out_throat.action.json` |
| **Component** | `{component_name}.component.json` | `biting_neck.component.json` |
| **Scope** | `{scope_name}.scope` | `actor_being_bitten_by_me.scope` |

### Common Mistake: Mixing Conventions

❌ **WRONG** - Mixing hyphens and underscores inconsistently:
```
data/mods/violence/
├── actions/
│   └── tear_out_throat.action.json              ← underscores (correct)
├── rules/
│   ├── tear_out_throat.rule.json                ← underscores (correct)
│   └── handle_tear_out_throat.rule.json         ← underscores (correct)
└── conditions/
    └── event-is-action-tear_out_throat.condition.json  ← WRONG! Mixed conventions
```

✅ **CORRECT** - Consistent application of conventions:
```
data/mods/violence/
├── actions/
│   └── tear_out_throat.action.json              ← underscores (correct)
├── rules/
│   ├── tear_out_throat.rule.json                ← underscores (correct)
│   └── handle_tear_out_throat.rule.json         ← underscores (correct)
└── conditions/
    └── event-is-action-tear-out-throat.condition.json  ← hyphens (correct)
```

### Why These Conventions Exist

**Historical Context**: The condition file convention (hyphens) comes from the event naming system, which uses hyphens by convention. Rule files and other content files follow JavaScript/TypeScript naming conventions (underscores for multi-word identifiers).

**ModTestFixture Expectations**: The test framework is hardcoded to expect these specific patterns when auto-loading mod content files. Deviating from these conventions will cause test failures.

### Validation

To verify your mod follows conventions:

```bash
# Check for incorrect condition files (underscores)
find data/mods/{modId}/conditions -name "*_*.condition.json"
# Should return nothing

# Check for incorrect rule files (hyphens)
find data/mods/{modId}/rules -name "*-*.rule.json"
# Should return nothing

# Check for incorrect action files (hyphens)
find data/mods/{modId}/actions -name "*-*.action.json"
# Should return nothing
```

If these commands find files, rename them to follow the correct convention.

## Quick Start

> ⚠️ **Important**: Before starting, familiarize yourself with [Mod File Naming Conventions](#mod-file-naming-conventions). Incorrect naming will cause test failures.

```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';
import '../../common/actionMatchers.js';

describe('positioning:sit_down', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('makes the actor sit on the target furniture', async () => {
    const scenario = fixture.createSittingPair({ furnitureId: 'couch1' });

    await fixture.executeAction(
      scenario.seatedActors[0].id,
      scenario.furniture.id
    );

    const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
    expect(actor).toHaveComponent('positioning:sitting_on');
    expect(fixture.events).toHaveActionSuccess();
  });
});
```

> 💡 **Tip**: If your action uses scopes from dependency mods (positioning, items, anatomy), you'll need to register scope resolvers. See [Testing Actions with Custom Scopes](#testing-actions-with-custom-scopes) for details.

### Zero-Config Testing (Recommended)

For most actions, you can enable auto-registration to eliminate scope configuration boilerplate:

```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';

describe('violence:grab_neck - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    // Auto-register positioning scopes (auto-loads rule/condition files)
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:grab_neck',
      null,
      null,
      { autoRegisterScopes: true }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when actor and target are close', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
    const availableActions = testFixture.discoverActions(scenario.actor.id);

    expect(availableActions.map((a) => a.id)).toContain('violence:grab_neck');
  });
});
```

**Multiple Scope Categories**:

```javascript
testFixture = await ModTestFixture.forAction(
  'intimacy',
  'intimacy:caress_face',
  null,
  null,
  {
    autoRegisterScopes: true,
    scopeCategories: ['positioning', 'anatomy']
  }
);
```

**Backward Compatible** - Manual registration still works:

```javascript
testFixture = await ModTestFixture.forAction('violence', 'violence:grab_neck');
ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
```

**Valid Scope Categories**:
- `'positioning'` - Sitting, standing, closeness, facing scopes (default)
- `'inventory'` or `'items'` - Item, container, inventory scopes
- `'anatomy'` - Body part, anatomy interaction scopes

## Core Infrastructure

### Fixture API Essentials

The modern fixture factories replace the deprecated `ModTestFixture.createFixture()` and `ModTestHandlerFactory.createHandler()` helpers. Always await the static constructors and let the fixture manage entity creation.

```javascript
// ✅ Preferred pattern
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down'
);
const scenario = fixture.createStandardActorTarget(['Actor Name', 'Target Name']);
await fixture.executeAction(scenario.actor.id, scenario.target.id);

// ❌ Deprecated and unsupported
ModTestFixture.createFixture({ type: 'action' });
ModTestHandlerFactory.createHandler({ actionId: 'sit_down' });
new ModEntityBuilder(); // Missing ID and validation
```

| Method | Description | Key parameters | Returns |
| --- | --- | --- | --- |
| `forActionAutoLoad(modId, fullActionId, options?)` | Loads rule and condition JSON automatically. | `modId`, fully-qualified action ID, optional config overrides. | `ModActionTestFixture` |
| `forAction(modId, fullActionId, ruleFile?, conditionFile?, options?)` | Creates an action fixture with explicit overrides. | `modId`, action ID, optional rule/condition JSON, `options.autoRegisterScopes` (boolean), `options.scopeCategories` (string[]). | `ModActionTestFixture` |
| `forRule(modId, fullActionId, ruleFile?, conditionFile?)` | Targets resolver rules without executing the whole action. | `modId`, action ID, optional rule/condition JSON. | `ModActionTestFixture` |
| `forCategory(modId, options?)` | Builds a category-level harness for discovery-style assertions. | `modId`, optional configuration. | `ModCategoryTestFixture` |

#### Core instance helpers

| Method | Purpose | Highlights |
| --- | --- | --- |
| `createStandardActorTarget([actorName, targetName])` | Creates reciprocal actor/target entities with validated components. | Use the returned IDs rather than hard-coded strings. |
| `createSittingPair(options)` and other scenario builders | Provision seating, inventory, and bespoke setups. | Prefer these helpers before writing custom entity graphs. |
| `executeAction(actorId, targetId, options?)` | Runs the action and captures emitted events. | Options include `additionalPayload`, `originalInput`, `skipDiscovery`, `skipValidation`, and multi-target IDs such as `secondaryTargetId`. |
| `assertActionSuccess(message)` / legacy assertions | Provides backward-compatible assertions. | Prefer Jest matchers from `domainMatchers` for clearer failures. |
| `assertPerceptibleEvent(eventData)` | Validates perceptible event payloads. | Pair with event matchers when migrating legacy suites. |
| `clearEvents()` / `cleanup()` | Reset captured events and teardown resources. | Call `cleanup()` in `afterEach` to avoid shared state. |

**Usage notes**

- Always supply fully-qualified action IDs (e.g., `'intimacy:kiss_cheek'`).
- Scenario helpers eliminate the need for manual `ModEntityBuilder` usage; reach for them first.
- The fixture handles lifecycle resets—avoid reusing a fixture across tests unless you explicitly call `fixture.reset()`.
- Cleanup is mandatory: call `fixture.cleanup()` in `afterEach` blocks or shared helpers.

### Action Discovery Harness

The Action Discovery Bed complements the mod fixture when suites need to inspect resolver behavior or migrate legacy discovery suites.

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('my action suite', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('discovers the action for nearby actors', async () => {
    const { actor } = testBed.createActorTargetScenario();
    const result = await testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveAction('affection:place_hands_on_shoulders');
  });
});
```

| Helper | Purpose | Notes |
| --- | --- | --- |
| `createActionDiscoveryBed()` | Provision a validated bed with mocks, logging capture, and diagnostics toggles. | Pair with manual lifecycle management when suites need custom setup. |
| `describeActionDiscoverySuite(title, suiteFn, overrides?)` | Wrap `describe` to automate bed setup/teardown. | Ideal when modernizing multiple suites. |
| `createActorWithValidation(actorId, options)` | Build validated actors through `ModEntityBuilder`. | Use to mix custom entities with bed-managed fixtures. |
| `createActorTargetScenario(options)` | Produce an actor/target pair sharing a location with optional `closeProximity`. | Mirrors fixture scenario helpers. |
| `establishClosenessWithValidation(actor, target)` | Adds reciprocal `positioning:closeness` components safely. | Avoid manual component wiring. |
| `discoverActionsWithDiagnostics(actorOrId, options?)` | Run discovery and optionally capture `{ actions, diagnostics }`. | Set `includeDiagnostics` or `traceScopeResolution` only when needed. |
| `formatDiagnosticSummary(diagnostics)` | Present captured diagnostics for logging or snapshots. | Use when assertions fail to surface detailed traces. |
| `createDiscoveryServiceWithTracing(options?)` | Instantiate `ActionDiscoveryService` with tracing toggles. | Helpful for targeted debugging. |
| `getDebugLogs()`/`getInfoLogs()`/`getWarningLogs()`/`getErrorLogs()` | Retrieve captured log messages. | Enables log-based assertions without touching console output. |
| `createTracedScopeResolver(scopeResolver, traceContext)` | Wrap resolvers to capture per-scope decisions. | Use with `formatScopeEvaluationSummary(traceContext)`. |

#### Modernizing discovery suites

1. **Update imports** – Replace manual `SimpleEntityManager` wiring with `createActionDiscoveryBed()` and register the matchers module.
2. **Instantiate the bed** – Use `beforeEach` or `describeActionDiscoverySuite()` to avoid shared state.
3. **Rebuild entities** – Call `createActorTargetScenario()` and `createActorWithValidation()` for validated setup; mix legacy helpers after the bed seeds core entities.
4. **Establish relationships** – Use `establishClosenessWithValidation()` rather than mutating component maps.
5. **Run discovery** – `await testBed.discoverActionsWithDiagnostics(actor)`; enable diagnostics only while debugging.
6. **Assert with matchers** – Swap `.some()` loops for domain matchers such as `toHaveAction` and `toDiscoverActionCount`.
7. **Log selectively** – Format diagnostics with `formatDiagnosticSummary()` and guard logging so passing runs remain quiet.

### Diagnostics & Logging

#### enableDiagnostics()
Enable detailed logging for action discovery and execution debugging.

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');

  // Enable diagnostics - disable after debugging
  testFixture.enableDiagnostics();
});
```

**When to Use**:
- Action not being discovered
- Unexpected action execution results
- Scope resolution issues
- Debugging test failures

**Note**: Disable diagnostics in production tests (very verbose output)

#### Additional Diagnostic Tools

- Call `fixture.enableDiagnostics()` only while investigating failures. Clean up with `fixture.disableDiagnostics()` or `fixture.cleanup()`.
- `fixture.discoverWithDiagnostics(actorId, expectedActionId?)` funnels discovery through the fixture and returns trace summaries.
- The Action Discovery Bed exposes the same diagnostics payload through `discoverActionsWithDiagnostics()`; format traces with `formatDiagnosticSummary()` or `formatScopeEvaluationSummary()`.
- Guard diagnostic logging with environment checks (e.g., `if (process.env.DEBUG_DISCOVERY)`) to keep standard runs silent.
- Use the captured log accessors (`getDebugLogs()`, `getInfoLogs()`, etc.) instead of reading from `console` output.

### Domain Matchers

Import the relevant matcher modules once per suite to unlock expressive assertions.

| Matcher | Module | Best used for |
| --- | --- | --- |
| `toHaveActionSuccess(message?)` | `../../common/mods/domainMatchers.js` | Confirm successful action execution events. |
| `toHaveActionFailure()` | `../../common/mods/domainMatchers.js` | Assert the absence of success events. |
| `toHaveComponent(componentType)` / `toNotHaveComponent(componentType)` | `../../common/mods/domainMatchers.js` | Verify component presence on entities. |
| `toHaveComponentData(componentType, expectedData)` | `../../common/mods/domainMatchers.js` | Deep-match component payloads. |
| `toDispatchEvent(eventType)` | `../../common/mods/domainMatchers.js` | Validate emitted event types. |
| `toHaveAction(actionId)` | `../../common/actionMatchers.js` | Check that discovery included a specific action. |
| `toDiscoverActionCount(expectedCount)` | `../../common/actionMatchers.js` | Assert exact discovery counts. |
| `toHaveActionSuccess(message)` (discovery event form) | `../../common/actionMatchers.js` | Match action success events captured via the bed. |
| `toHaveComponent(componentType)` (entity matcher variant) | `../../common/actionMatchers.js` | Assert entity components when using the discovery bed. |
| `toBeAt(locationId)` | `../../common/actionMatchers.js` | Assert entity location relationships. |

Mix matcher usage with targeted entity inspections; for example, call `fixture.entityManager.getEntityInstance(actorId)` to inspect component payloads directly.

### Testing Actions with Custom Scopes

Actions that use scopes from dependency mods (e.g., `positioning:close_actors`, `positioning:furniture_actor_sitting_on`) require scope registration in tests. While the production engine auto-loads scope definitions from `.scope` files, **ModTestFixture does not automatically load scopes from dependency mods**.

> **✨ NEW: Unified Scope Registration System (2025-11-08)**
>
> A new unified `TestScopeResolverRegistry` system is now available for managing test scope resolvers. This system provides:
> - **Auto-discovery** of scopes from mod directories
> - **Centralized management** of all test scope resolvers
> - **Better error messages** when scopes are missing
> - **Dependency tracking** and validation
>
> **Quick Start:**
> ```javascript
> // NEW unified pattern (recommended for new tests)
> await testEnv.scopeResolverRegistry.discoverAndRegister(['positioning', 'inventory']);
>
> // Or use ModTestFixture's autoRegisterScopes option
> const fixture = await ModTestFixture.forAction('mod', 'action', null, null, {
>   autoRegisterScopes: true,
>   scopeCategories: ['positioning', 'inventory']
> });
> ```
>
> The old `ScopeResolverHelpers` API still works for backward compatibility. See the [Migration Guide](./test-scope-resolver-registry-migration-guide.md) for details.

#### Why Scope Registration is Required

The test environment is isolated and doesn't load all mod dependencies by default. When your action uses a scope like `positioning:close_actors`, you must register the scope resolver in your test setup.

#### Using ScopeResolverHelpers (Recommended)

For common positioning, inventory, or anatomy scopes, use the ScopeResolverHelpers library:

```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('intimacy', 'kiss_cheek');

  // Register all standard positioning scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Now actions using positioning scopes will work
});
```

**Available Registration Methods**:

| Method | Coverage | Scopes Registered | Use When |
|--------|----------|-------------------|----------|
| `registerPositioningScopes(testEnv)` | **26 scopes (90%+ coverage)**: Sitting, standing, closeness, kneeling, facing, straddling, lying, bending, furniture discovery, and specialized positioning patterns | 26 | Action uses positioning mod scopes |
| `registerInventoryScopes(testEnv)` | Items, containers, inventory, equipped items | 5 | Action uses items mod scopes |
| `registerAnatomyScopes(testEnv)` | Body parts, anatomy interactions | 2 | Action uses anatomy mod scopes |

**Positioning Scopes Coverage** (TEAOUTTHR-006 - 90%+ coverage):

<details>
<summary>Expand to see all 26 registered positioning scopes</summary>

**High Priority - Closeness & Facing (6 scopes)**:
- `positioning:close_actors` - Close actors excluding kneeling relationships
- `positioning:close_actors_facing_each_other` - Close actors facing each other (no kneeling)
- `positioning:actors_both_sitting_close` - Close actors both sitting
- `positioning:actor_biting_my_neck` - Entity biting actor's neck (reciprocal validation)
- `positioning:actors_sitting_close` - Close actors where actor is sitting
- `positioning:close_actors_or_entity_kneeling_before_actor` - Close actors plus those kneeling before actor

**Medium Priority - Straddling & Seating (3 scopes)**:
- `positioning:actor_im_straddling` - Entity actor is straddling
- `positioning:entity_actor_is_kneeling_before` - Entity actor is kneeling before
- `positioning:actors_sitting_with_space_to_right` - Sitting actors with 2+ empty spots to right

**Lower Priority - Furniture & Specialized (6 scopes)**:
- `positioning:available_furniture` - Furniture with empty sitting spots at location
- `positioning:available_lying_furniture` - Furniture with empty lying spots at location
- `positioning:furniture_im_lying_on` - Furniture actor is lying on
- `positioning:furniture_im_sitting_on` - Furniture actor is sitting on
- `positioning:surface_im_bending_over` - Surface actor is bending over
- `positioning:actors_im_facing_away_from` - Actors that actor is facing away from

**Previously Registered (11 scopes)**:
- `positioning:furniture_actor_sitting_on` - Furniture entity lookup
- `positioning:actors_sitting_on_same_furniture` - Actors sharing furniture
- `positioning:closest_leftmost_occupant` - Leftmost sitting actor
- `positioning:closest_rightmost_occupant` - Rightmost sitting actor
- `positioning:furniture_allowing_sitting_at_location` - Available seating
- `positioning:standing_actors_at_location` - Standing actors in room
- `positioning:sitting_actors` - All sitting actors
- `positioning:kneeling_actors` - All kneeling actors
- `positioning:furniture_actor_behind` - Furniture actor is standing behind
- `positioning:actor_being_bitten_by_me` - Entity actor is biting (reciprocal)
- `positioning:close_actors_facing_each_other_or_behind_target` - Complex facing/behind logic

</details>

#### Combining Multiple Scope Categories

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('intimacy', 'caress_face');

  // Register multiple scope categories
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
});
```

#### Creating Custom Scope Resolvers

For scopes not in the standard library, use the factory methods:

```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat');

  // Register standard scopes first
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Create custom scope resolver using factory
  const bitingResolver = ScopeResolverHelpers.createComponentLookupResolver(
    'positioning:actor_being_bitten_by_me',
    {
      componentType: 'positioning:biting_neck',
      sourceField: 'bitten_entity_id',
      contextSource: 'actor'
    }
  );

  // Register the custom resolver
  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { 'positioning:actor_being_bitten_by_me': bitingResolver }
  );
});
```

**Available Factory Methods**:

| Factory Method | Pattern | Example Use Case |
|----------------|---------|------------------|
| `createComponentLookupResolver()` | "Get entity ID from component field" | "Furniture actor is sitting on" |
| `createArrayFilterResolver()` | "Filter array of entities" | "Close actors facing each other" |
| `createLocationMatchResolver()` | "Entities at same location" | "Actors in same room" |
| `createComponentFilterResolver()` | "Entities with component" | "All sitting actors" |

#### Example: Complete Test Setup with Scopes

```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('violence:grab_neck - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    // Create fixture for action
    testFixture = await ModTestFixture.forAction('violence', 'grab_neck');

    // Register positioning scopes (1 line instead of 40+)
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when actor and target are close and facing', async () => {
    // Create scenario with standard helper
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Get available actions
    const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

    // Assert action is discovered
    expect(availableActions).toContain('violence:grab_neck');
  });
});
```

**Impact**: This approach reduces scope configuration from 40+ lines of manual implementation to 1-5 lines of helper calls.

## Testing Custom Mod-Specific Scopes

### Overview

When your mod defines custom scopes (`.scope` files) that reference conditions from dependency mods using `condition_ref`, you can use the **`registerCustomScope()` convenience method** to simplify setup. This method automatically handles scope file loading, parsing, condition discovery, and resolver registration with a single line of code.

The pattern covered here is distinct from the standard scope registration covered in [Testing Actions with Custom Scopes](#testing-actions-with-custom-scopes). Standard scopes (positioning, inventory, anatomy) can use `autoRegisterScopes: true`, but custom mod-specific scopes require explicit registration.

### Registering Custom Scopes (Simplified - Recommended)

**NEW (Recommended)**: Use the `registerCustomScope()` method to register custom scopes with automatic condition loading:

```javascript
describe('Action Discovery with Custom Scope', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // NEW: One line replaces 36+ lines of boilerplate
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when conditions are met', async () => {
    // Test implementation
  });
});
```

**What this method does automatically**:
- ✅ Loads the scope file from `data/mods/{modId}/scopes/{scopeName}.scope`
- ✅ Parses the scope definitions using `parseScopeDefinitions()`
- ✅ Extracts condition references from the scope AST
- ✅ Discovers transitive condition dependencies
- ✅ Loads all required conditions from dependency mods
- ✅ Creates a properly-structured resolver function
- ✅ Registers the resolver with `UnifiedScopeResolver`
- ✅ Provides clear error messages when scopes or conditions are missing

**Disabling Auto-Loading of Conditions**:

If you need to load conditions manually or your scope doesn't reference any conditions:

```javascript
await testFixture.registerCustomScope(
  'my-mod',
  'my-custom-scope',
  { loadConditions: false }
);
```

**Error Handling**:

The method provides clear, actionable errors:

```javascript
// File not found error:
// "Failed to read scope file at data/mods/my-mod/scopes/my-scope.scope: ENOENT..."

// Scope name not found error:
// "Scope "my-mod:my-scope" not found in file data/mods/my-mod/scopes/my-scope.scope.
//  Available scopes: my-mod:other_scope, my-mod:another_scope"
```

**Using the Static Helper** (without ModTestFixture):

If you're not using `ModTestFixture`, you can use the static helper method:

```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import { createSystemLogicTestEnv } from '../../../common/engine/systemLogicTestEnv.js';

// Create test environment
const testEnv = createSystemLogicTestEnv();

// Register custom scope using static helper
await ScopeResolverHelpers.registerCustomScope(
  testEnv,
  'sex-anal-penetration',
  'actors_with_exposed_asshole_accessible_from_behind'
);
```

**Lines Reduced**: This approach reduces custom scope registration from **36+ lines** of boilerplate to **1 line**.

**Before (36 lines)**:
```javascript
const scopeDefPath = path.join(
  __dirname,
  '../../../data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
);

const scopeDef = await parseScopeDefinitions(scopeDefPath);

const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
const scopeName = 'actors_with_exposed_asshole_accessible_from_behind';

const resolver = (runtimeCtx) => {
  const scopeAst = scopeDef[scopeName];
  const context = { actor: runtimeCtx.actor };

  try {
    return testFixture.testEnv.scopeEngine.resolve(
      scopeAst,
      context,
      runtimeCtx
    );
  } catch (err) {
    testFixture.testEnv.logger.error(
      `Failed to resolve custom scope "${scopeId}":`,
      err
    );
    throw err;
  }
};

ScopeResolverHelpers._registerResolvers(testFixture.testEnv, {
  [scopeId]: resolver,
});
```

**After (1 line)**:
```javascript
await testFixture.registerCustomScope(
  'sex-anal-penetration',
  'actors_with_exposed_asshole_accessible_from_behind'
);
```

### When to Use registerCustomScope()

Use `registerCustomScope()` when:

- ✅ Your mod has custom `.scope` files in `data/mods/your-mod/scopes/`
- ✅ These scopes use `{"condition_ref": "dependency-mod:condition-id"}` (auto-loaded)
- ✅ The scopes are mod-specific, not general positioning/inventory/anatomy scopes

**Do NOT use registerCustomScope() when**:

- ❌ Using standard scopes from positioning/inventory/anatomy mods (use `ScopeResolverHelpers.registerPositioningScopes()` etc. instead)
- ❌ Your mod has no custom scopes

**Prefer registerCustomScope() over the legacy manual pattern** documented below. The manual pattern is kept for reference and backwards compatibility only.

### Required Imports

Before implementing this pattern, ensure you have the following imports in your test file:

```javascript
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
```

### Loading Dependency Conditions (Simplified)

**NEW (Recommended)**: Use the `loadDependencyConditions()` method to load conditions from dependency mods with a single line:

```javascript
// Load positioning condition needed by the custom scope
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away'
]);
```

This method replaces the manual 10+ line workaround (Steps 1-2 below) with a single convenience call. It:
- ✅ Validates condition ID format
- ✅ Loads condition files from the correct mod directories
- ✅ Extends the `dataRegistry.getConditionDefinition` mock automatically
- ✅ Chains properly for multiple calls (additive behavior)
- ✅ Provides clear error messages when files are not found

**Multiple conditions** can be loaded in a single call:

```javascript
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away',
  'positioning:entity-not-in-facing-away'
]);
```

**Multiple calls** are additive:

```javascript
// First call
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away'
]);

// Later - adds to previously loaded conditions
await testFixture.loadDependencyConditions([
  'positioning:entity-not-in-facing-away'
]);
```

**When to use this method**:
- Your custom scope uses `condition_ref` to reference conditions from dependency mods
- You need to load conditions from mods like `positioning`, `items`, etc.
- You want to avoid verbose manual mock setup

After loading dependency conditions, proceed to **Step 3** below to register your custom scope.

---

### Step-by-Step Setup (Legacy Pattern)

> **Note**: Steps 1-2 below are replaced by the `loadDependencyConditions()` method above. This legacy pattern is documented for reference and backwards compatibility.

This pattern requires four steps to set up custom scope testing:

#### Step 1: Load Dependency Conditions (Legacy)

If your custom scope uses `condition_ref` to reference a condition from a dependency mod, you must load that condition file manually:

```javascript
// Load the positioning condition needed by the custom scope
const positioningCondition = await import(
  '../../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json',
  { assert: { type: 'json' } }
);
```

#### Step 2: Extend dataRegistry Mock

Extend the `dataRegistry.getConditionDefinition` mock to return the dependency condition when requested:

```javascript
// Save reference to original mock
const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;

// Extend mock to handle dependency conditions
testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((conditionId) => {
  if (conditionId === 'positioning:actor-in-entity-facing-away') {
    return positioningCondition.default;
  }
  // Fall back to original mock for other conditions
  return originalGetCondition(conditionId);
});
```

**Key Points**:
- Keep a reference to the original mock function
- Return the imported condition's `.default` property
- Fall back to the original mock for conditions not explicitly handled

#### Step 3: Load and Parse Custom Scope

Load your mod's custom scope file and parse it using `parseScopeDefinitions`:

```javascript
// Build path to your mod's custom scope file
const scopePath = path.join(
  process.cwd(),
  'data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
);

// Read and parse the scope file
const scopeContent = fs.readFileSync(scopePath, 'utf-8');
const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
```

**Notes**:
- `parseScopeDefinitions()` returns a Map of scope names to AST objects
- The scope file path is used for error reporting

#### Step 4: Create ScopeEngine and Register Resolver

Create a new `ScopeEngine` instance and register a resolver function for each parsed scope:

```javascript
// Create new ScopeEngine instance
const scopeEngine = new ScopeEngine();

// Register resolver for each parsed scope
for (const [scopeName, scopeAst] of parsedScopes) {
  const scopeResolver = (context) => {
    // Build runtime context with required services
    const runtimeCtx = {
      entityManager: testFixture.testEnv.entityManager,
      jsonLogicEval: testFixture.testEnv.jsonLogic,
      logger: testFixture.testEnv.logger,
    };

    // Resolve the scope using the engine
    const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);

    // Return in expected format for ScopeResolverHelpers
    return { success: true, value: result };
  };

  // Register the resolver
  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { [scopeName]: scopeResolver }
  );
}
```

**Important Details**:
- Create a **new** `ScopeEngine` instance (don't try to access an existing one)
- The resolver must return `{ success: true, value: result }`
- `context` parameter contains actor/entity properties (e.g., `{ actor: { id: 'actor-id' } }`)
- `runtimeCtx` must include `entityManager`, `jsonLogicEval`, and `logger`

### Complete Working Example

See the full implementation in:
- **File**: `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
- **Lines**: 23-69

This test demonstrates all four steps working together to test an action that uses a custom scope with dependency condition references.

### Code Comment Template

When implementing this pattern, document the dependencies your action uses:

```javascript
/**
 * This action uses custom scopes that reference:
 * - positioning:actor-in-entity-facing-away (condition) - must be loaded manually
 * - positioning:close_actors (scope) - auto-registered with autoRegisterScopes
 *
 * Manual scope setup required for mod-specific scope:
 * - sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind
 */
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('sex-anal-penetration', 'insert_finger_into_asshole');

  // Auto-register standard positioning scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Manual setup for custom scope (see steps 1-4 above)
  // ...
});
```

### Pattern Comparison Table

| Scenario | Method | Setup Required |
|----------|--------|----------------|
| Standard positioning scopes | `autoRegisterScopes: true, scopeCategories: ['positioning']` | None - automatic |
| Custom mod scopes (no dependency conditions) | Manual registration | Load scope file, register resolver (steps 3-4) |
| Custom mod scopes (with dependency conditions) | Manual registration + mock extension | Load condition, extend mock, load scope, register resolver (steps 1-4) |
| Mixed standard + custom scopes | Combine both approaches | `autoRegisterScopes: true` + manual setup for custom scopes |

### Key Implementation Details

#### ScopeEngine Pattern

The manual pattern creates a **new** `ScopeEngine` instance rather than accessing an existing one:

```javascript
const scopeEngine = new ScopeEngine();
```

**ScopeEngine.resolve() signature**:
```javascript
scopeEngine.resolve(ast, context, runtimeCtx, trace = null)
```

**Parameters**:
1. `ast` - Parsed scope AST from `parseScopeDefinitions()`
2. `context` - Context object with actor/entity properties (e.g., `{ actor: { id: 'actor-id' } }`)
3. `runtimeCtx` - Runtime context with `{ entityManager, jsonLogicEval, logger }`
4. `trace` - Optional trace context for debugging (defaults to `null`)

**Resolver wrapper**:
The resolver function wraps `scopeEngine.resolve()` and returns the expected format:
```javascript
const scopeResolver = (context) => {
  const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);
  return { success: true, value: result };
};
```

#### Custom Operators Auto-Registration

Custom operators (`hasPartOfType`, `hasClothingInSlot`, etc.) are **automatically registered** during fixture initialization:

- Registration happens in the DI initialization via `JsonLogicCustomOperators` service
- In ModTestFixture tests, this occurs automatically during `ModTestFixture.forAction()` call
- **No manual registration needed** in tests

**If you see "hasPartOfType is not a function" errors**: This is NOT an issue with ModTestFixture—the custom operators register automatically. Check that your test fixture is initialized properly.

### Troubleshooting

#### "Resolver for scope X not found"

**Cause**: Forgot to register the custom scope

**Solution**: Follow steps 3-4 to load and register your custom scope

#### "Condition Y is undefined"

**Cause**: Forgot to load the dependency condition that your scope references via `condition_ref`

**Solution**: Follow steps 1-2 to load the condition and extend the `dataRegistry.getConditionDefinition` mock

#### "hasPartOfType is not a function"

**Cause**: This is NOT an issue with ModTestFixture. Custom operators auto-register during fixture initialization.

**Solution**:
- Verify fixture is initialized: `testFixture = await ModTestFixture.forAction(...)`
- Check that you're using the fixture's test environment services
- Ensure `jsonLogicEval` in `runtimeCtx` is from `testFixture.testEnv.jsonLogic`

#### "Cannot read property 'default' of undefined"

**Cause**: Import statement is incorrect or condition file doesn't exist

**Solution**:
- Verify the condition file path is correct
- Use `assert: { type: 'json' }` in the import statement
- Check that the file exists at the specified path

### Best Practices

1. **Document dependencies clearly**: Use the code comment template to explain what conditions and scopes your test requires

2. **Keep scope setup in beforeEach**: Don't scatter setup across multiple test functions

3. **Use descriptive variable names**: Name condition imports clearly (e.g., `positioningCondition`, `anatomyCondition`)

4. **Test the setup**: Verify your custom scope works with a simple test before writing complex assertions

5. **Clean up**: The fixture's `cleanup()` method handles teardown, so no manual cleanup is needed

### Cross-References

**Helper files and utilities**:
- `tests/common/mods/scopeResolverHelpers.js` - Available helper methods and `_registerResolvers()`
- `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js` - Complete working example
- `src/scopeDsl/engine.js` - ScopeEngine API reference
- `src/scopeDsl/scopeDefinitionParser.js` - `parseScopeDefinitions()` function
- `src/logic/jsonLogicCustomOperators.js` - Custom operator auto-registration

**Related documentation**:
- [Testing Actions with Custom Scopes](#testing-actions-with-custom-scopes) - Standard scope registration
- [ScopeResolverHelpers Registry](./scope-resolver-registry.md) - Available scope factory methods

### Future Improvements

**Partial implementation complete**. The following improvements reduce setup boilerplate:

- ✅ **TESDATREG-002**: `loadDependencyConditions()` method - **IMPLEMENTED** (see [Loading Dependency Conditions](#loading-dependency-conditions-simplified))
- 🚧 **TESDATREG-004**: Add helper for automatic custom scope registration - **PLANNED**

The new `loadDependencyConditions()` method eliminates Steps 1-2 of the manual pattern (10+ lines reduced to 1 line):

```javascript
// Current API (Steps 1-2 simplified)
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away'
]);
```

Future improvements will further simplify custom scope registration (Steps 3-4):

```javascript
// Future API (not yet implemented - Steps 3-4)
await testFixture.registerCustomScope(
  'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind'
);
```

### Action Discovery Troubleshooting Checklist

If your action is not being discovered (`availableActions` returns empty array `[]`), follow this systematic checklist:

#### ✅ Step 1: Verify Action File Exists
**Check**: Action definition file is present and correctly named

```bash
# Check if action file exists
ls data/mods/{modId}/actions/{actionName}.action.json

# Example
ls data/mods/violence/actions/tear_out_throat.action.json
```

**Common Issues**:
- File missing or in wrong directory
- Incorrect file extension (should be `.action.json`)
- Typo in action name

**Fix**: Create or rename action file to match expected path

---

#### ✅ Step 2: Verify Condition File Naming
**Check**: Condition file uses **hyphens**, not underscores

```bash
# ❌ WRONG (underscores)
data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json

# ✅ CORRECT (hyphens)
data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json
```

**Rule**: Condition files use hyphens to separate words, even if action name uses underscores.

**Fix**: Rename condition file to use hyphens
```bash
mv data/mods/violence/conditions/event-is-action-tear_out_throat.condition.json \
   data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json
```

> **Note**: For complete file naming conventions, see the upcoming documentation in TEAOUTTHR-003.

---

#### ✅ Step 3: Verify ModTestFixture Parameters
**Check**: `forAction()` receives `(modId, actionName)`, not `(modId, fullActionId)`

```javascript
// ❌ WRONG - Double prefixing
const testFixture = await ModTestFixture.forAction('violence', 'violence:tear_out_throat');
// Results in: violence:violence:tear_out_throat

// ✅ CORRECT - Just action name
const testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat');
// Results in: violence:tear_out_throat
```

**Fix**: Remove mod prefix from action name parameter

---

#### ✅ Step 4: Register Dependency Mod Scopes
**Check**: If action uses positioning/inventory/anatomy scopes, they must be registered

```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');

  // ⚠️ REQUIRED: Register scopes if action uses them
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

**How to Check**: Look at action's `targets` field in action definition:
- `positioning:*` → Need `registerPositioningScopes()`
- `items:*` → Need `registerInventoryScopes()`
- `anatomy:*` → Need `registerAnatomyScopes()`

**Fix**: Add appropriate `register*Scopes()` call to `beforeEach()`

See [Testing Actions with Custom Scopes](#testing-actions-with-custom-scopes) for details.

---

#### ✅ Step 5: Handle Custom Scopes
**Check**: If action uses custom scopes not in standard library, create resolver

```javascript
// Check if scope is custom
const action = require('./data/mods/violence/actions/tear_out_throat.action.json');
console.log('Targets scope:', action.targets);
// Example: "positioning:actor_being_bitten_by_me"

// If not in standard library, create custom resolver
const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
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
  { 'positioning:actor_being_bitten_by_me': customResolver }
);
```

**How to Identify Custom Scopes**:
- Check `tests/common/mods/scopeResolverHelpers.js` for registered scopes
- If your scope isn't listed in `registerPositioningScopes()`, it's custom

**Fix**: Use factory methods to create and register custom resolver

---

#### ✅ Step 6: Enable Diagnostics Mode
**Check**: Enable detailed logging to see what's happening

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Enable diagnostics for detailed logging
  testFixture.enableDiagnostics();
});

it('should discover action', async () => {
  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

  // This will now log detailed discovery process
  const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

  expect(availableActions).toContain('violence:tear_out_throat');
});
```

**Diagnostics Output Shows**:
- Which actions were evaluated
- Which conditions passed/failed
- Scope resolution results
- Entity component states

**Fix**: Review diagnostic logs to identify specific failure point

---

#### Quick Checklist Summary

Use this quick checklist for rapid diagnosis:

1. ✅ **Action file exists** → `ls data/mods/{mod}/actions/{action}.action.json`
2. ✅ **Condition file uses hyphens** → `event-is-action-{action}.condition.json`
3. ✅ **Correct forAction() params** → `(modId, actionName)` not fullActionId
4. ✅ **Scopes registered** → Call `ScopeResolverHelpers.register*Scopes()`
5. ✅ **Custom scopes handled** → Create resolvers with factory methods
6. ✅ **Diagnostics enabled** → `testFixture.enableDiagnostics()`

#### Still Having Issues?

If action discovery still fails after this checklist:

1. **Verify entity components**: Ensure test entities have required components
   ```javascript
   console.log('Actor components:', scenario.actor.components);
   console.log('Target components:', scenario.target.components);
   ```

2. **Check action condition logic**: Review condition JSON for logical errors
   ```bash
   cat data/mods/{mod}/conditions/event-is-action-{action}.condition.json
   ```

3. **Validate rule execution**: Ensure rule file exists and is correctly formed
   ```bash
   cat data/mods/{mod}/rules/{action}.rule.json
   ```

4. **Review diagnostic logs**: Look for specific error messages or failed conditions

### Self-Documenting Error Hints

ModTestFixture provides automatic hints when action discovery fails due to missing scope registration:

```javascript
const availableActions = await testFixture.discoverActions(scenario.actor.id);
// ⚠️ Console Warning:
//    Action discovery found 0 actions
//    The action uses scope 'positioning:close_actors' which is not registered
//    Solution: Enable auto-registration or call registerPositioningScopes()
```

**Suppressing Hints** (for tests expecting empty results):
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
  testFixture.suppressHints(); // Don't warn for this test
});
```

## Best Practices

### Fixture Lifecycle

- Await factory methods inside `beforeEach` blocks for isolation.
- Pair every fixture with `afterEach(() => fixture.cleanup())` or register cleanup in shared helpers.
- Prefer `forAction` over `forActionAutoLoad` when you need explicit control of rule/condition overrides or validation proxies.

### Scenario Composition

- Reach for the scenario helpers documented in the [Scenario Helper Catalog](#scenario-helper-catalog) before crafting entities manually. They guarantee component completeness and naming consistency.
- Use `createSittingPair`, `createSittingArrangement`, and related helpers to cover seating variations; extend `additionalFurniture` or `seatedActors` overrides to exercise edge cases without rewriting the graph.
- Inventory flows should lean on `createInventoryLoadout`, `createPutInContainerScenario`, and related helpers. They expose entity IDs, containers, and held items so assertions stay declarative.
- When custom entities are inevitable, build them with `fixture.createEntity(config)` and reload the environment via `fixture.reset([...scenario.entities, customEntity])` to avoid partial state.

### Executing Actions Safely

- Always call `await fixture.executeAction(actorId, targetId, options?)`. The optional `options` object supports `additionalPayload`, `originalInput`, `skipDiscovery`, `skipValidation`, and extra identifiers such as `secondaryTargetId` or `tertiaryTargetId`; restrict `{ skipValidation: true }` to regression investigations.
- Validate `actorId` and `targetId` using scenario return values instead of hard-coded IDs—helper outputs are the single source of truth.
- Chain validation when preparing rules: wrap JSON definitions with `createActionValidationProxy(ruleJson, 'intimacy:kiss_cheek')` before handing them to the fixture. The proxy highlights typos (`required_components` vs `requiredComponents`) and missing namespace prefixes up front.

### Assertions & Anti-patterns

- Favor matcher-based assertions over manual array parsing or `.some()` checks.
- Avoid creating fixtures with deprecated factories (`ModTestFixture.createFixture`, `ModTestHandlerFactory.createHandler`).
- Do not build entities manually without fixture scenario helpers; missing components lead to resolver failures.
- Never hard-code action IDs without namespaces—always use the `modId:action_id` format for validation proxy compatibility.
- Do not reuse fixtures across tests without an explicit `fixture.reset()`.
- **Use ScopeResolverHelpers for dependency mod scopes** - Don't manually implement scope resolution logic when the helper library already provides it. This reduces boilerplate from 40+ lines to 1-5 lines.
- **Validate file naming conventions** - Run validation commands before testing to catch naming issues early:
  ```bash
  # Check for naming violations
  npm run validate:mod:{modId}
  ```

## Migration from Legacy Patterns

This section helps maintainers convert legacy mod tests to modern fixtures and helpers.

### Migration Baseline Tracking

Use the following table to capture the state of legacy helper usage before each migration batch begins. Tracking the counts for manual builders, assertion helpers, and domain matcher adoption makes it easy to measure progress as suites are modernised.

| Batch | Captured On | Suites using `ModEntityBuilder` | Suites using `ModAssertionHelpers` | Suites importing `domainMatchers.js` | Notes |
| --- | --- | --- | --- | --- | --- |
| Batch 1 (MODTESTROB-010-01) | 2025-10-22 | 127 | 29 | 0 | Baseline established prior to migrating priority integration suites. |

### Quick Pattern Reference

| Legacy Pattern | Replace With | Notes |
| --- | --- | --- |
| Manual `ModEntityBuilder` graphs constructed inline | Fixture scenario helpers such as `fixture.createSittingPair(options)`, `fixture.createInventoryTransfer(options)`, or `fixture.createOpenContainerScenario(options)` | Scenario helpers automatically register the same component graphs the builders created by hand. They are backed by `ModEntityScenarios` inside `tests/common/mods/ModTestFixture.js`. |
| `testFixture.reset([...entities])` calls before every assertion | Scenario helper return values combined with the fixture lifecycle methods (`beforeEach`, `afterEach`, `fixture.cleanup()`) | The helpers provision entities and register them with the fixture for you. Use the returned ids through `fixture.entityManager`. |
| `expect(...).toBe(true)` or raw array inspection on `testFixture.events` | `expect(testFixture.events).toHaveActionSuccess(...)`, `expect(entity).toHaveComponent(...)`, `expect(entity).toHaveComponentData(...)` | Import `../../common/mods/domainMatchers.js` at the top of each suite once. |
| Inline `testFixture.registerScopeResolver(...)` implementations | `ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv)` (or the relevant helper) | Centralising scope logic prevents drift and keeps diagnostics consistent. |
| Passing JSON definitions directly to `ModTestFixture.forAction(...)` | `createActionValidationProxy(json, 'label')` prior to invocation | Validation proxies surface schema drift immediately and are already described in the testing guide. |

### Example: Sitting Action Migration

**Legacy pattern:** manual builders, raw events, inline resolvers.

```javascript
const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
const furniture = new ModEntityBuilder('furniture1')
  .withComponent('positioning:allows_sitting', { spots: ['occupant1', null, 'actor1'] })
  .build();
const actor = new ModEntityBuilder('actor1')
  .asActor()
  .withComponent('positioning:sitting_on', { furniture_id: 'furniture1', spot_index: 2 })
  .build();

testFixture.reset([room, furniture, actor]);
await testFixture.executeAction('actor1', 'furniture1', {
  additionalPayload: { secondaryId: 'occupant1' },
});
expect(testFixture.events.some((evt) => evt.type === 'action/success')).toBe(true);
```

**Modern pattern:** fixture helpers, domain matchers, shared scopes.

```javascript
import '../../common/mods/domainMatchers.js';
import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';

let fixture;

beforeEach(async () => {
  fixture = await ModTestFixture.forAction('positioning', 'positioning:scoot_closer');
  ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
});

afterEach(() => {
  fixture.cleanup();
});

it('moves the actor closer to their partner', async () => {
  const scenario = fixture.createSittingPair({
    furnitureId: 'sofa1',
    seatedActors: [
      { id: 'actor1', name: 'Mover', spotIndex: 2 },
      { id: 'actor2', name: 'Partner', spotIndex: 0 },
    ],
  });

  await fixture.executeAction('actor1', scenario.furniture.id, {
    additionalPayload: { secondaryId: 'actor2' },
  });

  expect(fixture.events).toHaveActionSuccess('Mover scoots closer to Partner');
  const actor = fixture.entityManager.getEntityInstance('actor1');
  expect(actor).toHaveComponentData('positioning:sitting_on', {
    furniture_id: scenario.furniture.id,
    spot_index: 1,
  });
});
```

**For complete migration workflow**: See [Fixture Lifecycle](#fixture-lifecycle) and [Scenario Composition](#scenario-composition) sections above.

## Tool Selection Guide

```text
┌────────────────────────────────────────────┐
│ Do you need to run an action end-to-end?   │
└───────────────┬────────────────────────────┘
                │ Yes
                ▼
┌────────────────────────────────────────────┐
│ Can ModEntityScenarios build the entities? │
└───────────────┬────────────────────────────┘
                │ Yes                            No
                ▼                                 ▼
┌─────────────────────────────┐         ┌──────────────────────────────┐
│ Use ModTestFixture scenario │         │ Build custom entities with   │
│ helpers (e.g., createSitting│         │ fixture.createEntity + reset │
│ Pair, createInventoryLoadout│         │ then reuse executeAction     │
└─────────────────────────────┘         └──────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│ Did the action fail validation or resolve? │
└───────────────┬────────────────────────────┘
                │ Validation issue            Resolver issue
                ▼                             ▼
┌────────────────────────────┐       ┌─────────────────────────────────┐
│ Wrap JSON with              │      │ Enable diagnostics +            │
│ createActionValidationProxy │      │ discoverWithDiagnostics(actorId)│
└────────────────────────────┘       └─────────────────────────────────┘
```

## Scenario Helper Catalog

Scenario helpers pair fixtures with curated entity graphs. Each helper is available both on the fixture instance (`fixture.createSittingPair`) and as a static method on `ModEntityScenarios`. Prefer the fixture instance methods when already operating inside a test harness.

### Seating Scenarios

| Helper | Best for |
| --- | --- |
| `createSittingArrangement(options)` | Full control over seated, standing, and kneeling actors plus additional furniture. |
| `createSittingPair(options)` | Reciprocal seating relationships and closeness metadata for two actors sharing furniture. |
| `createSoloSitting(options)` | Sit/stand transitions where only one actor occupies a seat. |
| `createStandingNearSitting(options)` | Mixed posture scenarios with standing companions (including `standing_behind`). |
| `createSeparateFurnitureArrangement(options)` | Multiple furniture entities populated in a single call for comparison tests. |
| `createKneelingBeforeSitting(options)` | Seated actor plus kneeling observers linked by `positioning:kneeling_before`. |

```javascript
const scenario = fixture.createSittingPair({
  furnitureId: 'couch1',
  seatedActors: [
    { id: 'alice', name: 'Alice', spotIndex: 0 },
    { id: 'bob', name: 'Bob', spotIndex: 1 },
  ],
});

await fixture.executeAction(
  scenario.seatedActors[0].id,
  scenario.furniture.id
);

const actor = fixture.entityManager.getEntityInstance('alice');
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: scenario.furniture.id,
  spot_index: 0,
});
expect(actor.components['positioning:closeness'].partners).toContain('bob');
```

Usage tips:

- Override `seatedActors`, `standingActors`, or `kneelingActors` to control IDs, display names, and seat indices.
- Set `closeSeatedActors: false` when actors should sit apart without automatic closeness metadata.
- Provide `additionalFurniture` to preload extra seating surfaces for comparative assertions.
- Call `ModEntityScenarios.createSittingPair()` directly when building entities for cross-fixture reuse.

### Inventory Scenarios

| Helper | Purpose |
| --- | --- |
| `createInventoryLoadout(options)` | Actor with populated inventory and default capacity for ownership tests. |
| `createItemsOnGround(options)` | Loose items positioned in a room with optional observing actor. |
| `createContainerWithContents(options)` | Containers pre-filled with contents and optional key metadata. |
| `createInventoryTransfer(options)` | Two actors configured for `items:give_item` style transfers. |
| `createDropItemScenario(options)` | Actor ready to drop an owned item. |
| `createPickupScenario(options)` | Actor and ground item setup for `items:pick_up_item`. |
| `createOpenContainerScenario(options)` | Actor, container, and optional key for `items:open_container`. |
| `createPutInContainerScenario(options)` | Actor holding an item plus container prepared for storage actions. |

```javascript
const scenario = fixture.createPutInContainerScenario({
  actor: { id: 'actor_putter' },
  container: { id: 'supply_crate' },
  item: { id: 'supply', weight: 0.5 },
});

await fixture.executeAction('actor_putter', 'supply_crate', {
  additionalPayload: { secondaryId: scenario.heldItem.id },
});
```

Customization reference:

- **Capacity overrides** – Supply `capacity: { maxWeight, maxItems }` to loadout helpers; container helpers accept the same shape via `capacity` or `container.capacity`.
- **Locked containers** – Provide `requiresKey: true` (or `locked: true`) and include a `keyItem` to ensure the actor starts with the unlocking item.
- **Full inventories/containers** – Set `fullInventory: true` or `containerFull: true` to exercise capacity failure branches.
- **Item metadata** – Populate `itemData`, `portableData`, `weightData`, and `components` for precise assertions.

## Troubleshooting & Diagnostics Hygiene

### Validation Failures

- **Proxy errors** – When `createActionValidationProxy` reports invalid properties, follow the suggested replacement (e.g., rename `actionId` to `id`). Do not disable validation unless debugging third-party mods.
- **Namespace issues** – Errors referencing missing `:` separators indicate the action ID lacks a namespace. Update JSON definitions and fixture calls to include the prefix (e.g., `positioning:sit_down`).

### Discovery & Execution Failures

- **Action missing from discovery** – Enable diagnostics through the fixture or discovery bed, then review scope summaries. Empty operator/scope traces usually indicate missing components or closeness relationships.
- **Empty target scopes** – Scenario helpers guarantee valid scopes. If diagnostics show empty scopes, confirm overrides did not remove required components and that target IDs match the executed entity.
- **Execution throws for unknown entity** – Ensure the entity exists by using scenario return IDs or calling `fixture.reset([entity])` before `executeAction`.

### Matcher Failures

- **Matchers undefined** – Import `../../common/mods/domainMatchers.js` and/or `../../common/actionMatchers.js` at the suite top or in `jest.setup.js`.
- **Noisy component mismatch output** – Pair matchers with targeted logging during debugging (`console.log(fixture.entityManager.getEntityInstance(actorId).components)`), then remove the log after resolution.

### Diagnostics Hygiene

- Disable diagnostics after use (`fixture.disableDiagnostics()` or `fixture.cleanup()`). Lingering wrappers cause duplicate logging in unrelated tests.
- When capturing stdout snapshots, wrap diagnostics in conditionals to avoid brittle tests: `if (process.env.DEBUG_DISCOVERY) { fixture.discoverWithDiagnostics(actorId); }`.

## Performance & Collaboration Tips

- Cache fixtures only within a test when execution is expensive. For repeated assertions, perform setup in `beforeEach` and reuse the same fixture instance across `it` blocks only when the suite resets via `fixture.reset()` explicitly.
- Use the validation proxy in pre-commit hooks or data-review scripts to catch schema drift before running the full suite.
- Organize suites with [`tests/common/mods/examples`](../../tests/common/mods/examples) as references—each example demonstrates a recommended combination of fixture, scenario helper, and matcher usage.

## Action Test Checklist

Use this checklist before submitting a mod test update:

- [ ] Fixture created via `await ModTestFixture.forAction(modId, fullActionId)` (or another explicit factory) inside `beforeEach`.
- [ ] Entities provisioned with fixture scenario helpers or `createEntity`—no raw object literals sprinkled throughout the test.
- [ ] Action executed with `await fixture.executeAction(actorId, targetId, options?)` using scenario-provided IDs.
- [ ] Assertions leverage domain/discovery matchers (`toHaveActionSuccess`, `toHaveComponent`, `toHaveAction`, etc.) or clearly document deviations.
- [ ] Validation proxy exercised for new or modified rule JSON before running the suite.
- [ ] Diagnostics enabled only in targeted tests and cleaned up after use.
- [ ] Checklist items documented in the test description or comments when deviations are intentional.

By consolidating these practices in a single guide, contributors can author reliable mod tests without rediscovering patterns across individual suites.

## Common Pitfalls

### File Naming Mismatches
**Symptom**: Test fails with "Could not load condition file" error

**Cause**: Condition file uses underscores instead of hyphens

**Example Error**:
```
Could not load condition file for violence:tear_out_throat.
Tried paths: data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json
```

**Fix**: Rename condition file to use hyphens
```bash
# ❌ Wrong naming
event-is-action-tear_out_throat.condition.json

# ✅ Correct naming
event-is-action-tear-out-throat.condition.json
```

See [Mod File Naming Conventions](#mod-file-naming-conventions) for complete rules.

### Empty availableActions Array

If your test shows `availableActions` as an empty array `[]`, follow the [Action Discovery Troubleshooting Checklist](#action-discovery-troubleshooting-checklist) for systematic diagnosis.

### Scope Not Found Errors

If you see errors about undefined scopes:
- Import ScopeResolverHelpers and call the appropriate `register*Scopes()` method
- For custom scopes, use factory methods to create resolvers
- See [Creating Custom Scope Resolvers](#creating-custom-scope-resolvers) for examples
