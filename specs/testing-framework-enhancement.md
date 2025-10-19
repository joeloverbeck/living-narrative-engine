# Testing Framework Enhancement Specification

## Executive Summary

This specification proposes enhancements to the Living Narrative Engine testing framework to address critical debugging pain points identified during the straddling action discovery investigation. The multi-day debugging process revealed specific gaps in diagnostic capabilities and test infrastructure that made root cause analysis unnecessarily difficult.

**Key Problem**: A simple prerequisite misconfiguration (`movement:actor-can-move` in straddling actions) took multiple days to diagnose due to:
- Browser console truncation hiding diagnostic data
- Opaque multi-stage action pipeline filtering
- Limited action discovery tracing capabilities (basic `DiscoveryDiagnostics` exists but lacks depth)
- Manual diagnostic code insertion/removal across multiple files
- Test/runtime divergence (tests passed with custom resolvers, runtime failed)
- Invisible prerequisite failure details
- No design-time prerequisite validation

**Current State**: The project has extensive testing infrastructure including:
- Comprehensive test bed system (`baseTestBed.js`, `integrationTestBed.js`, specialized test beds)
- ModTestFixture with auto-loading capabilities for actions/rules/conditions
- Basic diagnostic tools (`DiscoveryDiagnostics` for scope resolution tracing)
- Mock factory ecosystem and custom Jest matchers
- Assertion helpers (`ModAssertionHelpers` with basic action validation)

**Proposed Solution**: Enhance existing testing infrastructure with:
1. Advanced action discovery diagnostics (extending `DiscoveryDiagnostics`)
2. Development-time validation tools
3. Test infrastructure improvements (scope file loading for ModTestFixture)
4. Enhanced logging and debugging capabilities
5. Specialized testing framework extensions building on existing patterns

## Problem Analysis

### Root Cause Timeline

**Day 1-2: Initial Investigation**
- Symptom: Straddling actions not appearing at runtime despite tests passing
- Added manual diagnostic logging to 5+ files (ActionIndex, stepResolver, arrayIterationResolver, PrerequisiteEvaluationStage)
- Browser console truncation hid critical fields in nested objects
- User manually saved console logs to files for analysis

**Day 3: Hypothesis Testing**
- Suspected empty partners array, field access failure, or Scope DSL evaluation broken
- Tests passed because they used custom JavaScript scope resolver bypassing real Scope DSL
- Test/runtime divergence masked the actual issue

**Day 4: Root Cause Discovery**
- User insight: "closeness state, when set, actually locks movement"
- `MERGE_CLOSENESS_CIRCLE` operation explicitly locks movement via `core:movement` component
- Straddling actions had `movement:actor-can-move` prerequisite - logical contradiction
- **Actual fix**: Remove invalid prerequisite (2-line change in 2 files)

**Debugging Burden**:
- 4 days to find 2-line fix
- 5+ files manually instrumented with diagnostics
- 10+ log files manually saved and analyzed
- Custom scope resolvers needed in tests (ModTestFixture limitation)
- No clear visibility into prerequisite failures or pipeline filtering

### Identified Pain Points

#### 1. Browser Console Truncation
**Problem**: Console.log truncates nested objects beyond certain depth, replacing with `...}`.

**Impact**: 
- Diagnostic fields hidden in truncated objects
- Had to create separate focused log statements
- User manually saved console output to files

**Example**:
```javascript
// What we logged
console.log('Action discovery context:', { actor, actions, components });

// What appeared in console
Action discovery context: { actor: {...}, actions: [...], components: {...} }
```

#### 2. Multi-Stage Pipeline Opacity
**Problem**: Action discovery uses 5-stage pipeline - hard to trace where filtering occurs.

**Stages**:
1. ComponentFilteringStage - filters by actor components
2. PrerequisiteEvaluationStage - evaluates JSON Logic conditions
3. MultiTargetResolutionStage - resolves scope targets
4. TargetComponentValidationStage - validates target components
5. ActionFormattingStage - formats for display

**Impact**:
- No visibility into which stage filtered out actions
- Had to add diagnostics to each stage manually
- Unclear which filter condition failed

#### 3. Prerequisite Failure Details Hidden
**Problem**: When prerequisites fail, we only get "prerequisite failed" - not which condition or why.

**Impact**:
- Can't see that `movement:actor-can-move` failed because movement was locked
- Can't see that `positioning:closeness` component locked movement
- No component dependency analysis

**Example**:
```javascript
// What we know
"prerequisite failed for positioning:straddle_waist_facing"

// What we need
"prerequisite 'movement:actor-can-move' failed: actor has core:movement.locked=true (set by MERGE_CLOSENESS_CIRCLE operation)"
```

#### 4. Scope Resolution Opaque
**Problem**: Scope DSL evaluation has no step-by-step tracing.

**Impact**:
- Can't see field access: `actor.components.positioning:closeness.partners`
- Can't see filtering: `partners[][{"!!": {"var": "entity.components.positioning:sitting_on"}}]`
- Can't see why scope resolves to empty set

**Example Needed**:
```
Scope: positioning:actors_sitting_close
Step 1: actor.components.positioning:closeness → {partners: ["Jon Ureña", "Emma Watson"]}
Step 2: partners[] → ["Jon Ureña", "Emma Watson"]
Step 3: filter {"!!" : {"var": "entity.components.positioning:sitting_on"}}
  - Jon Ureña: has positioning:sitting_on ✓
  - Emma Watson: missing positioning:sitting_on ✗
Result: ["Jon Ureña"]
```

#### 5. Component Interdependencies Not Obvious
**Problem**: No tool to analyze how components interact.

**Impact**:
- Not obvious that `positioning:closeness` → locks `core:movement`
- Not obvious that `movement:actor-can-move` checks `core:movement.locked`
- Had to discover through user domain knowledge

**Need**: Component dependency graph showing:
```
positioning:closeness
  ↓ (via MERGE_CLOSENESS_CIRCLE)
core:movement.locked = true
  ↓ (checked by)
movement:actor-can-move prerequisite
  ↓ (blocks)
positioning:straddle_waist_facing action
```

#### 6. Manual Diagnostic Code Management
**Problem**: Had to manually insert/remove diagnostic logging across multiple files.

**Files Modified**:
- src/scopeDsl/resolvers/stepResolver.js
- src/scopeDsl/resolvers/arrayIterationResolver.js
- src/actions/actionIndex.js
- src/actions/pipeline/stages/PrerequisiteEvaluationStage.js

**Impact**:
- Risk of forgetting to remove diagnostics
- Inconsistent diagnostic format
- No reusable diagnostic infrastructure

#### 7. Test Infrastructure Limitations
**Problem**: `ModTestFixture.forAction` doesn't load scope definition files (.scope files).

**Impact**:
- Tests need custom JavaScript scope resolver
- Custom resolver implements same logic as Scope DSL
- Test/runtime divergence - tests pass, runtime fails
- Hard to maintain parity between custom resolver and .scope file

#### 8. No Design-Time Validation
**Problem**: No tool to validate prerequisites against component definitions before runtime.

**Impact**:
- Invalid prerequisites only caught at runtime
- Can't catch logical contradictions like "closeness locks movement" + "movement prerequisite"
- No static analysis of component interactions

## Existing Infrastructure Overview

Before proposing enhancements, it's important to acknowledge the robust testing infrastructure already in place:

### Test Bed Ecosystem

**Core Test Beds**:
- `baseTestBed.js` - Foundation for all test bed patterns
- `integrationTestBed.js` - Integration test infrastructure with full DI container
- `containerTestBed.js` - Dependency injection container testing
- `performanceTestBed.js` - Performance benchmarking infrastructure
- `testBed.js` - General purpose test bed with action tracing capabilities

**Specialized Test Beds**:
- `turns/turnManagerTestBed.js` - Turn management testing
- `prompting/promptPipelineTestBed.js` - Prompt pipeline testing
- `anatomy/anatomyIntegrationTestBed.js` - Anatomy system testing
- `engine/gameEngineTestBed.js` - Game engine testing

### ModTestFixture Capabilities

**Current Features** (more capable than initially assessed):
- ✅ Auto-loading of rule/condition files via `forActionAutoLoad()` and `forRuleAutoLoad()`
- ✅ Convention-based file detection and loading
- ✅ Partial file loading (load only missing files)
- ✅ Action validation proxy integration
- ✅ Entity builder integration via `createEntity()`
- ✅ Built-in diagnostics support via `enableDiagnostics()` method
- ✅ Action discovery with `discoverActions()` method
- ❌ **Missing**: Scope file (.scope) loading (genuine gap)

