# ACTTRA-016: Multi-Target Action Support

## Executive Summary

Implement comprehensive multi-target action support within the action tracing system, enabling detailed trace capture for actions that affect multiple entities, targets, or scope expressions simultaneously. This ticket focuses on capturing target resolution patterns, scope evaluation results, and multi-target processing workflows while maintaining optimal performance for complex target scenarios.

## Technical Requirements

### Core Objectives

- Support multi-target action tracing with comprehensive target resolution data
- Capture scope expression evaluation and target matching details
- Track target relationship mapping and dependency analysis
- Record multi-target processing performance and optimization metrics
- Provide detailed target validation and filtering trace data
- Support both static target lists and dynamic scope-based targeting
- Maintain efficient processing for large target sets

### Performance Requirements

- Efficient trace data collection for large target sets (>100 targets)
- Minimal memory overhead for multi-target trace data structures
- Optimized scope expression evaluation with trace capture
- Thread-safe multi-target processing with concurrent access support

### Compatibility Requirements

- Support all existing target resolution mechanisms
- Maintain compatibility with scope DSL expressions
- Work with legacy target formats and modern multi-target actions
- Preserve existing multi-target action processing behavior

## Architecture Design

### Multi-Target Tracing Strategy

The multi-target support will be implemented through enhanced tracing interfaces and specialized data structures:

```javascript
class MultiTargetTraceCapture {
  constructor({ scopeEvaluator, logger }) {
    this.scopeEvaluator = scopeEvaluator;
    this.logger = logger;
    this.targetProcessingStats = new Map();
  }

  captureTargetResolutionProcess(action, trace, resolutionContext) {
    const startTime = performance.now();

    // Capture initial target specification
    const targetSpec = this.analyzeTargetSpecification(action);

    // Process and trace target resolution
    const resolutionResults = this.traceTargetResolution(
      action,
      resolutionContext,
      trace
    );

    // Capture performance metrics
    const processingTime = performance.now() - startTime;

    return {
      targetSpecification: targetSpec,
      resolutionResults: resolutionResults,
      performanceMetrics: {
        processingTime: processingTime,
        targetCount: resolutionResults.resolvedTargets.length,
      },
    };
  }
}
```

### Target Resolution Data Structure

The system will capture comprehensive target resolution data:

```javascript
const multiTargetData = {
  stage: 'multi_target_resolution',
  timestamp: new Date().toISOString(),
  targetSpecification: {
    type: 'scope_expression|static_list|dynamic_query',
    specification: originalTargetSpec,
    expectedTargetTypes: targetTypes,
    scopeComplexity: complexityMetrics,
  },
  resolutionProcess: {
    scopeEvaluation: scopeEvaluationData,
    targetMatching: matchingResults,
    filtering: filteringResults,
    validation: validationResults,
  },
  resolvedTargets: {
    totalCount: targetCount,
    targetsByType: targetTypeBreakdown,
    targetRelationships: relationshipMap,
    targetMetadata: metadataCollection,
  },
  performance: {
    scopeEvaluationTime: evaluationMs,
    targetMatchingTime: matchingMs,
    totalResolutionTime: totalMs,
    memoryUsage: memoryBytes,
  },
};
```

## Implementation Steps

### Step 1: Create Multi-Target Trace Capture System

**File**: `src/actions/tracing/multiTarget/multiTargetTraceCapture.js`

