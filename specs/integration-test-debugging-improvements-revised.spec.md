# Integration Test Debugging Improvements - Revised Specification

## Status: Draft - Ready for Implementation
**Created**: 2025-01-19
**Revised**: 2025-01-19
**Author**: Claude Code
**Purpose**: Document improvements to action integration testing infrastructure that build on existing tools and patterns

## Revision Notes

This specification revises the original integration test debugging improvements spec to:
- **Build on existing infrastructure** (ActionDiscoveryServiceTestBed, ModEntityBuilder, TraceContext)
- **Enhance current tools** rather than creating parallel systems
- **Follow established patterns** (FactoryTestBed, mixins, test helpers)
- **Use correct file locations** (no non-existent directories)
- **Avoid code duplication** by extending what already works

## Problem Statement

During debugging of kneeling position action restriction tests, several critical challenges emerged that significantly slowed troubleshooting:

1. **Entity Double-Nesting Bug**: Entity instances had `.id` property containing entire entity object instead of string ID - took significant debugging time to diagnose
2. **Missing ActionIndex Error**: Cryptic error "Cannot read properties of undefined (reading 'getCandidateActions')" provided no context about missing dependency
3. **Missing Pipeline Dependencies**: Generic "Cannot read property 'name' of undefined" errors gave no indication of which pipeline dependency was missing
4. **Silent Scope Resolution Failures**: Scope resolution returning empty arrays with no diagnostic information about why filters failed

These issues resulted in a lengthy debugging session (4 major error cycles) that could have been dramatically shortened with better testing infrastructure.

## Current State Analysis

### Existing Infrastructure (What Actually Exists)

#### 1. ActionDiscoveryServiceTestBed
**Location**: `/tests/common/actions/actionDiscoveryServiceTestBed.js` (615 lines)

**Current Capabilities**:
- Extends `FactoryTestBed` with `ServiceFactoryMixin` pattern
- Pre-configured `ActionPipelineOrchestrator` mock (lines 131-331)
- Helper methods: `createDiscoveryServiceWithTracing()`, `createMockActor()`, `createMockContext()`
- Log capture: `getDebugLogs()`, `getInfoLogs()`, `getWarningLogs()`, `getErrorLogs()`
- Trace type tracking: `getCreatedTraceType()`
- Established helpers: `createActionDiscoveryBed()`, `describeActionDiscoverySuite()`

**Current Gaps**:
- No entity structure validation helpers
- No relationship establishment helpers (closeness, kneeling)
- No integration-focused convenience methods
- No diagnostic output formatting

#### 2. ModEntityBuilder
**Location**: `/tests/common/mods/ModEntityBuilder.js` (566 lines)

**Current Capabilities**:
- Fluent API for building test entities
- Methods: `withName()`, `atLocation()`, `closeToEntity()`, `kneelingBefore()`, `facing()`, etc.
- Validation method exists (lines 272-301) but minimal
- Scenario helpers: `ModEntityScenarios.createActorTargetPair()`, etc.

**Current Validation** (lines 272-301):
```javascript
validate() {
  if (!this.entityData.id) {
    throw new Error('ModEntityBuilder.validate: Entity ID is required');
  }
  if (typeof this.entityData.components !== 'object') {
    throw new Error('ModEntityBuilder.validate: Components must be an object');
  }
  // Basic checks for position and name components
  return this;
}
```

**Current Gaps**:
- No entity double-nesting detection
- No detailed error messages with debugging guidance
- No component structure validation
- No getter validation for entity.components

#### 3. TraceContext
**Location**: `/src/actions/tracing/traceContext.js` (177 lines)

**Current Capabilities**:
- Log collection with types: info, success, failure, step, error, data
- Convenience methods: `info()`, `success()`, `failure()`, `step()`, `error()`, `data()`
- Operator evaluation capture: `captureOperatorEvaluation()` (lines 149-161)
- Operator evaluation retrieval: `getOperatorEvaluations()` (lines 168-175)

**Existing Pattern for Custom Tracing** (lines 149-175):
```javascript
captureOperatorEvaluation(operatorData) {
  this.addLog('data', `Operator evaluation: ${operatorData.operator}`, 'OperatorEvaluation', {
    type: 'operator_evaluation',
    ...operatorData,
    capturedAt: Date.now(),
  });
}

getOperatorEvaluations() {
  return this.logs
    .filter(entry => entry.type === 'data' && entry.data?.type === 'operator_evaluation')
    .map(entry => entry.data);
}
```

**Current Gaps**:
- No scope evaluation capture (but pattern exists with operators)
- No filtering/formatting utilities for scope traces
- No integration with scope resolver

#### 4. Existing Matcher Pattern
**Location**: `/tests/common/actionResultMatchers.js` (214 lines)

**Pattern Established**:
- Custom Jest matchers with `expect.extend()`
- Auto-extension on import (line 211)
- Detailed error messages with context
- Deep equality checking for complex objects

**Example Pattern**:
```javascript
export const actionResultMatchers = {
  toBeSuccessfulActionResult(received, expectedValue) {
    const pass = /* validation logic */;
    const message = () => {
      if (pass) return `Expected NOT to be successful...`;
      // Detailed failure message with context
      return `Expected successful ActionResult with value ${JSON.stringify(expectedValue)}, ` +
             `but it was a failure with errors: ${JSON.stringify(received.errors)}`;
    };
    return { pass, message };
  },
};

export function extendExpectWithActionResultMatchers() {
  expect.extend(actionResultMatchers);
}

extendExpectWithActionResultMatchers(); // Auto-extend
```

