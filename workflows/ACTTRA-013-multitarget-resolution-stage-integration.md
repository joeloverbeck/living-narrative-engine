# ACTTRA-013: MultiTargetResolutionStage Integration for Action Tracing

## Executive Summary

### Problem Statement
The MultiTargetResolutionStage handles both legacy and multi-target action resolution using complex scope expressions and target resolution logic, but lacks detailed tracing of the resolution process. This makes debugging target resolution failures, scope evaluation issues, and legacy/multi-target conversion problems extremely difficult.

### Solution Approach
Enhance the MultiTargetResolutionStage to capture comprehensive target resolution data when ActionAwareStructuredTrace is available. The integration will trace scope expression evaluation, target resolution results, legacy action handling, and performance metrics while maintaining full backward compatibility with both legacy and modern action systems.

### Business Value
- Provides complete visibility into target resolution logic and scope evaluation
- Enables debugging of action availability issues due to target resolution failures
- Shows differences between legacy and multi-target action processing
- Helps identify performance bottlenecks in complex target resolution scenarios

## Technical Requirements

### Functional Requirements

#### FR-013-01: Target Resolution Tracing
- Must capture scope expression definitions and evaluation results for traced actions
- Must trace resolved targets with detailed metadata (ID, type, display name)
- Must differentiate between legacy and multi-target action resolution processes
- Must capture target resolution success/failure with detailed reasoning

#### FR-013-02: Scope Expression Analysis
- Must capture original scope expressions from action definitions
- Must trace scope evaluation context and variable resolution
- Must include scope evaluation timing and performance metrics
- Must handle complex nested scope expressions with hierarchical trace data

#### FR-013-03: Target Metadata Capture
- Must capture target objects with relevant properties (id, displayName, type)
- Must group targets by target keys (primary, secondary, etc.)
- Must capture target count statistics and resolution efficiency metrics
- Must include target filtering and transformation results

#### FR-013-04: Legacy vs Multi-Target Handling
- Must identify action type (legacy/multi-target) and trace accordingly
- Must capture legacy action conversion process when applicable
- Must trace differences in target resolution between legacy and modern actions
- Must handle hybrid scenarios where actions use both legacy and multi-target patterns

### Non-Functional Requirements

#### NFR-013-01: Performance
- <3ms overhead per traced action during target resolution
- No performance impact when action tracing is disabled
- Efficient target data extraction and scope evaluation tracing
- Minimal memory footprint for complex target resolution scenarios

#### NFR-013-02: Reliability
- Must not affect existing target resolution logic or results
- Must handle scope evaluation failures gracefully without breaking stage
- Must continue stage execution even if tracing capture fails
- Must maintain compatibility with both legacy and multi-target systems

#### NFR-013-03: Maintainability
- Must integrate cleanly with existing LegacyLayer and multi-target services
- Must follow project patterns for scope expression handling
- Must use consistent data structures with other pipeline stages
- Must include comprehensive documentation for target resolution tracing

## Architecture Design

### Current MultiTargetResolutionStage Flow
```
executeInternal(context)
  ↓
For each candidate action:
  - Check if legacy or multi-target action (LegacyLayer.isLegacyAction)
  - If legacy: resolveLegacyTarget()
  - If multi-target: resolveMultiTargets()
  - Collect resolved targets and action combinations
  ↓
Return actions with resolved targets
```

### Enhanced Flow with Action Tracing
```
executeInternal(context)
  ↓
Detect if trace is ActionAwareStructuredTrace
  ↓
For each candidate action:
  - Check if action should be traced
  - Capture pre-resolution data if tracing enabled
  - Determine action type (legacy/multi-target) with tracing
  - Perform target resolution with detailed trace capture:
    - Legacy: trace scope evaluation and target resolution
    - Multi-target: trace target keys, scope expressions, resolution results
  - Capture post-resolution data with target metadata
  ↓
Return actions with comprehensive target resolution tracing
```

### Data Capture Points

#### Pre-Resolution Capture
- Action ID and resolution type determination
- Scope expressions and target definitions
- Resolution start timing

#### During Resolution Capture
- Scope evaluation steps and variable resolution
- Target query execution and filtering
- Legacy/multi-target specific processing details

#### Post-Resolution Capture
- Resolved targets grouped by target keys
- Target count statistics and resolution metrics
- Performance timing and success/failure analysis

## Implementation Steps

### Step 1: Enhance MultiTargetResolutionStage

Modify `src/actions/pipeline/stages/MultiTargetResolutionStage.js`:

