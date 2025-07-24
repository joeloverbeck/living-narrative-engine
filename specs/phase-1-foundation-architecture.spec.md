# Phase 1: Foundation Architecture Specification

**Living Narrative Engine**  
**Specification Date:** 2025-01-24  
**Phase:** Foundation (Phase 1 of 3)  
**Scope:** Core Service Orchestration, Boundary Refinement, and Event Sourcing

## Executive Summary

This specification defines the implementation of Phase 1: Foundation improvements identified in the e2e architectural analysis report. The implementation focuses on introducing centralized service orchestration, refining service boundaries, and implementing event sourcing for turn state management to address current architectural complexity while maintaining backward compatibility.

**Key Deliverables:**

1. **Service Orchestration Pattern** - Centralized command/query orchestration
2. **Service Boundary Refinement** - Domain-specific coordinators with clear responsibilities
3. **Event Sourcing Implementation** - Turn state management with complete audit trails
4. **Migration Strategy** - Incremental implementation preserving existing functionality

## Current Architecture Analysis

### Pain Points Identified

#### 1. Complex Manual Service Coordination

```javascript
// Current TurnExecutionFacade approach (manual coordination)
const availableActions = await this.#actionService.discoverActions(actorId);
const aiDecision = await this.#llmService.getAIDecision(actorId, {
  availableActions,
});
const validation = await this.#actionService.validateAction(aiDecision);
```

**Issues:**

- Manual service coordination scattered across facades and managers
- High cyclomatic complexity in TurnManager (673 lines)
- Difficult error handling and rollback scenarios
- Tight coupling between orchestration and service logic

#### 2. Service Boundary Confusion

```javascript
// Current overlapping responsibilities
TurnManager → handles orchestration, error management, state tracking
ActionDiscoveryService → discovery, validation, context preparation
LLMDecisionProvider → AI decisions, error handling, event dispatching
```

**Issues:**

- Services have overlapping responsibilities
- Cross-cutting concerns (logging, error handling) scattered
- Difficult to test and maintain individual components

#### 3. Limited State Management

```javascript
// Current event-driven approach with flags
this.#roundManager.endTurn(true); // Simple success flag
this.#handleTurnEndedEvent(event); // Event-based state management
```

**Issues:**

- No comprehensive audit trail
- Limited debugging capabilities for turn progression
- Difficult error recovery and state reconstruction

## Phase 1: Foundation Solution Architecture

### 1. Service Orchestration Pattern

#### 1.1 TurnExecutionOrchestrator

**Purpose:** Centralized orchestration of turn execution workflows using Command/Query pattern

