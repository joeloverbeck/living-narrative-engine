# Integration Test Debugging Improvements Specification

## Status: Draft
**Created**: 2025-01-19
**Author**: Claude Code
**Purpose**: Document improvements to action integration testing infrastructure to enable faster debugging and clearer error messages

## Problem Statement

During debugging of kneeling position action restriction tests, several critical challenges emerged that significantly slowed troubleshooting:

1. **Entity Double-Nesting Bug**: Entity instances had `.id` property containing entire entity object instead of string ID - took significant debugging time to diagnose
2. **Missing ActionIndex Error**: Cryptic error "Cannot read properties of undefined (reading 'getCandidateActions')" provided no context about missing dependency
3. **Missing Pipeline Dependencies**: Generic "Cannot read property 'name' of undefined" errors gave no indication of which pipeline dependency was missing
4. **Silent Scope Resolution Failures**: Scope resolution returning empty arrays with no diagnostic information about why filters failed

These issues resulted in a lengthy debugging session (4 major error cycles) that could have been dramatically shortened with better testing infrastructure.

## Current State Analysis

### Existing Test Structure Strengths

- **SimpleEntityManager**: Good test utility for creating entities with component structure
- **Test Bed Pattern**: Established pattern for reusable test configurations (e.g., `actionDiscoveryServiceTestBed.js`)
- **Integration Test Coverage**: Tests verify end-to-end action discovery workflow

### Critical Gaps

1. **No Entity Structure Validation**: Tests assume entities have correct structure but don't validate before running
2. **No ActionPipelineOrchestrator Test Bed**: Each test manually configures complex orchestrator dependencies
3. **No Scope Resolution Diagnostics**: When scope returns unexpected results, no visibility into evaluation steps
4. **Generic Error Messages**: Jest assertions like `expect(actions).toContain(...)` provide minimal debugging context
5. **No Pipeline Stage Instrumentation**: Can't trace which pipeline stage removed which actions

## Proposed Solutions

### Solution 1: ActionIntegrationTestBed Class

**Purpose**: Provide pre-configured, reusable test bed for action integration tests following established test bed pattern.

**Location**: `tests/common/actions/actionIntegrationTestBed.js`

**Features**:
- Pre-configured `ActionPipelineOrchestrator` with all required dependencies
- Built-in entity creation helpers with automatic structure validation
- Diagnostic mode for step-by-step pipeline tracing
- Scope resolution debugging utilities
- Custom assertion helpers with detailed error messages

**API Design**:

```javascript
// Basic usage
const testBed = createActionIntegrationTestBed({
  diagnosticMode: false, // Set to true for detailed logging
});

// Entity creation with automatic validation
const actor = testBed.createActor('actor1', {
  components: {
    'core:name': { name: 'Alice' },
    'positioning:closeness': { partners: ['actor2'] },
  },
});

// Automatically validates:
// - entity.id is a string
// - entity.components is a getter returning object
// - No double-nesting (entity.id !== entity object)

// Establish relationships with validation
testBed.establishCloseness(actor, target);
testBed.makeActorKneelBefore(actor, target);

// Action discovery with diagnostics
const result = testBed.discoverActions(actor, {
  trace: false, // Set to true for step-by-step tracing
});

// Result includes detailed diagnostic info:
// {
//   actions: [...],
//   diagnostics: {
//     candidateActionsCount: 3,
//     candidateActionIds: [...],
//     stageResults: [
//       { stage: 'ComponentFilteringStage', input: 0, output: 3, removed: [] },
//       { stage: 'MultiTargetResolutionStage', input: 3, output: 0, removed: [...] },
//       // ... etc
//     ],
//     scopeEvaluations: {
//       'positioning:close_actors_or_entity_kneeling_before_actor': {
//         candidateEntities: ['actor2', 'actor3'],
//         passedFilter: [],
//         failedFilter: [
//           { entityId: 'actor2', reason: 'Condition failed: positioning:both-actors-facing-each-other' },
//           { entityId: 'actor3', reason: 'Condition failed: positioning:entity-kneeling-before-actor' },
//         ],
//       },
//     },
//   },
// }
```

**Implementation Guidelines**:

```javascript
class ActionIntegrationTestBed {
  #entityManager;
  #actionIndex;
  #actionPipelineOrchestrator;
  #diagnosticMode;
  #scopeTracer;

  constructor({ diagnosticMode = false, logger = null } = {}) {
    this.#diagnosticMode = diagnosticMode;
    this.#entityManager = new SimpleEntityManager({ logger });

    // Pre-configure all pipeline dependencies
    this.#actionIndex = this.#createActionIndex();
    this.#scopeTracer = new ScopeResolutionTracer({ diagnosticMode });
    this.#actionPipelineOrchestrator = this.#createOrchestrator();
  }

  createActor(id, { components = {} } = {}) {
    // Validate ID is string
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(`Entity ID must be non-empty string, got: ${typeof id}`);
    }

    // Create entity
    const entity = this.#entityManager.createEntity(id);

    // Add components
    for (const [componentId, data] of Object.entries(components)) {
      this.#entityManager.addComponent(id, componentId, data);
    }

    // Validate structure after creation
    this.#validateEntityStructure(entity);

    return entity;
  }

  #validateEntityStructure(entity) {
    // Validate entity.id is string, not object
    if (typeof entity.id !== 'string') {
      throw new Error(
        `Entity double-nesting detected! entity.id should be string but got: ${typeof entity.id}\n` +
        `This usually means an entity instance was passed instead of string ID.\n` +
        `Entity: ${JSON.stringify(entity, null, 2)}`
      );
    }

    // Validate entity.components is getter
    const descriptor = Object.getOwnPropertyDescriptor(entity, 'components');
    if (!descriptor || typeof descriptor.get !== 'function') {
      throw new Error(
        `Entity.components must be a getter function.\n` +
        `Entity: ${JSON.stringify(entity, null, 2)}`
      );
    }

    // Validate components returns object
    if (typeof entity.components !== 'object' || entity.components === null) {
      throw new Error(
        `Entity.components getter must return object, got: ${typeof entity.components}`
      );
    }
  }

  establishCloseness(actor, target) {
    const actorId = actor.id || actor;
    const targetId = target.id || target;

    // Validate both entities exist
    this.#assertEntityExists(actorId, 'actor');
    this.#assertEntityExists(targetId, 'target');

    // Add closeness components
    const actorCloseness = this.#entityManager.getComponent(actorId, 'positioning:closeness') || { partners: [] };
    const targetCloseness = this.#entityManager.getComponent(targetId, 'positioning:closeness') || { partners: [] };

    if (!actorCloseness.partners.includes(targetId)) {
      actorCloseness.partners.push(targetId);
    }
    if (!targetCloseness.partners.includes(actorId)) {
      targetCloseness.partners.push(actorId);
    }

    this.#entityManager.addComponent(actorId, 'positioning:closeness', actorCloseness);
    this.#entityManager.addComponent(targetId, 'positioning:closeness', targetCloseness);
  }

  discoverActions(actor, { trace = false } = {}) {
    const actorId = actor.id || actor;
    this.#assertEntityExists(actorId, 'actor');

    // Enable tracing if requested
    const originalMode = this.#diagnosticMode;
    if (trace) {
      this.#diagnosticMode = true;
      this.#scopeTracer.enable();
    }

    try {
      const result = this.#actionPipelineOrchestrator.discoverActions(actorId);

      return {
        actions: result,
        diagnostics: trace ? this.#scopeTracer.getResults() : null,
      };
    } finally {
      this.#diagnosticMode = originalMode;
      if (trace) {
        this.#scopeTracer.disable();
      }
    }
  }

  // ... other helper methods
}

function createActionIntegrationTestBed(options = {}) {
  return new ActionIntegrationTestBed(options);
}

export { createActionIntegrationTestBed, ActionIntegrationTestBed };
```

### Solution 2: Entity Structure Validators

**Purpose**: Catch entity structure issues immediately during test setup, not during action discovery.

**Location**: `tests/common/entities/entityValidators.js`

**API Design**:

```javascript
import { assertEntityStructure, assertComponentPresence } from '../../common/entities/entityValidators.js';

describe('Action Discovery', () => {
  it('should discover actions', () => {
    const actor = entityManager.createEntity('actor1');

    // Validate immediately after creation
    assertEntityStructure(actor); // Throws descriptive error if structure invalid

    entityManager.addComponent('actor1', 'positioning:closeness', { partners: ['actor2'] });

    // Validate component was added correctly
    assertComponentPresence(actor, 'positioning:closeness'); // Throws if missing

    // Continue with test...
  });
});
```