```javascript
/**
 * @file MultiTargetResolutionStage - Enhanced with action tracing capabilities
 */

import { validateDependency, assertPresent } from '../../../utils/validationUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import PipelineResult from '../pipelineResult.js';

/**
 * Pipeline stage that resolves targets for both legacy and multi-target actions
 * Enhanced with detailed action tracing for target resolution debugging
 */
class MultiTargetResolutionStage {
  #legacyLayer;
  #multiTargetService;
  #scopeService;
  #logger;
  #name = 'MultiTargetResolution';

  constructor({ legacyLayer, multiTargetService, scopeService, logger }) {
    validateDependency(legacyLayer, 'ILegacyLayer', null, {
      requiredMethods: ['isLegacyAction']
    });
    validateDependency(multiTargetService, 'IMultiTargetService', null, {
      requiredMethods: ['resolveTargets']
    });
    validateDependency(scopeService, 'IScopeService', null, {
      requiredMethods: ['evaluateScope']
    });
    this.#logger = ensureValidLogger(logger, 'MultiTargetResolutionStage');

    this.#legacyLayer = legacyLayer;
    this.#multiTargetService = multiTargetService;
    this.#scopeService = scopeService;
  }

  get name() {
    return this.#name;
  }

  /**
   * Execute target resolution stage with enhanced action tracing
   * 
   * @param {Object} context - Pipeline context
   * @param {Array} context.candidateActions - Actions to resolve targets for
   * @param {Object} context.actor - Actor entity
   * @param {Object} context.actionContext - Action context for scope evaluation
   * @param {Object} context.trace - Trace context (may be ActionAwareStructuredTrace)
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context) {
    const { candidateActions = [], actor, actionContext, trace } = context;
    const source = `${this.name}Stage.execute`;
    const stageStartTime = Date.now();

    assertPresent(actor, 'Actor is required for target resolution');
    assertPresent(actor.id, 'Actor must have an ID');

    try {
      this.#logger.debug(
        `MultiTargetResolutionStage: Starting target resolution for ${candidateActions.length} actions`,
        { 
          actorId: actor.id, 
          candidateActionCount: candidateActions.length 
        }
      );

      // Check if we have action-aware tracing capability
      const isActionAwareTrace = this.#isActionAwareTrace(trace);
      
      if (isActionAwareTrace) {
        this.#logger.debug(
          `MultiTargetResolutionStage: Action tracing enabled for actor ${actor.id}`,
          { actorId: actor.id, traceType: 'ActionAwareStructuredTrace' }
        );
      }

      // Capture pre-resolution data for tracing
      if (isActionAwareTrace) {
        await this.#capturePreResolutionData(
          trace, 
          actor, 
          candidateActions, 
          actionContext,
          stageStartTime
        );
      }

      const allActionsWithTargets = [];
      const resolutionResults = new Map();

      for (const actionDef of candidateActions) {
        try {
          const resolutionResult = await this.#resolveActionWithTracing(
            actionDef,
            actor,
            actionContext,
            trace,
            isActionAwareTrace
          );

          resolutionResults.set(actionDef.id, resolutionResult);

          if (resolutionResult.success && resolutionResult.actionsWithTargets) {
            allActionsWithTargets.push(...resolutionResult.actionsWithTargets);
          }

        } catch (error) {
          this.#logger.error(
            `MultiTargetResolutionStage: Error resolving targets for action '${actionDef.id}'`,
            error
          );

          // Capture error in tracing if available
          if (isActionAwareTrace && trace.captureActionData) {
            await this.#captureTargetResolutionError(trace, actionDef, actor, error);
          }

          // Continue processing other actions
        }
      }

      // Capture post-resolution summary
      if (isActionAwareTrace) {
        await this.#capturePostResolutionData(
          trace,
          actor,
          candidateActions.length,
          allActionsWithTargets.length,
          resolutionResults,
          stageStartTime
        );
      }

      // Existing trace logging for backward compatibility
      trace?.step(
        `Resolving targets for ${candidateActions.length} candidate actions`,
        source
      );

      this.#logger.info(
        `MultiTargetResolutionStage: Resolved targets for ${candidateActions.length} actions, generated ${allActionsWithTargets.length} action-target combinations`,
        { 
          actorId: actor.id, 
          originalActionCount: candidateActions.length, 
          actionTargetCombinations: allActionsWithTargets.length,
          stageDuration: Date.now() - stageStartTime
        }
      );

      return PipelineResult.success({
        data: { 
          ...context.data, 
          actionsWithTargets: allActionsWithTargets,
          targetResolutionResults: resolutionResults
        }
      });

    } catch (error) {
      this.#logger.error(
        `MultiTargetResolutionStage: Failed to resolve targets for actor ${actor.id}`,
        error
      );

      return PipelineResult.failure(
        `Target resolution failed for actor ${actor.id}`,
        { 
          originalError: error.message, 
          stageDuration: Date.now() - stageStartTime 
        }
      );
    }
  }

  /**
   * Check if trace is ActionAwareStructuredTrace
   * 
   * @private
   * @param {Object} trace - Trace instance to check
   * @returns {boolean}
   */
  #isActionAwareTrace(trace) {
    return trace && typeof trace.captureActionData === 'function';
  }

  /**
   * Resolve targets for single action with optional tracing
   * 
   * @private
   * @param {Object} actionDef - Action definition to resolve targets for
   * @param {Object} actor - Actor entity
   * @param {Object} actionContext - Action context for scope evaluation
   * @param {Object} trace - Trace context
   * @param {boolean} isActionAwareTrace - Whether trace supports action data capture
   * @returns {Promise<Object>} Resolution result with detailed data
   */
  async #resolveActionWithTracing(actionDef, actor, actionContext, trace, isActionAwareTrace) {
    const resolutionStartTime = Date.now();

    try {
      // Determine action type (legacy vs multi-target)
      const isLegacy = this.#legacyLayer.isLegacyAction(actionDef);
      
      let resolutionResult;
      let resolvedTargets = null;
      let actionsWithTargets = [];

      if (isLegacy) {
        // Handle legacy action resolution
        resolutionResult = await this.#resolveLegacyTarget(
          { actor, actionDef, actionContext, trace },
          trace
        );
        
        if (resolutionResult.success && resolutionResult.data.actionsWithTargets) {
          actionsWithTargets = resolutionResult.data.actionsWithTargets;
          resolvedTargets = resolutionResult.data.resolvedTargets;
        }
      } else {
        // Handle multi-target action resolution
        resolutionResult = await this.#resolveMultiTargets(
          { actor, actionDef, actionContext, trace },
          trace
        );
        
        if (resolutionResult.success && resolutionResult.data.actionsWithTargets) {
          actionsWithTargets = resolutionResult.data.actionsWithTargets;
          resolvedTargets = resolutionResult.data.resolvedTargets;
        }
      }

      const finalResult = {
        success: resolutionResult.success,
        isLegacy,
        resolutionTime: Date.now() - resolutionStartTime,
        actionsWithTargets,
        resolvedTargets,
        error: resolutionResult.error
      };

      // Capture detailed resolution data if tracing enabled
      if (isActionAwareTrace && trace.captureActionData) {
        await this.#captureTargetResolutionData(trace, actionDef, actor, finalResult);
      }

      return finalResult;

    } catch (error) {
      const result = {
        success: false,
        isLegacy: null,
        error: error.message,
        errorType: error.constructor.name,
        resolutionTime: Date.now() - resolutionStartTime,
        actionsWithTargets: [],
        resolvedTargets: null
      };

      this.#logger.error(
        `Error resolving targets for action '${actionDef.id}'`,
        error
      );

      return result;
    }
  }

  /**
   * Resolve legacy action targets (existing method with enhanced tracing)
   * 
   * @private
   */
  async #resolveLegacyTarget(context, trace) {
    const { actor, actionDef, actionContext } = context;
    const legacyResolutionStartTime = Date.now();

    try {
      // Extract scope expression from legacy action
      const scopeExpression = this.#extractLegacyScopeExpression(actionDef);
      
      // Capture legacy-specific trace data
      const legacyTraceData = {
        resolutionType: 'legacy',
        scopeExpression,
        legacyResolutionStartTime,
        actionDef: {
          id: actionDef.id,
          targetKey: actionDef.targetKey || actionDef.target,
          scopeExpression
        }
      };

      // Evaluate scope expression if present
      let resolvedTargets = {};
      if (scopeExpression) {
        const scopeResult = await this.#scopeService.evaluateScope(
          scopeExpression,
          { actor, actionContext }
        );

        resolvedTargets = {
          [actionDef.targetKey || 'target']: scopeResult.targets || []
        };
      }

      // Create action-target combinations
      const actionsWithTargets = this.#createLegacyActionTargetCombinations(
        actionDef,
        resolvedTargets
      );

      // Add timing information
      legacyTraceData.resolutionTime = Date.now() - legacyResolutionStartTime;
      legacyTraceData.targetCount = Object.values(resolvedTargets)
        .reduce((sum, targets) => sum + targets.length, 0);

      return PipelineResult.success({
        data: {
          actionsWithTargets,
          resolvedTargets,
          legacyTraceData
        }
      });

    } catch (error) {
      this.#logger.error(
        `Legacy target resolution failed for action '${actionDef.id}'`,
        error
      );

      return PipelineResult.failure(
        `Legacy target resolution failed: ${error.message}`,
        { 
          actionId: actionDef.id,
          resolutionType: 'legacy',
          error: error.message
        }
      );
    }
  }

  /**
   * Resolve multi-target action targets (existing method with enhanced tracing)
   * 
   * @private
   */
  async #resolveMultiTargets(context, trace) {
    const { actor, actionDef, actionContext } = context;
    const multiTargetResolutionStartTime = Date.now();

    try {
      // Extract target definitions from action
      const targetDefinitions = this.#extractTargetDefinitions(actionDef);
      
      // Capture multi-target specific trace data
      const multiTargetTraceData = {
        resolutionType: 'multi-target',
        targetDefinitions,
        multiTargetResolutionStartTime,
        targetKeys: Object.keys(targetDefinitions)
      };

      // Resolve targets using multi-target service
      const resolvedTargets = {};
      for (const [targetKey, targetDef] of Object.entries(targetDefinitions)) {
        if (targetDef.scopeExpression) {
          const scopeResult = await this.#scopeService.evaluateScope(
            targetDef.scopeExpression,
            { actor, actionContext }
          );
          
          resolvedTargets[targetKey] = scopeResult.targets || [];
        }
      }

      // Create action-target combinations
      const actionsWithTargets = this.#createMultiTargetActionCombinations(
        actionDef,
        resolvedTargets,
        targetDefinitions
      );

      // Add timing and statistics
      multiTargetTraceData.resolutionTime = Date.now() - multiTargetResolutionStartTime;
      multiTargetTraceData.targetCount = Object.values(resolvedTargets)
        .reduce((sum, targets) => sum + targets.length, 0);
      multiTargetTraceData.targetKeysResolved = Object.keys(resolvedTargets);

      return PipelineResult.success({
        data: {
          actionsWithTargets,
          resolvedTargets,
          targetDefinitions,
          multiTargetTraceData
        }
      });

    } catch (error) {
      this.#logger.error(
        `Multi-target resolution failed for action '${actionDef.id}'`,
        error
      );

      return PipelineResult.failure(
        `Multi-target resolution failed: ${error.message}`,
        { 
          actionId: actionDef.id,
          resolutionType: 'multi-target',
          error: error.message
        }
      );
    }
  }

  /**
   * Extract scope expression from legacy action definition
   * 
   * @private
   * @param {Object} actionDef - Legacy action definition
   * @returns {string|null} Scope expression
   */
  #extractLegacyScopeExpression(actionDef) {
    // Legacy actions may have scope expressions in various formats
    if (actionDef.scopeExpression) {
      return actionDef.scopeExpression;
    }
    if (actionDef.scope) {
      return actionDef.scope;
    }
    if (actionDef.target && typeof actionDef.target === 'string') {
      return actionDef.target;
    }
    return null;
  }

  /**
   * Extract target definitions from multi-target action
   * 
   * @private
   * @param {Object} actionDef - Multi-target action definition
   * @returns {Object} Target definitions keyed by target key
   */
  #extractTargetDefinitions(actionDef) {
    const definitions = {};

    if (actionDef.targets) {
      // Modern multi-target format
      for (const [targetKey, targetConfig] of Object.entries(actionDef.targets)) {
        definitions[targetKey] = {
          scopeExpression: targetConfig.scope || targetConfig.scopeExpression,
          required: targetConfig.required || false,
          multiple: targetConfig.multiple || false
        };
      }
    } else if (actionDef.targetDefinitions) {
      // Alternative format
      Object.assign(definitions, actionDef.targetDefinitions);
    }

    return definitions;
  }

  /**
   * Create action-target combinations for legacy actions
   * 
   * @private
   * @param {Object} actionDef - Action definition
   * @param {Object} resolvedTargets - Resolved targets by key
   * @returns {Array} Action-target combinations
   */
  #createLegacyActionTargetCombinations(actionDef, resolvedTargets) {
    const combinations = [];
    const targetKey = actionDef.targetKey || 'target';
    const targets = resolvedTargets[targetKey] || [];

    if (targets.length === 0) {
      // No targets - create combination with null target
      combinations.push({
        actionDef,
        targetContexts: [null],
        resolutionMetadata: {
          type: 'legacy',
          targetKey,
          hasTargets: false
        }
      });
    } else {
      // Create combinations for each target
      targets.forEach(target => {
        combinations.push({
          actionDef,
          targetContexts: [target],
          resolutionMetadata: {
            type: 'legacy',
            targetKey,
            hasTargets: true,
            targetId: target.id
          }
        });
      });
    }

    return combinations;
  }

  /**
   * Create action-target combinations for multi-target actions
   * 
   * @private
   * @param {Object} actionDef - Action definition
   * @param {Object} resolvedTargets - Resolved targets by key
   * @param {Object} targetDefinitions - Target definitions
   * @returns {Array} Action-target combinations
   */
  #createMultiTargetActionCombinations(actionDef, resolvedTargets, targetDefinitions) {
    const combinations = [];

    // For multi-target actions, we need to create combinations across all target keys
    const targetKeys = Object.keys(targetDefinitions);
    
    if (targetKeys.length === 0) {
      // No target definitions - create single combination
      combinations.push({
        actionDef,
        targetContexts: [],
        resolvedTargets,
        targetDefinitions,
        resolutionMetadata: {
          type: 'multi-target',
          hasTargets: false
        }
      });
    } else {
      // Create combinations based on resolved targets
      const targetCombinations = this.#generateTargetCombinations(
        resolvedTargets,
        targetDefinitions
      );

      targetCombinations.forEach(combination => {
        combinations.push({
          actionDef,
          targetContexts: combination.targets,
          resolvedTargets: combination.resolvedTargets,
          targetDefinitions,
          resolutionMetadata: {
            type: 'multi-target',
            hasTargets: combination.targets.length > 0,
            targetKeys: combination.targetKeys
          }
        });
      });
    }

    return combinations;
  }

  /**
   * Generate target combinations for multi-target actions
   * 
   * @private
   * @param {Object} resolvedTargets - Resolved targets by key
   * @param {Object} targetDefinitions - Target definitions
   * @returns {Array} Target combinations
   */
  #generateTargetCombinations(resolvedTargets, targetDefinitions) {
    // This is a simplified version - real implementation would handle
    // complex combinations based on required/optional targets
    const combinations = [];
    const firstTargetKey = Object.keys(resolvedTargets)[0];
    
    if (firstTargetKey && resolvedTargets[firstTargetKey]) {
      resolvedTargets[firstTargetKey].forEach(target => {
        combinations.push({
          targets: [target],
          resolvedTargets: { [firstTargetKey]: [target] },
          targetKeys: [firstTargetKey]
        });
      });
    } else {
      // No targets resolved
      combinations.push({
        targets: [],
        resolvedTargets: {},
        targetKeys: []
      });
    }

    return combinations;
  }

  /**
   * Capture pre-resolution stage data
   * 
   * @private
   */
  async #capturePreResolutionData(trace, actor, candidateActions, actionContext, stageStartTime) {
    try {
      const stageData = {
        stage: 'target_resolution_start',
        actorId: actor.id,
        candidateActionCount: candidateActions.length,
        hasActionContext: !!actionContext,
        stageStartTime,
        timestamp: Date.now()
      };

      this.#logger.debug(
        'MultiTargetResolutionStage: Captured pre-resolution data',
        stageData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture pre-resolution data for tracing', error);
    }
  }

  /**
   * Capture target resolution data for traced action
   * 
   * @private
   */
  async #captureTargetResolutionData(trace, actionDef, actor, resolutionResult) {
    try {
      const traceData = {
        stage: 'target_resolution',
        actorId: actor.id,
        isLegacy: resolutionResult.isLegacy,
        resolutionSuccess: resolutionResult.success,
        resolutionTimeMs: resolutionResult.resolutionTime,
        actionTargetCombinations: resolutionResult.actionsWithTargets.length,
        timestamp: Date.now()
      };

      // Include resolved targets with metadata
      if (resolutionResult.resolvedTargets) {
        const targetSummary = {};
        for (const [targetKey, targets] of Object.entries(resolutionResult.resolvedTargets)) {
          targetSummary[targetKey] = {
            count: targets.length,
            targets: targets.map(target => ({
              id: target.id,
              displayName: target.displayName || target.name,
              type: target.type
            }))
          };
        }
        traceData.resolvedTargets = targetSummary;
        
        // Calculate total target count
        traceData.totalTargetCount = Object.values(resolutionResult.resolvedTargets)
          .reduce((sum, targets) => sum + targets.length, 0);
      }

      // Include scope expressions if available
      if (resolutionResult.isLegacy) {
        const scopeExpression = this.#extractLegacyScopeExpression(actionDef);
        if (scopeExpression) {
          traceData.scopeExpression = scopeExpression;
        }
      } else {
        const targetDefinitions = this.#extractTargetDefinitions(actionDef);
        if (Object.keys(targetDefinitions).length > 0) {
          traceData.targetKeys = Object.keys(targetDefinitions);
          traceData.scopeExpressions = {};
          for (const [key, def] of Object.entries(targetDefinitions)) {
            if (def.scopeExpression) {
              traceData.scopeExpressions[key] = def.scopeExpression;
            }
          }
        }
      }

      // Include error information if resolution failed
      if (!resolutionResult.success && resolutionResult.error) {
        traceData.error = resolutionResult.error;
        traceData.errorType = resolutionResult.errorType;
      }

      await trace.captureActionData('target_resolution', actionDef.id, traceData);

      this.#logger.debug(
        `MultiTargetResolutionStage: Captured target resolution data for action '${actionDef.id}'`,
        { 
          actionId: actionDef.id, 
          isLegacy: resolutionResult.isLegacy,
          success: resolutionResult.success,
          targetCount: traceData.totalTargetCount || 0
        }
      );

    } catch (error) {
      this.#logger.warn(
        `Failed to capture target resolution data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture target resolution error
   * 
   * @private
   */
  async #captureTargetResolutionError(trace, actionDef, actor, error) {
    try {
      const errorData = {
        stage: 'target_resolution',
        actorId: actor.id,
        resolutionFailed: true,
        error: error.message,
        errorType: error.constructor.name,
        timestamp: Date.now()
      };

      await trace.captureActionData('target_resolution', actionDef.id, errorData);

      this.#logger.debug(
        `MultiTargetResolutionStage: Captured target resolution error for action '${actionDef.id}'`,
        { actionId: actionDef.id, error: error.message }
      );

    } catch (traceError) {
      this.#logger.warn(
        `Failed to capture target resolution error data for action '${actionDef.id}'`,
        traceError
      );
    }
  }

  /**
   * Capture post-resolution summary data
   * 
   * @private
   */
  async #capturePostResolutionData(trace, actor, originalCount, combinationCount, resolutionResults, stageStartTime) {
    try {
      let legacyActions = 0;
      let multiTargetActions = 0;
      let successfulResolutions = 0;
      let failedResolutions = 0;

      for (const [actionId, result] of resolutionResults) {
        if (result.isLegacy) legacyActions++;
        else multiTargetActions++;
        
        if (result.success) successfulResolutions++;
        else failedResolutions++;
      }

      const summaryData = {
        stage: 'target_resolution_summary',
        actorId: actor.id,
        originalActionCount: originalCount,
        actionTargetCombinations: combinationCount,
        legacyActionCount: legacyActions,
        multiTargetActionCount: multiTargetActions,
        successfulResolutions,
        failedResolutions,
        resolutionSuccessRate: originalCount > 0 ? (successfulResolutions / originalCount) : 1.0,
        combinationExpansionRatio: originalCount > 0 ? (combinationCount / originalCount) : 0,
        stageDurationMs: Date.now() - stageStartTime,
        timestamp: Date.now()
      };

      this.#logger.debug(
        'MultiTargetResolutionStage: Captured post-resolution summary',
        summaryData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture post-resolution summary for tracing', error);
    }
  }

  /**
   * Get stage statistics for debugging
   * 
   * @returns {Object} Stage statistics
   */
  getStageStatistics() {
    return {
      name: this.#name,
      type: 'MultiTargetResolutionStage',
      hasLegacyLayer: !!this.#legacyLayer,
      hasMultiTargetService: !!this.#multiTargetService,
      hasScopeService: !!this.#scopeService,
      supportsTracing: true
    };
  }
}