```javascript
/**
 * @file src/turns/orchestration/turnExecutionOrchestrator.js
 * @description Centralized turn execution orchestration
 */

import { ITurnExecutionOrchestrator } from '../interfaces/ITurnExecutionOrchestrator.js';
import { ExecuteTurnCommand } from './commands/executeTurnCommand.js';
import { TurnExecutionResult } from './results/turnExecutionResult.js';

export class TurnExecutionOrchestrator extends ITurnExecutionOrchestrator {
  #actionCoordinator;
  #llmCoordinator;
  #entityCoordinator;
  #turnEventStore;
  #errorHandler;
  #logger;

  constructor({
    actionCoordinator,
    llmCoordinator,
    entityCoordinator,
    turnEventStore,
    errorHandler,
    logger,
  }) {
    super();
    this.#actionCoordinator = actionCoordinator;
    this.#llmCoordinator = llmCoordinator;
    this.#entityCoordinator = entityCoordinator;
    this.#turnEventStore = turnEventStore;
    this.#errorHandler = errorHandler;
    this.#logger = logger;
  }

  /**
   * Orchestrates complete turn execution workflow
   * @param {ExecuteTurnCommand} command - Turn execution command
   * @returns {Promise<TurnExecutionResult>} Result with success/failure and context
   */
  async execute(command) {
    const turnId = command.turnId;
    const actorId = command.actorId;

    try {
      // Record turn initiation
      await this.#turnEventStore.appendEvent(turnId, {
        type: 'TURN_INITIATED',
        actorId,
        timestamp: new Date().toISOString(),
        context: command.context,
      });

      // Step 1: Action Discovery
      const discoveryResult = await this.#actionCoordinator.discoverActions(
        command.toActionDiscoveryQuery()
      );

      if (!discoveryResult.success) {
        return await this.#handleFailure(
          turnId,
          'ACTION_DISCOVERY',
          discoveryResult.error
        );
      }

      // Step 2: AI Decision (if AI actor)
      let decisionResult;
      if (command.requiresAIDecision()) {
        decisionResult = await this.#llmCoordinator.makeDecision(
          command.toLLMDecisionQuery(discoveryResult.actions)
        );

        if (!decisionResult.success) {
          return await this.#handleFailure(
            turnId,
            'AI_DECISION',
            decisionResult.error
          );
        }
      }

      // Step 3: Action Validation & Execution
      const executionResult = await this.#actionCoordinator.executeAction(
        command.toActionExecutionQuery(decisionResult?.decision)
      );

      if (!executionResult.success) {
        return await this.#handleFailure(
          turnId,
          'ACTION_EXECUTION',
          executionResult.error
        );
      }

      // Step 4: State Updates
      await this.#entityCoordinator.updateEntityStates(
        executionResult.stateChanges
      );

      // Record successful completion
      await this.#turnEventStore.appendEvent(turnId, {
        type: 'TURN_COMPLETED',
        actorId,
        timestamp: new Date().toISOString(),
        result: executionResult,
      });

      return TurnExecutionResult.success({
        turnId,
        actorId,
        executionResult,
        events: await this.#turnEventStore.getEvents(turnId),
      });
    } catch (error) {
      return await this.#handleFailure(turnId, 'ORCHESTRATION', error);
    }
  }

  /**
   * Handles failure scenarios with rollback and error recording
   */
  async #handleFailure(turnId, phase, error) {
    await this.#turnEventStore.appendEvent(turnId, {
      type: 'TURN_FAILED',
      phase,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    // Attempt rollback if applicable
    await this.#performRollback(turnId, phase);

    return TurnExecutionResult.failure({
      turnId,
      phase,
      error,
      events: await this.#turnEventStore.getEvents(turnId),
    });
  }

  async #performRollback(turnId, phase) {
    // Rollback logic based on failure phase
    const events = await this.#turnEventStore.getEvents(turnId);
    // Implementation of rollback strategies...
  }
}
```

#### 1.2 Command/Query Pattern Implementation

```javascript
/**
 * @file src/turns/orchestration/commands/executeTurnCommand.js
 */
export class ExecuteTurnCommand {
  constructor({ turnId, actorId, actorEntity, context, metadata = {} }) {
    this.turnId = turnId;
    this.actorId = actorId;
    this.actorEntity = actorEntity;
    this.context = context;
    this.metadata = metadata;
  }

  requiresAIDecision() {
    return !this.actorEntity.hasComponent('core:player');
  }

  toActionDiscoveryQuery() {
    return {
      actorId: this.actorId,
      actorEntity: this.actorEntity,
      context: this.context,
    };
  }

  toLLMDecisionQuery(availableActions) {
    return {
      actorId: this.actorId,
      actorEntity: this.actorEntity,
      availableActions,
      context: this.context,
    };
  }

  toActionExecutionQuery(decision) {
    return {
      actorId: this.actorId,
      decision,
      context: this.context,
    };
  }
}
```

### 2. Service Boundary Refinement

#### 2.1 Domain-Specific Coordinators

**ActionProcessingCoordinator** - Handles action discovery, validation, and execution