**Existing Assertion Helpers**:
- `assertActionSuccess(expectedMessage, options)`
- `assertPerceptibleEvent(expectedEvent)`
- `assertComponentAdded(entityId, componentId, expectedData)`
- `assertActionFailure(options)`
- `assertOnlyExpectedEvents(allowedEventTypes)`

### Diagnostic Tools

**DiscoveryDiagnostics** (`tests/common/mods/discoveryDiagnostics.js`):
- ✅ Scope resolution tracing with `discoverWithDiagnostics()`
- ✅ Real-time diagnostic output to console
- ✅ Trace collection and reporting
- ❌ **Missing**: Structured JSON output
- ❌ **Missing**: File persistence
- ❌ **Missing**: Prerequisite failure analysis
- ❌ **Missing**: Pipeline stage tracing

### Test Utilities

**Helper Functions**:
- `testBedHelpers.js` - General helper functions
- `jestHelpers.js` - Jest-specific utilities
- `strictTestHelpers.js` - Strict validation helpers

**Custom Matchers**:
- `actionResultMatchers.js` - Action-specific Jest matchers
- `actionMatchers.js` - Additional action matchers
- `loggerMatchers.js` - Logger verification matchers

**Mock Factories** (`tests/common/mockFactories/`):
- 15+ specialized mock factories
- `eventBusMocks.js`, `loggerMocks.js`, `entities.js`, etc.

### Entity Building

**ModEntityBuilder** - Fluent API for test entity creation:
- `asRoom()`, `asActor()` - Role methods
- `withComponent()`, `atLocation()` - Component methods
- `closeToEntity()` - Relationship methods

**ModEntityScenarios** - Pre-built test scenarios

### What's Missing (Genuine Gaps)

1. **Scope File Loading**: ModTestFixture doesn't load .scope files → tests/runtime divergence
2. **Advanced Diagnostics**: DiscoveryDiagnostics lacks structured output, file persistence, prerequisite analysis
3. **Discovery-Specific Assertions**: Current assertions are basic, need discovery-focused helpers
4. **Design-Time Validation**: No prerequisite validator or dependency analyzer

## Proposed Solutions

### 1. Action Discovery Diagnostics System

#### 1.1 Built-In Tracing API

**Current State**: The `DiscoveryDiagnostics` class (`tests/common/mods/discoveryDiagnostics.js`) provides basic scope resolution tracing:
- Console output for scope resolution steps
- Integration with `ModTestFixture.discoverWithDiagnostics()`
- Real-time diagnostic feedback during test execution

**Limitations**:
- Console-only output (no file persistence)
- No structured JSON format for parsing
- Limited to scope resolution (no prerequisite or pipeline tracing)
- Ephemeral (traces lost after console scroll)

**Purpose**: Enhance existing `DiscoveryDiagnostics` with comprehensive tracing capabilities.

**Proposed Enhancements**:
1. Add structured JSON output mode (in addition to console)
2. Add file persistence for trace analysis
3. Extend tracing to cover prerequisite evaluation and pipeline stages
4. Integrate with existing `ModTestFixture` diagnostic capabilities

**Design**:
```javascript
import { ActionDiscoveryTracer } from './actions/diagnostics/actionDiscoveryTracer.js';

// In AvailableActionsProvider
discoverActions(actorId, options = {}) {
  const tracer = options.trace 
    ? new ActionDiscoveryTracer({ actorId, outputMode: 'structured' })
    : null;

  const candidates = this.#actionIndex.getCandidateActions(actorEntity, tracer);
  const filtered = this.#pipeline.execute(candidates, context, tracer);
  
  if (tracer) {
    tracer.saveToFile(`traces/action-discovery-${actorId}-${Date.now()}.json`);
  }
  
  return filtered;
}
```

**API**:
```javascript
class ActionDiscoveryTracer {
  constructor({ actorId, outputMode = 'structured', maxDepth = 10 }) {
    this.actorId = actorId;
    this.outputMode = outputMode; // 'structured' | 'console' | 'both'
    this.maxDepth = maxDepth;
    this.traces = [];
  }

  // Called by ActionIndex
  traceCandidates(candidates, componentTypes) {
    this.traces.push({
      stage: 'candidate_selection',
      timestamp: Date.now(),
      actorComponents: componentTypes,
      candidateCount: candidates.length,
      candidateIds: candidates.map(c => c.id),
    });
  }

  // Called by PrerequisiteEvaluationStage
  tracePrerequisite(actionId, prerequisiteIndex, condition, result, context) {
    this.traces.push({
      stage: 'prerequisite_evaluation',
      timestamp: Date.now(),
      actionId,
      prerequisiteIndex,
      condition,
      result,
      failureReason: result.passed ? null : this.analyzeFailure(condition, context),
      componentState: this.captureRelevantComponents(condition, context),
    });
  }

  // Called by UnifiedScopeResolver
  traceScopeResolution(scopeName, steps, result) {
    this.traces.push({
      stage: 'scope_resolution',
      timestamp: Date.now(),
      scopeName,
      steps, // [{operation: 'field_access', path: '...', result: '...'}, ...]
      finalResult: result,
    });
  }

  // Save to file (structured JSON)
  saveToFile(filepath) {
    const output = {
      actorId: this.actorId,
      timestamp: Date.now(),
      traces: this.traces,
      summary: this.generateSummary(),
    };
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  }

  // Analyze why prerequisite failed
  analyzeFailure(condition, context) {
    // Deep analysis of condition vs actual component state
    // Returns human-readable explanation
  }

  // Generate summary
  generateSummary() {
    return {
      totalCandidates: this.countByStage('candidate_selection'),
      prerequisiteFailures: this.countByStage('prerequisite_evaluation', 'failed'),
      scopeResolutions: this.countByStage('scope_resolution'),
      finalActions: this.countByStage('action_formatting'),
    };
  }
}
```

**Integration with Existing ModTestFixture**:
```javascript
// Extend ModTestFixture to support enhanced diagnostics
class ModTestFixture {
  enableEnhancedDiagnostics(options = {}) {
    this.#enhancedTracer = new ActionDiscoveryTracer({
      actorId: options.actorId,
      outputMode: options.outputMode || 'both', // console + file
      extends: this.#discoveryDiagnostics // Extend existing DiscoveryDiagnostics
    });
  }
}
```

**Usage in Tests**:
```javascript
it('should trace why action not discovered', async () => {
  // Leverage existing ModTestFixture infrastructure
  testFixture.enableEnhancedDiagnostics({ actorId: 'actor1' });

  // Use existing discoverActions method
  const actions = await testFixture.discoverActions('actor1');

  // Access enhanced tracer
  const tracer = testFixture.getEnhancedTracer();

  // Assert on trace data
  const prerequisiteTrace = tracer.findTrace({
    stage: 'prerequisite_evaluation',
    actionId: 'positioning:straddle_waist_facing'
  });

  expect(prerequisiteTrace.result.passed).toBe(false);
  expect(prerequisiteTrace.failureReason).toContain('movement locked');
});
```

**Benefits**:
- Builds on existing `DiscoveryDiagnostics` foundation
- No manual diagnostic code insertion
- Structured, parseable output (enhanced from console-only)
- File-based persistence (new capability)
- Reusable across development and testing
- Backwards compatible with existing diagnostic usage

#### 1.2 Prerequisite Failure Detail Capture

**Purpose**: Provide detailed explanation when prerequisites fail.

