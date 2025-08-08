# ACTTRA-016: Multi-Target Action Support

## Executive Summary

Enhance the existing action tracing system with comprehensive multi-target action support, enabling detailed trace capture for actions that affect multiple entities through the modern multi-target resolution system. This ticket focuses on extending `ActionAwareStructuredTrace` with multi-target capabilities while leveraging existing infrastructure from `MultiTargetResolutionStage` and `UnifiedScopeResolver`.

## Technical Requirements

### Core Objectives

- Enhance `ActionAwareStructuredTrace` with multi-target tracing capabilities
- Capture comprehensive target resolution data from `MultiTargetResolutionStage`
- Track scope expression evaluation via `UnifiedScopeResolver` integration
- Record multi-target processing performance and optimization metrics
- Provide detailed target validation and filtering trace data
- Support both legacy single-target and modern multi-target actions
- Maintain efficient processing for large target sets

### Performance Requirements

- Efficient trace data collection for large target sets (>100 targets)
- Minimal memory overhead for multi-target trace data structures
- Optimized scope expression evaluation with trace capture
- Leverage existing caching mechanisms in `UnifiedScopeResolver`

### Compatibility Requirements

- Build on existing `MultiTargetResolutionStage` infrastructure
- Integrate with `UnifiedScopeResolver` for scope evaluation
- Support legacy target formats via existing `LegacyTargetCompatibilityLayer`
- Preserve existing multi-target action processing behavior

## Architecture Design

### Multi-Target Tracing Strategy

The multi-target support will be implemented by enhancing the existing `ActionAwareStructuredTrace` class with multi-target capabilities, building on the infrastructure already present in `MultiTargetResolutionStage`:

```javascript
// Enhancement to ActionAwareStructuredTrace
class ActionAwareStructuredTrace extends StructuredTrace {
  // Existing constructor with actionTraceFilter, actorId, etc.
  
  // New multi-target methods
  isMultiTargetAction(action) {
    // Determine if action involves multiple targets
    const hasMultipleStaticTargets = 
      Array.isArray(action.targets) && action.targets.length > 1;
    const hasScopeExpression = !!(action.scope || action.targetScope);
    const hasDynamicTargets = !!(action.targetQuery || action.dynamicTargets);
    
    return hasMultipleStaticTargets || hasScopeExpression || hasDynamicTargets;
  }

  captureMultiTargetResolution(actionId, resolutionData) {
    // Capture comprehensive multi-target resolution data
    this.captureActionData('multi_target_resolution', actionId, {
      targetKeys: resolutionData.targetKeys,
      resolvedCounts: resolutionData.resolvedCounts,
      resolutionOrder: resolutionData.resolutionOrder,
      dependencies: resolutionData.dependencies,
      performanceMetrics: resolutionData.metrics,
      timestamp: Date.now(),
    });
  }

  captureTargetRelationships(actionId, relationships) {
    // Capture relationships between resolved targets
    this.captureActionData('target_relationships', actionId, {
      relationships: relationships,
      analysisTime: relationships.analysisTime,
      patterns: relationships.patterns,
      timestamp: Date.now(),
    });
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

### Step 1: Enhance ActionAwareStructuredTrace with Multi-Target Support

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * @file Enhanced ActionAwareStructuredTrace with multi-target support
 */

import { StructuredTrace } from './structuredTrace.js';
import ActionTraceFilter from './actionTraceFilter.js';
import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

class ActionAwareStructuredTrace extends StructuredTrace {
  // ... existing constructor and fields ...

  /**
   * Check if an action uses multi-target resolution
   * @param {object} action - Action definition
   * @returns {boolean}
   */
  isMultiTargetAction(action) {
    // Check for modern multi-target format
    if (action.targets && typeof action.targets === 'object' && 
        !Array.isArray(action.targets)) {
      return true;
    }
    
    // Check for scope-based targeting (can resolve to multiple)
    if (action.scope || action.targetScope) {
      return true;
    }
    
    // Check for dynamic targets
    if (action.targetQuery || action.dynamicTargets) {
      return true;
    }
    
    // Legacy single target or no targets
    return false;
  }

  /**
   * Capture multi-target resolution data
   * @param {string} actionId - Action ID
   * @param {object} resolutionData - Resolution data from MultiTargetResolutionStage
   */
  captureMultiTargetResolution(actionId, resolutionData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'multi_target_resolution',
      targetKeys: resolutionData.targetKeys || [],
      resolvedCounts: resolutionData.resolvedCounts || {},
      totalTargets: resolutionData.totalTargets || 0,
      resolutionOrder: resolutionData.resolutionOrder || [],
      hasContextDependencies: resolutionData.hasContextDependencies || false,
      resolutionTimeMs: resolutionData.resolutionTimeMs || 0,
      timestamp: Date.now(),
    };

    this.captureActionData('multi_target_resolution', actionId, traceData);
  }

  /**
   * Capture scope evaluation details
   * @param {string} actionId - Action ID
   * @param {string} targetKey - Target placeholder key
   * @param {object} evaluationData - Scope evaluation data
   */
  captureScopeEvaluation(actionId, targetKey, evaluationData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'scope_evaluation',
      targetKey,
      scope: evaluationData.scope,
      context: evaluationData.context,
      resultCount: evaluationData.resultCount || 0,
      evaluationTimeMs: evaluationData.evaluationTimeMs || 0,
      cacheHit: evaluationData.cacheHit || false,
      error: evaluationData.error,
      timestamp: Date.now(),
    };

    this.captureActionData('scope_evaluation', actionId, traceData);
  }

  /**
   * Capture target relationship analysis
   * @param {string} actionId - Action ID
   * @param {object} relationshipData - Analyzed relationships
   */
  captureTargetRelationships(actionId, relationshipData) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    const traceData = {
      stage: 'target_relationships',
      totalTargets: relationshipData.totalTargets || 0,
      relationships: relationshipData.relationships || [],
      patterns: relationshipData.patterns || [],
      analysisTimeMs: relationshipData.analysisTimeMs || 0,
      timestamp: Date.now(),
    };

    this.captureActionData('target_relationships', actionId, traceData);
  }

  /**
   * Get multi-target summary for a traced action
   * @param {string} actionId - Action ID
   * @returns {object|null} Multi-target summary or null
   */
  getMultiTargetSummary(actionId) {
    const actionTrace = this.getActionTrace(actionId);
    if (!actionTrace) {
      return null;
    }

    const summary = {
      isMultiTarget: false,
      targetKeys: [],
      totalTargets: 0,
      resolutionTimeMs: 0,
      scopeEvaluations: [],
      hasRelationships: false,
    };

    // Check for multi-target resolution data
    const multiTargetStage = actionTrace.stages['multi_target_resolution'];
    if (multiTargetStage && multiTargetStage.data) {
      summary.isMultiTarget = true;
      summary.targetKeys = multiTargetStage.data.targetKeys || [];
      summary.totalTargets = multiTargetStage.data.totalTargets || 0;
      summary.resolutionTimeMs = multiTargetStage.data.resolutionTimeMs || 0;
    }

    // Check for scope evaluations
    const scopeStage = actionTrace.stages['scope_evaluation'];
    if (scopeStage && scopeStage.data) {
      summary.scopeEvaluations.push(scopeStage.data);
    }

    // Check for relationship data
    const relationshipStage = actionTrace.stages['target_relationships'];
    if (relationshipStage && relationshipStage.data) {
      summary.hasRelationships = true;
      summary.relationshipCount = relationshipStage.data.relationships?.length || 0;
    }

    return summary;
  }

}

export default ActionAwareStructuredTrace;
```

### Step 2: Update MultiTargetResolutionStage Integration

**File**: `src/actions/pipeline/stages/MultiTargetResolutionStage.js` (Enhancement)

The existing `MultiTargetResolutionStage` already has some tracing support. We need to enhance it to use the new multi-target methods:

```javascript
// Enhanced tracing integration in MultiTargetResolutionStage
async #resolveMultiTargets(context, trace) {
  const { actionDef, actor, actionContext } = context;
  const targetDefs = actionDef.targets;
  const resolutionStartTime = Date.now();

  // ... existing validation logic ...

  // Get resolution order based on dependencies
  const resolutionOrder = this.#dependencyResolver.getResolutionOrder(targetDefs);
  
  // Check if trace supports multi-target capture
  const isActionAwareTrace = trace && typeof trace.captureMultiTargetResolution === 'function';
  
  if (isActionAwareTrace) {
    // Capture multi-target resolution data
    trace.captureMultiTargetResolution(actionDef.id, {
      targetKeys: Object.keys(targetDefs),
      resolutionOrder,
      hasContextDependencies: resolutionOrder.some(key => targetDefs[key].contextFrom),
      resolutionTimeMs: 0, // Will be updated after resolution
    });
  }
  
  // Resolve targets sequentially in dependency order
  const resolvedTargets = {};
  const resolvedCounts = {};
  
  for (const targetKey of resolutionOrder) {
    const targetDef = targetDefs[targetKey];
    const scopeStartTime = Date.now();
    
    // Build scope context (using existing methods)
    const scopeContext = targetDef.contextFrom 
      ? this.#contextBuilder.buildScopeContextForSpecificPrimary(/*...*/)
      : this.#contextBuilder.buildScopeContext(/*...*/);
    
    // Resolve scope using UnifiedScopeResolver
    const candidates = await this.#unifiedScopeResolver.resolve(
      targetDef.scope,
      scopeContext,
      { useCache: true }
    );
    
    resolvedTargets[targetKey] = Array.from(candidates.value || []);
    resolvedCounts[targetKey] = resolvedTargets[targetKey].length;
    
    // Capture scope evaluation if trace supports it
    if (isActionAwareTrace && trace.captureScopeEvaluation) {
      trace.captureScopeEvaluation(actionDef.id, targetKey, {
        scope: targetDef.scope,
        context: targetDef.contextFrom || 'actor',
        resultCount: resolvedCounts[targetKey],
        evaluationTimeMs: Date.now() - scopeStartTime,
        cacheHit: candidates.metadata?.cacheHit || false,
      });
    }
  }
  
  // Update final resolution time
  if (isActionAwareTrace) {
    trace.captureMultiTargetResolution(actionDef.id, {
      targetKeys: Object.keys(targetDefs),
      resolvedCounts,
      totalTargets: Object.values(resolvedCounts).reduce((sum, count) => sum + count, 0),
      resolutionOrder,
      hasContextDependencies: resolutionOrder.some(key => targetDefs[key].contextFrom),
      resolutionTimeMs: Date.now() - resolutionStartTime,
    });
  }
  
  // ... continue with existing logic to create actionsWithTargets ...
}
```

### Step 3: Create Tests for Multi-Target Support

