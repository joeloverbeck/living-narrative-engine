# Traits Rewriter Implementation Specification

## ⚠️ Implementation Status

**SPECIFICATION CORRECTED**: This document has been updated to fix architectural assumptions and align with the actual codebase patterns.

**CRITICAL RUNTIME ISSUE**: The application currently fails to start due to missing business logic components, despite having a complete professional UI foundation that exceeds requirements.

| Component Category | Status | Notes |
| --- | --- | --- |
| **UI Foundation** | ✅ **COMPLETE** | Professional implementation with WCAG AA compliance, responsive design, animations, and dark mode support |
| **Business Logic** | ❌ **MISSING** | All core services missing - causes import error preventing application startup |
| **Dependencies** | ❌ **NOT REGISTERED** | Missing dependency injection tokens and registrations |
| **Testing** | ❌ **REQUIRED** | Comprehensive test suite needed for new components |

**Implementation Priority**: **URGENT** - Fix runtime error → **HIGH** - Core business logic → **STANDARD** - Testing

---

## Executive Summary

This specification defines the **business logic components** required to complete the Traits Rewriter feature. The UI infrastructure is already professionally implemented and exceeds requirements, but missing core services prevent the application from starting.

### Current Reality

- **Excellent Foundation**: Complete UI with professional polish (8 high-quality files)
- **Runtime Blocker**: `src/traits-rewriter-main.js` imports non-existent `TraitsRewriterController`
- **Clear Implementation Path**: Well-established patterns and comprehensive prompt templates exist
- **Low Risk**: No external dependencies or complex integrations required

### Completion Requirements

**Files to Create**: 5 business logic components  
**Files to Modify**: 2 dependency injection files  
**Estimated Effort**: 2-3 days for experienced developer  
**Test Coverage**: 8-10 test files needed

---

## Architecture Overview

The Traits Rewriter follows the established Character Builder pattern with complete separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Complete UI Layer                       │
│  ✅ HTML Page (WCAG AA)  ✅ CSS (Responsive)  ✅ Bootstrap  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                Missing Business Logic                      │
│  ❌ Controller  ❌ Generator  ❌ Processor  ❌ Enhancer      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 Existing Infrastructure                     │
│  ✅ LLM Service  ✅ Event Bus  ✅ Validation  ✅ Prompts    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input → Controller → Generator → LLM Service
     ↓            ↑           ↓           ↓
  Validation → UI Update ← Processor ← Response
     ↓                       ↓
Display ← ← ← ← ← ← ← ← Enhancer
```

---

## Critical Missing Components

### 1. 🚨 TraitsRewriterController (Runtime Blocker)

**File**: `/src/characterBuilder/controllers/TraitsRewriterController.js`  
**Status**: ❌ **CRITICAL** - Import error prevents application startup  
**Purpose**: Main controller extending BaseCharacterBuilderController

#### Required Interface

```javascript
export class TraitsRewriterController extends BaseCharacterBuilderController {
  // Private fields following codebase patterns
  /** @private @type {TraitsRewriterGenerator} */
  #traitsRewriterGenerator;
  
  /** @private @type {TraitsRewriterDisplayEnhancer} */
  #traitsRewriterDisplayEnhancer;
  
  /** @private @type {object|null} */
  #lastGeneratedTraits = null;

  constructor(dependencies) {
    // Call parent constructor with core dependencies
    super(dependencies);

    // Validate traits-specific dependencies using codebase pattern
    validateDependency(
      dependencies.traitsRewriterGenerator,
      'TraitsRewriterGenerator',
      this._getLogger(),
      {
        requiredMethods: ['generateRewrittenTraits'],
      }
    );

    validateDependency(
      dependencies.traitsRewriterDisplayEnhancer,
      'TraitsRewriterDisplayEnhancer',
      this._getLogger(),
      {
        requiredMethods: [
          'enhanceForDisplay',
          'formatForExport',
          'generateExportFilename',
        ],
      }
    );

    this.#traitsRewriterGenerator = dependencies.traitsRewriterGenerator;
    this.#traitsRewriterDisplayEnhancer = dependencies.traitsRewriterDisplayEnhancer;
  }