**Design**:
```javascript
class PrerequisiteAnalyzer {
  constructor({ entityManager, componentRepository }) {
    this.entityManager = entityManager;
    this.componentRepository = componentRepository;
  }

  analyzeFailure(condition, context, result) {
    if (result.passed) return null;

    // For condition_ref
    if (condition.condition_ref) {
      const conditionDef = this.loadCondition(condition.condition_ref);
      return this.analyzeJsonLogic(conditionDef.logic, context);
    }

    // For inline JSON Logic
    return this.analyzeJsonLogic(condition, context);
  }

  analyzeJsonLogic(logic, context) {
    const analysis = {
      condition: logic,
      context: this.sanitizeContext(context),
      failures: [],
    };

    // Recursively analyze logic tree
    if (logic['==']) {
      const [left, right] = logic['=='];
      const leftValue = this.evaluateExpression(left, context);
      const rightValue = this.evaluateExpression(right, context);
      
      if (leftValue !== rightValue) {
        analysis.failures.push({
          operator: '==',
          expected: rightValue,
          actual: leftValue,
          path: this.extractPath(left),
          explanation: this.explainMismatch(left, leftValue, rightValue, context),
        });
      }
    }

    // Handle hasPartWithComponentValue, etc.
    if (logic.hasPartWithComponentValue) {
      const [componentId, field, expectedValue] = logic.hasPartWithComponentValue;
      const entity = context.actor;
      const parts = this.getParts(entity);
      const matchingParts = parts.filter(part => {
        const component = part.components[componentId];
        return component && component[field] === expectedValue;
      });

      if (matchingParts.length === 0) {
        analysis.failures.push({
          operator: 'hasPartWithComponentValue',
          componentId,
          field,
          expectedValue,
          actualParts: parts.map(p => ({
            id: p.id,
            componentValue: p.components[componentId]?.[field],
          })),
          explanation: `No parts found with ${componentId}.${field} = ${expectedValue}`,
        });
      }
    }

    // Component lock detection
    if (this.isMovementCheck(logic) && this.hasMovementLock(context.actor)) {
      const lockSource = this.findLockSource(context.actor);
      analysis.failures.push({
        operator: 'movement_check',
        explanation: `Movement locked by ${lockSource.component} (set via ${lockSource.operation})`,
        lockDetails: lockSource,
      });
    }

    return analysis;
  }

  isMovementCheck(logic) {
    // Detect movement:actor-can-move or similar
    return logic.condition_ref === 'movement:actor-can-move';
  }

  hasMovementLock(entity) {
    return entity.components['core:movement']?.locked === true;
  }

  findLockSource(entity) {
    // Trace back to component that set movement lock
    // Check for positioning:closeness, etc.
    if (entity.components['positioning:closeness']) {
      return {
        component: 'positioning:closeness',
        operation: 'MERGE_CLOSENESS_CIRCLE',
        reason: 'Closeness circle members cannot move',
      };
    }
    return { component: 'unknown', operation: 'unknown' };
  }

  explainMismatch(expression, actual, expected, context) {
    // Generate human-readable explanation
    const path = this.extractPath(expression);
    return `Expected ${path} to be ${expected}, but was ${actual}`;
  }
}
```

**Integration with Tracing**:
```javascript
// In PrerequisiteEvaluationStage
evaluatePrerequisite(action, prerequisite, context, tracer) {
  const result = this.#evaluator.evaluate(prerequisite.logic, context);
  
  if (tracer && !result.passed) {
    const analyzer = new PrerequisiteAnalyzer({
      entityManager: this.#entityManager,
      componentRepository: this.#componentRepository,
    });
    
    const analysis = analyzer.analyzeFailure(prerequisite.logic, context, result);
    
    tracer.tracePrerequisite(
      action.id,
      prerequisite.index,
      prerequisite.logic,
      { passed: false, analysis },
      context
    );
  }
  
  return result;
}
```

**Output Example**:
```json
{
  "stage": "prerequisite_evaluation",
  "actionId": "positioning:straddle_waist_facing",
  "prerequisiteIndex": 0,
  "result": {
    "passed": false,
    "analysis": {
      "condition": { "condition_ref": "movement:actor-can-move" },
      "failures": [{
        "operator": "movement_check",
        "explanation": "Movement locked by positioning:closeness (set via MERGE_CLOSENESS_CIRCLE)",
        "lockDetails": {
          "component": "positioning:closeness",
          "operation": "MERGE_CLOSENESS_CIRCLE",
          "reason": "Closeness circle members cannot move"
        }
      }]
    }
  }
}
```

#### 1.3 Scope Resolution Step-by-Step Logging

**Purpose**: Make Scope DSL evaluation transparent.

**Design**:
```javascript
class ScopeResolutionTracer {
  constructor() {
    this.steps = [];
  }

  traceFieldAccess(path, entity, result) {
    this.steps.push({
      operation: 'field_access',
      path,
      entityId: entity.id,
      result,
      timestamp: Date.now(),
    });
  }

  traceArrayIteration(array, elementCount) {
    this.steps.push({
      operation: 'array_iteration',
      elementCount,
      elements: array.slice(0, 10), // First 10 for brevity
      timestamp: Date.now(),
    });
  }

  traceFilter(filterLogic, inputCount, outputCount, filtered) {
    this.steps.push({
      operation: 'filter',
      filterLogic,
      inputCount,
      outputCount,
      filtered: filtered.slice(0, 10),
      timestamp: Date.now(),
    });
  }

  traceUnion(leftSet, rightSet, result) {
    this.steps.push({
      operation: 'union',
      leftCount: leftSet.size,
      rightCount: rightSet.size,
      resultCount: result.size,
      timestamp: Date.now(),
    });
  }

  getTrace() {
    return {
      steps: this.steps,
      totalSteps: this.steps.length,
      duration: this.steps[this.steps.length - 1]?.timestamp - this.steps[0]?.timestamp,
    };
  }
}
```

**Integration**:
```javascript
// In UnifiedScopeResolver
resolveSync(scopeName, context, tracer) {
  const scopeTracer = tracer ? new ScopeResolutionTracer() : null;
  
  const result = this.#engine.resolve(scopeName, context, scopeTracer);
  
  if (tracer && scopeTracer) {
    tracer.traceScopeResolution(scopeName, scopeTracer.getTrace(), result);
  }
  
  return result;
}

// In stepResolver.js
resolveStep(entity, step, context, scopeTracer) {
  const result = /* existing field access logic */;
  
  if (scopeTracer) {
    scopeTracer.traceFieldAccess(step, entity, result);
  }
  
  return result;
}

// In arrayIterationResolver.js
resolveArrayIteration(array, filter, context, scopeTracer) {
  if (scopeTracer) {
    scopeTracer.traceArrayIteration(array, array.length);
  }
  
  const filtered = /* existing filter logic */;
  
  if (scopeTracer && filter) {
    scopeTracer.traceFilter(filter, array.length, filtered.length, filtered);
  }
  
  return filtered;
}
```

**Output Example**:
```json
{
  "stage": "scope_resolution",
  "scopeName": "positioning:actors_sitting_close",
  "steps": [
    {
      "operation": "field_access",
      "path": "actor.components.positioning:closeness",
      "entityId": "Alice",
      "result": { "partners": ["Jon Ureña", "Emma Watson"] }
    },
    {
      "operation": "field_access",
      "path": "partners",
      "entityId": "Alice",
      "result": ["Jon Ureña", "Emma Watson"]
    },
    {
      "operation": "array_iteration",
      "elementCount": 2,
      "elements": ["Jon Ureña", "Emma Watson"]
    },
    {
      "operation": "filter",
      "filterLogic": { "!!": { "var": "entity.components.positioning:sitting_on" } },
      "inputCount": 2,
      "outputCount": 1,
      "filtered": ["Jon Ureña"]
    }
  ],
  "finalResult": ["Jon Ureña"]
}
```

### 2. Development-Time Validation Tools

#### 2.1 Prerequisite Validator CLI

**Purpose**: Validate prerequisites against component definitions before runtime.

**Command**:
```bash
npm run validate:prerequisites
npm run validate:prerequisites -- --action positioning:straddle_waist_facing
npm run validate:prerequisites -- --mod positioning
```