### Critical Gaps

1. **No Entity Structure Validation in Test Bed**: Tests assume entities have correct structure but don't validate before running
2. **No Integration Test Helpers**: Each test manually configures entity relationships and scenarios
3. **No Scope Resolution Diagnostics**: When scope returns unexpected results, no visibility into evaluation steps
4. **Generic Error Messages**: Jest assertions like `expect(actions).toContain(...)` provide minimal debugging context
5. **No Action-Specific Matchers**: No domain-specific assertions with detailed, actionable error messages

## Proposed Solutions

### Solution 1: Enhance ActionDiscoveryServiceTestBed

**Purpose**: Add integration test helpers to existing test bed following established patterns.

**Location**: `/tests/common/actions/actionDiscoveryServiceTestBed.js`

**New Methods to Add**:

```javascript
class ActionDiscoveryServiceTestBed extends ServiceFactoryMixin(FactoryTestBed) {
  // ... existing methods ...

  /**
   * Create actor with automatic entity structure validation
   * @param {string} actorId - Actor entity ID
   * @param {object} options - Actor configuration
   * @returns {object} Validated actor entity
   */
  createActorWithValidation(actorId, { components = {}, location = 'test-location' } = {}) {
    // Use ModEntityBuilder for creation
    const builder = new ModEntityBuilder(actorId).asActor();

    // Add location if specified
    if (location) {
      builder.atLocation(location).withLocationComponent(location);
    }

    // Add components
    for (const [componentId, data] of Object.entries(components)) {
      builder.withComponent(componentId, data);
    }

    // Build and validate
    const entity = builder.validate().build();

    // Add to entity manager
    this.mocks.entityManager.addEntity(entity);

    return entity;
  }

  /**
   * Establish closeness relationship with validation
   * @param {object|string} actor - Actor entity or ID
   * @param {object|string} target - Target entity or ID
   */
  establishClosenessWithValidation(actor, target) {
    const actorId = typeof actor === 'string' ? actor : actor.id;
    const targetId = typeof target === 'string' ? target : target.id;

    // Validate entities exist
    const actorEntity = this.mocks.entityManager.getEntity(actorId);
    const targetEntity = this.mocks.entityManager.getEntity(targetId);

    if (!actorEntity) {
      throw new Error(`Cannot establish closeness: Actor '${actorId}' not found in entity manager`);
    }
    if (!targetEntity) {
      throw new Error(`Cannot establish closeness: Target '${targetId}' not found in entity manager`);
    }

    // Get or create closeness components
    const actorCloseness = actorEntity.components['positioning:closeness'] || { partners: [] };
    const targetCloseness = targetEntity.components['positioning:closeness'] || { partners: [] };

    // Add bidirectional relationship
    if (!actorCloseness.partners.includes(targetId)) {
      actorCloseness.partners.push(targetId);
    }
    if (!targetCloseness.partners.includes(actorId)) {
      targetCloseness.partners.push(actorId);
    }

    // Update entities
    this.mocks.entityManager.addComponent(actorId, 'positioning:closeness', actorCloseness);
    this.mocks.entityManager.addComponent(targetId, 'positioning:closeness', targetCloseness);
  }

  /**
   * Discover actions with detailed diagnostics
   * @param {object|string} actor - Actor entity or ID
   * @param {object} options - Discovery options
   * @returns {object} Result with actions and optional diagnostics
   */
  discoverActionsWithDiagnostics(actor, { includeDiagnostics = false } = {}) {
    const actorId = typeof actor === 'string' ? actor : actor.id;
    const actorEntity = this.mocks.entityManager.getEntity(actorId);

    if (!actorEntity) {
      throw new Error(`Cannot discover actions: Actor '${actorId}' not found`);
    }

    // Create trace context if diagnostics requested
    const traceContext = includeDiagnostics ? new TraceContext() : null;

    // Call service
    const service = this.service || this.createStandardDiscoveryService();
    const result = service.discoverActionsForActor(actorEntity, {
      trace: traceContext,
    });

    if (includeDiagnostics) {
      return {
        actions: result.actions || result,
        diagnostics: {
          logs: traceContext.logs,
          operatorEvaluations: traceContext.getOperatorEvaluations(),
          scopeEvaluations: traceContext.getScopeEvaluations?.() || [], // Use if implemented
        },
      };
    }

    return { actions: result.actions || result };
  }

  /**
   * Create a complete actor-target scenario for testing
   * @param {object} options - Scenario configuration
   * @returns {object} Actor and target entities
   */
  createActorTargetScenario({
    actorId = 'actor1',
    targetId = 'target1',
    location = 'test-location',
    closeProximity = true,
    actorComponents = {},
    targetComponents = {},
  } = {}) {
    const actor = this.createActorWithValidation(actorId, {
      components: actorComponents,
      location,
    });

    const target = this.createActorWithValidation(targetId, {
      components: targetComponents,
      location,
    });

    if (closeProximity) {
      this.establishClosenessWithValidation(actor, target);
    }

    return { actor, target };
  }
}
```

**Implementation Notes**:
- Builds on existing test bed pattern (extends FactoryTestBed)
- Uses ModEntityBuilder for entity creation (leverages existing code)
- Validates entity structure during creation
- Provides convenience methods for common scenarios
- Integrates with existing TraceContext for diagnostics

