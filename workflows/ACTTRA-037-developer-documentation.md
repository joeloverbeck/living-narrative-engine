# ACTTRA-037: Write Developer Documentation

## Summary

Create comprehensive developer documentation for the action tracing system, including architecture overview, extension points, API documentation, integration guides, and development best practices for extending and maintaining the system.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating developer-oriented documentation that explains the internal architecture, design patterns, and extension mechanisms of the action tracing system. The documentation must enable developers to understand the system's implementation, add new trace points, create custom output formats, integrate with other systems, and maintain the codebase effectively.

## Acceptance Criteria

- [ ] Developer guide created at `docs/action-tracing-development.md`
- [ ] Complete architecture overview with diagrams
- [ ] API documentation for all public interfaces
- [ ] Extension point documentation with examples
- [ ] Integration guide for adding trace points
- [ ] Custom output format creation guide
- [ ] Performance optimization guide
- [ ] Code examples for common extensions
- [ ] Dependency injection setup documented
- [ ] Testing strategy documentation

## Technical Requirements

### Document Structure

```markdown
# Action Tracing System Developer Guide

## Table of Contents
1. Architecture Overview
2. Core Components
3. API Reference
4. Adding Trace Points
5. Custom Output Formats
6. Integration Guide
7. Performance Considerations
8. Testing Strategy
9. Maintenance Guide
10. Contributing

## 1. Architecture Overview

### System Design
### Data Flow
### Component Interactions
### Design Patterns

## 2. Core Components

### ActionTraceFilter
### ActionAwareStructuredTrace
### ActionExecutionTrace
### ActionTraceOutputService
### Pipeline Integration

## 3. API Reference

### Public Interfaces
### Service Contracts
### Event Schemas
### Configuration Schemas

## 4. Adding Trace Points

### Pipeline Stages
### Custom Stages
### Event Handlers
### Data Capture

## 5. Custom Output Formats

### Output Service Extension
### Formatter Interface
### Custom Serialization

## 6. Integration Guide

### Dependency Injection
### Service Registration
### Event Bus Integration
### External Systems

## 7. Performance Considerations

### Optimization Techniques
### Memory Management
### Async Processing

## 8. Testing Strategy

### Unit Testing
### Integration Testing
### Performance Testing

## 9. Maintenance Guide

### Code Organization
### Update Procedures
### Backward Compatibility

## 10. Contributing

### Development Setup
### Code Standards
### Pull Request Process
```

### Section 1: Architecture Overview

```markdown
## 1. Architecture Overview

### System Design

The action tracing system follows a modular, event-driven architecture that integrates seamlessly with the existing game engine:

```
┌─────────────────────────────────────────────────────────┐
│                    Configuration Layer                   │
│              (trace-config.json + Schema)                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 ActionTraceFilter                        │
│         (Filtering & Verbosity Control)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Pipeline Integration Layer                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │   ActionAwareStructuredTrace (extends Trace)      │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Pipeline Stages (Component, Prerequisites...)   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│             Execution Tracing Layer                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         ActionExecutionTrace                      │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │      CommandProcessor Integration                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Output Generation Layer                   │
│         (ActionTraceOutputService + Queue)               │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Configuration Loading**
   - System reads `trace-config.json` on startup
   - ActionTraceFilter validates and caches configuration
   - Hot-reload supported via file watchers

2. **Pipeline Processing**
   - ActionDiscoveryService creates trace context
   - Each pipeline stage captures relevant data
   - Data filtered based on verbosity settings

3. **Execution Capture**
   - CommandProcessor checks if action should be traced
   - Creates ActionExecutionTrace for tracked actions
   - Captures timing, payloads, and results

4. **Output Generation**
   - Traces queued for async processing
   - Multiple format outputs (JSON, text)
   - File rotation and cleanup

### Component Interactions

```javascript
// Simplified interaction flow
class ActionDiscoveryService {
  async getValidActions(actor, context, options) {
    // 1. Check if tracing is enabled
    if (this.#actionTraceFilter?.isEnabled()) {
      // 2. Create enhanced trace context
      const trace = new ActionAwareStructuredTrace({
        actionTraceFilter: this.#actionTraceFilter,
        actorId: actor.id,
        context
      });
      
      // 3. Process through pipeline
      const result = await this.#pipeline.execute({
        actor,
        trace,
        ...context
      });
      
      // 4. Output captured traces
      await this.#outputService.writeTrace(trace);
    }
  }
}
```

### Design Patterns

#### Decorator Pattern
The system extends existing StructuredTrace without modifying it:

```javascript
// Decorates existing trace with action-specific functionality
class ActionAwareStructuredTrace extends StructuredTrace {
  captureActionData(stage, actionId, data) {
    // Additional functionality
  }
}
```

#### Strategy Pattern
Different output formats via pluggable formatters:

```javascript
class OutputFormatter {
  format(trace) { /* abstract */ }
}

class JsonFormatter extends OutputFormatter { }
class TextFormatter extends OutputFormatter { }
```

#### Observer Pattern
Pipeline stages notify trace system of events:

```javascript
// Stage notifies trace of processing
trace.captureActionData('component_filtering', actionId, {
  components: actor.components,
  result: filterResult
});
```
```

### Section 2: Core Components

```markdown
## 2. Core Components

### ActionTraceFilter

**Purpose**: Controls which actions are traced and at what detail level.

**Key Interfaces**:
```javascript
class ActionTraceFilter {
  /**
   * Check if tracing is globally enabled
   * @returns {boolean}
   */
  isEnabled()

  /**
   * Check if specific action should be traced
   * @param {string} actionId - Action identifier (e.g., 'core:go')
   * @returns {boolean}
   */
  shouldTrace(actionId)

  /**
   * Get configured verbosity level
   * @returns {'minimal'|'standard'|'detailed'|'verbose'}
   */
  getVerbosityLevel()

  /**
   * Get data inclusion configuration
   * @returns {Object} Configuration for what data to include
   */
  getInclusionConfig()
}
```

**Implementation Details**:
- Uses Set for O(1) exact match lookups
- Compiles regex patterns for wildcard matching
- Caches configuration for performance
- Supports hot-reload via file watchers

**Extension Points**:
```javascript
// Custom filter implementation
class CustomActionTraceFilter extends ActionTraceFilter {
  shouldTrace(actionId) {
    // Add custom logic
    if (this.isDebugAction(actionId)) {
      return true;
    }
    return super.shouldTrace(actionId);
  }
}
```