export default MultiTargetResolutionStage;
```

### Step 2: Create Target Resolution Analysis Utilities

Create `src/actions/tracing/targetResolutionAnalysisUtils.js`:

```javascript
/**
 * @file Utility functions for target resolution analysis in action tracing
 */

/**
 * Analyze target resolution complexity and patterns
 * 
 * @param {Object} resolutionData - Target resolution data to analyze
 * @returns {Object} Detailed analysis of target resolution
 */
export function analyzeTargetResolution(resolutionData) {
  const analysis = {
    resolutionType: resolutionData.isLegacy ? 'legacy' : 'multi-target',
    complexity: 'simple',
    targetStatistics: {
      totalTargets: 0,
      targetKeys: [],
      averageTargetsPerKey: 0,
      hasMultipleTargetTypes: false
    },
    performanceMetrics: {
      resolutionTimeMs: resolutionData.resolutionTimeMs || 0,
      targetsPerMs: 0
    },
    scopeAnalysis: {
      hasScopeExpressions: false,
      scopeComplexity: 'none',
      scopeCount: 0
    }
  };

  // Analyze target statistics
  if (resolutionData.resolvedTargets) {
    const targetKeys = Object.keys(resolutionData.resolvedTargets);
    analysis.targetStatistics.targetKeys = targetKeys;
    analysis.targetStatistics.targetKeyCount = targetKeys.length;

    let totalTargets = 0;
    const targetTypes = new Set();

    for (const [key, targets] of Object.entries(resolutionData.resolvedTargets)) {
      totalTargets += targets.length;
      
      targets.forEach(target => {
        if (target.type) {
          targetTypes.add(target.type);
        }
      });
    }

    analysis.targetStatistics.totalTargets = totalTargets;
    analysis.targetStatistics.averageTargetsPerKey = targetKeys.length > 0 
      ? totalTargets / targetKeys.length 
      : 0;
    analysis.targetStatistics.hasMultipleTargetTypes = targetTypes.size > 1;
    analysis.targetStatistics.uniqueTargetTypes = Array.from(targetTypes);
  }

  // Analyze scope expressions
  if (resolutionData.scopeExpression) {
    // Legacy single scope
    analysis.scopeAnalysis.hasScopeExpressions = true;
    analysis.scopeAnalysis.scopeCount = 1;
    analysis.scopeAnalysis.scopeComplexity = analyzeScopeComplexity(resolutionData.scopeExpression);
  } else if (resolutionData.scopeExpressions) {
    // Multi-target scopes
    analysis.scopeAnalysis.hasScopeExpressions = true;
    analysis.scopeAnalysis.scopeCount = Object.keys(resolutionData.scopeExpressions).length;
    
    const complexities = Object.values(resolutionData.scopeExpressions)
      .map(analyzeScopeComplexity);
    
    analysis.scopeAnalysis.scopeComplexity = determineOverallComplexity(complexities);
  }

  // Analyze performance
  if (analysis.performanceMetrics.resolutionTimeMs > 0 && analysis.targetStatistics.totalTargets > 0) {
    analysis.performanceMetrics.targetsPerMs = 
      analysis.targetStatistics.totalTargets / analysis.performanceMetrics.resolutionTimeMs;
  }

  // Determine overall complexity
  analysis.complexity = determineResolutionComplexity(analysis);

  return analysis;
}

