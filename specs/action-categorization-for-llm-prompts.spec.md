# Action Categorization for LLM Prompts - Implementation Specification

## 1. Overview

### 1.1 Purpose

Implement namespace-based action categorization for LLM prompts to improve AI understanding and response quality by organizing actions into logical groups, similar to the existing UI categorization system.

### 1.2 Goals

- **Reduce Code Repetition**: Extract and reuse existing categorization logic from `actionButtonsRenderer.js`
- **Improve LLM Context**: Provide semantic grouping of actions for better AI decision-making
- **Maintain Compatibility**: Preserve action indexes and ensure backward compatibility
- **Ensure Consistency**: Mirror UI grouping behavior for unified user experience

### 1.3 Scope

- **Create new shared categorization service** (ActionCategorizationService)
- **Enhance LLM prompt formatting** in `AIPromptContentProvider.js` with categorization
- **Refactor UI renderer** to use the new shared service (replacing private methods)
- **Maintain all existing functionality and behavior** during the transition

## 2. Architecture Design

### 2.1 Shared Service Architecture

```
Current State:
┌─────────────────────────┐
│ actionButtonsRenderer   │ ─── Categorization Logic
└─────────────────────────┘
┌─────────────────────────┐
│ AIPromptContentProvider │ ─── No Categorization
└─────────────────────────┘

Target State:
┌─────────────────────────┐
│ ActionCategorizationService │ ←─── Shared Logic
└─────────────────────────┘
            ↑                    ↑
┌─────────────────────────┐     ┌─────────────────────────┐
│ actionButtonsRenderer   │     │ AIPromptContentProvider │
└─────────────────────────┘     └─────────────────────────┘
```

### 2.2 Component Dependencies

```javascript
// New shared service
ActionCategorizationService
├── extractNamespace(actionId)
├── shouldUseGrouping(actions, config)
├── groupActionsByNamespace(actions, config)
├── getSortedNamespaces(namespaces, config)
└── formatNamespaceDisplayName(namespace)

// Updated components
actionButtonsRenderer.js (refactored to use service)
├── Uses ActionCategorizationService
├── Maintains existing public API
└── Preserves UI behavior

AIPromptContentProvider.js (enhanced with categorization)
├── Uses ActionCategorizationService
├── New categorized formatting method
└── Fallback to existing behavior
```

## 3. Detailed Requirements

### 3.1 Functional Requirements

#### FR-1: Shared Categorization Service

- **Requirement**: Create new `ActionCategorizationService` class with extracted categorization logic
- **Details**: Extract and generalize existing private methods from `actionButtonsRenderer.js` into a reusable service
- **Acceptance Criteria**:
  - New service provides all methods needed for categorization
  - Logic functionally identical to existing UI implementation
  - Service is stateless and configurable
  - Comprehensive error handling for edge cases

#### FR-2: LLM Prompt Categorization

- **Requirement**: Implement categorized formatting in `AIPromptContentProvider.js`
- **Details**: Add markdown-based grouping when thresholds are met
- **Acceptance Criteria**:
  - Uses same grouping thresholds as UI (≥6 actions, ≥2 namespaces)
  - Preserves action indexes exactly as before
  - Falls back to flat formatting when appropriate
  - Markdown structure is LLM-friendly

#### FR-3: UI Renderer Refactoring

- **Requirement**: Refactor `actionButtonsRenderer.js` to use shared service
- **Details**: Replace internal methods with service calls
- **Acceptance Criteria**:
  - Identical behavior to current implementation
  - No changes to public API
  - All existing tests continue to pass
  - No performance degradation

#### FR-4: Configuration Consistency

- **Requirement**: Consistent configuration between UI and LLM formatting
- **Details**: Shared configuration object with identical thresholds and priorities
- **Acceptance Criteria**:
  - Same namespace priority order
  - Same grouping thresholds
  - Configurable through service parameters
  - Type-safe configuration validation

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

- **Requirement**: Minimal performance impact
- **Details**: Categorization should add <5ms overhead
- **Measurement**: Benchmark existing vs. new implementation

#### NFR-2: Maintainability

- **Requirement**: Reduce code duplication by >80%
- **Details**: Single source of truth for categorization logic
- **Measurement**: Static analysis of duplicated code blocks