  // Core Methods Required (protected methods from BaseCharacterBuilderController)
  async _loadInitialData()           // Minimal implementation - setup UI state
  _cacheElements()                   // Cache UI element references using _cacheElementsFromMap
  _setupEventListeners()             // Handle user interactions using _addEventListener
  _initializeUIStateManager()        // Initialize state management
  
  // Feature Methods Required (private implementation methods)
  #handleCharacterInput()            // Process character definition changes
  #validateCharacterDefinition()     // JSON validation and schema checks
  #generateRewrittenTraits()         // Main generation workflow
  #displayResults()                  // Render rewritten traits using UIStateManager
  #exportToFile()                    // Export functionality
  #clearAll()                        // Reset form and results
}
```

#### Implementation Pattern

- **Extend**: `BaseCharacterBuilderController` following established patterns
- **Dependencies**: Use dependency injection with `validateDependency` validation
- **Private Fields**: Use `#` syntax for all private state
- **UI Elements**: Cache references using `_cacheElementsFromMap()` helper
- **Event Handling**: Use `_addEventListener()` with automatic cleanup
- **State Management**: Integrate with UIStateManager via `_showState()` methods
- **Validation**: Follow codebase patterns with comprehensive dependency validation

### 2. TraitsRewriterGenerator

**File**: `/src/characterBuilder/services/TraitsRewriterGenerator.js`  
**Status**: ❌ **HIGH PRIORITY** - Core business logic service  
**Purpose**: Orchestrate trait rewriting workflow with LLM integration

#### Required Interface

```javascript
export class TraitsRewriterGenerator {
  // Private fields following codebase patterns
  /** @private @type {ILogger} */
  #logger;
  
  /** @private @type {LlmJsonService} */
  #llmJsonService;
  
  /** @private @type {ConfigurableLLMAdapter} */
  #llmStrategyFactory;
  
  /** @private @type {ILLMConfigurationManager} */
  #llmConfigManager;
  
  /** @private @type {ISafeEventDispatcher} */
  #eventBus;
  
  /** @private @type {ITokenEstimator} */
  #tokenEstimator;

  constructor(dependencies) {
    // Validate all dependencies using codebase pattern
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error']
    });
    
    validateDependency(dependencies.llmJsonService, 'LlmJsonService', dependencies.logger, {
      requiredMethods: ['generateContent']
    });
    
    validateDependency(dependencies.llmStrategyFactory, 'ConfigurableLLMAdapter', dependencies.logger, {
      requiredMethods: ['generateContent']
    });
    
    validateDependency(dependencies.llmConfigManager, 'ILLMConfigurationManager', dependencies.logger, {
      requiredMethods: ['getCurrentLlmId']
    });
    
    validateDependency(dependencies.eventBus, 'ISafeEventDispatcher', dependencies.logger, {
      requiredMethods: ['dispatch']
    });
    
    validateDependency(dependencies.tokenEstimator, 'ITokenEstimator', dependencies.logger, {
      requiredMethods: ['estimateTokens']
    });

    this.#logger = dependencies.logger;
    this.#llmJsonService = dependencies.llmJsonService;
    this.#llmStrategyFactory = dependencies.llmStrategyFactory;
    this.#llmConfigManager = dependencies.llmConfigManager;
    this.#eventBus = dependencies.eventBus;
    this.#tokenEstimator = dependencies.tokenEstimator;
  }

  // Core Methods Required
  async generateRewrittenTraits(characterDefinition, options = {})
  #extractRelevantTraits(characterDefinition)
  #createLLMPrompt(characterData)
  #validateGenerationResult(response)
  #handleGenerationErrors(error, context)
  #dispatchGenerationEvents(eventType, payload)
}
```