```javascript
/**
 * @file src/turns/coordinators/actionProcessingCoordinator.js
 */
export class ActionProcessingCoordinator {
  #actionDiscoveryService;
  #actionValidationService;
  #actionExecutionService;
  #logger;

  constructor({
    actionDiscoveryService,
    actionValidationService,
    actionExecutionService,
    logger,
  }) {
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionValidationService = actionValidationService;
    this.#actionExecutionService = actionExecutionService;
    this.#logger = logger;
  }

  async discoverActions(query) {
    try {
      const actions =
        await this.#actionDiscoveryService.discoverActionsForActor(
          query.actorId,
          query.context
        );

      return {
        success: true,
        actions,
        metadata: { discoveryTime: Date.now() },
      };
    } catch (error) {
      this.#logger.error('Action discovery failed', { query, error });
      return {
        success: false,
        error,
        actions: [],
      };
    }
  }

  async executeAction(query) {
    try {
      // Validate action before execution
      const validation = await this.#actionValidationService.validate(
        query.decision
      );
      if (!validation.isValid) {
        return {
          success: false,
          error: new Error(
            `Action validation failed: ${validation.errors.join(', ')}`
          ),
        };
      }

      // Execute validated action
      const result = await this.#actionExecutionService.execute({
        actorId: query.actorId,
        action: query.decision,
        context: query.context,
      });

      return {
        success: true,
        executionResult: result,
        stateChanges: result.stateChanges || [],
      };
    } catch (error) {
      this.#logger.error('Action execution failed', { query, error });
      return {
        success: false,
        error,
      };
    }
  }
}
```

**LLMDecisionCoordinator** - Manages AI decision-making workflows

```javascript
/**
 * @file src/turns/coordinators/llmDecisionCoordinator.js
 */
export class LLMDecisionCoordinator {
  #llmDecisionProvider;
  #promptCoordinator;
  #responseProcessor;
  #logger;

  constructor({
    llmDecisionProvider,
    promptCoordinator,
    responseProcessor,
    logger,
  }) {
    this.#llmDecisionProvider = llmDecisionProvider;
    this.#promptCoordinator = promptCoordinator;
    this.#responseProcessor = responseProcessor;
    this.#logger = logger;
  }

  async makeDecision(query) {
    try {
      // Prepare decision context
      const promptContext = await this.#promptCoordinator.buildContext({
        actorId: query.actorId,
        availableActions: query.availableActions,
        gameContext: query.context,
      });

      // Get AI decision
      const rawDecision = await this.#llmDecisionProvider.getDecision({
        actorEntity: query.actorEntity,
        promptContext,
      });

      // Process and validate response
      const processedDecision =
        await this.#responseProcessor.process(rawDecision);

      return {
        success: true,
        decision: processedDecision,
        metadata: {
          promptTokens: promptContext.tokenCount,
          responseTime: Date.now(),
        },
      };
    } catch (error) {
      this.#logger.error('LLM decision failed', { query, error });
      return {
        success: false,
        error,
      };
    }
  }
}
```

#### 2.2 Interface Definitions

```javascript
/**
 * @file src/turns/interfaces/ITurnExecutionOrchestrator.js
 */
export class ITurnExecutionOrchestrator {
  /**
   * Executes a complete turn workflow
   * @param {ExecuteTurnCommand} command
   * @returns {Promise<TurnExecutionResult>}
   */
  async execute(command) {
    throw new Error('execute method must be implemented');
  }
}

/**
 * @file src/turns/interfaces/IActionProcessingCoordinator.js
 */
export class IActionProcessingCoordinator {
  async discoverActions(query) {
    throw new Error('discoverActions method must be implemented');
  }

  async executeAction(query) {
    throw new Error('executeAction method must be implemented');
  }
}

/**
 * @file src/turns/interfaces/ILLMDecisionCoordinator.js
 */
export class ILLMDecisionCoordinator {
  async makeDecision(query) {
    throw new Error('makeDecision method must be implemented');
  }
}
```

### 3. Event Sourcing Implementation

#### 3.1 TurnEventStore

