# Action Processing Workflows Analysis Report

## Executive Summary

This report analyzes the action processing workflows in the Living Narrative Engine, identifying the main pipelines from action discovery through execution. The analysis reveals a sophisticated multi-stage architecture that handles action discovery, validation, formatting, and execution through a clean separation of concerns.

## Architecture Overview

The action processing system follows a pipeline architecture with the following key stages:

```
Actor Entity → Action Discovery → Validation → Target Resolution → Formatting → UI Display
                                                                          ↓
User Selection → Command Processing → Event Dispatch → System Logic → Game State Update
```

## Core Components

### 1. ActionDiscoveryService (`src/actions/actionDiscoveryService.js`)
**Purpose**: Main orchestrator for discovering valid actions for entities
**Key Responsibilities**:
- Orchestrates the action discovery process
- Manages candidate action processing
- Handles error aggregation and tracing

**Key Methods**:
- `getValidActions(actorEntity, baseContext, options)`: Main entry point for action discovery

### 2. ActionCandidateProcessor (`src/actions/actionCandidateProcessor.js`)
**Purpose**: Processes individual action candidates through validation and target resolution
**Key Responsibilities**:
- Evaluates action prerequisites
- Resolves action targets using scope DSL
- Formats actions for display

**Key Methods**:
- `process(actionDef, actorEntity, context, trace)`: Process single action candidate

### 3. ActionIndex (`src/actions/actionIndex.js`)
**Purpose**: Performance-optimized action filtering based on component requirements
**Key Responsibilities**:
- Indexes actions by required actor components
- Provides fast candidate retrieval
- Reduces unnecessary processing

**Key Methods**:
- `buildIndex(allActionDefinitions)`: Build performance index at startup
- `getCandidateActions(actorEntity, trace)`: Retrieve pre-filtered candidates

### 4. AvailableActionsProvider (`src/data/providers/availableActionsProvider.js`)
**Purpose**: UI-facing provider with caching and indexing
**Key Responsibilities**:
- Provides final action list to UI
- Implements turn-scoped caching
- Handles overflow protection

**Key Methods**:
- `get(actor, turnContext, logger)`: Get available actions for UI

### 5. CommandProcessor (`src/commands/commandProcessor.js`)
**Purpose**: Handles action execution via event dispatch
**Key Responsibilities**:
- Dispatches pre-resolved actions
- Validates action inputs
- Creates event payloads

**Key Methods**:
- `dispatchAction(actor, turnAction)`: Execute action

### 6. CommandProcessingWorkflow (`src/turns/states/helpers/commandProcessingWorkflow.js`)
**Purpose**: Turn-based command execution pipeline
**Key Responsibilities**:
- Orchestrates command processing steps
- Interprets command results
- Executes directive strategies

**Key Methods**:
- `processCommand(turnCtx, actor, turnAction)`: Main workflow orchestrator

## Action Schema Structure

Actions are defined as JSON files validating against `data/schemas/action.schema.json` with the following key properties:

```json
{
  "id": "modId:actionName",
  "name": "Display Name",
  "description": "Action description",
  "scope": "modId:scopeName",
  "required_components": {
    "actor": ["componentId1", "componentId2"]
  },
  "prerequisites": [
    {
      "logic": { "condition_ref": "modId:conditionName" },
      "failure_message": "Why action is not available"
    }
  ],
  "template": "action template with {target} placeholders"
}
```

## Workflow Analysis

### Workflow 1: Action Discovery

**Trigger**: Request for available actions for an actor
**Steps**:
1. `AvailableActionsProvider.get()` called by UI
2. Check turn-scoped cache
3. If cache miss, call `ActionDiscoveryService.getValidActions()`
4. `ActionDiscoveryService` calls `ActionIndex.getCandidateActions()`
5. `ActionIndex` returns pre-filtered candidates based on actor components
6. For each candidate, `ActionCandidateProcessor.process()` called
7. Process validates prerequisites and resolves targets
8. Valid actions formatted and returned
9. Results cached for turn duration

