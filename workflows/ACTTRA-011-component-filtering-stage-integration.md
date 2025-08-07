# ACTTRA-011: ComponentFilteringStage Integration for Action Tracing

## Executive Summary

### Problem Statement
The ComponentFilteringStage currently filters actions based on actor component requirements but doesn't capture detailed data about the filtering process for debugging purposes. We need to integrate action tracing to capture component matching decisions, requirements checking, and filtering results for traced actions.

### Solution Approach
Enhance the ComponentFilteringStage to detect action-aware traces and capture detailed component filtering data when tracing is enabled. The integration will be transparent and non-intrusive, only activating when an ActionAwareStructuredTrace is provided and the action is configured for tracing.

### Business Value
- Provides visibility into why certain actions are available or filtered out
- Enables debugging of component requirement issues
- Shows component matching logic for actor capability analysis
- Helps identify action availability problems in complex scenarios

## Technical Requirements

### Functional Requirements

#### FR-011-01: Action Tracing Detection
- Must detect when trace parameter is an ActionAwareStructuredTrace
- Must check if specific actions are being traced before capturing data
- Must work transparently with existing StructuredTrace instances
- Must not affect stage performance when tracing is disabled

#### FR-011-02: Component Data Capture
- Must capture actor component lists for traced actions
- Must capture required component lists from action definitions
- Must capture component matching results (pass/fail)
- Must capture component filtering decisions and reasoning

#### FR-011-03: Filtering Metadata Collection
- Must capture candidate action count before and after filtering
- Must capture filtering stage timing information
- Must include stage-specific context and actor information
- Must capture component availability vs requirements comparison

#### FR-011-04: Data Structure Consistency
- Must use consistent data structure with other pipeline stages
- Must respect verbosity levels for data filtering
- Must handle missing or null component data gracefully
- Must integrate with ActionAwareStructuredTrace.captureActionData API

### Non-Functional Requirements

#### NFR-011-01: Performance
- <1ms overhead per traced action during component filtering
- No performance impact when action tracing is disabled
- Efficient component data extraction and formatting
- Minimal memory footprint for captured data

#### NFR-011-02: Reliability
- Must not affect existing component filtering logic
- Must handle trace capture errors gracefully
- Must continue stage execution even if tracing fails
- Must maintain existing error handling patterns

#### NFR-011-03: Maintainability
- Must preserve existing ComponentFilteringStage structure
- Must use consistent logging and error handling patterns
- Must follow project naming and code organization conventions
- Must include comprehensive inline documentation

## Architecture Design

### Current ComponentFilteringStage Flow
```
executeInternal(context) 
  ↓
ActionIndex.getCandidateActions(actor, trace)
  ↓
Filter actions based on component requirements
  ↓
Return filtered candidate actions
```

### Enhanced Flow with Action Tracing
```
executeInternal(context)
  ↓
Detect if trace is ActionAwareStructuredTrace
  ↓
ActionIndex.getCandidateActions(actor, trace)
  ↓  
For each candidate action:
  - Check if action should be traced
  - Capture component filtering data if tracing enabled
  - Apply existing filtering logic
  - Capture filtering results
  ↓
Return filtered candidate actions with tracing data captured
```

### Data Capture Points

#### Pre-Filtering Capture
- Actor ID and available components
- Total candidate action count
- Stage start timing

#### Per-Action Capture  
- Action ID being evaluated
- Required components from action definition
- Component matching evaluation
- Pass/fail result with reasoning

#### Post-Filtering Capture
- Final filtered action count
- Stage completion timing
- Summary statistics

## Implementation Steps

### Step 1: Enhance ComponentFilteringStage

Modify `src/actions/pipeline/stages/ComponentFilteringStage.js`:

```javascript
/**
 * @file ComponentFilteringStage - Enhanced with action tracing capabilities
 */

import { validateDependency, assertPresent } from '../../../utils/validationUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import PipelineResult from '../pipelineResult.js';

/**
 * Pipeline stage that filters actions based on actor component requirements
 * Enhanced with detailed action tracing for debugging component filtering decisions
 */
class ComponentFilteringStage {
  #actionIndex;
  #logger;
  #name = 'ComponentFiltering';

  constructor({ actionIndex, logger }) {
    validateDependency(actionIndex, 'IActionIndex', null, {
      requiredMethods: ['getCandidateActions']
    });
    this.#logger = ensureValidLogger(logger, 'ComponentFilteringStage');
    this.#actionIndex = actionIndex;
  }

  get name() {
    return this.#name;
  }

  /**
   * Execute component filtering stage with enhanced action tracing
   * 
   * @param {Object} context - Pipeline context
   * @param {Object} context.actor - Actor entity with components
   * @param {Object} context.trace - Trace context (may be ActionAwareStructuredTrace)
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context) {
    const { actor, trace } = context;
    const source = `${this.name}Stage.execute`;
    const stageStartTime = Date.now();

    assertPresent(actor, 'Actor is required for component filtering');
    assertPresent(actor.id, 'Actor must have an ID');

    try {
      this.#logger.debug(
        `ComponentFilteringStage: Starting component filtering for actor ${actor.id}`,
        { actorId: actor.id, actorComponentCount: actor.components?.size || 0 }
      );

      // Check if we have action-aware tracing capability
      const isActionAwareTrace = this.#isActionAwareTrace(trace);
      
      if (isActionAwareTrace) {
        this.#logger.debug(
          `ComponentFilteringStage: Action tracing enabled for actor ${actor.id}`,
          { actorId: actor.id, traceType: 'ActionAwareStructuredTrace' }
        );
      }

      // Get candidate actions from the index
      const candidateActions = this.#actionIndex.getCandidateActions(actor, trace);

      this.#logger.debug(
        `ComponentFilteringStage: Retrieved ${candidateActions.length} candidate actions`,
        { actorId: actor.id, candidateCount: candidateActions.length }
      );

      // Capture pre-filtering data for action tracing
      if (isActionAwareTrace) {
        await this.#capturePreFilteringData(trace, actor, candidateActions, stageStartTime);
      }

      // Process each candidate action with tracing if enabled
      const processedActions = [];
      for (const actionDef of candidateActions) {
        try {
          const processingResult = await this.#processActionWithTracing(
            actionDef, 
            actor, 
            trace, 
            isActionAwareTrace
          );
          
          if (processingResult.include) {
            processedActions.push(actionDef);
          }
        } catch (error) {
          this.#logger.error(
            `ComponentFilteringStage: Error processing action '${actionDef.id}'`,
            error
          );
          // Continue processing other actions
        }
      }

      // Capture post-filtering summary
      if (isActionAwareTrace) {
        await this.#capturePostFilteringData(
          trace, 
          actor, 
          candidateActions.length, 
          processedActions.length,
          stageStartTime
        );
      }

      // Existing trace logging for backward compatibility
      trace?.step(
        `Filtering actions for actor ${actor.id} based on components`,
        source
      );

      this.#logger.info(
        `ComponentFilteringStage: Filtered ${candidateActions.length} → ${processedActions.length} actions for actor ${actor.id}`,
        { 
          actorId: actor.id, 
          originalCount: candidateActions.length, 
          filteredCount: processedActions.length,
          stageDuration: Date.now() - stageStartTime
        }
      );

      return PipelineResult.success({
        data: { ...context.data, candidateActions: processedActions }
      });

    } catch (error) {
      this.#logger.error(
        `ComponentFilteringStage: Failed to filter actions for actor ${actor.id}`,
        error
      );

      return PipelineResult.failure(
        `Component filtering failed for actor ${actor.id}`,
        { originalError: error.message, stageDuration: Date.now() - stageStartTime }
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
   * Process single action with component filtering and optional tracing
   * 
   * @private
   * @param {Object} actionDef - Action definition to process
   * @param {Object} actor - Actor entity
   * @param {Object} trace - Trace context
   * @param {boolean} isActionAwareTrace - Whether trace supports action data capture
   * @returns {Promise<Object>} Processing result with include flag
   */
  async #processActionWithTracing(actionDef, actor, trace, isActionAwareTrace) {
    const processingStartTime = Date.now();
    
    try {
      // Extract component requirements from action definition
      const requiredComponents = this.#extractRequiredComponents(actionDef);
      const actorComponents = this.#extractActorComponents(actor);
      
      // Perform component matching logic
      const componentMatchResult = this.#evaluateComponentRequirements(
        actorComponents, 
        requiredComponents
      );

      // Capture detailed tracing data if enabled and action is traced
      if (isActionAwareTrace && trace.captureActionData) {
        await this.#captureActionComponentData(
          trace, 
          actionDef, 
          actor, 
          {
            requiredComponents,
            actorComponents,
            componentMatchResult,
            processingTime: Date.now() - processingStartTime
          }
        );
      }

      return {
        include: componentMatchResult.passed,
        reason: componentMatchResult.reason,
        processingTime: Date.now() - processingStartTime
      };

    } catch (error) {
      this.#logger.error(
        `Error processing component requirements for action '${actionDef.id}'`,
        error
      );

      // Capture error in trace if available
      if (isActionAwareTrace && trace.captureActionData) {
        await this.#captureActionComponentError(trace, actionDef, actor, error);
      }

      return {
        include: false,
        reason: `Component evaluation error: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Extract required components from action definition
   * 
   * @private
   * @param {Object} actionDef - Action definition
   * @returns {Array<string>} Required component IDs
   */
  #extractRequiredComponents(actionDef) {
    // Handle different action definition formats
    if (actionDef.requiredComponents) {
      return Array.isArray(actionDef.requiredComponents) 
        ? actionDef.requiredComponents 
        : [actionDef.requiredComponents];
    }

    if (actionDef.components) {
      return Array.isArray(actionDef.components)
        ? actionDef.components
        : [actionDef.components];
    }

    // Some actions may have component requirements in prerequisites
    if (actionDef.prerequisites && Array.isArray(actionDef.prerequisites)) {
      const componentRequirements = actionDef.prerequisites
        .filter(prereq => prereq.type === 'component' || prereq.component)
        .map(prereq => prereq.component || prereq.value)
        .filter(Boolean);
      
      return componentRequirements;
    }

    return []; // No component requirements
  }

  /**
   * Extract actor components as array of component IDs
   * 
   * @private
   * @param {Object} actor - Actor entity
   * @returns {Array<string>} Actor component IDs
   */
  #extractActorComponents(actor) {
    if (!actor.components) {
      return [];
    }

    // Handle Map structure (common in ECS)
    if (actor.components instanceof Map) {
      return Array.from(actor.components.keys());
    }

    // Handle object structure
    if (typeof actor.components === 'object') {
      return Object.keys(actor.components);
    }

    // Handle array structure
    if (Array.isArray(actor.components)) {
      return actor.components.map(comp => 
        typeof comp === 'string' ? comp : comp.id || comp.type
      ).filter(Boolean);
    }

    this.#logger.warn(
      `Unexpected actor components structure for actor ${actor.id}`,
      { componentType: typeof actor.components }
    );

    return [];
  }

  /**
   * Evaluate if actor has required components for action
   * 
   * @private
   * @param {Array<string>} actorComponents - Components the actor has
   * @param {Array<string>} requiredComponents - Components the action requires
   * @returns {Object} Evaluation result with passed flag and reasoning
   */
  #evaluateComponentRequirements(actorComponents, requiredComponents) {
    // No requirements means action is available to all actors
    if (requiredComponents.length === 0) {
      return {
        passed: true,
        reason: 'No component requirements',
        missingComponents: [],
        hasComponents: actorComponents,
        requiredComponents: []
      };
    }

    // Check which required components are missing
    const actorComponentSet = new Set(actorComponents);
    const missingComponents = requiredComponents.filter(
      required => !actorComponentSet.has(required)
    );

    const passed = missingComponents.length === 0;

    return {
      passed,
      reason: passed 
        ? 'All required components present'
        : `Missing required components: ${missingComponents.join(', ')}`,
      missingComponents,
      hasComponents: actorComponents,
      requiredComponents
    };
  }

  /**
   * Capture pre-filtering data for action tracing
   * 
   * @private
   */
  async #capturePreFilteringData(trace, actor, candidateActions, stageStartTime) {
    try {
      // Capture general stage information - not action-specific
      const generalData = {
        stage: 'component_filtering',
        actorId: actor.id,
        candidateActionCount: candidateActions.length,
        actorComponentCount: this.#extractActorComponents(actor).length,
        stageStartTime,
        timestamp: Date.now()
      };

      // Log the general stage start - this won't be captured per-action
      this.#logger.debug(
        'ComponentFilteringStage: Captured pre-filtering data',
        generalData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture pre-filtering data for tracing', error);
    }
  }

  /**
   * Capture action-specific component filtering data
   * 
   * @private
   */
  async #captureActionComponentData(trace, actionDef, actor, processingData) {
    try {
      const {
        requiredComponents,
        actorComponents, 
        componentMatchResult,
        processingTime
      } = processingData;

      // Only capture if this action should be traced
      const actionTraceData = {
        stage: 'component_filtering',
        actorId: actor.id,
        actorComponents: [...actorComponents], // Clone array
        requiredComponents: [...requiredComponents], // Clone array
        componentMatchPassed: componentMatchResult.passed,
        componentMatchReason: componentMatchResult.reason,
        missingComponents: componentMatchResult.missingComponents || [],
        processingTimeMs: processingTime,
        timestamp: Date.now()
      };

      // Use ActionAwareStructuredTrace.captureActionData
      await trace.captureActionData('component_filtering', actionDef.id, actionTraceData);

      this.#logger.debug(
        `ComponentFilteringStage: Captured component data for action '${actionDef.id}'`,
        { 
          actionId: actionDef.id, 
          passed: componentMatchResult.passed,
          requiredCount: requiredComponents.length,
          actorComponentCount: actorComponents.length
        }
      );

    } catch (error) {
      this.#logger.warn(
        `Failed to capture component tracing data for action '${actionDef.id}'`,
        error
      );
    }
  }

  /**
   * Capture component evaluation error for action tracing
   * 
   * @private
   */
  async #captureActionComponentError(trace, actionDef, actor, error) {
    try {
      const errorData = {
        stage: 'component_filtering',
        actorId: actor.id,
        error: error.message,
        errorType: error.constructor.name,
        componentEvaluationFailed: true,
        timestamp: Date.now()
      };

      await trace.captureActionData('component_filtering', actionDef.id, errorData);

      this.#logger.debug(
        `ComponentFilteringStage: Captured component error for action '${actionDef.id}'`,
        { actionId: actionDef.id, error: error.message }
      );

    } catch (traceError) {
      this.#logger.warn(
        `Failed to capture component error tracing data for action '${actionDef.id}'`,
        traceError
      );
    }
  }

  /**
   * Capture post-filtering summary data
   * 
   * @private
   */
  async #capturePostFilteringData(trace, actor, originalCount, filteredCount, stageStartTime) {
    try {
      const summaryData = {
        stage: 'component_filtering_summary',
        actorId: actor.id,
        originalActionCount: originalCount,
        filteredActionCount: filteredCount,
        actionsFiltered: originalCount - filteredCount,
        filteringEfficiency: originalCount > 0 ? (filteredCount / originalCount) : 0,
        stageDurationMs: Date.now() - stageStartTime,
        timestamp: Date.now()
      };

      // This is stage-level summary, not action-specific
      // We could capture this for a special "summary" action if needed
      this.#logger.debug(
        'ComponentFilteringStage: Captured post-filtering summary',
        summaryData
      );

    } catch (error) {
      this.#logger.warn('Failed to capture post-filtering summary for tracing', error);
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
      type: 'ComponentFilteringStage',
      hasActionIndex: !!this.#actionIndex,
      supportsTracing: true
    };
  }
}