/**
 * Analyze scope expression complexity
 * 
 * @private
 * @param {string} scopeExpression - Scope expression to analyze
 * @returns {string} Complexity level
 */
function analyzeScopeComplexity(scopeExpression) {
  if (!scopeExpression || typeof scopeExpression !== 'string') {
    return 'none';
  }

  // Simple heuristics for scope complexity
  if (scopeExpression.length < 20) {
    return 'simple';
  }

  if (scopeExpression.includes('|') || scopeExpression.includes('+')) {
    return 'moderate'; // Union operations
  }

  if (scopeExpression.includes('[{') || scopeExpression.includes('filter')) {
    return 'complex'; // JSON Logic filters
  }

  if (scopeExpression.includes('[]') && scopeExpression.length > 50) {
    return 'complex'; // Array operations on long expressions
  }

  return 'moderate';
}

/**
 * Determine overall complexity from multiple factors
 * 
 * @private
 * @param {Array<string>} complexities - Array of complexity levels
 * @returns {string} Overall complexity
 */
function determineOverallComplexity(complexities) {
  if (complexities.includes('complex')) return 'complex';
  if (complexities.includes('moderate')) return 'moderate';
  if (complexities.includes('simple')) return 'simple';
  return 'none';
}

/**
 * Determine overall resolution complexity
 * 
 * @private
 * @param {Object} analysis - Analysis object
 * @returns {string} Overall complexity level
 */
function determineResolutionComplexity(analysis) {
  let complexityScore = 0;

  // Scope complexity contributes to overall complexity
  const scopeComplexityWeights = {
    'none': 0,
    'simple': 1,
    'moderate': 2,
    'complex': 4
  };
  complexityScore += scopeComplexityWeights[analysis.scopeAnalysis.scopeComplexity] || 0;

  // Multiple target keys increase complexity
  if (analysis.targetStatistics.targetKeyCount > 1) {
    complexityScore += analysis.targetStatistics.targetKeyCount * 0.5;
  }

  // Large number of targets increases complexity
  if (analysis.targetStatistics.totalTargets > 10) {
    complexityScore += Math.log10(analysis.targetStatistics.totalTargets);
  }

  // Multi-target actions are generally more complex than legacy
  if (analysis.resolutionType === 'multi-target') {
    complexityScore += 1;
  }

  // Determine final complexity level
  if (complexityScore <= 1) return 'simple';
  if (complexityScore <= 3) return 'moderate';
  if (complexityScore <= 6) return 'complex';
  return 'very-complex';
}

/**
 * Generate human-readable target resolution report
 * 
 * @param {Object} analysis - Analysis from analyzeTargetResolution
 * @returns {string} Human-readable report
 */
