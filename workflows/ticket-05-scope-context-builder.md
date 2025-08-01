# Ticket 05: ScopeContextBuilder Implementation

**Epic**: MultiTargetResolutionStage Decomposition  
**Phase**: 2 - Context & Display Services  
**Priority**: Medium  
**Estimated Time**: 5 hours  
**Dependencies**: Ticket 01 (Project Setup & Service Interfaces)  
**Assignee**: Developer

## 📋 Summary

Extract and implement the `ScopeContextBuilder` service from the existing `MultiTargetResolutionStage` class. This service handles building scope evaluation contexts for target resolution, including context-aware scope building, primary target specialization, and context validation.

## 🎯 Objectives

- Extract scope context building logic from `MultiTargetResolutionStage.js` lines 579-597 and 610-644
- Implement context-aware scope building with proper dependency handling
- Create primary target specialization for specific context scenarios
- Add context validation and completeness checking
- Integrate with existing TargetContextBuilder for compatibility

## 📝 Requirements Analysis

From the specification:

> "**ScopeContextBuilder**: Build scope evaluation contexts for target resolution."

**Extracted Code**:

- Lines 579-597: `#buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace)`
- Lines 610-644: `#buildScopeContextForSpecificPrimary(actor, actionContext, resolvedTargets, specificPrimary, targetDef, trace)`

Current implementation shows the service delegates to `this.#contextBuilder` (TargetContextBuilder) for base functionality and adds target-specific context enhancement.

## 🏗️ Implementation Tasks

### Task 5.1: Implement Core Service Class (2.5 hours)

**Objective**: Create the main ScopeContextBuilder service class

**File to Create**: `src/actions/pipeline/services/implementations/ScopeContextBuilder.js`

**Acceptance Criteria**:

- [ ] Implements IScopeContextBuilder interface
- [ ] Extracts exact logic from MultiTargetResolutionStage lines 579-597 and 610-644
- [ ] Integrates with existing TargetContextBuilder
- [ ] Handles both dependent and independent target contexts
- [ ] Provides context validation and completeness checking

**Implementation Details**:

```javascript
/**
 * @file ScopeContextBuilder - Service for building scope evaluation contexts
 */

import { BaseService } from '../base/BaseService.js';
import { ServiceError } from '../base/ServiceError.js';
import { validateDependency } from '../../../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../../interfaces/coreServices.js').IEntityManager} IEntityManager
 * @typedef {import('../../../scopeDsl/utils/targetContextBuilder.js').default} TargetContextBuilder
 * @typedef {import('../../tracing/traceContext.js').TraceContext} TraceContext
 */

/**
 * Service for building scope evaluation contexts for target resolution
 *
 * Provides:
 * - Context-aware scope building based on dependencies
 * - Primary target specialization for specific evaluation scenarios
 * - Context validation and completeness checking
 * - Integration with existing TargetContextBuilder
 */
export class ScopeContextBuilder extends BaseService {
  #contextBuilder;
  #entityManager;

  /**
   * @param {object} deps
   * @param {TargetContextBuilder} deps.targetContextBuilder
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ targetContextBuilder, entityManager, logger }) {
    super({ logger });

    validateDependency(targetContextBuilder, 'ITargetContextBuilder');
    validateDependency(entityManager, 'IEntityManager');

    this.#contextBuilder = targetContextBuilder;
    this.#entityManager = entityManager;

    this.logOperation('initialized', {
      service: 'ScopeContextBuilder',
      contextBuilder: targetContextBuilder.constructor.name,
      entityManager: entityManager.constructor.name,
    });
  }

  /**
   * Build scope context for target resolution
   *
   * Creates appropriate scope evaluation context based on whether the target
   * has dependencies on other targets or is independent.
   *
   * @param {Entity} actor - Acting entity
   * @param {object} actionContext - Action context with location and other data
   * @param {object} resolvedTargets - Previously resolved targets
   * @param {object} targetDef - Target definition with scope and dependencies
   * @param {TraceContext} trace - Tracing context for debugging
   * @returns {object} Scope evaluation context
   */
  buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace) {
    this.validateParams(
      {
        actor,
        actionContext,
        resolvedTargets,
        targetDef,
      },
      ['actor', 'actionContext', 'resolvedTargets', 'targetDef']
    );

    this.logOperation('buildScopeContext', {
      actorId: actor.id,
      targetDefScope: targetDef.scope,
      hasContextFrom: !!targetDef.contextFrom,
      resolvedTargetCount: Object.keys(resolvedTargets).length,
    });

    trace?.step(
      `Building scope context for '${targetDef.scope}'`,
      'ScopeContextBuilder'
    );

    try {
      // Start with base context using actor and location
      const baseContext = this.#buildBaseContext(actor, actionContext, trace);

      // Add resolved targets if this is a dependent target
      if (targetDef.contextFrom || Object.keys(resolvedTargets).length > 0) {
        this.logOperation(
          'buildScopeContext',
          {
            result: 'building_dependent_context',
            contextFrom: targetDef.contextFrom,
          },
          'debug'
        );

        return this.#buildDependentContext(
          baseContext,
          resolvedTargets,
          targetDef,
          trace
        );
      }

      this.logOperation(
        'buildScopeContext',
        {
          result: 'using_base_context',
        },
        'debug'
      );

      return baseContext;
    } catch (error) {
      this.logger.error('Failed to build scope context', {
        actorId: actor.id,
        targetDef,
        error: error.message,
      });

      throw new ServiceError(
        `Failed to build scope context for '${targetDef.scope}': ${error.message}`,
        'CONTEXT_BUILD_ERROR',
        {
          actorId: actor.id,
          targetDef,
          originalError: error,
        }
      );
    }
  }

  /**
   * Build context for specific primary target
   *
   * Creates enhanced context where a specific primary target entity
   * is available as 'target' for scope evaluation.
   *
   * @param {Entity} actor - Acting entity
   * @param {object} actionContext - Action context
   * @param {object} resolvedTargets - All resolved targets
   * @param {object} specificPrimary - Specific primary target to contextualize
   * @param {object} targetDef - Target definition
   * @param {TraceContext} trace - Tracing context
   * @returns {object} Enhanced context with primary target
   */
  buildContextForSpecificPrimary(
    actor,
    actionContext,
    resolvedTargets,
    specificPrimary,
    targetDef,
    trace
  ) {
    this.validateParams(
      {
        actor,
        actionContext,
        resolvedTargets,
        specificPrimary,
        targetDef,
      },
      [
        'actor',
        'actionContext',
        'resolvedTargets',
        'specificPrimary',
        'targetDef',
      ]
    );

    this.logOperation('buildContextForSpecificPrimary', {
      actorId: actor.id,
      specificPrimaryId: specificPrimary?.id,
      targetDefScope: targetDef.scope,
    });

    trace?.step(
      `Building context for specific primary '${specificPrimary?.id}'`,
      'ScopeContextBuilder'
    );

    try {
      // Start with base context
      const baseContext = this.#buildBaseContext(actor, actionContext, trace);

      // Build enhanced context with specific primary
      const context = { ...baseContext };

      // Add all resolved targets
      context.targets = { ...resolvedTargets };

      // Add the specific primary as the 'target' for scope evaluation
      if (specificPrimary) {
        const targetEntity = this.#buildTargetEntityContext(
          specificPrimary,
          trace
        );
        if (targetEntity) {
          context.target = targetEntity;
        }
      }

      this.logOperation('buildContextForSpecificPrimary', {
        result: 'success',
        hasTarget: !!context.target,
        targetCount: Object.keys(context.targets || {}).length,
      });

      return context;
    } catch (error) {
      this.logger.error('Failed to build context for specific primary', {
        actorId: actor.id,
        specificPrimaryId: specificPrimary?.id,
        error: error.message,
      });

      throw new ServiceError(
        `Failed to build context for specific primary '${specificPrimary?.id}': ${error.message}`,
        'SPECIFIC_PRIMARY_CONTEXT_ERROR',
        {
          actorId: actor.id,
          specificPrimaryId: specificPrimary?.id,
          originalError: error,
        }
      );
    }
  }

  /**
   * Validate context completeness
   *
   * Checks that the context has all required fields and proper structure
   * for scope evaluation.
   *
   * @param {object} context - Context to validate
   * @returns {object} Validation result with success flag and issues
   */
  validateContext(context) {
    const issues = [];
    const warnings = [];

    if (!context || typeof context !== 'object') {
      return {
        success: false,
        issues: ['Context must be a non-null object'],
        warnings: [],
      };
    }

    // Check required fields
    if (!context.actor) {
      issues.push('Context missing required actor field');
    } else if (!context.actor.id) {
      issues.push('Context actor missing id field');
    }

    if (!context.location) {
      warnings.push('Context missing location field');
    }

    // Validate targets structure if present
    if (context.targets && typeof context.targets !== 'object') {
      issues.push('Context targets must be an object');
    }

    // Validate target entity structure if present
    if (context.target) {
      if (!context.target.id) {
        issues.push('Context target missing id field');
      }
      if (!context.target.components) {
        warnings.push('Context target missing components field');
      }
    }

    const result = {
      success: issues.length === 0,
      issues,
      warnings,
    };

    this.logOperation(
      'validateContext',
      {
        success: result.success,
        issueCount: issues.length,
        warningCount: warnings.length,
      },
      'debug'
    );

    return result;
  }

  /**
   * Build base context using actor and location
   *
   * @param {Entity} actor - Acting entity
   * @param {object} actionContext - Action context
   * @param {TraceContext} trace - Tracing context
   * @returns {object} Base context
   * @private
   */
  #buildBaseContext(actor, actionContext, trace) {
    const locationId =
      actionContext.location?.id ||
      actor.getComponentData('core:position')?.locationId;

    this.logOperation(
      'buildBaseContext',
      {
        actorId: actor.id,
        locationId,
      },
      'debug'
    );

    return this.#contextBuilder.buildBaseContext(actor.id, locationId);
  }

  /**
   * Build dependent context with resolved targets
   *
   * @param {object} baseContext - Base context to enhance
   * @param {object} resolvedTargets - Previously resolved targets
   * @param {object} targetDef - Target definition
   * @param {TraceContext} trace - Tracing context
   * @returns {object} Enhanced context with dependencies
   * @private
   */
  #buildDependentContext(baseContext, resolvedTargets, targetDef, trace) {
    this.logOperation(
      'buildDependentContext',
      {
        contextFrom: targetDef.contextFrom,
        resolvedTargetKeys: Object.keys(resolvedTargets),
      },
      'debug'
    );

    return this.#contextBuilder.buildDependentContext(
      baseContext,
      resolvedTargets,
      targetDef
    );
  }

  /**
   * Build target entity context for specific primary
   *
   * @param {object} specificPrimary - Primary target to build context for
   * @param {TraceContext} trace - Tracing context
   * @returns {object|null} Target entity context or null if entity not found
   * @private
   */
  #buildTargetEntityContext(specificPrimary, trace) {
    if (!specificPrimary?.id) {
      return null;
    }

    try {
      const entity = this.#entityManager.getEntityInstance(specificPrimary.id);
      if (!entity) {
        this.logOperation(
          'buildTargetEntityContext',
          {
            specificPrimaryId: specificPrimary.id,
            result: 'entity_not_found',
          },
          'warn'
        );
        return null;
      }

      const context = {
        id: entity.id,
        components: entity.getAllComponents ? entity.getAllComponents() : {},
      };

      this.logOperation(
        'buildTargetEntityContext',
        {
          specificPrimaryId: specificPrimary.id,
          result: 'success',
          componentCount: Object.keys(context.components).length,
        },
        'debug'
      );

      return context;
    } catch (error) {
      this.logger.warn('Failed to build target entity context', {
        specificPrimaryId: specificPrimary.id,
        error: error.message,
      });
      return null;
    }
  }
}
```