#### Key Responsibilities

- **Extract Traits**: Identify present traits from the 10 supported types
- **Prompt Creation**: Use `createTraitsRewriterPrompt()` with character data
- **LLM Integration**: Use `llmJsonService` with `ConfigurableLLMAdapter` infrastructure  
- **Response Processing**: Delegate to `TraitsRewriterResponseProcessor`
- **Error Handling**: Comprehensive error scenarios and recovery
- **Event Dispatching**: CHARACTER_BUILDER_EVENTS integration following existing patterns
- **Token Management**: Estimate token usage for prompt optimization

### 3. TraitsRewriterResponseProcessor

**File**: `/src/characterBuilder/services/TraitsRewriterResponseProcessor.js`  
**Status**: ❌ **HIGH PRIORITY** - LLM response parsing and validation  
**Purpose**: Process and validate LLM responses against expected schema

#### Required Interface

```javascript
export class TraitsRewriterResponseProcessor {
  // Private fields following codebase patterns
  /** @private @type {ILogger} */
  #logger;
  
  /** @private @type {LlmJsonService} */
  #llmJsonService;
  
  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  constructor(dependencies) {
    // Validate all dependencies using codebase pattern
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error']
    });
    
    validateDependency(dependencies.llmJsonService, 'LlmJsonService', dependencies.logger, {
      requiredMethods: ['parseAndValidateResponse']
    });
    
    validateDependency(dependencies.schemaValidator, 'ISchemaValidator', dependencies.logger, {
      requiredMethods: ['validate']
    });

    this.#logger = dependencies.logger;
    this.#llmJsonService = dependencies.llmJsonService;
    this.#schemaValidator = dependencies.schemaValidator;
  }

  // Core Methods Required
  async processResponse(llmResponse, originalCharacterData)
  #parseJsonResponse(responseText)
  #validateResponseSchema(parsedResponse)
  #verifyTraitCompleteness(response, originalTraits)
  #sanitizeTraitContent(traits)
  #handleProcessingErrors(error, context)
}
```

#### Key Responsibilities

- **JSON Parsing**: Use `llmJsonService.parseAndValidateResponse()` for safe parsing
- **Schema Validation**: Use `TRAITS_REWRITER_RESPONSE_SCHEMA` from prompts via `schemaValidator`
- **Content Verification**: Ensure all requested traits are present and valid
- **Sanitization**: Clean and format trait text for safe display
- **Error Recovery**: Handle partial responses and validation failures
- **Integration**: Follow established patterns from `SpeechPatternsResponseProcessor`

### 4. TraitsRewriterDisplayEnhancer

**File**: `/src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js`  
**Status**: ❌ **HIGH PRIORITY** - Formatting and export functionality  
**Purpose**: Format rewritten traits for display and export operations

#### Required Interface

```javascript
export class TraitsRewriterDisplayEnhancer {
  // Private fields following codebase patterns
  /** @private @type {ILogger} */
  #logger;

  constructor(dependencies) {
    // Validate dependencies using codebase pattern
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error']
    });

    this.#logger = dependencies.logger;
  }

  // Core Methods Required
  enhanceForDisplay(rewrittenTraits, characterName, options = {})
  formatForExport(rewrittenTraits, exportFormat = 'text', options = {})
  generateExportFilename(characterName)
  createDisplaySections(enhancedTraits)
  #escapeHtmlContent(text)
  #createTraitSection(traitKey, traitValue, index)
  #sanitizeForDisplay(content)
  #formatTraitLabel(traitKey)
}
```

#### Key Responsibilities

- **Display Formatting**: Create HTML-safe sections with proper structure
- **Export Formats**: Support text and JSON export with proper formatting
- **File Naming**: Generate descriptive filenames with timestamps
- **Section Creation**: Organize traits into labeled sections (Likes, Fears, etc.)
- **Content Safety**: HTML escaping and XSS prevention