### ActionAwareStructuredTrace

**Purpose**: Extends StructuredTrace to capture action-specific data during pipeline processing.

**Key Methods**:
```javascript
class ActionAwareStructuredTrace extends StructuredTrace {
  /**
   * Capture action data at a pipeline stage
   * @param {string} stage - Pipeline stage name
   * @param {string} actionId - Action being processed
   * @param {Object} data - Stage-specific data
   */
  captureActionData(stage, actionId, data)

  /**
   * Get all traced action data
   * @returns {Map<string, Object>} Map of actionId to trace data
   */
  getTracedActions()

  /**
   * Filter data based on verbosity settings
   * @private
   */
  #filterDataByVerbosity(data)
}
```

**Data Structure**:
```javascript
{
  actionId: 'core:go',
  actorId: 'player-1',
  startTime: 1234567890123,
  stages: {
    component_filtering: {
      timestamp: 1234567890125,
      data: { /* filtered stage data */ }
    },
    prerequisite_evaluation: { /* ... */ },
    target_resolution: { /* ... */ },
    formatting: { /* ... */ }
  }
}
```

### ActionExecutionTrace

**Purpose**: Captures execution-time data when actions are dispatched.

**Interface**:
```javascript
class ActionExecutionTrace {
  constructor({ actionId, actorId, turnAction })
  
  captureDispatchStart()
  captureEventPayload(payload)
  captureDispatchResult(result)
  captureError(error)
  
  toJSON() // Serialization for output
}
```

**Usage in CommandProcessor**:
```javascript
async dispatchAction(actor, turnAction) {
  let actionTrace = null;
  
  if (this.#actionTraceFilter?.shouldTrace(actionId)) {
    actionTrace = new ActionExecutionTrace({
      actionId,
      actorId: actor.id,
      turnAction
    });
    actionTrace.captureDispatchStart();
  }
  
  // ... dispatch logic ...
  
  if (actionTrace) {
    actionTrace.captureDispatchResult(result);
    await this.#outputService.writeTrace(actionTrace);
  }
}
```

### ActionTraceOutputService

**Purpose**: Manages async output of traces to files with rotation.

**Key Features**:
- Non-blocking async queue processing
- Multiple output format support
- Automatic file rotation
- Directory auto-creation

**Implementation**:
```javascript
class ActionTraceOutputService {
  #outputQueue = []
  #isProcessing = false
  
  async writeTrace(trace) {
    this.#outputQueue.push(trace);
    if (!this.#isProcessing) {
      this.#processQueue();
    }
  }
  
  async #processQueue() {
    this.#isProcessing = true;
    while (this.#outputQueue.length > 0) {
      const trace = this.#outputQueue.shift();
      await this.#writeTraceToFile(trace);
    }
    this.#isProcessing = false;
  }
}
```

### Pipeline Integration Points

**Modified Pipeline Stages**:

1. **ComponentFilteringStage**
```javascript
async executeInternal(context) {
  // Existing logic...
  
  if (trace?.captureActionData) {
    candidateActions.forEach(action => {
      trace.captureActionData('component_filtering', action.id, {
        actorComponents: Array.from(actor.components.keys()),
        requiredComponents: action.requiredComponents
      });
    });
  }
}
```

2. **PrerequisiteEvaluationStage**
3. **MultiTargetResolutionStage**
4. **ActionFormattingStage**

Each stage follows the same pattern of checking for trace support and capturing relevant data.
```

### Section 3: API Reference

```markdown
## 3. API Reference

### Public Interfaces

#### IActionTraceFilter

```typescript
interface IActionTraceFilter {
  isEnabled(): boolean;
  shouldTrace(actionId: string): boolean;
  getVerbosityLevel(): 'minimal' | 'standard' | 'detailed' | 'verbose';
  getInclusionConfig(): {
    componentData: boolean;
    prerequisites: boolean;
    targets: boolean;
  };
  getOutputDirectory(): string;
}
```

#### IActionTraceOutputService

```typescript
interface IActionTraceOutputService {
  writeTrace(trace: ActionTrace): Promise<void>;
  flush(): Promise<void>;
  getQueueSize(): number;
}
```

#### ActionTrace Types

```typescript
type ActionTrace = ActionExecutionTrace | ActionAwareStructuredTrace;

interface TraceData {
  actionId: string;
  actorId: string;
  timestamp: string;
  pipeline?: PipelineTraceData;
  execution?: ExecutionTraceData;
}

interface PipelineTraceData {
  componentFiltering?: StageData;
  prerequisiteEvaluation?: StageData;
  targetResolution?: StageData;
  formatting?: StageData;
}

interface ExecutionTraceData {
  startTime: number;
  endTime: number;
  duration: number;
  eventPayload?: any;
  result?: any;
  error?: ErrorData;
}
```

### Service Contracts

#### Registration with Dependency Injection

```javascript
// Token definitions
export const actionTracingTokens = {
  IActionTraceFilter: Symbol('IActionTraceFilter'),
  IActionTraceOutputService: Symbol('IActionTraceOutputService'),
  IActionTraceConfigLoader: Symbol('IActionTraceConfigLoader'),
};

// Service registration
container.register(
  actionTracingTokens.IActionTraceFilter,
  (deps) => new ActionTraceFilter({
    configLoader: deps.configLoader,
    logger: deps.logger
  }),
  {
    lifetime: 'singleton',
    dependencies: {
      configLoader: actionTracingTokens.IActionTraceConfigLoader,
      logger: tokens.ILogger
    }
  }
);
```

#### Service Dependencies

```javascript
// ActionTraceFilter dependencies
{
  configLoader: IConfigLoader,  // Required
  logger: ILogger               // Required
}

// ActionTraceOutputService dependencies
{
  fileSystem: IFileSystem,           // Required
  logger: ILogger,                   // Required
  actionTraceFilter: IActionTraceFilter  // Required
}
```

### Event Schemas

#### Trace Started Event

```json
{
  "type": "ACTION_TRACE_STARTED",
  "payload": {
    "actionId": "string",
    "actorId": "string",
    "timestamp": "number"
  }
}
```

#### Trace Completed Event

```json
{
  "type": "ACTION_TRACE_COMPLETED",
  "payload": {
    "actionId": "string",
    "actorId": "string",
    "duration": "number",
    "success": "boolean"
  }
}
```

