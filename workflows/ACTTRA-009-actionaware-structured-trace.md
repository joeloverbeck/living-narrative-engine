# ACTTRA-009: ActionAwareStructuredTrace Class Implementation

**Status: Updated to align with current codebase** ✅

**Key Corrections Applied:**
- Updated import paths to match current project structure (`src/actions/tracing/`)
- Replaced `validateDependency`/`assertNonBlankString` with `validationCore` patterns
- Updated test bed approach to use existing `createTestBed()` pattern
- Fixed StructuredTrace import to use named export
- Added ActionTraceFilter implementation (dependency created)

## Executive Summary

### Problem Statement
The existing StructuredTrace system provides general tracing capabilities but lacks action-specific data capture mechanisms needed for detailed action pipeline debugging. We need to extend the current tracing infrastructure to capture detailed action-specific data during pipeline processing without breaking backward compatibility.

### Solution Approach  
Create an ActionAwareStructuredTrace class that extends the existing StructuredTrace system with action-specific capabilities. This class will dynamically add action tracing methods to existing trace objects and provide intelligent data filtering based on verbosity levels and inclusion configurations.

### Business Value
- Enables targeted debugging of specific actions during pipeline processing
- Provides detailed visibility into action data flow and transformations
- Maintains full backward compatibility with existing trace system
- Supports configurable verbosity levels to control data size and detail

## Technical Requirements

### Functional Requirements

#### FR-009-01: Extend Existing StructuredTrace
- Must extend current StructuredTrace infrastructure without breaking changes
- Must maintain all existing trace functionality and APIs  
- Must be drop-in compatible with existing TraceContext usage

#### FR-009-02: Action-Specific Data Capture
- Must capture action-specific data at each pipeline stage
- Must associate captured data with specific action IDs
- Must provide structured storage for multi-stage action processing

#### FR-009-03: Verbosity-Based Data Filtering
- Must filter captured data based on configured verbosity levels
- Must support inclusion/exclusion of component data, prerequisites, and targets
- Must optimize data size while preserving debugging value

#### FR-009-04: Performance Optimization
- Must have minimal overhead when action tracing is disabled
- Must use efficient data structures for action data storage
- Must not block pipeline processing during data capture

### Non-Functional Requirements

#### NFR-009-01: Performance
- <1ms overhead per `captureActionData` call
- <5MB memory usage for typical trace session
- No impact on pipeline processing speed

#### NFR-009-02: Compatibility
- 100% backward compatibility with existing StructuredTrace
- No changes required to existing code using traces
- Seamless integration with TraceContext factory pattern

#### NFR-009-03: Maintainability
- Clear separation between general trace and action-specific functionality
- Consistent error handling and logging patterns
- Comprehensive JSDoc documentation

## Architecture Design

### Class Hierarchy
```
StructuredTrace (existing)
    ↑
ActionAwareStructuredTrace (new)
    - Extends base functionality
    - Adds action-specific methods
    - Manages action data storage
```

### Data Flow
```
Pipeline Stage → captureActionData() → ActionAwareStructuredTrace → Filtered Storage → Output Service
```

### Key Components

#### ActionAwareStructuredTrace Class
- Extends existing StructuredTrace
- Manages Map<actionId, actionTraceData> storage  
- Provides verbosity-based filtering
- Handles data lifecycle management

#### Action Trace Data Structure
```javascript
{
  actionId: string,
  actorId: string, 
  startTime: number,
  stages: {
    [stageName]: {
      timestamp: number,
      data: Object (filtered by verbosity)
    }
  }
}
```

## Implementation Steps

### Step 1: Create Base Class Structure

Create `src/actions/tracing/actionAwareStructuredTrace.js`:

**Note: This implementation has been updated to match the current codebase patterns:**