### 5. TraitsRewriterError

**File**: `/src/characterBuilder/errors/TraitsRewriterError.js`  
**Status**: ❌ **STANDARD PRIORITY** - Custom error handling  
**Purpose**: Domain-specific error types for trait rewriting operations

#### Required Interface

```javascript
export class TraitsRewriterError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'TraitsRewriterError';
    this.code = code;
    this.context = context;
  }
}

// Error Constants
export const TRAITS_REWRITER_ERROR_CODES = {
  INVALID_CHARACTER_DEFINITION: 'INVALID_CHARACTER_DEFINITION',
  GENERATION_FAILED: 'GENERATION_FAILED',
  RESPONSE_PROCESSING_FAILED: 'RESPONSE_PROCESSING_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
};
```

---

## Required File Modifications

### 1. Dependency Injection Tokens

**File**: `/src/dependencyInjection/tokens/tokens-core.js`  
**Modification Required**: Add new service tokens to character builder section

```javascript
// Add to existing character builder tokens section (after SpeechPatternsResponseProcessor)
  SpeechPatternsResponseProcessor: 'SpeechPatternsResponseProcessor',
  // Traits Rewriter Services
  TraitsRewriterController: 'TraitsRewriterController',
  TraitsRewriterGenerator: 'TraitsRewriterGenerator', 
  TraitsRewriterResponseProcessor: 'TraitsRewriterResponseProcessor',
  TraitsRewriterDisplayEnhancer: 'TraitsRewriterDisplayEnhancer',
  CharacterDatabase: 'CharacterDatabase',
```

**Note**: The codebase uses a modular token system where character builder services are defined in `tokens-core.js` and consolidated into the main `tokens` object via imports.

### 2. Service Registration

**File**: `/src/dependencyInjection/registrations/characterBuilderRegistrations.js`  
**Modification Required**: Add imports and factory registrations following existing patterns

```javascript
// Add imports with existing character builder service imports
import { TraitsRewriterController } from '../../characterBuilder/controllers/TraitsRewriterController.js';
import { TraitsRewriterGenerator } from '../../characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../characterBuilder/services/TraitsRewriterDisplayEnhancer.js';

// Add to registerCharacterBuilderServices function (after SpeechPatternsDisplayEnhancer registration)
function registerCharacterBuilderServices(registrar, logger) {
  // ... existing registrations ...

  // Traits Rewriter Services
  registrar.singletonFactory(tokens.TraitsRewriterGenerator, (c) => {
    return new TraitsRewriterGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter),
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
    });
  });

  registrar.singletonFactory(tokens.TraitsRewriterResponseProcessor, (c) => {
    return new TraitsRewriterResponseProcessor({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });

  registrar.singletonFactory(tokens.TraitsRewriterDisplayEnhancer, (c) => {
    return new TraitsRewriterDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });

  registrar.singletonFactory(tokens.TraitsRewriterController, (c) => {
    return new TraitsRewriterController({
      logger: c.resolve(tokens.ILogger),
      characterBuilderService: c.resolve(tokens.CharacterBuilderService),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
      traitsRewriterGenerator: c.resolve(tokens.TraitsRewriterGenerator),
      traitsRewriterDisplayEnhancer: c.resolve(tokens.TraitsRewriterDisplayEnhancer),
    });
  });

  logger.debug('Character Builder Registration: Registered Traits Rewriter services.');
}
```

---

## Implementation Details

### Supported Trait Types

The system must handle these 10 trait types (when present in character definition):

1. `core:likes` - Things the character enjoys or appreciates
2. `core:dislikes` - Things the character avoids or dislikes  
3. `core:fears` - Character's fears and phobias
4. `core:goals` - Objectives and aspirations
5. `core:notes` - Additional character notes
6. `core:personality` - Personality description
7. `core:profile` - Character background profile
8. `core:secrets` - Hidden aspects of the character
9. `core:strengths` - Character abilities and strengths
10. `core:weaknesses` - Character flaws and weaknesses