#### NFR-3: Backward Compatibility

- **Requirement**: Zero breaking changes
- **Details**: All existing behavior preserved exactly
- **Measurement**: All existing tests pass without modification

#### NFR-4: Code Quality

- **Requirement**: Follow project coding standards
- **Details**: Match existing patterns, documentation, and testing
- **Measurement**: Code review and linting compliance

## 4. Implementation Plan

**Note**: This implementation involves creating a completely new service (`ActionCategorizationService`) that will extract existing categorization logic from `actionButtonsRenderer.js`. The UI renderer will then be refactored to use this new shared service, while `AIPromptContentProvider.js` will be enhanced to also use the service for LLM prompt categorization.

### 4.1 Phase 1: Shared Service Creation

#### Task 1.1: Create ActionCategorizationService

**File**: `src/entities/utils/ActionCategorizationService.js`

**Key Methods**:

```javascript
class ActionCategorizationService {
  /**
   * Extract namespace from actionId (e.g., "core:wait" → "core")
   * @param {string} actionId - The action identifier
   * @returns {string} Extracted namespace or 'unknown'
   */
  extractNamespace(actionId)

  /**
   * Determine if actions should be grouped based on configuration
   * @param {ActionComposite[]} actions - Array of actions
   * @param {object} config - Grouping configuration
   * @returns {boolean} Whether to use grouping
   */
  shouldUseGrouping(actions, config)

  /**
   * Group actions by namespace with priority ordering
   * @param {ActionComposite[]} actions - Array of actions
   * @param {object} config - Grouping configuration
   * @returns {Map<string, ActionComposite[]>} Grouped actions
   */
  groupActionsByNamespace(actions, config)

  /**
   * Sort namespaces by priority configuration
   * @param {string[]} namespaces - Array of namespace strings
   * @param {object} config - Grouping configuration
   * @returns {string[]} Sorted namespace array
   */
  getSortedNamespaces(namespaces, config)

  /**
   * Format namespace for display (e.g., "core" → "CORE")
   * @param {string} namespace - Raw namespace string
   * @returns {string} Formatted display name
   */
  formatNamespaceDisplayName(namespace)
}
```

**Configuration Structure**:

```javascript
const defaultConfig = {
  enabled: true,
  minActionsForGrouping: 6,
  minNamespacesForGrouping: 2,
  namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'],
  showCounts: false,
};
```

#### Task 1.2: Unit Tests for Service

**File**: `tests/unit/entities/utils/ActionCategorizationService.test.js`

**Test Coverage**:

- Namespace extraction with various input formats
- Grouping decision logic with different action counts
- Namespace sorting with priority order
- Error handling for invalid inputs
- Edge cases and boundary conditions

### 4.2 Phase 2: LLM Prompt Enhancement

#### Task 2.1: Enhance AIPromptContentProvider

**File**: `src/prompting/AIPromptContentProvider.js`

**Changes Required**:

1. Add dependency injection for `ActionCategorizationService`
2. Modify `getAvailableActionsInfoContent()` method
3. Add private method `_formatCategorizedActions()`
4. Add private method `_formatSingleAction()`

**New Methods**:

```javascript
/**
 * Format actions with categorization when appropriate
 * @param {ActionComposite[]} actions - Array of actions
 * @returns {string} Formatted markdown content
 */
_formatCategorizedActions(actions) {
  const config = this._getCategorizationConfig();
  const grouped = this.#actionCategorizationService.groupActionsByNamespace(actions, config);

  const segments = ['## Available Actions', ''];

  for (const [namespace, namespaceActions] of grouped) {
    const displayName = this.#actionCategorizationService.formatNamespaceDisplayName(namespace);
    segments.push(`### ${displayName} Actions`);

    for (const action of namespaceActions) {
      segments.push(this._formatSingleAction(action));
    }

    segments.push(''); // Empty line between sections
  }

  return segments.join('\n');
}

/**
 * Format individual action entry
 * @param {ActionComposite} action - Single action object
 * @returns {string} Formatted action line
 */
_formatSingleAction(action) {
  const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
  let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
  description = ensureTerminalPunctuation(description);

  return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
}

/**
 * Get categorization configuration
 * @returns {object} Configuration object
 */
