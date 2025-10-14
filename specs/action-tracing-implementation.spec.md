# Action Tracing System Implementation Specification

## 1. Overview

**IMPORTANT**: This specification has been updated to reflect the actual production code structure. The implementation extends the existing tracing infrastructure (StructuredTrace and TraceContext) rather than replacing it. All examples have been corrected to match the real API patterns and conventions used in the codebase.

### 1.1 Purpose

The Action Tracing System provides targeted debugging capabilities for the Living Narrative Engine's action pipeline. It enables developers to trace specific action IDs (e.g., 'movement:go') through the entire discovery, processing, and execution pipeline without impacting performance when disabled. It integrates with and extends the existing StructuredTrace system already in place.

### 1.2 Goals

- **Targeted Tracing**: Trace specific action IDs without overhead for other actions
- **Full Pipeline Coverage**: Capture every touchpoint an action passes through
- **Detailed Context**: Include all relevant data at each stage
- **File Output**: Write traces to dedicated files for analysis
- **Zero Impact**: No performance impact when tracing is disabled

### 1.3 Requirements

- Must integrate with existing StructuredTrace infrastructure
- Must maintain backward compatibility with current tracing
- Must support configuration without code changes
- Must provide both JSON and human-readable output formats
- Must handle high-frequency actions without blocking game loop

### 1.4 Constraints

- Cannot modify existing game logic
- Must use dependency injection pattern
- Must follow project's validation patterns
- Must maintain test coverage standards (80%+ branches)

## 2. Phase 1: Configuration and Filtering

### 2.1 Configuration Schema

#### 2.1.1 File: `config/trace-config.json` (Extended)

**Note**: This extends the existing trace configuration file rather than creating a new one.

```json
{
  "$schema": "../data/schemas/trace-config.schema.json",
  "traceAnalysisEnabled": false,
  "performanceMonitoring": {
    // ... existing config ...
  },
  "visualization": {
    // ... existing config ...
  },
  "analysis": {
    // ... existing config ...
  },
  "actionTracing": {
    "enabled": false,
    "tracedActions": [],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400
  }
}
```

**Note**: The `./traces/actions` directory will need to be created if it doesn't exist.

#### 2.1.2 Schema Definition: `data/schemas/action-trace-config.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "actionTracing": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Enable or disable action tracing globally"
        },
        "tracedActions": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^([a-z_]+:[a-z_]+|\\*|[a-z_]+:\\*)$"
          },
          "description": "Action IDs to trace. Supports wildcards: '*', 'mod:*'"
        },
        "outputDirectory": {
          "type": "string",
          "description": "Directory for trace output files"
        },
        "verbosity": {
          "type": "string",
          "enum": ["minimal", "standard", "detailed", "verbose"],
          "description": "Level of detail in traces"
        },
        "includeComponentData": {
          "type": "boolean",
          "description": "Include component data in traces"
        },
        "includePrerequisites": {
          "type": "boolean",
          "description": "Include prerequisite evaluation details"
        },
        "includeTargets": {
          "type": "boolean",
          "description": "Include target resolution details"
        },
        "maxTraceFiles": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000,
          "description": "Maximum number of trace files to keep"
        },
        "rotationPolicy": {
          "type": "string",
          "enum": ["age", "count"],
          "description": "How to rotate old trace files"
        },
        "maxFileAge": {
          "type": "integer",
          "minimum": 3600,
          "description": "Maximum age of trace files in seconds (when using age policy)"
        }
      },
      "required": ["enabled", "tracedActions", "outputDirectory"]
    }
  },
  "required": ["actionTracing"]
}
```

### 2.2 ActionTraceFilter Class

#### 2.2.1 Interface Definition

```javascript
// src/actions/tracing/actionTraceFilter.js

class ActionTraceFilter {
  #config;
  #tracedActionsSet;
  #wildcardPatterns;
  #logger;

  constructor({ configLoader, logger }) {
    validateDependency(configLoader, 'IConfigLoader');
    validateDependency(logger, 'ILogger');
  }

  /**
   * Initialize filter with configuration
   * @returns {Promise<void>}
   */
  async initialize() {
    // Load config and build lookup structures
  }

  /**
   * Check if tracing is enabled globally
   * @returns {boolean}
   */
  isEnabled() {
    return this.#config?.actionTracing?.enabled || false;
  }

  /**
   * Check if specific action should be traced
   * @param {string} actionId - Action ID to check
   * @returns {boolean}
   */
  shouldTrace(actionId) {
    // Fast lookup with wildcard support
  }

  /**
   * Get verbosity level for traces
   * @returns {string}
   */
  getVerbosityLevel() {
    return this.#config?.actionTracing?.verbosity || 'standard';
  }