```javascript
/**
 * @file Multi-target action tracing capture system
 */

import { validateDependency } from '../../../utils/validationUtils.js';

class MultiTargetTraceCapture {
  constructor({ scopeEvaluator, entityManager, logger }) {
    validateDependency(scopeEvaluator, 'IScopeEvaluator');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');

    this.scopeEvaluator = scopeEvaluator;
    this.entityManager = entityManager;
    this.logger = logger;

    this.targetProcessingStats = new Map();
    this.resolutionCache = new Map();
  }

  captureMultiTargetAction(action, trace, context) {
    const captureStartTime = performance.now();

    try {
      // Analyze target specification
      const targetSpec = this.analyzeTargetSpecification(action);

      // Capture target specification analysis
      trace.captureActionData('multi_target', 'target_specification', {
        actionId: action.id,
        specification: targetSpec,
        timestamp: new Date().toISOString(),
      });

      // Process target resolution with tracing
      const resolutionResults = this.traceTargetResolution(
        action,
        context,
        trace
      );

      // Capture target relationship analysis
      if (resolutionResults.resolvedTargets.length > 1) {
        const relationshipData = this.analyzeTargetRelationships(
          resolutionResults.resolvedTargets,
          trace
        );

        trace.captureActionData('multi_target', 'target_relationships', {
          actionId: action.id,
          relationships: relationshipData,
          timestamp: new Date().toISOString(),
        });
      }

      // Capture performance summary
      const totalCaptureTime = performance.now() - captureStartTime;
      trace.captureActionData('multi_target', 'capture_performance', {
        actionId: action.id,
        captureTime: totalCaptureTime,
        targetCount: resolutionResults.resolvedTargets.length,
        complexity: targetSpec.complexity,
        timestamp: new Date().toISOString(),
      });

      return resolutionResults;
    } catch (error) {
      trace.captureActionData('multi_target', 'capture_error', {
        actionId: action.id,
        error: error.message,
        stack: error.stack,
        captureTime: performance.now() - captureStartTime,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  analyzeTargetSpecification(action) {
    const specification = {
      actionId: action.id,
      targetingMethod: 'unknown',
      complexity: 'low',
      expectedTargetCount: 0,
      scopeExpressions: [],
      staticTargets: [],
      dynamicQueries: [],
    };

    // Analyze different targeting methods
    if (action.targets) {
      // Static target list
      specification.targetingMethod = 'static_list';
      specification.staticTargets = Array.isArray(action.targets)
        ? action.targets
        : [action.targets];
      specification.expectedTargetCount = specification.staticTargets.length;
      specification.complexity =
        specification.staticTargets.length > 10 ? 'medium' : 'low';
    }

    if (action.scope || action.targetScope) {
      // Scope-based targeting
      specification.targetingMethod = 'scope_expression';
      const scopeExpr = action.scope || action.targetScope;
      specification.scopeExpressions = Array.isArray(scopeExpr)
        ? scopeExpr
        : [scopeExpr];
      specification.complexity = this.evaluateScopeComplexity(
        specification.scopeExpressions
      );
    }

    if (action.targetQuery || action.dynamicTargets) {
      // Dynamic query-based targeting
      specification.targetingMethod = 'dynamic_query';
      specification.dynamicQueries = this.extractDynamicQueries(action);
      specification.complexity = 'high';
    }

    // Handle hybrid targeting (multiple methods)
    const methodCount = [
      specification.staticTargets.length > 0,
      specification.scopeExpressions.length > 0,
      specification.dynamicQueries.length > 0,
    ].filter(Boolean).length;

    if (methodCount > 1) {
      specification.targetingMethod = 'hybrid';
      specification.complexity = 'high';
    }

    return specification;
  }

  traceTargetResolution(action, context, trace) {
    const resolutionStartTime = performance.now();

    // Initialize resolution results
    const resolutionResults = {
      resolvedTargets: [],
      resolutionSteps: [],
      filteringResults: [],
      validationResults: [],
      performance: {},
    };

    // Process static targets
    if (action.targets) {
      const staticResults = this.traceStaticTargetResolution(
        action.targets,
        trace
      );
      resolutionResults.resolvedTargets.push(...staticResults.targets);
      resolutionResults.resolutionSteps.push(staticResults.step);
    }

    // Process scope-based targets
    if (action.scope || action.targetScope) {
      const scopeResults = this.traceScopeTargetResolution(
        action.scope || action.targetScope,
        context,
        trace
      );
      resolutionResults.resolvedTargets.push(...scopeResults.targets);
      resolutionResults.resolutionSteps.push(scopeResults.step);
    }

    // Process dynamic targets
    if (action.targetQuery || action.dynamicTargets) {
      const dynamicResults = this.traceDynamicTargetResolution(
        action,
        context,
        trace
      );
      resolutionResults.resolvedTargets.push(...dynamicResults.targets);
      resolutionResults.resolutionSteps.push(dynamicResults.step);
    }

    // Remove duplicates and validate
    const uniqueTargets = this.deduplicateTargets(
      resolutionResults.resolvedTargets
    );
    const validationResults = this.validateResolvedTargets(
      uniqueTargets,
      action,
      trace
    );

    resolutionResults.resolvedTargets = validationResults.validTargets;
    resolutionResults.validationResults = validationResults.results;

    // Capture performance metrics
    const totalResolutionTime = performance.now() - resolutionStartTime;
    resolutionResults.performance = {
      totalTime: totalResolutionTime,
      targetCount: resolutionResults.resolvedTargets.length,
      stepsExecuted: resolutionResults.resolutionSteps.length,
    };

    // Capture comprehensive resolution data
    trace.captureActionData('multi_target', 'target_resolution', {
      actionId: action.id,
      resolutionResults: {
        targetCount: resolutionResults.resolvedTargets.length,
        resolutionSteps: resolutionResults.resolutionSteps.length,
        performance: resolutionResults.performance,
      },
      timestamp: new Date().toISOString(),
    });

    return resolutionResults;
  }

  traceStaticTargetResolution(targets, trace) {
    const staticStartTime = performance.now();
    const staticTargets = Array.isArray(targets) ? targets : [targets];

    const resolvedTargets = [];
    const resolutionDetails = [];

    for (let i = 0; i < staticTargets.length; i++) {
      const target = staticTargets[i];
      const targetStartTime = performance.now();

      try {
        // Resolve target entity
        const resolvedTarget = this.resolveStaticTarget(target);

        if (resolvedTarget) {
          resolvedTargets.push(resolvedTarget);
          resolutionDetails.push({
            index: i,
            originalTarget: target,
            resolvedTarget: resolvedTarget.id,
            resolutionTime: performance.now() - targetStartTime,
            success: true,
          });
        } else {
          resolutionDetails.push({
            index: i,
            originalTarget: target,
            resolutionTime: performance.now() - targetStartTime,
            success: false,
            reason: 'target_not_found',
          });
        }
      } catch (error) {
        resolutionDetails.push({
          index: i,
          originalTarget: target,
          resolutionTime: performance.now() - targetStartTime,
          success: false,
          reason: 'resolution_error',
          error: error.message,
        });
      }
    }

    const stepData = {
      type: 'static_target_resolution',
      inputTargets: staticTargets,
      resolvedCount: resolvedTargets.length,
      resolutionDetails: resolutionDetails,
      processingTime: performance.now() - staticStartTime,
    };

    // Capture static resolution data
    trace.captureActionData('multi_target', 'static_resolution', {
      step: stepData,
      timestamp: new Date().toISOString(),
    });

    return {
      targets: resolvedTargets,
      step: stepData,
    };
  }

  traceScopeTargetResolution(scopeExpression, context, trace) {
    const scopeStartTime = performance.now();
    const scopeExpressions = Array.isArray(scopeExpression)
      ? scopeExpression
      : [scopeExpression];

    const allResolvedTargets = [];
    const evaluationDetails = [];

    for (let i = 0; i < scopeExpressions.length; i++) {
      const expr = scopeExpressions[i];
      const exprStartTime = performance.now();

      try {
        // Capture scope expression analysis
        const scopeAnalysis = this.analyzeScopeExpression(expr);

        // Evaluate scope expression
        const evaluationResult = this.scopeEvaluator.evaluate(expr, context);
        const scopeTargets = Array.isArray(evaluationResult)
          ? evaluationResult
          : [evaluationResult];

        allResolvedTargets.push(...scopeTargets.filter((t) => t));

        evaluationDetails.push({
          index: i,
          expression: expr,
          analysis: scopeAnalysis,
          resolvedCount: scopeTargets.length,
          evaluationTime: performance.now() - exprStartTime,
          success: true,
        });

        // Capture individual scope evaluation
        trace.captureActionData('multi_target', 'scope_evaluation', {
          expression: expr,
          analysis: scopeAnalysis,
          resolvedCount: scopeTargets.length,
          evaluationTime: performance.now() - exprStartTime,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        evaluationDetails.push({
          index: i,
          expression: expr,
          evaluationTime: performance.now() - exprStartTime,
          success: false,
          error: error.message,
        });
      }
    }

    const stepData = {
      type: 'scope_target_resolution',
      scopeExpressions: scopeExpressions,
      resolvedCount: allResolvedTargets.length,
      evaluationDetails: evaluationDetails,
      processingTime: performance.now() - scopeStartTime,
    };

    return {
      targets: allResolvedTargets,
      step: stepData,
    };
  }

  traceDynamicTargetResolution(action, context, trace) {
    const dynamicStartTime = performance.now();

    const query = action.targetQuery || action.dynamicTargets;
    const queryAnalysis = this.analyzeDynamicQuery(query);

    try {
      // Execute dynamic query with tracing
      const queryResults = this.executeDynamicQuery(query, context, trace);

      const stepData = {
        type: 'dynamic_target_resolution',
        query: query,
        analysis: queryAnalysis,
        resolvedCount: queryResults.length,
        processingTime: performance.now() - dynamicStartTime,
        success: true,
      };

      // Capture dynamic resolution data
      trace.captureActionData('multi_target', 'dynamic_resolution', {
        step: stepData,
        timestamp: new Date().toISOString(),
      });

      return {
        targets: queryResults,
        step: stepData,
      };
    } catch (error) {
      const stepData = {
        type: 'dynamic_target_resolution',
        query: query,
        analysis: queryAnalysis,
        processingTime: performance.now() - dynamicStartTime,
        success: false,
        error: error.message,
      };

      return {
        targets: [],
        step: stepData,
      };
    }
  }

  analyzeTargetRelationships(targets, trace) {
    if (targets.length < 2) {
      return { relationships: [], analysis: 'insufficient_targets' };
    }

    const relationshipStartTime = performance.now();
    const relationships = [];
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    // Analyze pairwise relationships
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const target1 = targets[i];
        const target2 = targets[j];

        const relationship = this.analyzeTargetPair(target1, target2);

        if (relationship.type !== 'none') {
          relationships.push({
            target1: target1.id,
            target2: target2.id,
            relationship: relationship,
          });
        }
      }
    }

    // Analyze group patterns
    const groupPatterns = this.analyzeTargetGroupPatterns(targets);

    const analysisResult = {
      relationships: relationships,
      groupPatterns: groupPatterns,
      analysisTime: performance.now() - relationshipStartTime,
      targetCount: targets.length,
      relationshipCount: relationships.length,
    };

    return analysisResult;
  }

  evaluateScopeComplexity(scopeExpressions) {
    let maxComplexity = 'low';

    for (const expr of scopeExpressions) {
      const complexity = this.analyzeScopeExpression(expr).complexity;

      if (complexity === 'high') {
        maxComplexity = 'high';
      } else if (complexity === 'medium' && maxComplexity === 'low') {
        maxComplexity = 'medium';
      }
    }

    return maxComplexity;
  }

  analyzeScopeExpression(expression) {
    const analysis = {
      expression: expression,
      complexity: 'low',
      operators: [],
      depthLevel: 0,
      estimatedTargets: 'unknown',
    };

    if (typeof expression === 'string') {
      // Simple string scope
      analysis.operators = this.extractScopeOperators(expression);
      analysis.depthLevel = this.calculateScopeDepth(expression);

      if (analysis.operators.length > 3 || analysis.depthLevel > 2) {
        analysis.complexity = 'medium';
      }

      if (
        analysis.operators.includes('[') ||
        analysis.operators.includes('{')
      ) {
        analysis.complexity = 'high';
      }
    } else if (typeof expression === 'object') {
      // Complex object-based scope
      analysis.complexity = 'high';
      analysis.operators = ['object_query'];
    }

    return analysis;
  }

  extractScopeOperators(expression) {
    const operators = [];
    const operatorRegex = /[.\[\]{}+|:]/g;
    let match;

    while ((match = operatorRegex.exec(expression)) !== null) {
      if (!operators.includes(match[0])) {
        operators.push(match[0]);
      }
    }

    return operators;
  }

  calculateScopeDepth(expression) {
    let depth = 0;
    let currentDepth = 0;

    for (const char of expression) {
      if (char === '[' || char === '{') {
        currentDepth++;
        depth = Math.max(depth, currentDepth);
      } else if (char === ']' || char === '}') {
        currentDepth--;
      }
    }

    return depth;
  }

  extractDynamicQueries(action) {
    const queries = [];

    if (action.targetQuery) {
      queries.push(action.targetQuery);
    }

    if (action.dynamicTargets) {
      if (Array.isArray(action.dynamicTargets)) {
        queries.push(...action.dynamicTargets);
      } else {
        queries.push(action.dynamicTargets);
      }
    }

    return queries;
  }

  analyzeDynamicQuery(query) {
    return {
      type: typeof query,
      complexity: 'high', // Dynamic queries are always considered high complexity
      estimatedExecutionTime: 'unknown',
      cacheability: this.assessQueryCacheability(query),
    };
  }

  assessQueryCacheability(query) {
    // Simple heuristic for query cacheability
    if (
      typeof query === 'string' &&
      !query.includes('random') &&
      !query.includes('time')
    ) {
      return 'high';
    }
    return 'low';
  }

  resolveStaticTarget(target) {
    // Delegate to entity manager for target resolution
    if (typeof target === 'string') {
      return this.entityManager.getEntity(target);
    } else if (target && target.id) {
      return this.entityManager.getEntity(target.id);
    }
    return null;
  }

  executeDynamicQuery(query, context, trace) {
    // Implementation would depend on the specific dynamic query system
    // This is a placeholder for the actual dynamic query execution
    const queryStartTime = performance.now();

    try {
      // Execute query (placeholder implementation)
      const results = [];

      trace.captureActionData('multi_target', 'dynamic_query_execution', {
        query: query,
        executionTime: performance.now() - queryStartTime,
        resultCount: results.length,
        timestamp: new Date().toISOString(),
      });

      return results;
    } catch (error) {
      trace.captureActionData('multi_target', 'dynamic_query_error', {
        query: query,
        error: error.message,
        executionTime: performance.now() - queryStartTime,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  deduplicateTargets(targets) {
    const seen = new Set();
    const unique = [];

    for (const target of targets) {
      const id = target?.id || target;
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(target);
      }
    }

    return unique;
  }

  validateResolvedTargets(targets, action, trace) {
    const validationStartTime = performance.now();
    const validTargets = [];
    const validationResults = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const validation = this.validateSingleTarget(target, action);

      validationResults.push({
        index: i,
        targetId: target?.id || 'unknown',
        valid: validation.valid,
        reasons: validation.reasons,
      });

      if (validation.valid) {
        validTargets.push(target);
      }
    }

    // Capture validation summary
    trace.captureActionData('multi_target', 'target_validation', {
      actionId: action.id,
      totalTargets: targets.length,
      validTargets: validTargets.length,
      invalidTargets: targets.length - validTargets.length,
      validationTime: performance.now() - validationStartTime,
      timestamp: new Date().toISOString(),
    });

    return {
      validTargets: validTargets,
      results: validationResults,
    };
  }

  validateSingleTarget(target, action) {
    const reasons = [];

    // Basic existence check
    if (!target) {
      reasons.push('target_null_or_undefined');
      return { valid: false, reasons };
    }

    // ID check
    if (!target.id) {
      reasons.push('missing_target_id');
      return { valid: false, reasons };
    }

    // Type compatibility check (if action specifies target types)
    if (action.targetTypes && !action.targetTypes.includes(target.type)) {
      reasons.push('incompatible_target_type');
      return { valid: false, reasons };
    }

    return { valid: true, reasons: [] };
  }

  analyzeTargetPair(target1, target2) {
    // Analyze relationship between two targets
    const relationship = {
      type: 'none',
      strength: 0,
      details: {},
    };

    // Check for parent-child relationships
    if (target1.parent === target2.id || target2.parent === target1.id) {
      relationship.type = 'parent_child';
      relationship.strength = 0.8;
    }

    // Check for sibling relationships (same parent)
    else if (target1.parent && target1.parent === target2.parent) {
      relationship.type = 'sibling';
      relationship.strength = 0.6;
    }

    // Check for same type
    else if (target1.type === target2.type) {
      relationship.type = 'same_type';
      relationship.strength = 0.3;
    }

    return relationship;
  }

  analyzeTargetGroupPatterns(targets) {
    const patterns = [];

    // Group by type
    const typeGroups = new Map();
    for (const target of targets) {
      const type = target.type || 'unknown';
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type).push(target);
    }

    // Identify type patterns
    for (const [type, group] of typeGroups.entries()) {
      if (group.length > 1) {
        patterns.push({
          type: 'type_grouping',
          targetType: type,
          count: group.length,
          percentage: (group.length / targets.length) * 100,
        });
      }
    }

    // Group by parent
    const parentGroups = new Map();
    for (const target of targets) {
      const parent = target.parent || 'none';
      if (!parentGroups.has(parent)) {
        parentGroups.set(parent, []);
      }
      parentGroups.get(parent).push(target);
    }

    // Identify parent patterns
    for (const [parent, group] of parentGroups.entries()) {
      if (group.length > 1 && parent !== 'none') {
        patterns.push({
          type: 'parent_grouping',
          parent: parent,
          count: group.length,
          percentage: (group.length / targets.length) * 100,
        });
      }
    }

    return patterns;
  }
}

export default MultiTargetTraceCapture;
```