### Configuration Schema

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
          "description": "Enable/disable tracing"
        },
        "tracedActions": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^([a-z_]+:[a-z_]+|\\*|[a-z_]+:\\*)$"
          }
        },
        "outputDirectory": {
          "type": "string"
        },
        "verbosity": {
          "type": "string",
          "enum": ["minimal", "standard", "detailed", "verbose"]
        },
        "includeComponentData": {
          "type": "boolean"
        },
        "includePrerequisites": {
          "type": "boolean"
        },
        "includeTargets": {
          "type": "boolean"
        },
        "maxTraceFiles": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        },
        "rotationPolicy": {
          "type": "string",
          "enum": ["age", "count"]
        },
        "maxFileAge": {
          "type": "integer",
          "minimum": 3600
        }
      },
      "required": ["enabled", "tracedActions", "outputDirectory"]
    }
  }
}
```
```

### Section 4: Adding Trace Points

```markdown
## 4. Adding Trace Points

### Adding Traces to Pipeline Stages

#### Step 1: Identify the Stage

Locate the pipeline stage where you want to add tracing:

```javascript
// src/actions/pipeline/stages/YourCustomStage.js
class YourCustomStage extends PipelineStage {
  async executeInternal(context) {
    const { actor, trace } = context;
    // Your stage logic
  }
}
```

#### Step 2: Check for Trace Support

Always check if trace capture is available:

```javascript
if (trace?.captureActionData) {
  // Tracing is enabled and supported
}
```

#### Step 3: Capture Relevant Data

```javascript
async executeInternal(context) {
  const { actor, candidateActions, trace } = context;
  
  // Your stage processing
  const processedActions = this.processActions(candidateActions);
  
  // Capture trace data
  if (trace?.captureActionData) {
    processedActions.forEach(action => {
      trace.captureActionData('your_stage_name', action.id, {
        // Include relevant data
        actorId: actor.id,
        inputCount: candidateActions.length,
        outputCount: processedActions.length,
        // Stage-specific data
        customField: this.getCustomData(action),
        timestamp: Date.now()
      });
    });
  }
  
  return PipelineResult.success({
    data: { processedActions }
  });
}
```

### Adding Traces to Custom Services

#### Example: Adding to a Custom Action Service

```javascript
class CustomActionService {
  #actionTraceFilter;
  #outputService;
  
  constructor({ actionTraceFilter, outputService, ...deps }) {
    this.#actionTraceFilter = actionTraceFilter;
    this.#outputService = outputService;
  }
  
  async processCustomAction(actionId, actor, params) {
    // Check if this action should be traced
    if (!this.#actionTraceFilter?.shouldTrace(actionId)) {
      return this.#processWithoutTracing(actionId, actor, params);
    }
    
    // Create trace context
    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: this.#actionTraceFilter,
      actorId: actor.id,
      context: { actionId, params }
    });
    
    // Capture processing stages
    trace.captureActionData('custom_processing', actionId, {
      stage: 'initialization',
      params,
      actorState: this.#getActorState(actor)
    });
    
    try {
      // Process action
      const result = await this.#doProcessing(actionId, actor, params);
      
      trace.captureActionData('custom_processing', actionId, {
        stage: 'completion',
        result,
        duration: Date.now() - trace.startTime
      });
      
      // Write trace
      await this.#outputService.writeTrace(trace);
      
      return result;
    } catch (error) {
      trace.captureActionData('custom_processing', actionId, {
        stage: 'error',
        error: error.message,
        stack: error.stack
      });
      
      await this.#outputService.writeTrace(trace);
      throw error;
    }
  }
}
```

### Adding Traces to Event Handlers

```javascript
class CustomEventHandler {
  #actionTraceFilter;
  
  async handleActionEvent(event) {
    const { actionId, actor } = event.payload;
    
    if (this.#actionTraceFilter?.shouldTrace(actionId)) {
      // Create execution trace
      const trace = new ActionExecutionTrace({
        actionId,
        actorId: actor.id,
        eventType: event.type
      });
      
      trace.captureDispatchStart();
      
      try {
        const result = await this.#processEvent(event);
        trace.captureDispatchResult(result);
      } catch (error) {
        trace.captureError(error);
      }
      
      await this.#outputService.writeTrace(trace);
    }
  }
}
```

### Best Practices for Trace Points

1. **Minimize Performance Impact**
```javascript
// Good: Check trace enabled first
if (trace?.captureActionData) {
  const expensiveData = this.computeExpensiveData();
  trace.captureActionData('stage', actionId, expensiveData);
}

// Bad: Always compute data
const expensiveData = this.computeExpensiveData();
if (trace?.captureActionData) {
  trace.captureActionData('stage', actionId, expensiveData);
}
```

2. **Include Contextual Information**
```javascript
trace.captureActionData('validation', actionId, {
  // Good: Include context
  validationRule: rule.id,
  inputValue: value,
  expectedType: rule.expectedType,
  actualType: typeof value,
  result: validationResult,
  
  // Include timing
  timestamp: Date.now(),
  duration: endTime - startTime
});
```

3. **Use Consistent Stage Names**
```javascript
// Use snake_case for stage names
'component_filtering'     // ✓ Good
'prerequisite_evaluation' // ✓ Good
'ComponentFiltering'      // ✗ Bad
'prerequisite-eval'       // ✗ Bad
```

4. **Handle Sensitive Data**
```javascript
trace.captureActionData('auth_check', actionId, {
  userId: actor.id,
  hasPermission: result,
  // Don't include sensitive data
  // password: user.password  // ✗ Never
  // token: auth.token        // ✗ Never
});
```
```

### Section 5: Custom Output Formats

```markdown
## 5. Custom Output Formats

### Creating a Custom Formatter

#### Step 1: Define the Formatter Interface

```javascript
// src/actions/tracing/formatters/customFormatter.js

class CustomFormatter {
  /**
   * Format trace data for output
   * @param {Object} traceData - Raw trace data
   * @param {Object} options - Formatter options
   * @returns {string} Formatted output
   */
  format(traceData, options = {}) {
    throw new Error('format() must be implemented');
  }
  