```javascript
/**
 * @file ActionAwareStructuredTrace - Extends StructuredTrace with action-specific capabilities
 * @see src/tracing/structuredTrace.js
 */

import { StructuredTrace } from './structuredTrace.js';
import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

import ActionTraceFilter from './actionTraceFilter.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * @typedef {import('./actionTraceFilter.js').default} ActionTraceFilter
 */

/**
 * Extends StructuredTrace with action-specific data capture capabilities
 * 
 * @class ActionAwareStructuredTrace
 * @extends StructuredTrace
 */
class ActionAwareStructuredTrace extends StructuredTrace {
  #actionTraceFilter;
  #tracedActionData;
  #actorId;
  #context;
  #logger;

  /**
   * @param {Object} dependencies
   * @param {ActionTraceFilter} dependencies.actionTraceFilter - Filter for action tracing
   * @param {string} dependencies.actorId - ID of the actor being traced
   * @param {Object} dependencies.context - Additional trace context
   * @param {Object} dependencies.logger - Logger instance
   */
  constructor({ actionTraceFilter, actorId, context, logger }) {
    super();
    
    if (!actionTraceFilter) {
      throw new InvalidArgumentError('ActionTraceFilter is required');
    }
    string.assertNonBlank(actorId, 'actorId', 'ActionAwareStructuredTrace constructor');
    this.#logger = ensureValidLogger(logger, 'ActionAwareStructuredTrace');

    this.#actionTraceFilter = actionTraceFilter;
    this.#tracedActionData = new Map();
    this.#actorId = actorId;
    this.#context = context || {};
  }

  /**
   * Capture action-specific data during pipeline processing
   * 
   * @param {string} stage - Pipeline stage name (e.g., 'component_filtering', 'prerequisite_evaluation')
   * @param {string} actionId - Action ID being processed (e.g., 'core:go')
   * @param {Object} data - Stage-specific data to capture
   * @returns {void}
   * 
   * @example
   * trace.captureActionData('component_filtering', 'core:go', {
   *   actorComponents: ['core:position', 'core:movement'],
   *   requiredComponents: ['core:position'],
   *   passed: true
   * });
   */
  captureActionData(stage, actionId, data) {
    try {
      // Fast return if this action shouldn't be traced
      if (!this.#actionTraceFilter.shouldTrace(actionId)) {
        return;
      }

      string.assertNonBlank(stage, 'stage', 'captureActionData');
      string.assertNonBlank(actionId, 'actionId', 'captureActionData');
      if (!data) {
        throw new InvalidArgumentError('Data is required for action capture');
      }

      // Initialize action trace data if first time seeing this action
      if (!this.#tracedActionData.has(actionId)) {
        this.#tracedActionData.set(actionId, {
          actionId,
          actorId: this.#actorId,
          startTime: Date.now(),
          stages: {},
          context: this.#context
        });
      }

      const actionTrace = this.#tracedActionData.get(actionId);
      const filteredData = this.#filterDataByVerbosity(data, stage);

      actionTrace.stages[stage] = {
        timestamp: Date.now(),
        data: filteredData,
        stageCompletedAt: Date.now()
      };

      // Log trace capture for debugging
      this.#logger.debug(
        `ActionAwareStructuredTrace: Captured data for action '${actionId}' at stage '${stage}'`,
        { 
          actionId, 
          stage, 
          dataKeys: Object.keys(filteredData),
          verbosity: this.#actionTraceFilter.getVerbosityLevel()
        }
      );

    } catch (error) {
      // Don't throw - tracing failures shouldn't break the pipeline
      this.#logger.error(
        `ActionAwareStructuredTrace: Error capturing action data for '${actionId}' at stage '${stage}'`,
        error
      );
    }
  }

  /**
   * Get complete trace data for all traced actions
   * 
   * @returns {Map<string, Object>} Map of actionId to trace data
   * 
   * @example
   * const tracedActions = trace.getTracedActions();
   * for (const [actionId, traceData] of tracedActions) {
   *   console.log(`Action ${actionId} processed in ${Object.keys(traceData.stages).length} stages`);
   * }
   */
  getTracedActions() {
    return new Map(this.#tracedActionData);
  }

  /**
   * Get trace data for a specific action
   * 
   * @param {string} actionId - Action ID to get trace data for
   * @returns {Object|null} Trace data for the action, or null if not found
   */
  getActionTrace(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'getActionTrace');
    return this.#tracedActionData.get(actionId) || null;
  }

  /**
   * Check if an action is being traced
   * 
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if action is being traced
   */
  isActionTraced(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'isActionTraced');
    return this.#tracedActionData.has(actionId);
  }

  /**
   * Get summary statistics for traced actions
   * 
   * @returns {Object} Summary statistics
   */
  getTracingSummary() {
    const tracedCount = this.#tracedActionData.size;
    let totalStages = 0;
    let oldestStart = Date.now();
    let newestStart = 0;

    for (const [, actionData] of this.#tracedActionData) {
      totalStages += Object.keys(actionData.stages).length;
      oldestStart = Math.min(oldestStart, actionData.startTime);
      newestStart = Math.max(newestStart, actionData.startTime);
    }

    return {
      tracedActionCount: tracedCount,
      totalStagesTracked: totalStages,
      sessionDuration: tracedCount > 0 ? newestStart - oldestStart : 0,
      averageStagesPerAction: tracedCount > 0 ? totalStages / tracedCount : 0
    };
  }

  /**
   * Filter captured data based on verbosity level and inclusion configuration
   * 
   * @private
   * @param {Object} data - Raw data to filter
   * @param {string} stage - Pipeline stage name for stage-specific filtering
   * @returns {Object} Filtered data
   */
  #filterDataByVerbosity(data, stage) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();
    const config = this.#actionTraceFilter.getInclusionConfig();

    // Start with base data that's always included
    const filteredData = {
      timestamp: data.timestamp || Date.now(),
      stage
    };

    try {
      switch (verbosity) {
        case 'minimal':
          return this.#applyMinimalFiltering(data, filteredData, config);
        
        case 'standard':
          return this.#applyStandardFiltering(data, filteredData, config);
        
        case 'detailed':
          return this.#applyDetailedFiltering(data, filteredData, config);
        
        case 'verbose':
          return this.#applyVerboseFiltering(data, filteredData, config);
        
        default:
          this.#logger.warn(`Unknown verbosity level: ${verbosity}, using 'standard'`);
          return this.#applyStandardFiltering(data, filteredData, config);
      }
    } catch (error) {
      this.#logger.error(`Error filtering data for verbosity '${verbosity}'`, error);
      return { ...filteredData, error: 'Data filtering failed' };
    }
  }

  /**
   * Apply minimal verbosity filtering - only essential data
   * 
   * @private
   */
  #applyMinimalFiltering(data, filteredData, config) {
    // Only include basic success/failure information
    if (data.passed !== undefined) {
      filteredData.passed = data.passed;
    }
    if (data.success !== undefined) {
      filteredData.success = data.success;
    }
    if (data.error) {
      filteredData.error = typeof data.error === 'string' ? data.error : data.error.message;
    }

    return filteredData;
  }

  /**
   * Apply standard verbosity filtering - balanced detail
   * 
   * @private  
   */
  #applyStandardFiltering(data, filteredData, config) {
    // Include minimal data
    Object.assign(filteredData, this.#applyMinimalFiltering(data, {}, config));

    // Add standard-level details
    if (data.actorId) {
      filteredData.actorId = data.actorId;
    }

    // Include component data if configured
    if (config.componentData && data.actorComponents) {
      filteredData.actorComponents = data.actorComponents;
    }
    if (config.componentData && data.requiredComponents) {
      filteredData.requiredComponents = data.requiredComponents;
    }

    // Include basic prerequisite info if configured
    if (config.prerequisites && data.prerequisites) {
      filteredData.prerequisiteCount = Array.isArray(data.prerequisites) 
        ? data.prerequisites.length 
        : Object.keys(data.prerequisites).length;
    }

    // Include target summary if configured
    if (config.targets) {
      if (data.targetCount !== undefined) {
        filteredData.targetCount = data.targetCount;
      }
      if (data.targetKeys) {
        filteredData.targetKeys = data.targetKeys;
      }
    }

    return filteredData;
  }

  /**
   * Apply detailed verbosity filtering - comprehensive data
   * 
   * @private
   */
  #applyDetailedFiltering(data, filteredData, config) {
    // Include standard data
    Object.assign(filteredData, this.#applyStandardFiltering(data, {}, config));

    // Add detailed-level information
    if (config.prerequisites && data.prerequisites) {
      filteredData.prerequisites = data.prerequisites;
    }

    if (config.targets && data.resolvedTargets) {
      // Include resolved targets but limit size
      filteredData.resolvedTargets = this.#limitArraySize(data.resolvedTargets, 10);
    }

    if (data.formattedCommand) {
      filteredData.formattedCommand = data.formattedCommand;
    }
    if (data.template) {
      filteredData.template = data.template;
    }

    // Include performance metrics
    if (data.duration !== undefined) {
      filteredData.duration = data.duration;
    }

    return filteredData;
  }

  /**
   * Apply verbose verbosity filtering - all available data
   * 
   * @private
   */
  #applyVerboseFiltering(data, filteredData, config) {
    // Include detailed data
    Object.assign(filteredData, this.#applyDetailedFiltering(data, {}, config));

    // Add verbose-level information - include most data with some safety limits
    const safeData = this.#createSafeDataCopy(data);
    
    // Merge all data but respect configuration flags
    Object.assign(filteredData, safeData);

    // Remove sensitive or redundant data
    delete filteredData.sensitiveData;
    delete filteredData.rawTokens;
    delete filteredData.internalState;

    return filteredData;
  }

  /**
   * Limit array size to prevent excessive memory usage
   * 
   * @private
   */
  #limitArraySize(array, maxSize) {
    if (!Array.isArray(array)) {
      return array;
    }
    
    if (array.length <= maxSize) {
      return array;
    }

    return [
      ...array.slice(0, maxSize - 1),
      { 
        truncated: true, 
        originalLength: array.length, 
        showing: maxSize - 1 
      }
    ];
  }

  /**
   * Create a safe copy of data, handling circular references and large objects
   * 
   * @private
   */
  #createSafeDataCopy(data) {
    try {
      // Use JSON serialization to handle circular references safely
      const jsonString = JSON.stringify(data, (key, value) => {
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
        
        // Limit string length
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '... [truncated]';
        }
        
        return value;
      });

      // Reset seen objects for next call
      this.#seenObjects = null;
      
      return JSON.parse(jsonString);
    } catch (error) {
      this.#logger.warn('Failed to create safe data copy, using fallback', error);
      return { dataError: 'Failed to serialize data safely' };
    }
  }
}

export default ActionAwareStructuredTrace;
```

