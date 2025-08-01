# Ticket 09: MultiTargetResolutionStage Refactoring

**Epic**: MultiTargetResolutionStage Decomposition  
**Phase**: 3 - Main Stage Refactoring  
**Priority**: Medium  
**Estimated Time**: 6 hours  
**Dependencies**: Tickets 01-08 (All services and DI configuration complete)  
**Assignee**: Senior Developer

## 📋 Summary

Refactor the main `MultiTargetResolutionStage` class to use the newly created specialized services. Transform the 734-line monolith into a lightweight orchestrator that delegates complex logic to appropriate services while maintaining complete backward compatibility.

## 🎯 Objectives

- Transform MultiTargetResolutionStage into lightweight orchestrator
- Replace direct implementation with service delegation
- Maintain all existing API contracts and behavior
- Ensure complete backward compatibility
- Reduce class complexity by ~70% as specified

## 📝 Requirements Analysis

From the specification:

> "The refactored `MultiTargetResolutionStage` becomes a lightweight orchestrator" using the 4 specialized services.

Target architecture shows the main stage delegating to:

- **TargetDependencyResolver** for dependency ordering
- **LegacyTargetCompatibilityLayer** for legacy actions
- **ScopeContextBuilder** for context building
- **TargetDisplayNameResolver** for display names

## 🏗️ Implementation Tasks

### Task 9.1: Refactor Main Stage Class (3 hours)

**Objective**: Transform the main class into service orchestrator

**File to Modify**: `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

**Acceptance Criteria**:

- [ ] Replace private methods with service calls
- [ ] Maintain existing constructor interface
- [ ] Preserve all public method signatures
- [ ] Keep existing error handling patterns
- [ ] Maintain trace logging integration

**Implementation Strategy**:

```javascript
/**
 * @file MultiTargetResolutionStage - Lightweight orchestrator for target resolution
 */

// Service imports
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Pipeline stage that orchestrates target resolution using specialized services
 * Refactored from 734-line monolith to lightweight orchestrator
 */
export class MultiTargetResolutionStage extends PipelineStage {
  #dependencyResolver;
  #legacyLayer;
  #contextBuilder;
  #nameResolver;
  #unifiedScopeResolver;
  #logger;

  /**
   * @param {object} deps - Service dependencies
   */
  constructor({
    targetDependencyResolver,
    legacyTargetCompatibilityLayer,
    scopeContextBuilder,
    targetDisplayNameResolver,
    unifiedScopeResolver,
    logger,
  }) {
    super('MultiTargetResolution');

    // Validate all service dependencies
    validateDependency(targetDependencyResolver, 'ITargetDependencyResolver');
    validateDependency(
      legacyTargetCompatibilityLayer,
      'ILegacyTargetCompatibilityLayer'
    );
    validateDependency(scopeContextBuilder, 'IScopeContextBuilder');
    validateDependency(targetDisplayNameResolver, 'ITargetDisplayNameResolver');
    validateDependency(unifiedScopeResolver, 'IUnifiedScopeResolver');
    validateDependency(logger, 'ILogger');

    // Store service references
    this.#dependencyResolver = targetDependencyResolver;
    this.#legacyLayer = legacyTargetCompatibilityLayer;
    this.#contextBuilder = scopeContextBuilder;
    this.#nameResolver = targetDisplayNameResolver;
    this.#unifiedScopeResolver = unifiedScopeResolver;
    this.#logger = logger;
  }

  /**
   * Execute target resolution using service orchestration
   * Maintains exact same interface and behavior as original
   */
  async executeInternal(context) {
    const { candidateActions = [], actor, actionContext, trace } = context;

    trace?.step(
      `Resolving targets for ${candidateActions.length} candidate actions`,
      'MultiTargetResolutionStage'
    );

    const allActionsWithTargets = [];
    const errors = [];
    let lastResolvedTargets = null;
    let lastTargetDefinitions = null;
    let allTargetContexts = [];

    // Process each candidate action using appropriate service
    for (const actionDef of candidateActions) {
      try {
        const actionProcessContext = { ...context, actionDef };
        let result;

        // Delegate to appropriate service based on action type
        if (this.#legacyLayer.isLegacyAction(actionDef)) {
          result = await this.#legacyLayer.resolveLegacyTarget(
            actionProcessContext,
            trace
          );
        } else {
          result = await this.#resolveMultiTargets(actionProcessContext, trace);
        }

        // Process successful results (maintain existing logic)
        if (result.success && result.data.actionsWithTargets) {
          // ... existing result processing logic
        }
      } catch (error) {
        // Maintain existing error handling
        this.#logger.error(
          `Error resolving targets for action '${actionDef.id}':`,
          error
        );
        errors.push(this.#buildErrorContext(error, actionDef));
      }
    }