export function generateTargetResolutionReport(analysis) {
  let report = `Target Resolution Analysis:\n`;
  report += `- Resolution Type: ${analysis.resolutionType}\n`;
  report += `- Overall Complexity: ${analysis.complexity}\n\n`;

  report += `Target Statistics:\n`;
  report += `- Total Targets: ${analysis.targetStatistics.totalTargets}\n`;
  report += `- Target Keys: ${analysis.targetStatistics.targetKeys.join(', ') || 'none'}\n`;
  
  if (analysis.targetStatistics.targetKeyCount > 0) {
    report += `- Average Targets per Key: ${analysis.targetStatistics.averageTargetsPerKey.toFixed(1)}\n`;
  }
  
  if (analysis.targetStatistics.uniqueTargetTypes.length > 0) {
    report += `- Target Types: ${analysis.targetStatistics.uniqueTargetTypes.join(', ')}\n`;
  }

  report += `\nScope Analysis:\n`;
  report += `- Has Scope Expressions: ${analysis.scopeAnalysis.hasScopeExpressions ? 'Yes' : 'No'}\n`;
  
  if (analysis.scopeAnalysis.hasScopeExpressions) {
    report += `- Scope Count: ${analysis.scopeAnalysis.scopeCount}\n`;
    report += `- Scope Complexity: ${analysis.scopeAnalysis.scopeComplexity}\n`;
  }

  report += `\nPerformance:\n`;
  report += `- Resolution Time: ${analysis.performanceMetrics.resolutionTimeMs}ms\n`;
  
  if (analysis.performanceMetrics.targetsPerMs > 0) {
    report += `- Targets per ms: ${analysis.performanceMetrics.targetsPerMs.toFixed(2)}\n`;
  }

  return report;
}

/**
 * Extract target metadata for tracing
 * 
 * @param {Array} targets - Array of target objects
 * @returns {Array} Simplified target metadata
 */
export function extractTargetMetadata(targets) {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets.map(target => {
    if (!target || typeof target !== 'object') {
      return { id: String(target), type: 'primitive' };
    }

    return {
      id: target.id || target.name || 'unknown',
      displayName: target.displayName || target.name || target.id,
      type: target.type || 'unknown',
      // Include other relevant properties if available
      ...(target.location && { location: target.location }),
      ...(target.category && { category: target.category })
    };
  });
}

/**
 * Validate target resolution trace data
 * 
 * @param {Object} traceData - Target resolution trace data
 * @returns {Object} Validation result
 */
