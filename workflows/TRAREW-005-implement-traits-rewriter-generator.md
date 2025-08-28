# TRAREW-005: Implement TraitsRewriterGenerator Service

## Priority: 🔥 HIGH

**Phase**: 2 - Core Business Logic  
**Story Points**: 5  
**Estimated Time**: 4-6 hours

## Problem Statement

The TraitsRewriterGenerator is the core business logic service responsible for orchestrating the trait rewriting workflow. It extracts traits from character definitions, creates LLM prompts, manages the generation process, and coordinates with other services for a complete rewriting workflow.

## Requirements

1. Extract relevant traits from character definitions (10 supported types)
2. Create LLM prompts using existing template infrastructure
3. Integrate with LLM services following established patterns
4. Process and validate LLM responses
5. Handle errors comprehensively with proper event dispatching
6. Support token estimation and performance monitoring

## Acceptance Criteria

- [ ] **Trait Extraction**: Identifies and extracts all 10 supported trait types when present
- [ ] **Prompt Generation**: Uses `createTraitsRewriterPrompt()` with proper character data
- [ ] **LLM Integration**: Correctly uses `llmJsonService` and `llmStrategyFactory` patterns
- [ ] **Response Handling**: Delegates to TraitsRewriterResponseProcessor for validation
- [ ] **Event Integration**: Dispatches CHARACTER_BUILDER_EVENTS at appropriate lifecycle points
- [ ] **Error Handling**: Comprehensive error scenarios with user-friendly messages
- [ ] **Token Management**: Estimates and monitors token usage
- [ ] **Architecture Compliance**: Follows codebase patterns (private fields, validation, logging)

## Implementation Details

### File to Create

**Path**: `/src/characterBuilder/services/TraitsRewriterGenerator.js`

### Core Interface

```javascript
/**
 * @file TraitsRewriterGenerator - Core service for trait rewriting workflow
 * @description Orchestrates trait extraction, LLM integration, and response processing
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { createTraitsRewriterPrompt, DEFAULT_TRAIT_KEYS, TRAITS_REWRITER_LLM_PARAMS } from '../prompts/traitsRewriterPrompts.js';
import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';
import { TraitsRewriterError, TRAITS_REWRITER_ERROR_CODES } from '../errors/TraitsRewriterError.js';

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
    // Comprehensive dependency validation
    this.#validateDependencies(dependencies);

    // Store validated dependencies
    this.#logger = dependencies.logger;
    this.#llmJsonService = dependencies.llmJsonService;
    this.#llmStrategyFactory = dependencies.llmStrategyFactory;
    this.#llmConfigManager = dependencies.llmConfigManager;
    this.#eventBus = dependencies.eventBus;
    this.#tokenEstimator = dependencies.tokenEstimator;

    this.#logger.info('TraitsRewriterGenerator: Initialized successfully');
  }

  /**
   * Main entry point for trait rewriting workflow
   * @param {object} characterDefinition - Complete character definition
   * @param {object} options - Generation options
   * @returns {Promise<object>} Rewritten traits
   */
  async generateRewrittenTraits(characterDefinition, options = {}) {
    // Implementation details...
  }

  // Private methods for workflow steps
  #extractRelevantTraits(characterDefinition)
  #createLLMPrompt(characterData)
  #validateGenerationResult(response)
  #handleGenerationErrors(error, context)
  #dispatchGenerationEvents(eventType, payload)
  #estimateTokenUsage(prompt)
  #validateDependencies(dependencies)
}
```

### Key Methods Implementation

#### 1. generateRewrittenTraits()

Main orchestration method:

- Extract relevant traits from character definition
- Create LLM prompt with character data
- Execute LLM generation with proper error handling
- Process and validate response
- Dispatch appropriate events
- Return formatted results

#### 2. #extractRelevantTraits()

Trait extraction logic:

- Check for each of the 10 supported trait types
- Handle various character definition formats
- Validate trait content and structure
- Return structured trait data

#### 3. #createLLMPrompt()

Prompt generation:

- Use `createTraitsRewriterPrompt()` from existing templates
- Include character data, speech patterns, and context
- Add generation options and parameters

#### 4. LLM Integration

Follow established patterns:

```javascript
const response = await this.#llmJsonService.generateContent({
  prompt: this.#createLLMPrompt(characterData),
  llmStrategyFactory: this.#llmStrategyFactory,
  llmConfigManager: this.#llmConfigManager,
  schema: TRAITS_REWRITER_RESPONSE_SCHEMA,
  temperature: TRAITS_REWRITER_LLM_PARAMS.temperature,
  maxTokens: TRAITS_REWRITER_LLM_PARAMS.max_tokens,
  logger: this.#logger,
});
```

## Dependencies

**Blocking**:

- TRAREW-004 (Application Startup Verified)
- TraitsRewriterError class (created in TRAREW-009)
- TraitsRewriterResponseProcessor (created in TRAREW-006)

**External Dependencies**:

- Existing prompt templates in `traitsRewriterPrompts.js` ✅
- CHARACTER_BUILDER_EVENTS constants ✅
- LLM service infrastructure ✅

**Required Services** (via DI):

- `ILogger` - Logging service
- `LlmJsonService` - JSON-safe LLM interaction
- `LLMAdapter` - ConfigurableLLMAdapter for content generation
- `ILLMConfigurationManager` - LLM configuration management
- `ISafeEventDispatcher` - Event system integration
- `ITokenEstimator` - Token usage estimation

## Testing Requirements

### Unit Tests

Create `/tests/unit/characterBuilder/services/TraitsRewriterGenerator.test.js`:

```javascript
describe('TraitsRewriterGenerator', () => {
  describe('Constructor Validation', () => {
    it('should validate all required dependencies');
    it('should throw error for missing dependencies');
  });

  describe('Trait Extraction', () => {
    it('should extract all present trait types');
    it('should handle missing traits gracefully');
    it('should validate trait content structure');
  });

  describe('LLM Integration', () => {
    it('should create proper prompts with character data');
    it('should call LLM service with correct parameters');
    it('should handle LLM service errors gracefully');
  });

  describe('Event Dispatching', () => {
    it('should dispatch GENERATION_STARTED event');
    it('should dispatch GENERATION_COMPLETED on success');
    it('should dispatch GENERATION_FAILED on errors');
  });

  describe('Token Management', () => {
    it('should estimate token usage accurately');
    it('should monitor token consumption');
  });
});
```

### Integration Testing

Integration tests handled in TRAREW-014.

## Validation Steps

### Step 1: Service Creation

```javascript
// Test service instantiation
const generator = container.resolve(tokens.TraitsRewriterGenerator);
expect(generator).toBeDefined();
```

### Step 2: Trait Extraction Test

```javascript
const characterData = {
  'core:name': { text: 'Test Character' },
  'core:personality': { text: 'Analytical and methodical' },
  'core:likes': { text: 'Books and puzzles' },
};

const traits = generator.extractRelevantTraits(characterData);
expect(traits).toHaveProperty('core:personality');
expect(traits).toHaveProperty('core:likes');
```

### Step 3: LLM Integration Test

```javascript
const result = await generator.generateRewrittenTraits(characterData);
expect(result).toHaveProperty('rewrittenTraits');
expect(result).toHaveProperty('characterName');
```

## Files Modified

### New Files

- `/src/characterBuilder/services/TraitsRewriterGenerator.js` - Main service implementation

### Dependencies Referenced

- `/src/characterBuilder/prompts/traitsRewriterPrompts.js` ✅ (exists)
- `/src/characterBuilder/services/characterBuilderService.js` ✅ (exists)
- `/src/characterBuilder/errors/TraitsRewriterError.js` (created in TRAREW-009)

## Supported Trait Types

The service must handle these 10 trait types when present:

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

## Error Handling

### Error Categories

- **INVALID_CHARACTER_DEFINITION**: Malformed or missing character data
- **GENERATION_FAILED**: LLM service errors or failures
- **VALIDATION_FAILED**: Response validation errors
- **MISSING_TRAITS**: No extractable traits found

### Error Context

Each error should include:

- Character name (if available)
- Trait types being processed
- LLM service details
- Timestamp and correlation ID

## Performance Considerations

### Token Management

- Estimate token usage before generation
- Monitor actual token consumption
- Log token metrics for optimization

### Response Caching

- Consider caching for identical character definitions
- Implement cache invalidation strategy
- Balance memory usage vs performance

### Async Processing

- Use proper async/await patterns
- Handle concurrent requests appropriately
- Implement timeout handling

## Success Metrics

- **Trait Extraction**: Successfully identifies all present trait types
- **LLM Integration**: Generates coherent first-person trait rewrites
- **Error Handling**: Graceful handling of all error scenarios
- **Event Integration**: Proper event dispatching throughout workflow
- **Performance**: Token usage within expected bounds
- **Code Quality**: Follows all established patterns and standards

## Next Steps

After completion:

- **TRAREW-006**: Implement TraitsRewriterResponseProcessor
- **TRAREW-007**: Implement TraitsRewriterDisplayEnhancer
- **TRAREW-008**: Complete TraitsRewriterController integration
- **TRAREW-011**: Comprehensive unit testing

## Implementation Checklist

- [ ] Create service file with proper imports
- [ ] Implement constructor with dependency validation
- [ ] Implement generateRewrittenTraits() main method
- [ ] Implement trait extraction logic
- [ ] Implement LLM prompt creation
- [ ] Implement LLM service integration
- [ ] Implement response processing delegation
- [ ] Implement comprehensive error handling
- [ ] Implement event dispatching
- [ ] Add token estimation and monitoring
- [ ] Add comprehensive JSDoc documentation
- [ ] Create unit tests
- [ ] Test integration with existing services
- [ ] Validate error scenarios and edge cases
