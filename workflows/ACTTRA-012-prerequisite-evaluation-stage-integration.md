# ACTTRA-012: PrerequisiteEvaluationStage Integration for Action Tracing

## Executive Summary

### Problem Statement
The PrerequisiteEvaluationStage evaluates complex JSON Logic prerequisites for actions but lacks detailed tracing of prerequisite evaluation decisions, conditions, and failures. This makes debugging prerequisite failures extremely difficult, especially when dealing with complex nested conditions or dynamic data dependencies.

### Solution Approach
Enhance the PrerequisiteEvaluationStage to capture comprehensive prerequisite evaluation data when ActionAwareStructuredTrace is available. The integration will capture prerequisite conditions, evaluation context, JSON Logic trace data, and detailed failure analysis while maintaining full backward compatibility.

### Business Value
- Provides complete visibility into prerequisite evaluation logic and decisions
- Enables rapid debugging of action availability issues due to failed prerequisites
- Captures JSON Logic evaluation traces for complex conditional logic analysis
- Helps identify data dependencies and context requirements for actions

## Technical Requirements

### Functional Requirements

#### FR-012-01: Prerequisite Evaluation Tracing
- Must capture prerequisite conditions and evaluation context for traced actions
- Must include JSON Logic evaluation traces and intermediate results
- Must capture prerequisite evaluation success/failure with detailed reasoning
- Must handle multiple prerequisites per action with individual evaluation results

#### FR-012-02: JSON Logic Integration
- Must integrate with JSON Logic evaluation service to capture trace data
- Must capture applied data context and variable resolution
- Must include evaluation steps and decision points in trace data
- Must handle complex nested conditions with hierarchical trace structure

#### FR-012-03: Prerequisite Data Capture
- Must capture prerequisite definitions in various formats (arrays, objects, mixed)
- Must capture evaluation context including actor data, base context, and resolved variables
- Must capture evaluation timing and performance metrics
- Must include failure analysis with specific condition failures and missing data

#### FR-012-04: Error and Edge Case Handling
- Must capture prerequisite evaluation errors and exceptions
- Must handle missing or invalid prerequisite data gracefully
- Must trace actions with no prerequisites (pass-through scenario)
- Must handle malformed JSON Logic expressions with detailed error information

### Non-Functional Requirements

#### NFR-012-01: Performance
- <2ms overhead per traced action during prerequisite evaluation
- No performance impact when action tracing is disabled  
- Efficient JSON Logic trace data collection and formatting
- Minimal memory footprint for prerequisite trace data

#### NFR-012-02: Reliability
- Must not affect existing prerequisite evaluation logic or results
- Must handle prerequisite service failures gracefully without breaking stage
- Must continue stage execution even if tracing capture fails
- Must maintain existing error handling and logging patterns

#### NFR-012-03: Maintainability
- Must integrate cleanly with existing PrerequisiteService dependency
- Must follow project patterns for service integration and error handling
- Must use consistent data structures with other pipeline stages
- Must include comprehensive documentation for prerequisite tracing

## Architecture Design

### Current PrerequisiteEvaluationStage Flow
```
executeInternal(context)
  ↓
For each candidate action:
  - Check if action has prerequisites  
  - PrerequisiteService.evaluate(prerequisites, actionDef, actor, trace)
  - Include/exclude action based on evaluation result
  ↓
Return actions that passed prerequisite evaluation
```

### Enhanced Flow with Action Tracing
```
executeInternal(context)
  ↓
Detect if trace is ActionAwareStructuredTrace
  ↓
For each candidate action:
  - Check if action should be traced
  - Capture pre-evaluation data if tracing enabled
  - PrerequisiteService.evaluate() with enhanced trace capture
  - Capture detailed evaluation results and JSON Logic traces
  - Apply existing filtering logic
  - Capture post-evaluation summary
  ↓
Return filtered actions with comprehensive prerequisite tracing
```

### Data Capture Points

#### Pre-Evaluation Capture
- Action ID and prerequisite definitions
- Evaluation context and available data
- Stage start timing

#### During Evaluation Capture
- JSON Logic evaluation steps and intermediate results
- Variable resolution and data binding
- Condition evaluation results (true/false/error)

#### Post-Evaluation Capture
- Final evaluation result with detailed reasoning
- Performance metrics and timing data
- Error information for failed evaluations

## Implementation Steps

### Step 1: Enhance PrerequisiteEvaluationStage

Modify `src/actions/pipeline/stages/PrerequisiteEvaluationStage.js`:

```javascript
/**
 * @file PrerequisiteEvaluationStage - Enhanced with action tracing capabilities
 */

import { validateDependency, assertPresent } from '../../../utils/validationUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import PipelineResult from '../pipelineResult.js';

/**
 * Pipeline stage that evaluates action prerequisites using JSON Logic
 * Enhanced with detailed action tracing for prerequisite evaluation debugging
 */
class PrerequisiteEvaluationStage {
  #prerequisiteService;
  #logger;
  #name = 'PrerequisiteEvaluation';

  constructor({ prerequisiteService, logger }) {
    validateDependency(prerequisiteService, 'IPrerequisiteService', null, {
      requiredMethods: ['evaluate']
    });
    this.#logger = ensureValidLogger(logger, 'PrerequisiteEvaluationStage');
    this.#prerequisiteService = prerequisiteService;
  }

  get name() {
    return this.#name;
  }

  /**
   * Execute prerequisite evaluation stage with enhanced action tracing
   * 
   * @param {Object} context - Pipeline context
   * @param {Object} context.actor - Actor entity
   * @param {Array} context.candidateActions - Actions to evaluate
   * @param {Object} context.trace - Trace context (may be ActionAwareStructuredTrace)
   * @param {Object} context.actionContext - Base context for prerequisite evaluation
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context) {
    const { actor, candidateActions = [], trace, actionContext } = context;
    const source = `${this.name}Stage.execute`;
    const stageStartTime = Date.now();

    assertPresent(actor, 'Actor is required for prerequisite evaluation');
    assertPresent(actor.id, 'Actor must have an ID');

    try {
      this.#logger.debug(
        `PrerequisiteEvaluationStage: Starting prerequisite evaluation for ${candidateActions.length} actions`,
        { 
          actorId: actor.id, 
          candidateActionCount: candidateActions.length 
        }
      );

      // Check if we have action-aware tracing capability
      const isActionAwareTrace = this.#isActionAwareTrace(trace);
      
      if (isActionAwareTrace) {
        this.#logger.debug(
          `PrerequisiteEvaluationStage: Action tracing enabled for actor ${actor.id}`,
          { actorId: actor.id, traceType: 'ActionAwareStructuredTrace' }
        );
      }

      // Capture pre-evaluation data for tracing
      if (isActionAwareTrace) {
        await this.#capturePreEvaluationData(
          trace, 
          actor, 
          candidateActions, 
          actionContext,
          stageStartTime
        );
      }

      const validActions = [];
      const evaluationResults = new Map();

      for (const actionDef of candidateActions) {
        try {
          const evaluationResult = await this.#evaluateActionWithTracing(
            actionDef,
            actor,
            actionContext,
            trace,
            isActionAwareTrace
          );

          evaluationResults.set(actionDef.id, evaluationResult);

          if (evaluationResult.passed) {
            validActions.push(actionDef);
          }

        } catch (error) {
          this.#logger.error(
            `PrerequisiteEvaluationStage: Error evaluating prerequisites for action '${actionDef.id}'`,
            error
          );

          // Capture error in tracing if available
          if (isActionAwareTrace && trace.captureActionData) {
            await this.#capturePrerequisiteError(trace, actionDef, actor, error);
          }

          // Continue processing other actions
        }
      }

      // Capture post-evaluation summary
      if (isActionAwareTrace) {
        await this.#capturePostEvaluationData(
          trace,
          actor,
          candidateActions.length,
          validActions.length,
          evaluationResults,
          stageStartTime
        );
      }

      // Existing trace logging for backward compatibility
      trace?.step(
        `Evaluated prerequisites for ${candidateActions.length} actions, ${validActions.length} passed`,
        source
      );

      this.#logger.info(
        `PrerequisiteEvaluationStage: Evaluated ${candidateActions.length} → ${validActions.length} actions for actor ${actor.id}`,
        { 
          actorId: actor.id, 
          originalCount: candidateActions.length, 
          passedCount: validActions.length,
          failedCount: candidateActions.length - validActions.length,
          stageDuration: Date.now() - stageStartTime
        }
      );

      return PipelineResult.success({
        data: { ...context.data, candidateActions: validActions }
      });

    } catch (error) {
      this.#logger.error(
        `PrerequisiteEvaluationStage: Failed to evaluate prerequisites for actor ${actor.id}`,
        error
      );

      return PipelineResult.failure(
        `Prerequisite evaluation failed for actor ${actor.id}`,
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
   * Evaluate single action prerequisites with optional tracing
   * 
   * @private
   * @param {Object} actionDef - Action definition to evaluate
   * @param {Object} actor - Actor entity
   * @param {Object} actionContext - Base context for evaluation
   * @param {Object} trace - Trace context
   * @param {boolean} isActionAwareTrace - Whether trace supports action data capture
   * @returns {Promise<Object>} Evaluation result with detailed data
   */
  async #evaluateActionWithTracing(actionDef, actor, actionContext, trace, isActionAwareTrace) {
    const evaluationStartTime = Date.now();

    try {
      // Handle actions with no prerequisites
      if (!this.#hasPrerequisites(actionDef)) {
        const result = {
          passed: true,
          reason: 'No prerequisites defined',
          hasPrerequisites: false,
          evaluationTime: Date.now() - evaluationStartTime
        };

        // Capture no-prerequisites scenario if tracing enabled
        if (isActionAwareTrace && trace.captureActionData) {
          await this.#captureNoPrerequisitesData(trace, actionDef, actor, result);
        }

        return result;
      }

      // Extract and normalize prerequisites
      const prerequisites = this.#extractPrerequisites(actionDef);
      
      // Create enhanced trace for prerequisite service if action tracing is enabled
      const enhancedTrace = isActionAwareTrace 
        ? this.#createPrerequisiteTrace(trace, actionDef)
        : trace;

      // Perform prerequisite evaluation using the service
      const evaluationPassed = this.#prerequisiteService.evaluate(
        prerequisites,
        actionDef,
        actor,
        enhancedTrace
      );

      // Extract detailed evaluation data from enhanced trace
      const evaluationDetails = this.#extractEvaluationDetails(
        enhancedTrace,
        prerequisites,
        evaluationPassed
      );

      const result = {
        passed: evaluationPassed,
        reason: evaluationPassed ? 'All prerequisites satisfied' : 'One or more prerequisites failed',
        hasPrerequisites: true,
        prerequisites: prerequisites,
        evaluationDetails: evaluationDetails,
        evaluationTime: Date.now() - evaluationStartTime
      };

      // Capture detailed evaluation data if tracing enabled
      if (isActionAwareTrace && trace.captureActionData) {
        await this.#capturePrerequisiteEvaluationData(trace, actionDef, actor, result);
      }

      return result;

    } catch (error) {
      const result = {
        passed: false,
        reason: `Prerequisite evaluation error: ${error.message}`,
        hasPrerequisites: this.#hasPrerequisites(actionDef),
        error: error.message,
        errorType: error.constructor.name,
        evaluationTime: Date.now() - evaluationStartTime
      };

      // Don't rethrow - let the stage continue processing other actions
      this.#logger.error(
        `Error evaluating prerequisites for action '${actionDef.id}'`,
        error
      );

      return result;
    }
  }

  /**
   * Check if action has prerequisites
   * 
   * @private
   * @param {Object} actionDef - Action definition
   * @returns {boolean}
   */
  #hasPrerequisites(actionDef) {
    if (!actionDef.prerequisites) {
      return false;
    }

    if (Array.isArray(actionDef.prerequisites)) {
      return actionDef.prerequisites.length > 0;
    }

    if (typeof actionDef.prerequisites === 'object') {
      return Object.keys(actionDef.prerequisites).length > 0;
    }

    return Boolean(actionDef.prerequisites);
  }

  /**
   * Extract prerequisites from action definition
   * 
   * @private
   * @param {Object} actionDef - Action definition
   * @returns {Array|Object} Normalized prerequisites
   */
  #extractPrerequisites(actionDef) {
    const prerequisites = actionDef.prerequisites;

    // If already an array, return as-is
    if (Array.isArray(prerequisites)) {
      return prerequisites;
    }

    // If it's an object, wrap in array
    if (typeof prerequisites === 'object' && prerequisites !== null) {
      return [prerequisites];
    }

    // Convert other types to array
    return [prerequisites];
  }

  /**
   * Create enhanced trace for prerequisite service integration
   * 
   * @private
   * @param {Object} baseTrace - Base ActionAwareStructuredTrace
   * @param {Object} actionDef - Action being evaluated
   * @returns {Object} Enhanced trace for prerequisite service
   */
  #createPrerequisiteTrace(baseTrace, actionDef) {
    // Create a wrapper trace that captures prerequisite-specific data
    const prerequisiteTrace = {
      // Preserve original trace methods
      step: baseTrace.step?.bind(baseTrace),
      info: baseTrace.info?.bind(baseTrace),
      
      // Add prerequisite-specific capture method
      captureJsonLogicTrace: (logicExpression, context, result, steps) => {
        try {
          // Store JSON Logic trace data for later extraction
          if (!prerequisiteTrace._jsonLogicTraces) {
            prerequisiteTrace._jsonLogicTraces = [];
          }

          prerequisiteTrace._jsonLogicTraces.push({
            expression: logicExpression,
            context: this.#createSafeContext(context),
            result,
            evaluationSteps: steps || [],
            timestamp: Date.now()
          });

        } catch (error) {
          this.#logger.warn(
            `Failed to capture JSON Logic trace for action '${actionDef.id}'`,
            error
          );
        }
      },

      // Add context capture method
      captureEvaluationContext: (contextData) => {
        prerequisiteTrace._evaluationContext = this.#createSafeContext(contextData);
      }
    };

    return prerequisiteTrace;
  }

  /**
   * Create safe context for tracing (handles circular references)
   * 
   * @private
   * @param {Object} context - Context to make safe
   * @returns {Object} Safe context for JSON serialization
   */
  #createSafeContext(context) {
    try {
      return JSON.parse(JSON.stringify(context, (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (this.#seenObjects && this.#seenObjects.has(value)) {
            return '[Circular Reference]';
          }
          if (!this.#seenObjects) {
            this.#seenObjects = new WeakSet();
          }
          this.#seenObjects.add(value);
        }

        // Limit string length for large data
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 500) + '... [truncated]';
        }

        return value;
      }));
    } catch (error) {
      return { contextError: 'Failed to serialize context safely' };
    } finally {
      this.#seenObjects = null;
    }
  }

  /**
   * Extract evaluation details from enhanced trace
   * 
   * @private
   * @param {Object} enhancedTrace - Enhanced trace with captured data
   * @param {Array} prerequisites - Original prerequisites
   * @param {boolean} evaluationPassed - Whether evaluation passed
   * @returns {Object} Detailed evaluation information
   */
  #extractEvaluationDetails(enhancedTrace, prerequisites, evaluationPassed) {
    const details = {
      prerequisiteCount: Array.isArray(prerequisites) ? prerequisites.length : 1,
      evaluationPassed,
      hasJsonLogicTraces: false,
      hasEvaluationContext: false
    };

    // Extract JSON Logic traces if available
    if (enhancedTrace._jsonLogicTraces && enhancedTrace._jsonLogicTraces.length > 0) {
      details.hasJsonLogicTraces = true;
      details.jsonLogicTraces = enhancedTrace._jsonLogicTraces;
    }

    // Extract evaluation context if available
    if (enhancedTrace._evaluationContext) {
      details.hasEvaluationContext = true;
      details.evaluationContext = enhancedTrace._evaluationContext;
    }

    return details;
  }

  /**
   * Capture pre-evaluation stage data
   * 
   * @private
   */
  async #capturePreEvaluationData(trace, actor, candidateActions, actionContext, stageStartTime) {
    try {
      // This is general stage information, not action-specific
      const stageData = {
        stage: 'prerequisite_evaluation_start',
        actorId: actor.id,
        candidateActionCount: candidateActions.length,
        hasActionContext: !!actionContext,
        stageStartTime,
        timestamp: Date.now()
      };

      this.#logger.debug(
        'PrerequisiteEvaluationStage: Captured pre-evaluation data',
        stageData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture pre-evaluation data for tracing', error);
    }
  }

  /**
   * Capture prerequisite evaluation data for traced action
   * 
   * @private
   */
  async #capturePrerequisiteEvaluationData(trace, actionDef, actor, evaluationResult) {
    try {
      const traceData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        hasPrerequisites: evaluationResult.hasPrerequisites,
        prerequisiteCount: evaluationResult.prerequisites ? 
          (Array.isArray(evaluationResult.prerequisites) ? evaluationResult.prerequisites.length : 1) : 0,
        evaluationPassed: evaluationResult.passed,
        evaluationReason: evaluationResult.reason,
        evaluationTimeMs: evaluationResult.evaluationTime,
        timestamp: Date.now()
      };

      // Include prerequisites if present (filtered by verbosity in ActionAwareStructuredTrace)
      if (evaluationResult.prerequisites) {
        traceData.prerequisites = evaluationResult.prerequisites;
      }

      // Include evaluation details if available
      if (evaluationResult.evaluationDetails) {
        traceData.evaluationDetails = evaluationResult.evaluationDetails;
      }

      // Include error information if evaluation failed due to error
      if (evaluationResult.error) {
        traceData.error = evaluationResult.error;
        traceData.errorType = evaluationResult.errorType;
      }

      await trace.captureActionData('prerequisite_evaluation', actionDef.id, traceData);

      this.#logger.debug(
        `PrerequisiteEvaluationStage: Captured prerequisite data for action '${actionDef.id}'`,
        { 
          actionId: actionDef.id, 
          passed: evaluationResult.passed,
          hasPrerequisites: evaluationResult.hasPrerequisites,
          prerequisiteCount: traceData.prerequisiteCount
        }
      );

    } catch (error) {
      this.#logger.warn(
        `Failed to capture prerequisite evaluation data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture data for actions with no prerequisites
   * 
   * @private
   */
  async #captureNoPrerequisitesData(trace, actionDef, actor, result) {
    try {
      const traceData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        hasPrerequisites: false,
        evaluationPassed: true,
        evaluationReason: 'No prerequisites defined',
        evaluationTimeMs: result.evaluationTime,
        timestamp: Date.now()
      };

      await trace.captureActionData('prerequisite_evaluation', actionDef.id, traceData);

    } catch (error) {
      this.#logger.warn(
        `Failed to capture no-prerequisites data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture prerequisite evaluation error
   * 
   * @private
   */
  async #capturePrerequisiteError(trace, actionDef, actor, error) {
    try {
      const errorData = {
        stage: 'prerequisite_evaluation',
        actorId: actor.id,
        evaluationFailed: true,
        error: error.message,
        errorType: error.constructor.name,
        timestamp: Date.now()
      };

      await trace.captureActionData('prerequisite_evaluation', actionDef.id, errorData);

      this.#logger.debug(
        `PrerequisiteEvaluationStage: Captured prerequisite error for action '${actionDef.id}'`,
        { actionId: actionDef.id, error: error.message }
      );

    } catch (traceError) {
      this.#logger.warn(
        `Failed to capture prerequisite error data for action '${actionDef.id}'`,
        traceError
      );
    }
  }

  /**
   * Capture post-evaluation summary data
   * 
   * @private
   */
  async #capturePostEvaluationData(trace, actor, originalCount, passedCount, evaluationResults, stageStartTime) {
    try {
      const summaryData = {
        stage: 'prerequisite_evaluation_summary',
        actorId: actor.id,
        originalActionCount: originalCount,
        passedActionCount: passedCount,
        failedActionCount: originalCount - passedCount,
        evaluationSuccessRate: originalCount > 0 ? (passedCount / originalCount) : 1.0,
        stageDurationMs: Date.now() - stageStartTime,
        timestamp: Date.now()
      };

      // Add statistics about prerequisite types if available
      let actionsWithPrerequisites = 0;
      let actionsWithoutPrerequisites = 0;

      for (const [actionId, result] of evaluationResults) {
        if (result.hasPrerequisites) {
          actionsWithPrerequisites++;
        } else {
          actionsWithoutPrerequisites++;
        }
      }

      summaryData.actionsWithPrerequisites = actionsWithPrerequisites;
      summaryData.actionsWithoutPrerequisites = actionsWithoutPrerequisites;

      this.#logger.debug(
        'PrerequisiteEvaluationStage: Captured post-evaluation summary',
        summaryData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture post-evaluation summary for tracing', error);
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
      type: 'PrerequisiteEvaluationStage',
      hasPrerequisiteService: !!this.#prerequisiteService,
      supportsTracing: true
    };
  }
}

export default PrerequisiteEvaluationStage;
```

### Step 2: Create Prerequisite Analysis Utilities

Create `src/actions/tracing/prerequisiteAnalysisUtils.js`:

```javascript
/**
 * @file Utility functions for prerequisite analysis in action tracing
 */

/**
 * Analyze prerequisite structure and complexity
 * 
 * @param {Array|Object} prerequisites - Prerequisites to analyze
 * @returns {Object} Detailed prerequisite analysis
 */
export function analyzePrerequisiteStructure(prerequisites) {
  if (!prerequisites) {
    return {
      hasPrerequisites: false,
      complexity: 'none',
      count: 0,
      types: []
    };
  }

  const analysis = {
    hasPrerequisites: true,
    count: 0,
    types: [],
    complexity: 'simple',
    structure: 'unknown',
    nestedLevels: 0
  };

  if (Array.isArray(prerequisites)) {
    analysis.structure = 'array';
    analysis.count = prerequisites.length;
    
    // Analyze each prerequisite
    const complexityScores = [];
    prerequisites.forEach(prereq => {
      const prereqAnalysis = analyzePrerequisiteItem(prereq);
      analysis.types.push(prereqAnalysis.type);
      complexityScores.push(prereqAnalysis.complexityScore);
      analysis.nestedLevels = Math.max(analysis.nestedLevels, prereqAnalysis.nestedLevels);
    });

    // Determine overall complexity
    const avgComplexity = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length;
    analysis.complexity = getComplexityLevel(avgComplexity, analysis.nestedLevels);

  } else if (typeof prerequisites === 'object') {
    analysis.structure = 'object';
    analysis.count = 1;
    
    const prereqAnalysis = analyzePrerequisiteItem(prerequisites);
    analysis.types = [prereqAnalysis.type];
    analysis.complexity = getComplexityLevel(prereqAnalysis.complexityScore, prereqAnalysis.nestedLevels);
    analysis.nestedLevels = prereqAnalysis.nestedLevels;

  } else {
    analysis.structure = 'primitive';
    analysis.count = 1;
    analysis.types = [typeof prerequisites];
  }

  return analysis;
}

/**
 * Analyze individual prerequisite item
 * 
 * @private
 * @param {*} prereq - Prerequisite item to analyze
 * @returns {Object} Analysis of individual prerequisite
 */
function analyzePrerequisiteItem(prereq) {
  const analysis = {
    type: typeof prereq,
    complexityScore: 0,
    nestedLevels: 0
  };

  if (typeof prereq === 'object' && prereq !== null) {
    // Check if it's a JSON Logic expression
    if (isJsonLogicExpression(prereq)) {
      analysis.type = 'json-logic';
      analysis.complexityScore = calculateJsonLogicComplexity(prereq);
      analysis.nestedLevels = calculateNestedLevels(prereq);
    } else {
      analysis.type = 'object';
      analysis.complexityScore = Object.keys(prereq).length * 0.5;
      analysis.nestedLevels = calculateObjectNesting(prereq);
    }
  } else {
    analysis.complexityScore = 0.1; // Simple primitive
  }

  return analysis;
}

/**
 * Check if object is a JSON Logic expression
 * 
 * @private
 * @param {Object} obj - Object to check
 * @returns {boolean}
 */
function isJsonLogicExpression(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Common JSON Logic operators
  const jsonLogicOperators = [
    '==', '!=', '===', '!==', '>', '<', '>=', '<=',
    'and', 'or', 'not', '!',
    'if', 'in', 'var',
    '+', '-', '*', '/', '%',
    'map', 'filter', 'reduce', 'all', 'some', 'none',
    'merge', 'cat'
  ];

  return jsonLogicOperators.some(op => obj.hasOwnProperty(op));
}

/**
 * Calculate JSON Logic expression complexity
 * 
 * @private
 * @param {Object} expression - JSON Logic expression
 * @returns {number} Complexity score
 */
function calculateJsonLogicComplexity(expression) {
  let complexity = 1; // Base complexity

  for (const [operator, operand] of Object.entries(expression)) {
    // Operator complexity weights
    const operatorWeights = {
      '==': 1, '!=': 1, '===': 1, '!==': 1,
      '>': 1, '<': 1, '>=': 1, '<=': 1,
      'and': 2, 'or': 2, 'not': 1,
      'if': 3,
      'in': 2,
      'var': 0.5,
      '+': 1, '-': 1, '*': 1, '/': 1, '%': 1,
      'map': 4, 'filter': 4, 'reduce': 5,
      'all': 3, 'some': 3, 'none': 3
    };

    complexity += operatorWeights[operator] || 2; // Default weight for unknown operators

    // Add complexity for nested expressions
    if (Array.isArray(operand)) {
      operand.forEach(item => {
        if (typeof item === 'object' && item !== null && isJsonLogicExpression(item)) {
          complexity += calculateJsonLogicComplexity(item) * 0.8; // Nested expressions are weighted
        }
      });
    } else if (typeof operand === 'object' && operand !== null && isJsonLogicExpression(operand)) {
      complexity += calculateJsonLogicComplexity(operand) * 0.8;
    }
  }

  return complexity;
}

/**
 * Calculate nested levels in JSON Logic expression
 * 
 * @private
 * @param {Object} expression - JSON Logic expression
 * @returns {number} Maximum nesting depth
 */
function calculateNestedLevels(expression) {
  let maxDepth = 1;

  for (const operand of Object.values(expression)) {
    if (Array.isArray(operand)) {
      operand.forEach(item => {
        if (typeof item === 'object' && item !== null && isJsonLogicExpression(item)) {
          maxDepth = Math.max(maxDepth, 1 + calculateNestedLevels(item));
        }
      });
    } else if (typeof operand === 'object' && operand !== null && isJsonLogicExpression(operand)) {
      maxDepth = Math.max(maxDepth, 1 + calculateNestedLevels(operand));
    }
  }

  return maxDepth;
}

/**
 * Calculate object nesting depth
 * 
 * @private
 * @param {Object} obj - Object to analyze
 * @returns {number} Nesting depth
 */
function calculateObjectNesting(obj) {
  let maxDepth = 1;

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      maxDepth = Math.max(maxDepth, 1 + calculateObjectNesting(value));
    }
  }

  return maxDepth;
}

/**
 * Determine complexity level from score and nesting
 * 
 * @private
 * @param {number} score - Complexity score
 * @param {number} nesting - Nesting depth
 * @returns {string} Complexity level
 */
function getComplexityLevel(score, nesting) {
  if (score <= 1 && nesting <= 1) return 'simple';
  if (score <= 3 && nesting <= 2) return 'moderate';
  if (score <= 6 && nesting <= 3) return 'complex';
  return 'very-complex';
}

/**
 * Generate human-readable prerequisite report
 * 
 * @param {Object} analysis - Result from analyzePrerequisiteStructure
 * @returns {string} Human-readable report
 */
export function generatePrerequisiteReport(analysis) {
  if (!analysis.hasPrerequisites) {
    return 'No prerequisites defined - action available to all actors';
  }

  let report = `Prerequisite Analysis:\n`;
  report += `- Structure: ${analysis.structure}\n`;
  report += `- Count: ${analysis.count}\n`;
  report += `- Complexity: ${analysis.complexity}\n`;
  report += `- Nesting Levels: ${analysis.nestedLevels}\n`;

  if (analysis.types.length > 0) {
    const typeCounts = analysis.types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    report += `- Types: ${Object.entries(typeCounts).map(([type, count]) => `${type}(${count})`).join(', ')}\n`;
  }

  return report;
}

/**
 * Validate prerequisite trace data
 * 
 * @param {Object} traceData - Prerequisite trace data to validate
 * @returns {Object} Validation result
 */
export function validatePrerequisiteTraceData(traceData) {
  const issues = [];
  const warnings = [];

  if (!traceData.actorId) {
    issues.push('Missing actorId in prerequisite trace data');
  }

  if (typeof traceData.hasPrerequisites !== 'boolean') {
    issues.push('hasPrerequisites must be a boolean');
  }

  if (typeof traceData.evaluationPassed !== 'boolean') {
    issues.push('evaluationPassed must be a boolean');
  }

  if (traceData.hasPrerequisites && !traceData.prerequisites) {
    warnings.push('Action marked as having prerequisites but no prerequisite data provided');
  }

  if (traceData.evaluationDetails) {
    if (typeof traceData.evaluationDetails.prerequisiteCount !== 'number') {
      warnings.push('evaluationDetails.prerequisiteCount should be a number');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Extract prerequisite failure reasons from evaluation details
 * 
 * @param {Object} evaluationDetails - Detailed evaluation results
 * @returns {Array<string>} Array of failure reasons
 */
export function extractFailureReasons(evaluationDetails) {
  const reasons = [];

  if (!evaluationDetails || evaluationDetails.evaluationPassed) {
    return reasons;
  }

  if (evaluationDetails.jsonLogicTraces) {
    evaluationDetails.jsonLogicTraces.forEach((trace, index) => {
      if (trace.result === false) {
        reasons.push(`JSON Logic expression ${index + 1} evaluated to false`);
      }
    });
  }

  if (evaluationDetails.error) {
    reasons.push(`Evaluation error: ${evaluationDetails.error}`);
  }

  if (reasons.length === 0) {
    reasons.push('Prerequisites failed for unknown reason');
  }

  return reasons;
}
```

### Step 3: Enhance PrerequisiteService Integration

Create integration layer for better trace capture in `src/actions/tracing/prerequisiteServiceIntegration.js`:

```javascript
/**
 * @file Integration layer for PrerequisiteService with action tracing
 */

/**
 * Wrapper for PrerequisiteService that enhances trace capture
 */
export class TracingPrerequisiteServiceWrapper {
  #prerequisiteService;
  #logger;

  constructor({ prerequisiteService, logger }) {
    this.#prerequisiteService = prerequisiteService;
    this.#logger = logger;
  }

  /**
   * Enhanced evaluate method with improved trace capture
   * 
   * @param {Array|Object} prerequisites - Prerequisites to evaluate
   * @param {Object} actionDef - Action definition
   * @param {Object} actor - Actor entity
   * @param {Object} trace - Enhanced trace with capture capabilities
   * @returns {boolean} Evaluation result
   */
  evaluate(prerequisites, actionDef, actor, trace) {
    // Capture evaluation context if enhanced trace is available
    if (trace?.captureEvaluationContext) {
      const evaluationContext = this.#buildEvaluationContext(actionDef, actor);
      trace.captureEvaluationContext(evaluationContext);
    }

    // Delegate to original service
    const result = this.#prerequisiteService.evaluate(prerequisites, actionDef, actor, trace);

    // Capture JSON Logic traces if enhanced trace supports it
    if (trace?.captureJsonLogicTrace && this.#hasJsonLogicExpressions(prerequisites)) {
      this.#captureJsonLogicTraces(prerequisites, actionDef, actor, trace, result);
    }

    return result;
  }

  #buildEvaluationContext(actionDef, actor) {
    return {
      actionId: actionDef.id,
      actorId: actor.id,
      actorComponents: Array.from(actor.components?.keys() || []),
      timestamp: Date.now()
    };
  }

  #hasJsonLogicExpressions(prerequisites) {
    if (Array.isArray(prerequisites)) {
      return prerequisites.some(p => this.#isJsonLogicExpression(p));
    }
    return this.#isJsonLogicExpression(prerequisites);
  }

  #isJsonLogicExpression(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const jsonLogicOperators = [
      '==', '!=', '===', '!==', '>', '<', '>=', '<=',
      'and', 'or', 'not', '!', 'if', 'in', 'var'
    ];

    return jsonLogicOperators.some(op => obj.hasOwnProperty(op));
  }

  #captureJsonLogicTraces(prerequisites, actionDef, actor, trace, result) {
    try {
      const prereqArray = Array.isArray(prerequisites) ? prerequisites : [prerequisites];
      
      prereqArray.forEach((prereq, index) => {
        if (this.#isJsonLogicExpression(prereq)) {
          trace.captureJsonLogicTrace(
            prereq,
            { action: actionDef, actor },
            result,
            [`Prerequisite ${index + 1} evaluation`]
          );
        }
      });
    } catch (error) {
      this.#logger.warn('Failed to capture JSON Logic traces', error);
    }
  }
}
```

## Testing Requirements

### Unit Tests

#### Test File: `tests/unit/actions/pipeline/stages/prerequisiteEvaluationStage.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrerequisiteEvaluationStageTestBed } from '../../../../common/actions/pipeline/prerequisiteEvaluationStageTestBed.js';

describe('PrerequisiteEvaluationStage - Action Tracing Enhancement', () => {
  let testBed;

  beforeEach(() => {
    testBed = new PrerequisiteEvaluationStageTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Action Tracing Detection', () => {
    it('should detect ActionAwareStructuredTrace and enable prerequisite tracing', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:cast_spell']
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getActionTraceCaptures()).toHaveLength(1);
      expect(testBed.getActionTraceCaptures()[0].actionId).toBe('core:cast_spell');
    });

    it('should work normally with standard StructuredTrace', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'StructuredTrace'
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getActionTraceCaptures()).toHaveLength(0);
      expect(testBed.getTraceSteps()).toContain('Evaluated prerequisites');
    });
  });

  describe('Prerequisite Data Capture', () => {
    it('should capture detailed prerequisite data for traced actions', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:cast_spell'],
        actionDefinitions: [{
          id: 'core:cast_spell',
          prerequisites: [
            { '>=': [{ 'var': 'actor.mana' }, 10] },
            { '==': [{ 'var': 'actor.canCastMagic' }, true] }
          ]
        }],
        prerequisiteEvaluationResult: true
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      expect(captures).toHaveLength(1);

      const captureData = captures[0];
      expect(captureData.stage).toBe('prerequisite_evaluation');
      expect(captureData.data.hasPrerequisites).toBe(true);
      expect(captureData.data.prerequisiteCount).toBe(2);
      expect(captureData.data.evaluationPassed).toBe(true);
      expect(captureData.data.prerequisites).toBeDefined();
    });

    it('should capture actions with no prerequisites', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:look'],
        actionDefinitions: [{
          id: 'core:look'
          // No prerequisites
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.hasPrerequisites).toBe(false);
      expect(captureData.data.evaluationPassed).toBe(true);
      expect(captureData.data.evaluationReason).toBe('No prerequisites defined');
    });

    it('should capture prerequisite evaluation failures', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:cast_spell'],
        actionDefinitions: [{
          id: 'core:cast_spell',
          prerequisites: [{ '>=': [{ 'var': 'actor.mana' }, 100] }]
        }],
        prerequisiteEvaluationResult: false
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.evaluationPassed).toBe(false);
      expect(captureData.data.evaluationReason).toContain('prerequisites failed');
    });

    it('should capture JSON Logic evaluation details', async () => {
      const stage = testBed.createStageWithJsonLogicTrace();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:complex_action'],
        actionDefinitions: [{
          id: 'core:complex_action',
          prerequisites: [
            { 'and': [
              { '>=': [{ 'var': 'actor.level' }, 5] },
              { 'in': [{ 'var': 'actor.location' }, ['town', 'city']] }
            ]}
          ]
        }],
        prerequisiteEvaluationResult: true,
        includeJsonLogicTraces: true
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.evaluationDetails).toBeDefined();
      expect(captureData.data.evaluationDetails.hasJsonLogicTraces).toBe(true);
    });

    it('should capture performance timing information', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:test_action']
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(typeof captureData.data.evaluationTimeMs).toBe('number');
      expect(captureData.data.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle prerequisite service errors gracefully', async () => {
      const stage = testBed.createStageWithErrors();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:error_action'],
        prerequisiteServiceError: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true); // Stage should continue despite service errors
      
      const captures = testBed.getActionTraceCaptures();
      expect(captures[0].data.evaluationFailed).toBe(true);
      expect(captures[0].data.error).toBeTruthy();
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
      expect(testBed.getWarningLogs()).toContain('Failed to capture prerequisite');
    });

    it('should handle malformed prerequisite structures', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:malformed_action'],
        actionDefinitions: [{
          id: 'core:malformed_action',
          prerequisites: null // Malformed prerequisites
        }]
      });

      const result = await stage.executeInternal(context);
      expect(result.success).toBe(true);
    });
  });
});
```

#### Test Bed Extension: `tests/common/actions/pipeline/prerequisiteEvaluationStageTestBed.js`

```javascript
/**
 * Test bed for PrerequisiteEvaluationStage with action tracing support
 */