**Design**:
```javascript
class PrerequisiteValidator {
  constructor({ componentRepository, conditionRepository, actionRepository }) {
    this.componentRepository = componentRepository;
    this.conditionRepository = conditionRepository;
    this.actionRepository = actionRepository;
  }

  validateAll() {
    const actions = this.actionRepository.getAllActions();
    const results = [];

    for (const action of actions) {
      if (!action.prerequisites) continue;

      for (let i = 0; i < action.prerequisites.length; i++) {
        const prerequisite = action.prerequisites[i];
        const result = this.validatePrerequisite(action, prerequisite, i);
        if (!result.valid) {
          results.push(result);
        }
      }
    }

    return {
      totalChecked: actions.length,
      totalPrerequisites: results.reduce((sum, r) => sum + r.prerequisiteCount, 0),
      issues: results.filter(r => !r.valid),
    };
  }

  validatePrerequisite(action, prerequisite, index) {
    const issues = [];

    // 1. Check if condition_ref exists
    if (prerequisite.logic.condition_ref) {
      const conditionId = prerequisite.logic.condition_ref;
      const condition = this.conditionRepository.getCondition(conditionId);
      
      if (!condition) {
        issues.push({
          type: 'missing_condition',
          severity: 'error',
          message: `Condition '${conditionId}' not found`,
        });
      } else {
        // 2. Check component references in condition
        const componentRefs = this.extractComponentReferences(condition.logic);
        for (const ref of componentRefs) {
          const [componentId, field] = ref.split('.');
          const componentDef = this.componentRepository.getComponent(componentId);
          
          if (!componentDef) {
            issues.push({
              type: 'missing_component',
              severity: 'error',
              message: `Component '${componentId}' referenced in condition not found`,
            });
          } else if (field && !componentDef.dataSchema.properties[field]) {
            issues.push({
              type: 'missing_field',
              severity: 'error',
              message: `Field '${field}' not defined in component '${componentId}'`,
            });
          }
        }
      }
    }

    // 3. Check for logical contradictions
    const contradictions = this.detectContradictions(action, prerequisite);
    issues.push(...contradictions);

    return {
      actionId: action.id,
      prerequisiteIndex: index,
      prerequisite,
      valid: issues.length === 0,
      issues,
    };
  }

  detectContradictions(action, prerequisite) {
    const contradictions = [];

    // Check if action requires components that create prerequisites conflicts
    const requiredActorComponents = action.required_components?.actor || [];
    
    // Example: If action requires positioning:closeness and has movement prerequisite
    if (requiredActorComponents.includes('positioning:closeness')) {
      if (this.isMovementPrerequisite(prerequisite)) {
        contradictions.push({
          type: 'logical_contradiction',
          severity: 'warning',
          message: 'Action requires positioning:closeness which locks movement, but has movement prerequisite',
          suggestion: 'Remove movement prerequisite or reconsider closeness requirement',
        });
      }
    }

    // Add more contradiction patterns...

    return contradictions;
  }

  extractComponentReferences(logic) {
    // Recursively extract all component.field references from JSON Logic
    const refs = [];
    
    if (typeof logic === 'object') {
      if (logic.var) {
        const path = logic.var;
        if (path.includes('components.')) {
          const match = path.match(/components\.([^.]+)(?:\.(.+))?/);
          if (match) {
            refs.push(match[1] + (match[2] ? '.' + match[2] : ''));
          }
        }
      }
      
      for (const key in logic) {
        if (Array.isArray(logic[key])) {
          for (const item of logic[key]) {
            refs.push(...this.extractComponentReferences(item));
          }
        } else if (typeof logic[key] === 'object') {
          refs.push(...this.extractComponentReferences(logic[key]));
        }
      }
    }
    
    return [...new Set(refs)];
  }
}
```

**Output Example**:
```
Validating prerequisites...

✗ positioning:straddle_waist_facing
  Prerequisite 0: movement:actor-can-move
    ⚠️  Warning: Logical contradiction detected
        Action requires positioning:closeness which locks movement,
        but has movement prerequisite
        Suggestion: Remove movement prerequisite or reconsider closeness requirement

✗ positioning:straddle_waist_facing_away
  Prerequisite 0: movement:actor-can-move
    ⚠️  Warning: Logical contradiction detected
        (same as above)

Summary:
  Total actions checked: 247
  Total prerequisites: 412
  Issues found: 2 warnings

Run with --fix to attempt automatic fixes
```

#### 2.2 Component Dependency Analyzer

**Purpose**: Visualize component interactions and dependencies.

**Command**:
```bash
npm run analyze:dependencies
npm run analyze:dependencies -- --component positioning:closeness
npm run analyze:dependencies -- --graph
```

**Design**:
```javascript
class ComponentDependencyAnalyzer {
  constructor({ operationHandlerRegistry, componentRepository, ruleRepository }) {
    this.operationHandlerRegistry = operationHandlerRegistry;
    this.componentRepository = componentRepository;
    this.ruleRepository = ruleRepository;
  }

  analyze(componentId) {
    const graph = {
      component: componentId,
      affectsComponents: [],
      affectedByComponents: [],
      usedInRules: [],
      usedInPrerequisites: [],
      operationInteractions: [],
    };

    // 1. Find operations that modify this component
    const operations = this.operationHandlerRegistry.getOperationsForComponent(componentId);
    for (const operation of operations) {
      const handler = this.operationHandlerRegistry.getHandler(operation);
      const effects = this.analyzeHandlerEffects(handler);
      
      graph.operationInteractions.push({
        operation,
        adds: effects.componentsAdded,
        modifies: effects.componentsModified,
        removes: effects.componentsRemoved,
      });

      // Track what this component affects
      for (const affected of [...effects.componentsAdded, ...effects.componentsModified]) {
        if (affected !== componentId && !graph.affectsComponents.includes(affected)) {
          graph.affectsComponents.push(affected);
        }
      }
    }

    // 2. Find operations that are affected by this component
    const allOperations = this.operationHandlerRegistry.getAllOperations();
    for (const operation of allOperations) {
      const handler = this.operationHandlerRegistry.getHandler(operation);
      const dependencies = this.analyzeHandlerDependencies(handler);
      
      if (dependencies.includes(componentId)) {
        graph.affectedByComponents.push({
          operation,
          reason: 'reads component for validation or logic',
        });
      }
    }

    // 3. Find rules that use this component
    const rules = this.ruleRepository.getAllRules();
    for (const rule of rules) {
      if (this.ruleUsesComponent(rule, componentId)) {
        graph.usedInRules.push(rule.id);
      }
    }

    // 4. Find prerequisites that check this component
    const actions = this.actionRepository.getAllActions();
    for (const action of actions) {
      if (action.prerequisites) {
        for (const prereq of action.prerequisites) {
          if (this.prerequisiteUsesComponent(prereq, componentId)) {
            graph.usedInPrerequisites.push({
              actionId: action.id,
              prerequisite: prereq,
            });
          }
        }
      }
    }

    return graph;
  }

  analyzeHandlerEffects(handler) {
    // Static analysis of handler code to detect component mutations
    // This is simplified - real implementation would parse handler source
    const effects = {
      componentsAdded: [],
      componentsModified: [],
      componentsRemoved: [],
    };

    // Example: Detect this.#componentMutationService.addComponent(...)
    const handlerSource = handler.toString();
    
    const addMatches = handlerSource.matchAll(/addComponent\([^,]+,\s*['"]([^'"]+)['"]/g);
    for (const match of addMatches) {
      effects.componentsAdded.push(match[1]);
    }

    const modifyMatches = handlerSource.matchAll(/modifyComponent\([^,]+,\s*['"]([^'"]+)['"]/g);
    for (const match of modifyMatches) {
      effects.componentsModified.push(match[1]);
    }

    const removeMatches = handlerSource.matchAll(/removeComponent\([^,]+,\s*['"]([^'"]+)['"]/g);
    for (const match of removeMatches) {
      effects.componentsRemoved.push(match[1]);
    }

    return effects;
  }

  generateDependencyGraph(componentId) {
    const graph = this.analyze(componentId);
    
    // Generate Mermaid diagram
    const mermaid = ['graph TD'];
    
    mermaid.push(`  ${componentId}[${componentId}]`);
    
    for (const interaction of graph.operationInteractions) {
      mermaid.push(`  ${interaction.operation}["${interaction.operation}"]`);
      mermaid.push(`  ${componentId} -->|used by| ${interaction.operation}`);
      
      for (const affected of interaction.modifies) {
        mermaid.push(`  ${interaction.operation} -->|modifies| ${affected}[${affected}]`);
      }
    }

    return mermaid.join('\n');
  }
}
```

**Output Example**:
```
Component Dependency Analysis: positioning:closeness

Affects Components:
  ✓ core:movement (via MERGE_CLOSENESS_CIRCLE)
    - Sets core:movement.locked = true
    - Reason: Closeness circle members cannot move

Used in Rules:
  ✓ positioning:establish_closeness
  ✓ positioning:break_closeness

Used in Prerequisites:
  None (positioning:closeness is not checked by prerequisites)

Checked By Prerequisites:
  ✗ movement:actor-can-move checks core:movement.locked
    - Conflict: positioning:closeness locks movement
    - Actions affected:
      - positioning:straddle_waist_facing
      - positioning:straddle_waist_facing_away

Dependency Graph (Mermaid):
graph TD
  positioning:closeness[positioning:closeness]
  MERGE_CLOSENESS_CIRCLE["MERGE_CLOSENESS_CIRCLE"]
  positioning:closeness -->|used by| MERGE_CLOSENESS_CIRCLE
  MERGE_CLOSENESS_CIRCLE -->|modifies| core:movement[core:movement]
  core:movement -->|checked by| movement:actor-can-move["movement:actor-can-move"]
  movement:actor-can-move -->|blocks| positioning:straddle_waist_facing
```

### 3. Test Infrastructure Improvements

#### 3.1 ModTestFixture Scope Loading Support

**Current State**: ModTestFixture has robust auto-loading capabilities:
- ✅ `forActionAutoLoad()` - Auto-loads action definition files
- ✅ `forRuleAutoLoad()` - Auto-loads rule files with convention-based detection
- ✅ `loadModFiles()` - Loads actions, rules, conditions based on file naming conventions
- ✅ Partial loading - Only loads missing files (efficient)
- ✅ Error handling with detailed messages
- ❌ **Missing**: Scope file (.scope) loading