**Implementation**:

```javascript
/**
 * Validates entity has correct structure with detailed error messages
 * @param {object} entity - Entity instance to validate
 * @throws {Error} If entity structure is invalid
 */
function assertEntityStructure(entity) {
  if (!entity || typeof entity !== 'object') {
    throw new Error(`Entity must be object, got: ${typeof entity}`);
  }

  if (typeof entity.id !== 'string') {
    const actualType = typeof entity.id;
    const actualValue = actualType === 'object' ? JSON.stringify(entity.id, null, 2) : String(entity.id);

    throw new Error(
      `ENTITY DOUBLE-NESTING DETECTED!\n` +
      `\n` +
      `entity.id should be a STRING but is ${actualType}:\n` +
      `${actualValue}\n` +
      `\n` +
      `This usually happens when:\n` +
      `1. An entity instance was passed to addComponent() instead of string ID\n` +
      `2. A helper function used 'entity' instead of 'entity.id || entity'\n` +
      `\n` +
      `Fix by ensuring all entityManager calls use string IDs:\n` +
      `  ❌ entityManager.addComponent(entity, componentId, data)\n` +
      `  ✅ entityManager.addComponent(entity.id || entity, componentId, data)\n`
    );
  }

  const descriptor = Object.getOwnPropertyDescriptor(entity, 'components');
  if (!descriptor || typeof descriptor.get !== 'function') {
    throw new Error(
      `Entity.components must be a GETTER function.\n` +
      `Got: ${descriptor ? typeof descriptor.get : 'no descriptor'}\n` +
      `\n` +
      `Expected structure:\n` +
      `  get components() { return this.#components; }\n`
    );
  }

  if (typeof entity.components !== 'object' || entity.components === null) {
    throw new Error(
      `Entity.components getter must return OBJECT, got: ${typeof entity.components}\n` +
      `\n` +
      `The getter is defined correctly but returns wrong type.\n`
    );
  }
}

/**
 * Validates entity has specific component with detailed error message
 * @param {object} entity - Entity instance
 * @param {string} componentId - Component ID to check
 * @throws {Error} If component is missing
 */
function assertComponentPresence(entity, componentId) {
  assertEntityStructure(entity); // First validate entity structure

  const component = entity.components[componentId];
  if (component === undefined) {
    const availableComponents = Object.keys(entity.components);

    throw new Error(
      `Component '${componentId}' NOT FOUND on entity '${entity.id}'\n` +
      `\n` +
      `Available components:\n` +
      `${availableComponents.length > 0 ? availableComponents.map(c => `  - ${c}`).join('\n') : '  (none)'}\n` +
      `\n` +
      `This usually means:\n` +
      `1. Component was never added: Call entityManager.addComponent('${entity.id}', '${componentId}', data)\n` +
      `2. Component ID typo: Check spelling and namespace\n` +
      `3. Component was removed: Check for removeComponent() calls\n`
    );
  }
}

export { assertEntityStructure, assertComponentPresence };
```

### Solution 3: Scope Resolution Diagnostics

**Purpose**: Provide detailed tracing of scope evaluation showing why entities passed or failed filters.

**Location**: `tests/common/scopeDsl/scopeResolutionTracer.js`

**API Design**:

```javascript
import { traceScopeResolution } from '../../common/scopeDsl/scopeResolutionTracer.js';

describe('Scope Resolution', () => {
  it('should resolve targets correctly', () => {
    const actor = createActor('actor1');
    const target = createActor('actor2');
    establishCloseness(actor, target);

    // Trace scope evaluation
    const trace = traceScopeResolution({
      scope: 'positioning:close_actors_or_entity_kneeling_before_actor',
      actor,
      entityManager,
      scopeResolver,
      conditionRegistry,
    });

    // Trace includes detailed breakdown:
    console.log(trace.summary);
    // Output:
    // Scope: positioning:close_actors_or_entity_kneeling_before_actor
    // Candidate entities: 1 (actor2)
    // Passed filter: 0
    // Failed filter: 1
    //
    // Failed entities:
    //   actor2:
    //     - Condition 'positioning:both-actors-facing-each-other' failed
    //     - Evaluation context: { actor: { id: 'actor1', ... }, entity: { id: 'actor2', ... } }
    //     - Logic result: false
    //     - Reason: actor.components.positioning:facing_away.facing_away_from includes 'actor2'

    expect(trace.passedEntities).toEqual(['actor2']);
  });
});
```

**Implementation**:

```javascript
class ScopeResolutionTracer {
  #enabled = false;
  #traces = [];