### Step 2: Create Type Definitions

Create `src/actions/tracing/actionTraceTypes.js`:

```javascript
/**
 * @file Type definitions for action tracing system
 */

/**
 * @typedef {Object} ActionTraceData
 * @property {string} actionId - Unique identifier for the action
 * @property {string} actorId - ID of the actor performing the action
 * @property {number} startTime - Timestamp when action tracing began
 * @property {Object<string, StageTraceData>} stages - Data captured at each pipeline stage
 * @property {Object} context - Additional trace context
 */

/**
 * @typedef {Object} StageTraceData  
 * @property {number} timestamp - When this stage was captured
 * @property {Object} data - Stage-specific data (filtered by verbosity)
 * @property {number} stageCompletedAt - When this stage completed processing
 */

/**
 * @typedef {Object} TracingSummary
 * @property {number} tracedActionCount - Number of actions being traced
 * @property {number} totalStagesTracked - Total number of stages across all actions
 * @property {number} sessionDuration - Duration of tracing session in milliseconds
 * @property {number} averageStagesPerAction - Average stages per action
 */

/**
 * @typedef {Object} VerbosityConfig
 * @property {boolean} componentData - Include component-related data
 * @property {boolean} prerequisites - Include prerequisite evaluation data  
 * @property {boolean} targets - Include target resolution data
 */

export {};
```

