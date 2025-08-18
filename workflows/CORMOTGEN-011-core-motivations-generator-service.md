# CORMOTGEN-011: Implement CoreMotivationsGenerator Service

## Ticket ID

CORMOTGEN-011

## Title

Create the main Core Motivations Generator service for LLM interaction

## Status

PARTIALLY IMPLEMENTED

## Priority

HIGH

## Estimated Effort

3-4 hours (reduced due to existing infrastructure)

## Dependencies

- CORMOTGEN-010 (Prompt generation) - ✅ COMPLETED
- CORMOTGEN-006 (CoreMotivation model) - ✅ COMPLETED
- Existing infrastructure:
  - CoreMotivationsGeneratorController - Already implemented
  - Database methods in characterBuilderService - Already implemented
  - Prompt templates and validation schemas - Already implemented

## Related Specs

- specs/core-motivations-generator.spec.md (Section 2.1)
- Reference: src/characterBuilder/services/ClicheGenerator.js

## Description

Implement the CoreMotivationsGenerator service that handles LLM communication, response parsing, and motivation generation. This service is already referenced by the CoreMotivationsGeneratorController but does not yet exist.

## Current State

- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js` - ✅ Implemented
- **Service**: `src/characterBuilder/services/CoreMotivationsGenerator.js` - ❌ Missing (this ticket)
- **Display Enhancer**: `src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js` - ❌ Missing (needs separate ticket)
- **Prompts**: `src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js` - ✅ Implemented
- **Model**: `src/characterBuilder/models/coreMotivation.js` - ✅ Implemented

## Technical Requirements

### File: `src/characterBuilder/services/CoreMotivationsGenerator.js`

**Note**: Follow the pattern established in `ClicheGenerator.js` for consistency.

Key components:

1. **Constructor Dependencies** (following ClicheGenerator pattern)
   - logger (ILogger)
   - llmJsonService (LlmJsonService)
   - llmStrategyFactory (function to create ConfigurableLLMAdapter)
   - llmConfigManager (ILLMConfigurationManager)
   - eventBus (ISafeEventDispatcher)

2. **Main Methods**

   ```javascript
   async generate({ concept, direction, clichés }) {
     // Note: Use French spelling 'clichés' to match controller
     // 1. Build prompt using buildCoreMotivationsPrompt()
     // 2. Call LLM via llmJsonService
     // 3. Parse response using CoreMotivation.fromLLMResponse()
     // 4. Validate using CORE_MOTIVATIONS_RESPONSE_SCHEMA
     // 5. Return array of CoreMotivation instances
   }

   async #callLLM(prompt, responseSchema) {
     // Use llmJsonService.generateJsonResponse()
     // Include CORE_MOTIVATIONS_LLM_PARAMS
     // Track tokens and timing
     // Implement retry logic
   }

   #parseResponse(llmResponse) {
     // Use CoreMotivation.fromLLMResponse() factory
     // Handle malformed JSON
     // Extract motivations array
   }

   #validateMotivations(motivations) {
     // Validate against CORE_MOTIVATIONS_RESPONSE_SCHEMA
     // Check required fields (coreDesire, internalContradiction, centralQuestion)
     // Ensure appropriate number of motivations
   }
   ```

3. **Error Handling**
   - Network errors → retry with backoff
   - Parsing errors → attempt JSON repair
   - Validation errors → specific messages
   - Token limit errors → truncate prompt

4. **LLM Configuration**
   - Use CORE_MOTIVATIONS_LLM_PARAMS from coreMotivationsGenerationPrompt.js:
     - Temperature: 0.8
     - Max tokens: 3000
   - Response format: JSON with CORE_MOTIVATIONS_RESPONSE_SCHEMA

5. **Integration with Existing Infrastructure**
   - Import prompt functions from `../prompts/coreMotivationsGenerationPrompt.js`
   - Use CoreMotivation model from `../models/coreMotivation.js`
   - Dispatch events already defined in characterBuilderService:
     - CORE_MOTIVATIONS_GENERATION_STARTED
     - CORE_MOTIVATIONS_GENERATION_COMPLETED
     - CORE_MOTIVATIONS_GENERATION_FAILED
   - Database methods already available in characterBuilderService:
     - saveCoreMotivations()
     - getCoreMotivationsByDirectionId()
     - removeCoreMotivationItem()
     - clearCoreMotivationsForDirection()

## Implementation Steps

1. Create service class at `src/characterBuilder/services/CoreMotivationsGenerator.js`
2. Import dependencies and existing utilities:
   - Prompt functions from `coreMotivationsGenerationPrompt.js`
   - CoreMotivation model with fromLLMResponse() factory
   - Validation schemas and LLM parameters
3. Implement constructor following ClicheGenerator pattern
4. Implement generate() method with correct French spelling 'clichés'
5. Add LLM communication via llmJsonService.generateJsonResponse()
6. Use CoreMotivation.fromLLMResponse() for parsing
7. Add retry mechanism following ClicheGenerator pattern
8. Implement error handling with CoreMotivationsGenerationError
9. Ensure compatibility with controller expectations

## Validation Criteria

- [ ] Service generates CoreMotivation instances with required fields:
  - coreDesire (string)
  - internalContradiction (string)
  - centralQuestion (string)
- [ ] Compatible with controller's expected interface
- [ ] Handles LLM errors gracefully
- [ ] Retry logic works correctly
- [ ] Response time <10 seconds
- [ ] Tracks token usage
- [ ] Integrates with existing event system

## Testing Requirements

- Unit tests at: `tests/unit/characterBuilder/services/CoreMotivationsGenerator.test.js`
- Follow existing test patterns from ClicheGenerator tests
- Mock llmJsonService for unit tests
- Test CoreMotivation.fromLLMResponse() integration
- Test validation against CORE_MOTIVATIONS_RESPONSE_SCHEMA
- Test retry mechanism with various failure scenarios
- Test error handling (network, parsing, validation)
- Controller integration tests already exist

## Additional Notes

### Missing CoreMotivationsDisplayEnhancer Service
The controller also requires `CoreMotivationsDisplayEnhancer` at `src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js`. This should be implemented as a separate ticket with methods:
- createMotivationBlock()
- formatMotivationsForExport()
- formatSingleMotivation()

### Checklist

- [ ] Create service class following ClicheGenerator pattern
- [ ] Implement generate method with French spelling 'clichés'
- [ ] Add LLM communication via llmJsonService
- [ ] Parse responses using CoreMotivation.fromLLMResponse()
- [ ] Validate against CORE_MOTIVATIONS_RESPONSE_SCHEMA
- [ ] Add retry logic following existing patterns
- [ ] Implement CoreMotivationsGenerationError
- [ ] Write comprehensive unit tests
- [ ] Verify integration with controller