### Step 2: Integrate Multi-Target Support into ActionAwareStructuredTrace

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * Enhanced ActionAwareStructuredTrace with multi-target support
 */

import { StructuredTrace } from '../../tracing/structuredTrace.js';
import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import MultiTargetTraceCapture from './multiTarget/multiTargetTraceCapture.js';

class ActionAwareStructuredTrace extends StructuredTrace {
  constructor({
    traceId,
    verbosity = 'basic',
    scopeEvaluator,
    entityManager,
    logger,
  }) {
    super({ traceId });

    assertNonBlankString(verbosity, 'Verbosity level');
    validateDependency(scopeEvaluator, 'IScopeEvaluator');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');

    this.verbosity = verbosity;
    this.actionData = {};

    // Initialize multi-target support
    this.multiTargetCapture = new MultiTargetTraceCapture({
      scopeEvaluator,
      entityManager,
      logger,
    });

    this.logger = logger;
  }

  isMultiTargetAction(action) {
    // Determine if action involves multiple targets
    const hasMultipleStaticTargets =
      Array.isArray(action.targets) && action.targets.length > 1;
    const hasScopeExpression = !!(action.scope || action.targetScope);
    const hasDynamicTargets = !!(action.targetQuery || action.dynamicTargets);
    const hasTargetTypes =
      Array.isArray(action.targetTypes) && action.targetTypes.length > 1;

    return (
      hasMultipleStaticTargets ||
      hasScopeExpression ||
      hasDynamicTargets ||
      hasTargetTypes
    );
  }