_getCategorizationConfig() {
  return {
    enabled: true,
    minActionsForGrouping: 6,
    minNamespacesForGrouping: 2,
    namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'],
    showCounts: false
  };
}
```

**Modified Method**:

```javascript
getAvailableActionsInfoContent(gameState) {
  this.#logger.debug('AIPromptContentProvider: Formatting available actions info content.');
  const actions = gameState.availableActions || [];
  const noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

  if (!Array.isArray(actions) || actions.length === 0) {
    this.#logger.warn('AIPromptContentProvider: No available actions provided. Using fallback message.');
    return noActionsMessage;
  }

  const config = this._getCategorizationConfig();

  if (this.#actionCategorizationService.shouldUseGrouping(actions, config)) {
    return this._formatCategorizedActions(actions);
  }

  // Fallback to existing flat formatting
  return this._formatListSegment(
    'Choose one of the following available actions by its index',
    actions,
    this._formatSingleAction.bind(this),
    noActionsMessage
  );
}
```

#### Task 2.2: Dependency Injection Updates

**Files**: Constructor and DI configuration

**Constructor Update**:

```javascript
constructor({
  logger,
  promptStaticContentService,
  perceptionLogFormatter,
  gameStateValidationService,
  actionCategorizationService
}) {
  super();
  validateDependencies([
    {
      dependency: logger,
      name: 'AIPromptContentProvider: logger',
      methods: ['info', 'warn', 'error', 'debug'],
    },
    {
      dependency: promptStaticContentService,
      name: 'AIPromptContentProvider: promptStaticContentService',
      methods: [
        'getCoreTaskDescriptionText',
        'getCharacterPortrayalGuidelines',
        'getNc21ContentPolicyText',
        'getFinalLlmInstructionText',
      ],
    },
    {
      dependency: perceptionLogFormatter,
      name: 'AIPromptContentProvider: perceptionLogFormatter',
      methods: ['format'],
    },
    {
      dependency: gameStateValidationService,
      name: 'AIPromptContentProvider: gameStateValidationService',
      methods: ['validate'],
    },
    {
      dependency: actionCategorizationService,
      name: 'AIPromptContentProvider: actionCategorizationService',
      methods: ['extractNamespace', 'shouldUseGrouping', 'groupActionsByNamespace', 'getSortedNamespaces', 'formatNamespaceDisplayName'],
    }
  ], logger);

  this.#logger = logger;
  this.#promptStaticContentService = promptStaticContentService;
  this.#perceptionLogFormatter = perceptionLogFormatter;
  this.#gameStateValidationService = gameStateValidationService;
  this.#actionCategorizationService = actionCategorizationService;
}
```

#### Task 2.3: Integration Tests

**File**: `tests/integration/prompting/actionCategorization.test.js`

**Test Scenarios**:

- Categorized output with sufficient actions and namespaces
- Fallback to flat formatting with insufficient criteria
- Correct namespace grouping and ordering
- Index preservation in all scenarios
- Integration with real action data

### 4.3 Phase 3: UI Renderer Refactoring

#### Task 3.1: Refactor actionButtonsRenderer

**File**: `src/domUI/actionButtonsRenderer.js`

**Changes Required**:

1. Add dependency injection for `ActionCategorizationService`
2. Replace private methods with service calls
3. Maintain exact same behavior and public API
4. Update configuration handling

**Method Updates**:

```javascript
// Replace these private methods with service calls:
#extractNamespace(actionId) → this.#actionCategorizationService.extractNamespace(actionId)
#shouldUseGrouping(actions) → this.#actionCategorizationService.shouldUseGrouping(actions, this.#groupingConfig)
#groupActionsByNamespace(actions) → this.#actionCategorizationService.groupActionsByNamespace(actions, this.#groupingConfig)
#getSortedNamespaces(namespaces) → this.#actionCategorizationService.getSortedNamespaces(namespaces, this.#groupingConfig)
```

**Constructor Update**:

```javascript
constructor({
  logger,
  documentContext,
  validatedEventDispatcher,
  domElementFactory,
  actionButtonsContainerSelector,
  sendButtonSelector = '#player-confirm-turn-button',
  speechInputSelector = '#speech-input',
  actionCategorizationService
}) {
  // Existing validation for actionButtonsContainerSelector
  if (
    !actionButtonsContainerSelector ||
    typeof actionButtonsContainerSelector !== 'string' ||
    actionButtonsContainerSelector.trim() === ''
  ) {
    const errMsg = `[ActionButtonsRenderer] 'actionButtonsContainerSelector' is required and must be a non-empty string.`;
    (logger || console).error(errMsg);
    throw new Error(errMsg);
  }

  // Existing elementsConfig setup
  const elementsConfig = {
    listContainerElement: {
      selector: actionButtonsContainerSelector,
      required: true,
    },
    sendButtonElement: {
      selector: sendButtonSelector,
      required: false,
      expectedType: HTMLButtonElement,
    },
    speechInputElement: {
      selector: speechInputSelector,
      required: false,
      expectedType: HTMLInputElement,
    },
  };

  super({
    datasetKey: DATASET_ACTION_INDEX,
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    domElementFactory,
  });

  // Add validation for the new service
  validateDependency(actionCategorizationService, 'IActionCategorizationService', null, {
    requiredMethods: ['extractNamespace', 'shouldUseGrouping', 'groupActionsByNamespace', 'getSortedNamespaces', 'formatNamespaceDisplayName']
  });

  this.#actionCategorizationService = actionCategorizationService;
  // ... rest of existing constructor logic
}
```

#### Task 3.2: Regression Testing

**Files**: All existing UI renderer tests

**Requirements**:

- All existing tests must pass without modification
- Behavior verification through automated testing
- Visual regression testing if applicable
- Performance benchmarking

### 4.4 Phase 4: Documentation and Cleanup

#### Task 4.1: Code Documentation

- JSDoc comments for all new methods
- README updates for new architecture
- API documentation for shared service

#### Task 4.2: Integration Point Documentation

- Dependency injection setup
- Configuration management
- Migration guide from old to new system

## 5. Expected Outputs

### 5.1 Categorized LLM Prompt Format

**Example Input** (6+ actions, 2+ namespaces):

```javascript
[
  {
    index: 1,
    actionId: 'core:wait',
    commandString: 'wait',
    description: 'Wait for a moment, doing nothing.',
  },
  {
    index: 2,
    actionId: 'core:go',
    commandString: 'go north',
    description: 'Move to the northern area.',
  },
  {
    index: 3,
    actionId: 'intimacy:kiss_back_passionately',
    commandString: 'kiss Sarah passionately',
    description: 'Return the kiss with equal passion.',
  },
  {
    index: 4,
    actionId: 'intimacy:massage_shoulders',
    commandString: "massage Sarah's shoulders",
    description: 'Provide comfort through gentle touch.',
  },
  {
    index: 5,
    actionId: 'clothing:remove_clothing',
    commandString: 'remove shirt',
    description: 'Remove your shirt.',
  },
  {
    index: 6,
    actionId: 'core:examine',
    commandString: 'examine room',
    description: 'Look around the room carefully.',
  },
];
```

**Expected Categorized Output**:

```markdown
## Available Actions