  /**
   * Get configuration for what to include in traces
   * @returns {Object}
   */
  getInclusionConfig() {
    return {
      componentData: this.#config?.actionTracing?.includeComponentData,
      prerequisites: this.#config?.actionTracing?.includePrerequisites,
      targets: this.#config?.actionTracing?.includeTargets,
    };
  }

  /**
   * Get output directory for traces
   * @returns {string}
   */
  getOutputDirectory() {
    return this.#config?.actionTracing?.outputDirectory || './traces/actions';
  }
}
```

#### 2.2.2 Implementation Details

- Cache parsed configuration for performance
- Support wildcard patterns: `*` (all actions), `mod:*` (all actions from mod)
- Use Set for O(1) lookup of exact matches
- Compile regex patterns for wildcard matching
- Lazy initialization on first use

## 3. Phase 2: Pipeline Integration

### 3.1 ActionDiscoveryService Enhancement

#### 3.1.1 Modified Method

```javascript
// src/actions/actionDiscoveryService.js

async getValidActions(actorEntity, baseContext, options = {}) {
  const { trace: shouldTrace = false } = options;
  const trace = shouldTrace ? this.#traceContextFactory() : null;

  // Check if action tracing should be enhanced
  const actionTraceFilter = this.#actionTraceFilter;
  const shouldEnhanceTrace = actionTraceFilter?.isEnabled() && shouldTrace;

  // Enhance existing trace if action tracing is enabled
  if (shouldEnhanceTrace && trace) {
    // Wrap existing trace with action-aware functionality
    trace._actionTraceFilter = actionTraceFilter;
    trace._tracedActionData = new Map();

    // Add method to capture action-specific data
    trace.captureActionData = function(stage, actionId, data) {
      if (!this._actionTraceFilter.shouldTrace(actionId)) {
        return;
      }

      if (!this._tracedActionData.has(actionId)) {
        this._tracedActionData.set(actionId, {
          actionId,
          actorId: actorEntity.id,
          startTime: Date.now(),
          stages: {}
        });
      }

      const actionTrace = this._tracedActionData.get(actionId);
      actionTrace.stages[stage] = {
        timestamp: Date.now(),
        data: this._actionTraceFilter.filterDataByVerbosity(data)
      };
    };

    trace.getTracedActions = function() {
      return this._tracedActionData;
    };
  }

  // Support both old and new trace APIs (existing code)
  if (trace?.withSpanAsync) {
    // ... existing withSpanAsync code ...
  }

  // Rest of existing method...
}
```

### 3.2 ActionAwareStructuredTrace Class

#### 3.2.1 Class Definition

```javascript
// src/actions/tracing/actionAwareStructuredTrace.js

class ActionAwareStructuredTrace extends StructuredTrace {
  #actionTraceFilter;
  #tracedActionData;
  #actorId;
  #context;

  constructor({ actionTraceFilter, actorId, context }) {
    super();
    this.#actionTraceFilter = actionTraceFilter;
    this.#tracedActionData = new Map();
    this.#actorId = actorId;
    this.#context = context;
  }

  /**
   * Capture action-specific data during pipeline processing
   * @param {string} stage - Pipeline stage name
   * @param {string} actionId - Action being processed
   * @param {Object} data - Stage-specific data
   */
  captureActionData(stage, actionId, data) {
    if (!this.#actionTraceFilter.shouldTrace(actionId)) {
      return;
    }

    if (!this.#tracedActionData.has(actionId)) {
      this.#tracedActionData.set(actionId, {
        actionId,
        actorId: this.#actorId,
        startTime: Date.now(),
        stages: {},
      });
    }

    const actionTrace = this.#tracedActionData.get(actionId);
    actionTrace.stages[stage] = {
      timestamp: Date.now(),
      data: this.#filterDataByVerbosity(data),
    };
  }

  /**
   * Get complete trace data for output
   * @returns {Map<string, Object>}
   */
  getTracedActions() {
    return this.#tracedActionData;
  }

  #filterDataByVerbosity(data) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();
    const config = this.#actionTraceFilter.getInclusionConfig();

    // Filter data based on verbosity and inclusion config
    // Implementation depends on verbosity level
  }
}
```

### 3.3 Pipeline Stage Enhancements

#### 3.3.1 ComponentFilteringStage

```javascript
// src/actions/pipeline/stages/ComponentFilteringStage.js