import PrerequisiteEvaluationStage from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';

export class PrerequisiteEvaluationStageTestBed {
  #instances = [];
  #mocks = new Map();
  #capturedActionTraces = [];

  createStage(options = {}) {
    const mockPrerequisiteService = this.createMockPrerequisiteService(options);
    const mockLogger = this.createMockLogger();

    const stage = new PrerequisiteEvaluationStage({
      prerequisiteService: mockPrerequisiteService,
      logger: mockLogger
    });

    this.#instances.push(stage);
    return stage;
  }

  createStageWithJsonLogicTrace() {
    // Create stage that captures JSON Logic trace data
    const mockService = this.createMockPrerequisiteService({
      captureJsonLogicTraces: true
    });
    
    return this.createStage({ prerequisiteService: mockService });
  }

  createStageWithErrors() {
    return this.createStage({ simulateErrors: true });
  }

  createContext(options = {}) {
    const {
      traceType = 'ActionAwareStructuredTrace',
      tracedActions = ['*'],
      actionDefinitions = [{ id: 'core:test_action' }],
      prerequisiteEvaluationResult = true,
      prerequisiteServiceError = false,
      traceCaptureFailure = false,
      includeJsonLogicTraces = false
    } = options;

    const mockActor = this.createMockActor();
    const mockTrace = this.createMockTrace(traceType, tracedActions, traceCaptureFailure);
    const mockActionContext = this.createMockActionContext();

    // Configure prerequisite service mock
    const prereqService = this.#mocks.get('prerequisiteService');
    if (prereqService) {
      if (prerequisiteServiceError) {
        prereqService.evaluate.mockImplementation(() => {
          throw new Error('Prerequisite service error');
        });
      } else {
        prereqService.evaluate.mockReturnValue(prerequisiteEvaluationResult);
      }
    }

    return {
      actor: mockActor,
      candidateActions: actionDefinitions,
      trace: mockTrace,
      actionContext: mockActionContext,
      data: {}
    };
  }