### CORE Actions

[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.
[Index: 6] Command: "examine room". Description: Look around the room carefully.

### INTIMACY Actions

[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.
[Index: 4] Command: "massage Sarah's shoulders". Description: Provide comfort through gentle touch.

### CLOTHING Actions

[Index: 5] Command: "remove shirt". Description: Remove your shirt.
```

### 5.2 Fallback Format

**Example Input** (<6 actions OR <2 namespaces):

```javascript
[
  {
    index: 1,
    actionId: 'core:wait',
    commandString: 'wait',
    description: 'Wait for a moment, doing nothing.',
  },
  {
    index: 2,
    actionId: 'core:go',
    commandString: 'go north',
    description: 'Move to the northern area.',
  },
  {
    index: 3,
    actionId: 'core:follow',
    commandString: 'follow Sarah',
    description: 'Start following Sarah around.',
  },
];
```

**Expected Fallback Output**:

```
Choose one of the following available actions by its index:
[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.
[Index: 3] Command: "follow Sarah". Description: Start following Sarah around.
```

## 6. Testing Strategy

### 6.1 Unit Testing Requirements

#### ActionCategorizationService Tests

- **Namespace Extraction**: Test all input variants and edge cases
- **Grouping Logic**: Verify threshold-based decision making
- **Sorting Algorithm**: Confirm priority order and alphabetical fallback
- **Error Handling**: Invalid inputs, empty arrays, malformed data
- **Configuration**: Different config combinations and validation

#### AIPromptContentProvider Tests

- **Categorized Formatting**: Verify markdown structure and content
- **Fallback Behavior**: Confirm flat formatting when appropriate
- **Integration**: Test with real action data and edge cases
- **Index Preservation**: Ensure no modification of action indexes
- **Error Recovery**: Graceful handling of service failures

#### actionButtonsRenderer Tests

- **Backward Compatibility**: All existing tests pass unchanged
- **Service Integration**: Verify correct service method calls
- **Configuration**: Ensure config passed correctly to service
- **Behavior Preservation**: Identical UI output and interactions

### 6.2 Integration Testing Requirements

#### End-to-End Scenarios

- **LLM Prompt Generation**: Full workflow from game state to formatted prompt
- **UI Rendering**: Complete action button rendering with new service
- **Configuration Changes**: Dynamic config updates affect both systems
- **Performance**: Measure overhead of shared service approach

#### Cross-Component Testing

- **Shared State**: Verify service doesn't maintain inappropriate state
- **Error Propagation**: Proper error handling across component boundaries
- **Dependency Injection**: Correct wiring in IoC container

### 6.3 Performance Testing

#### Benchmarks Required

- **Service Call Overhead**: Measure additional latency from service layer
- **Memory Usage**: Ensure no memory leaks or excessive allocation
- **Categorization Speed**: Time to categorize various action set sizes
- **Regression Testing**: Compare performance before and after changes

#### Performance Targets

- **Categorization Overhead**: <5ms for typical action sets (5-20 actions)
- **Memory Impact**: <1MB additional memory usage
- **Service Call Cost**: <1ms per service method invocation

## 7. Configuration Management

### 7.1 Configuration Schema

```javascript
/**
 * @typedef {object} CategorizationConfig
 * @property {boolean} enabled - Whether categorization is active
 * @property {number} minActionsForGrouping - Minimum actions to trigger grouping
 * @property {number} minNamespacesForGrouping - Minimum namespaces to trigger grouping
 * @property {string[]} namespaceOrder - Priority order for namespace sorting
 * @property {boolean} showCounts - Whether to show action counts (UI only)
 */
const categorizationConfigSchema = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    minActionsForGrouping: { type: 'integer', minimum: 1 },
    minNamespacesForGrouping: { type: 'integer', minimum: 1 },
    namespaceOrder: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    },
    showCounts: { type: 'boolean' },
  },
  required: [
    'enabled',
    'minActionsForGrouping',
    'minNamespacesForGrouping',
    'namespaceOrder',
  ],
  additionalProperties: false,
};
```

### 7.2 Default Configuration

```javascript
const DEFAULT_CATEGORIZATION_CONFIG = {
  enabled: true,
  minActionsForGrouping: 6,
  minNamespacesForGrouping: 2,
  namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'],
  showCounts: false,
};
```

### 7.3 Configuration Validation

```javascript
/**
 * Validate categorization configuration
 * @param {object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 * @returns {object} Validated configuration
 */