async executeInternal(context) {
  const { actor, trace } = context;
  const source = `${this.name}Stage.execute`;

  // Get candidate actions from the index (existing logic)
  const candidateActions = this.#actionIndex.getCandidateActions(
    actor,
    trace
  );

  // Enhanced tracing for action-aware traces
  if (trace?.captureActionData) {
    candidateActions.forEach(actionDef => {
      // Note: ComponentFilteringStage delegates to ActionIndex
      // which already does the component matching internally
      trace.captureActionData('component_filtering', actionDef.id, {
        actorId: actor.id,
        actorComponents: Array.from(actor.components.keys()),
        requiredComponents: actionDef.requiredComponents || [],
        candidateCount: candidateActions.length,
        timestamp: Date.now()
      });
    });
  }

  // Existing trace logging
  trace?.step(
    `Filtering actions for actor ${actor.id} based on components`,
    source
  );

  // Rest of existing logic...
}
```

#### 3.3.2 PrerequisiteEvaluationStage

```javascript
// src/actions/pipeline/stages/PrerequisiteEvaluationStage.js

async executeInternal(context) {
  const { actor, candidateActions, trace } = context;
  const source = `${this.name}Stage.execute`;

  const validActions = [];

  for (const actionDef of candidateActions) {
    // Skip if no prerequisites (existing logic)
    if (!actionDef.prerequisites || actionDef.prerequisites.length === 0) {
      validActions.push(actionDef);
      continue;
    }

    // Evaluate prerequisites using the service
    const meetsPrereqs = this.#prerequisiteService.evaluate(
      actionDef.prerequisites,
      actionDef,
      actor,
      trace
    );

    // Enhanced tracing
    if (trace?.captureActionData) {
      trace.captureActionData('prerequisite_evaluation', actionDef.id, {
        prerequisites: actionDef.prerequisites,
        actorId: actor.id,
        passed: meetsPrereqs,
        timestamp: Date.now()
      });
    }

    if (meetsPrereqs) {
      validActions.push(actionDef);
    }
  }

  // Rest of existing logic...
}
```

#### 3.3.3 MultiTargetResolutionStage

```javascript
// src/actions/pipeline/stages/MultiTargetResolutionStage.js

async executeInternal(context) {
  const { candidateActions = [], actor, actionContext, trace } = context;

  trace?.step(
    `Resolving targets for ${candidateActions.length} candidate actions`,
    'MultiTargetResolutionStage'
  );

  const allActionsWithTargets = [];

  for (const actionDef of candidateActions) {
    try {
      // Check if this is a legacy or multi-target action
      const isLegacy = this.#legacyLayer.isLegacyAction(actionDef);

      let resolvedTargets;
      if (isLegacy) {
        // Process legacy action (existing logic)
        const result = await this.#resolveLegacyTarget(
          { ...context, actionDef },
          trace
        );
        if (result.success && result.data.actionsWithTargets) {
          allActionsWithTargets.push(...result.data.actionsWithTargets);
          resolvedTargets = result.data.resolvedTargets;
        }
      } else {
        // Process multi-target action (existing logic)
        const result = await this.#resolveMultiTargets(
          { ...context, actionDef },
          trace
        );
        if (result.success && result.data.actionsWithTargets) {
          allActionsWithTargets.push(...result.data.actionsWithTargets);
          resolvedTargets = result.data.resolvedTargets;
        }
      }

      // Enhanced tracing
      if (trace?.captureActionData && resolvedTargets) {
        const targetCount = Object.values(resolvedTargets)
          .reduce((sum, targets) => sum + targets.length, 0);

        trace.captureActionData('target_resolution', actionDef.id, {
          isLegacy,
          targetKeys: Object.keys(resolvedTargets),
          targetCount,
          resolvedTargets: Object.entries(resolvedTargets).reduce((acc, [key, targets]) => {
            acc[key] = targets.map(t => ({
              id: t.id,
              displayName: t.displayName
            }));
            return acc;
          }, {}),
          timestamp: Date.now()
        });
      }
    } catch (error) {
      // Error handling (existing logic)
      this.#logger.error(
        `Error resolving targets for action '${actionDef.id}':`,
        error
      );
    }
  }

  // Rest of existing logic...
}
```

#### 3.3.4 ActionFormattingStage

```javascript
// src/actions/pipeline/stages/ActionFormattingStage.js