**Key Files**:
- `src/data/providers/availableActionsProvider.js:141` - Main entry point
- `src/actions/actionDiscoveryService.js:192` - Core discovery logic
- `src/actions/actionIndex.js:111` - Performance filtering
- `src/actions/actionCandidateProcessor.js:87` - Candidate processing

### Workflow 2: Action Validation

**Trigger**: Processing of action candidates
**Steps**:
1. `ActionCandidateProcessor.process()` receives action definition
2. `#actorMeetsPrerequisites()` validates actor state prerequisites
3. `PrerequisiteEvaluationService.evaluate()` runs JSON Logic conditions
4. `TargetResolutionService.resolveTargets()` processes scope DSL
5. Scope engine finds entities matching target criteria
6. `ActionCommandFormatter.format()` creates display strings
7. Valid actions returned as `DiscoveredActionInfo` objects

**Key Files**:
- `src/actions/actionCandidateProcessor.js:87` - Main processing
- `src/actions/validation/prerequisiteEvaluationService.js` - Prerequisite validation
- `src/actions/targetResolutionService.js` - Target resolution
- `src/actions/actionFormatter.js` - Command formatting

### Workflow 3: Action Execution

**Trigger**: User selects action from UI
**Steps**:
1. UI dispatches action selection event
2. Turn system creates `ITurnAction` with resolved parameters
3. `CommandProcessor.dispatchAction()` called with actor and action
4. Action inputs validated
5. `ATTEMPT_ACTION_ID` event payload created
6. Event dispatched to system logic
7. `CommandProcessingWorkflow.processCommand()` orchestrates execution
8. Command result interpreted into directive
9. Directive strategy executes game state changes

**Key Files**:
- `src/commands/commandProcessor.js:86` - Action dispatch
- `src/turns/states/helpers/commandProcessingWorkflow.js:235` - Execution orchestration
- `src/constants/eventIds.js:4` - Event constants

### Workflow 4: Action Indexing

**Trigger**: System startup or action data reload
**Steps**:
1. `ActionIndex.buildIndex()` called during initialization
2. All action definitions loaded from mods
3. Actions categorized by `required_components.actor`
4. Index maps component IDs to action definitions
5. Actions with no requirements added to universal list
6. Runtime lookup optimized through pre-computed maps

**Key Files**:
- `src/actions/actionIndex.js:55` - Index building
- `src/actions/actionIndex.js:111` - Runtime lookup

## Action Categories by Mod

### Core Actions (`data/mods/core/actions/`)
- `go.action.json` - Location movement
- `follow.action.json` - Following other actors
- `stop_following.action.json` - Stop following
- `dismiss.action.json` - Dismiss followers
- `wait.action.json` - Wait/skip turn

### Intimacy Actions (`data/mods/intimacy/actions/`)
- `get_close.action.json` - Approach another actor
- `kiss_cheek.action.json` - Romantic interaction
- `peck_on_lips.action.json` - Romantic interaction
- `massage_shoulders.action.json` - Physical interaction
- `massage_back.action.json` - Physical interaction
- `thumb_wipe_cheek.action.json` - Gentle interaction
- `lick_lips.action.json` - Suggestive action
- `adjust_clothing.action.json` - Clothing interaction
- `step_back.action.json` - Distance creation
- `turn_around.action.json` - Positioning action

### Adult Actions (`data/mods/sex/actions/`)
- `fondle_breasts.action.json` - Adult interaction
- `fondle_penis.action.json` - Adult interaction

## Data Flow Analysis

### Action Discovery Flow
```
Entity → ComponentTypes → ActionIndex → CandidateActions → 
Prerequisites → TargetResolution → ActionFormatting → UI
```

### Action Execution Flow
```
UI Selection → TurnAction → CommandProcessor → EventDispatch → 
SystemLogic → GameStateUpdate → UI Refresh
```

## E2E Test Coverage Analysis

### Current Test Coverage
- **Integration Tests**: Extensive coverage of individual components
- **Unit Tests**: Comprehensive component testing
- **E2E Tests**: **MISSING** - No comprehensive end-to-end action workflow tests

### Missing E2E Test Scenarios