function validateCategorizationConfig(config) {
  // JSON Schema validation
  // Type checking
  // Business rule validation
  // Return normalized config
}
```

## 8. Error Handling Strategy

### 8.1 Service-Level Error Handling

#### ActionCategorizationService Errors

- **Invalid Input**: Graceful handling of null/undefined/malformed data
- **Configuration Errors**: Validation and fallback to defaults
- **Performance Issues**: Timeout protection for large datasets
- **Memory Constraints**: Efficient handling of large action arrays

#### Error Response Patterns

```javascript
// Namespace extraction - always returns valid string
extractNamespace(invalidInput) → "unknown"

// Grouping decision - always returns boolean
shouldUseGrouping(invalidActions, invalidConfig) → false

// Grouping operation - returns empty Map on error
groupActionsByNamespace(invalidData) → new Map()
```

### 8.2 Integration Error Handling

#### AIPromptContentProvider Error Handling

- **Service Unavailable**: Fallback to flat formatting
- **Categorization Failure**: Log error and use existing format
- **Partial Failure**: Use successfully categorized groups + flat for failed

#### actionButtonsRenderer Error Handling

- **Service Call Failure**: Fallback to internal legacy methods
- **Configuration Invalid**: Use hard-coded defaults
- **Partial Service Response**: Render what's available + error indication

### 8.3 Error Logging and Monitoring

#### Logging Strategy

```javascript
// Service errors
logger.error('ActionCategorizationService: Namespace extraction failed', {
  actionId,
  error: err.message,
});