async executeInternal(context) {
  const { trace } = context;
  const source = `${this.name}Stage.execute`;

  trace?.step(
    `Formatting ${context.actionsWithTargets?.length ?? 0} actions with their targets`,
    source
  );

  const hasActionAwareTrace =
    trace && typeof trace.captureActionData === 'function';
  const instrumentation = hasActionAwareTrace
    ? new TraceAwareInstrumentation(trace)
    : new NoopInstrumentation();

  const coordinator = new ActionFormattingCoordinator({
    context,
    instrumentation,
    decider: this.#decider,
    accumulatorFactory: () => new FormattingAccumulator(),
    errorFactory: this.#errorFactory,
    fallbackFormatter: this.#legacyFallbackFormatter,
    targetNormalizationService: this.#targetNormalizationService,
    commandFormatter: this.#commandFormatter,
    entityManager: this.#entityManager,
    safeEventDispatcher: this.#safeEventDispatcher,
    getEntityDisplayNameFn: this.#getEntityDisplayNameFn,
    logger: this.#logger,
    validateVisualProperties: (visual, actionId) =>
      this.#validateVisualProperties(visual, actionId),
  });

  return coordinator.run();
}
```

## 4. Phase 3: Execution Tracing

### 4.1 CommandProcessor Integration

#### 4.1.1 Enhanced dispatchAction Method

```javascript
// src/commands/commandProcessor.js

async dispatchAction(actor, turnAction) {
  try {
    this.#validateActionInputs(actor, turnAction);
  } catch (err) {
    return this.#handleDispatchFailure(
      'Internal error: Malformed action prevented execution.',
      err.message,
      turnAction?.commandString,
      turnAction?.actionDefinitionId
    );
  }

  const actorId = actor.id;
  const { actionDefinitionId: actionId, commandString } = turnAction;
  let actionTrace = null;

  // Check if this action should be traced
  if (this.#actionTraceFilter?.shouldTrace(actionId)) {
    actionTrace = new ActionExecutionTrace({
      actionId,
      actorId,
      turnAction
    });
    actionTrace.captureDispatchStart();
  }

  this.#logger.debug(
    `CommandProcessor.dispatchAction: Dispatching pre-resolved action '${actionId}' for actor ${actorId}.`,
    { turnAction }
  );

  try {
    // --- Payload Construction (existing logic) ---
    const payload = this.#createAttemptActionPayload(actor, turnAction);

    if (actionTrace) {
      actionTrace.captureEventPayload(payload);
    }

    // --- Dispatch using EventDispatchService ---
    const dispatchSuccess =
      await this.#eventDispatchService.dispatchWithErrorHandling(
        ATTEMPT_ACTION_ID,
        payload,
        `ATTEMPT_ACTION_ID dispatch for pre-resolved action ${actionId}`
      );

    if (actionTrace) {
      actionTrace.captureDispatchResult({
        success: dispatchSuccess,
        timestamp: Date.now()
      });
      await this.#traceOutputService.writeTrace(actionTrace);
    }

    if (dispatchSuccess) {
      this.#logger.debug(
        `CommandProcessor.dispatchAction: Successfully dispatched '${actionId}' for actor ${actorId}.`
      );
      return {
        success: true,
        turnEnded: false,
        originalInput: commandString || actionId,
        actionResult: { actionId },
      };
    }

    const internalMsg = `CRITICAL: Failed to dispatch pre-resolved ATTEMPT_ACTION_ID for ${actorId}, action "${actionId}". Dispatcher reported failure.`;
    return this.#handleDispatchFailure(
      'Internal error: Failed to initiate action.',
      internalMsg,
      commandString,
      actionId,
      { payload }
    );

  } catch (error) {
    if (actionTrace) {
      actionTrace.captureError(error);
      await this.#traceOutputService.writeTrace(actionTrace);
    }

    this.#logger.error(
      `CommandProcessor.dispatchAction: Error dispatching action '${actionId}':`,
      error
    );

    return this.#handleDispatchFailure(
      'Internal error: Action dispatch failed.',
      error.message,
      commandString,
      actionId
    );
  }
}
```

### 4.2 ActionExecutionTrace Class

#### 4.2.1 Class Definition

```javascript
// src/actions/tracing/actionExecutionTrace.js

class ActionExecutionTrace {
  #actionId;
  #actorId;
  #turnAction;
  #executionData;

  constructor({ actionId, actorId, turnAction }) {
    this.#actionId = actionId;
    this.#actorId = actorId;
    this.#turnAction = turnAction;
    this.#executionData = {
      startTime: null,
      endTime: null,
      eventPayload: null,
      result: null,
      error: null,
    };
  }

  captureDispatchStart() {
    this.#executionData.startTime = Date.now();
  }

  captureEventPayload(payload) {
    this.#executionData.eventPayload = payload;
  }

  captureDispatchResult(result) {
    this.#executionData.endTime = Date.now();
    this.#executionData.result = result;
    this.#executionData.duration =
      this.#executionData.endTime - this.#executionData.startTime;
  }

  captureError(error) {
    this.#executionData.endTime = Date.now();
    this.#executionData.error = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
    };
  }

  toJSON() {
    return {
      actionId: this.#actionId,
      actorId: this.#actorId,
      turnAction: this.#turnAction,
      execution: this.#executionData,
    };
  }
}
```

## 5. Phase 4: Output Generation

### 5.1 ActionTraceOutputService

**IMPORTANT**: The output directory (`./traces/actions`) does not exist by default and must be created. The ActionTraceOutputService will automatically create it on first use.

#### 5.1.1 Class Definition

```javascript
// src/actions/tracing/actionTraceOutputService.js