```javascript
/**
 * @file src/turns/eventSourcing/turnEventStore.js
 */
import { ITurnEventStore } from '../interfaces/ITurnEventStore.js';

export class TurnEventStore extends ITurnEventStore {
  #events = new Map(); // In production, use persistent storage
  #logger;

  constructor({ logger }) {
    super();
    this.#logger = logger;
  }

  /**
   * Appends an event to the turn's event stream
   * @param {string} turnId - Turn identifier
   * @param {Object} event - Event to append
   */
  async appendEvent(turnId, event) {
    if (!this.#events.has(turnId)) {
      this.#events.set(turnId, []);
    }

    const eventWithMetadata = {
      ...event,
      eventId: this.#generateEventId(),
      sequenceNumber: this.#events.get(turnId).length + 1,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    this.#events.get(turnId).push(eventWithMetadata);

    this.#logger.debug('Event appended', { turnId, event: eventWithMetadata });

    return eventWithMetadata;
  }

  /**
   * Retrieves all events for a turn
   * @param {string} turnId - Turn identifier
   * @returns {Promise<Array>} Array of events
   */
  async getEvents(turnId) {
    return this.#events.get(turnId) || [];
  }

  /**
   * Replays turn state from events
   * @param {string} turnId - Turn identifier
   * @returns {Promise<Object>} Reconstructed turn state
   */
  async replayTurn(turnId) {
    const events = await this.getEvents(turnId);

    let state = {
      turnId,
      status: 'UNKNOWN',
      phases: [],
      errors: [],
      results: [],
    };

    for (const event of events) {
      state = this.#applyEvent(state, event);
    }

    return state;
  }

  /**
   * Gets turn events by type
   * @param {string} turnId - Turn identifier
   * @param {string} eventType - Event type to filter
   * @returns {Promise<Array>} Filtered events
   */
  async getEventsByType(turnId, eventType) {
    const events = await this.getEvents(turnId);
    return events.filter((event) => event.type === eventType);
  }

  #applyEvent(state, event) {
    switch (event.type) {
      case 'TURN_INITIATED':
        return {
          ...state,
          status: 'IN_PROGRESS',
          initiatedAt: event.timestamp,
        };
      case 'TURN_COMPLETED':
        return {
          ...state,
          status: 'COMPLETED',
          completedAt: event.timestamp,
          results: [...state.results, event.result],
        };
      case 'TURN_FAILED':
        return {
          ...state,
          status: 'FAILED',
          failedAt: event.timestamp,
          errors: [...state.errors, { phase: event.phase, error: event.error }],
        };
      default:
        state.phases.push({ type: event.type, timestamp: event.timestamp });
        return state;
    }
  }

  #generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 3.2 Turn State Reconstruction

```javascript
/**
 * @file src/turns/eventSourcing/turnStateReconstructor.js
 */
export class TurnStateReconstructor {
  #turnEventStore;
  #logger;

  constructor({ turnEventStore, logger }) {
    this.#turnEventStore = turnEventStore;
    this.#logger = logger;
  }

  /**
   * Reconstructs complete turn execution timeline
   * @param {string} turnId - Turn identifier
   * @returns {Promise<Object>} Turn execution timeline
   */
  async reconstructTimeline(turnId) {
    const events = await this.#turnEventStore.getEvents(turnId);

    return {
      turnId,
      timeline: events.map((event) => ({
        timestamp: event.timestamp,
        phase: event.type,
        details: this.#extractEventDetails(event),
        sequenceNumber: event.sequenceNumber,
      })),
      summary: await this.#generateSummary(turnId, events),
    };
  }

  /**
   * Identifies failure points in turn execution
   * @param {string} turnId - Turn identifier
   * @returns {Promise<Array>} Failure analysis
   */
  async analyzeFailures(turnId) {
    const failureEvents = await this.#turnEventStore.getEventsByType(
      turnId,
      'TURN_FAILED'
    );