### LLM Integration Pattern

```javascript
// Use established codebase infrastructure pattern
const response = await this.#llmJsonService.generateContent({
  prompt: createTraitsRewriterPrompt(characterData),
  llmStrategyFactory: this.#llmStrategyFactory,
  llmConfigManager: this.#llmConfigManager,
  schema: TRAITS_REWRITER_RESPONSE_SCHEMA,
  temperature: TRAITS_REWRITER_LLM_PARAMS.temperature,
  maxTokens: TRAITS_REWRITER_LLM_PARAMS.max_tokens,
  logger: this.#logger,
});

// Alternative pattern for direct adapter usage (if needed)
const directResponse = await this.#llmStrategyFactory.generateContent({
  prompt: createTraitsRewriterPrompt(characterData),
  temperature: TRAITS_REWRITER_LLM_PARAMS.temperature,
  maxTokens: TRAITS_REWRITER_LLM_PARAMS.max_tokens,
});
```

### Event Integration

```javascript
// Follow established CHARACTER_BUILDER_EVENTS patterns
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';

// Dispatch events using established patterns
this.#eventBus.dispatch({
  type: CHARACTER_BUILDER_EVENTS.GENERATION_STARTED,
  payload: { 
    feature: 'traits-rewriter',
    component: 'TraitsRewriterGenerator',
    characterName: character.name,
    timestamp: new Date().toISOString()
  }
});

// Success event
this.#eventBus.dispatch({
  type: CHARACTER_BUILDER_EVENTS.GENERATION_COMPLETED,
  payload: {
    feature: 'traits-rewriter',
    component: 'TraitsRewriterGenerator', 
    characterName: character.name,
    resultCount: Object.keys(rewrittenTraits).length,
    timestamp: new Date().toISOString()
  }
});

// Error event
this.#eventBus.dispatch({
  type: CHARACTER_BUILDER_EVENTS.GENERATION_FAILED,
  payload: {
    feature: 'traits-rewriter',
    component: 'TraitsRewriterGenerator',
    error: error.message,
    characterName: character.name,
    timestamp: new Date().toISOString()
  }
});
```

### Display Structure

The UI expects sections to be created as:

```html
<div class="trait-section">
  <h3 class="trait-section-title">Likes</h3>
  <div class="trait-content">First-person rewritten content...</div>
</div>
```

---

## Testing Requirements

### Unit Tests Required

1. **TraitsRewriterController Tests**
   - `tests/unit/characterBuilder/controllers/TraitsRewriterController.test.js`
   - Input validation and UI state management
   - Event handling and error scenarios
   - Integration with base controller functionality

2. **TraitsRewriterGenerator Tests**
   - `tests/unit/characterBuilder/services/TraitsRewriterGenerator.test.js`
   - Trait extraction from character definitions
   - LLM prompt generation and service integration
   - Error handling and edge cases

3. **TraitsRewriterResponseProcessor Tests**
   - `tests/unit/characterBuilder/services/TraitsRewriterResponseProcessor.test.js`
   - JSON parsing and schema validation
   - Content sanitization and safety
   - Error recovery scenarios

4. **TraitsRewriterDisplayEnhancer Tests**
   - `tests/unit/characterBuilder/services/TraitsRewriterDisplayEnhancer.test.js`
   - Display formatting and HTML safety
   - Export functionality and file naming
   - Section creation and organization

### Integration Tests Required

1. **Complete Workflow Tests**
   - `tests/integration/characterBuilder/traitsRewriterWorkflow.integration.test.js`
   - End-to-end generation and display workflow
   - Error handling integration
   - Event system integration

2. **LLM Service Integration Tests**
   - `tests/integration/characterBuilder/traitsRewriterLLMIntegration.test.js`
   - Actual LLM service calls with test data
   - Response processing integration
   - Performance and timeout handling