import { validateDependency } from '../../utils/dependencyUtils.js';
import path from 'path';
import fs from 'fs/promises';

class ActionTraceOutputService {
  #fileSystem;
  #logger;
  #actionTraceFilter;
  #outputQueue;
  #isProcessing;
  #directoryCreated;

  constructor({ fileSystem, logger, actionTraceFilter }) {
    validateDependency(fileSystem, 'IFileSystem');
    validateDependency(logger, 'ILogger');
    validateDependency(actionTraceFilter, 'IActionTraceFilter');

    this.#fileSystem = fileSystem;
    this.#logger = logger;
    this.#actionTraceFilter = actionTraceFilter;
    this.#outputQueue = [];
    this.#isProcessing = false;
    this.#directoryCreated = false;
  }

  /**
   * Write trace to file asynchronously
   * @param {ActionExecutionTrace|ActionAwareStructuredTrace} trace
   * @returns {Promise<void>}
   */
  async writeTrace(trace) {
    this.#outputQueue.push(trace);

    if (!this.#isProcessing) {
      this.#processQueue();
    }
  }

  /**
   * Process queued traces without blocking
   * @private
   */
  async #processQueue() {
    this.#isProcessing = true;

    while (this.#outputQueue.length > 0) {
      const trace = this.#outputQueue.shift();

      try {
        await this.#writeTraceToFile(trace);
      } catch (error) {
        this.#logger.error('Failed to write trace', error);
      }
    }

    this.#isProcessing = false;
  }

  /**
   * Write single trace to file
   * @private
   */
  async #writeTraceToFile(trace) {
    const outputDir = this.#actionTraceFilter.getOutputDirectory();

    // Create directory if it doesn't exist (first time only)
    if (!this.#directoryCreated) {
      await this.#ensureDirectoryExists(outputDir);
      this.#directoryCreated = true;
    }

    // Generate filename
    const filename = this.#generateFilename(trace);
    const filepath = path.join(outputDir, filename);

    // Format trace data
    const traceData = this.#formatTraceData(trace);

    // Write JSON format
    await this.#fileSystem.writeFile(
      filepath + '.json',
      JSON.stringify(traceData, null, 2)
    );

    // Write human-readable format if verbose
    if (this.#actionTraceFilter.getVerbosityLevel() !== 'minimal') {
      await this.#fileSystem.writeFile(
        filepath + '.txt',
        this.#formatHumanReadable(traceData)
      );
    }

    // Handle rotation
    await this.#rotateOldFiles(outputDir);
  }

  #generateFilename(trace) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5); // Remove milliseconds and Z

    const actionId = trace.actionId || 'unknown';
    const sanitizedActionId = actionId.replace(':', '-');

    return `${sanitizedActionId}_${timestamp}`;
  }

  #formatTraceData(trace) {
    if (trace instanceof ActionExecutionTrace) {
      return trace.toJSON();
    }

    if (trace instanceof ActionAwareStructuredTrace) {
      return this.#formatStructuredTrace(trace);
    }

    return trace;
  }

  #formatStructuredTrace(trace) {
    const tracedActions = trace.getTracedActions();
    const result = {
      timestamp: new Date().toISOString(),
      spans: trace.getSpans(),
      actions: {},
    };

    for (const [actionId, data] of tracedActions) {
      result.actions[actionId] = data;
    }

    return result;
  }

  #formatHumanReadable(traceData) {
    // Convert JSON to human-readable format
    // Implementation creates readable text with sections
  }

  async #rotateOldFiles(directory) {
    // Implement file rotation based on configuration
  }
}
```

### 5.2 Output Format Specifications

#### 5.2.1 JSON Format

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "actionId": "movement:go",
  "actorId": "player-1",
  "pipeline": {
    "componentFiltering": {
      "startTime": 1234567890123,
      "duration": 2.5,
      "actorComponents": ["core:position", "core:movement"],
      "requiredComponents": ["core:position"],
      "passed": true
    },
    "prerequisiteEvaluation": {
      "startTime": 1234567890126,
      "duration": 5.3,
      "prerequisites": {...},
      "evaluationContext": {...},
      "result": true,
      "jsonLogicTrace": {...}
    },
    "targetResolution": {
      "startTime": 1234567890132,
      "duration": 8.7,
      "scopeExpression": "core:clear_directions",
      "resolvedTargets": [
        {"id": "north", "type": "direction", "name": "North"},
        {"id": "south", "type": "direction", "name": "South"}
      ],
      "targetCount": 2
    },
    "formatting": {
      "startTime": 1234567890141,
      "duration": 1.2,
      "template": "go {direction}",
      "parameters": {"direction": "north"},
      "formattedCommand": "go north",
      "displayName": "Go North"
    }
  },
  "execution": {
    "startTime": 1234567890143,
    "endTime": 1234567890245,
    "duration": 102,
    "eventPayload": {
      "actor": "player-1",
      "action": {...},
      "timestamp": 1234567890143
    },
    "result": "success"
  }
}
```