    return failureEvents.map((event) => ({
      phase: event.phase,
      error: event.error,
      timestamp: event.timestamp,
      context: event.context,
      suggestions: this.#generateFailureSuggestions(event),
    }));
  }

  #extractEventDetails(event) {
    // Extract relevant details based on event type
    const { eventId, sequenceNumber, timestamp, type, ...details } = event;
    return details;
  }

  async #generateSummary(turnId, events) {
    const state = await this.#turnEventStore.replayTurn(turnId);

    return {
      status: state.status,
      duration: this.#calculateDuration(events),
      phaseCount: state.phases.length,
      errorCount: state.errors.length,
      lastActivity: events[events.length - 1]?.timestamp,
    };
  }

  #calculateDuration(events) {
    if (events.length < 2) return 0;

    const start = new Date(events[0].timestamp);
    const end = new Date(events[events.length - 1].timestamp);
    return end.getTime() - start.getTime();
  }

  #generateFailureSuggestions(failureEvent) {
    // Generate contextual suggestions based on failure phase and error
    const suggestions = [];

    switch (failureEvent.phase) {
      case 'ACTION_DISCOVERY':
        suggestions.push('Check actor location and available actions');
        suggestions.push('Verify action definitions are loaded correctly');
        break;
      case 'AI_DECISION':
        suggestions.push('Check LLM service availability');
        suggestions.push('Verify prompt generation and token limits');
        break;
      case 'ACTION_EXECUTION':
        suggestions.push('Check action validation rules');
        suggestions.push('Verify entity state consistency');
        break;
    }

    return suggestions;
  }
}
```

## Migration Strategy

### Phase A: Infrastructure Setup (Sprint 1)

#### Week 1: Core Infrastructure

1. **Create base orchestration infrastructure**
   - Implement `ITurnExecutionOrchestrator` interface
   - Create `TurnEventStore` with in-memory implementation
   - Set up command/query pattern foundation

2. **Establish coordinator pattern**
   - Implement base coordinator interfaces
   - Create `ActionProcessingCoordinator` skeleton
   - Create `LLMDecisionCoordinator` skeleton

#### Week 2: Event Sourcing Foundation

1. **Implement event sourcing core**
   - Complete `TurnEventStore` implementation
   - Add `TurnStateReconstructor`
   - Create event type definitions

2. **Testing infrastructure**
   - Unit tests for orchestrator pattern
   - Integration tests for event sourcing
   - Mock implementations for coordinators

### Phase B: Coordinator Implementation (Sprint 2)

#### Week 1: Action Processing Coordinator

1. **Implement ActionProcessingCoordinator**
   - Integrate with existing `ActionDiscoveryService`
   - Add validation and execution logic
   - Implement error handling and rollback

2. **Testing and validation**
   - Comprehensive unit tests
   - Integration tests with existing action services
   - Performance benchmarking

#### Week 2: LLM Decision Coordinator

1. **Implement LLMDecisionCoordinator**
   - Integrate with existing `LLMDecisionProvider`
   - Add prompt coordination logic
   - Implement response processing

2. **End-to-end coordinator testing**
   - Integration tests across coordinators
   - Error scenarios and edge cases
   - Performance validation

### Phase C: Orchestrator Integration (Sprint 3)

#### Week 1: TurnExecutionOrchestrator Implementation

1. **Complete orchestrator logic**
   - Implement full turn execution workflow
   - Add error handling and rollback mechanisms
   - Integrate with event sourcing

2. **Facade adapter pattern**
   - Create adapter for existing `TurnExecutionFacade`
   - Maintain backward compatibility
   - Gradual migration path

#### Week 2: Production Integration

1. **Container registration**
   - Update dependency injection configuration
   - Register new services and interfaces
   - Feature flag implementation

2. **Comprehensive testing**
   - Full E2E test suite
   - Load testing and performance validation
   - Rollback and recovery testing

## Validation Criteria

### Functional Requirements

#### 1. Service Orchestration ✅

- [ ] `TurnExecutionOrchestrator` successfully coordinates complete turn execution
- [ ] Command/Query pattern provides clear request/response interfaces
- [ ] Error handling includes proper rollback mechanisms
- [ ] All existing turn execution scenarios continue to work

#### 2. Service Boundaries ✅

- [ ] `ActionProcessingCoordinator` handles all action-related workflows
- [ ] `LLMDecisionCoordinator` manages AI decision workflows
- [ ] Clear responsibility separation between coordinators
- [ ] Minimal coupling between coordinators

#### 3. Event Sourcing ✅

- [ ] `TurnEventStore` captures complete turn execution timeline
- [ ] Turn state can be reconstructed from events
- [ ] Event replay provides accurate debugging information
- [ ] Failure analysis identifies root causes and suggestions

#### 4. Migration Success ✅

- [ ] Existing facades continue to work during transition
- [ ] No regression in existing functionality
- [ ] Performance remains within acceptable ranges
- [ ] All existing tests continue to pass

### Non-Functional Requirements

#### Performance Targets

- [ ] Turn execution latency: < 200ms additional overhead
- [ ] Event storage: < 50ms per event append
- [ ] Memory usage: < 10% increase from baseline
- [ ] Coordinator response time: < 100ms per operation

#### Quality Metrics

- [ ] Code coverage: > 90% for new components
- [ ] Cyclomatic complexity: < 10 for orchestrator methods
- [ ] Documentation coverage: 100% for public interfaces
- [ ] Integration test coverage: > 95% for critical paths

#### Reliability Standards

- [ ] Error recovery: 100% rollback success for failed turns
- [ ] Event consistency: Zero event loss under normal operation
- [ ] Backward compatibility: 100% compatibility during migration period
- [ ] Graceful degradation: Fallback to existing system on orchestrator failure

## Risk Mitigation

### High-Risk Areas

#### 1. Event Store Performance

**Risk:** Event storage could become a performance bottleneck  
**Mitigation:**

- Implement asynchronous event appending
- Add event batching for high-throughput scenarios
- Provide in-memory fallback option

#### 2. Migration Complexity

**Risk:** Complex migration could introduce bugs or regressions  
**Mitigation:**

- Comprehensive adapter pattern implementation
- Feature flags for gradual rollout
- Extensive testing at each migration phase

#### 3. Coordinator Coupling

**Risk:** Coordinators could become tightly coupled despite design intent  
**Mitigation:**

- Interface-driven development with clear contracts
- Regular architecture reviews during implementation
- Automated coupling analysis in CI pipeline

### Contingency Plans

#### Rollback Strategy

If Phase 1 implementation encounters critical issues:

1. **Immediate:** Feature flag to disable new orchestration
2. **Short-term:** Revert to existing facade pattern
3. **Long-term:** Address issues and re-enable incrementally

#### Performance Degradation

If performance targets are not met:

1. **Event sourcing:** Make event storage optional
2. **Orchestration:** Provide bypass mechanism to existing services
3. **Coordinators:** Implement caching and optimization

## Success Metrics

### Implementation Success

- ✅ All Phase 1 components implemented and tested
- ✅ Zero regression in existing functionality
- ✅ Performance within target ranges
- ✅ Documentation and migration guides complete

### Business Value Delivered

- 🎯 **30% reduction** in turn management complexity (measured by cyclomatic complexity)
- 🎯 **50% improvement** in debugging capability (measured by issue resolution time)
- 🎯 **25% faster** new feature development (measured by story completion time)
- 🎯 **90% reduction** in service coordination bugs (measured by bug reports)

### Technical Quality Achieved

- 📊 Code coverage > 90% for all new components
- 📊 Zero critical or high-severity issues in code review
- 📊 All performance benchmarks met or exceeded
- 📊 Complete event sourcing audit trail for 100% of turns

## Conclusion

Phase 1: Foundation provides the architectural foundation necessary to address current complexity issues while establishing patterns for future phases. The incremental migration approach ensures minimal risk while delivering immediate benefits in maintainability, testability, and debugging capabilities.

**Next Phase Preview:** Phase 2 will build upon this foundation to implement centralized error handling, performance monitoring, and advanced caching strategies, further improving system reliability and performance.