export default ComponentFilteringStage;
```

### Step 2: Create Component Analysis Utilities

Create `src/actions/tracing/componentAnalysisUtils.js`:

```javascript
/**
 * @file Utility functions for component analysis in action tracing
 */

/**
 * Analyze component compatibility between actor and action requirements
 * 
 * @param {Array<string>} actorComponents - Components the actor has
 * @param {Array<string>} requiredComponents - Components the action requires
 * @returns {Object} Detailed compatibility analysis
 */
export function analyzeComponentCompatibility(actorComponents, requiredComponents) {
  const actorSet = new Set(actorComponents);
  const requiredSet = new Set(requiredComponents);

  const hasRequired = [];
  const missingRequired = [];

  for (const required of requiredComponents) {
    if (actorSet.has(required)) {
      hasRequired.push(required);
    } else {
      missingRequired.push(required);
    }
  }

  const extraComponents = actorComponents.filter(comp => !requiredSet.has(comp));

  return {
    compatible: missingRequired.length === 0,
    hasRequired,
    missingRequired,
    extraComponents,
    compatibilityScore: requiredComponents.length > 0 
      ? hasRequired.length / requiredComponents.length 
      : 1.0,
    analysis: {
      totalRequired: requiredComponents.length,
      totalActorComponents: actorComponents.length,
      satisfiedRequirements: hasRequired.length,
      unsatisfiedRequirements: missingRequired.length,
      unusedComponents: extraComponents.length
    }
  };
}