#### 5.2.2 Human-Readable Format

```
ACTION TRACE REPORT
==================
Timestamp: 2024-01-15 10:30:00.123
Action: movement:go
Actor: player-1

PIPELINE STAGES
===============

1. Component Filtering (2.5ms)
   - Actor Components: core:position, core:movement
   - Required: core:position
   - Result: PASSED

2. Prerequisite Evaluation (5.3ms)
   - Conditions Evaluated: 3
   - Result: PASSED
   - Details: All prerequisites met

3. Target Resolution (8.7ms)
   - Scope: core:clear_directions
   - Targets Found: 2
     * north (direction) - "North"
     * south (direction) - "South"

4. Action Formatting (1.2ms)
   - Template: "go {direction}"
   - Formatted: "go north"
   - Display: "Go North"

EXECUTION
=========
Duration: 102ms
Status: SUCCESS
Event Type: ATTEMPT_ACTION_ID

Total Pipeline Time: 17.7ms
Total Execution Time: 119.7ms
```

## 6. Implementation Details

### 6.1 Dependency Injection Tokens

```javascript
// src/dependencyInjection/tokens/actionTracingTokens.js

export const actionTracingTokens = {
  IActionTraceFilter: Symbol('IActionTraceFilter'),
  IActionTraceOutputService: Symbol('IActionTraceOutputService'),
  IActionTraceConfigLoader: Symbol('IActionTraceConfigLoader'),
};

// Export to be included in main tokens
export default actionTracingTokens;
```

### 6.2 Registration

```javascript
// src/dependencyInjection/containers/actionTracingContainer.js

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import { tokens } from '../tokens.js';

export function registerActionTracing(container) {
  // Use ServiceSetup pattern for consistency
  const setup = new ServiceSetup();

  // Register config loader with proper validation
  container.register(
    actionTracingTokens.IActionTraceConfigLoader,
    (deps) => {
      const logger = setup.setupService(
        'ActionTraceConfigLoader',
        deps.logger,
        {
          configLoader: {
            value: deps.configLoader,
            requiredMethods: ['loadConfig'],
          },
        }
      );

      return new ActionTraceConfigLoader({
        configLoader: deps.configLoader,
        logger,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        configLoader: tokens.IConfigLoader,
        logger: tokens.ILogger,
      },
    }
  );

  // Register filter with proper validation
  container.register(
    actionTracingTokens.IActionTraceFilter,
    (deps) => {
      const logger = setup.setupService('ActionTraceFilter', deps.logger, {
        configLoader: {
          value: deps.configLoader,
          requiredMethods: ['loadConfig', 'getConfig'],
        },
      });

      return new ActionTraceFilter({
        configLoader: deps.configLoader,
        logger,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        configLoader: actionTracingTokens.IActionTraceConfigLoader,
        logger: tokens.ILogger,
      },
    }
  );

  // Register output service with proper validation
  container.register(
    actionTracingTokens.IActionTraceOutputService,
    (deps) => {
      const logger = setup.setupService(
        'ActionTraceOutputService',
        deps.logger,
        {
          fileSystem: {
            value: deps.fileSystem,
            requiredMethods: ['writeFile', 'mkdir', 'readdir'],
          },
          actionTraceFilter: {
            value: deps.actionTraceFilter,
            requiredMethods: [
              'shouldTrace',
              'getOutputDirectory',
              'getVerbosityLevel',
            ],
          },
        }
      );

      return new ActionTraceOutputService({
        fileSystem: deps.fileSystem,
        logger,
        actionTraceFilter: deps.actionTraceFilter,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        fileSystem: tokens.IFileSystem,
        logger: tokens.ILogger,
        actionTraceFilter: actionTracingTokens.IActionTraceFilter,
      },
    }
  );
}
```

### 6.3 Error Handling