### Step 3: Create Integration Helper

Create `src/actions/tracing/traceContextIntegration.js`:

```javascript
/**
 * @file Integration helper for existing TraceContext system
 */

import ActionAwareStructuredTrace from './actionAwareStructuredTrace.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * Enhanced trace context factory that creates action-aware traces when appropriate
 */
class ActionAwareTraceContextFactory {
  #originalFactory;
  #actionTraceFilter;
  #logger;

  constructor({ originalFactory, actionTraceFilter, logger }) {
    validateDependency(originalFactory, 'ITraceContextFactory');
    validateDependency(actionTraceFilter, 'IActionTraceFilter');
    this.#originalFactory = originalFactory;
    this.#actionTraceFilter = actionTraceFilter;
    this.#logger = logger;
  }

  /**
   * Create trace context, enhanced with action tracing if enabled
   * 
   * @param {Object} options - Trace options
   * @returns {StructuredTrace|ActionAwareStructuredTrace}
   */
  create(options = {}) {
    const { actorId, enableActionTracing = false } = options;

    // Create base trace using original factory
    const baseTrace = this.#originalFactory.create(options);

    // Enhance with action tracing if requested and enabled
    if (enableActionTracing && this.#actionTraceFilter.isEnabled() && actorId) {
      return this.#enhanceTraceWithActionCapabilities(baseTrace, actorId, options);
    }

    return baseTrace;
  }

  /**
   * Enhance existing trace with action capabilities
   * 
   * @private
   */
  #enhanceTraceWithActionCapabilities(trace, actorId, context) {
    try {
      // Create action-aware wrapper
      const actionTrace = new ActionAwareStructuredTrace({
        actionTraceFilter: this.#actionTraceFilter,
        actorId,
        context,
        logger: this.#logger
      });

      // Copy existing trace data and methods
      Object.setPrototypeOf(actionTrace, Object.getPrototypeOf(trace));
      Object.assign(actionTrace, trace);

      return actionTrace;
    } catch (error) {
      this.#logger.error('Failed to enhance trace with action capabilities', error);
      return trace; // Fallback to original trace
    }
  }
}

export default ActionAwareTraceContextFactory;
```