    // Return result in same format as original
    return PipelineResult.success({
      data: {
        ...context.data,
        actionsWithTargets: allActionsWithTargets,
        // ... maintain backward compatibility fields
      },
      errors,
    });
  }

  /**
   * Resolve multi-target actions using service orchestration
   * Replaces the original 200+ line method with service delegation
   */
  async #resolveMultiTargets(context, trace) {
    const { actionDef, actor, actionContext } = context;
    const targetDefs = actionDef.targets;

    // Use dependency resolver service instead of inline logic
    const resolutionOrder =
      this.#dependencyResolver.getResolutionOrder(targetDefs);

    const resolvedTargets = {};
    const allTargetContexts = [];

    // Resolve each target using services
    for (const targetKey of resolutionOrder) {
      const targetDef = targetDefs[targetKey];

      // Use context builder service instead of inline logic
      const scopeContext = this.#contextBuilder.buildScopeContext(
        actor,
        actionContext,
        resolvedTargets,
        targetDef,
        trace
      );

      // Resolve targets using unified scope resolver
      const targetResults = await this.#unifiedScopeResolver.resolveScope(
        targetDef.scope,
        scopeContext,
        trace
      );

      // Process results and build contexts
      // ... rest of resolution logic using services
    }

    return PipelineResult.success({
      data: {
        ...context.data,
        actionsWithTargets: [
          /* processed results */
        ],
        resolvedTargets,
        targetDefinitions: targetDefs,
      },
    });
  }
}
```

### Task 9.2: Update Constructor Dependencies (1 hour)

**Objective**: Update DI container registration for new dependencies

**File to Modify**: `src/dependencyInjection/containerConfig.js`

**Requirements**:

- [ ] Update MultiTargetResolutionStage registration with all service dependencies
- [ ] Ensure proper dependency ordering
- [ ] Maintain backward compatibility for existing registrations

### Task 9.3: Comprehensive Refactoring Testing (2 hours)

**Objective**: Ensure refactored stage maintains identical behavior

**Files to Create/Modify**:

- `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.refactored.test.js`
- Update existing integration tests

**Test Categories**:

- [ ] **Behavioral Equivalence**: Identical outputs for all inputs
- [ ] **API Compatibility**: All existing interfaces preserved
- [ ] **Error Handling**: Same error types and messages
- [ ] **Performance**: No significant regression
- [ ] **Integration**: Works with existing pipeline

## 📊 Success Criteria

### Functional Requirements:

- [ ] All existing functionality preserved
- [ ] Same outputs for identical inputs
- [ ] Error handling behavior unchanged
- [ ] API contracts maintained
- [ ] Integration tests pass without modification

### Quality Requirements:

- [ ] Class reduced from 734 lines to <200 lines (~70% reduction)
- [ ] Complexity significantly reduced
- [ ] Service delegation working correctly
- [ ] Code coverage maintained
- [ ] Performance within 5% of original

### Compatibility Requirements:

- [ ] No breaking changes to public API
- [ ] Existing tests pass without modification
- [ ] Pipeline integration unchanged
- [ ] Error messages consistent

## 🚨 Risk Assessment

### High Risk:

- **Behavioral Changes**: Any deviation from original behavior could break existing functionality
- **Mitigation**: Comprehensive behavioral equivalence testing with identical input/output validation

### Medium Risk:

- **Performance Regression**: Service calls might introduce overhead
- **Mitigation**: Performance benchmarks and optimization if needed

### Low Risk:

- **DI Configuration**: Container setup might have issues
- **Mitigation**: Thorough container testing and validation

## 📋 Definition of Done

- [ ] MultiTargetResolutionStage refactored to use all 4 services
- [ ] Class size reduced by ~70% (to <200 lines)
- [ ] All existing functionality preserved exactly
- [ ] All existing tests pass without modification
- [ ] New tests verify service integration
- [ ] Performance regression <5%
- [ ] Error handling behavior identical
- [ ] Code review approved by senior developer

---

**Created**: 2025-01-08  
**Status**: Ready for Implementation