- Configuration errors: Log warning and disable tracing
- File write errors: Queue for retry with exponential backoff
- Invalid action IDs: Skip silently
- Memory limits: Implement trace data size limits
- Circular references: Use safe JSON stringification

### 6.4 Performance Considerations

- **Configuration Caching**: Load once at startup
- **Set Lookup**: O(1) for exact action ID matches
- **Lazy Wildcard Compilation**: Compile patterns on first use
- **Async File Writing**: Non-blocking queue processing
- **Memory Management**: Limit trace data size
- **Conditional Capture**: Only capture data for traced actions

## 7. Testing Strategy

### 7.1 Unit Tests

#### 7.1.1 ActionTraceFilter Tests

```javascript
// tests/unit/actions/tracing/actionTraceFilter.unit.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTraceFilterTestBed } from '../../../common/actions/actionTraceFilterTestBed.js';

describe('ActionTraceFilter - Configuration and Filtering', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTraceFilterTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should correctly identify actions to trace based on configuration');
  it('should support wildcard patterns (* and mod:*)');
  it('should handle disabled tracing globally');
  it('should cache configuration for performance');
  it('should validate configuration against schema');
});
```

#### 7.1.2 ActionTraceOutputService Tests

```javascript
// tests/unit/actions/tracing/actionTraceOutputService.unit.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTraceOutputServiceTestBed } from '../../../common/actions/actionTraceOutputServiceTestBed.js';

describe('ActionTraceOutputService - File Output', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTraceOutputServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should write traces to correct directory');
  it('should generate unique filenames with timestamps');
  it('should format JSON output correctly');
  it('should format human-readable text based on verbosity');
  it('should handle file rotation based on policy');
  it('should process output queue asynchronously');
  it('should create output directory if it does not exist');
});
```

### 7.2 Integration Tests

```javascript
// tests/integration/actions/tracing/actionTracingPipeline.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';

describe('Action Tracing - Pipeline Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should trace action through complete discovery pipeline');
  it('should capture data at all pipeline stages');
  it('should write trace files to filesystem');
  it('should handle concurrent action processing');
  it('should integrate with existing StructuredTrace system');
  it('should respect configuration settings');
});
```

```javascript
// tests/integration/actions/tracing/actionTracingExecution.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CommandProcessorTracingTestBed } from '../../../common/commands/commandProcessorTracingTestBed.js';

describe('Action Tracing - Execution Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new CommandProcessorTracingTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should trace action execution through CommandProcessor');
  it('should capture dispatch timing and results');
  it('should handle execution errors gracefully');
  it('should write execution traces to output');
});
```

### 7.3 Performance Tests

```javascript
// tests/performance/actions/tracing/actionTracingPerformance.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingPerformanceTestBed } from '../../../common/performance/actionTracingPerformanceTestBed.js';

describe('Action Tracing - Performance Impact', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingPerformanceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should have <5ms overhead when disabled');
  it('should handle 100+ actions/second when enabled');
  it('should not block game loop or event processing');
  it('should maintain memory usage below 10MB for traces');
  it('should batch file writes efficiently');
});
```

## 8. Documentation Requirements

### 8.1 User Guide

Create `docs/action-tracing-guide.md` with:

- Configuration instructions
- Common use cases
- Trace file interpretation
- Troubleshooting guide
- Performance tuning tips

### 8.2 Developer Guide

Create `docs/action-tracing-development.md` with:

- Architecture overview
- Extension points
- Adding new trace points
- Custom output formats
- Integration with other systems

### 8.3 API Documentation

Update JSDoc comments for all public methods with:

- Parameter descriptions
- Return types
- Usage examples
- Performance notes

## 9. Migration and Rollout

### 9.1 Implementation Order

1. **Week 1**: Configuration and ActionTraceFilter
2. **Week 2**: ActionAwareStructuredTrace and pipeline integration
3. **Week 3**: Execution tracing and CommandProcessor
4. **Week 4**: Output service and file management
5. **Week 5**: Testing and documentation
6. **Week 6**: Performance optimization and rollout

### 9.2 Feature Flags

- Start with `enabled: false` by default
- Test with single actions first
- Gradually expand to more actions
- Monitor performance impact

### 9.3 Backward Compatibility

- Existing trace system continues to work
- New system is additive only
- No changes to existing APIs
- Configuration is optional

## 10. Future Enhancements

### 10.1 Short Term (3 months)

- Web UI for trace visualization
- Real-time trace streaming
- Trace comparison tools
- Performance profiling integration

### 10.2 Medium Term (6 months)

- Rule execution tracing
- State change tracking
- Machine learning for pattern detection
- Automated issue detection