**Current Limitation - Scope Files**:
```javascript
// ModTestFixture doesn't load .scope files yet
// Tests need custom JavaScript scope resolver to replicate scope logic
testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
  if (scopeName === 'positioning:actors_sitting_close') {
    // Custom implementation must match .scope file logic
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    const closeness = actor?.components?.['positioning:closeness'];
    const sittingPartners = closeness.partners.filter(partnerId => {
      const partner = testFixture.entityManager.getEntityInstance(partnerId);
      return !!partner?.components?.['positioning:sitting_on'];
    });
    return { success: true, value: new Set(sittingPartners) };
  }
  return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
};
```

**Problem**: Tests/runtime divergence - custom resolver can drift from .scope file

**Purpose**: Extend ModTestFixture's auto-loading pattern to include .scope files.

**Proposed Enhancement** (extending existing auto-loading infrastructure):
```javascript
// In ModTestFixture - extend existing forActionAutoLoad pattern
static async forAction(modId, actionId, rule, eventCondition, options = {}) {
  const fixture = new ModTestFixture(modId);

  // EXISTING: Auto-load actions/rules/conditions (already implemented)
  if (options.autoLoad !== false) {
    await fixture.loadModFiles(modId);
  }

  // NEW: Extend auto-loading to include scope files (follows same pattern)
  if (options.loadScopes !== false) { // Default to true
    await fixture.loadScopeDefinitions(modId); // New method following loadModFiles pattern
  }

  fixture.testEnv.eventBus.register(eventCondition);
  fixture.testEnv.ruleExecutor.registerRule(rule);

  return fixture;
}

async loadScopeDefinitions(modId) {
  const scopeDir = `data/mods/${modId}/scopes/`;
  
  if (!fs.existsSync(scopeDir)) {
    return [];
  }

  const scopeFiles = fs.readdirSync(scopeDir)
    .filter(f => f.endsWith('.scope'));

  const scopes = [];
  for (const file of scopeFiles) {
    const content = fs.readFileSync(`${scopeDir}${file}`, 'utf-8');
    const scopeDef = this.parseScopeDefinition(content, file);
    scopes.push(scopeDef);
  }

  return scopes;
}

parseScopeDefinition(content, filename) {
  // Parse "scopeName := scopeDsl" format
  const match = content.match(/^([^\s:]+)\s*:=\s*(.+)$/m);
  
  if (!match) {
    throw new Error(`Invalid scope definition in ${filename}`);
  }

  return {
    name: match[1].trim(),
    dsl: match[2].trim(),
    filename,
  };
}
```

**Usage**:
```javascript
describe('straddle_waist_facing action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:straddle_waist_facing',
      straddleFacingRule,
      eventIsActionStraddleFacing,
      { loadScopes: true } // NEW: Load actual .scope files
    );

    // No more custom scope resolver needed!
    configureActionDiscovery();
  });

  it('should discover action when actor is close to sitting target', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const chair = new ModEntityBuilder('chair1').withName('Chair').atLocation('room1').build();
    
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .closeToEntity('target1')
      .asActor()
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .closeToEntity('actor1')
      .asActor()
      .withComponent('positioning:sitting_on', { furniture_id: 'chair1', spot_index: 0 })
      .build();

    testFixture.reset([room, chair, actor, target]);

    // Real Scope DSL engine will resolve positioning:actors_sitting_close
    const actions = await testFixture.discoverActions('actor1');

    expect(actions).toContainEqual(
      expect.objectContaining({
        id: 'positioning:straddle_waist_facing',
        targets: expect.objectContaining({
          primary: expect.objectContaining({
            scope: 'positioning:actors_sitting_close'
          })
        })
      })
    );
  });
});
```

**Benefits**:
- Tests match runtime behavior exactly
- No custom scope resolver maintenance
- Catches scope definition syntax errors
- Detects .scope file changes in tests

#### 3.2 Action Discovery Assertion Helpers

**Current State**: `ModAssertionHelpers` provides basic action assertions integrated with ModTestFixture:
- ✅ `assertActionSuccess(expectedMessage, options)` - Validates action execution
- ✅ `assertPerceptibleEvent(expectedEvent)` - Checks event dispatching
- ✅ `assertComponentAdded(entityId, componentId, expectedData)` - Component verification
- ✅ `assertActionFailure(options)` - Failure validation
- ✅ `assertOnlyExpectedEvents(allowedEventTypes)` - Event filtering

**Limitations**:
- Basic assertions don't provide discovery-specific diagnostics
- No automatic trace output on assertion failure
- Missing detailed "why not discovered" explanations
- Limited scope resolution validation

**Purpose**: Extend `ModAssertionHelpers` with discovery-focused assertions providing automatic diagnostics.

**Proposed Enhancement** (extending existing helpers):
```javascript
// Extend ModAssertionHelpers class
class ModAssertionHelpers {
  // EXISTING methods remain unchanged
  assertActionSuccess(expectedMessage, options) { /* existing */ }
  assertComponentAdded(entityId, componentId, expectedData) { /* existing */ }

  // NEW: Discovery-specific assertions (building on existing patterns)
  async assertActionDiscovered(actorId, actionId, options = {}) {
    // Leverages existing testFixture.discoverActions()
    // Integrates with enhanced tracer for diagnostics
  }

  async assertActionNotDiscovered(actorId, actionId, options = {}) {
    // Uses existing discovery infrastructure
    // Provides diagnostic output explaining why filtered
  }
}
```

**Implementation** (within ModAssertionHelpers):
```javascript
// Extend existing ModAssertionHelpers in tests/common/mods/ModAssertionHelpers.js
class ModAssertionHelpers {
  // ... existing methods ...

  // NEW: Discovery-specific assertions
  async assertActionDiscovered(actorId, actionId, options = {}) {
    // Integrate with existing discoverActions infrastructure
    const tracer = new ActionDiscoveryTracer({ actorId });
    const actions = await this.testFixture.discoverActions(actorId, { trace: tracer });
    
    const action = actions.find(a => a.id === actionId);
    
    if (!action) {
      const diagnostic = this.generateDiagnostic(actionId, tracer);
      throw new Error(`Action '${actionId}' not discovered for actor '${actorId}'.\n\n${diagnostic}`);
    }

    if (options.withTargets) {
      this.assertTargets(action, options.withTargets);
    }

    return action;
  }

  async assertActionNotDiscovered(actorId, actionId, options = {}) {
    const tracer = new ActionDiscoveryTracer({ actorId });
    const actions = await this.testFixture.discoverActions(actorId, { trace: tracer });
    
    const action = actions.find(a => a.id === actionId);
    
    if (action) {
      throw new Error(`Action '${actionId}' was discovered but should not have been`);
    }

    if (options.expectedReason) {
      const diagnostic = this.generateDiagnostic(actionId, tracer);
      if (!diagnostic.includes(options.expectedReason)) {
        throw new Error(`Action filtered for unexpected reason.\nExpected: ${options.expectedReason}\nActual: ${diagnostic}`);
      }
    }
  }

  generateDiagnostic(actionId, tracer) {
    const lines = [];
    
    // Check candidate selection
    const candidateTrace = tracer.findTrace({ stage: 'candidate_selection' });
    if (candidateTrace && !candidateTrace.candidateIds.includes(actionId)) {
      lines.push(`❌ Not in candidate list (filtered by component requirements)`);
      lines.push(`   Actor components: ${candidateTrace.actorComponents.join(', ')}`);
      
      const actionDef = this.testFixture.testEnv.actionIndex.getAction(actionId);
      if (actionDef) {
        const required = actionDef.required_components?.actor || [];
        lines.push(`   Required components: ${required.join(', ')}`);
      }
    } else {
      lines.push(`✓ Included in candidate list`);
    }

    // Check prerequisite evaluation
    const prereqTraces = tracer.findTraces({ 
      stage: 'prerequisite_evaluation',
      actionId 
    });
    
    if (prereqTraces.length > 0) {
      lines.push(`\nPrerequisite Evaluation:`);
      for (const trace of prereqTraces) {
        if (!trace.result.passed) {
          lines.push(`❌ Prerequisite ${trace.prerequisiteIndex} failed`);
          if (trace.result.analysis) {
            for (const failure of trace.result.analysis.failures) {
              lines.push(`   ${failure.explanation}`);
            }
          }
        } else {
          lines.push(`✓ Prerequisite ${trace.prerequisiteIndex} passed`);
        }
      }
    }

    // Check scope resolution
    const scopeTraces = tracer.findTraces({ stage: 'scope_resolution' });
    if (scopeTraces.length > 0) {
      lines.push(`\nScope Resolution:`);
      for (const trace of scopeTraces) {
        lines.push(`  ${trace.scopeName}: ${trace.finalResult.size} entities`);
        if (trace.finalResult.size === 0) {
          lines.push(`  ❌ Empty result set`);
          // Show scope resolution steps
          for (const step of trace.steps) {
            lines.push(`    ${step.operation}: ${JSON.stringify(step.result)}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  assertTargets(action, expectedTargets) {
    for (const [targetType, expectedScope] of Object.entries(expectedTargets)) {
      const actualTarget = action.targets[targetType];
      
      if (!actualTarget) {
        throw new Error(`Expected ${targetType} target with scope ${expectedScope}, but ${targetType} target not found`);
      }

      if (actualTarget.scope !== expectedScope) {
        throw new Error(`Expected ${targetType} target scope ${expectedScope}, but got ${actualTarget.scope}`);
      }
    }
  }
}