  enable() {
    this.#enabled = true;
    this.#traces = [];
  }

  disable() {
    this.#enabled = false;
  }

  recordEvaluation(scopeId, candidateEntity, context, filterResult, reason) {
    if (!this.#enabled) return;

    this.#traces.push({
      scopeId,
      candidateEntity,
      context,
      filterResult,
      reason,
      timestamp: Date.now(),
    });
  }

  getResults() {
    return {
      evaluations: this.#traces,
      summary: this.#generateSummary(),
    };
  }

  #generateSummary() {
    const byScope = {};

    for (const trace of this.#traces) {
      if (!byScope[trace.scopeId]) {
        byScope[trace.scopeId] = {
          total: 0,
          passed: 0,
          failed: 0,
          failureReasons: {},
        };
      }

      byScope[trace.scopeId].total++;
      if (trace.filterResult) {
        byScope[trace.scopeId].passed++;
      } else {
        byScope[trace.scopeId].failed++;
        byScope[trace.scopeId].failureReasons[trace.reason] =
          (byScope[trace.scopeId].failureReasons[trace.reason] || 0) + 1;
      }
    }

    return byScope;
  }
}

function traceScopeResolution({ scope, actor, entityManager, scopeResolver, conditionRegistry }) {
  const tracer = new ScopeResolutionTracer();
  tracer.enable();

  // Instrument scope resolver to record evaluations
  const originalResolve = scopeResolver.resolve.bind(scopeResolver);
  scopeResolver.resolve = (...args) => {
    const result = originalResolve(...args);

    // Record each entity evaluation
    // ... instrumentation code ...

    return result;
  };

  try {
    const result = scopeResolver.resolve(scope, { actor });

    return {
      result,
      passedEntities: result,
      trace: tracer.getResults(),
      summary: generateReadableSummary(tracer.getResults()),
    };
  } finally {
    scopeResolver.resolve = originalResolve;
    tracer.disable();
  }
}

export { ScopeResolutionTracer, traceScopeResolution };
```

### Solution 4: Pipeline Stage Instrumentation

**Purpose**: Add diagnostic mode to ActionPipelineOrchestrator showing exactly which stage removed which actions.

**Location**: Modify `src/actions/actionPipelineOrchestrator.js`

**API Design**:

```javascript
const orchestrator = new ActionPipelineOrchestrator({
  // ... existing params ...
  diagnosticMode: true, // Enable pipeline tracing
});

const result = orchestrator.discoverActions('actor1');
// result now includes diagnostics:
// {
//   actions: [...],
//   _diagnostics: {
//     stages: [
//       {
//         name: 'ComponentFilteringStage',
//         input: { actionCount: 0 },
//         output: { actionCount: 3, actionIds: ['affection:place_hands_on_shoulders', ...] },
//       },
//       {
//         name: 'MultiTargetResolutionStage',
//         input: { actionCount: 3, actionIds: [...] },
//         output: { actionCount: 0, actionIds: [] },
//         removed: [
//           { actionId: 'affection:place_hands_on_shoulders', reason: 'No targets resolved' },
//           { actionId: 'affection:ruffle_hair_playfully', reason: 'No targets resolved' },
//           { actionId: 'affection:massage_shoulders', reason: 'No targets resolved' },
//         ],
//       },
//     ],
//   },
// }
```

**Implementation Guidelines**:

```javascript
class ActionPipelineOrchestrator {
  #diagnosticMode;

  constructor({ diagnosticMode = false, ...otherParams }) {
    this.#diagnosticMode = diagnosticMode;
    // ... existing constructor code ...
  }

