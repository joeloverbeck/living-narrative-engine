# Living Narrative Engine - Action System Analysis Report

## Executive Summary

This report provides a comprehensive analysis of how actions are processed in the Living Narrative Engine. The action system follows a multi-stage pipeline from discovery through validation to execution, with clear separation of concerns and performance optimizations throughout.

## Table of Contents

1. [Action System Architecture](#action-system-architecture)
2. [Action Schema Definition](#action-schema-definition)
3. [Action Discovery Pipeline](#action-discovery-pipeline)
4. [Action Validation & Prerequisites](#action-validation--prerequisites)
5. [Target Resolution via Scope DSL](#target-resolution-via-scope-dsl)
6. [Action Dispatch & Execution](#action-dispatch--execution)
7. [Key Components & Services](#key-components--services)
8. [Performance Optimizations](#performance-optimizations)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [Integration Points](#integration-points)
11. [Recommendations for Improvement](#recommendations-for-improvement)

## Action System Architecture

The action system in Living Narrative Engine follows a sophisticated pipeline that processes actions from definition to execution:

```
Action Definition (JSON) → Discovery → Validation → Target Resolution → Dispatch → Execution
```

### Core Design Principles

1. **Data-Driven**: All actions are defined in JSON files following the action schema
2. **Performance-First**: Uses indexing and caching to optimize action discovery
3. **Separation of Concerns**: Clear boundaries between discovery, validation, and execution
4. **Extensible**: Support for mods to add new actions without modifying core code
5. **Traceable**: Comprehensive logging and optional tracing for debugging

## Action Schema Definition

Actions are defined using a JSON schema located at `data/schemas/action.schema.json`. Each action definition contains:

### Required Fields

- **`id`**: Unique identifier in format `modId:actionName`
- **`description`**: Human-readable description of the action
- **`commandVerb`**: Single canonical verb (e.g., 'go', 'take', 'look')
- **`name`**: Display name for UI elements
- **`scope`**: Namespaced DSL scope for target resolution
- **`template`**: Text template for command generation

### Optional Fields

- **`required_components`**: High-level pre-filtering by component requirements
- **`prerequisites`**: JSON Logic rules for actor/world state validation

### Example Action Definition

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "core:go",
  "description": "Move to an adjacent location",
  "commandVerb": "go",
  "name": "Go",
  "scope": "core:directions",
  "required_components": {
    "actor": ["core:movement"]
  },
  "prerequisites": [
    {
      "logic": {
        "!": { "var": "actor.components.core:rooted.isRooted" }
      },
      "failure_message": "You cannot move while rooted"
    }
  ],
  "template": "go {target}"
}
```

## Action Discovery Pipeline

The action discovery process follows these stages:

### 1. Action Indexing (Startup)

**Service**: `ActionIndex` (`src/actions/actionIndex.js`)

- Builds index of all action definitions at startup
- Creates two data structures:
  - `byActorComponent`: Map of component ID → actions requiring that component
  - `noActorRequirement`: Array of actions with no component requirements
- Enables O(1) lookup of candidate actions based on actor components

### 2. Discovery Request

**Service**: `ActionDiscoveryService` (`src/actions/actionDiscoveryService.js`)

Entry point: `getValidActions(actorEntity, baseContext, options)`

Process:

1. Validates actor entity
2. Prepares discovery context with actor location
3. Fetches candidate actions from index
4. Processes candidates in parallel
5. Returns discovered actions and errors

### 3. Candidate Processing

**Service**: `ActionCandidateProcessor` (`src/actions/actionCandidateProcessor.js`)

For each candidate action:

1. Check actor prerequisites
2. Resolve targets via scope
3. Format actions for valid targets

## Action Validation & Prerequisites

### Prerequisite Evaluation Service

**Service**: `PrerequisiteEvaluationService` (`src/actions/validation/prerequisiteEvaluationService.js`)

Evaluates JSON Logic rules to determine if an actor can perform an action:

1. **Condition Reference Resolution**: Resolves `condition_ref` to reusable conditions
2. **Context Building**: Creates evaluation context with actor data
3. **JSON Logic Evaluation**: Executes rules using `JsonLogicEvaluationService`
4. **Circular Reference Detection**: Prevents infinite loops

### Evaluation Context Structure

```javascript
{
  actor: {
    id: "player",
    components: {
      "core:health": { current: 100, max: 100 },
      "core:movement": { speed: 5 }
    }
  },
  // Additional context data...
}
```

### Key Design Decision

Prerequisites only validate actor/world state, NOT targets. Target validation is handled by the Scope DSL system.

## Target Resolution via Scope DSL

Target resolution uses a domain-specific language (DSL) defined in the action's `scope` property:

### Scope Examples

- `"core:directions"` - Available movement directions
- `"core:inventory"` - Items in actor's inventory
- `"core:environment"` - Interactable objects in current location

### Resolution Process

1. **Scope Engine** interprets the DSL expression
2. **Entity Manager** provides entity and component data
3. **Filter Application** based on scope criteria
4. **Target Context Creation** for each valid target

## Action Dispatch & Execution

### Command Processing

**Service**: `CommandProcessor` (`src/commands/commandProcessor.js`)

Entry point: `dispatchAction(actor, turnAction)`

1. Validates inputs
2. Creates `ATTEMPT_ACTION_ID` event payload
3. Dispatches event via event bus

### Event-Driven Execution

**Service**: `SystemLogicInterpreter` (`src/logic/systemLogicInterpreter.js`)

1. Listens for `ATTEMPT_ACTION_ID` events
2. Finds matching system rules
3. Evaluates rule conditions
4. Executes rule actions via `OperationInterpreter`

### Execution Flow

```
CommandProcessor.dispatchAction()
  ↓
EventBus.dispatch(ATTEMPT_ACTION_ID, payload)
  ↓
SystemLogicInterpreter.handleEvent()
  ↓
Rule evaluation & action execution
  ↓
State changes & side effects
```

## Key Components & Services

### Core Services

1. **ActionIndex**
   - Pre-filters actions by component requirements
   - Provides O(1) candidate lookup
   - Builds index at startup

2. **ActionDiscoveryService**
   - Main entry point for action discovery
   - Orchestrates the discovery pipeline
   - Handles parallel processing

3. **ActionCandidateProcessor**
   - Validates prerequisites
   - Resolves targets
   - Formats action commands

4. **PrerequisiteEvaluationService**
   - Evaluates JSON Logic rules
   - Resolves condition references
   - Builds evaluation contexts

5. **CommandProcessor**
   - Dispatches resolved actions
   - Creates event payloads
   - Handles dispatch failures

### Supporting Components

- **ActionValidationContextBuilder**: Builds contexts for prerequisite evaluation
- **TargetResolutionService**: Resolves action targets via Scope DSL
- **ActionCommandFormatter**: Formats action commands from templates
- **TraceContext**: Provides detailed logging for debugging

## Performance Optimizations

1. **Action Indexing**
   - Pre-built index avoids runtime scanning
   - Component-based filtering reduces candidates
   - O(1) lookup performance

2. **Parallel Processing**
   - Candidate actions processed concurrently
   - Async/await for non-blocking execution
   - Promise.all for batch operations

3. **Caching Strategies**
   - Rule cache in SystemLogicInterpreter
   - Component data caching in entities
   - Condition reference memoization

4. **Early Filtering**
   - Component requirements checked first
   - Prerequisites before target resolution
   - Fail-fast on validation errors

## Error Handling & Recovery

### Error Types

1. **Discovery Errors**
   - Invalid actor entity
   - Candidate retrieval failures
   - Context preparation errors

2. **Validation Errors**
   - Failed prerequisites
   - Invalid rule syntax
   - Circular references

3. **Resolution Errors**
   - Scope evaluation failures
   - Missing target entities
   - Invalid scope syntax

4. **Dispatch Errors**
   - Event bus failures
   - Missing event handlers
   - Execution timeouts

### Error Propagation

```javascript
{
  actions: [...],  // Successfully discovered actions
  errors: [        // Errors encountered
    {
      actionId: "core:take",
      targetId: "item_123",
      error: Error,
      details: {...}
    }
  ],
  trace: TraceContext  // Optional debug trace
}
```

## Integration Points

### Dependency Injection

All services use dependency injection for loose coupling:

```javascript
// Token registration
export const tokens = {
  IActionDiscoveryService: Symbol('IActionDiscoveryService'),
  IActionIndex: Symbol('IActionIndex'),
  // ...
};

// Service registration
container.register(tokens.IActionIndex, ActionIndex);
container.register(tokens.IActionDiscoveryService, ActionDiscoveryService);
```

### Event Bus Integration

Actions trigger events that can be handled by various systems:

- `ATTEMPT_ACTION_ID`: Action execution request
- `ACTION_DECIDED_ID`: Action selection notification
- `ENTITY_SPOKE_ID`: Speech/dialogue actions
- Component change events

### Entity Component System

Actions interact with the ECS through:

- Component requirements
- Entity queries
- State modifications
- Component updates

## Recommendations for Improvement

### 1. Action Caching

**Current**: Actions are discovered fresh each time
**Recommendation**: Cache discovered actions per actor/location with invalidation on state changes

### 2. Prerequisite Optimization

**Current**: All prerequisites evaluated sequentially
**Recommendation**: Short-circuit evaluation and parallel processing where possible

### 3. Better Error Context

**Current**: Errors include basic information
**Recommendation**: Add rich context including:

- Full action definition
- Actor state snapshot
- Evaluation trace
- Suggested fixes

### 4. Action Priority System

**Current**: All actions treated equally
**Recommendation**: Add priority/weight system for:

- AI decision making
- UI organization
- Contextual relevance

### 5. Action Composition

**Current**: Actions are atomic
**Recommendation**: Support composite actions:

- Multi-step sequences
- Conditional branches
- Rollback on failure

### 6. Performance Monitoring

**Current**: Basic logging
**Recommendation**: Add metrics for:

- Discovery time per actor
- Cache hit rates
- Rule evaluation time
- Bottleneck identification

### 7. Testing Improvements

**Current**: Good unit test coverage
**Recommendation**: Add:

- Performance benchmarks
- Stress tests with many actions
- Integration tests for full pipeline
- Fuzzing for edge cases

### 8. Documentation

**Current**: JSDoc comments
**Recommendation**: Add:

- Sequence diagrams
- Decision flowcharts
- Performance guides
- Troubleshooting guides

## Conclusion

The Living Narrative Engine's action system is well-architected with clear separation of concerns, good performance characteristics, and extensive extensibility. The pipeline from discovery through execution is logical and maintainable.

Key strengths:

- Data-driven design enables easy modding
- Performance optimizations reduce runtime overhead
- Comprehensive error handling improves debugging
- Clean architecture enables testing and maintenance

Areas for improvement primarily focus on:

- Caching for better performance
- Richer error context for debugging
- Advanced features like composition and priority
- Enhanced monitoring and documentation

The foundation is solid and well-suited for the engine's goals of total moddability and AI-powered narrative experiences.