#### 1. Complete Action Discovery Workflow
**Test**: `ActionDiscoveryWorkflow.e2e.test.js`
- Load game with multiple actors
- Verify action discovery for different component combinations
- Test caching behavior across turns
- Validate error handling and tracing

#### 2. Action Execution Pipeline
**Test**: `ActionExecutionPipeline.e2e.test.js`
- Select action from UI
- Verify command processing workflow
- Test event dispatch and system response
- Validate game state updates

#### 3. Cross-Mod Action Integration
**Test**: `CrossModActionIntegration.e2e.test.js`
- Test actions from core, intimacy, and sex mods
- Verify prerequisite evaluation across mods
- Test target resolution with different scopes
- Validate mod dependency handling

#### 4. Action Validation Edge Cases
**Test**: `ActionValidationEdgeCases.e2e.test.js`
- Test failed prerequisite scenarios
- Test empty target resolution
- Test invalid action definitions
- Test error recovery and fallback

#### 5. Turn-Based Action Processing
**Test**: `TurnBasedActionProcessing.e2e.test.js`
- Test action availability changes across turns
- Test cache invalidation
- Test multiple actors in sequence
- Test concurrent action processing

### Test Data Requirements
- Game world with multiple locations
- Actors with different component configurations
- Actions requiring various prerequisites
- Scope definitions for target resolution

## Implementation Recommendations

### Priority 1: Core Workflow Tests
1. **ActionDiscoveryWorkflow.e2e.test.js**
   - Test complete discovery pipeline
   - Verify component-based filtering
   - Test error aggregation

2. **ActionExecutionPipeline.e2e.test.js**
   - Test command processing workflow
   - Verify event dispatch mechanism
   - Test directive execution

### Priority 2: Integration Tests
3. **CrossModActionIntegration.e2e.test.js**
   - Test mod interaction patterns
   - Verify dependency resolution
   - Test action inheritance

4. **ActionValidationEdgeCases.e2e.test.js**
   - Test error scenarios
   - Verify fallback mechanisms
   - Test recovery procedures

### Priority 3: Performance Tests
5. **TurnBasedActionProcessing.e2e.test.js**
   - Test caching effectiveness
   - Verify performance optimizations
   - Test concurrent processing

## Testing Architecture Recommendations

### Test Structure
```
tests/e2e/actions/
├── ActionDiscoveryWorkflow.e2e.test.js
├── ActionExecutionPipeline.e2e.test.js
├── CrossModActionIntegration.e2e.test.js
├── ActionValidationEdgeCases.e2e.test.js
├── TurnBasedActionProcessing.e2e.test.js
├── common/
│   ├── actionTestBed.js
│   ├── testDataFixtures.js
│   └── assertionHelpers.js
└── fixtures/
    ├── test-world.json
    ├── test-actors.json
    └── test-actions.json
```

### Test Bed Requirements
- **Game Engine**: Full engine initialization
- **Test World**: Controlled environment with known entities
- **Mock UI**: Simulate user interactions
- **Event Capture**: Monitor system events
- **State Validation**: Verify game state changes

## Code References

### Key Integration Points
- `src/data/providers/availableActionsProvider.js:141` - UI integration
- `src/actions/actionDiscoveryService.js:192` - Core discovery
- `src/commands/commandProcessor.js:86` - Command execution
- `src/turns/states/helpers/commandProcessingWorkflow.js:235` - Turn processing

### Event Integration
- `src/constants/eventIds.js:4` - `ATTEMPT_ACTION_ID` constant
- Event payload structure in `commandProcessor.js:186`

### Schema Validation
- `data/schemas/action.schema.json` - Action definition structure
- `src/validation/ajvSchemaValidator.js` - Schema validation service

## Conclusion

The Living Narrative Engine has a well-architected action processing system with clear separation of concerns and robust error handling. However, comprehensive E2E test coverage is missing, particularly for the complete workflow integration. The recommended test suite will provide confidence in the entire action processing pipeline and enable safe refactoring and feature development.

The priority should be on implementing the core workflow tests first, followed by integration tests, and finally performance tests to ensure the system works reliably under various conditions.