### Solution 2: Enhance ModEntityBuilder.validate()

**Purpose**: Add detailed validation with actionable error messages to existing validate() method.

**Location**: `/tests/common/mods/ModEntityBuilder.js` (lines 272-301)

**Enhanced Implementation**:

```javascript
/**
 * Validates the entity structure before building with detailed error messages.
 *
 * @returns {ModEntityBuilder} This builder for chaining
 * @throws {Error} If entity structure is invalid (with detailed debugging guidance)
 */
validate() {
  // Validate entity ID exists
  if (!this.entityData.id) {
    throw new Error(
      'ModEntityBuilder.validate: Entity ID is required\n' +
      '\n' +
      'An entity must have a string ID. Use:\n' +
      '  new ModEntityBuilder("entity-id")\n'
    );
  }

  // Validate entity ID is string (detect double-nesting)
  if (typeof this.entityData.id !== 'string') {
    const actualType = typeof this.entityData.id;
    const actualValue = actualType === 'object'
      ? JSON.stringify(this.entityData.id, null, 2)
      : String(this.entityData.id);

    throw new Error(
      '❌ ENTITY DOUBLE-NESTING DETECTED!\n' +
      '\n' +
      `entity.id should be STRING but is ${actualType}:\n` +
      `${actualValue}\n` +
      '\n' +
      'This usually happens when:\n' +
      '  1. An entity instance was passed instead of string ID\n' +
      '  2. A helper function used entity instead of entity.id\n' +
      '\n' +
      'Fix by ensuring all entity manager calls use string IDs:\n' +
      '  ❌ entityManager.addComponent(entity, componentId, data)\n' +
      '  ✅ entityManager.addComponent(entity.id, componentId, data)\n' +
      '\n' +
      '  ❌ builder.closeToEntity(targetEntity)\n' +
      '  ✅ builder.closeToEntity(targetEntity.id)\n'
    );
  }

  // Validate entity ID is non-blank
  if (this.entityData.id.trim() === '') {
    throw new Error(
      'ModEntityBuilder.validate: Entity ID cannot be blank\n' +
      '\n' +
      'Entity IDs must be non-empty strings. Use descriptive IDs like:\n' +
      '  "actor1", "target1", "room-library", "item-sword"\n'
    );
  }

  // Validate components structure
  if (typeof this.entityData.components !== 'object' || this.entityData.components === null) {
    throw new Error(
      `ModEntityBuilder.validate: Components must be an object, got: ${typeof this.entityData.components}\n` +
      '\n' +
      'Internal error in ModEntityBuilder - components should be initialized as {}.\n'
    );
  }

  // Validate position component if present
  const hasPosition = this.entityData.components[POSITION_COMPONENT_ID];
  if (hasPosition) {
    if (!hasPosition.locationId) {
      throw new Error(
        `ModEntityBuilder.validate: Position component missing 'locationId' property\n` +
        '\n' +
        'Position component data:\n' +
        `${JSON.stringify(hasPosition, null, 2)}\n` +
        '\n' +
        'Fix using:\n' +
        '  builder.atLocation("location-id")\n' +
        '\n' +
        'Or manually:\n' +
        '  builder.withComponent("core:position", { locationId: "location-id" })\n'
      );
    }

    if (typeof hasPosition.locationId !== 'string') {
      throw new Error(
        `ModEntityBuilder.validate: Position component locationId must be string, got: ${typeof hasPosition.locationId}\n` +
        '\n' +
        'This may indicate entity double-nesting in location references.\n'
      );
    }
  }

  // Validate name component if present
  const hasName = this.entityData.components[NAME_COMPONENT_ID];
  if (hasName) {
    if (!hasName.text) {
      throw new Error(
        `ModEntityBuilder.validate: Name component missing 'text' property\n` +
        '\n' +
        'Name component data:\n' +
        `${JSON.stringify(hasName, null, 2)}\n` +
        '\n' +
        'Fix using:\n' +
        '  builder.withName("Entity Name")\n' +
        '\n' +
        'Or manually:\n' +
        '  builder.withComponent("core:name", { text: "Entity Name" })\n'
      );
    }

    if (typeof hasName.text !== 'string') {
      throw new Error(
        `ModEntityBuilder.validate: Name component text must be string, got: ${typeof hasName.text}\n`
      );
    }
  }

  // Validate closeness component if present
  const hasCloseness = this.entityData.components['positioning:closeness'];
  if (hasCloseness) {
    if (!Array.isArray(hasCloseness.partners)) {
      throw new Error(
        `ModEntityBuilder.validate: Closeness component 'partners' must be array, got: ${typeof hasCloseness.partners}\n` +
        '\n' +
        'Closeness component data:\n' +
        `${JSON.stringify(hasCloseness, null, 2)}\n` +
        '\n' +
        'Fix using:\n' +
        '  builder.closeToEntity("target-id")\n' +
        '  builder.closeToEntity(["target1", "target2"])\n'
      );
    }

    // Validate all partners are strings
    for (const [index, partnerId] of hasCloseness.partners.entries()) {
      if (typeof partnerId !== 'string') {
        throw new Error(
          `ModEntityBuilder.validate: Closeness partner at index ${index} must be string, got: ${typeof partnerId}\n` +
          '\n' +
          `Partner value: ${JSON.stringify(partnerId)}\n` +
          '\n' +
          'This indicates entity double-nesting. Use entity IDs, not entity objects:\n' +
          '  ❌ builder.closeToEntity(targetEntity)\n' +
          '  ✅ builder.closeToEntity(targetEntity.id)\n'
        );
      }
    }
  }

  // Validate kneeling component if present
  const hasKneeling = this.entityData.components['positioning:kneeling_before'];
  if (hasKneeling) {
    if (!hasKneeling.entityId) {
      throw new Error(
        `ModEntityBuilder.validate: Kneeling component missing 'entityId' property\n` +
        '\n' +
        'Fix using:\n' +
        '  builder.kneelingBefore("target-id")\n'
      );
    }

    if (typeof hasKneeling.entityId !== 'string') {
      throw new Error(
        `ModEntityBuilder.validate: Kneeling entityId must be string, got: ${typeof hasKneeling.entityId}\n` +
        '\n' +
        'This indicates entity double-nesting. Use entity ID, not entity object:\n' +
        '  ❌ builder.kneelingBefore(targetEntity)\n' +
        '  ✅ builder.kneelingBefore(targetEntity.id)\n'
      );
    }
  }

  return this;
}
```