// Integration errors
logger.warn('AIPromptContentProvider: Categorization failed, using fallback', {
  actionCount: actions.length,
  error: err.message,
});

// Performance warnings
logger.warn(
  'ActionCategorizationService: Categorization took longer than expected',
  {
    duration: elapsedMs,
    actionCount: actions.length,
  }
);
```

#### Error Metrics

- Categorization failure rate
- Service call latency percentiles
- Error recovery success rate
- Fallback usage frequency

## 9. Migration and Rollback Strategy

### 9.1 Migration Plan

#### Phase 1: Service Introduction (No Behavior Changes)

1. Deploy `ActionCategorizationService` as new dependency
2. Update dependency injection configuration
3. Verify service availability and basic functionality
4. No changes to existing behavior yet

#### Phase 2: LLM Enhancement (Additive Changes)

1. Deploy enhanced `AIPromptContentProvider` with categorization
2. Monitor LLM prompt quality and response metrics
3. Gradual rollout with feature toggle capability
4. Collect feedback on categorized vs. flat prompts

#### Phase 3: UI Refactoring (Replacement)

1. Deploy refactored `actionButtonsRenderer` using shared service
2. Intensive regression testing and monitoring
3. Performance verification and optimization
4. Complete migration to shared service architecture

### 9.2 Rollback Strategy

#### Service-Level Rollback

- **Immediate**: Feature toggle to disable categorization
- **Component**: Restore previous component versions
- **Configuration**: Revert to previous config values
- **Full**: Complete rollback to pre-migration state

#### Rollback Triggers

- **Performance Degradation**: >20% increase in response times
- **Error Rate**: >5% failure rate in categorization
- **User Impact**: Negative feedback or usability issues
- **Integration Issues**: Service communication failures

#### Rollback Procedures

```javascript
// Emergency disable via configuration
const emergencyConfig = {
  enabled: false,
  // ... other config preserved
};

// Component-level fallback
if (!this.#actionCategorizationService.isHealthy()) {
  return this._legacyFormattingMethod(actions);
}

// Full service bypass
const USE_LEGACY_CATEGORIZATION =
  process.env.ROLLBACK_CATEGORIZATION === 'true';