### Step 4: Update Registration

**Note: Update existing action tracing container registration in the dependency injection system.**

Add to action tracing container registration:

```javascript
import ActionAwareStructuredTrace from '../../actions/tracing/actionAwareStructuredTrace.js';
import ActionAwareTraceContextFactory from '../../actions/tracing/traceContextIntegration.js';

export function registerActionTracing(container) {
  // ... existing registrations ...

  // Register action-aware trace factory
  container.register(
    actionTracingTokens.IActionAwareTraceContextFactory,
    (deps) => {
      const logger = setup.setupService(
        'ActionAwareTraceContextFactory',
        deps.logger,
        {
          originalFactory: {
            value: deps.originalFactory,
            requiredMethods: ['create']
          },
          actionTraceFilter: {
            value: deps.actionTraceFilter,
            requiredMethods: ['isEnabled', 'shouldTrace', 'getVerbosityLevel', 'getInclusionConfig']
          }
        }
      );

      return new ActionAwareTraceContextFactory({
        originalFactory: deps.originalFactory,
        actionTraceFilter: deps.actionTraceFilter,
        logger
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        originalFactory: tokens.ITraceContextFactory,
        actionTraceFilter: actionTracingTokens.IActionTraceFilter,
        logger: tokens.ILogger
      }
    }
  );
}
```

## Testing Requirements

### Unit Tests