/**
 * Generate human-readable component compatibility report
 * 
 * @param {Object} compatibility - Result from analyzeComponentCompatibility
 * @returns {string} Human-readable report
 */
export function generateCompatibilityReport(compatibility) {
  const { compatible, hasRequired, missingRequired, extraComponents, analysis } = compatibility;

  let report = `Component Compatibility: ${compatible ? 'PASS' : 'FAIL'}\n`;
  report += `Compatibility Score: ${(compatibility.compatibilityScore * 100).toFixed(1)}%\n\n`;

  if (analysis.totalRequired === 0) {
    report += 'No component requirements - action available to all actors\n';
    return report;
  }

  report += `Requirements Analysis:\n`;
  report += `- Total Required: ${analysis.totalRequired}\n`;
  report += `- Satisfied: ${analysis.satisfiedRequirements}\n`;
  report += `- Missing: ${analysis.unsatisfiedRequirements}\n\n`;

  if (hasRequired.length > 0) {
    report += `✓ Has Required Components:\n`;
    hasRequired.forEach(comp => {
      report += `  - ${comp}\n`;
    });
    report += '\n';
  }

  if (missingRequired.length > 0) {
    report += `✗ Missing Required Components:\n`;
    missingRequired.forEach(comp => {
      report += `  - ${comp}\n`;
    });
    report += '\n';
  }

  if (extraComponents.length > 0) {
    report += `ℹ Additional Actor Components:\n`;
    extraComponents.forEach(comp => {
      report += `  - ${comp}\n`;
    });
  }

  return report;
}