```

## 10. Success Metrics

### 10.1 Code Quality Metrics

#### Duplication Reduction

- **Target**: >80% reduction in categorization logic duplication
- **Measurement**: Static analysis tools (SonarQube, ESLint rules)
- **Baseline**: Current duplicated lines in both components
- **Success**: <20% of original duplicated code remains

#### Test Coverage

- **Target**: ≥90% coverage for new service
- **Target**: Maintain existing coverage for refactored components
- **Measurement**: Jest coverage reports
- **Success**: All coverage targets met without test exemptions

#### Code Complexity

- **Target**: Reduced cyclomatic complexity in both components
- **Measurement**: ESLint complexity rules
- **Success**: No increase in complexity, ideally reduction

### 10.2 Performance Metrics

#### Response Time Impact

- **Target**: <5ms additional overhead for categorization
- **Measurement**: Performance benchmarks and monitoring
- **Baseline**: Current prompt generation and UI rendering times
- **Success**: <5% increase in total processing time

#### Memory Usage

- **Target**: <1MB additional memory for service
- **Measurement**: Memory profiling and heap analysis
- **Success**: No memory leaks, minimal allocation increase

### 10.3 Functional Quality Metrics

#### LLM Response Quality

- **Target**: Improved relevance and appropriateness of action selections
- **Measurement**: A/B testing with categorized vs. flat prompts
- **Metrics**: Response accuracy, context understanding, error rates
- **Success**: Statistically significant improvement in LLM decisions

#### User Experience Consistency

- **Target**: Identical UI behavior after refactoring
- **Measurement**: Visual regression testing and user feedback
- **Success**: Zero negative impact on existing UI functionality

#### Error Handling Robustness

- **Target**: <0.1% error rate in categorization operations
- **Measurement**: Error logging and monitoring dashboards
- **Success**: Robust error handling with graceful degradation

## 11. Dependencies and Constraints

### 11.1 Technical Dependencies

#### Service Dependencies

- **Logger**: Must support structured logging with context
- **IoC Container**: Dependency injection framework
- **Validation Utils**: For parameter validation and error handling
- **Testing Framework**: Jest with adequate mocking capabilities

#### Component Dependencies

- **actionButtonsRenderer**: Requires refactoring without breaking changes
- **AIPromptContentProvider**: Must maintain existing public API
- **Dependency Injection**: Service registration and resolution

### 11.2 Business Constraints

#### Compatibility Requirements

- **Zero Breaking Changes**: All existing functionality preserved
- **Index Preservation**: Action indexes never modified
- **Performance**: No user-noticeable performance degradation
- **Rollback**: Ability to quickly revert if issues arise

#### Resource Constraints

- **Development Time**: Implementation within sprint boundaries
- **Testing Resources**: Adequate time for thorough testing
- **Performance Budget**: Minimal additional resource usage
- **Maintenance**: Solution must be maintainable by team

### 11.3 Technical Constraints

#### Codebase Patterns

- **ECS Architecture**: Must align with entity-component-system patterns
- **Event-Driven**: Consider event bus integration if needed
- **Dependency Injection**: Follow project DI patterns and conventions
- **Error Handling**: Use project error handling and logging patterns

#### Platform Constraints

- **Browser Compatibility**: Service must work in all supported browsers
- **Node.js Compatibility**: LLM proxy server integration requirements
- **Memory Constraints**: Consider mobile device limitations
- **Processing**: Efficient categorization for large action sets

## 12. Risk Assessment and Mitigation

### 12.1 Technical Risks

#### Risk: Performance Degradation

- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Extensive benchmarking, performance monitoring, rollback plan
- **Detection**: Automated performance tests in CI/CD

#### Risk: Regression in UI Behavior

- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Comprehensive regression testing, visual testing, feature toggles
- **Detection**: Existing test suite, user acceptance testing

#### Risk: Service Integration Complexity

- **Probability**: Low
- **Impact**: Medium
- **Mitigation**: Simple service interface, extensive unit testing, mocking
- **Detection**: Integration tests, dependency verification

### 12.2 Business Risks

#### Risk: Delayed Delivery

- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Phased implementation, prioritized features, scope flexibility
- **Detection**: Sprint planning, velocity tracking

#### Risk: User Experience Impact

- **Probability**: Low
- **Impact**: High
- **Mitigation**: A/B testing, gradual rollout, user feedback collection
- **Detection**: User metrics, support tickets, feedback analysis

### 12.3 Operational Risks

#### Risk: Deployment Issues

- **Probability**: Low
- **Impact**: Medium
- **Mitigation**: Staged deployment, feature toggles, rollback procedures
- **Detection**: Deployment monitoring, health checks

#### Risk: Configuration Management

- **Probability**: Medium
- **Impact**: Low
- **Mitigation**: Configuration validation, defaults, documentation
- **Detection**: Configuration validation in CI/CD

## 13. Implementation Guidelines

### 13.1 Code Style and Standards

#### Service Implementation Standards

```javascript
// Use private fields for internal state
class ActionCategorizationService {
  #config;
  #logger;

  // Validate all inputs
  extractNamespace(actionId) {
    if (!actionId || typeof actionId !== 'string') {
      return 'unknown';
    }
    // ... implementation
  }