### E2E Tests Required

1. **User Workflow Tests**
   - `tests/e2e/traitsRewriter/traitsRewriterUserWorkflow.e2e.test.js`
   - Complete user interaction flow
   - UI state changes and feedback
   - Accessibility compliance validation

2. **Export Functionality Tests**
   - `tests/e2e/traitsRewriter/traitsRewriterExport.e2e.test.js`
   - File download and content verification
   - Multiple export format support
   - Error handling in export operations

---

## Implementation Priority

### Phase 1: Critical Runtime Fix (URGENT)

**Goal**: Resolve import error and enable application startup

1. Create minimal `TraitsRewriterController` stub that extends `BaseCharacterBuilderController`
2. Add dependency injection tokens to `tokens.js`
3. Register controller in `characterBuilderRegistrations.js`
4. Verify application starts without errors

### Phase 2: Core Business Logic (HIGH)

**Goal**: Implement functional trait rewriting workflow  

1. Implement `TraitsRewriterGenerator` with LLM integration
2. Create `TraitsRewriterResponseProcessor` for response handling
3. Build `TraitsRewriterDisplayEnhancer` for formatting and export
4. Complete `TraitsRewriterController` with full functionality
5. Add `TraitsRewriterError` class for comprehensive error handling

### Phase 3: Testing & Validation (STANDARD)

**Goal**: Ensure reliability and quality

1. Write comprehensive unit tests for all components
2. Create integration tests for workflow validation
3. Implement E2E tests for user experience verification
4. Performance testing and optimization
5. Accessibility validation and compliance

---

## Success Criteria

### Functional Requirements

- ✅ Character definition input with real-time JSON validation
- ✅ First-person trait rewriting guided by speech patterns
- ✅ All 10 supported trait types processed when present
- ✅ Professional display with organized sections
- ✅ Export functionality (text and JSON formats)
- ✅ Comprehensive error handling and user feedback

### Technical Requirements

- ✅ Application starts without errors
- ✅ Follows established architecture patterns
- ✅ Integrates with existing LLM and validation infrastructure
- ✅ Maintains UI polish and accessibility standards
- ✅ Comprehensive test coverage (80%+ branches)

### Quality Requirements

- ✅ WCAG AA accessibility compliance maintained
- ✅ Responsive design across all devices
- ✅ Professional error handling and user guidance
- ✅ Performance optimization for large character definitions
- ✅ Security best practices for user input handling

---

## Risk Assessment

### 🟢 Low Risk Factors

- **Architectural Clarity**: Well-established patterns and infrastructure
- **UI Foundation**: Complete professional implementation already exists
- **LLM Integration**: Existing service infrastructure and comprehensive prompts
- **Requirements Definition**: Clear specifications and expected outcomes

### 🟡 Medium Risk Factors

- **Response Quality**: LLM output may require validation and retry logic
- **Character Definition Complexity**: Various formats and structures to handle
- **Performance**: Large character definitions may impact processing time

### 🔴 Risk Mitigation

- **Comprehensive Testing**: Full test coverage for edge cases and error scenarios
- **Graceful Degradation**: Fallback options for service failures
- **User Feedback**: Clear progress indicators and helpful error messages

---

## Existing Assets (Complete)

### Professional UI Foundation ✅

- **HTML Page**: `traits-rewriter.html` - WCAG AA compliant interface
- **CSS Styling**: `css/traits-rewriter.css` - Responsive design with animations and dark mode
- **Bootstrap Entry**: `src/traits-rewriter-main.js` - Application initialization
- **Index Integration**: Button properly added to Character Builder section

### Business Logic Foundation ✅

- **Prompts**: `src/characterBuilder/prompts/traitsRewriterPrompts.js` - Comprehensive LLM prompts with schema validation
- **Validation**: `src/characterBuilder/validators/CharacterDefinitionValidator.js` - Refactored for reuse
- **Build System**: Complete bundle configuration and output setup