**Benefits**:
- Catches entity double-nesting immediately
- Provides actionable fix suggestions
- Validates component structure
- Maintains chainable API
- Centralized in existing builder pattern

### Solution 3: Create Custom Action Discovery Matchers

**Purpose**: Provide domain-specific Jest matchers with detailed, actionable error messages.

**Location**: `/tests/common/actionMatchers.js` (new file, at root of common/)

**Implementation**:

```javascript
/**
 * @file Custom Jest matchers for action discovery testing
 * @description Provides detailed error messages for common action discovery assertions
 */

import { expect } from '@jest/globals';

/**
 * Custom Jest matchers for action discovery
 */
export const actionDiscoveryMatchers = {
  /**
   * Assert that an action was discovered for a specific target
   *
   * @param {Array|object} received - Actions array or result object
   * @param {string} actionId - Expected action ID
   * @param {string} targetId - Expected target ID
   * @returns {object} Jest matcher result
   */
  toHaveActionForTarget(received, actionId, targetId) {
    const actions = Array.isArray(received) ? received : received.actions || [];

    const matchingAction = actions.find(a =>
      a.id === actionId &&
      (a.params?.targetId === targetId || a.target === targetId || a.targets?.includes(targetId))
    );

    const pass = matchingAction !== undefined;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected NOT to find action '${actionId}' with target '${targetId}', but it was discovered`,
      };
    }

    // Generate detailed failure message
    const discoveredActions = actions.length > 0
      ? actions.map((a, i) => {
          const target = a.params?.targetId || a.target || a.targets?.join(', ') || '(no target)';
          return `  ${i + 1}. ${a.id} → ${target}`;
        }).join('\n')
      : '  (none)';

    const actionWasDiscovered = actions.some(a => a.id === actionId);

    if (actionWasDiscovered) {
      const targetsForAction = actions
        .filter(a => a.id === actionId)
        .map(a => a.params?.targetId || a.target || a.targets);

      return {
        pass: false,
        message: () =>
          `Expected to find action '${actionId}' with target '${targetId}'\n` +
          `\n` +
          `✅ Action '${actionId}' WAS discovered\n` +
          `❌ But with different target(s): ${JSON.stringify(targetsForAction)}\n` +
          `\n` +
          `Actions discovered: ${actions.length}\n` +
          `${discoveredActions}\n` +
          `\n` +
          `This means:\n` +
          `  • Action passed ComponentFilteringStage (actor has required components)\n` +
          `  • Action passed MultiTargetResolutionStage (scope returned SOME targets)\n` +
          `  • But target '${targetId}' was not in the resolved targets\n` +
          `\n` +
          `To debug:\n` +
          `  1. Check if '${targetId}' matches the action's scope criteria\n` +
          `  2. Verify '${targetId}' is in actor's closeness.partners if scope uses close_actors\n` +
          `  3. Ensure '${targetId}' passes all scope filter conditions\n` +
          `  4. Use discoverActionsWithDiagnostics({ includeDiagnostics: true }) for detailed trace\n`,
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected to find action '${actionId}' with target '${targetId}'\n` +
        `\n` +
        `❌ Action '${actionId}' was NOT discovered\n` +
        `\n` +
        `Actions discovered: ${actions.length}\n` +
        `${discoveredActions}\n` +
        `\n` +
        `Possible reasons:\n` +
        `  1. ComponentFilteringStage: Actor missing required components\n` +
        `  2. MultiTargetResolutionStage: Scope returned no targets\n` +
        `  3. TargetComponentValidationStage: Targets missing required components\n` +
        `  4. PrerequisiteEvaluationStage: Prerequisites not met\n` +
        `  5. Action not loaded in ActionIndex\n` +
        `\n` +
        `To debug:\n` +
        `  1. Use discoverActionsWithDiagnostics({ includeDiagnostics: true })\n` +
        `  2. Check actor has required components: actor.components\n` +
        `  3. Verify action exists: actionIndex.getCandidateActions(actor)\n` +
        `  4. Use builder.validate() to catch entity structure issues early\n`,
    };
  },

  /**
   * Assert the number of actions discovered
   *
   * @param {Array|object} received - Actions array or result object
   * @param {number} expectedCount - Expected number of actions
   * @returns {object} Jest matcher result
   */
  toDiscoverActionCount(received, expectedCount) {
    const actions = Array.isArray(received) ? received : received.actions || [];
    const actualCount = actions.length;

    const pass = actualCount === expectedCount;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected NOT to discover ${expectedCount} actions, but discovered exactly ${actualCount}`,
      };
    }

    const actionList = actions.length > 0
      ? actions.map((a, i) => `  ${i + 1}. ${a.id}`).join('\n')
      : '  (none)';

    return {
      pass: false,
      message: () =>
        `Expected to discover ${expectedCount} actions but discovered ${actualCount}\n` +
        `\n` +
        `Actions discovered:\n` +
        `${actionList}\n` +
        `\n` +
        (actualCount < expectedCount
          ? `Discovered FEWER actions than expected (${actualCount} < ${expectedCount})\n` +
            `\n` +
            `Possible reasons:\n` +
            `  • Some actions were filtered out by pipeline stages\n` +
            `  • Actor missing required components\n` +
            `  • Scope resolution returned no targets for some actions\n` +
            `  • Prerequisites not met\n` +
            `\n` +
            `To debug:\n` +
            `  • Use discoverActionsWithDiagnostics({ includeDiagnostics: true })\n` +
            `  • Check which pipeline stage removed actions\n`
          : `Discovered MORE actions than expected (${actualCount} > ${expectedCount})\n` +
            `\n` +
            `Possible reasons:\n` +
            `  • More entities in closeness than expected\n` +
            `  • Scope resolving to unexpected targets\n` +
            `  • Multiple action definitions with similar criteria\n`
        ),
    };
  },

  /**
   * Assert that a specific action was discovered (regardless of target)
   *
   * @param {Array|object} received - Actions array or result object
   * @param {string} actionId - Expected action ID
   * @returns {object} Jest matcher result
   */
  toHaveAction(received, actionId) {
    const actions = Array.isArray(received) ? received : received.actions || [];

    const matchingAction = actions.find(a => a.id === actionId);
    const pass = matchingAction !== undefined;

    if (pass) {
      return {
        pass: true,
        message: () => `Expected NOT to discover action '${actionId}', but it was discovered`,
      };
    }

    const actionList = actions.length > 0
      ? actions.map((a, i) => `  ${i + 1}. ${a.id}`).join('\n')
      : '  (none)';

    return {
      pass: false,
      message: () =>
        `Expected to discover action '${actionId}'\n` +
        `\n` +
        `Actions discovered: ${actions.length}\n` +
        `${actionList}\n` +
        `\n` +
        `To debug why '${actionId}' was not discovered:\n` +
        `  1. Check ActionIndex contains the action\n` +
        `  2. Verify actor has required components\n` +
        `  3. Ensure scope returns at least one target\n` +
        `  4. Check prerequisites are met\n` +
        `  5. Use discoverActionsWithDiagnostics({ includeDiagnostics: true })\n`,
    };
  },
};