// Usage in tests - directly on ModTestFixture (via ModAssertionHelpers)
describe('action discovery assertions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:straddle_waist_facing',
      straddleFacingRule,
      eventIsActionStraddleFacing,
      { loadScopes: true } // Use real scope files
    );
  });

  it('should discover action with detailed diagnostics on failure', async () => {
    setupEntities();

    // Use extended ModAssertionHelpers (already integrated with testFixture)
    await testFixture.assertActionDiscovered('actor1', 'positioning:straddle_waist_facing', {
      withTargets: {
        primary: 'positioning:actors_sitting_close'
      }
    });
  });

  it('should explain why action not discovered', async () => {
    setupEntitiesWithoutSitting();

    // Leverage existing assertion framework
    await testFixture.assertActionNotDiscovered('actor1', 'positioning:straddle_waist_facing', {
      expectedReason: 'Empty result set for positioning:actors_sitting_close'
    });
  });
});
```

**Benefits**:
- Extends existing `ModAssertionHelpers` (not a separate system)
- Automatic diagnostic output on test failure
- Clear failure messages explaining why action not discovered
- Integrates with existing ModTestFixture infrastructure
- Backwards compatible (existing assertions still work)
- Reduces test debugging time significantly

### 4. Enhanced Logging and Debugging

#### 4.1 Structured Diagnostic Output

**Purpose**: Avoid browser console truncation by writing structured JSON to files.

**Design**:
```javascript
class StructuredDiagnosticWriter {
  constructor({ outputDir = 'traces/', maxDepth = 10 }) {
    this.outputDir = outputDir;
    this.maxDepth = maxDepth;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  write(name, data) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${this.outputDir}${name}-${timestamp}.json`;
    
    const output = {
      timestamp: new Date().toISOString(),
      name,
      data: this.sanitize(data),
    };

    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    
    return filename;
  }

  sanitize(obj, depth = 0) {
    if (depth > this.maxDepth) {
      return '[Max depth exceeded]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item, depth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = this.sanitize(value, depth + 1);
    }

    return sanitized;
  }

  writeComparison(name, expected, actual) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${this.outputDir}${name}-comparison-${timestamp}.json`;
    
    const output = {
      timestamp: new Date().toISOString(),
      name,
      comparison: {
        expected: this.sanitize(expected),
        actual: this.sanitize(actual),
        differences: this.computeDifferences(expected, actual),
      },
    };

    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    
    return filename;
  }

  computeDifferences(expected, actual, path = '') {
    const differences = [];

    if (typeof expected !== typeof actual) {
      differences.push({
        path,
        expected: typeof expected,
        actual: typeof actual,
        type: 'type_mismatch',
      });
      return differences;
    }

    if (typeof expected !== 'object') {
      if (expected !== actual) {
        differences.push({
          path,
          expected,
          actual,
          type: 'value_mismatch',
        });
      }
      return differences;
    }

    // Object/array comparison
    const allKeys = new Set([
      ...Object.keys(expected || {}),
      ...Object.keys(actual || {}),
    ]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in expected)) {
        differences.push({
          path: newPath,
          type: 'unexpected_key',
          actual: actual[key],
        });
      } else if (!(key in actual)) {
        differences.push({
          path: newPath,
          type: 'missing_key',
          expected: expected[key],
        });
      } else {
        differences.push(...this.computeDifferences(expected[key], actual[key], newPath));
      }
    }

    return differences;
  }
}
```

**Integration**:
```javascript
// In AvailableActionsProvider
discoverActions(actorId, options = {}) {
  const diagnosticWriter = new StructuredDiagnosticWriter();
  
  if (options.diagnostics) {
    const actorEntity = this.#entityManager.getEntityInstance(actorId);
    
    diagnosticWriter.write('actor-state', {
      id: actorId,
      components: actorEntity.components,
      componentTypes: this.#entityManager.getAllComponentTypesForEntity(actorId),
    });
  }

  const actions = /* normal discovery */;

  if (options.diagnostics) {
    diagnosticWriter.write('discovered-actions', {
      actorId,
      actionCount: actions.length,
      actions: actions.map(a => ({
        id: a.id,
        name: a.name,
        targets: a.targets,
      })),
    });
  }

  return actions;
}
```

**Benefits**:
- No console truncation
- Persistent, parseable output
- Easy to share with others
- Can be versioned in git for regression testing

#### 4.2 Interactive Debugging REPL

**Purpose**: Provide interactive debugging console for action discovery.

**Command**:
```bash
npm run debug:actions -- --actor Alice
```

**Design**:
```javascript
import repl from 'repl';
import { container } from './dependencyInjection/container.js';

class ActionDiscoveryREPL {
  constructor() {
    this.container = container;
    this.entityManager = container.resolve('IEntityManager');
    this.availableActionsProvider = container.resolve('IAvailableActionsProvider');
    this.scopeResolver = container.resolve('IUnifiedScopeResolver');
  }

  start() {
    const replServer = repl.start({
      prompt: 'action-debug> ',
      useColors: true,
    });

    // Add helper commands
    replServer.defineCommand('discover', {
      help: 'Discover actions for actor',
      action: (actorId) => {
        this.discoverActions(actorId);
      },
    });

    replServer.defineCommand('scope', {
      help: 'Resolve scope for actor',
      action: (input) => {
        const [scopeName, actorId] = input.split(' ');
        this.resolveScope(scopeName, actorId);
      },
    });

    replServer.defineCommand('component', {
      help: 'Show component for entity',
      action: (input) => {
        const [entityId, componentId] = input.split(' ');
        this.showComponent(entityId, componentId);
      },
    });

    replServer.defineCommand('trace', {
      help: 'Enable tracing',
      action: () => {
        this.tracingEnabled = true;
        console.log('Tracing enabled');
      },
    });

    // Add context objects
    replServer.context.entityManager = this.entityManager;
    replServer.context.provider = this.availableActionsProvider;
    replServer.context.resolver = this.scopeResolver;
  }

  discoverActions(actorId) {
    const tracer = new ActionDiscoveryTracer({ actorId, outputMode: 'console' });
    
    const actions = this.availableActionsProvider.discoverActions(actorId, {
      trace: this.tracingEnabled ? tracer : null,
    });

    console.log(`\nDiscovered ${actions.length} actions for ${actorId}:`);
    for (const action of actions) {
      console.log(`  - ${action.id}: ${action.name}`);
    }

    if (this.tracingEnabled) {
      tracer.printSummary();
    }
  }

  resolveScope(scopeName, actorId) {
    const actor = this.entityManager.getEntityInstance(actorId);
    const context = { actor };

    const scopeTracer = new ScopeResolutionTracer();
    const result = this.scopeResolver.resolveSync(scopeName, context, scopeTracer);

    console.log(`\nScope ${scopeName} resolved to:`, result.value);
    console.log(`\nResolution steps:`);
    
    for (const step of scopeTracer.steps) {
      console.log(`  ${step.operation}: ${JSON.stringify(step.result)}`);
    }
  }

  showComponent(entityId, componentId) {
    const entity = this.entityManager.getEntityInstance(entityId);
    const component = entity.components[componentId];

    console.log(`\n${componentId} on ${entityId}:`);
    console.log(JSON.stringify(component, null, 2));
  }
}

// CLI entry point
if (process.argv[1] === import.meta.url) {
  const debugRepl = new ActionDiscoveryREPL();
  debugRepl.start();
}
```

**Usage Example**:
```
$ npm run debug:actions

action-debug> .discover Alice
Discovered 15 actions for Alice:
  - core:look_around: Look Around
  - core:examine_entity: Examine
  - positioning:straddle_waist_facing: Straddle Waist (Facing)
  ...

action-debug> .trace
Tracing enabled