### Infrastructure Integration ✅

- **LLM Service**: Existing `ConfigurableLLMAdapter` infrastructure
- **Event System**: Character Builder event definitions and dispatch patterns
- **Schema Validation**: AJV integration and validation utilities
- **Error Handling**: Base error classes and display mechanisms

---

## Implementation Notes

### Codebase Architecture Patterns

**CRITICAL**: This specification has been corrected to match the actual codebase architecture. Key patterns to follow:

- **Token System**: Use modular tokens in `tokens-core.js`, not the main `tokens.js`
- **Dependency Injection**: Use `registrar.singletonFactory` with dependency resolution
- **Service Dependencies**: Follow the `llmJsonService` + `llmStrategyFactory` + `llmConfigManager` pattern
- **Validation**: All services must use `validateDependency` with required methods validation
- **Private Fields**: Use `#` syntax for all private state following modern JS patterns
- **BaseCharacterBuilderController**: Leverage the sophisticated base class features (UIStateManager, event handling, element caching)

### Code Quality Standards

- **Follow Project Patterns**: Match existing Character Builder implementation patterns exactly
- **Dependency Injection**: All services must use dependency injection with `validateDependency` validation
- **Error Handling**: Comprehensive error scenarios with user-friendly messages
- **Logging**: Appropriate debug and info logging throughout workflow
- **Documentation**: JSDoc comments for all public methods and classes
- **Modern JavaScript**: Use private fields (`#`), async/await, and ES6+ patterns consistently

### Performance Considerations

- **Lazy Loading**: Load services only when needed
- **Response Caching**: Consider caching for repeat operations
- **Memory Management**: Proper cleanup of large objects and event listeners
- **Progress Feedback**: Loading indicators and progress updates for users

### Security Considerations  

- **Input Validation**: Comprehensive validation of character definitions
- **Content Sanitization**: HTML escaping for all user content display
- **Error Information**: Avoid leaking sensitive information in error messages
- **XSS Prevention**: Secure handling of dynamic content generation

---

## Conclusion

This specification provides a complete implementation guide for the missing business logic components of the Traits Rewriter feature. With the professional UI foundation already complete, the remaining work focuses on core services that follow well-established patterns.

**Implementation Path**: Clear and straightforward  
**Risk Level**: Low with proper testing  
**Estimated Timeline**: 2-3 days for experienced developer  
**Expected Quality**: Production-ready with comprehensive polish

The feature will provide significant value for character development workflows while maintaining the high standards established by the existing UI foundation and project architecture.

---

## Specification Corrections Applied

This specification has been corrected to accurately reflect the actual codebase architecture:

### ✅ **Corrected Architectural Assumptions**

1. **Token System**: Updated from simple `TOKENS` object to modular token system in `tokens-core.js`
2. **Dependency Injection**: Corrected to use `registrar.singletonFactory` with proper dependency resolution
3. **Service Dependencies**: Fixed to use actual patterns: `llmJsonService`, `llmStrategyFactory`, `llmConfigManager`, `eventBus`, `tokenEstimator`  
4. **BaseCharacterBuilderController**: Updated to reflect sophisticated implementation with private fields, UIStateManager, and advanced validation
5. **Constructor Patterns**: Corrected to show proper `validateDependency` usage and error handling
6. **Event Integration**: Updated to use established `CHARACTER_BUILDER_EVENTS` patterns
7. **LLM Integration**: Fixed to show actual service patterns used in the codebase

### 📋 **Verification Completed**

- ✅ Confirmed TraitsRewriterController missing (runtime issue)
- ✅ Verified UI infrastructure exists and is complete
- ✅ Confirmed prompt templates are comprehensive and ready
- ✅ Validated existing service registration patterns
- ✅ Checked actual BaseCharacterBuilderController interface

**Result**: Specification now provides accurate implementation guidance that matches the established codebase patterns and architecture.