/**
 * Extends Jest's expect with custom action discovery matchers
 */
export function extendExpectWithActionDiscoveryMatchers() {
  expect.extend(actionDiscoveryMatchers);
}

// Auto-extend when imported
extendExpectWithActionDiscoveryMatchers();

export default actionDiscoveryMatchers;
```

**Benefits**:
- Follows established pattern from actionResultMatchers.js
- Auto-extends Jest expect on import
- Provides detailed, actionable error messages
- Suggests specific debugging steps
- Located at correct path (/tests/common/, not /tests/common/matchers/)

### Solution 4: Extend TraceContext with Scope Evaluation Capture

**Purpose**: Add scope evaluation tracing to existing TraceContext following the established operator evaluation pattern.

**Location**: `/src/actions/tracing/traceContext.js`

**New Methods to Add**:

```javascript
/**
 * Capture scope resolution evaluation data for debugging and tracing purposes.
 * Follows the same pattern as captureOperatorEvaluation.
 *
 * @param {object} scopeData - Data from the scope resolution
 * @param {string} scopeData.scopeId - Scope identifier being evaluated
 * @param {string} scopeData.actorId - Actor for whom scope is being resolved
 * @param {Array<string>} scopeData.candidateEntities - Entities considered by scope
 * @param {Array<string>} scopeData.resolvedEntities - Entities that passed filters
 * @param {Array<object>} [scopeData.filterResults] - Detailed filter evaluation results
 * @param {object} [scopeData.context] - Evaluation context
 */
captureScopeEvaluation(scopeData) {
  // Store scope evaluations as special data entries (same pattern as operator evaluations)
  this.addLog(
    'data',
    `Scope evaluation: ${scopeData.scopeId}`,
    'ScopeEvaluation',
    {
      type: 'scope_evaluation',
      ...scopeData,
      capturedAt: Date.now(),
    }
  );
}

/**
 * Get all scope evaluation logs from the trace.
 * Follows the same pattern as getOperatorEvaluations.
 *
 * @returns {Array<object>} Array of scope evaluation data
 */
getScopeEvaluations() {
  return this.logs
    .filter(
      (entry) =>
        entry.type === 'data' && entry.data?.type === 'scope_evaluation'
    )
    .map((entry) => entry.data);
}
```

**Implementation Notes**:
- Follows exact pattern from `captureOperatorEvaluation()` (lines 149-161)
- Uses same log filtering approach as `getOperatorEvaluations()` (lines 168-175)
- Minimal change to existing file (add 2 methods)
- No breaking changes to existing API

### Solution 5: Create Scope Tracing Helper Utilities

**Purpose**: Provide helper functions that integrate scope resolution tracing with TraceContext.

**Location**: `/tests/common/scopeDsl/scopeTracingHelpers.js` (new file)

**Implementation**:

```javascript
/**
 * @file Helper utilities for tracing scope resolution in tests
 * @description Integrates scope resolution debugging with existing TraceContext infrastructure
 */