/**
 * Extract component requirements from various action definition formats
 * 
 * @param {Object} actionDef - Action definition object
 * @returns {Array<string>} Normalized list of required component IDs
 */
export function extractActionComponentRequirements(actionDef) {
  const requirements = [];

  // Direct component requirements
  if (actionDef.requiredComponents) {
    if (Array.isArray(actionDef.requiredComponents)) {
      requirements.push(...actionDef.requiredComponents);
    } else {
      requirements.push(actionDef.requiredComponents);
    }
  }

  // Alternative naming
  if (actionDef.components && actionDef.components !== actionDef.requiredComponents) {
    if (Array.isArray(actionDef.components)) {
      requirements.push(...actionDef.components);
    } else {
      requirements.push(actionDef.components);
    }
  }

  // From prerequisites
  if (actionDef.prerequisites && Array.isArray(actionDef.prerequisites)) {
    const componentPrereqs = actionDef.prerequisites
      .filter(prereq => prereq.type === 'component' || prereq.component)
      .map(prereq => prereq.component || prereq.value)
      .filter(Boolean);
    
    requirements.push(...componentPrereqs);
  }

  // Remove duplicates and filter out nullish values
  return [...new Set(requirements.filter(Boolean))];
}

/**
 * Validate component data for tracing
 * 
 * @param {Object} data - Component data to validate
 * @returns {Object} Validation result
 */
export function validateComponentTraceData(data) {
  const issues = [];
  const warnings = [];

  if (!data.actorId) {
    issues.push('Missing actorId in component trace data');
  }

  if (!Array.isArray(data.actorComponents)) {
    issues.push('actorComponents must be an array');
  } else if (data.actorComponents.some(comp => typeof comp !== 'string')) {
    warnings.push('Some actor components are not strings');
  }

  if (!Array.isArray(data.requiredComponents)) {
    issues.push('requiredComponents must be an array');
  } else if (data.requiredComponents.some(comp => typeof comp !== 'string')) {
    warnings.push('Some required components are not strings');
  }

  if (typeof data.componentMatchPassed !== 'boolean') {
    issues.push('componentMatchPassed must be a boolean');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}
```

### Step 3: Enhance ActionIndex Integration

Modify the ActionIndex integration to ensure proper tracing context:

```javascript
// Addition to src/actions/actionIndex.js (if modification is needed)

/**
 * Get candidate actions with enhanced tracing support
 * 
 * @param {Object} actor - Actor entity
 * @param {Object} trace - Trace context (may be ActionAwareStructuredTrace)
 * @returns {Array<Object>} Candidate action definitions
 */
getCandidateActions(actor, trace) {
  // Existing logic for getting candidate actions
  const candidates = this.#getCandidateActionsInternal(actor);

  // Enhanced logging for action-aware traces
  if (trace?.captureActionData && typeof trace.getTracingSummary === 'function') {
    const actorComponents = this.#extractActorComponents(actor);
    
    trace.step(
      `ActionIndex: Found ${candidates.length} candidate actions for actor with ${actorComponents.length} components`,
      'ActionIndex.getCandidateActions'
    );
  }

  return candidates;
}
```

## Testing Requirements

### Unit Tests

#### Test File: `tests/unit/actions/pipeline/stages/componentFilteringStage.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ComponentFilteringStageTestBed } from '../../../../common/actions/pipeline/componentFilteringStageTestBed.js';