  createMockPrerequisiteService(options = {}) {
    const {
      simulateErrors = false,
      captureJsonLogicTraces = false
    } = options;

    const service = {
      evaluate: jest.fn().mockImplementation((prerequisites, actionDef, actor, trace) => {
        if (simulateErrors) {
          throw new Error('Mock prerequisite service error');
        }

        // Simulate JSON Logic trace capture if enhanced trace is provided
        if (captureJsonLogicTraces && trace?.captureJsonLogicTrace) {
          trace.captureJsonLogicTrace(
            prerequisites,
            { action: actionDef, actor },
            true,
            ['Mock JSON Logic evaluation steps']
          );
        }

        return true; // Default to passing evaluation
      })
    };

    this.#mocks.set('prerequisiteService', service);
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

      // Enhanced trace methods for prerequisite integration
      baseTrace.captureJsonLogicTrace = jest.fn();
      baseTrace.captureEvaluationContext = jest.fn();
    }

    this.#mocks.set('trace', baseTrace);
    return baseTrace;
  }

  createMockActor() {
    return {
      id: 'test-actor',
      components: new Map([
        ['core:position', { id: 'core:position' }],
        ['core:stats', { level: 5, mana: 50 }]
      ])
    };
  }

  createMockActionContext() {
    return {
      location: 'town',
      time: 'day',
      weather: 'clear'
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

  getActionTraceCaptures() {
    return this.#capturedActionTraces;
  }

  getTraceSteps() {
    const trace = this.#mocks.get('trace');
    return trace ? trace.step.mock.calls.map(call => call[0]) : [];
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

#### Test File: `tests/integration/actions/pipeline/prerequisiteEvaluationStageTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';

describe('PrerequisiteEvaluationStage - Action Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate with full action discovery pipeline', async () => {
    await testBed.setupFullPipeline({
      tracedActions: ['core:cast_spell'],
      verbosity: 'detailed'
    });

    const actor = testBed.createActorWithStats({ level: 10, mana: 100 });
    const result = await testBed.runActionDiscovery(actor);

    expect(result.success).toBe(true);
    
    const traceData = testBed.getActionTraceData();
    const spellActionTrace = traceData.get('core:cast_spell');
    
    expect(spellActionTrace).toBeDefined();
    expect(spellActionTrace.stages.prerequisite_evaluation).toBeDefined();
    
    const prereqStageData = spellActionTrace.stages.prerequisite_evaluation.data;
    expect(prereqStageData.hasPrerequisites).toBe(true);
    expect(prereqStageData.evaluationPassed).toBe(true);
    expect(prereqStageData.prerequisites).toBeDefined();
  });

  it('should capture JSON Logic evaluation traces in full pipeline', async () => {
    await testBed.setupFullPipelineWithJsonLogic({
      tracedActions: ['core:complex_action'],
      verbosity: 'verbose'
    });

    const actor = testBed.createActorWithComplexState();
    const result = await testBed.runActionDiscovery(actor);

    const traceData = testBed.getActionTraceData();
    const actionTrace = traceData.get('core:complex_action');
    const prereqData = actionTrace.stages.prerequisite_evaluation.data;
    
    expect(prereqData.evaluationDetails.hasJsonLogicTraces).toBe(true);
    expect(prereqData.evaluationDetails.jsonLogicTraces.length).toBeGreaterThan(0);
  });
});
```

## Acceptance Criteria

### Functional Acceptance Criteria

#### AC-012-01: Prerequisite Evaluation Tracing
- [ ] PrerequisiteEvaluationStage detects ActionAwareStructuredTrace and enables prerequisite tracing
- [ ] Stage captures detailed prerequisite data only for traced actions
- [ ] Captured data includes prerequisite definitions, evaluation context, and results
- [ ] JSON Logic evaluation traces are captured when available

#### AC-012-02: Prerequisite Data Accuracy
- [ ] Prerequisites are extracted correctly from various action definition formats
- [ ] Actions with no prerequisites are handled and traced appropriately  
- [ ] Complex JSON Logic expressions are analyzed and traced with detail
- [ ] Evaluation timing and performance metrics are captured accurately

#### AC-012-03: Error Handling and Robustness
- [ ] Prerequisite service errors are captured in trace data without breaking stage execution
- [ ] Malformed prerequisite structures are handled gracefully
- [ ] Trace capture failures don't prevent stage from continuing normal operation
- [ ] Stage continues processing remaining actions when individual evaluations fail

#### AC-012-04: Performance Requirements
- [ ] <2ms overhead per traced action during prerequisite evaluation
- [ ] No measurable performance impact when action tracing is disabled
- [ ] JSON Logic trace capture doesn't significantly slow evaluation process
- [ ] Memory usage remains stable during extensive prerequisite tracing

### Technical Acceptance Criteria

#### AC-012-05: Code Quality and Integration
- [ ] Prerequisite extraction logic handles various definition formats correctly
- [ ] JSON Logic integration captures detailed evaluation steps and context
- [ ] Error handling includes comprehensive logging with actionable information
- [ ] Code follows project patterns for service integration and dependency management

#### AC-012-06: Testing Coverage
- [ ] Unit tests cover prerequisite extraction for all supported formats
- [ ] JSON Logic integration tests verify trace capture functionality
- [ ] Integration tests confirm tracing works with PrerequisiteService
- [ ] Error handling tests cover service failures and malformed data

## Dependencies

### Technical Dependencies
- `src/actions/tracing/actionAwareStructuredTrace.js` - ACTTRA-009 (ActionAwareStructuredTrace class)
- `src/actions/pipeline/stages/PrerequisiteEvaluationStage.js` - Existing stage to enhance
- `src/actions/services/prerequisiteService.js` - Service for prerequisite evaluation
- `src/utils/validationUtils.js` - Input validation utilities

### Workflow Dependencies
- **ACTTRA-009**: ActionAwareStructuredTrace must be implemented for data capture
- **ACTTRA-010**: Enhanced ActionDiscoveryService provides action-aware trace context
- **ACTTRA-011**: ComponentFilteringStage integration for pipeline consistency

### Service Dependencies
- PrerequisiteService must be available and functional for evaluation
- JSON Logic evaluation capabilities within PrerequisiteService
- Existing trace integration patterns within PrerequisiteService

## Definition of Done

### Code Complete
- [ ] PrerequisiteEvaluationStage enhanced with action tracing capabilities
- [ ] Prerequisite analysis utilities created for complex prerequisite handling
- [ ] PrerequisiteService integration layer created for enhanced trace capture
- [ ] Error handling and logging implemented for all failure scenarios

### Testing Complete
- [ ] Unit tests written with >90% coverage for enhanced functionality
- [ ] Integration tests verify tracing works with actual PrerequisiteService
- [ ] JSON Logic tracing tests confirm detailed evaluation capture
- [ ] Performance tests validate overhead requirements

### Documentation Complete
- [ ] All enhanced methods have comprehensive JSDoc documentation
- [ ] Prerequisite analysis logic documented with examples
- [ ] JSON Logic integration patterns documented
- [ ] Performance characteristics and limitations documented

### Quality Assurance
- [ ] Code review completed by senior developer
- [ ] Integration with PrerequisiteService verified and tested
- [ ] Performance benchmarks meet requirements without degradation
- [ ] Error scenarios handle gracefully with appropriate logging and recovery

## Effort Estimation

### Development Tasks
- Stage enhancement implementation: **2.5 hours**
- Prerequisite analysis utilities: **2 hours**
- PrerequisiteService integration layer: **1.5 hours**
- JSON Logic trace capture: **1 hour**
- Error handling and logging: **1 hour**

### Testing Tasks
- Unit test implementation: **3 hours**
- Integration test development: **2 hours**
- JSON Logic tracing tests: **1.5 hours**
- Performance validation: **1 hour**

### Documentation Tasks
- JSDoc documentation: **1 hour**
- Prerequisite analysis documentation: **0.5 hours**

### Total Estimated Effort: **16 hours**

### Risk Factors
- **Medium Risk**: JSON Logic integration complexity may require additional time for comprehensive trace capture
- **Low Risk**: PrerequisiteService integration should be straightforward with existing patterns
- **Low Risk**: Performance requirements are achievable with efficient data processing

## Success Metrics

### Quantitative Metrics
- Unit test coverage ≥90% for enhanced functionality
- <2ms overhead per traced action
- Zero performance impact when tracing disabled
- JSON Logic trace capture accuracy 100% for supported expressions

### Qualitative Metrics
- Clear visibility into prerequisite evaluation decisions and failures
- Comprehensive JSON Logic evaluation traces for debugging complex conditions
- Robust error handling for various prerequisite formats and service failures
- Intuitive trace data structure for analyzing prerequisite logic

---

**Ticket Created**: 2025-01-06  
**Estimated Effort**: 16 hours  
**Complexity**: Medium  
**Priority**: High  
**Assignee**: TBD  
**Reviewer**: Senior Developer