#### Test File: `tests/unit/actions/tracing/actionAwareStructuredTrace.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('ActionAwareStructuredTrace - Core Functionality', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Construction and Initialization', () => {
    it('should create instance with valid dependencies', () => {
      const trace = testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'standard'
      });

      expect(trace).toBeDefined();
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
    });

    it('should require actionTraceFilter dependency', () => {
      expect(() => {
        testBed.createTrace({ 
          actionTraceFilter: null,
          actorId: 'test-actor'
        });
      }).toThrow('ActionTraceFilter is required');
    });

    it('should require actorId parameter', () => {
      expect(() => {
        testBed.createTrace({ 
          actionTraceFilter: testBed.createMockFilter(),
          actorId: null
        });
      }).toThrow('Actor ID is required');
    });
  });

  describe('Action Data Capture', () => {
    it('should capture action data for traced actions', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard'
      });

      const testData = {
        actorComponents: ['core:position'],
        requiredComponents: ['core:position'],
        passed: true
      };

      trace.captureActionData('component_filtering', 'core:go', testData);

      const actionTrace = trace.getActionTrace('core:go');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.actionId).toBe('core:go');
      expect(actionTrace.stages.component_filtering).toBeDefined();
      expect(actionTrace.stages.component_filtering.data.passed).toBe(true);
    });

    it('should not capture data for non-traced actions', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:look'],
        verbosity: 'standard'
      });

      trace.captureActionData('component_filtering', 'core:go', { test: 'data' });

      expect(trace.getActionTrace('core:go')).toBeNull();
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
    });

    it('should handle multiple stages for same action', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard'
      });

      trace.captureActionData('component_filtering', 'core:go', { stage1: 'data' });
      trace.captureActionData('prerequisite_evaluation', 'core:go', { stage2: 'data' });

      const actionTrace = trace.getActionTrace('core:go');
      expect(Object.keys(actionTrace.stages)).toEqual(['component_filtering', 'prerequisite_evaluation']);
    });

    it('should handle capture errors gracefully', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard'
      });

      // Should not throw even with invalid data
      expect(() => {
        trace.captureActionData('test_stage', 'core:go', null);
      }).not.toThrow();
    });
  });

  describe('Verbosity Filtering', () => {
    it('should apply minimal verbosity filtering correctly', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'minimal'
      });

      const fullData = {
        actorComponents: ['core:position', 'core:movement'],
        requiredComponents: ['core:position'],
        passed: true,
        detailedInfo: { complex: 'object' },
        extraData: 'should be filtered out'
      };

      trace.captureActionData('component_filtering', 'core:go', fullData);

      const capturedData = trace.getActionTrace('core:go').stages.component_filtering.data;
      expect(capturedData.passed).toBe(true);
      expect(capturedData.actorComponents).toBeUndefined();
      expect(capturedData.detailedInfo).toBeUndefined();
    });

    it('should apply standard verbosity filtering correctly', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'standard',
        includeComponentData: true
      });

      const fullData = {
        actorComponents: ['core:position', 'core:movement'],
        requiredComponents: ['core:position'],
        passed: true,
        detailedInfo: { complex: 'object' }
      };

      trace.captureActionData('component_filtering', 'core:go', fullData);

      const capturedData = trace.getActionTrace('core:go').stages.component_filtering.data;
      expect(capturedData.passed).toBe(true);
      expect(capturedData.actorComponents).toEqual(['core:position', 'core:movement']);
      expect(capturedData.requiredComponents).toEqual(['core:position']);
      expect(capturedData.detailedInfo).toBeUndefined(); // Not included in standard
    });

    it('should apply detailed verbosity filtering correctly', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'detailed',
        includeComponentData: true,
        includePrerequisites: true
      });

      const fullData = {
        actorComponents: ['core:position'],
        prerequisites: [{ condition: 'test' }],
        passed: true,
        duration: 5.2
      };

      trace.captureActionData('prerequisite_evaluation', 'core:go', fullData);

      const capturedData = trace.getActionTrace('core:go').stages.prerequisite_evaluation.data;
      expect(capturedData.prerequisites).toEqual([{ condition: 'test' }]);
      expect(capturedData.duration).toBe(5.2);
    });

    it('should apply verbose verbosity filtering correctly', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go'],
        verbosity: 'verbose'
      });

      const fullData = {
        everything: 'should be included',
        unless: 'explicitly filtered',
        sensitiveData: 'should be removed'
      };

      trace.captureActionData('test_stage', 'core:go', fullData);

      const capturedData = trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData.everything).toBe('should be included');
      expect(capturedData.unless).toBe('explicitly filtered');
      expect(capturedData.sensitiveData).toBeUndefined();
    });
  });

  describe('Data Management', () => {
    it('should provide accurate tracing summary', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:go', 'core:look'],
        verbosity: 'standard'
      });

      trace.captureActionData('stage1', 'core:go', { data: 'test1' });
      trace.captureActionData('stage2', 'core:go', { data: 'test2' });
      trace.captureActionData('stage1', 'core:look', { data: 'test3' });

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(2);
      expect(summary.totalStagesTracked).toBe(3);
      expect(summary.averageStagesPerAction).toBe(1.5);
    });

    it('should handle large data sets without memory issues', () => {
      const trace = testBed.createActionAwareTrace({
        tracedActions: ['core:*'],
        verbosity: 'verbose'
      });

      const largeData = {
        largeArray: new Array(1000).fill('data'),
        complexObject: {}
      };

      expect(() => {
        trace.captureActionData('test_stage', 'core:go', largeData);
      }).not.toThrow();

      const capturedData = trace.getActionTrace('core:go').stages.test_stage.data;
      expect(capturedData).toBeDefined();
    });
  });
});
```

#### Test Bed: Update `tests/common/testBed.js`

Extend the existing test bed with ActionAwareStructuredTrace testing capabilities:

```javascript
// Add to existing testBed.js
import ActionAwareStructuredTrace from '../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../src/actions/tracing/actionTraceFilter.js';