  discoverActions(actorId) {
    const diagnostics = this.#diagnosticMode ? { stages: [] } : null;

    try {
      let actions = [];

      for (const stage of this.#stages) {
        const input = this.#diagnosticMode ? {
          actionCount: actions.length,
          actionIds: actions.map(a => a.id),
        } : null;

        actions = stage.process(actions, actorId);

        if (this.#diagnosticMode) {
          diagnostics.stages.push({
            name: stage.constructor.name,
            input,
            output: {
              actionCount: actions.length,
              actionIds: actions.map(a => a.id),
            },
            removed: this.#calculateRemoved(input.actionIds, actions.map(a => a.id)),
          });
        }
      }

      if (this.#diagnosticMode) {
        return { actions, _diagnostics: diagnostics };
      }
      return actions;

    } catch (err) {
      // ... error handling ...
    }
  }

  #calculateRemoved(inputIds, outputIds) {
    const outputSet = new Set(outputIds);
    return inputIds
      .filter(id => !outputSet.has(id))
      .map(id => ({ actionId: id, reason: 'Removed by stage' }));
  }
}
```

### Solution 5: Custom Jest Matchers

**Purpose**: Provide domain-specific assertions with detailed, actionable error messages.

**Location**: `tests/common/matchers/actionMatchers.js`

**API Design**:

```javascript
import '../../common/matchers/actionMatchers.js';