  /**
   * Get file extension for this format
   * @returns {string}
   */
  getExtension() {
    throw new Error('getExtension() must be implemented');
  }
}
```

#### Step 2: Implement Your Formatter

```javascript
// Example: CSV Formatter
class CsvFormatter extends CustomFormatter {
  format(traceData, options = {}) {
    const rows = [];
    
    // Header
    rows.push('Timestamp,Action,Actor,Stage,Duration,Status');
    
    // Pipeline stages
    if (traceData.pipeline) {
      Object.entries(traceData.pipeline).forEach(([stage, data]) => {
        rows.push([
          new Date(data.timestamp).toISOString(),
          traceData.actionId,
          traceData.actorId,
          stage,
          data.duration || 0,
          data.passed ? 'PASSED' : 'FAILED'
        ].join(','));
      });
    }
    
    // Execution
    if (traceData.execution) {
      rows.push([
        new Date(traceData.execution.startTime).toISOString(),
        traceData.actionId,
        traceData.actorId,
        'execution',
        traceData.execution.duration,
        traceData.execution.result?.success ? 'SUCCESS' : 'FAILED'
      ].join(','));
    }
    
    return rows.join('\n');
  }
  
  getExtension() {
    return 'csv';
  }
}
```

#### Step 3: Register the Formatter

```javascript
// src/actions/tracing/formatters/formatterRegistry.js

class FormatterRegistry {
  #formatters = new Map();
  
  register(name, formatter) {
    this.#formatters.set(name, formatter);
  }
  
  get(name) {
    return this.#formatters.get(name);
  }
  
  getAll() {
    return Array.from(this.#formatters.entries());
  }
}

// Registration
const registry = new FormatterRegistry();
registry.register('json', new JsonFormatter());
registry.register('text', new TextFormatter());
registry.register('csv', new CsvFormatter());  // Your custom formatter
```

### Extending the Output Service

```javascript
// src/actions/tracing/extendedOutputService.js

class ExtendedOutputService extends ActionTraceOutputService {
  #formatterRegistry;
  
  constructor({ formatterRegistry, ...deps }) {
    super(deps);
    this.#formatterRegistry = formatterRegistry;
  }
  
  async #writeTraceToFile(trace) {
    const outputDir = this.#actionTraceFilter.getOutputDirectory();
    const filename = this.#generateFilename(trace);
    
    // Get enabled formatters from config
    const enabledFormats = this.#getEnabledFormats();
    
    // Write in each format
    for (const formatName of enabledFormats) {
      const formatter = this.#formatterRegistry.get(formatName);
      if (formatter) {
        const formatted = formatter.format(trace);
        const extension = formatter.getExtension();
        const filepath = `${outputDir}/${filename}.${extension}`;
        
        await this.#fileSystem.writeFile(filepath, formatted);
      }
    }
  }
}
```

### Custom Serialization Strategies

#### Binary Format Example

```javascript
class BinaryFormatter extends CustomFormatter {
  format(traceData) {
    // Use MessagePack for efficient binary serialization
    const msgpack = require('msgpack-lite');
    return msgpack.encode(traceData);
  }
  
  getExtension() {
    return 'msgpack';
  }
  
  // Add deserialization support
  parse(buffer) {
    const msgpack = require('msgpack-lite');
    return msgpack.decode(buffer);
  }
}
```

#### Compressed Format Example

```javascript
class CompressedJsonFormatter extends CustomFormatter {
  async format(traceData) {
    const pako = require('pako');
    const json = JSON.stringify(traceData);
    const compressed = pako.gzip(json);
    return compressed;
  }
  
  getExtension() {
    return 'json.gz';
  }
  
  async parse(buffer) {
    const pako = require('pako');
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    return JSON.parse(decompressed);
  }
}
```

### Stream-Based Output

For high-volume tracing:

```javascript
class StreamingOutputService {
  #writeStream;
  
  async initializeStream(filepath) {
    const fs = require('fs');
    this.#writeStream = fs.createWriteStream(filepath, {
      flags: 'a',  // Append mode
      encoding: 'utf8'
    });
  }
  
  async writeTrace(trace) {
    const formatted = this.#formatter.format(trace);
    return new Promise((resolve, reject) => {
      this.#writeStream.write(formatted + '\n', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  async closeStream() {
    return new Promise((resolve) => {
      this.#writeStream.end(resolve);
    });
  }
}
```
```

### Section 6: Integration Guide

```markdown
## 6. Integration Guide

### Dependency Injection Setup

#### Step 1: Define Tokens

```javascript
// src/dependencyInjection/tokens/actionTracingTokens.js

export const actionTracingTokens = {
  IActionTraceFilter: Symbol('IActionTraceFilter'),
  IActionTraceOutputService: Symbol('IActionTraceOutputService'),
  IActionTraceConfigLoader: Symbol('IActionTraceConfigLoader'),
  IFormatterRegistry: Symbol('IFormatterRegistry'),
};
```

#### Step 2: Create Container Configuration

```javascript
// src/dependencyInjection/containers/actionTracingContainer.js

import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';

export function registerActionTracing(container) {
  const setup = new ServiceSetup();
  
  // Register config loader
  container.register(
    actionTracingTokens.IActionTraceConfigLoader,
    (deps) => {
      const logger = setup.setupService(
        'ActionTraceConfigLoader',
        deps.logger,
        {
          configLoader: {
            value: deps.configLoader,
            requiredMethods: ['loadConfig']
          }
        }
      );
      
      return new ActionTraceConfigLoader({
        configLoader: deps.configLoader,
        logger
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        configLoader: tokens.IConfigLoader,
        logger: tokens.ILogger
      }
    }
  );
  
  // Register filter
  container.register(
    actionTracingTokens.IActionTraceFilter,
    (deps) => new ActionTraceFilter(deps),
    {
      lifetime: 'singleton',
      dependencies: {
        configLoader: actionTracingTokens.IActionTraceConfigLoader,
        logger: tokens.ILogger
      }
    }
  );
  
  // Register output service
  container.register(
    actionTracingTokens.IActionTraceOutputService,
    (deps) => new ActionTraceOutputService(deps),
    {
      lifetime: 'singleton',
      dependencies: {
        fileSystem: tokens.IFileSystem,
        logger: tokens.ILogger,
        actionTraceFilter: actionTracingTokens.IActionTraceFilter
      }
    }
  );
}
```

#### Step 3: Integrate with Main Container

```javascript
// src/dependencyInjection/container.js

import { registerActionTracing } from './containers/actionTracingContainer.js';

export function setupContainer() {
  const container = new Container();
  
  // Register core services
  registerCore(container);
  
  // Register action tracing
  registerActionTracing(container);
  
  // Register other systems
  registerActions(container);
  
  return container;
}
```

### Service Integration

#### Integrating with ActionDiscoveryService

```javascript
class ActionDiscoveryService {
  #actionTraceFilter;
  #outputService;
  
  constructor({
    actionTraceFilter,
    outputService,
    ...otherDeps
  }) {
    // Optional dependencies with validation
    this.#actionTraceFilter = actionTraceFilter || null;
    this.#outputService = outputService || null;
    
    if (this.#actionTraceFilter) {
      validateDependency(
        this.#actionTraceFilter,
        'IActionTraceFilter',
        null,
        {
          requiredMethods: ['isEnabled', 'shouldTrace']
        }
      );
    }
  }
  
  async getValidActions(actor, context, options = {}) {
    // Check if tracing should be enhanced
    const shouldEnhanceTrace = 
      this.#actionTraceFilter?.isEnabled() && 
      options.trace;
    
    if (shouldEnhanceTrace) {
      // Enhance trace with action-specific capabilities
      const enhancedTrace = this.#enhanceTrace(options.trace);
      // Process with enhanced trace
    }
  }
}
```

### Event Bus Integration

#### Publishing Trace Events

```javascript
class ActionTraceEventPublisher {
  #eventBus;
  
  publishTraceStarted(actionId, actorId) {
    this.#eventBus.dispatch({
      type: 'ACTION_TRACE_STARTED',
      payload: {
        actionId,
        actorId,
        timestamp: Date.now()
      }
    });
  }
  
  publishTraceCompleted(actionId, actorId, result) {
    this.#eventBus.dispatch({
      type: 'ACTION_TRACE_COMPLETED',
      payload: {
        actionId,
        actorId,
        success: result.success,
        duration: result.duration
      }
    });
  }
}
```

#### Subscribing to Trace Events

```javascript
class TraceEventListener {
  constructor({ eventBus }) {
    eventBus.subscribe('ACTION_TRACE_STARTED', this.handleTraceStarted);
    eventBus.subscribe('ACTION_TRACE_COMPLETED', this.handleTraceCompleted);
  }
  