### Task 5.2: Create Comprehensive Tests (1.5 hours)

**Objective**: Implement unit tests for ScopeContextBuilder

**File to Create**: `tests/unit/actions/pipeline/services/implementations/ScopeContextBuilder.test.js`

**Acceptance Criteria**:

- [ ] Test basic context building scenarios
- [ ] Test dependent context creation with resolved targets
- [ ] Test specific primary context enhancement
- [ ] Test context validation functionality
- [ ] Test error scenarios and edge cases
- [ ] Achieve ≥95% code coverage

### Task 5.3: Integration with DI Container (0.5 hours)

**Objective**: Configure the service in dependency injection container

**File to Modify**: `src/dependencyInjection/containerConfig.js`

**Acceptance Criteria**:

- [ ] Replace placeholder with actual implementation
- [ ] Configure dependencies (targetContextBuilder, entityManager, logger)
- [ ] Test service resolution through DI container

### Task 5.4: Integration Testing (0.5 hours)

**Objective**: Create integration tests with TargetContextBuilder

**File to Create**: `tests/integration/actions/pipeline/services/ScopeContextBuilder.integration.test.js`

**Acceptance Criteria**:

- [ ] Test integration with existing TargetContextBuilder
- [ ] Test context building with real entity data
- [ ] Test error propagation and handling
- [ ] Verify context structure matches expectations

## 📊 Success Criteria

### Functional Requirements:

- [ ] Exact logic extracted from MultiTargetResolutionStage lines 579-597 and 610-644
- [ ] Context building works for both dependent and independent targets
- [ ] Specific primary context enhancement functions correctly
- [ ] Context validation catches all structural issues
- [ ] Integration with TargetContextBuilder seamless

### Quality Requirements:

- [ ] Code coverage ≥95% for all methods
- [ ] All context building scenarios tested
- [ ] Error handling preserves existing behavior
- [ ] Performance matches current implementation
- [ ] Integration tests verify proper operation

## 🔄 Dependencies

### Prerequisites:

- Ticket 01: Project Setup & Service Interfaces (completed)

### Blocks:

- Ticket 07: Service Integration Testing (needs this service)
- Ticket 09: MultiTargetResolutionStage Refactoring (needs this service)

---

**Created**: 2025-01-08  
**Status**: Ready for Implementation