action-debug> .discover Alice
[Detailed trace output...]

action-debug> .scope positioning:actors_sitting_close Alice
Scope positioning:actors_sitting_close resolved to: Set(1) { 'Jon Ureña' }

Resolution steps:
  field_access: {"partners":["Jon Ureña","Emma Watson"]}
  array_iteration: ["Jon Ureña","Emma Watson"]
  filter: ["Jon Ureña"]

action-debug> .component Alice positioning:closeness
positioning:closeness on Alice:
{
  "partners": ["Jon Ureña", "Emma Watson"]
}

action-debug> entityManager.getAllComponentTypesForEntity('Alice')
['core:actor', 'positioning:closeness', 'core:inventory', ...]
```

**Benefits**:
- Interactive exploration of game state
- Real-time debugging without code changes
- Quick hypothesis testing
- Educational for understanding system behavior

### 5. Testing Framework Extensions

#### 5.1 Action Discovery Test Builder

**Purpose**: Fluent API for building action discovery tests with minimal boilerplate.

**Design**:
```javascript
class ActionDiscoveryTestBuilder {
  constructor(modId, actionId) {
    this.modId = modId;
    this.actionId = actionId;
    this.entities = [];
    this.expectedActions = [];
    this.unexpectedActions = [];
    this.scopeAssertions = [];
  }

  withEntities(...entities) {
    this.entities.push(...entities);
    return this;
  }

  expectActionDiscovered(actionId, options = {}) {
    this.expectedActions.push({ actionId, options });
    return this;
  }

  expectActionNotDiscovered(actionId, options = {}) {
    this.unexpectedActions.push({ actionId, options });
    return this;
  }

  expectScopeToResolve(scopeName, expectedEntities) {
    this.scopeAssertions.push({ scopeName, expectedEntities });
    return this;
  }

  async run(testFixture) {
    // Setup entities
    testFixture.reset(this.entities);

    // Get actor ID from entities
    const actorEntity = this.entities.find(e => e.components['core:actor']);
    if (!actorEntity) {
      throw new Error('No actor entity found in test builder entities');
    }

    // Create assertions helper
    const assertions = new ActionDiscoveryAssertions(testFixture);

    // Assert expected actions
    for (const { actionId, options } of this.expectedActions) {
      await assertions.assertActionDiscovered(actorEntity.id, actionId, options);
    }

    // Assert unexpected actions
    for (const { actionId, options } of this.unexpectedActions) {
      await assertions.assertActionNotDiscovered(actorEntity.id, actionId, options);
    }

    // Assert scope resolutions
    for (const { scopeName, expectedEntities } of this.scopeAssertions) {
      const actor = testFixture.entityManager.getEntityInstance(actorEntity.id);
      const context = { actor };
      
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(scopeName, context);
      
      expect(result.value).toEqual(new Set(expectedEntities));
    }
  }
}

// Factory function
export function buildActionDiscoveryTest(modId, actionId) {
  return new ActionDiscoveryTestBuilder(modId, actionId);
}
```

**Usage**:
```javascript
import { buildActionDiscoveryTest } from '../../../common/actionDiscoveryTestBuilder.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('straddle_waist_facing action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:straddle_waist_facing',
      straddleFacingRule,
      eventIsActionStraddleFacing,
      { loadScopes: true }
    );
  });

  it('should discover when actor close to sitting target', async () => {
    await buildActionDiscoveryTest('positioning', 'straddle_waist_facing')
      .withEntities(
        new ModEntityBuilder('room1').asRoom('Test Room').build(),
        new ModEntityBuilder('chair1').withName('Chair').atLocation('room1').build(),
        new ModEntityBuilder('actor1')
          .withName('Alice')
          .atLocation('room1')
          .closeToEntity('target1')
          .asActor()
          .build(),
        new ModEntityBuilder('target1')
          .withName('Bob')
          .atLocation('room1')
          .closeToEntity('actor1')
          .asActor()
          .withComponent('positioning:sitting_on', { furniture_id: 'chair1', spot_index: 0 })
          .build()
      )
      .expectActionDiscovered('positioning:straddle_waist_facing', {
        withTargets: { primary: 'positioning:actors_sitting_close' }
      })
      .expectScopeToResolve('positioning:actors_sitting_close', ['target1'])
      .run(testFixture);
  });

  it('should NOT discover when target not sitting', async () => {
    await buildActionDiscoveryTest('positioning', 'straddle_waist_facing')
      .withEntities(
        new ModEntityBuilder('room1').asRoom('Test Room').build(),
        new ModEntityBuilder('actor1')
          .withName('Alice')
          .atLocation('room1')
          .closeToEntity('target1')
          .asActor()
          .build(),
        new ModEntityBuilder('target1')
          .withName('Bob')
          .atLocation('room1')
          .closeToEntity('actor1')
          .asActor()
          .build()
      )
      .expectActionNotDiscovered('positioning:straddle_waist_facing', {
        expectedReason: 'Empty result set for positioning:actors_sitting_close'
      })
      .expectScopeToResolve('positioning:actors_sitting_close', [])
      .run(testFixture);
  });
});
```

**Benefits**:
- 70-80% less test code
- Declarative test structure
- Built-in diagnostic output
- Consistent test patterns

## Implementation Plan

### Phase 1: Enhance Core Diagnostics (Week 1-2)

**Priority**: High
**Dependencies**: None
**Approach**: Extend existing `DiscoveryDiagnostics` infrastructure

**Tasks**:
1. **Enhance DiscoveryDiagnostics** (extend existing class):
   - Add structured JSON output mode alongside console output
   - Add file persistence capability
   - Keep existing console output for backwards compatibility
2. **Extend to Pipeline Stages**:
   - Integrate enhanced tracing into `ActionIndex.getCandidateActions()`
   - Add tracing to `PrerequisiteEvaluationStage`
   - Extend `UnifiedScopeResolver` tracing (already has basic support)
3. **Enhance Scope Tracing**:
   - Extend existing scope resolution tracing in stepResolver
   - Add detailed tracing to arrayIterationResolver
4. **Add File Output**:
   - Create `StructuredDiagnosticWriter` for file persistence
   - Integrate with existing `ModTestFixture.enableDiagnostics()`
5. **Development Mode Integration**:
   - Add `--trace` flag option to existing diagnostic system

**Deliverables**:
- Enhanced `DiscoveryDiagnostics` with JSON + file output
- Structured trace files in `traces/` directory
- Backwards compatible (existing usage still works)
- No more manual diagnostic logging needed
- Prerequisite failure details visible

**Testing**:
- Unit tests for enhanced diagnostic methods
- Integration tests verifying both console + file output
- Verify backwards compatibility with existing diagnostic usage
- Verify trace files parseable and complete

### Phase 2: Validation Tools (Week 3-4)

**Priority**: High
**Dependencies**: Phase 1

**Tasks**:
1. Implement `PrerequisiteValidator` class
2. Create `PrerequisiteAnalyzer` for contradiction detection
3. Add `npm run validate:prerequisites` command
4. Implement `ComponentDependencyAnalyzer`
5. Add `npm run analyze:dependencies` command
6. Create Mermaid diagram generation
7. Integrate validation into pre-commit hooks

**Deliverables**:
- CLI tool for prerequisite validation
- Component dependency graphs
- Design-time detection of logical contradictions
- Documentation for validation tools

**Testing**:
- Test validator on existing actions
- Verify contradiction detection (straddling case)
- Test dependency analyzer output

### Phase 3: Enhance Test Infrastructure (Week 5-6)

**Priority**: Medium
**Dependencies**: Phase 1, Phase 2
**Approach**: Extend existing ModTestFixture and ModAssertionHelpers

**Tasks**:
1. **Extend ModTestFixture Auto-Loading**:
   - Add `loadScopeDefinitions()` method following existing `loadModFiles()` pattern
   - Integrate scope loading into existing `forActionAutoLoad()` flow
   - Add `options.loadScopes` parameter (default true)
2. **Extend ModAssertionHelpers**:
   - Add `assertActionDiscovered()` to existing helpers
   - Add `assertActionNotDiscovered()` to existing helpers
   - Integrate with enhanced diagnostics from Phase 1
   - Maintain backwards compatibility with existing assertions
3. **Create Test Builder** (optional enhancement):
   - Build `ActionDiscoveryTestBuilder` on top of existing infrastructure
   - Integrate with ModTestFixture and ModAssertionHelpers
4. **Migration Support**:
   - Migrate 5-10 existing tests as examples
   - Document enhancement patterns
   - Create migration guide emphasizing backwards compatibility

**Deliverables**:
- ModTestFixture loads .scope files (extends auto-loading)
- ModAssertionHelpers with discovery assertions (extends existing)
- Fluent test builder API (optional layer)
- Migration guide showing gradual adoption path

**Testing**:
- Verify migrated tests pass
- Test backwards compatibility (existing tests still work)
- Test scope loading with real .scope files
- Verify extended assertion helpers provide useful diagnostics

### Phase 4: Developer Experience (Week 7-8)

**Priority**: Low
**Dependencies**: Phase 1, Phase 2, Phase 3

**Tasks**:
1. Implement `ActionDiscoveryREPL`
2. Add REPL helper commands
3. Create developer documentation
4. Add troubleshooting guide
5. Create video tutorials
6. Integrate with VS Code debugging

**Deliverables**:
- Interactive debugging REPL
- Developer documentation
- Troubleshooting guide
- Video tutorials

**Testing**:
- Manual testing of REPL
- Documentation review
- User testing with team

## Success Metrics

### Debugging Efficiency
- **Baseline**: 4 days to diagnose straddling action issue (basic `DiscoveryDiagnostics` insufficient)
- **Target**: <4 hours for similar issues (enhanced diagnostics with file output + prerequisite analysis)
- **Measure**: Time from bug report to root cause identification

### Test Maintenance
- **Baseline**: Custom scope resolvers in every action discovery test (ModTestFixture doesn't load .scope files)
- **Target**: Zero custom resolvers (using real .scope files via enhanced auto-loading)
- **Measure**: Percentage of tests using enhanced ModTestFixture scope loading

### Issue Prevention
- **Baseline**: No design-time prerequisite validation (new capability)
- **Target**: 100% of prerequisite contradictions caught at design time
- **Measure**: Prerequisite validator coverage

### Developer Experience
- **Baseline**: Manual diagnostic logging in 5+ files (basic diagnostics insufficient)
- **Target**: Zero manual diagnostic code (enhanced diagnostics + file output)
- **Measure**: Number of diagnostic code insertions per debugging session

### Infrastructure Enhancement
- **Baseline**: Existing test infrastructure covers actions/rules/conditions auto-loading, basic assertions
- **Target**: All core testing capabilities extended (scope loading, discovery assertions, advanced diagnostics)
- **Measure**: Percentage of existing infrastructure enhanced vs. replaced (target: 100% enhanced, 0% replaced)

## Migration Strategy

### For Existing Tests

**Step 1**: Enable scope loading
```javascript
// Before
testFixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:straddle_waist_facing',
  straddleFacingRule,
  eventIsActionStraddleFacing
);