  // Use descriptive method names
  shouldUseGrouping(actions, config = {}) {
    // ... implementation with clear logic
  }
}
```

#### Error Handling Patterns

```javascript
// Consistent error handling
try {
  const result = this.#actionCategorizationService.groupActionsByNamespace(
    actions,
    config
  );
  return this._formatCategorizedActions(result);
} catch (error) {
  this.#logger.error('Categorization failed, using fallback', {
    error: error.message,
    actionCount: actions.length,
  });
  return this._formatFlatActions(actions);
}
```

#### Documentation Standards

```javascript
/**
 * Groups actions by namespace with priority ordering
 *
 * @param {ActionComposite[]} actions - Array of action objects to group
 * @param {CategorizationConfig} config - Configuration for grouping behavior
 * @returns {Map<string, ActionComposite[]>} Map of namespace to actions
 * @throws {ValidationError} When actions array is invalid
 *
 * @example
 * const actions = [
 *   { actionId: 'core:wait', index: 1, ... },
 *   { actionId: 'intimacy:kiss', index: 2, ... }
 * ];
 * const grouped = service.groupActionsByNamespace(actions, config);
 * // Returns Map { 'core' => [...], 'intimacy' => [...] }
 */
groupActionsByNamespace(actions, config) {
  // ... implementation
}
```

### 13.2 Testing Guidelines

#### Unit Test Structure

```javascript
describe('ActionCategorizationService', () => {
  let service;

  beforeEach(() => {
    service = new ActionCategorizationService();
  });

  describe('extractNamespace', () => {
    it('should extract namespace from valid actionId', () => {
      expect(service.extractNamespace('core:wait')).toBe('core');
    });

    it('should return "unknown" for invalid actionId', () => {
      expect(service.extractNamespace(null)).toBe('unknown');
      expect(service.extractNamespace('')).toBe('unknown');
      expect(service.extractNamespace('no-colon')).toBe('unknown');
    });
  });

  // ... more test suites
});
```

#### Integration Test Patterns

```javascript
describe('AIPromptContentProvider with ActionCategorization', () => {
  let provider;
  let mockCategorizationService;

  beforeEach(() => {
    mockCategorizationService = {
      shouldUseGrouping: jest.fn(),
      groupActionsByNamespace: jest.fn(),
      formatNamespaceDisplayName: jest.fn(),
    };

    provider = new AIPromptContentProvider({
      // ... other dependencies
      actionCategorizationService: mockCategorizationService,
    });
  });

  it('should use categorization when thresholds met', () => {
    const actions = createTestActions(6, 2); // 6 actions, 2 namespaces
    mockCategorizationService.shouldUseGrouping.mockReturnValue(true);

    const result = provider.getAvailableActionsInfoContent({
      availableActions: actions,
    });

    expect(result).toContain('## Available Actions');
    expect(result).toContain('### CORE Actions');
  });
});
```

### 13.3 Performance Guidelines

#### Optimization Principles

```javascript
// Cache expensive operations
class ActionCategorizationService {
  #namespaceCache = new Map();

  extractNamespace(actionId) {
    if (this.#namespaceCache.has(actionId)) {
      return this.#namespaceCache.get(actionId);
    }

    const namespace = this._computeNamespace(actionId);
    this.#namespaceCache.set(actionId, namespace);
    return namespace;
  }

  // Clear cache periodically to prevent memory leaks
  clearCache() {
    this.#namespaceCache.clear();
  }
}
```

#### Performance Monitoring

```javascript
// Add timing instrumentation
groupActionsByNamespace(actions, config) {
  const startTime = performance.now();

  try {
    const result = this._performGrouping(actions, config);
    const duration = performance.now() - startTime;

    if (duration > 10) { // 10ms threshold
      this.#logger.warn('Slow categorization detected', {
        duration,
        actionCount: actions.length
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    this.#logger.error('Categorization failed', { duration, error: error.message });
    throw error;
  }
}
```

## 14. Conclusion

This specification provides a comprehensive plan for implementing action categorization for LLM prompts while maximizing code reuse and maintaining system quality. The approach ensures:

1. **Minimal Risk**: Preserves all existing functionality and behavior
2. **Maximum Reuse**: Eliminates >80% of categorization logic duplication
3. **Enhanced Value**: Improves LLM understanding through semantic grouping
4. **Maintainable Architecture**: Creates single source of truth for categorization
5. **Quality Assurance**: Comprehensive testing and monitoring strategy

The phased implementation approach allows for careful validation at each step, with robust rollback capabilities if issues arise. The shared service architecture provides a foundation for future enhancements while reducing technical debt.

Success metrics focus on measurable improvements in code quality, performance, and LLM response quality, ensuring the implementation delivers tangible value to the Living Narrative Engine project.