import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

/**
 * Create a traced wrapper around a scope resolver that captures evaluation details.
 *
 * @param {object} scopeResolver - The scope resolver to instrument
 * @param {TraceContext} traceContext - Trace context to capture evaluations
 * @returns {object} Instrumented scope resolver
 */
export function createTracedScopeResolver(scopeResolver, traceContext) {
  // Store original resolve method
  const originalResolve = scopeResolver.resolve.bind(scopeResolver);

  // Create instrumented resolver
  return {
    ...scopeResolver,

    resolve(scopeId, context) {
      // Capture start of resolution
      traceContext.step(`Resolving scope: ${scopeId}`, 'ScopeTracer');

      try {
        // Call original resolver
        const result = originalResolve(scopeId, context);

        // Capture successful resolution
        traceContext.captureScopeEvaluation({
          scopeId,
          actorId: context.actor?.id,
          candidateEntities: context.candidates || [],
          resolvedEntities: result || [],
          success: true,
          context: {
            actorId: context.actor?.id,
            hasFilters: context.filters?.length > 0,
          },
        });

        traceContext.success(
          `Resolved ${result?.length || 0} entities for scope '${scopeId}'`,
          'ScopeTracer',
          { resolvedEntities: result }
        );

        return result;
      } catch (error) {
        // Capture failed resolution
        traceContext.captureScopeEvaluation({
          scopeId,
          actorId: context.actor?.id,
          success: false,
          error: error.message,
          context,
        });

        traceContext.error(
          `Scope resolution failed for '${scopeId}': ${error.message}`,
          'ScopeTracer',
          { error }
        );

        throw error;
      }
    },
  };
}

/**
 * Format scope evaluation results into a readable summary.
 *
 * @param {TraceContext} traceContext - Trace context containing scope evaluations
 * @returns {string} Formatted summary
 */