  handleTraceStarted = (event) => {
    console.log(`Trace started: ${event.payload.actionId}`);
  }
  
  handleTraceCompleted = (event) => {
    console.log(`Trace completed: ${event.payload.actionId} in ${event.payload.duration}ms`);
  }
}
```

### External System Integration

#### Example: Sending Traces to External Service

```javascript
class ExternalTraceExporter {
  #apiClient;
  #batchSize = 100;
  #buffer = [];
  
  constructor({ apiClient, actionTraceFilter }) {
    this.#apiClient = apiClient;
    
    // Listen for trace completion
    eventBus.subscribe('ACTION_TRACE_COMPLETED', this.handleTrace);
  }
  
  handleTrace = async (event) => {
    this.#buffer.push(event.payload);
    
    if (this.#buffer.length >= this.#batchSize) {
      await this.flush();
    }
  }
  
  async flush() {
    if (this.#buffer.length === 0) return;
    
    const batch = this.#buffer.splice(0, this.#batchSize);
    
    try {
      await this.#apiClient.post('/traces', {
        traces: batch,
        timestamp: Date.now()
      });
    } catch (error) {
      this.#logger.error('Failed to export traces', error);
      // Implement retry logic
    }
  }
}
```

#### Example: Metrics Collection

```javascript
class TraceMetricsCollector {
  #metrics = {
    totalTraces: 0,
    averageDuration: 0,
    errorRate: 0,
    stageTimings: {}
  };
  
  collectFromTrace(trace) {
    this.#metrics.totalTraces++;
    
    // Update average duration
    if (trace.execution) {
      const currentAvg = this.#metrics.averageDuration;
      const newAvg = (currentAvg * (this.#metrics.totalTraces - 1) + 
                     trace.execution.duration) / this.#metrics.totalTraces;
      this.#metrics.averageDuration = newAvg;
    }
    
    // Track stage timings
    if (trace.pipeline) {
      Object.entries(trace.pipeline).forEach(([stage, data]) => {
        if (!this.#metrics.stageTimings[stage]) {
          this.#metrics.stageTimings[stage] = {
            count: 0,
            totalDuration: 0
          };
        }
        
        this.#metrics.stageTimings[stage].count++;
        this.#metrics.stageTimings[stage].totalDuration += data.duration || 0;
      });
    }
    
    // Update error rate
    if (trace.execution?.error) {
      this.#metrics.errorRate = 
        (this.#metrics.errorRate * (this.#metrics.totalTraces - 1) + 1) / 
        this.#metrics.totalTraces;
    }
  }
  
  getMetrics() {
    return { ...this.#metrics };
  }
}
```
```

### Section 7: Performance Considerations

```markdown
## 7. Performance Considerations

### Optimization Techniques

#### 1. Lazy Evaluation

```javascript
class OptimizedActionTraceFilter {
  #compiledPatterns = null;
  
  // Compile patterns only when needed
  get compiledPatterns() {
    if (!this.#compiledPatterns) {
      this.#compiledPatterns = this.#compilePatterns();
    }
    return this.#compiledPatterns;
  }
  
  shouldTrace(actionId) {
    // Fast path: exact match
    if (this.#exactMatches.has(actionId)) {
      return true;
    }
    
    // Slow path: pattern matching (lazy compiled)
    return this.compiledPatterns.some(pattern => 
      pattern.test(actionId)
    );
  }
}
```

#### 2. Object Pooling

```javascript
class TraceObjectPool {
  #pool = [];
  #maxSize = 100;
  
  acquire() {
    if (this.#pool.length > 0) {
      return this.#pool.pop();
    }
    return new ActionExecutionTrace();
  }
  
  release(trace) {
    if (this.#pool.length < this.#maxSize) {
      trace.reset();  // Clear data
      this.#pool.push(trace);
    }
  }
}

// Usage
const tracePool = new TraceObjectPool();
const trace = tracePool.acquire();
try {
  // Use trace
} finally {
  tracePool.release(trace);
}
```

#### 3. Batched File Operations

```javascript
class BatchedOutputService {
  #batchSize = 10;
  #batchTimeout = 1000; // ms
  #batch = [];
  #timer = null;
  
  async writeTrace(trace) {
    this.#batch.push(trace);
    
    if (this.#batch.length >= this.#batchSize) {
      await this.#flush();
    } else if (!this.#timer) {
      this.#timer = setTimeout(() => this.#flush(), this.#batchTimeout);
    }
  }
  
  async #flush() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    
    if (this.#batch.length === 0) return;
    
    const traces = this.#batch.splice(0);
    
    // Write all traces in single operation
    const content = traces.map(t => JSON.stringify(t)).join('\n');
    await this.#fileSystem.appendFile(this.#outputFile, content);
  }
}
```

### Memory Management

#### 1. Data Size Limits

```javascript
class MemoryAwareTrace {
  #maxDataSize = 10000; // characters
  #dataSize = 0;
  
  captureActionData(stage, actionId, data) {
    const serialized = JSON.stringify(data);
    
    if (this.#dataSize + serialized.length > this.#maxDataSize) {
      // Truncate or skip data
      this.#logger.warn(`Trace data exceeds size limit for ${actionId}`);
      return;
    }
    
    this.#dataSize += serialized.length;
    // Store data
  }
}
```

#### 2. Circular Reference Handling

```javascript
class SafeJsonSerializer {
  serialize(obj) {
    const seen = new WeakSet();
    
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    });
  }
}
```

#### 3. Memory Leak Prevention

```javascript
class TraceManager {
  #traces = new Map();
  #maxTraces = 1000;
  