// Add these methods to the returned object in createTestBed():

    createActionAwareTrace(options = {}) {
    const {
      tracedActions = [],
      verbosity = 'standard',
      includeComponentData = false,
      includePrerequisites = false,
      includeTargets = false,
      actorId = 'test-actor'
    } = options;

    const mockFilter = this.createMockFilter({
      tracedActions,
      verbosity,
      includeComponentData,
      includePrerequisites,
      includeTargets
    });

    const mockLogger = this.createMockLogger();

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: mockFilter,
      actorId,
      context: { test: true },
      logger: mockLogger
    });

    return trace;
  }

  createMockFilter(config = {}) {
    const {
      tracedActions = [],
      verbosity = 'standard',
      includeComponentData = false,
      includePrerequisites = false,
      includeTargets = false,
      enabled = true
    } = config;

    const tracedActionsSet = new Set(tracedActions);

    return {
      isEnabled: () => enabled,
      shouldTrace: (actionId) => {
        if (tracedActions.includes('*')) return true;
        if (tracedActionsSet.has(actionId)) return true;
        
        // Handle wildcards like 'core:*'
        return tracedActions.some(pattern => {
          if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return actionId.startsWith(prefix);
          }
          return false;
        });
      },
      getVerbosityLevel: () => verbosity,
      getInclusionConfig: () => ({
        componentData: includeComponentData,
        prerequisites: includePrerequisites,
        targets: includeTargets
      })
    };
  }

  createMockLogger() {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    return logger;
  }


    // Cleanup handled by existing testBed cleanup
}
```

### Integration Tests

#### Test File: `tests/integration/actions/tracing/actionAwareStructuredTrace.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';