  captureMultiTargetProcessing(action, context) {
    if (!this.isMultiTargetAction(action)) {
      return null;
    }

    const multiTargetStartTime = performance.now();

    try {
      // Use multi-target capture system
      const results = this.multiTargetCapture.captureMultiTargetAction(
        action,
        this,
        context
      );

      // Capture high-level multi-target summary
      this.captureActionData('multi_target', 'processing_summary', {
        actionId: action.id,
        totalTargets: results.resolvedTargets.length,
        resolutionSteps: results.resolutionSteps.length,
        processingTime: performance.now() - multiTargetStartTime,
        success: true,
        timestamp: new Date().toISOString(),
      });

      return results;
    } catch (error) {
      this.captureActionData('multi_target', 'processing_error', {
        actionId: action.id,
        error: error.message,
        processingTime: performance.now() - multiTargetStartTime,
        success: false,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  getMultiTargetData() {
    return this.actionData.multi_target || {};
  }

  getTargetResolutionSummary() {
    const multiTargetData = this.getMultiTargetData();

    const summary = {
      totalActionsProcessed: 0,
      totalTargetsResolved: 0,
      resolutionMethods: {},
      averageTargetsPerAction: 0,
      averageResolutionTime: 0,
    };

    // Analyze processing summaries
    const processingSummaries = multiTargetData.processing_summary || [];
    summary.totalActionsProcessed = processingSummaries.length;

    let totalTargets = 0;
    let totalProcessingTime = 0;

    processingSummaries.forEach((summary_data) => {
      if (summary_data.success) {
        totalTargets += summary_data.totalTargets;
        totalProcessingTime += summary_data.processingTime;
      }
    });

    summary.totalTargetsResolved = totalTargets;
    summary.averageTargetsPerAction =
      summary.totalActionsProcessed > 0
        ? totalTargets / summary.totalActionsProcessed
        : 0;
    summary.averageResolutionTime =
      summary.totalActionsProcessed > 0
        ? totalProcessingTime / summary.totalActionsProcessed
        : 0;

    // Analyze resolution methods
    const targetSpecifications = multiTargetData.target_specification || [];
    targetSpecifications.forEach((spec) => {
      const method = spec.specification.targetingMethod;
      summary.resolutionMethods[method] =
        (summary.resolutionMethods[method] || 0) + 1;
    });

    return summary;
  }

  // Multi-target specific verbosity filtering
  captureActionData(category, type, data) {
    // Apply multi-target specific verbosity filtering
    if (
      category === 'multi_target' &&
      !this.shouldCaptureMultiTargetData(type)
    ) {
      return;
    }

    super.captureActionData(category, type, data);
  }

  shouldCaptureMultiTargetData(type) {
    switch (this.verbosity) {
      case 'minimal':
        return ['processing_summary', 'processing_error'].includes(type);
      case 'basic':
        return [
          'processing_summary',
          'processing_error',
          'target_specification',
          'target_resolution',
        ].includes(type);
      case 'detailed':
        return true; // Capture all multi-target data
      default:
        return true;
    }
  }
}

export { ActionAwareStructuredTrace };
```

### Step 3: Enhanced Multi-Target Tests

**File**: `tests/unit/actions/tracing/multiTarget/multiTargetTraceCapture.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MultiTargetTraceCapture from '../../../../../src/actions/tracing/multiTarget/multiTargetTraceCapture.js';

describe('MultiTargetTraceCapture', () => {
  let capture;
  let mockScopeEvaluator;
  let mockEntityManager;
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    mockScopeEvaluator = {
      evaluate: jest.fn(),
    };

    mockEntityManager = {
      getEntity: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTrace = {
      captureActionData: jest.fn(),
    };

    capture = new MultiTargetTraceCapture({
      scopeEvaluator: mockScopeEvaluator,
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Target Specification Analysis', () => {
    it('should analyze static target lists', () => {
      const action = {
        id: 'multi-static',
        targets: ['target1', 'target2', 'target3'],
      };

      const spec = capture.analyzeTargetSpecification(action);

      expect(spec.targetingMethod).toBe('static_list');
      expect(spec.expectedTargetCount).toBe(3);
      expect(spec.complexity).toBe('low');
      expect(spec.staticTargets).toEqual(['target1', 'target2', 'target3']);
    });

    it('should analyze scope expression targets', () => {
      const action = {
        id: 'multi-scope',
        scope: 'actor.followers[].items[{"==": [{"var": "type"}, "weapon"]}]',
      };

      const spec = capture.analyzeTargetSpecification(action);

      expect(spec.targetingMethod).toBe('scope_expression');
      expect(spec.complexity).toBe('high');
      expect(spec.scopeExpressions).toEqual([action.scope]);
    });

    it('should analyze dynamic query targets', () => {
      const action = {
        id: 'multi-dynamic',
        targetQuery: { type: 'character', location: 'forest' },
      };

      const spec = capture.analyzeTargetSpecification(action);

      expect(spec.targetingMethod).toBe('dynamic_query');
      expect(spec.complexity).toBe('high');
      expect(spec.dynamicQueries).toHaveLength(1);
    });

    it('should detect hybrid targeting methods', () => {
      const action = {
        id: 'multi-hybrid',
        targets: ['target1'],
        scope: 'actor.followers[]',
      };

      const spec = capture.analyzeTargetSpecification(action);

      expect(spec.targetingMethod).toBe('hybrid');
      expect(spec.complexity).toBe('high');
    });
  });

  describe('Target Resolution Tracing', () => {
    it('should trace static target resolution', () => {
      const targets = ['entity1', 'entity2'];

      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        type: 'character',
      }));

      const result = capture.traceStaticTargetResolution(targets, mockTrace);

      expect(result.targets).toHaveLength(2);
      expect(result.step.type).toBe('static_target_resolution');
      expect(result.step.resolvedCount).toBe(2);
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'multi_target',
        'static_resolution',
        expect.any(Object)
      );
    });

    it('should trace scope target resolution', () => {
      const scopeExpression = 'actor.followers[]';
      const context = { actor: { id: 'player' } };

      mockScopeEvaluator.evaluate.mockReturnValue([
        { id: 'follower1', type: 'character' },
        { id: 'follower2', type: 'character' },
      ]);

      const result = capture.traceScopeTargetResolution(
        scopeExpression,
        context,
        mockTrace
      );

      expect(result.targets).toHaveLength(2);
      expect(result.step.type).toBe('scope_target_resolution');
      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'multi_target',
        'scope_evaluation',
        expect.any(Object)
      );
    });

    it('should handle scope evaluation errors gracefully', () => {
      const scopeExpression = 'invalid.scope[]';
      const context = {};

      mockScopeEvaluator.evaluate.mockRejectedValue(new Error('Invalid scope'));

      const result = capture.traceScopeTargetResolution(
        scopeExpression,
        context,
        mockTrace
      );

      expect(result.targets).toHaveLength(0);
      expect(result.step.evaluationDetails[0].success).toBe(false);
    });
  });

  describe('Target Relationship Analysis', () => {
    it('should analyze parent-child relationships', () => {
      const targets = [
        { id: 'parent1', type: 'character' },
        { id: 'child1', type: 'character', parent: 'parent1' },
        { id: 'child2', type: 'character', parent: 'parent1' },
      ];

      const relationships = capture.analyzeTargetRelationships(
        targets,
        mockTrace
      );

      expect(relationships.relationships).toHaveLength(2); // parent-child + sibling
      expect(relationships.relationships[0].relationship.type).toBe(
        'parent_child'
      );
      expect(relationships.relationships[1].relationship.type).toBe('sibling');
    });

    it('should identify group patterns', () => {
      const targets = [
        { id: 'char1', type: 'character' },
        { id: 'char2', type: 'character' },
        { id: 'item1', type: 'item' },
        { id: 'item2', type: 'item' },
        { id: 'item3', type: 'item' },
      ];

      const relationships = capture.analyzeTargetRelationships(
        targets,
        mockTrace
      );

      expect(relationships.groupPatterns).toHaveLength(2);
      expect(relationships.groupPatterns[0].type).toBe('type_grouping');
      expect(relationships.groupPatterns[0].targetType).toBe('character');
      expect(relationships.groupPatterns[1].targetType).toBe('item');
    });
  });

  describe('Scope Expression Analysis', () => {
    it('should analyze simple scope expressions', () => {
      const expression = 'actor.items[]';

      const analysis = capture.analyzeScopeExpression(expression);

      expect(analysis.complexity).toBe('low');
      expect(analysis.operators).toContain('.');
      expect(analysis.operators).toContain('[');
      expect(analysis.depthLevel).toBe(1);
    });

    it('should analyze complex scope expressions', () => {
      const expression =
        'actor.followers[].items[{"==": [{"var": "type"}, "weapon"]}]';

      const analysis = capture.analyzeScopeExpression(expression);

      expect(analysis.complexity).toBe('high');
      expect(analysis.operators).toContain('{');
      expect(analysis.depthLevel).toBeGreaterThan(1);
    });

    it('should handle object-based scope expressions', () => {
      const expression = { type: 'character', location: 'forest' };

      const analysis = capture.analyzeScopeExpression(expression);

      expect(analysis.complexity).toBe('high');
      expect(analysis.operators).toContain('object_query');
    });
  });

  describe('Target Validation', () => {
    it('should validate resolved targets', () => {
      const targets = [
        { id: 'valid1', type: 'character' },
        { id: 'valid2', type: 'item' },
        null, // Invalid target
        { type: 'character' }, // Missing ID
      ];

      const action = { id: 'test-action' };

      const result = capture.validateResolvedTargets(
        targets,
        action,
        mockTrace
      );

      expect(result.validTargets).toHaveLength(2);
      expect(result.results).toHaveLength(4);
      expect(result.results[2].valid).toBe(false);
      expect(result.results[3].valid).toBe(false);
    });

    it('should check target type compatibility', () => {
      const targets = [
        { id: 'char1', type: 'character' },
        { id: 'item1', type: 'item' },
      ];

      const action = {
        id: 'test-action',
        targetTypes: ['character'], // Only allows characters
      };

      const result = capture.validateResolvedTargets(
        targets,
        action,
        mockTrace
      );

      expect(result.validTargets).toHaveLength(1);
      expect(result.results[1].valid).toBe(false);
      expect(result.results[1].reasons).toContain('incompatible_target_type');
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large target sets efficiently', () => {
      const largeTargetList = Array.from(
        { length: 200 },
        (_, i) => `target${i}`
      );
      const action = { id: 'large-action', targets: largeTargetList };
      const context = {};

      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        type: 'entity',
      }));

      const startTime = performance.now();
      const result = capture.captureMultiTargetAction(
        action,
        mockTrace,
        context
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result.resolvedTargets.length).toBe(200);
    });
  });
});
```

## Testing Requirements

### Unit Tests Required

- [ ] MultiTargetTraceCapture target specification analysis
- [ ] Static target resolution tracing
- [ ] Scope expression target resolution tracing
- [ ] Dynamic target query resolution tracing
- [ ] Target relationship analysis
- [ ] Target validation with type checking
- [ ] Performance metrics capture
- [ ] Error handling for invalid targets

### Integration Tests Required

- [ ] End-to-end multi-target action processing
- [ ] Pipeline integration with multi-target actions
- [ ] Large-scale target resolution performance
- [ ] Mixed target resolution methods

### Performance Tests Required

- [ ] Scalability testing with large target sets (>100 targets)
- [ ] Memory usage analysis for multi-target data structures
- [ ] Scope expression evaluation performance
- [ ] Target relationship analysis performance

## Acceptance Criteria

### Functional Requirements

- [ ] All multi-target action types are properly detected and traced
- [ ] Target resolution captures comprehensive data for all resolution methods
- [ ] Scope expression evaluation is fully traced with performance metrics
- [ ] Target relationships are analyzed and captured
- [ ] Dynamic query execution is traced with error handling
- [ ] Target validation includes type compatibility checking

### Performance Requirements

- [ ] Efficient processing for large target sets (>100 targets)
- [ ] Memory efficient trace data structures
- [ ] Optimized scope expression evaluation with tracing
- [ ] Minimal overhead for single-target actions

### Quality Requirements

- [ ] 85% test coverage for multi-target functionality
- [ ] Comprehensive error handling for all target resolution paths
- [ ] Performance benchmarks for large target scenarios
- [ ] Clear trace data structure documentation

## Dependencies

### Prerequisite Tickets

- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)
- ACTTRA-013: MultiTargetResolutionStage integration (Pipeline Integration)

### Related Systems

- Scope evaluation system for scope expression tracing
- Entity manager for target resolution
- Action pipeline for multi-target processing
- Event bus for multi-target events

### External Dependencies

- Scope evaluator for scope expression processing
- Entity manager for target entity resolution
- ActionAwareStructuredTrace for trace capture

## Effort Estimation

**Total Effort: 18 hours**

- Multi-target capture system implementation: 8 hours
- ActionAwareStructuredTrace integration: 3 hours
- Target relationship analysis: 3 hours
- Unit tests: 3 hours
- Integration tests: 1 hour

## Implementation Notes

### Performance Considerations

- Optimized for large target sets with efficient data structures
- Target relationship analysis uses optimized algorithms
- Scope expression evaluation cached for repeated expressions
- Memory efficient trace data collection with data summarization

### Error Handling Strategy

- Graceful degradation when target resolution fails
- Comprehensive error context capture
- Continued processing when individual targets fail
- Event-driven error reporting for monitoring

### Scalability Design

- Efficient algorithms for target relationship analysis
- Optimized memory usage for large target collections
- Cached scope expression evaluation results
- Parallel processing support for independent target resolution

This ticket provides comprehensive multi-target action support within the action tracing system, capturing detailed target resolution data, relationship analysis, and performance metrics while maintaining optimal performance for complex targeting scenarios.