  addTrace(id, trace) {
    // Prevent unlimited growth
    if (this.#traces.size >= this.#maxTraces) {
      // Remove oldest trace
      const firstKey = this.#traces.keys().next().value;
      this.#traces.delete(firstKey);
    }
    
    this.#traces.set(id, trace);
    
    // Set expiration
    setTimeout(() => {
      this.#traces.delete(id);
    }, 60000); // 1 minute TTL
  }
}
```

### Async Processing

#### 1. Non-Blocking Queue

```javascript
class AsyncTraceQueue {
  #queue = [];
  #processing = false;
  #maxConcurrent = 3;
  #activeCount = 0;
  
  async enqueue(task) {
    this.#queue.push(task);
    this.#process();
  }
  
  async #process() {
    if (this.#processing || this.#activeCount >= this.#maxConcurrent) {
      return;
    }
    
    this.#processing = true;
    
    while (this.#queue.length > 0 && this.#activeCount < this.#maxConcurrent) {
      const task = this.#queue.shift();
      this.#activeCount++;
      
      task().finally(() => {
        this.#activeCount--;
        this.#process();
      });
    }
    
    this.#processing = false;
  }
}
```

#### 2. Worker Thread Processing

```javascript
// traceWorker.js
const { parentPort } = require('worker_threads');

parentPort.on('message', (trace) => {
  // Process trace in worker thread
  const formatted = formatTrace(trace);
  parentPort.postMessage(formatted);
});

// Main thread
const { Worker } = require('worker_threads');

class WorkerBasedFormatter {
  #worker;
  
  constructor() {
    this.#worker = new Worker('./traceWorker.js');
  }
  
  async format(trace) {
    return new Promise((resolve) => {
      this.#worker.once('message', resolve);
      this.#worker.postMessage(trace);
    });
  }
}
```

### Performance Benchmarks

```javascript
class TraceBenchmark {
  async measureOverhead() {
    const iterations = 1000;
    const actionId = 'test:action';
    
    // Baseline: without tracing
    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await this.executeAction(actionId, false);
    }
    const baselineTime = performance.now() - baselineStart;
    
    // With tracing
    const tracingStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await this.executeAction(actionId, true);
    }
    const tracingTime = performance.now() - tracingStart;
    
    const overhead = (tracingTime - baselineTime) / iterations;
    console.log(`Average overhead per action: ${overhead.toFixed(2)}ms`);
    
    return {
      baseline: baselineTime / iterations,
      withTracing: tracingTime / iterations,
      overhead
    };
  }
}
```
```

### Section 8: Testing Strategy

```markdown
## 8. Testing Strategy

### Unit Testing

#### Testing ActionTraceFilter

```javascript
// tests/unit/actions/tracing/actionTraceFilter.unit.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

describe('ActionTraceFilter', () => {
  let filter;
  let mockConfigLoader;
  let mockLogger;
  
  beforeEach(() => {
    mockConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:take', 'custom:*'],
          verbosity: 'standard'
        }
      })
    };
    
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    };
    
    filter = new ActionTraceFilter({
      configLoader: mockConfigLoader,
      logger: mockLogger
    });
  });
  
  describe('shouldTrace', () => {
    it('should match exact action IDs', async () => {
      await filter.initialize();
      expect(filter.shouldTrace('core:go')).toBe(true);
      expect(filter.shouldTrace('core:take')).toBe(true);
      expect(filter.shouldTrace('core:drop')).toBe(false);
    });
    
    it('should support wildcard patterns', async () => {
      await filter.initialize();
      expect(filter.shouldTrace('custom:anything')).toBe(true);
      expect(filter.shouldTrace('custom:test')).toBe(true);
      expect(filter.shouldTrace('other:test')).toBe(false);
    });
    
    it('should handle disabled tracing', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: { enabled: false }
      });
      
      await filter.initialize();
      expect(filter.isEnabled()).toBe(false);
      expect(filter.shouldTrace('core:go')).toBe(false);
    });
  });
});
```

#### Testing ActionExecutionTrace

```javascript
describe('ActionExecutionTrace', () => {
  let trace;
  
  beforeEach(() => {
    trace = new ActionExecutionTrace({
      actionId: 'core:go',
      actorId: 'player-1',
      turnAction: {
        commandString: 'go north',
        parameters: { direction: 'north' }
      }
    });
  });
  
  it('should capture dispatch timing', () => {
    const startTime = Date.now();
    trace.captureDispatchStart();
    
    // Simulate delay
    const delay = 100;
    jest.advanceTimersByTime(delay);
    
    trace.captureDispatchResult({ success: true });
    
    const data = trace.toJSON();
    expect(data.execution.startTime).toBeGreaterThanOrEqual(startTime);
    expect(data.execution.duration).toBeGreaterThanOrEqual(delay);
  });
  
  it('should capture errors with stack traces', () => {
    const error = new Error('Test error');
    trace.captureError(error);
    
    const data = trace.toJSON();
    expect(data.execution.error).toBeDefined();
    expect(data.execution.error.message).toBe('Test error');
    expect(data.execution.error.stack).toBeDefined();
  });
});
```

### Integration Testing

#### Testing Pipeline Integration

```javascript
// tests/integration/actions/tracing/pipelineIntegration.test.js