describe('ComponentFilteringStage - Action Tracing Enhancement', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ComponentFilteringStageTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Action Tracing Detection', () => {
    it('should detect ActionAwareStructuredTrace and enable action tracing', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:go']
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getActionTraceCaptures()).toHaveLength(1);
      expect(testBed.getActionTraceCaptures()[0].actionId).toBe('core:go');
    });

    it('should work normally with standard StructuredTrace', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'StructuredTrace'
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getActionTraceCaptures()).toHaveLength(0);
      expect(testBed.getTraceSteps()).toContain('Filtering actions for actor');
    });

    it('should handle missing trace gracefully', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: null
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getActionTraceCaptures()).toHaveLength(0);
    });
  });

  describe('Component Data Capture', () => {
    it('should capture detailed component data for traced actions', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:go'],
        actorComponents: ['core:position', 'core:movement'],
        actionDefinitions: [{
          id: 'core:go',
          requiredComponents: ['core:position']
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      expect(captures).toHaveLength(1);

      const captureData = captures[0];
      expect(captureData.stage).toBe('component_filtering');
      expect(captureData.data.actorComponents).toEqual(['core:position', 'core:movement']);
      expect(captureData.data.requiredComponents).toEqual(['core:position']);
      expect(captureData.data.componentMatchPassed).toBe(true);
    });

    it('should capture missing component information', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:cast_spell'],
        actorComponents: ['core:position'],
        actionDefinitions: [{
          id: 'core:cast_spell',
          requiredComponents: ['core:position', 'core:magic']
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.componentMatchPassed).toBe(false);
      expect(captureData.data.missingComponents).toContain('core:magic');
      expect(captureData.data.componentMatchReason).toContain('Missing required components');
    });

    it('should capture performance timing information', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:go']
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(typeof captureData.data.processingTimeMs).toBe('number');
      expect(captureData.data.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof captureData.data.timestamp).toBe('number');
    });

    it('should only capture data for traced actions', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:go'], // Only trace 'go' action
        actionDefinitions: [
          { id: 'core:go', requiredComponents: [] },
          { id: 'core:look', requiredComponents: [] }
        ]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      expect(captures).toHaveLength(1);
      expect(captures[0].actionId).toBe('core:go');
    });
  });

  describe('Component Requirement Evaluation', () => {
    it('should correctly evaluate actions with no component requirements', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:look'],
        actorComponents: ['core:position'],
        actionDefinitions: [{
          id: 'core:look',
          requiredComponents: []
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.componentMatchPassed).toBe(true);
      expect(captureData.data.componentMatchReason).toBe('No component requirements');
    });

    it('should handle complex component requirement structures', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:complex_action'],
        actorComponents: ['core:position', 'core:inventory', 'core:magic'],
        actionDefinitions: [{
          id: 'core:complex_action',
          prerequisites: [
            { type: 'component', component: 'core:magic' },
            { type: 'other', value: 'something' }
          ]
        }]
      });

      await stage.executeInternal(context);

      const captures = testBed.getActionTraceCaptures();
      const captureData = captures[0];
      
      expect(captureData.data.requiredComponents).toContain('core:magic');
      expect(captureData.data.componentMatchPassed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle component evaluation errors gracefully', async () => {
      const stage = testBed.createStageWithErrorHandling();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:error_action'],
        actionDefinitions: [{
          id: 'core:error_action',
          requiredComponents: null // This should cause an error
        }],
        simulateComponentError: true
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true); // Stage should continue despite individual action errors
      
      const captures = testBed.getActionTraceCaptures();
      expect(captures[0].data.componentEvaluationFailed).toBe(true);
      expect(captures[0].data.error).toBeTruthy();
    });

    it('should continue processing when trace capture fails', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['core:go'],
        traceCaptureFailure: true // Simulate trace.captureActionData throwing
      });

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(testBed.getWarningLogs()).toContain('Failed to capture component tracing data');
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal performance impact when tracing is disabled', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'StructuredTrace', // Standard trace, no action tracing
        actionDefinitions: testBed.createLargeActionSet(100)
      });

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });

    it('should have acceptable performance impact when tracing is enabled', async () => {
      const stage = testBed.createStage();
      const context = testBed.createContext({
        traceType: 'ActionAwareStructuredTrace',
        tracedActions: ['*'], // Trace all actions
        actionDefinitions: testBed.createLargeActionSet(50)
      });

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(200); // Reasonable overhead
    });
  });
});
```

#### Test Bed Extension: `tests/common/actions/pipeline/componentFilteringStageTestBed.js`

```javascript
/**
 * Test bed for ComponentFilteringStage with action tracing support
 */

import ComponentFilteringStage from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';

export class ComponentFilteringStageTestBed {
  #instances = [];
  #mocks = new Map();
  #capturedActionTraces = [];

  createStage(options = {}) {
    const mockActionIndex = this.createMockActionIndex(options);
    const mockLogger = this.createMockLogger();

    const stage = new ComponentFilteringStage({
      actionIndex: mockActionIndex,
      logger: mockLogger
    });

    this.#instances.push(stage);
    return stage;
  }

