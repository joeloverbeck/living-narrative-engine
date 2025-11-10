# Action Tracing Developer Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [API Reference](#api-reference)
4. [Adding Trace Points](#adding-trace-points)
5. [Custom Output Formats](#custom-output-formats)
6. [Integration Guide](#integration-guide)
7. [Performance Considerations](#performance-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Maintenance Guide](#maintenance-guide)
10. [Contributing](#contributing)

## Architecture Overview

### System Design

The action tracing system follows a modular, event-driven architecture designed for browser compatibility and performance. It consists of several interconnected components that work together to capture, process, format, and store action execution traces.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Action Tracing System                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ ActionTraceFilter│    │StructuredTrace  │    │ExecutionTrace│ │
│  │                 │    │                 │    │              │ │
│  │ • Filtering     │    │ • Pipeline      │    │ • Lifecycle  │ │
│  │ • Verbosity     │◄───┤   Capture       │◄───┤   Tracking   │ │
│  │ • Inclusion     │    │ • Multi-target  │    │ • Timing     │ │
│  │   Rules         │    │ • Legacy        │    │ • Errors     │ │
│  └─────────────────┘    │   Support       │    └──────────────┘ │
│                         └─────────────────┘                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              ActionTraceOutputService                       │ │
│  │                                                             │ │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│  │ │Queue        │ │Storage      │ │Export       │            │ │
│  │ │Processor    │ │Rotation     │ │System       │            │ │
│  │ │             │ │Manager      │ │             │            │ │
│  │ │• Priority   │ │• Age-based  │ │• File       │            │ │
│  │ │• Batching   │ │• Size-based │ │  System API │            │ │
│  │ │• Circuit    │ │• Pattern    │ │• Download   │            │ │
│  │ │  Breaker    │ │  Preserve   │ │  Fallback   │            │ │
│  │ └─────────────┘ └─────────────┘ └─────────────┘            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                   │ │
│  │ JSON Formatter  │    │ Human Readable  │                   │ │
│  │                 │    │ Formatter       │                   │ │
│  │ • Structured    │    │                 │                   │ │
│  │   Output        │    │ • Text Reports  │                   │ │
│  │ • Schema        │    │ • Summaries     │                   │ │
│  │   Validation    │    │ • Debug Info    │                   │ │
│  └─────────────────┘    └─────────────────┘                   │ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Capture Phase**: Action execution generates trace data through `ActionExecutionTrace` or pipeline stages through `ActionAwareStructuredTrace`
2. **Filtering Phase**: `ActionTraceFilter` determines what data to capture based on verbosity settings and inclusion rules
3. **Processing Phase**: Trace data is queued and processed by `TraceQueueProcessor` with priority handling and circuit breaker protection
4. **Storage Phase**: Processed traces are stored in browser IndexedDB with automatic rotation via `StorageRotationManager`
5. **Output Phase**: Traces can be formatted and exported using `JsonTraceFormatter` and `HumanReadableFormatter`

### Component Interactions

The system uses dependency injection extensively through the `actionTracingTokens` for loose coupling:

```javascript
// Service registration example
container.register(actionTracingTokens.IActionTraceFilter, ActionTraceFilter);
container.register(
  actionTracingTokens.IActionExecutionTraceFactory,
  ActionExecutionTraceFactory
);
container.register(
  actionTracingTokens.IActionTraceOutputService,
  ActionTraceOutputService
);
```

### Design Patterns

- **Strategy Pattern**: Multiple formatters (`JsonTraceFormatter`, `HumanReadableFormatter`)
- **Observer Pattern**: Event-driven queue processing and storage rotation
- **Circuit Breaker**: Error recovery in `TraceQueueProcessor`
- **Factory Pattern**: `ActionExecutionTraceFactory` for trace creation
- **Dependency Injection**: Loose coupling through IoC container

## Core Components

### ActionTraceFilter

**Purpose**: Controls which actions are traced and at what verbosity level.

**Key Features**:

- Wildcard pattern matching (`core:*`, `*:go`)
- Regex pattern support (`/pattern/`)
- Verbosity levels: `minimal`, `standard`, `detailed`, `verbose`
- Dynamic configuration updates
- Inclusion/exclusion rules

**Constructor**:

```javascript
const filter = new ActionTraceFilter({
  enabled: true,
  tracedActions: ['core:*', 'game:combat'],
  excludedActions: ['debug:*'],
  verbosityLevel: 'standard',
  inclusionConfig: {
    componentData: true,
    prerequisites: false,
    targets: true,
  },
});
```

### ActionAwareStructuredTrace

**Purpose**: Captures action-specific data during pipeline processing with filtering and verbosity control.

**Key Features**:

- Pipeline stage capture (`component_filtering`, `prerequisite_evaluation`, `target_resolution`)
- Multi-target resolution support
- Legacy action compatibility
- Performance timing integration
- Enhanced filtering capabilities

**Usage Example**:

```javascript
const trace = new ActionAwareStructuredTrace({
  actionTraceFilter: filter,
  actorId: 'actor_123',
  context: { sessionId: 'game_session_456' },
});

// Capture pipeline data
trace.captureActionData('component_filtering', 'movement:go', {
  actorComponents: ['core:position', 'core:movement'],
  requiredComponents: ['core:position'],
  passed: true,
});
```

### ActionExecutionTrace

**Purpose**: Tracks complete action execution lifecycle with high-precision timing and error analysis.

**Key Features**:

- Execution phase tracking (initialization, payload creation, completion)
- High-precision timing with `ExecutionPhaseTimer`
- Error classification with `ErrorClassifier`
- Stack trace analysis with `StackTraceAnalyzer`
- Payload sanitization for security

**Lifecycle Example**:

```javascript
const trace = new ActionExecutionTrace({
  actionId: 'movement:go',
  actorId: 'player_1',
  turnAction: turnActionObject,
  enableTiming: true,
  enableErrorAnalysis: true,
});

// Track execution phases
trace.captureDispatchStart();
trace.captureEventPayload(eventPayload);
trace.captureDispatchResult(result);
// Or on error: trace.captureError(error, context);
```

### ActionTraceOutputService

**Purpose**: Manages trace output, storage, and export with advanced queuing and rotation.

**Key Features**:

- Priority-based queue processing with `TraceQueueProcessor`
- Browser IndexedDB storage with `StorageRotationManager`
- File System Access API export (with download fallback)
- Multiple output formatters
- Circuit breaker pattern for reliability

**Service Setup**:

```javascript
const outputService = new ActionTraceOutputService({
  storageAdapter: indexedDBAdapter,
  actionTraceFilter: filter,
  jsonFormatter: jsonFormatter,
  humanReadableFormatter: textFormatter,
  queueConfig: {
    maxQueueSize: 1000,
    batchSize: 10,
    flushInterval: 5000,
  },
});
```

## API Reference

### Dependency Injection Tokens

```javascript
// Located in: src/dependencyInjection/tokens/actionTracingTokens.js
export const actionTracingTokens = {
  IActionTraceConfigLoader: 'IActionTraceConfigLoader',
  IActionTraceConfigValidator: 'IActionTraceConfigValidator',
  IActionTraceFilter: 'IActionTraceFilter',
  IActionExecutionTraceFactory: 'IActionExecutionTraceFactory',
  IActionTraceOutputService: 'IActionTraceOutputService',
  ITraceDirectoryManager: 'ITraceDirectoryManager',
  IActionAwareStructuredTrace: 'IActionAwareStructuredTrace',
  IEventDispatchTracer: 'IEventDispatchTracer',
  IIndexedDBStorageAdapter: 'IIndexedDBStorageAdapter',
  IJsonTraceFormatter: 'IJsonTraceFormatter',
  IHumanReadableFormatter: 'IHumanReadableFormatter',
};
```

### Service Interfaces

#### IActionTraceFilter

```typescript
interface IActionTraceFilter {
  shouldTrace(actionId: string): boolean;
  getVerbosityLevel(): VerbosityLevel;
  getInclusionConfig(): VerbosityConfig;
  setVerbosityLevel(level: VerbosityLevel): void;
  updateInclusionConfig(config: Partial<VerbosityConfig>): void;
}
```

#### IActionTraceOutputService

```typescript
interface IActionTraceOutputService {
  writeTrace(trace: object, priority?: number): Promise<void>;
  exportTracesToFileSystem(
    traceIds?: string[],
    format?: string
  ): Promise<object>;
  getStatistics(): object;
  shutdown(): Promise<void>;
}
```

### Configuration Schemas

#### VerbosityConfig

```javascript
const verbosityConfig = {
  componentData: boolean, // Include component-related data
  prerequisites: boolean, // Include prerequisite evaluation data
  targets: boolean, // Include target resolution data
};
```

#### Queue Configuration

```javascript
const queueConfig = {
  maxQueueSize: number, // Maximum items in queue (default: 1000)
  batchSize: number, // Items processed per batch (default: 10)
  flushInterval: number, // Auto-flush interval in ms (default: 5000)
  circuitBreakerThreshold: number, // Error threshold (default: 10)
  timerService: object, // Custom timer service
};
```

## Adding Trace Points

### Pipeline Stages Integration

To add tracing to custom pipeline stages:

```javascript
class CustomActionStage {
  constructor({ actionAwareStructuredTrace }) {
    this.trace = actionAwareStructuredTrace;
  }

  async processAction(actionId, context) {
    // Capture stage entry
    this.trace.captureActionData('custom_stage_start', actionId, {
      stageType: 'custom',
      inputCount: context.inputs?.length || 0,
      timestamp: Date.now(),
    });

    try {
      const result = await this.performProcessing(context);

      // Capture successful completion
      this.trace.captureActionData('custom_stage_complete', actionId, {
        success: true,
        outputCount: result.outputs?.length || 0,
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Capture error information
      this.trace.captureActionData('custom_stage_error', actionId, {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
      });
      throw error;
    }
  }
}
```

### Custom Services Integration

For services outside the action pipeline:

```javascript
class CustomGameService {
  constructor({ actionTraceOutputService, logger }) {
    this.outputService = actionTraceOutputService;
    this.logger = logger;
  }

  async performComplexOperation(operationData) {
    // Create execution trace for the operation
    const trace = new ActionExecutionTrace({
      actionId: 'custom:complex_operation',
      actorId: operationData.actorId,
      turnAction: operationData,
      enableTiming: true,
      enableErrorAnalysis: true,
    });

    trace.captureDispatchStart();

    try {
      trace.captureEventPayload({
        operationType: operationData.type,
        parameters: operationData.params,
      });

      const result = await this.executeOperation(operationData);

      trace.captureDispatchResult({
        success: true,
        timestamp: Date.now(),
        metadata: { resultSize: result.data?.length },
      });

      return result;
    } catch (error) {
      trace.captureError(error, {
        phase: 'execution',
        retryCount: 0,
      });
      throw error;
    } finally {
      // Write trace to output service
      await this.outputService.writeTrace(trace);
    }
  }
}
```

### Event Handlers Integration

For event-based tracing:

```javascript
class ActionEventHandler {
  constructor({ eventBus, actionAwareStructuredTrace }) {
    this.eventBus = eventBus;
    this.trace = actionAwareStructuredTrace;

    // Subscribe to action events
    this.eventBus.subscribe(
      'ACTION_STARTED',
      this.handleActionStart.bind(this)
    );
    this.eventBus.subscribe(
      'ACTION_COMPLETED',
      this.handleActionComplete.bind(this)
    );
  }

  handleActionStart(event) {
    this.trace.captureActionData('action_event_start', event.actionId, {
      eventType: 'ACTION_STARTED',
      timestamp: event.timestamp,
      actorId: event.actorId,
      payload: event.payload,
    });
  }

  handleActionComplete(event) {
    this.trace.captureActionData('action_event_complete', event.actionId, {
      eventType: 'ACTION_COMPLETED',
      timestamp: event.timestamp,
      success: event.success,
      duration: event.duration,
      result: event.result,
    });
  }
}
```

### Best Practices for Trace Points

1. **Use descriptive stage names**: Follow convention `stage_type` (e.g., `component_filtering`, `target_resolution`)
2. **Include timing data**: Always add timestamp and duration when available
3. **Sanitize sensitive data**: Never trace passwords, tokens, or personal information
4. **Use appropriate verbosity**: Match data detail to verbosity requirements
5. **Handle errors gracefully**: Tracing failures should not break the main execution flow
6. **Batch related operations**: Group related trace points for efficiency

## Custom Output Formats

### Creating Custom Formatters

#### JSON Formatter Implementation

```javascript
class CustomJsonFormatter {
  constructor({ logger, validationService }) {
    this.logger = logger;
    this.validator = validationService;
  }

  /**
   * Format trace data as JSON
   * @param {object} traceData - Raw trace data
   * @returns {string} Formatted JSON string
   */
  format(traceData) {
    try {
      // Validate input
      this.validator.validateTraceData(traceData);

      // Apply custom formatting logic
      const formatted = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        trace: this.transformTrace(traceData),
        metadata: this.generateMetadata(traceData),
      };

      return JSON.stringify(formatted, this.jsonReplacer, 2);
    } catch (error) {
      this.logger.error('Custom JSON formatting failed', error);
      throw new Error(`Formatting error: ${error.message}`);
    }
  }

  transformTrace(traceData) {
    // Custom transformation logic
    return {
      id: traceData.id || this.generateId(),
      type: traceData.traceType || 'unknown',
      data: this.sanitizeData(traceData),
      timing: this.extractTiming(traceData),
      errors: this.extractErrors(traceData),
    };
  }

  jsonReplacer(key, value) {
    // Custom JSON serialization logic
    if (key.startsWith('_internal')) {
      return undefined; // Exclude internal fields
    }
    if (typeof value === 'function') {
      return '[Function]';
    }
    return value;
  }
}

// Register the formatter
container.register(
  actionTracingTokens.IJsonTraceFormatter,
  CustomJsonFormatter
);
```

#### Human-Readable Formatter Implementation

```javascript
class CustomHumanReadableFormatter {
  constructor({ logger, templateEngine }) {
    this.logger = logger;
    this.templates = templateEngine;
  }

  /**
   * Format trace data as human-readable text
   * @param {object} traceData - Raw trace data
   * @returns {string} Human-readable formatted string
   */
  format(traceData) {
    try {
      const context = this.buildContext(traceData);
      return this.renderTemplate(context);
    } catch (error) {
      this.logger.error('Human-readable formatting failed', error);
      return this.fallbackFormat(traceData);
    }
  }

  buildContext(traceData) {
    return {
      header: this.formatHeader(traceData),
      execution: this.formatExecution(traceData),
      timing: this.formatTiming(traceData),
      errors: this.formatErrors(traceData),
      summary: this.formatSummary(traceData),
    };
  }

  renderTemplate(context) {
    return `
${context.header}
${'='.repeat(50)}

EXECUTION DETAILS:
${context.execution}

TIMING ANALYSIS:
${context.timing}

${context.errors ? 'ERROR DETAILS:\n' + context.errors : ''}

SUMMARY:
${context.summary}
    `.trim();
  }

  fallbackFormat(traceData) {
    return `TRACE DATA (Raw):\n${JSON.stringify(traceData, null, 2)}`;
  }
}
```

### Service Extension

To add custom processing to the output service:

```javascript
class ExtendedActionTraceOutputService extends ActionTraceOutputService {
  constructor(dependencies) {
    super(dependencies);
    this.customProcessors = new Map();
  }

  /**
   * Register custom processor for specific trace types
   */
  registerCustomProcessor(traceType, processor) {
    this.customProcessors.set(traceType, processor);
  }

  async writeTrace(trace, priority) {
    // Apply custom processing if available
    const traceType = this.getTraceType(trace);
    if (this.customProcessors.has(traceType)) {
      const processor = this.customProcessors.get(traceType);
      trace = await processor.process(trace);
    }

    // Call parent implementation
    return super.writeTrace(trace, priority);
  }

  getTraceType(trace) {
    if (trace.toJSON) {
      const data = trace.toJSON();
      return data.metadata?.traceType || 'execution';
    }
    return 'structured';
  }
}
```

## Integration Guide

### Dependency Injection Setup

#### Basic Service Registration

```javascript
// src/dependencyInjection/serviceRegistration.js
import { actionTracingTokens } from './tokens/actionTracingTokens.js';
import { ActionTraceFilter } from '../actions/tracing/actionTraceFilter.js';
import { ActionTraceOutputService } from '../actions/tracing/actionTraceOutputService.js';

export function registerActionTracingServices(container) {
  // Core services
  container.register(
    actionTracingTokens.IActionTraceFilter,
    ActionTraceFilter,
    {
      // Configuration
      enabled: true,
      tracedActions: ['*'],
      verbosityLevel: 'standard',
    }
  );

  container.register(
    actionTracingTokens.IActionTraceOutputService,
    ActionTraceOutputService,
    {
      // Dependencies will be auto-injected
      dependencies: [
        actionTracingTokens.IIndexedDBStorageAdapter,
        actionTracingTokens.IActionTraceFilter,
        actionTracingTokens.IJsonTraceFormatter,
        actionTracingTokens.IHumanReadableFormatter,
      ],
    }
  );
}
```

#### Advanced Configuration

```javascript
// Complex service configuration with custom options
export function registerAdvancedTracingServices(container, config) {
  // Register storage adapter
  container.register(
    actionTracingTokens.IIndexedDBStorageAdapter,
    IndexedDBStorageAdapter,
    {
      databaseName: config.storage.databaseName,
      version: config.storage.version,
    }
  );

  // Register formatters
  container.register(
    actionTracingTokens.IJsonTraceFormatter,
    JsonTraceFormatter,
    {
      schemaValidation: config.formatting.validateSchema,
      includeMetadata: config.formatting.includeMetadata,
    }
  );

  // Register trace filter with environment-specific settings
  container.register(
    actionTracingTokens.IActionTraceFilter,
    ActionTraceFilter,
    {
      enabled: config.tracing.enabled,
      tracedActions: config.tracing.actions,
      verbosityLevel:
        config.environment === 'development' ? 'verbose' : 'standard',
      inclusionConfig: {
        componentData: config.tracing.includeComponents,
        prerequisites: config.tracing.includePrerequisites,
        targets: config.tracing.includeTargets,
      },
    }
  );

  // Register output service with queue configuration
  container.register(
    actionTracingTokens.IActionTraceOutputService,
    ActionTraceOutputService,
    {
      queueConfig: {
        maxQueueSize: config.queue.maxSize,
        batchSize: config.queue.batchSize,
        flushInterval: config.queue.flushInterval,
        circuitBreakerThreshold: config.queue.errorThreshold,
      },
      namingOptions: {
        strategy: config.naming.strategy,
        timestampFormat: config.naming.timestampFormat,
        includeActorId: config.naming.includeActorId,
      },
    }
  );
}
```

### Service Integration Patterns

#### Pipeline Integration

```javascript
// Action pipeline stage with tracing support
class TracedActionStage {
  static get dependencies() {
    return [
      actionTracingTokens.IActionAwareStructuredTrace,
      actionTracingTokens.IActionTraceFilter,
      'ILogger',
    ];
  }

  constructor(trace, filter, logger) {
    this.trace = trace;
    this.filter = filter;
    this.logger = logger;
  }

  async execute(context) {
    const instrumentation = this.#resolveInstrumentation(context);

    instrumentation.stageStarted({
      stage: this.constructor.name,
      actor: context.actor,
      actions: context.actionsWithTargets,
      formattingPath: 'modern',
    });

    try {
      const result = await this.processAction(context, instrumentation);

      instrumentation.stageCompleted({
        formattingPath: 'modern',
        statistics: result.statistics,
        errorCount: 0,
      });

      return result;
    } catch (error) {
      instrumentation.stageCompleted({
        formattingPath: 'modern',
        statistics: { total: 0 },
        errorCount: 1,
      });

      throw error;
    }
  }

  #resolveInstrumentation(context) {
    if (!this.filter.shouldTrace(context.actionId)) {
      return new NoopInstrumentation();
    }

    return new TraceAwareInstrumentation(this.trace);
  }
}
```

#### Event Bus Integration

```javascript
// Event bus with automatic trace correlation
class TracingEventBus {
  static get dependencies() {
    return [
      actionTracingTokens.IEventDispatchTracer,
      actionTracingTokens.IActionTraceOutputService,
      'ILogger',
    ];
  }

  constructor(eventTracer, outputService, logger) {
    this.eventTracer = eventTracer;
    this.outputService = outputService;
    this.logger = logger;
    this.eventQueue = [];
  }

  async dispatch(event) {
    // Create trace for event dispatch
    const trace = this.eventTracer.startTrace(event);

    try {
      const result = await this.processEvent(event);

      this.eventTracer.completeTrace(trace, {
        success: true,
        result: result,
      });

      return result;
    } catch (error) {
      this.eventTracer.errorTrace(trace, error);
      throw error;
    } finally {
      // Write completed trace
      await this.outputService.writeTrace(trace);
    }
  }
}
```

### External Systems Integration

#### Analytics Integration

```javascript
// Custom analytics adapter
class AnalyticsTracingAdapter {
  constructor({ analyticsService, actionTraceFilter }) {
    this.analytics = analyticsService;
    this.filter = actionTraceFilter;
  }

  async sendTraceToAnalytics(trace) {
    if (!this.filter.shouldTrace(trace.actionId)) {
      return;
    }

    const analyticsEvent = this.convertTraceToEvent(trace);
    await this.analytics.track(analyticsEvent);
  }

  convertTraceToEvent(trace) {
    const traceData = trace.toJSON();
    return {
      event: 'action_executed',
      properties: {
        actionId: traceData.metadata.actionId,
        actorId: traceData.metadata.actorId,
        duration: traceData.execution.duration,
        success: !traceData.error,
        timestamp: traceData.execution.startTime,
      },
    };
  }
}

// Register as trace completion handler
container.register('IAnalyticsTracingAdapter', AnalyticsTracingAdapter);
```

#### Monitoring Integration

```javascript
// Performance monitoring integration
class PerformanceMonitoringIntegration {
  constructor({ monitoringService, performanceMonitor }) {
    this.monitoring = monitoringService;
    this.perfMonitor = performanceMonitor;
  }

  integrateWithTracing(outputService) {
    // Hook into trace writing to extract performance metrics
    const originalWriteTrace = outputService.writeTrace.bind(outputService);

    outputService.writeTrace = async (trace, priority) => {
      // Extract performance data
      const perfData = this.extractPerformanceData(trace);

      // Send to monitoring system
      await this.monitoring.recordMetrics(perfData);

      // Continue with normal trace writing
      return originalWriteTrace(trace, priority);
    };
  }

  extractPerformanceData(trace) {
    const data = trace.toJSON();
    return {
      actionId: data.metadata.actionId,
      duration: data.execution.duration,
      memoryUsage: data.timing?.memoryUsage,
      errorRate: data.error ? 1 : 0,
      timestamp: data.execution.startTime,
    };
  }
}
```

## Performance Considerations

### Memory Management

#### Trace Data Lifecycle

```javascript
// Efficient trace management
class EfficientTracingManager {
  constructor({ outputService, config }) {
    this.outputService = outputService;
    this.config = config;
    this.activeTraces = new Map();
    this.tracePool = [];
  }

  createTrace(actionId, actorId) {
    // Reuse trace objects from pool
    let trace = this.tracePool.pop();
    if (!trace) {
      trace = new ActionExecutionTrace({
        actionId,
        actorId,
        turnAction: {},
        enableTiming: this.config.enableTiming,
      });
    } else {
      trace.reset(actionId, actorId);
    }

    this.activeTraces.set(trace.id, trace);
    return trace;
  }

  async completeTrace(trace) {
    try {
      // Write trace to storage
      await this.outputService.writeTrace(trace);
    } finally {
      // Clean up and return to pool
      this.activeTraces.delete(trace.id);
      trace.cleanup();

      // Maintain pool size limits
      if (this.tracePool.length < this.config.maxPoolSize) {
        this.tracePool.push(trace);
      }
    }
  }

  // Cleanup stale traces
  cleanupStaleTraces() {
    const maxAge = this.config.maxTraceAge || 300000; // 5 minutes
    const now = Date.now();

    for (const [id, trace] of this.activeTraces) {
      if (now - trace.startTime > maxAge) {
        this.activeTraces.delete(id);
        trace.cleanup();
      }
    }
  }
}
```

#### Memory-Efficient Data Structures

```javascript
// Circular buffer for trace data
class CircularTraceBuffer {
  constructor(maxSize = 1000) {
    this.buffer = new Array(maxSize);
    this.size = maxSize;
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  add(trace) {
    this.buffer[this.head] = trace;
    this.head = (this.head + 1) % this.size;

    if (this.count < this.size) {
      this.count++;
    } else {
      this.tail = (this.tail + 1) % this.size;
    }
  }

  getRecentTraces(n = 100) {
    const traces = [];
    let index = this.head - 1;

    for (let i = 0; i < Math.min(n, this.count); i++) {
      if (index < 0) index = this.size - 1;
      traces.push(this.buffer[index]);
      index--;
    }

    return traces;
  }
}
```

### Async Processing Optimization

#### Batch Processing

```javascript
// Optimized batch processor
class OptimizedBatchProcessor {
  constructor({ outputService, batchConfig }) {
    this.outputService = outputService;
    this.config = batchConfig;
    this.pendingTraces = [];
    this.processingBatch = false;
    this.scheduleTimer = null;
  }

  async addTrace(trace) {
    this.pendingTraces.push(trace);

    // Trigger immediate processing if batch is full
    if (this.pendingTraces.length >= this.config.maxBatchSize) {
      await this.processBatch();
    } else if (!this.scheduleTimer) {
      // Schedule delayed processing
      this.scheduleTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.maxWaitTime);
    }
  }

  async processBatch() {
    if (this.processingBatch || this.pendingTraces.length === 0) {
      return;
    }

    this.processingBatch = true;
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    const batch = this.pendingTraces.splice(0, this.config.maxBatchSize);

    try {
      // Process traces in parallel with concurrency limit
      const concurrency = this.config.maxConcurrency || 3;
      const chunks = this.chunkArray(batch, concurrency);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((trace) => this.outputService.writeTrace(trace))
        );
      }
    } catch (error) {
      console.error('Batch processing failed', error);
      // Could implement retry logic here
    } finally {
      this.processingBatch = false;

      // Process remaining traces if any
      if (this.pendingTraces.length > 0) {
        setImmediate(() => this.processBatch());
      }
    }
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
```

#### Queue Optimization

```javascript
// Priority queue with backpressure handling
class PriorityTraceQueue {
  constructor({ maxSize, backpressureThreshold }) {
    this.queues = new Map([
      ['high', []],
      ['normal', []],
      ['low', []],
    ]);
    this.maxSize = maxSize;
    this.backpressureThreshold = backpressureThreshold;
    this.droppedCount = 0;
  }

  enqueue(trace, priority = 'normal') {
    const totalSize = this.getTotalSize();

    if (totalSize >= this.maxSize) {
      // Drop low priority items first
      this.dropLowPriorityItems();
    }

    if (this.getTotalSize() >= this.maxSize) {
      this.droppedCount++;
      return false; // Queue full, trace dropped
    }

    const queue = this.queues.get(priority) || this.queues.get('normal');
    queue.push(trace);

    return true;
  }

  dequeue() {
    // Process high priority first, then normal, then low
    for (const priority of ['high', 'normal', 'low']) {
      const queue = this.queues.get(priority);
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return null;
  }

  getTotalSize() {
    return Array.from(this.queues.values()).reduce(
      (total, queue) => total + queue.length,
      0
    );
  }

  dropLowPriorityItems() {
    const lowQueue = this.queues.get('low');
    if (lowQueue.length > 0) {
      this.droppedCount += lowQueue.length;
      lowQueue.length = 0; // Clear low priority queue
    }
  }
}
```

## Testing Strategy

### Unit Testing Framework

The action tracing system includes comprehensive test infrastructure located in the `tests/` directory with the following structure:

- `tests/unit/actions/tracing/` - Unit tests for individual components
- `tests/integration/actions/tracing/` - Integration tests for component interactions
- `tests/performance/actions/tracing/` - Performance benchmarks and tests
- `tests/memory/actions/tracing/` - Memory usage and leak detection tests
- `tests/common/tracing/` - Test utilities and helper classes

#### Test Utilities

```javascript
// tests/common/tracing/traceTestUtils.js
export class TraceTestUtils {
  static createMockTrace(overrides = {}) {
    return {
      actionId: 'test:action',
      actorId: 'test_actor',
      isComplete: true,
      hasError: false,
      duration: 100,
      toJSON: () => ({
        metadata: { actionId: 'test:action', actorId: 'test_actor' },
        execution: { duration: 100, startTime: Date.now() },
        ...overrides,
      }),
      getExecutionPhases: () => [
        { phase: 'start', timestamp: Date.now() - 100 },
        { phase: 'complete', timestamp: Date.now() },
      ],
      ...overrides,
    };
  }

  static createMockFilter(config = {}) {
    return {
      shouldTrace: jest.fn().mockReturnValue(true),
      getVerbosityLevel: jest.fn().mockReturnValue('standard'),
      getInclusionConfig: jest.fn().mockReturnValue({
        componentData: true,
        prerequisites: false,
        targets: true,
      }),
      ...config,
    };
  }

  static createMockStorageAdapter() {
    const storage = new Map();
    return {
      getItem: jest
        .fn()
        .mockImplementation((key) => Promise.resolve(storage.get(key))),
      setItem: jest.fn().mockImplementation((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn().mockImplementation((key) => {
        storage.delete(key);
        return Promise.resolve();
      }),
      getAllKeys: jest
        .fn()
        .mockImplementation(() => Promise.resolve([...storage.keys()])),
    };
  }
}
```

#### Component Unit Tests

```javascript
// tests/unit/actions/tracing/actionTraceFilter.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { TraceTestUtils } from '../../../common/tracing/traceTestUtils.js';

describe('ActionTraceFilter', () => {
  let filter;

  beforeEach(() => {
    filter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:*', 'game:combat'],
      excludedActions: ['debug:*'],
      verbosityLevel: 'standard',
    });
  });

  describe('shouldTrace', () => {
    it('should trace actions matching patterns', () => {
      expect(filter.shouldTrace('movement:go')).toBe(true);
      expect(filter.shouldTrace('game:combat')).toBe(true);
      expect(filter.shouldTrace('core:look')).toBe(true);
    });

    it('should exclude actions matching exclusion patterns', () => {
      expect(filter.shouldTrace('debug:log')).toBe(false);
      expect(filter.shouldTrace('debug:trace')).toBe(false);
    });

    it('should handle system actions specially', () => {
      expect(filter.shouldTrace('__system_init')).toBe(true);
      expect(filter.shouldTrace('__system_shutdown')).toBe(true);
    });
  });

  describe('verbosity configuration', () => {
    it('should validate verbosity levels', () => {
      expect(() => filter.setVerbosityLevel('invalid')).toThrow();
      expect(() => filter.setVerbosityLevel('verbose')).not.toThrow();
    });

    it('should update inclusion config', () => {
      filter.updateInclusionConfig({ componentData: false });
      const config = filter.getInclusionConfig();
      expect(config.componentData).toBe(false);
    });
  });
});
```

#### Integration Tests

```javascript
// tests/integration/actions/tracing/actionTracingIntegration.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { TraceTestUtils } from '../../../common/tracing/traceTestUtils.js';

describe('Action Tracing Integration', () => {
  let filter, trace, outputService, storageAdapter;

  beforeEach(() => {
    storageAdapter = TraceTestUtils.createMockStorageAdapter();
    filter = new ActionTraceFilter({ enabled: true, tracedActions: ['*'] });
    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'test_actor',
    });
    outputService = new ActionTraceOutputService({ storageAdapter });
  });

  afterEach(async () => {
    await outputService.shutdown();
  });

  it('should capture and store action pipeline data', async () => {
    // Simulate pipeline execution
    trace.captureActionData('component_filtering', 'movement:go', {
      actorComponents: ['position', 'movement'],
      requiredComponents: ['position'],
      passed: true,
    });

    trace.captureActionData('target_resolution', 'movement:go', {
      targets: [{ type: 'entity', id: 'door_1' }],
      resolved: true,
    });

    // Write trace to storage
    await outputService.writeTrace(trace);

    // Verify storage
    const stored = await storageAdapter.getItem('actionTraces');
    expect(stored).toHaveLength(1);
    expect(stored[0].data.actions['movement:go']).toBeDefined();
    expect(stored[0].data.actions['movement:go'].stages).toHaveProperty(
      'component_filtering'
    );
    expect(stored[0].data.actions['movement:go'].stages).toHaveProperty(
      'target_resolution'
    );
  });

  it('should respect filtering configuration', async () => {
    filter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['game:*'],
      excludedActions: ['debug:*'],
    });

    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'test_actor',
    });

    // Should trace game actions
    trace.captureActionData('test_stage', 'game:combat', { data: 'test' });
    expect(trace.getTracedActions().size).toBe(1);

    // Should not trace debug actions
    trace.captureActionData('test_stage', 'debug:log', { data: 'test' });
    expect(trace.getTracedActions().size).toBe(1); // Still 1, debug not traced
  });
});
```

### Performance Testing

```javascript
// tests/performance/actions/tracing/tracePerformance.test.js
import { describe, it, expect } from '@jest/globals';
import { TraceTestUtils } from '../../../common/tracing/traceTestUtils.js';
import ActionExecutionTrace from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('Trace Performance', () => {
  it('should handle high-volume trace creation efficiently', () => {
    const startTime = performance.now();
    const traces = [];

    // Create 10,000 traces
    for (let i = 0; i < 10000; i++) {
      const trace = new ActionExecutionTrace({
        actionId: `action_${i}`,
        actorId: `actor_${i}`,
        turnAction: { id: i },
        enableTiming: true,
      });
      traces.push(trace);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(traces).toHaveLength(10000);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should efficiently capture and serialize trace data', () => {
    const trace = new ActionExecutionTrace({
      actionId: 'performance:test',
      actorId: 'perf_actor',
      turnAction: { complex: 'data'.repeat(1000) },
      enableTiming: true,
    });

    const startTime = performance.now();

    // Simulate trace lifecycle
    trace.captureDispatchStart();
    trace.captureEventPayload({ large: 'payload'.repeat(1000) });
    trace.captureDispatchResult({ success: true });

    // Serialize multiple times
    for (let i = 0; i < 1000; i++) {
      JSON.stringify(trace.toJSON());
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(500); // Should be fast
  });
});
```

### Memory Testing

```javascript
// tests/memory/actions/tracing/traceMemoryUsage.test.js
import { describe, it, expect, afterEach } from '@jest/globals';
import { TraceTestUtils } from '../../../common/tracing/traceTestUtils.js';

describe('Trace Memory Usage', () => {
  let traces = [];

  afterEach(() => {
    // Cleanup to prevent memory leaks in tests
    traces.length = 0;
    if (global.gc) {
      global.gc();
    }
  });

  it('should not leak memory with repeated trace creation', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and discard many traces
    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < 1000; i++) {
        const trace = TraceTestUtils.createMockTrace();
        trace.toJSON(); // Simulate usage
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be minimal (less than 10MB)
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });
});
```

### Best Practices for Testing

1. **Use Test Utilities**: Leverage the provided test utilities for consistent mock objects
2. **Test Error Paths**: Always test error conditions and edge cases
3. **Performance Benchmarks**: Set performance expectations and test against them
4. **Memory Leak Detection**: Use memory tests to prevent leaks in long-running applications
5. **Integration Coverage**: Test component interactions, not just isolated units
6. **Async Testing**: Use proper async/await patterns for testing Promise-based APIs

## Maintenance Guide

### Code Organization

The action tracing codebase follows a modular structure with clear separation of concerns:

```
src/actions/tracing/
├── core/                    # Core tracing interfaces and base classes
│   ├── actionTraceFilter.js
│   ├── structuredTrace.js
│   └── traceContext.js
├── execution/               # Execution lifecycle tracing
│   ├── actionExecutionTrace.js
│   ├── actionExecutionTraceFactory.js
│   └── executionPhaseTimer.js
├── pipeline/               # Pipeline-specific tracing
│   ├── actionAwareStructuredTrace.js
│   └── pipelinePerformanceAnalyzer.js
├── storage/               # Storage and persistence
│   ├── actionTraceOutputService.js
│   ├── storageRotationManager.js
│   └── traceQueueProcessor.js
├── formatting/           # Output formatters
│   ├── jsonTraceFormatter.js
│   └── humanReadableFormatter.js
├── analysis/            # Analysis and classification
│   ├── errorClassification.js
│   ├── stackTraceAnalyzer.js
│   └── traceAnalyzer.js
└── utils/              # Utilities and helpers
    ├── traceIdGenerator.js
    ├── tracePriority.js
    └── timerService.js
```

### Update Procedures

#### Adding New Trace Types

1. **Create trace interface**:

```javascript
// src/actions/tracing/interfaces/customTraceInterface.js
export class CustomTraceInterface {
  constructor(config) {
    this.config = config;
  }

  // Define interface methods
  captureData(stage, data) {
    throw new Error('Must implement captureData');
  }

  getTraceData() {
    throw new Error('Must implement getTraceData');
  }
}
```

2. **Add dependency injection token**:

```javascript
// In actionTracingTokens.js
export const actionTracingTokens = {
  // ... existing tokens
  ICustomTraceInterface: 'ICustomTraceInterface',
};
```

3. **Create implementation**:

```javascript
// src/actions/tracing/customTrace.js
export class CustomTrace extends CustomTraceInterface {
  // Implementation
}
```

4. **Add tests**:

```javascript
// tests/unit/actions/tracing/customTrace.test.js
// tests/integration/actions/tracing/customTraceIntegration.test.js
```

5. **Update documentation**:
   - Add API documentation to this guide
   - Update user guide if user-facing
   - Add examples and integration patterns

#### Extending Formatters

1. **Create formatter interface** (if needed):

```javascript
export class CustomFormatterInterface {
  format(data) {
    throw new Error('Must implement format method');
  }
}
```

2. **Implement formatter**:

```javascript
export class CustomFormatter extends CustomFormatterInterface {
  format(data) {
    // Custom formatting logic
    return this.transformData(data);
  }
}
```

3. **Register with DI container**:

```javascript
container.register(tokens.ICustomFormatter, CustomFormatter);
```

4. **Add to output service** (if automatic detection desired):

```javascript
// In ActionTraceOutputService
if (this.customFormatter) {
  formattedData = this.customFormatter.format(data);
}
```

#### Performance Optimization Updates

1. **Profile existing code**:

```bash
# Run performance tests
npm run test:performance

# Memory profiling
npm run test:memory
```

2. **Identify bottlenecks**:
   - Use browser DevTools for client-side profiling
   - Analyze test results for performance regressions
   - Monitor memory usage patterns

3. **Implement optimizations**:
   - Update algorithms for better time complexity
   - Implement caching where appropriate
   - Optimize data structures for memory efficiency

4. **Validate improvements**:
   - Re-run performance tests
   - Ensure no functionality regression
   - Update performance benchmarks if needed

### Backward Compatibility

#### Versioning Strategy

The tracing system uses semantic versioning with backward compatibility guarantees:

- **Major versions**: Breaking API changes
- **Minor versions**: New features, backward compatible
- **Patch versions**: Bug fixes, backward compatible

#### Compatibility Layers

```javascript
// Legacy compatibility for old trace formats
export class LegacyTraceCompatibilityLayer {
  constructor(modernTraceService) {
    this.modernService = modernTraceService;
  }

  // Support old API while delegating to new implementation
  writeTrace(legacyTrace) {
    const modernTrace = this.convertLegacyTrace(legacyTrace);
    return this.modernService.writeTrace(modernTrace);
  }

  convertLegacyTrace(legacyTrace) {
    // Convert old format to new format
    return {
      actionId: legacyTrace.action || legacyTrace.id,
      actorId: legacyTrace.actor || 'unknown',
      // ... other conversions
    };
  }
}
```

#### Migration Guides

When making breaking changes, provide clear migration documentation:

````markdown
## Migration from v1.x to v2.x

### Changed APIs

1. **ActionTraceFilter constructor**:

   ```javascript
   // Old (v1.x)
   new ActionTraceFilter(enabled, actions, verbosity);

   // New (v2.x)
   new ActionTraceFilter({
     enabled,
     tracedActions: actions,
     verbosityLevel: verbosity,
   });
   ```
````

2. **Trace output format**:
   - `timestamp` field now uses ISO 8601 format
   - `metadata` object structure changed
   - `phases` array replaced with `stages` object

### Migration Steps

1. Update constructor calls to use configuration objects
2. Update code that reads trace output format
3. Run tests to verify functionality
4. Update dependencies that depend on old formats

````

### Release Process

1. **Preparation**:
   - Run full test suite: `npm run test:ci`
   - Update version numbers
   - Update CHANGELOG.md
   - Review backward compatibility impact

2. **Testing**:
   - Integration tests with dependent systems
   - Performance regression testing
   - Browser compatibility testing

3. **Documentation**:
   - Update API documentation
   - Review and update examples
   - Migration guide (if needed)

4. **Release**:
   - Create release branch
   - Tag release
   - Deploy to staging environment
   - Production deployment

## Contributing

### Development Setup

1. **Clone and install**:
```bash
git clone <repository-url>
cd living-narrative-engine
npm install
````

2. **Development environment**:

```bash
# Start development server
npm run dev

# Run tests in watch mode
npm run test:watch

# Run specific tracing tests
npm run test:unit -- --testPathPattern=tracing
```

3. **Code quality tools**:

```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Formatting
npm run format
```

### Code Standards

#### File Structure

- Follow existing directory structure
- Use descriptive file names
- Include JSDoc comments for all public APIs
- Add unit tests for all new functionality

#### Naming Conventions

- Classes: `PascalCase` (e.g., `ActionTraceFilter`)
- Functions: `camelCase` (e.g., `captureActionData`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PRIORITY`)
- Private fields: `#fieldName` (e.g., `#logger`)

#### Error Handling

- Use descriptive error messages
- Implement proper error classification
- Don't let tracing errors break main functionality
- Log errors appropriately without exposing sensitive data

#### Performance Guidelines

- Avoid unnecessary object creation in hot paths
- Use appropriate data structures for the use case
- Implement lazy loading where beneficial
- Profile performance-critical code

### Pull Request Process

1. **Before submitting**:
   - Run full test suite: `npm run test:ci`
   - Ensure code follows style guide: `npm run lint`
   - Add/update tests for changed functionality
   - Update documentation if API changes

2. **PR Description**:
   - Describe the problem being solved
   - Explain the approach taken
   - List any breaking changes
   - Include test coverage information

3. **Review process**:
   - Code review by maintainers
   - Automated testing via CI
   - Performance impact assessment
   - Documentation review

4. **Merge requirements**:
   - All tests passing
   - Code review approval
   - No merge conflicts
   - Documentation updated

### Development Guidelines

#### Adding New Features

1. **Design phase**:
   - Define clear requirements
   - Consider performance implications
   - Plan API design and backward compatibility
   - Create technical design document

2. **Implementation phase**:
   - Start with interface definition
   - Implement core functionality
   - Add comprehensive tests
   - Create usage examples

3. **Integration phase**:
   - Test with existing components
   - Update dependency injection setup
   - Verify performance characteristics
   - Update documentation

#### Bug Fixes

1. **Reproduction**:
   - Create failing test case
   - Identify root cause
   - Assess impact and urgency

2. **Fix**:
   - Implement minimal fix
   - Ensure fix doesn't break other functionality
   - Add regression test
   - Update documentation if needed

3. **Verification**:
   - Run all affected tests
   - Performance impact assessment
   - Manual testing if needed

### Community

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Documentation**: Contribute to documentation improvements
- **Testing**: Help improve test coverage and quality

---

## Conclusion

This developer guide provides comprehensive information for working with the Living Narrative Engine's action tracing system. The system is designed to be extensible, performant, and maintainable, with clear separation of concerns and comprehensive testing infrastructure.

For additional help or questions, please refer to the user guide or create an issue in the project repository.