describe('Action Tracing Pipeline Integration', () => {
  let testBed;
  
  beforeEach(() => {
    testBed = new ActionTracingTestBed();
    testBed.setupPipeline();
  });
  
  it('should trace through all pipeline stages', async () => {
    const actor = testBed.createActor('test-actor', {
      components: ['core:position', 'core:inventory']
    });
    
    const result = await testBed.runPipeline(actor, {
      trace: true,
      tracedActions: ['core:go']
    });
    
    const traces = testBed.getCollectedTraces();
    expect(traces).toHaveLength(1);
    
    const trace = traces[0];
    expect(trace.pipeline).toBeDefined();
    expect(trace.pipeline.componentFiltering).toBeDefined();
    expect(trace.pipeline.prerequisiteEvaluation).toBeDefined();
    expect(trace.pipeline.targetResolution).toBeDefined();
    expect(trace.pipeline.formatting).toBeDefined();
  });
});
```

### Performance Testing

```javascript
// tests/performance/actions/tracing/tracingOverhead.perf.test.js

describe('Action Tracing Performance', () => {
  let benchmark;
  
  beforeEach(() => {
    benchmark = new TracingBenchmark();
  });
  
  it('should have minimal overhead when disabled', async () => {
    const results = await benchmark.measureOverhead({
      enabled: false
    });
    
    expect(results.overhead).toBeLessThan(0.1); // <0.1ms overhead
  });
  
  it('should handle high-frequency actions', async () => {
    const results = await benchmark.measureThroughput({
      enabled: true,
      tracedActions: ['*'],
      verbosity: 'minimal'
    });
    
    expect(results.actionsPerSecond).toBeGreaterThan(100);
  });
  
  it('should not leak memory', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Run many traces
    for (let i = 0; i < 10000; i++) {
      await benchmark.runSingleTrace();
    }
    
    // Force garbage collection
    global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Allow some growth but not unlimited
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // <10MB
  });
});
```

### Test Utilities

```javascript
// tests/common/actions/tracingTestUtils.js

export class MockActionTraceFilter {
  #enabledActions;
  
  constructor(enabledActions = []) {
    this.#enabledActions = enabledActions;
  }
  
  isEnabled() { return true; }
  
  shouldTrace(actionId) {
    return this.#enabledActions.includes(actionId) ||
           this.#enabledActions.includes('*');
  }
  
  getVerbosityLevel() { return 'standard'; }
}

export class TraceCollector {
  #traces = [];
  
  writeTrace(trace) {
    this.#traces.push(trace);
    return Promise.resolve();
  }
  