export function validateTargetResolutionTraceData(traceData) {
  const issues = [];
  const warnings = [];

  if (!traceData.actorId) {
    issues.push('Missing actorId in target resolution trace data');
  }

  if (typeof traceData.isLegacy !== 'boolean') {
    issues.push('isLegacy must be a boolean value');
  }

  if (typeof traceData.resolutionSuccess !== 'boolean') {
    issues.push('resolutionSuccess must be a boolean value');
  }

  if (typeof traceData.resolutionTimeMs !== 'number' || traceData.resolutionTimeMs < 0) {
    warnings.push('resolutionTimeMs should be a non-negative number');
  }

  if (traceData.resolvedTargets) {
    if (typeof traceData.resolvedTargets !== 'object') {
      issues.push('resolvedTargets must be an object');
    } else {
      for (const [key, targets] of Object.entries(traceData.resolvedTargets)) {
        if (!Array.isArray(targets.targets)) {
          warnings.push(`resolvedTargets.${key}.targets should be an array`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Compare legacy vs multi-target resolution results
 * 
 * @param {Object} legacyResult - Legacy resolution result
 * @param {Object} multiTargetResult - Multi-target resolution result
 * @returns {Object} Comparison analysis
 */
export function compareResolutionResults(legacyResult, multiTargetResult) {
  const comparison = {
    bothSuccessful: legacyResult.resolutionSuccess && multiTargetResult.resolutionSuccess,
    performanceComparison: {
      legacyTimeMs: legacyResult.resolutionTimeMs || 0,
      multiTargetTimeMs: multiTargetResult.resolutionTimeMs || 0,
      difference: 0,
      fasterMethod: 'equivalent'
    },
    targetComparison: {
      legacyTargetCount: legacyResult.totalTargetCount || 0,
      multiTargetCount: multiTargetResult.totalTargetCount || 0,
      difference: 0,
      moreTargets: 'equivalent'
    },
    complexityComparison: {
      legacyComplexity: 'unknown',
      multiTargetComplexity: 'unknown'
    }
  };

  // Performance comparison
  const timeDiff = legacyResult.resolutionTimeMs - multiTargetResult.resolutionTimeMs;
  comparison.performanceComparison.difference = Math.abs(timeDiff);
  
  if (Math.abs(timeDiff) > 1) { // Only consider differences > 1ms significant
    comparison.performanceComparison.fasterMethod = timeDiff > 0 ? 'multi-target' : 'legacy';
  }

  // Target count comparison
  const targetDiff = (legacyResult.totalTargetCount || 0) - (multiTargetResult.totalTargetCount || 0);
  comparison.targetComparison.difference = Math.abs(targetDiff);
  
  if (targetDiff !== 0) {
    comparison.targetComparison.moreTargets = targetDiff > 0 ? 'legacy' : 'multi-target';
  }

  return comparison;
}
```

### Step 3: Create Scope Expression Analysis Tools

Create `src/actions/tracing/scopeExpressionAnalysis.js`:

```javascript
/**
 * @file Tools for analyzing scope expressions in target resolution tracing
 */

/**
 * Parse and analyze scope expression structure
 * 
 * @param {string} scopeExpression - Scope expression to analyze
 * @returns {Object} Detailed scope analysis
 */
export function analyzeScopeExpression(scopeExpression) {
  if (!scopeExpression || typeof scopeExpression !== 'string') {
    return {
      valid: false,
      complexity: 'none',
      components: [],
      operators: [],
      hasFilters: false,
      hasUnions: false,
      estimatedExecutionTime: 0
    };
  }

  const analysis = {
    valid: true,
    originalExpression: scopeExpression,
    length: scopeExpression.length,
    complexity: 'simple',
    components: [],
    operators: [],
    hasFilters: false,
    hasUnions: false,
    hasArrayOperations: false,
    nestingDepth: 0,
    estimatedExecutionTime: 1 // Base execution time in ms
  };

  // Parse scope expression components
  analysis.components = parseScopeComponents(scopeExpression);
  analysis.operators = extractOperators(scopeExpression);
  
  // Analyze scope features
  analysis.hasFilters = scopeExpression.includes('[{') || scopeExpression.includes('filter');
  analysis.hasUnions = scopeExpression.includes('|') || scopeExpression.includes('+');
  analysis.hasArrayOperations = scopeExpression.includes('[]');
  analysis.nestingDepth = calculateNestingDepth(scopeExpression);

  // Calculate complexity
  analysis.complexity = calculateScopeComplexity(analysis);
  
  // Estimate execution time
  analysis.estimatedExecutionTime = estimateExecutionTime(analysis);

  return analysis;
}

/**
 * Parse scope expression into components
 * 
 * @private
 * @param {string} expression - Expression to parse
 * @returns {Array<Object>} Array of scope components
 */
function parseScopeComponents(expression) {
  const components = [];
  
  // Split on union operators but preserve the parts
  const unionParts = expression.split(/([|+])/);
  
  unionParts.forEach(part => {
    const trimmedPart = part.trim();
    if (trimmedPart && trimmedPart !== '|' && trimmedPart !== '+') {
      components.push(analyzeScopeComponent(trimmedPart));
    }
  });

  return components;
}

/**
 * Analyze individual scope component
 * 
 * @private
 * @param {string} component - Component to analyze
 * @returns {Object} Component analysis
 */
function analyzeScopeComponent(component) {
  const analysis = {
    original: component,
    type: 'simple',
    baseScope: '',
    hasFilters: false,
    hasArrayOperations: false,
    filterComplexity: 0
  };

  // Extract base scope (everything before filters or array operations)
  const filterMatch = component.match(/^([^[]+)(\[.*\])?$/);
  if (filterMatch) {
    analysis.baseScope = filterMatch[1].trim();
    
    if (filterMatch[2]) {
      analysis.hasFilters = filterMatch[2].includes('{');
      analysis.hasArrayOperations = filterMatch[2].includes('[]');
      
      if (analysis.hasFilters) {
        analysis.type = 'filtered';
        analysis.filterComplexity = calculateFilterComplexity(filterMatch[2]);
      } else if (analysis.hasArrayOperations) {
        analysis.type = 'array';
      }
    }
  } else {
    analysis.baseScope = component;
  }

  return analysis;
}

/**
 * Extract operators from scope expression
 * 
 * @private
 * @param {string} expression - Expression to analyze
 * @returns {Array<string>} Array of operators found
 */
function extractOperators(expression) {
  const operators = [];
  
  // Union operators
  if (expression.includes('|')) operators.push('union_pipe');
  if (expression.includes('+')) operators.push('union_plus');
  
  // Array operations
  if (expression.includes('[]')) operators.push('array_iteration');
  
  // Filter operations (JSON Logic)
  if (expression.includes('[{')) operators.push('json_logic_filter');
  
  // Field access
  if (expression.includes('.')) operators.push('field_access');

  return operators;
}

/**
 * Calculate nesting depth of scope expression
 * 
 * @private
 * @param {string} expression - Expression to analyze
 * @returns {number} Maximum nesting depth
 */
function calculateNestingDepth(expression) {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of expression) {
    if (char === '[' || char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ']' || char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Calculate filter complexity for JSON Logic filters
 * 
 * @private
 * @param {string} filterExpression - Filter part of expression
 * @returns {number} Filter complexity score
 */
function calculateFilterComplexity(filterExpression) {
  let complexity = 1; // Base complexity

  // Count logical operators
  const logicalOps = ['==', '!=', '>', '<', '>=', '<=', 'and', 'or', 'not'];
  logicalOps.forEach(op => {
    const matches = (filterExpression.match(new RegExp(op, 'g')) || []).length;
    complexity += matches;
  });

  // Nested objects increase complexity
  complexity += (filterExpression.match(/\{/g) || []).length;

  return complexity;
}

/**
 * Calculate overall scope complexity
 * 
 * @private
 * @param {Object} analysis - Scope analysis object
 * @returns {string} Complexity level
 */
function calculateScopeComplexity(analysis) {
  let score = 0;

  // Base complexity from length
  if (analysis.length > 50) score += 1;
  if (analysis.length > 100) score += 1;

  // Component complexity
  score += analysis.components.length * 0.5;
  
  // Feature complexity
  if (analysis.hasFilters) score += 2;
  if (analysis.hasUnions) score += 1;
  if (analysis.hasArrayOperations) score += 1;

  // Nesting complexity
  score += analysis.nestingDepth * 0.5;

  // Filter complexity from components
  const filterComplexity = analysis.components.reduce(
    (sum, comp) => sum + comp.filterComplexity, 0
  );
  score += filterComplexity * 0.3;

  // Determine complexity level
  if (score <= 1) return 'simple';
  if (score <= 3) return 'moderate';
  if (score <= 6) return 'complex';
  return 'very-complex';
}

/**
 * Estimate execution time based on scope complexity
 * 
 * @private
 * @param {Object} analysis - Scope analysis object
 * @returns {number} Estimated execution time in milliseconds
 */
function estimateExecutionTime(analysis) {
  let baseTime = 1; // Base 1ms

  // Length factor
  baseTime += analysis.length / 100;

  // Component factor
  baseTime += analysis.components.length * 0.5;

  // Feature factors
  if (analysis.hasFilters) baseTime *= 2;
  if (analysis.hasUnions) baseTime *= 1.5;
  if (analysis.hasArrayOperations) baseTime *= 1.8;

  // Nesting factor
  baseTime *= (1 + analysis.nestingDepth * 0.3);

  return Math.ceil(baseTime);
}

/**
 * Generate scope expression report
 * 
 * @param {Object} analysis - Scope analysis result
 * @returns {string} Human-readable report
 */
export function generateScopeExpressionReport(analysis) {
  if (!analysis.valid) {
    return 'Invalid or empty scope expression';
  }

  let report = `Scope Expression Analysis:\n`;
  report += `- Expression: "${analysis.originalExpression}"\n`;
  report += `- Length: ${analysis.length} characters\n`;
  report += `- Complexity: ${analysis.complexity}\n`;
  report += `- Components: ${analysis.components.length}\n`;
  report += `- Nesting Depth: ${analysis.nestingDepth}\n`;
  report += `- Estimated Execution Time: ${analysis.estimatedExecutionTime}ms\n\n`;

  report += `Features:\n`;
  report += `- Has Filters: ${analysis.hasFilters ? 'Yes' : 'No'}\n`;
  report += `- Has Unions: ${analysis.hasUnions ? 'Yes' : 'No'}\n`;
  report += `- Has Array Operations: ${analysis.hasArrayOperations ? 'Yes' : 'No'}\n`;

  if (analysis.operators.length > 0) {
    report += `- Operators: ${analysis.operators.join(', ')}\n`;
  }

  if (analysis.components.length > 0) {
    report += `\nComponents:\n`;
    analysis.components.forEach((comp, index) => {
      report += `  ${index + 1}. ${comp.original} (${comp.type})\n`;
    });
  }

  return report;
}

/**
 * Compare scope expressions for performance analysis
 * 
 * @param {Array<string>} expressions - Array of scope expressions to compare
 * @returns {Object} Comparison results
 */
export function compareScopeExpressions(expressions) {
  const analyses = expressions.map(expr => analyzeScopeExpression(expr));
  
  const comparison = {
    totalExpressions: expressions.length,
    complexityDistribution: {},
    averageComplexity: 0,
    mostComplex: null,
    leastComplex: null,
    averageEstimatedTime: 0,
    totalEstimatedTime: 0
  };

  // Calculate complexity distribution
  analyses.forEach(analysis => {
    const complexity = analysis.complexity;
    comparison.complexityDistribution[complexity] = 
      (comparison.complexityDistribution[complexity] || 0) + 1;
  });

  // Find most and least complex
  let maxComplexity = -1;
  let minComplexity = Infinity;
  
  analyses.forEach((analysis, index) => {
    const complexityScore = getComplexityScore(analysis.complexity);
    
    if (complexityScore > maxComplexity) {
      maxComplexity = complexityScore;
      comparison.mostComplex = { index, expression: expressions[index], analysis };
    }
    
    if (complexityScore < minComplexity) {
      minComplexity = complexityScore;
      comparison.leastComplex = { index, expression: expressions[index], analysis };
    }
  });

  // Calculate timing statistics
  const totalTime = analyses.reduce((sum, a) => sum + a.estimatedExecutionTime, 0);
  comparison.totalEstimatedTime = totalTime;
  comparison.averageEstimatedTime = expressions.length > 0 ? totalTime / expressions.length : 0;

  return comparison;
}

/**
 * Get numeric complexity score for comparison
 * 
 * @private
 * @param {string} complexity - Complexity level
 * @returns {number} Numeric score
 */
function getComplexityScore(complexity) {
  const scores = {
    'none': 0,
    'simple': 1,
    'moderate': 2,
    'complex': 3,
    'very-complex': 4
  };
  return scores[complexity] || 1;
}
```

## Testing Requirements

### Unit Tests

#### Test File: `tests/unit/actions/pipeline/stages/multiTargetResolutionStage.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStageTestBed } from '../../../../common/actions/pipeline/multiTargetResolutionStageTestBed.js';

describe('MultiTargetResolutionStage - Action Tracing Enhancement', () => {
  let testBed;

  beforeEach(() => {
    testBed = new MultiTargetResolutionStageTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Action Type Detection and Tracing', () => {
    it('should detect legacy actions and capture legacy resolution data', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:legacy_action'],
        actionDefinitions: [{
          id: 'core:legacy_action',
          scopeExpression: 'core:visible_items'
        }],
        legacyActions: ['core:legacy_action']
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      
      const captures = testBed.getActionTraceCaptures();
      expect(captures).toHaveLength(1);

      const captureData = captures[0];
      expect(captureData.data.isLegacy).toBe(true);
      expect(captureData.data.scopeExpression).toBe('core:visible_items');
    });

    it('should detect multi-target actions and capture multi-target resolution data', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:multi_action'],
        actionDefinitions: [{
          id: 'core:multi_action',
          targets: {
            primary: { scope: 'core:entities' },
            secondary: { scope: 'core:items' }
          }
        }]
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      
      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.isLegacy).toBe(false);
      expect(captureData.data.targetKeys).toEqual(['primary', 'secondary']);
      expect(captureData.data.scopeExpressions).toBeDefined();
    });
  });

  describe('Target Resolution Data Capture', () => {
    it('should capture resolved targets with metadata', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:test_action'],
        resolvedTargets: {
          primary: [
            { id: 'target1', displayName: 'Target One', type: 'item' },
            { id: 'target2', displayName: 'Target Two', type: 'entity' }
          ]
        }
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.resolvedTargets).toBeDefined();
      expect(captureData.data.resolvedTargets.primary.count).toBe(2);
      expect(captureData.data.resolvedTargets.primary.targets[0].id).toBe('target1');
      expect(captureData.data.totalTargetCount).toBe(2);
    });

    it('should capture scope expression evaluation details', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:complex_action'],
        actionDefinitions: [{
          id: 'core:complex_action',
          targets: {
            filtered: { scope: 'actor.inventory[{"==": [{"var": "type"}, "weapon"]}]' }
          }
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.scopeExpressions).toBeDefined();
      expect(captureData.data.scopeExpressions.filtered).toContain('weapon');
    });

    it('should capture performance timing metrics', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:test_action']
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(typeof captureData.data.resolutionTimeMs).toBe('number');
      expect(captureData.data.resolutionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should capture action-target combination counts', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:multi_target_action'],
        resolvedTargets: {
          primary: [
            { id: 'target1' },
            { id: 'target2' }
          ]
        }
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.actionTargetCombinations).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle scope service errors gracefully', async () => {
      const stage = testBed.createStageWithErrors();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:error_action'],
        scopeServiceError: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true); // Stage should continue despite service errors
      
      const captures = testBed.getActionTraceCaptures();
      expect(captures[0].data.resolutionFailed).toBe(true);
      expect(captures[0].data.error).toBeTruthy();
    });

    it('should handle legacy layer failures', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:problematic_action'],
        legacyLayerError: true
      });

      const result = await stage.executeInternal(context);
      expect(result.success).toBe(true);
    });

    it('should continue when trace capture fails', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:test_action'],
        traceCaptureFailure: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getWarningLogs()).toContain('Failed to capture target resolution data');
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal overhead when tracing is disabled', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'StructuredTrace',
        actionDefinitions: testBed.createLargeActionSet(50)
      });

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast without tracing
    });

    it('should have acceptable overhead when tracing is enabled', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['*'],
        actionDefinitions: testBed.createLargeActionSet(20)
      });

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(300); // Reasonable overhead with tracing
    });
  });
});
```

#### Test Bed: `tests/common/actions/pipeline/multiTargetResolutionStageTestBed.js`

```javascript
/**
 * Test bed for MultiTargetResolutionStage with action tracing support
 */