describe('Action Discovery', () => {
  it('should discover action for target', () => {
    const actions = discoverActions(actor);

    // Instead of generic expect
    expect(actions).toHaveActionForTarget('affection:place_hands_on_shoulders', 'actor2');

    // Failure message:
    // Expected to find action 'affection:place_hands_on_shoulders' with target 'actor2'
    //
    // Actions discovered: 2
    //   1. affection:tickle_target_playfully → actor3
    //   2. affection:ruffle_hair_playfully → actor3
    //
    // Action 'affection:place_hands_on_shoulders' was NOT discovered.
    //
    // Possible reasons:
    //   1. Action filtered out by ComponentFilteringStage (actor missing required components)
    //   2. Action filtered out by MultiTargetResolutionStage (scope returned no targets)
    //   3. Action filtered out by TargetComponentValidationStage (target missing required components)
    //
    // To debug:
    //   - Use traceScopeResolution() to see why scope didn't return 'actor2'
    //   - Use diagnosticMode: true on ActionPipelineOrchestrator to see which stage removed action
    //   - Use assertComponentPresence() to verify actor/target have required components
  });

  it('should resolve correct number of targets', () => {
    expect(scopeResolver).toResolveTargets('positioning:close_actors', actor, 2);

    // Failure message:
    // Expected scope 'positioning:close_actors' to resolve 2 targets but got 0
    //
    // Scope definition:
    //   actor.components.positioning:closeness.partners[][{...filters...}]
    //
    // Candidate entities (from closeness.partners): ['actor2', 'actor3']
    //
    // Filter results:
    //   actor2: FAILED
    //     - Condition 'positioning:both-actors-facing-each-other' returned false
    //     - JSON Logic context: { actor: {...}, entity: {...} }
    //     - Specific check that failed: actor.components.positioning:facing_away.facing_away_from
    //
    //   actor3: FAILED
    //     - Condition 'positioning:both-actors-facing-each-other' returned false
    //
    // To fix:
    //   - Verify entities have correct facing_away components
    //   - Use traceScopeResolution() for detailed evaluation trace
  });
});
```

**Implementation**:

```javascript
expect.extend({
  toHaveActionForTarget(received, actionId, targetId) {
    const actions = Array.isArray(received) ? received : received.actions || [];

    const matchingAction = actions.find(a =>
      a.id === actionId &&
      (a.target === targetId || a.targets?.includes(targetId))
    );

    const pass = matchingAction !== undefined;

    if (pass) {
      return {
        pass: true,
        message: () => `Expected NOT to find action '${actionId}' with target '${targetId}'`,
      };
    }

    // Generate detailed failure message
    const discoveredActions = actions.map((a, i) =>
      `  ${i + 1}. ${a.id} → ${a.target || a.targets?.join(', ') || '(no target)'}`
    ).join('\n');

    const actionWasDiscovered = actions.some(a => a.id === actionId);
    const targetsForAction = actionWasDiscovered
      ? actions.filter(a => a.id === actionId).map(a => a.target || a.targets)
      : null;

    return {
      pass: false,
      message: () =>
        `Expected to find action '${actionId}' with target '${targetId}'\n` +
        `\n` +
        `Actions discovered: ${actions.length}\n` +
        (actions.length > 0 ? discoveredActions : '  (none)') + `\n` +
        `\n` +
        (actionWasDiscovered
          ? `Action '${actionId}' WAS discovered but with different targets: ${JSON.stringify(targetsForAction)}\n` +
            `\n` +
            `This means:\n` +
            `  - Action passed ComponentFilteringStage (actor has required components)\n` +
            `  - Action passed MultiTargetResolutionStage (scope returned SOME targets)\n` +
            `  - But target '${targetId}' was not in the resolved targets\n` +
            `\n` +
            `To debug:\n` +
            `  - Use traceScopeResolution() to see why '${targetId}' wasn't included\n` +
            `  - Check if '${targetId}' is in actor's closeness.partners\n` +
            `  - Verify '${targetId}' passes all scope filter conditions\n`
          : `Action '${actionId}' was NOT discovered.\n` +
            `\n` +
            `Possible reasons:\n` +
            `  1. ComponentFilteringStage: Actor missing required components\n` +
            `  2. MultiTargetResolutionStage: Scope returned no targets\n` +
            `  3. TargetComponentValidationStage: Targets missing required components\n` +
            `  4. Action not loaded in ActionIndex\n` +
            `\n` +
            `To debug:\n` +
            `  - Use diagnosticMode: true on ActionPipelineOrchestrator\n` +
            `  - Use assertComponentPresence() to verify components\n` +
            `  - Check ActionIndex contains action: actionIndex.getCandidateActions(actor)\n`
        ),
    };
  },

  toResolveTargets(scopeResolver, scopeId, actor, expectedCount) {
    // Implementation with detailed scope resolution tracing
    // ...
  },
});
```

## Implementation Roadmap

### Phase 1: Foundation (High Priority)
- [ ] Create `ActionIntegrationTestBed` class
- [ ] Implement entity structure validators
- [ ] Add custom Jest matchers

**Estimated Effort**: 2-3 days
**Impact**: Immediate improvement to test debugging experience

### Phase 2: Diagnostics (Medium Priority)
- [ ] Implement `ScopeResolutionTracer`
- [ ] Add pipeline diagnostic mode
- [ ] Create helper function `traceScopeResolution()`

**Estimated Effort**: 2-3 days
**Impact**: Significantly faster debugging of scope resolution issues

### Phase 3: Migration (Low Priority)
- [ ] Update existing integration tests to use test bed
- [ ] Document migration guide
- [ ] Create examples for common scenarios

**Estimated Effort**: 1-2 weeks
**Impact**: Consistency across test suite

## Success Metrics

### Before Implementation (Current State)
- **Average debugging time for integration test failure**: 2-4 hours
- **Error messages**: Generic ("Cannot read property of undefined")
- **Root cause identification**: Manual code inspection required
- **Entity structure bugs**: Discovered late during action discovery

### After Implementation (Target State)
- **Average debugging time for integration test failure**: 15-30 minutes
- **Error messages**: Specific with actionable guidance
- **Root cause identification**: Provided in test failure message
- **Entity structure bugs**: Caught immediately during test setup

## Example: Before vs After

### Before Implementation

```javascript
describe('Kneeling Position Actions', () => {
  it('should discover actions when neither is kneeling', () => {
    // Manual setup - easy to make mistakes
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:name', { name: 'Alice' }); // BUG: passed entity instead of ID

    const target = entityManager.createEntity('actor2');
    establishCloseness(actor, target);

    const actions = actionDiscoveryService.discoverActionsForActor('actor1');

    // Generic assertion - unhelpful when fails
    expect(actions.some(a => a.id === 'affection:place_hands_on_shoulders')).toBe(true);
    // FAILS with: "Expected true but got false"
    // No information about WHY it failed
  });
});
```

**Debugging process**:
1. Test fails with generic message ❌
2. Add console.log to see discovered actions
3. Realize action wasn't discovered
4. Add console.log to pipeline stages
5. Discover entity.id is an object
6. Search through helper functions to find bug
7. Fix bug and re-run
8. **Total time**: 2+ hours

### After Implementation

```javascript
import { createActionIntegrationTestBed } from '../../common/actions/actionIntegrationTestBed.js';
import '../../common/matchers/actionMatchers.js';