  getTraces() { return this.#traces; }
  clear() { this.#traces = []; }
}

export function createMockTrace() {
  return {
    captureActionData: jest.fn(),
    getTracedActions: jest.fn().mockReturnValue(new Map()),
    withSpanAsync: jest.fn()
  };
}
```
```

### Section 9: Maintenance Guide

```markdown
## 9. Maintenance Guide

### Code Organization

```
src/actions/tracing/
├── index.js                        # Public exports
├── actionTraceFilter.js            # Filtering logic
├── actionTraceTypes.js             # Type definitions
├── actionAwareStructuredTrace.js   # Pipeline trace extension
├── actionExecutionTrace.js         # Execution trace
├── actionTraceOutputService.js     # File output
├── formatters/
│   ├── formatterInterface.js       # Base formatter
│   ├── jsonFormatter.js            # JSON output
│   ├── textFormatter.js            # Human-readable output
│   └── formatterRegistry.js        # Formatter management
├── config/
│   ├── actionTraceConfigLoader.js  # Config loading
│   ├── configurationCache.js       # Config caching
│   └── configValidator.js          # Schema validation
└── utils/
    ├── patternMatcher.js           # Wildcard matching
    ├── fileRotation.js             # File management
    └── traceHelpers.js             # Utility functions
```

### Update Procedures

#### Adding New Configuration Options

1. **Update Schema**
```json
// data/schemas/action-trace-config.schema.json
{
  "properties": {
    "actionTracing": {
      "properties": {
        // Add new property
        "newOption": {
          "type": "string",
          "description": "New option description"
        }
      }
    }
  }
}
```

2. **Update Filter**
```javascript
// actionTraceFilter.js
getNewOption() {
  return this.#config?.actionTracing?.newOption || 'default';
}
```

3. **Update Documentation**
- Add to user guide configuration section
- Add to developer API reference
- Update configuration examples

#### Upgrading Dependencies

```javascript
// Check compatibility before upgrading
class DependencyChecker {
  async checkCompatibility() {
    const deps = {
      'json-logic-js': '^2.0.0',
      'ajv': '^8.0.0',
      'pako': '^2.0.0'
    };
    
    for (const [dep, version] of Object.entries(deps)) {
      const installed = await this.getInstalledVersion(dep);
      if (!this.isCompatible(installed, version)) {
        console.warn(`${dep} version ${installed} may not be compatible`);
      }
    }
  }
}
```

### Backward Compatibility

#### Maintaining API Compatibility

```javascript
class BackwardCompatibleFilter extends ActionTraceFilter {
  // New method with default behavior
  shouldTraceWithContext(actionId, context = {}) {
    // New functionality
    if (context.forceTrace) return true;
    
    // Fall back to original behavior
    return this.shouldTrace(actionId);
  }
  
  // Deprecated method with warning
  /** @deprecated Use shouldTraceWithContext instead */
  shouldTrace(actionId) {
    console.warn('shouldTrace is deprecated, use shouldTraceWithContext');
    return super.shouldTrace(actionId);
  }
}
```

#### Configuration Migration

```javascript
class ConfigMigrator {
  migrate(config) {
    const version = config.version || '1.0.0';
    
    if (version < '2.0.0') {
      // Migrate from v1 to v2
      config = this.migrateV1ToV2(config);
    }
    
    if (version < '3.0.0') {
      // Migrate from v2 to v3
      config = this.migrateV2ToV3(config);
    }
    
    return config;
  }
  
  migrateV1ToV2(config) {
    // Rename old fields
    if (config.actionTracing.enabledActions) {
      config.actionTracing.tracedActions = config.actionTracing.enabledActions;
      delete config.actionTracing.enabledActions;
    }
    
    config.version = '2.0.0';
    return config;
  }
}
```

### Monitoring and Diagnostics

#### Health Checks

```javascript
class TraceSystemHealthCheck {
  async checkHealth() {
    const checks = {
      configLoaded: await this.checkConfig(),
      outputDirectoryWritable: await this.checkOutputDir(),
      queueSize: this.checkQueueSize(),
      memoryUsage: this.checkMemory()
    };
    
    const healthy = Object.values(checks).every(c => c.status === 'ok');
    
    return {
      healthy,
      checks,
      timestamp: Date.now()
    };
  }
  
  async checkConfig() {
    try {
      const config = await this.configLoader.loadConfig();
      return { status: 'ok', config: config.actionTracing };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}
```

#### Debug Logging

```javascript
class DebugTraceLogger {
  #debugEnabled = process.env.DEBUG_TRACES === 'true';
  
  logFilterDecision(actionId, result, reason) {
    if (!this.#debugEnabled) return;
    
    console.debug('[TraceFilter]', {
      actionId,
      shouldTrace: result,
      reason,
      timestamp: Date.now()
    });
  }
  
  logOutputQueueStatus() {
    if (!this.#debugEnabled) return;
    
    console.debug('[TraceOutput]', {
      queueSize: this.#queue.length,
      processing: this.#isProcessing,
      timestamp: Date.now()
    });
  }
}
```

### Troubleshooting Common Issues

| Issue | Diagnostic Steps | Solution |
|-------|------------------|----------|
| Traces not generated | 1. Check config enabled<br>2. Verify action in tracedActions<br>3. Check output dir permissions | Enable tracing, add action to list, fix permissions |
| High memory usage | 1. Check queue size<br>2. Monitor trace data size<br>3. Check for memory leaks | Reduce verbosity, implement rotation, fix leaks |
| Performance degradation | 1. Measure overhead<br>2. Check traced action count<br>3. Profile hot paths | Reduce traced actions, optimize filters, use minimal verbosity |
| File write failures | 1. Check disk space<br>2. Verify permissions<br>3. Check file locks | Free disk space, fix permissions, implement retry logic |
```

### Section 10: Contributing

```markdown
## 10. Contributing

### Development Setup

#### Prerequisites

1. **Node.js 18+** with ES modules support
2. **Git** for version control
3. **IDE** with ESLint and Prettier support

#### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/living-narrative-engine.git
cd living-narrative-engine

# Install dependencies
npm install

# Run tests to verify setup
npm run test:unit
npm run test:integration

# Start development server
npm run dev
```

#### Development Environment

```bash
# Enable debug logging
export DEBUG_TRACES=true
export LOG_LEVEL=debug

# Use development config
cp config/trace-config.dev.json config/trace-config.json
```

### Code Standards

#### File Structure

```javascript
/**
 * @file actionTraceFilter.js
 * @description Filters actions for tracing based on configuration
 * @module actions/tracing
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Filters actions for tracing
 * @class
 */
class ActionTraceFilter {
  // Private fields first
  #config;
  #logger;
  
  /**
   * @param {Object} deps - Dependencies
   * @param {IConfigLoader} deps.configLoader - Configuration loader
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ configLoader, logger }) {
    validateDependency(configLoader, 'IConfigLoader');
    validateDependency(logger, 'ILogger');
    
    this.#config = null;
    this.#logger = logger;
  }
  
  // Public methods
  
  // Private methods last
}

export default ActionTraceFilter;
```

#### Naming Conventions

- **Classes**: PascalCase (`ActionTraceFilter`)
- **Methods**: camelCase (`shouldTrace`)
- **Private fields**: Prefix with # (`#config`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TRACE_SIZE`)
- **Files**: camelCase (`actionTraceFilter.js`)

#### Documentation

```javascript
/**
 * Checks if an action should be traced
 * @param {string} actionId - The action identifier (e.g., 'core:go')
 * @returns {boolean} True if action should be traced
 * @throws {Error} If configuration is not loaded
 * @example
 * const shouldTrace = filter.shouldTrace('core:go');
 */
shouldTrace(actionId) {
  if (!this.#config) {
    throw new Error('Configuration not loaded');
  }
  // Implementation
}
```

### Pull Request Process

#### 1. Create Feature Branch

```bash
git checkout -b feature/ACTTRA-XXX-description
```

#### 2. Implement Changes

- Write tests first (TDD)
- Implement feature
- Update documentation
- Ensure all tests pass

#### 3. Commit Guidelines

```bash
# Format: type(scope): description
git commit -m "feat(tracing): add custom output formatter support"
git commit -m "fix(tracing): resolve memory leak in trace queue"
git commit -m "docs(tracing): update API documentation"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `perf`: Performance
- `refactor`: Code refactoring

#### 4. Pre-Submission Checklist

- [ ] All tests pass (`npm run test:ci`)
- [ ] Code coverage maintained (>80%)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated
- [ ] Performance impact measured
- [ ] Backward compatibility maintained

#### 5. Create Pull Request

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #ACTTRA-XXX

## Changes Made
- Added feature X
- Fixed bug Y
- Updated docs

## Testing
- Unit tests added/updated
- Integration tests added/updated
- Manual testing performed

## Performance Impact
- Measured overhead: <5ms
- Memory usage: No increase

## Breaking Changes
None / Description of breaking changes

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Lint passes
- [ ] Performance validated
```

### Testing Requirements

#### Test Coverage

- Minimum 80% branch coverage
- 90% line coverage
- 100% for critical paths

#### Test Structure

```javascript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = createInput();
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe(expected);
    });
    
    it('should handle edge case', () => {
      // Test edge cases
    });
    
    it('should handle error case', () => {
      // Test error conditions
    });
  });
});
```

### Release Process

1. **Version Bump**
```bash
npm version minor  # For features
npm version patch  # For fixes
```

2. **Update Changelog**
```markdown
## [2.1.0] - 2024-01-20
### Added
- Custom output formatter support
### Fixed
- Memory leak in trace queue
```

3. **Create Release**
```bash
git tag v2.1.0
git push origin v2.1.0
```

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**For System Version**: 1.0.0+