import MultiTargetResolutionStage from '../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';

export class MultiTargetResolutionStageTestBed {
  #instances = [];
  #mocks = new Map();
  #capturedActionTraces = [];

  createStage(options = {}) {
    const mockLegacyLayer = this.createMockLegacyLayer(options);
    const mockMultiTargetService = this.createMockMultiTargetService(options);
    const mockScopeService = this.createMockScopeService(options);
    const mockLogger = this.createMockLogger();

    const stage = new MultiTargetResolutionStage({
      legacyLayer: mockLegacyLayer,
      multiTargetService: mockMultiTargetService,
      scopeService: mockScopeService,
      logger: mockLogger
    });

    this.#instances.push(stage);
    return stage;
  }

  createStageWithErrors() {
    return this.createStage({ simulateErrors: true });
  }

  createContext(options = {}) {
    const {
      traceType = 'ActionAwareStructuredTrace',
      tracedActions = ['*'],
      actionDefinitions = [{ id: 'core:test_action' }],
      legacyActions = [],
      resolvedTargets = { primary: [{ id: 'target1' }] },
      scopeServiceError = false,
      legacyLayerError = false,
      traceCaptureFailure = false
    } = options;

    const mockActor = this.createMockActor();
    const mockTrace = this.createMockTrace(traceType, tracedActions, traceCaptureFailure);
    const mockActionContext = this.createMockActionContext();

    // Configure service mocks
    const legacyLayer = this.#mocks.get('legacyLayer');
    if (legacyLayer) {
      legacyLayer.isLegacyAction.mockImplementation((actionDef) => {
        if (legacyLayerError) {
          throw new Error('Legacy layer error');
        }
        return legacyActions.includes(actionDef.id);
      });
    }

    const scopeService = this.#mocks.get('scopeService');
    if (scopeService) {
      scopeService.evaluateScope.mockImplementation((scope, context) => {
        if (scopeServiceError) {
          throw new Error('Scope service error');
        }
        return { targets: resolvedTargets.primary || [] };
      });
    }

    return {
      actor: mockActor,
      candidateActions: actionDefinitions,
      trace: mockTrace,
      actionContext: mockActionContext,
      data: {}
    };
  }

  createMockLegacyLayer(options = {}) {
    const legacyLayer = {
      isLegacyAction: jest.fn().mockReturnValue(false)
    };

    this.#mocks.set('legacyLayer', legacyLayer);
    return legacyLayer;
  }

  createMockMultiTargetService(options = {}) {
    const service = {
      resolveTargets: jest.fn().mockResolvedValue({
        primary: [{ id: 'target1', displayName: 'Test Target' }]
      })
    };

    this.#mocks.set('multiTargetService', service);
    return service;
  }

  createMockScopeService(options = {}) {
    const service = {
      evaluateScope: jest.fn().mockResolvedValue({
        targets: [{ id: 'target1', displayName: 'Test Target', type: 'entity' }]
      })
    };

    this.#mocks.set('scopeService', service);
    return service;
  }

  createMockTrace(traceType, tracedActions = [], shouldFailCapture = false) {
    const baseTrace = {
      step: jest.fn(),
      info: jest.fn()
    };

    if (traceType === 'ActionAwareStructuredTrace') {
      baseTrace.captureActionData = jest.fn().mockImplementation((stage, actionId, data) => {
        if (shouldFailCapture) {
          throw new Error('Trace capture failure simulation');
        }

        const shouldTrace = tracedActions.includes('*') || tracedActions.includes(actionId);
        if (shouldTrace) {
          this.#capturedActionTraces.push({
            stage,
            actionId,
            data: { ...data }
          });
        }
      });
    }

    this.#mocks.set('trace', baseTrace);
    return baseTrace;
  }

  createMockActor() {
    return {
      id: 'test-actor',
      components: new Map([
        ['core:position', { id: 'core:position' }],
        ['core:inventory', { items: ['sword', 'potion'] }]
      ])
    };
  }

  createMockActionContext() {
    return {
      location: 'test-location',
      time: 'day'
    };
  }

  createMockLogger() {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    this.#mocks.set('logger', logger);
    return logger;
  }

  createLargeActionSet(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `action_${i}`,
      targets: i % 2 === 0 
        ? { primary: { scope: `scope_${i}` } }
        : { scopeExpression: `scope_${i}` }
    }));
  }

  getActionTraceCaptures() {
    return this.#capturedActionTraces;
  }

  getWarningLogs() {
    const logger = this.#mocks.get('logger');
    return logger ? logger.warn.mock.calls.map(call => call[0]) : [];
  }

  cleanup() {
    this.#instances.length = 0;
    this.#mocks.clear();
    this.#capturedActionTraces.length = 0;
  }
}
```

### Integration Tests

#### Test File: `tests/integration/actions/pipeline/multiTargetResolutionStageTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';