describe('Kneeling Position Actions', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionIntegrationTestBed({ diagnosticMode: true });
  });

  it('should discover actions when neither is kneeling', () => {
    // Test bed validates structure automatically
    const actor = testBed.createActor('actor1', {
      components: {
        'core:name': { name: 'Alice' },
        'positioning:closeness': { partners: [] },
      },
    }); // Would throw immediately if structure invalid

    const target = testBed.createActor('actor2');
    testBed.establishCloseness(actor, target); // Validates before modifying

    const result = testBed.discoverActions(actor);

    // Custom matcher with detailed error messages
    expect(result).toHaveActionForTarget('affection:place_hands_on_shoulders', 'actor2');
    // FAILS with detailed message:
    //
    // Expected to find action 'affection:place_hands_on_shoulders' with target 'actor2'
    //
    // Actions discovered: 0
    //
    // Action was NOT discovered.
    //
    // Pipeline diagnostics:
    //   ComponentFilteringStage: 0 → 3 actions
    //   MultiTargetResolutionStage: 3 → 0 actions
    //     Removed: affection:place_hands_on_shoulders (No targets resolved)
    //
    // Scope 'positioning:close_actors_or_entity_kneeling_before_actor' evaluation:
    //   Candidate entities: ['actor2']
    //   Passed: []
    //   Failed: ['actor2']
    //     - actor2: Condition 'positioning:both-actors-facing-each-other' failed
    //       Context: actor.components.positioning:facing_away = undefined
    //       Reason: Component missing
    //
    // To fix:
    //   Add facing_away component to both actors with empty arrays
  });
});
```

**Debugging process**:
1. Test fails with detailed diagnostic message ✅
2. Message shows exactly which stage removed action
3. Message shows exactly which component is missing
4. **Total time**: 5-10 minutes

## Testing the Improvements

### Unit Tests Required
- [ ] `ActionIntegrationTestBed.test.js` - Test bed functionality
- [ ] `entityValidators.test.js` - Validator error messages
- [ ] `scopeResolutionTracer.test.js` - Tracing accuracy
- [ ] `actionMatchers.test.js` - Custom matcher behavior

### Integration Tests Required
- [ ] Create example test using new test bed
- [ ] Verify diagnostic mode produces expected output
- [ ] Validate error messages are actionable

## Documentation

### Files to Create
- [ ] `/docs/testing/action-integration-test-bed.md` - Test bed usage guide
- [ ] `/docs/testing/debugging-action-discovery.md` - Debugging guide with examples
- [ ] `/docs/testing/custom-matchers.md` - Custom matcher reference

### Files to Update
- [ ] `/README.md` - Add section on testing improvements
- [ ] `/tests/README.md` - Reference new testing utilities

## Migration Guide

For existing tests, migration is optional but recommended:

```javascript
// Old approach (still works)
const entityManager = new SimpleEntityManager();
const actor = entityManager.createEntity('actor1');
entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });

// New approach (recommended)
const testBed = createActionIntegrationTestBed();
const actor = testBed.createActor('actor1', {
  components: {
    'core:name': { name: 'Alice' },
  },
});
```

**Benefits of migration**:
- Automatic entity structure validation
- Better error messages on test failure
- Access to diagnostic tracing
- Consistent test setup across suite

## Future Enhancements

### Potential Additions
1. **Visual Pipeline Debugger**: Web UI showing pipeline flow with action filtering
2. **Scope Resolution Playground**: Interactive tool to test scope definitions
3. **Performance Profiling**: Measure which pipeline stages are slowest
4. **Snapshot Testing**: Capture and compare expected action discovery results
5. **Auto-Generated Test Cases**: Generate integration tests from action definitions

### Integration Opportunities
1. **ESLint Rule**: Detect entity double-nesting in test code
2. **TypeScript Types**: Add strict types for test bed API
3. **CI/CD Integration**: Automated performance regression detection

## Conclusion

These improvements address the core pain points identified during debugging:

1. **Entity structure bugs** → Caught immediately by validators
2. **Missing dependencies** → Test bed provides complete configuration
3. **Scope resolution failures** → Detailed tracing shows exact filter failures
4. **Generic errors** → Custom matchers provide actionable guidance

**Expected outcome**: Reduce average integration test debugging time from 2-4 hours to 15-30 minutes through better error messages, automatic validation, and diagnostic tooling.
