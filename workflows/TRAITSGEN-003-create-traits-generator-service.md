# TRAITSGEN-003: Create Traits Generator Service

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Service Layer/Core Logic
- **Priority**: High
- **Estimated Effort**: 2 days
- **Dependencies**: TRAITSGEN-001 (Trait Model), TRAITSGEN-002 (Prompt Implementation)

## Description
Create the core service class that handles LLM-powered traits generation. This service orchestrates the entire generation workflow from input validation through response processing and event dispatching.

## Requirements

### File Creation
- **File**: `src/characterBuilder/services/TraitsGenerator.js` (renamed from TraitGenerator per spec)
- **Template**: Follow `src/characterBuilder/services/CoreMotivationsGenerator.js` pattern
- **Architecture**: Implement full service layer with dependency injection

### Required Dependencies
Based on specification analysis, implement these service dependencies:

```javascript
/**
 * @typedef {import('../types/characterBuilderTypes.js').ILogger} ILogger
 * @typedef {import('../types/characterBuilderTypes.js').LlmJsonService} LlmJsonService
 * @typedef {import('../types/characterBuilderTypes.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../types/characterBuilderTypes.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../types/characterBuilderTypes.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../types/characterBuilderTypes.js').CharacterDatabase} CharacterDatabase
 * @typedef {import('../types/characterBuilderTypes.js').ISchemaValidator} ISchemaValidator
 */

class TraitsGenerator {
  constructor({ 
    logger, 
    llmJsonService, 
    llmStrategyFactory,  // renamed from llmAdapter per spec
    llmConfigManager, 
    eventBus,           // renamed from eventDispatcher per spec
    database,           // optional per spec
    schemaValidator     // optional per spec
  }) {
    // Dependency validation following established patterns
  }
}
```

### Core Method Implementation

#### Primary Generation Method
```javascript
/**
 * Generate character traits based on concept, direction, user inputs, and cliches
 * @param {Object} concept - Character concept object
 * @param {Object} direction - Thematic direction object
 * @param {Object} userInputs - User-provided core motivation, contradiction, question
 * @param {Array} cliches - Array of cliche objects to avoid
 * @param {Object} options - Generation options and configuration
 * @returns {Promise<Object>} Generated traits data (not stored per policy)
 */
async generateTraits(concept, direction, userInputs, cliches, options = {}) {
  // Implementation workflow:
  // 1. Validate inputs (concept object, direction object, userInputs, cliches)
  // 2. Build generation prompt with all required elements from feature requirements
  // 3. Call LLM using #callLLM() with tool schema for structured response
  // 4. Parse and clean response using llmJsonService
  // 5. Validate response structure against TRAITS_RESPONSE_SCHEMA
  // 6. Return traits data (not stored - as per storage policy requirements)
  // 7. Dispatch generation events (started, completed, failed)
}
```

#### Private Helper Methods
```javascript
/**
 * Internal method for LLM communication with tool schema
 * @private
 */
async #callLLM(prompt, llmConfigId) {
  // LLM service integration with proper error handling
  // Tool schema application for structured responses
  // Token estimation and optimization
}

/**
 * Parse and repair JSON response from LLM
 * @private
 */
async #parseResponse(rawResponse) {
  // Use llmJsonService for response cleaning
  // Handle partial/malformed JSON responses
  // Apply response repair strategies
}

/**
 * Validate response structure against schema
 * @private
 */
#validateResponseStructure(response) {
  // Validate against TRAITS_RESPONSE_SCHEMA
  // Check all required trait categories
  // Verify content quality and completeness
}

/**
 * Return schema for external validation
 */
getResponseSchema() {
  // Return TRAITS_RESPONSE_SCHEMA for external use
}
```

### Input Validation Requirements
Implement comprehensive input validation:

1. **Concept Object Validation**
   - Must be valid concept with required properties
   - Must have associated thematic direction
   - Validate concept structure and content

2. **Direction Object Validation**
   - Must be valid thematic direction object
   - Must have both clichés AND core motivations (dual filtering requirement)
   - Validate direction structure and content

3. **User Inputs Validation**
   - `coreMotivation`: Required, non-blank string
   - `internalContradiction`: Required, non-blank string  
   - `centralQuestion`: Required, non-blank string
   - All fields must pass assertNonBlankString validation

4. **Cliches Validation**
   - Must be array of valid cliche objects
   - Validate cliche structure and content
   - Handle empty cliches array gracefully

## Storage Policy Compliance

### CRITICAL Storage Requirements
Per specification requirements, this service MUST comply with storage policy:

- **Generated traits MUST NOT be stored permanently**
- **Generated traits MUST NOT be associated with concepts/thematic directions**
- **Traits exist only during current session for user review**
- **User maintains full control over trait selection and usage**

### Implementation Impact
- No persistent storage methods in service
- Return traits data directly without database operations
- No automatic association with concepts/directions
- Event dispatching for analytics only (no persistence)

## Event Dispatching Requirements

### Required Events
Implement proper event dispatching following established patterns:

```javascript
// Generation started event
this.#eventBus.dispatch({
  type: 'traits_generation_started',
  payload: {
    conceptId: concept.id,
    directionId: direction.id,
    timestamp: new Date().toISOString(),
    metadata: generationMetadata
  }
});

// Generation completed event  
this.#eventBus.dispatch({
  type: 'traits_generation_completed',
  payload: {
    conceptId: concept.id,
    directionId: direction.id,
    traitsGenerated: traits.length,
    generationTime: elapsedTime,
    timestamp: new Date().toISOString(),
    metadata: responseMetadata
  }
});

// Generation failed event
this.#eventBus.dispatch({
  type: 'traits_generation_failed',
  payload: {
    conceptId: concept.id,
    directionId: direction.id,
    error: error.message,
    timestamp: new Date().toISOString(),
    metadata: errorMetadata
  }
});
```

## Error Handling Requirements

### Custom Error Implementation
Create custom error type for traits generation:

```javascript
import { BaseCharacterBuilderError } from '../errors/baseCharacterBuilderError.js';

export class TraitsGenerationError extends BaseCharacterBuilderError {
  constructor(message, originalError = null, context = {}) {
    super(message, originalError, context);
    this.name = 'TraitsGenerationError';
  }
}
```

### Error Scenarios
Handle these error conditions:

1. **Input Validation Errors**
   - Invalid concept/direction objects
   - Missing or invalid user inputs
   - Malformed cliches data

2. **LLM Service Errors**
   - LLM service unavailable
   - Token limit exceeded
   - Invalid API responses
   - Network timeouts

3. **Response Processing Errors**
   - Invalid JSON responses
   - Schema validation failures
   - Missing required trait categories
   - Content quality issues

4. **Configuration Errors**
   - Invalid LLM configuration
   - Missing required dependencies
   - Service initialization failures

### Circuit Breaker Pattern
Implement circuit breaker following existing patterns for handling repeated failures.

## Technical Implementation

### Code Quality Requirements
- Follow camelCase file naming: `TraitsGenerator.js`
- Use PascalCase for class: `TraitsGenerator`
- Implement comprehensive JSDoc documentation
- Apply dependency injection with validateDependency()
- Use # prefix for private methods and fields
- Follow established error handling patterns

### Metadata Tracking
Implement comprehensive metadata tracking for LLM operations:

```javascript
const generationMetadata = {
  promptVersion: PROMPT_VERSION_INFO.version,
  llmConfig: llmConfigId,
  tokenEstimate: estimatedTokens,
  generationStartTime: startTime,
  userInputsProvided: Object.keys(userInputs),
  clichesCount: cliches.length
};
```

### Performance Considerations
- Implement token estimation for generation requests
- Consider prompt caching strategies for repeated elements
- Monitor LLM response times and implement appropriate timeouts
- Optimize prompt structure for token efficiency

## Acceptance Criteria

### Functional Requirements
- [ ] `generateTraits()` successfully generates traits from valid inputs
- [ ] All input validation properly implemented with clear error messages
- [ ] LLM integration works with structured response handling
- [ ] Response parsing and validation against schema successful
- [ ] Event dispatching implemented for all generation states
- [ ] Storage policy compliance - no permanent storage operations

### Error Handling Requirements
- [ ] Custom TraitsGenerationError properly implemented
- [ ] All error scenarios handled with appropriate error types
- [ ] Circuit breaker pattern implemented for repeated failures
- [ ] Error events dispatched with proper context and metadata
- [ ] Graceful degradation for service failures

### Code Quality Requirements
- [ ] Follows established service patterns from CoreMotivationsGenerator
- [ ] Comprehensive JSDoc documentation with type definitions
- [ ] Proper dependency injection and validation
- [ ] Clean separation of concerns with private helper methods
- [ ] Consistent naming conventions and code style

### Testing Requirements
- [ ] Create `tests/unit/characterBuilder/services/TraitsGenerator.test.js`
- [ ] Test successful generation with various input combinations
- [ ] Test all error conditions and edge cases
- [ ] Test event dispatching for all scenarios
- [ ] Mock LLM service interactions appropriately
- [ ] Test storage policy compliance (no persistence)
- [ ] Achieve 85%+ test coverage

## Files Modified
- **NEW**: `src/characterBuilder/services/TraitsGenerator.js`
- **NEW**: `src/characterBuilder/errors/TraitsGenerationError.js`
- **NEW**: `tests/unit/characterBuilder/services/TraitsGenerator.test.js`

## Dependencies For Next Tickets
This service implementation is required for:
- TRAITSGEN-004 (Controller Implementation)
- TRAITSGEN-007 (CharacterBuilderService Integration)
- All subsequent UI and integration tickets

## Notes
- Reference CoreMotivationsGenerator.js for established service patterns
- Pay special attention to storage policy compliance requirements
- Ensure proper event dispatching for analytics without persistence
- Consider token optimization strategies for large prompt structures
- Implement comprehensive error handling for all failure scenarios