  createContext(options = {}) {
    const {
      traceType = 'ActionAwareStructuredTrace',
      tracedActions = ['*'],
      actorComponents = ['core:position'],
      actionDefinitions = [{ id: 'core:go', requiredComponents: [] }],
      traceCaptureFailure = false,
      simulateComponentError = false
    } = options;

    const mockActor = this.createMockActor('test-actor', actorComponents);
    const mockTrace = this.createMockTrace(traceType, tracedActions, traceCaptureFailure);

    // Setup action index to return provided action definitions
    const actionIndex = this.#mocks.get('actionIndex');
    if (actionIndex) {
      actionIndex.getCandidateActions.mockReturnValue(
        simulateComponentError 
          ? [{ id: 'error_action', requiredComponents: null }]
          : actionDefinitions
      );
    }

    return {
      actor: mockActor,
      trace: mockTrace,
      data: {}
    };
  }

  createMockActor(actorId, components = []) {
    const componentsMap = new Map();
    components.forEach(comp => {
      componentsMap.set(comp, { id: comp, type: comp });
    });

    return {
      id: actorId,
      components: componentsMap
    };
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

        // Check if this action should be traced
        const shouldTrace = tracedActions.includes('*') || tracedActions.includes(actionId);
        if (shouldTrace) {
          this.#capturedActionTraces.push({
            stage,
            actionId,
            data: { ...data }
          });
        }
      });

      baseTrace.getTracingSummary = jest.fn().mockReturnValue({
        tracedActionCount: 1,
        totalStagesTracked: 1
      });
    }

    this.#mocks.set('trace', baseTrace);
    return baseTrace;
  }

  createMockActionIndex(options = {}) {
    const actionIndex = {
      getCandidateActions: jest.fn().mockReturnValue([
        { id: 'core:go', requiredComponents: ['core:position'] },
        { id: 'core:look', requiredComponents: [] }
      ])
    };

    this.#mocks.set('actionIndex', actionIndex);
    return actionIndex;
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
      requiredComponents: i % 3 === 0 ? ['core:position'] : []
    }));
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

#### Test File: `tests/integration/actions/pipeline/componentFilteringStageTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';