describe('MultiTargetResolutionStage - Action Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate with full action discovery pipeline', async () => {
    await testBed.setupFullPipeline({
      tracedActions: ['core:take_item'],
      verbosity: 'detailed'
    });

    const actor = testBed.createActorInLocation('room1');
    const result = await testBed.runActionDiscovery(actor);

    expect(result.success).toBe(true);
    
    const traceData = testBed.getActionTraceData();
    const takeActionTrace = traceData.get('core:take_item');
    
    expect(takeActionTrace).toBeDefined();
    expect(takeActionTrace.stages.target_resolution).toBeDefined();
    
    const targetStageData = takeActionTrace.stages.target_resolution.data;
    expect(targetStageData.resolutionSuccess).toBe(true);
    expect(targetStageData.resolvedTargets).toBeDefined();
  });

  it('should differentiate between legacy and multi-target actions', async () => {
    await testBed.setupMixedActionTypes({
      tracedActions: ['core:legacy_look', 'core:modern_interact'],
      verbosity: 'verbose'
    });

    const actor = testBed.createTestActor();
    const result = await testBed.runActionDiscovery(actor);

    const traceData = testBed.getActionTraceData();
    
    const legacyTrace = traceData.get('core:legacy_look');
    const modernTrace = traceData.get('core:modern_interact');
    
    expect(legacyTrace.stages.target_resolution.data.isLegacy).toBe(true);
    expect(modernTrace.stages.target_resolution.data.isLegacy).toBe(false);
  });

  it('should capture scope expression complexity in full pipeline', async () => {
    await testBed.setupComplexScopeActions({
      tracedActions: ['core:complex_scope_action'],
      verbosity: 'verbose'
    });

    const actor = testBed.createActorWithComplexInventory();
    const result = await testBed.runActionDiscovery(actor);

    const traceData = testBed.getActionTraceData();
    const actionTrace = traceData.get('core:complex_scope_action');
    const targetData = actionTrace.stages.target_resolution.data;
    
    expect(targetData.scopeExpressions).toBeDefined();
    expect(Object.keys(targetData.scopeExpressions).length).toBeGreaterThan(0);
  });
});
```

## Acceptance Criteria

### Functional Acceptance Criteria

#### AC-013-01: Target Resolution Tracing
- [ ] MultiTargetResolutionStage detects ActionAwareStructuredTrace and enables target resolution tracing
- [ ] Stage captures detailed target resolution data only for traced actions
- [ ] Both legacy and multi-target action resolution processes are traced appropriately
- [ ] Scope expressions and target metadata are captured accurately

#### AC-013-02: Legacy vs Multi-Target Differentiation
- [ ] Stage correctly identifies legacy vs multi-target actions using LegacyLayer
- [ ] Legacy action resolution process is traced with scope expression details
- [ ] Multi-target action resolution captures target keys and multiple scope expressions
- [ ] Action-target combination generation is traced for both action types

#### AC-013-03: Target and Scope Data Accuracy
- [ ] Resolved targets are captured with relevant metadata (id, displayName, type)
- [ ] Scope expressions are extracted and traced for debugging scope evaluation
- [ ] Target count statistics and resolution metrics are accurate
- [ ] Performance timing data reflects actual resolution time

#### AC-013-04: Error Handling and Robustness
- [ ] Scope service errors are captured in trace data without breaking stage execution
- [ ] Legacy layer failures are handled gracefully with appropriate error tracing
- [ ] Stage continues processing remaining actions when individual resolutions fail
- [ ] Trace capture failures don't prevent normal stage operation

### Technical Acceptance Criteria

#### AC-013-05: Performance Requirements
- [ ] <3ms overhead per traced action during target resolution
- [ ] No measurable performance impact when action tracing is disabled
- [ ] Complex scope evaluation tracing doesn't significantly slow resolution process
- [ ] Memory usage remains stable during extensive target resolution tracing

#### AC-013-06: Code Quality and Integration
- [ ] Target resolution logic handles both legacy and multi-target patterns correctly
- [ ] Scope expression extraction works with various action definition formats
- [ ] Error handling includes comprehensive logging with actionable information
- [ ] Integration with LegacyLayer and scope services maintains existing functionality

### Testing Coverage Requirements

#### AC-013-07: Unit Testing
- [ ] Unit tests cover legacy vs multi-target action detection and processing
- [ ] Scope expression extraction tests for various action definition formats
- [ ] Target metadata capture tests with different target object structures
- [ ] Error handling tests for scope service and legacy layer failures

#### AC-013-08: Integration Testing
- [ ] Integration tests verify tracing works with actual target resolution services
- [ ] Full pipeline tests confirm data consistency across all tracing stages
- [ ] Performance tests validate overhead requirements with realistic action sets
- [ ] Error recovery tests ensure graceful handling of service failures

## Dependencies

### Technical Dependencies
- `src/actions/tracing/actionAwareStructuredTrace.js` - ACTTRA-009 (ActionAwareStructuredTrace class)
- `src/actions/pipeline/stages/MultiTargetResolutionStage.js` - Existing stage to enhance
- `src/actions/services/legacyLayer.js` - Service for legacy action detection
- `src/actions/services/multiTargetService.js` - Service for multi-target resolution
- `src/actions/services/scopeService.js` - Service for scope expression evaluation

### Workflow Dependencies
- **ACTTRA-009**: ActionAwareStructuredTrace must be implemented for data capture
- **ACTTRA-010**: Enhanced ActionDiscoveryService provides action-aware trace context
- **ACTTRA-011**: ComponentFilteringStage integration for pipeline consistency
- **ACTTRA-012**: PrerequisiteEvaluationStage integration for complete pipeline tracing

### Service Dependencies
- LegacyLayer must be available for legacy action detection
- ScopeService must be functional for scope expression evaluation
- MultiTargetService integration for complex target resolution scenarios

## Definition of Done

### Code Complete
- [ ] MultiTargetResolutionStage enhanced with comprehensive action tracing capabilities
- [ ] Target resolution analysis utilities created for complex resolution scenario handling
- [ ] Scope expression analysis tools created for debugging scope evaluation
- [ ] Legacy vs multi-target differentiation logic implemented with detailed tracing

### Testing Complete
- [ ] Unit tests written with >90% coverage for enhanced functionality
- [ ] Integration tests verify tracing works with actual resolution services
- [ ] Scope expression analysis tests confirm detailed evaluation capture
- [ ] Performance tests validate overhead requirements for complex resolution scenarios

### Documentation Complete
- [ ] All enhanced methods have comprehensive JSDoc documentation
- [ ] Target resolution analysis logic documented with examples
- [ ] Scope expression analysis patterns documented for debugging
- [ ] Legacy vs multi-target differences documented for developers

### Quality Assurance
- [ ] Code review completed by senior developer focusing on service integration
- [ ] Integration with LegacyLayer and scope services verified and tested
- [ ] Performance benchmarks meet requirements for complex target resolution
- [ ] Error scenarios handle gracefully with comprehensive logging and recovery

## Effort Estimation

### Development Tasks
- Stage enhancement implementation: **3.5 hours**
- Target resolution analysis utilities: **2.5 hours**
- Scope expression analysis tools: **2 hours**
- Legacy vs multi-target handling: **2 hours**
- Error handling and service integration: **1.5 hours**

### Testing Tasks
- Unit test implementation: **4 hours**
- Integration test development: **2.5 hours**
- Scope expression analysis tests: **2 hours**
- Performance validation: **1.5 hours**

### Documentation Tasks
- JSDoc documentation: **1.5 hours**
- Target resolution analysis documentation: **1 hour**
- Scope expression analysis documentation: **0.5 hours**

### Total Estimated Effort: **21 hours**

### Risk Factors
- **Medium Risk**: Legacy vs multi-target integration complexity may require additional debugging time
- **Medium Risk**: Scope expression analysis complexity varies significantly between simple and complex expressions
- **Low Risk**: Service integration should be straightforward with existing dependency injection patterns

## Success Metrics

### Quantitative Metrics
- Unit test coverage ≥90% for enhanced functionality
- <3ms overhead per traced action
- Zero performance impact when tracing disabled
- Target resolution accuracy 100% for both legacy and multi-target actions

### Qualitative Metrics
- Clear visibility into target resolution decisions and scope evaluation
- Comprehensive differentiation between legacy and multi-target processing
- Robust error handling for various scope evaluation and target resolution failures
- Intuitive trace data structure for analyzing complex target resolution scenarios

---

**Ticket Created**: 2025-01-06  
**Estimated Effort**: 21 hours  
**Complexity**: Medium-High  
**Priority**: High  
**Assignee**: TBD  
**Reviewer**: Senior Developer