**File**: `tests/unit/actions/tracing/actionAwareStructuredTrace.test.js` (Enhancement)

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
describe('ActionAwareStructuredTrace - Multi-Target Support', () => {
  let trace;
  let mockFilter;
  
  beforeEach(() => {
    mockFilter = new ActionTraceFilter({
      enabled: true,
      actionIds: ['test:action'],
      verbosity: 'detailed'
    });
    
    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: mockFilter,
      actorId: 'test-actor',
      context: {},
      logger: console
    });
  });
  
  describe('isMultiTargetAction', () => {
    it('should identify modern multi-target actions', () => {
      const action = {
        id: 'test:action',
        targets: {
          primary: { scope: 'actor', placeholder: 'target' },
          secondary: { scope: 'location', placeholder: 'location' }
        }
      };
      
      expect(trace.isMultiTargetAction(action)).toBe(true);
    });
    
    it('should identify scope-based actions as potentially multi-target', () => {
      const action = {
        id: 'test:action',
        scope: 'actor.followers[]'
      };
      
      expect(trace.isMultiTargetAction(action)).toBe(true);
    });
    
    it('should identify legacy single-target actions', () => {
      const action = {
        id: 'test:action',
        targets: 'self'
      };
      
      expect(trace.isMultiTargetAction(action)).toBe(false);
    });
  });
  
  describe('captureMultiTargetResolution', () => {
    it('should capture multi-target resolution data', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');
      
      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary'],
        resolvedCounts: { primary: 3, secondary: 2 },
        totalTargets: 5,
        resolutionOrder: ['primary', 'secondary'],
        hasContextDependencies: false,
        resolutionTimeMs: 150
      });
      
      expect(captureDataSpy).toHaveBeenCalledWith(
        'multi_target_resolution',
        'test:action',
        expect.objectContaining({
          stage: 'multi_target_resolution',
          targetKeys: ['primary', 'secondary'],
          totalTargets: 5
        })
      );
    });
  });
  
  describe('captureScopeEvaluation', () => {
    it('should capture scope evaluation details', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');
      
      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor.followers[]',
        context: 'actor',
        resultCount: 3,
        evaluationTimeMs: 50,
        cacheHit: true
      });
      
      expect(captureDataSpy).toHaveBeenCalledWith(
        'scope_evaluation',
        'test:action',
        expect.objectContaining({
          stage: 'scope_evaluation',
          targetKey: 'primary',
          resultCount: 3,
          cacheHit: true
        })
      );
    });
  });
  
  describe('getMultiTargetSummary', () => {
    it('should return multi-target summary for traced action', () => {
      // First capture some multi-target data
      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary'],
        resolvedCounts: { primary: 3, secondary: 2 },
        totalTargets: 5,
        resolutionOrder: ['primary', 'secondary'],
        hasContextDependencies: false,
        resolutionTimeMs: 150
      });
      
      const summary = trace.getMultiTargetSummary('test:action');
      
      expect(summary).toEqual(expect.objectContaining({
        isMultiTarget: true,
        targetKeys: ['primary', 'secondary'],
        totalTargets: 5,
        resolutionTimeMs: 150
      }));
    });
    
    it('should return null for non-traced action', () => {
      const summary = trace.getMultiTargetSummary('unknown:action');
      expect(summary).toBeNull();
    });
  });
});
```

## Testing Requirements

### Unit Tests Required

- [ ] ActionAwareStructuredTrace multi-target detection methods
- [ ] Multi-target resolution data capture
- [ ] Scope evaluation tracing
- [ ] Target relationship analysis
- [ ] Multi-target summary generation
- [ ] Integration with MultiTargetResolutionStage
- [ ] Performance metrics capture
- [ ] Error handling for invalid targets

### Integration Tests Required

- [ ] End-to-end multi-target action processing with tracing
- [ ] Pipeline integration with enhanced tracing
- [ ] Large-scale target resolution performance
- [ ] Mixed legacy and modern target formats

### Performance Tests Required

- [ ] Scalability testing with large target sets (>100 targets)
- [ ] Memory usage analysis for trace data structures
- [ ] Scope expression evaluation performance with caching
- [ ] Trace data collection overhead measurement

## Acceptance Criteria

### Functional Requirements

- [ ] Multi-target actions are properly detected via `isMultiTargetAction` method
- [ ] Target resolution data is captured through enhanced trace methods
- [ ] Scope evaluation details are traced with performance metrics
- [ ] Integration with existing `MultiTargetResolutionStage` is seamless
- [ ] Both legacy and modern target formats are supported
- [ ] Trace data is properly filtered based on verbosity levels

### Performance Requirements

- [ ] Efficient trace capture for large target sets (>100 targets)
- [ ] Minimal memory overhead for trace data structures  
- [ ] Leverages existing caching in UnifiedScopeResolver
- [ ] Trace capture adds <5% overhead to resolution time

### Quality Requirements

- [ ] 85% test coverage for new multi-target methods
- [ ] Comprehensive error handling for trace capture failures
- [ ] Performance benchmarks for large target scenarios
- [ ] Clear documentation of trace data structure

## Dependencies

### Prerequisite Work

- ACTTRA-009: ActionAwareStructuredTrace class (Complete)
- ACTTRA-013: MultiTargetResolutionStage (Complete)
- UnifiedScopeResolver implementation (Complete)
- LegacyTargetCompatibilityLayer (Complete)

### Related Systems

- `MultiTargetResolutionStage` for target resolution
- `UnifiedScopeResolver` for scope evaluation
- `ActionTraceFilter` for trace filtering
- `TargetContextBuilder` for context creation
- `TargetDependencyResolver` for resolution ordering

### External Dependencies

- `validateDependency` from `utils/dependencyUtils.js`
- `string` utilities from `utils/validationCore.js`
- `ensureValidLogger` from `utils/loggerUtils.js`

## Effort Estimation

**Total Effort: 8 hours**

- Enhance ActionAwareStructuredTrace with multi-target methods: 3 hours
- Update MultiTargetResolutionStage integration: 2 hours
- Create comprehensive unit tests: 2 hours
- Integration testing and performance validation: 1 hour

## Implementation Notes

### Key Differences from Original Design

1. **No New Subdirectory**: Instead of creating `multiTarget/multiTargetTraceCapture.js`, we enhance the existing `ActionAwareStructuredTrace` class directly
2. **Use UnifiedScopeResolver**: Instead of a generic `IScopeEvaluator`, use the actual `UnifiedScopeResolver` service
3. **Leverage Existing Infrastructure**: Build on existing multi-target support in `MultiTargetResolutionStage`
4. **Simpler Integration**: Add methods to existing class rather than creating new complex hierarchies

### Performance Considerations

- Trace capture is conditional based on `ActionTraceFilter.shouldTrace()`
- Leverages existing caching mechanisms in `UnifiedScopeResolver`
- Minimal overhead through efficient data structures
- Verbosity-based filtering reduces unnecessary data capture

### Error Handling Strategy

- Trace capture failures should not break the pipeline
- Log warnings for trace failures but continue processing
- Graceful degradation when trace methods are unavailable
- Comprehensive error context in trace data

This corrected workflow provides a realistic and implementable approach for adding multi-target action support to the existing action tracing system, building on the current codebase infrastructure rather than creating parallel structures.