describe('ComponentFilteringStage - Action Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate with full action discovery pipeline', async () => {
    await testBed.setupFullPipeline({
      tracedActions: ['core:go'],
      verbosity: 'detailed'
    });

    const actor = testBed.createActorWithComponents(['core:position', 'core:movement']);
    const result = await testBed.runActionDiscovery(actor);

    expect(result.success).toBe(true);
    
    const traceData = testBed.getActionTraceData();
    const goActionTrace = traceData.get('core:go');
    
    expect(goActionTrace).toBeDefined();
    expect(goActionTrace.stages.component_filtering).toBeDefined();
    
    const componentStageData = goActionTrace.stages.component_filtering.data;
    expect(componentStageData.actorComponents).toContain('core:position');
    expect(componentStageData.componentMatchPassed).toBe(true);
  });

  it('should work with ActionDiscoveryService enhancement', async () => {
    const discoveryService = await testBed.createEnhancedDiscoveryService({
      tracedActions: ['core:go', 'core:look'],
      verbosity: 'standard'
    });

    const actor = testBed.createActorWithComponents(['core:position']);
    const result = await discoveryService.getValidActions(actor, {}, { trace: true });

    expect(result.success).toBe(true);
    
    // Should have captured component filtering data
    const actionTraceData = testBed.extractActionTraceData(result);
    expect(actionTraceData.size).toBeGreaterThan(0);

    for (const [actionId, actionTrace] of actionTraceData) {
      if (actionTrace.stages.component_filtering) {
        expect(actionTrace.stages.component_filtering.data.actorId).toBe(actor.id);
        expect(Array.isArray(actionTrace.stages.component_filtering.data.actorComponents)).toBe(true);
      }
    }
  });
});
```

## Acceptance Criteria

### Functional Acceptance Criteria

#### AC-011-01: Action Tracing Integration
- [ ] ComponentFilteringStage detects ActionAwareStructuredTrace and enables action tracing
- [ ] Stage captures detailed component data only for traced actions
- [ ] Stage works transparently with standard StructuredTrace instances
- [ ] Captured data includes actor components, required components, and matching results

#### AC-011-02: Component Data Accuracy
- [ ] Actor components are extracted correctly from various entity structures (Map, Object, Array)
- [ ] Required components are extracted from action definitions including prerequisites
- [ ] Component matching logic correctly identifies missing requirements
- [ ] Performance timing data is captured for each action evaluation

#### AC-011-03: Error Handling
- [ ] Component evaluation errors are captured in trace data without breaking stage execution
- [ ] Trace capture failures don't prevent stage from continuing
- [ ] Invalid component data is handled gracefully with appropriate logging
- [ ] Stage continues processing remaining actions when individual actions fail

#### AC-011-04: Performance Requirements
- [ ] <1ms overhead per traced action during component filtering
- [ ] No measurable performance impact when action tracing is disabled
- [ ] Stage processes large action sets (100+ actions) efficiently with tracing enabled
- [ ] Memory usage remains stable during extensive tracing sessions

### Technical Acceptance Criteria

#### AC-011-05: Code Quality
- [ ] All component extraction methods handle various data structures correctly
- [ ] Trace data capture follows consistent structure with other pipeline stages
- [ ] Error handling includes comprehensive logging with actionable information
- [ ] Code follows project naming conventions and architectural patterns

#### AC-011-06: Testing Coverage
- [ ] Unit tests cover component extraction logic for all supported formats
- [ ] Integration tests verify tracing works with actual ActionDiscoveryService
- [ ] Performance tests validate overhead requirements
- [ ] Error handling tests cover all failure scenarios

## Dependencies

### Technical Dependencies
- `src/actions/tracing/actionAwareStructuredTrace.js` - ACTTRA-009 (ActionAwareStructuredTrace class)
- `src/actions/actionDiscoveryService.js` - ACTTRA-010 (Enhanced ActionDiscoveryService)
- `src/actions/actionIndex.js` - Existing ActionIndex for candidate action retrieval
- `src/utils/validationUtils.js` - Input validation utilities

### Workflow Dependencies
- **ACTTRA-009**: ActionAwareStructuredTrace must be implemented first for data capture
- **ACTTRA-010**: Enhanced ActionDiscoveryService provides action-aware trace context
- **ACTTRA-003**: ActionTraceFilter determines which actions should be traced

### Pipeline Dependencies
- Other pipeline stages will be enhanced in subsequent tickets (ACTTRA-012 to ACTTRA-014)
- Integration with MultiTargetResolutionStage for complete pipeline tracing

## Definition of Done

### Code Complete
- [ ] ComponentFilteringStage enhanced with action tracing capabilities
- [ ] Component analysis utilities created for reusable component logic
- [ ] ActionIndex integration verified for proper trace context passing
- [ ] Error handling and logging implemented for all failure scenarios

### Testing Complete
- [ ] Unit tests written with >90% coverage for enhanced functionality
- [ ] Integration tests verify tracing works with full pipeline
- [ ] Performance tests validate overhead requirements
- [ ] Error handling tests cover component extraction and evaluation failures

### Documentation Complete
- [ ] All enhanced methods have comprehensive JSDoc documentation
- [ ] Component extraction logic documented with examples
- [ ] Trace data structure documented for consumers
- [ ] Performance characteristics documented

### Quality Assurance
- [ ] Code review completed by senior developer
- [ ] Integration with ActionDiscoveryService verified
- [ ] Performance benchmarks meet requirements
- [ ] Error scenarios handle gracefully without breaking pipeline

## Effort Estimation

### Development Tasks
- Stage enhancement implementation: **2 hours**
- Component extraction and analysis utilities: **1.5 hours**
- Action tracing integration: **1 hour**
- Error handling and logging: **0.5 hours**

### Testing Tasks
- Unit test implementation: **2.5 hours**
- Integration test development: **1.5 hours**
- Performance testing: **1 hour**

### Documentation Tasks
- JSDoc documentation: **0.5 hours**
- Component analysis documentation: **0.5 hours**

### Total Estimated Effort: **9.5 hours**

### Risk Factors
- **Low Risk**: Component extraction logic is straightforward with well-defined data structures
- **Low Risk**: Action tracing integration follows established patterns from ACTTRA-009
- **Low Risk**: Performance requirements are achievable with efficient data processing

## Success Metrics

### Quantitative Metrics
- Unit test coverage ≥90% for enhanced functionality
- <1ms overhead per traced action
- Zero performance impact when tracing disabled
- Component extraction accuracy 100% for supported formats

### Qualitative Metrics
- Clear visibility into component filtering decisions for traced actions
- Robust error handling for various component data structures
- Intuitive trace data format for debugging component issues
- Seamless integration with existing pipeline architecture

---

**Ticket Created**: 2025-01-06  
**Estimated Effort**: 9.5 hours  
**Complexity**: Low-Medium  
**Priority**: High  
**Assignee**: TBD  
**Reviewer**: Senior Developer