### 10.3 Long Term (12 months)

- Distributed tracing for multiplayer
- Cloud trace storage
- AI-powered debugging assistance
- Integration with external monitoring tools

## 11. Success Metrics

### 11.1 Functional Metrics

- Successfully trace 100% of configured actions
- Zero performance impact when disabled
- < 5ms overhead per traced action
- 100% trace file generation success

### 11.2 Quality Metrics

- 80%+ branch coverage in tests
- Zero memory leaks
- < 100MB total trace storage
- < 10ms file write time

### 11.3 User Metrics

- Reduce debugging time by 50%
- Identify action issues in < 5 minutes
- Support all core mod actions
- Enable mod developer adoption

## 12. Risk Analysis

### 12.1 Technical Risks

- **Performance Impact**: Mitigated by conditional tracing
- **Memory Usage**: Mitigated by data limits and rotation
- **File System Issues**: Mitigated by async queue and error handling
- **Configuration Errors**: Mitigated by schema validation

### 12.2 Implementation Risks

- **Integration Complexity**: Mitigated by phased approach
- **Testing Coverage**: Mitigated by comprehensive test plan
- **Documentation Debt**: Mitigated by documentation requirements

## 13. Approval and Sign-off

This specification requires approval from:

- [ ] Technical Lead
- [ ] Architecture Team
- [ ] QA Team
- [ ] Product Owner

---

**Document Version**: 1.1.0  
**Created**: 2024-01-15  
**Updated**: 2025-01-05
**Status**: Corrected Draft

## Revision History

### Version 1.1.0 - Major Corrections (2025-01-05)

This version corrects significant discrepancies between the original spec and the actual production code:

#### Key Corrections Made:

1. **Trace Integration**:
   - Fixed to extend existing StructuredTrace/TraceContext rather than replace
   - Added `captureActionData` method dynamically to existing trace objects
   - Corrected all trace method calls to use actual API (`trace?.step()`, `trace?.info()`)

2. **Configuration**:
   - Extended existing `config/trace-config.json` instead of creating new file
   - Added `actionTracing` section to existing configuration structure

3. **Pipeline Stages**:
   - Corrected constructor patterns to match actual implementations
   - Fixed stage names (e.g., `ActionFormattingStage` not `actionFormattingStage`)
   - Updated context structures to match real pipeline data flow
   - Added proper handling of legacy vs multi-target actions

4. **CommandProcessor**:
   - Updated to use `EventDispatchService` not raw EventBus
   - Added proper error handling patterns from actual code
   - Included payload construction logic

5. **Dependency Injection**:
   - Used ServiceSetup pattern consistent with codebase
   - Added proper validation using existing utilities
   - Placed tokens in appropriate directory structure

6. **Testing**:
   - Fixed test file naming conventions (`.unit.test.js`, `.integration.test.js`)
   - Added proper test bed references
   - Included Jest globals imports

7. **Directory Requirements**:
   - Added prominent notes about `./traces/actions` directory creation
   - Included automatic directory creation logic in OutputService

8. **Import Statements**:
   - Added proper ES6 module imports throughout examples
   - Used existing utility functions from the codebase

## Appendix A: Configuration Examples

### A.1 Minimal Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["movement:go"],
    "outputDirectory": "./traces/actions"
  }
}
```

### A.2 Development Configuration

```json
{
  "actionTracing": {
    "enabled": true,
    "tracedActions": ["core:*", "custom:debug_action"],
    "outputDirectory": "./traces/actions",
    "verbosity": "detailed",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 50
  }
}
```

### A.3 Production Configuration

```json
{
  "actionTracing": {
    "enabled": false,
    "tracedActions": [],
    "outputDirectory": "./traces/actions",
    "verbosity": "minimal",
    "maxTraceFiles": 10,
    "rotationPolicy": "age",
    "maxFileAge": 3600
  }
}
```

## Appendix B: Trace Data Examples

### B.1 Minimal Trace

```json
{
  "actionId": "movement:go",
  "actorId": "player-1",
  "timestamp": "2024-01-15T10:30:00.123Z",
  "result": "success",
  "duration": 119.7
}
```

### B.2 Detailed Pipeline Trace

[Full JSON example as shown in section 5.2.1]

### B.3 Error Trace

```json
{
  "actionId": "movement:go",
  "actorId": "player-1",
  "timestamp": "2024-01-15T10:30:00.123Z",
  "error": {
    "stage": "prerequisite_evaluation",
    "message": "Player lacks required energy",
    "type": "PrerequisiteFailedError",
    "context": {
      "prerequisite": "energy >= 10",
      "actualValue": 5
    }
  }
}
```