describe('ActionAwareStructuredTrace - Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate with existing StructuredTrace system', async () => {
    const trace = await testBed.createIntegratedTrace({
      tracedActions: ['core:go'],
      verbosity: 'standard'
    });

    // Should still support existing StructuredTrace methods
    expect(typeof trace.step).toBe('function');
    expect(typeof trace.info).toBe('function');
    
    // Should also support new action tracing methods
    expect(typeof trace.captureActionData).toBe('function');
    expect(typeof trace.getTracedActions).toBe('function');
  });

  it('should work with ActionDiscoveryService pipeline', async () => {
    await testBed.setupFullPipeline({
      tracedActions: ['core:go'],
      verbosity: 'detailed'
    });

    const result = await testBed.runActionDiscovery('core:go');

    expect(result.success).toBe(true);
    
    const traceData = testBed.getTraceData();
    expect(traceData.has('core:go')).toBe(true);
    
    const actionTrace = traceData.get('core:go');
    expect(actionTrace.stages).toBeDefined();
    expect(Object.keys(actionTrace.stages).length).toBeGreaterThan(0);
  });
});
```

## Acceptance Criteria

### Functional Acceptance Criteria

#### AC-009-01: Basic Functionality
- [ ] ActionAwareStructuredTrace extends StructuredTrace without breaking compatibility
- [ ] captureActionData() method captures data only for traced actions  
- [ ] getTracedActions() returns Map of actionId to trace data
- [ ] Class handles multiple actions and stages correctly

#### AC-009-02: Verbosity Filtering
- [ ] Minimal verbosity includes only success/failure status
- [ ] Standard verbosity includes basic metadata when configured
- [ ] Detailed verbosity includes comprehensive data when configured
- [ ] Verbose verbosity includes all data except sensitive fields

#### AC-009-03: Error Handling
- [ ] Invalid data capture attempts don't throw exceptions
- [ ] Missing dependencies are properly validated at construction
- [ ] Circular reference data is handled safely
- [ ] Large data sets don't cause memory issues

#### AC-009-04: Performance
- [ ] captureActionData() completes in <1ms for standard verbosity
- [ ] Memory usage stays under 5MB for typical tracing session
- [ ] No performance impact when action is not being traced

### Technical Acceptance Criteria

#### AC-009-05: Code Quality
- [ ] All public methods have comprehensive JSDoc documentation
- [ ] Error handling follows project patterns
- [ ] Logging uses structured format with appropriate levels
- [ ] Code follows project naming and structure conventions

#### AC-009-06: Testing
- [ ] Unit test coverage >90% for all code paths
- [ ] Integration tests verify StructuredTrace compatibility
- [ ] Performance tests validate overhead requirements
- [ ] Error scenarios are tested comprehensively

## Dependencies

### Technical Dependencies
- `src/actions/tracing/structuredTrace.js` - Base class to extend
- `src/actions/tracing/actionTraceFilter.js` - ACTTRA-003 (filtering logic)
- `src/utils/validationUtils.js` - Input validation utilities
- `src/utils/loggerUtils.js` - Logger validation and setup

### Workflow Dependencies
- **ACTTRA-003**: ActionTraceFilter class must be implemented first
- **ACTTRA-006**: Configuration loader required for filter functionality
- **ACTTRA-039**: Dependency injection setup needed for container registration

### Development Dependencies
- Jest testing framework
- Test bed infrastructure for action tracing

## Definition of Done

### Code Complete
- [ ] ActionAwareStructuredTrace class implemented with all required methods
- [ ] Type definitions created and exported
- [ ] Integration helper for TraceContext factory implemented
- [ ] Dependency injection registration added

### Testing Complete  
- [ ] Unit tests written with >90% coverage
- [ ] Integration tests verify compatibility with existing system
- [ ] Performance tests validate overhead requirements
- [ ] Error handling tests cover all failure scenarios

### Documentation Complete
- [ ] All public methods have JSDoc documentation
- [ ] README section added explaining action-aware tracing
- [ ] Code examples provided for common usage patterns
- [ ] Architecture decision documented

### Quality Assurance
- [ ] Code review completed by senior developer
- [ ] No memory leaks detected in testing
- [ ] Performance requirements verified
- [ ] Integration with existing pipeline validated

## Effort Estimation

### Development Tasks
- Base class implementation: **2 hours**
- Verbosity filtering logic: **1.5 hours** 
- Integration helper: **1 hour**
- Error handling and validation: **1 hour**

### Testing Tasks
- Unit test implementation: **3 hours**
- Integration test setup: **2 hours**
- Performance testing: **1 hour**

### Documentation Tasks
- JSDoc documentation: **1 hour**
- Usage examples: **0.5 hours**

### Total Estimated Effort: **12 hours**

### Risk Factors
- **Medium Risk**: Complex verbosity filtering logic may require iteration
- **Low Risk**: Integration with existing StructuredTrace should be straightforward
- **Low Risk**: Performance requirements are achievable with efficient data structures

## Success Metrics

### Quantitative Metrics
- Unit test coverage ≥90%
- captureActionData() execution time <1ms
- Memory usage <5MB per tracing session
- Zero performance impact when tracing disabled

### Qualitative Metrics
- Clean integration with existing StructuredTrace system
- Intuitive API for pipeline integration
- Flexible verbosity system for different debugging needs
- Robust error handling for production use

---

**Ticket Created**: 2025-01-06  
**Estimated Effort**: 12 hours  
**Complexity**: Medium  
**Priority**: High  
**Assignee**: TBD  
**Reviewer**: Senior Developer