export function formatScopeEvaluationSummary(traceContext) {
  const scopeEvaluations = traceContext.getScopeEvaluations();

  if (scopeEvaluations.length === 0) {
    return 'No scope evaluations captured';
  }

  const lines = ['', '=== Scope Evaluation Summary ===', ''];

  for (const evaluation of scopeEvaluations) {
    lines.push(`Scope: ${evaluation.scopeId}`);
    lines.push(`  Actor: ${evaluation.actorId || 'unknown'}`);

    if (evaluation.success) {
      const candidateCount = evaluation.candidateEntities?.length || 0;
      const resolvedCount = evaluation.resolvedEntities?.length || 0;
      const filteredCount = candidateCount - resolvedCount;

      lines.push(`  Candidates: ${candidateCount}`);
      lines.push(`  Resolved: ${resolvedCount}`);

      if (filteredCount > 0) {
        lines.push(`  Filtered out: ${filteredCount}`);
      }

      if (resolvedCount > 0) {
        lines.push(`  Resolved entities: ${evaluation.resolvedEntities.join(', ')}`);
      }
    } else {
      lines.push(`  ❌ Failed: ${evaluation.error}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Helper to trace scope resolution for a single scope evaluation.
 *
 * @param {object} options - Configuration options
 * @param {string} options.scopeId - Scope to evaluate
 * @param {object} options.actor - Actor entity
 * @param {object} options.scopeResolver - Scope resolver instance
 * @param {object} [options.context] - Additional context
 * @returns {object} Evaluation result with trace
 */
export function traceScopeEvaluation({ scopeId, actor, scopeResolver, context = {} }) {
  const traceContext = new TraceContext();
  const tracedResolver = createTracedScopeResolver(scopeResolver, traceContext);

  try {
    const result = tracedResolver.resolve(scopeId, {
      actor,
      ...context,
    });

    return {
      success: true,
      resolvedEntities: result,
      trace: traceContext,
      summary: formatScopeEvaluationSummary(traceContext),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      trace: traceContext,
      summary: formatScopeEvaluationSummary(traceContext),
    };
  }
}

export default {
  createTracedScopeResolver,
  formatScopeEvaluationSummary,
  traceScopeEvaluation,
};
```

**Benefits**:
- Integrates with existing TraceContext (no parallel system)
- Follows established patterns from operator evaluation
- Provides readable summaries for test output
- Easy to use in test scenarios
- Can be used with enhanced test bed methods

## Implementation Roadmap

### Phase 1: Core Enhancements (High Priority)
**Estimated Effort**: 2-3 days

**Tasks**:
1. ✅ Enhance `ModEntityBuilder.validate()` with detailed error messages (1 day)
   - Add entity double-nesting detection
   - Add component structure validation
   - Add relationship validation
   - Update existing validate() method at lines 272-301

2. ✅ Create `actionMatchers.js` with custom Jest matchers (1 day)
   - Implement `toHaveActionForTarget()`
   - Implement `toDiscoverActionCount()`
   - Implement `toHaveAction()`
   - Follow pattern from actionResultMatchers.js

3. ✅ Add integration helpers to `ActionDiscoveryServiceTestBed` (1 day)
   - Add `createActorWithValidation()`
   - Add `establishClosenessWithValidation()`
   - Add `createActorTargetScenario()`
   - Follow existing test bed patterns

**Deliverables**:
- Enhanced ModEntityBuilder with validation
- Custom action discovery matchers
- Extended test bed with integration helpers

**Success Criteria**:
- Entity structure bugs caught immediately during test setup
- Action discovery assertions provide detailed error messages
- Test setup code reduced by ~50% with helper methods

### Phase 2: Tracing Infrastructure (Medium Priority)
**Estimated Effort**: 2 days

**Tasks**:
1. ✅ Extend `TraceContext` with scope evaluation capture (0.5 days)
   - Add `captureScopeEvaluation()` method
   - Add `getScopeEvaluations()` method
   - Follow operator evaluation pattern

2. ✅ Create scope tracing helpers (1 day)
   - Implement `createTracedScopeResolver()`
   - Implement `formatScopeEvaluationSummary()`
   - Implement `traceScopeEvaluation()`

3. ✅ Add `discoverActionsWithDiagnostics()` to test bed (0.5 days)
   - Integrate with TraceContext
   - Return diagnostics with actions
   - Format readable output

**Deliverables**:
- Extended TraceContext with scope tracing
- Scope tracing helper utilities
- Diagnostic-enabled action discovery in test bed

**Success Criteria**:
- Scope evaluation failures show exactly which filter failed
- Diagnostic output shows pipeline stage flow
- Integration with existing tracing infrastructure

### Phase 3: Documentation & Examples (Low Priority)
**Estimated Effort**: 1-2 days

**Tasks**:
1. ✅ Create usage documentation (0.5 days)
   - Document enhanced test bed API
   - Document custom matchers
   - Document tracing helpers

2. ✅ Create migration examples (0.5 days)
   - Show before/after patterns
   - Provide step-by-step migration guide
   - Document common scenarios

3. ✅ Update existing documentation (0.5 days)
   - Update README.md with testing improvements section
   - Update tests/README.md with new utilities reference
   - Add troubleshooting guide

**Deliverables**:
- `/docs/testing/mod-testing-guide.md#action-discovery-harness`
- Migration guide and examples
- Updated project documentation

**Success Criteria**:
- Developers can adopt new patterns without confusion
- Common debugging scenarios are documented
- Migration path is clear and straightforward

### Phase 4: Optional Migration (As Needed)
**Estimated Effort**: Ongoing

**Tasks**:
- Migrate existing integration tests to use new test bed helpers
- Update tests to use custom matchers
- Add validation calls to existing entity creation

**Note**: Migration is optional and can be done incrementally. Old patterns still work.

## Files Modified (2 files)

1. `/tests/common/actions/actionDiscoveryServiceTestBed.js`
   - Add `createActorWithValidation()` method
   - Add `establishClosenessWithValidation()` method
   - Add `discoverActionsWithDiagnostics()` method
   - Add `createActorTargetScenario()` method

2. `/tests/common/mods/ModEntityBuilder.js`
   - Enhance `validate()` method (lines 272-301) with detailed error messages
   - Add entity double-nesting detection
   - Add component structure validation
   - Add relationship validation

## Files Created (3 files)

1. `/tests/common/actionMatchers.js`
   - Custom Jest matchers for action discovery
   - Detailed error messages
   - Auto-extension on import

2. `/tests/common/scopeDsl/scopeTracingHelpers.js`
   - Scope resolution tracing utilities
   - TraceContext integration
   - Formatting helpers

3. `/docs/testing/mod-testing-guide.md#action-discovery-harness`
   - Usage guide for new utilities
   - Migration examples
   - Troubleshooting guide

## Success Metrics

### Before Implementation (Current State)
- **Average debugging time for integration test failure**: 2-4 hours
- **Error messages**: Generic ("Cannot read property of undefined")
- **Root cause identification**: Manual code inspection required
- **Entity structure bugs**: Discovered late during action discovery
- **Scope resolution failures**: No visibility into why filters failed

### After Implementation (Target State)
- **Average debugging time for integration test failure**: 15-30 minutes
- **Error messages**: Specific with actionable guidance ("Entity double-nesting detected! Use entity.id instead of entity")
- **Root cause identification**: Provided in test failure message with debugging steps
- **Entity structure bugs**: Caught immediately during test setup with `.validate()`
- **Scope resolution failures**: Detailed trace showing which filter failed and why

## Example: Before vs After

### Before Implementation

```javascript
describe('Kneeling Position Actions', () => {
  it('should discover actions when neither is kneeling', () => {
    // Manual setup - easy to make mistakes
    const entityManager = new SimpleEntityManager();
    const actor = entityManager.createEntity('actor1');

    // BUG: Passing entity instead of ID
    entityManager.addComponent(actor, 'core:name', { name: 'Alice' });
    entityManager.addComponent(actor, 'positioning:closeness', { partners: [] });

    const target = entityManager.createEntity('actor2');
    entityManager.addComponent(target.id, 'core:name', { name: 'Bob' });

    // Manual closeness establishment
    const actorCloseness = entityManager.getComponent('actor1', 'positioning:closeness');
    actorCloseness.partners.push('actor2');
    entityManager.addComponent('actor1', 'positioning:closeness', actorCloseness);

    const targetCloseness = { partners: ['actor1'] };
    entityManager.addComponent('actor2', 'positioning:closeness', targetCloseness);

    // Discover actions
    const actions = actionDiscoveryService.discoverActionsForActor(actor);

    // Generic assertion - unhelpful when fails
    expect(actions.some(a => a.id === 'affection:place_hands_on_shoulders')).toBe(true);

    // FAILS with: "Expected true but got false"
    // No information about WHY it failed
  });
});
```

**Debugging process**:
1. Test fails with generic message: "Expected true but got false" ❌
2. Add `console.log(actions)` to see what was discovered
3. Add `console.log(actor)` to inspect actor structure
4. Discover `entity.id` is an object instead of string
5. Search through code to find where entity was passed instead of ID
6. Fix bug: change `entityManager.addComponent(actor, ...)` to `entityManager.addComponent(actor.id, ...)`
7. Re-run test
8. **Total time**: 2-4 hours

### After Implementation

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js'; // Auto-extends Jest

describe('Kneeling Position Actions', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover actions when neither is kneeling', () => {
    // Test bed validates structure automatically
    const { actor, target } = testBed.createActorTargetScenario({
      actorComponents: {
        'core:name': { name: 'Alice' },
      },
      targetComponents: {
        'core:name': { name: 'Bob' },
      },
      closeProximity: true,
    });

    // Discover actions with diagnostics
    const result = testBed.discoverActionsWithDiagnostics(actor, {
      includeDiagnostics: true,
    });

    // Custom matcher with detailed error messages
    expect(result).toHaveActionForTarget('affection:place_hands_on_shoulders', 'target1');

    // If it fails, shows:
    //
    // Expected to find action 'affection:place_hands_on_shoulders' with target 'target1'
    //
    // Actions discovered: 0
    //
    // ❌ Action 'affection:place_hands_on_shoulders' was NOT discovered
    //
    // Possible reasons:
    //   1. ComponentFilteringStage: Actor missing required components
    //   2. MultiTargetResolutionStage: Scope returned no targets
    //   3. TargetComponentValidationStage: Targets missing required components
    //   4. PrerequisiteEvaluationStage: Prerequisites not met
    //   5. Action not loaded in ActionIndex
    //
    // To debug:
    //   1. Use discoverActionsWithDiagnostics({ includeDiagnostics: true })
    //   2. Check actor has required components: actor.components
    //   3. Verify action exists: actionIndex.getCandidateActions(actor)
    //   4. Use builder.validate() to catch entity structure issues early
  });
});
```

**With entity structure bug, would fail earlier**:

```javascript
const actor = testBed.createActorWithValidation('actor1', {
  components: {
    'core:name': { name: 'Alice' },
    'positioning:closeness': { partners: [target] }, // BUG: passed entity instead of ID
  },
});
// IMMEDIATELY THROWS:
//
// ❌ ENTITY DOUBLE-NESTING DETECTED!
//
// entity.id should be STRING but is object:
// {
//   "id": "target1",
//   "components": {...}
// }
//
// This usually happens when:
//   1. An entity instance was passed instead of string ID
//   2. A helper function used entity instead of entity.id
//
// Fix by ensuring all entity manager calls use string IDs:
//   ❌ builder.closeToEntity(targetEntity)
//   ✅ builder.closeToEntity(targetEntity.id)
```

**Debugging process**:
1. Test fails with detailed diagnostic message ✅
2. Message shows exactly what's wrong and how to fix it ✅
3. Fix the bug based on clear guidance ✅
4. **Total time**: 5-10 minutes

## Benefits Over Original Spec

### No Code Duplication
- ✅ Enhances existing `ActionDiscoveryServiceTestBed` instead of creating new test bed
- ✅ Extends existing `ModEntityBuilder.validate()` instead of separate validators
- ✅ Integrates with existing `TraceContext` instead of parallel diagnostic system

### Follows Established Patterns
- ✅ Uses `FactoryTestBed` + mixin pattern from existing test bed
- ✅ Follows custom matcher pattern from `actionResultMatchers.js`
- ✅ Follows tracing pattern from `captureOperatorEvaluation()`

### Correct File Locations
- ✅ `actionMatchers.js` at `/tests/common/` (not non-existent `/tests/common/matchers/`)
- ✅ Scope helpers at `/tests/common/scopeDsl/` (existing directory)
- ✅ No new directory structure required

### Centralized Validation
- ✅ Enhances `ModEntityBuilder.validate()` keeping validation in builder
- ✅ Single source of truth for entity structure validation
- ✅ Consistent with existing builder API

### Minimal Changes
- ✅ Only 2 existing files modified
- ✅ Only 3 new files created
- ✅ No breaking changes to existing code
- ✅ Existing tests continue to work

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
4. **JetBrains Plugin**: IDE support for action discovery debugging

## Conclusion

This revised specification addresses the core pain points identified during debugging while building on existing infrastructure:

1. **Entity structure bugs** → Caught by enhanced `ModEntityBuilder.validate()`
2. **Missing dependencies** → Handled by enhanced `ActionDiscoveryServiceTestBed`
3. **Scope resolution failures** → Traced by extended `TraceContext` and scope helpers
4. **Generic errors** → Replaced by custom `actionMatchers.js`

**Key Improvements Over Original**:
- No duplicate test bed creation
- No parallel diagnostic systems
- Follows all established patterns
- Uses correct file locations
- Minimal changes to existing code

**Expected Outcome**: Reduce average integration test debugging time from 2-4 hours to 15-30 minutes through better error messages, automatic validation, and diagnostic tooling that integrates seamlessly with existing infrastructure.