// Custom scope resolver
testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
  // ... custom implementation
};

// After
testFixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:straddle_waist_facing',
  straddleFacingRule,
  eventIsActionStraddleFacing,
  { loadScopes: true } // NEW
);

// No custom resolver needed!
```

**Step 2**: Add assertion helpers
```javascript
// Before
const actions = await testFixture.discoverActions('actor1');
expect(actions.find(a => a.id === 'positioning:straddle_waist_facing')).toBeDefined();

// After
const assertions = new ActionDiscoveryAssertions(testFixture);
await assertions.assertActionDiscovered('actor1', 'positioning:straddle_waist_facing', {
  withTargets: { primary: 'positioning:actors_sitting_close' }
});
```

**Step 3**: Use test builder (optional)
```javascript
// Optional: Migrate to fluent builder for even less boilerplate
await buildActionDiscoveryTest('positioning', 'straddle_waist_facing')
  .withEntities(room, chair, actor, target)
  .expectActionDiscovered('positioning:straddle_waist_facing')
  .expectScopeToResolve('positioning:actors_sitting_close', ['target1'])
  .run(testFixture);
```

### For New Features

**Always**:
1. Use `ModTestFixture` with `loadScopes: true`
2. Use `ActionDiscoveryAssertions` for discovery tests
3. Run `npm run validate:prerequisites` before committing
4. Use `--trace` flag during development debugging

**Never**:
1. Add custom scope resolvers (use real .scope files)
2. Add manual diagnostic logging (use tracer)
3. Skip prerequisite validation (catch issues early)

## Backward Compatibility

### Existing Tests
- All existing tests continue to work unchanged
- Custom scope resolvers still function (but deprecated)
- No breaking changes to ModTestFixture API
- Gradual migration path

### Existing Code
- Tracing is opt-in via options parameter
- No performance impact when tracing disabled
- Validation tools are separate CLI commands
- REPL is optional development tool

## Performance Considerations

### Tracing Overhead
- **Disabled**: Zero overhead (production default)
- **Enabled**: ~5-10% performance impact (development only)
- **Mitigation**: Structured output writes asynchronously

### Scope Loading
- **Impact**: +50-100ms per test file with scopes
- **Mitigation**: Cache parsed scopes in ModTestFixture
- **Benefit**: Catches runtime issues in tests

### Validation Tools
- **Prerequisite validator**: Runs offline, no runtime impact
- **Dependency analyzer**: CLI tool, run on demand
- **REPL**: Development only

## Documentation Requirements

### Developer Guide
- How to use ActionDiscoveryTracer
- How to interpret trace files
- How to use validation tools
- How to use test builders

### API Reference
- ActionDiscoveryTracer API
- PrerequisiteValidator API
- ActionDiscoveryAssertions API
- ActionDiscoveryTestBuilder API

### Troubleshooting Guide
- Common action discovery issues
- How to read trace files
- How to debug prerequisite failures
- How to analyze component dependencies

### Migration Guide
- Migrating from custom scope resolvers
- Migrating to assertion helpers
- Migrating to test builders
- Best practices

## Alternative Approaches Considered

### 1. Enhanced Console Logging
**Pros**: Quick to implement, no new dependencies
**Cons**: Still truncates, not parseable, not persistent
**Decision**: Rejected in favor of structured file output

### 2. Visual Debugging UI
**Pros**: Interactive, user-friendly
**Cons**: Significant development effort, not automatable
**Decision**: Deferred to future enhancement (REPL first)

### 3. Static Analysis Only
**Pros**: Catches issues at design time
**Cons**: Can't detect runtime-only issues
**Decision**: Complement with runtime tracing

### 4. Test Recording/Playback
**Pros**: Easy to reproduce issues
**Cons**: Large storage overhead, complex implementation
**Decision**: Not needed with structured tracing

## Appendix: Real-World Example

### Before Enhancement

**Problem**: Straddling actions not appearing

**Debugging Process**:
1. Day 1: Added logging to ActionIndex
2. Day 2: Added logging to prerequisite evaluation
3. Day 3: Added logging to scope resolution
4. Day 4: User insight revealed closeness locks movement
5. Day 5: Removed invalid prerequisite
6. Day 6: Removed all diagnostic logging

**Total Time**: 6 days
**Files Modified**: 5+ files
**Log Files Created**: 10+ manual saves

### After Enhancement

**Problem**: Straddling actions not appearing

**Debugging Process**:
1. Hour 1: Run `npm run debug:actions -- --actor Alice --trace`
2. Hour 2: Check `traces/action-discovery-Alice-*.json`
3. Hour 3: See prerequisite failure: `movement:actor-can-move` failed, movement locked by `positioning:closeness`
4. Hour 4: Run `npm run analyze:dependencies -- --component positioning:closeness`, see graph showing lock relationship
5. Hour 5: Remove invalid prerequisite
6. Done

**Total Time**: <1 day
**Files Modified**: 2 action definition files
**Log Files Created**: 1 structured trace (auto-saved)

**Improvement**: 85% reduction in debugging time

## Conclusion

This testing framework enhancement addresses all critical pain points identified during the straddling action debugging:

✅ **Browser Console Truncation** → Structured file output
✅ **Multi-Stage Pipeline Opacity** → Built-in tracing at each stage
✅ **Prerequisite Failures Hidden** → Detailed failure analysis
✅ **Scope Resolution Opaque** → Step-by-step scope tracing
✅ **Component Interdependencies Unknown** → Dependency analyzer
✅ **Manual Diagnostic Code** → Reusable tracing infrastructure
✅ **Log File Management** → Automatic structured output
✅ **No Action Discovery Tracing** → ActionDiscoveryTracer
✅ **No Design-Time Validation** → Prerequisite validator
✅ **Test/Runtime Divergence** → ModTestFixture scope loading

**Estimated Impact**:
- 85% reduction in debugging time for similar issues
- 100% prerequisite contradictions caught at design time
- Zero custom scope resolvers in tests
- Zero manual diagnostic logging
- Comprehensive developer tooling

**Next Steps**:
1. Review this specification with team
2. Prioritize phases based on team feedback
3. Create implementation tickets
4. Begin Phase 1 development
