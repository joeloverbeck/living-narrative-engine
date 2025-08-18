# CORMOTGEN-011: Implement CoreMotivationsGenerator Service

## Ticket ID

CORMOTGEN-011

## Title

Create the main Core Motivations Generator service for LLM interaction

## Status

TODO

## Priority

HIGH

## Estimated Effort

4-5 hours

## Dependencies

- CORMOTGEN-010 (Prompt generation)
- CORMOTGEN-006 (CoreMotivation model)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 2.1)
- Reference: src/characterBuilder/services/ClicheGenerator.js

## Description

Implement the CoreMotivationsGenerator service that handles LLM communication, response parsing, and motivation generation.

## Technical Requirements

### File: `src/characterBuilder/services/CoreMotivationsGenerator.js`

Key components:

1. **Constructor Dependencies**
   - logger
   - llmService
   - eventBus
   - promptBuilder

2. **Main Methods**

   ```javascript
   async generate({ concept, direction, cliches }) {
     // 1. Build prompt
     // 2. Call LLM
     // 3. Parse response
     // 4. Validate motivations
     // 5. Return array of 3-5 motivations
   }

   async #callLLM(prompt) {
     // Handle LLM communication
     // Track tokens and timing
     // Implement retry logic
   }

   #parseResponse(llmResponse) {
     // Parse JSON response
     // Handle malformed JSON
     // Extract motivations array
   }

   #validateMotivations(motivations) {
     // Validate against schema
     // Check required fields
     // Ensure 3-5 motivations
   }
   ```

3. **Error Handling**
   - Network errors → retry with backoff
   - Parsing errors → attempt JSON repair
   - Validation errors → specific messages
   - Token limit errors → truncate prompt

4. **LLM Configuration**
   - Model: Use configured model
   - Temperature: 0.8
   - Max tokens: 2000
   - Response format: JSON

## Implementation Steps

1. Create service class
2. Implement prompt building
3. Add LLM communication
4. Implement response parsing
5. Add validation logic
6. Implement retry mechanism
7. Add error handling
8. Track generation metadata

## Validation Criteria

- [ ] Generates 3-5 motivations per request
- [ ] Each motivation has all required fields
- [ ] Handles LLM errors gracefully
- [ ] Retry logic works correctly
- [ ] Response time <10 seconds
- [ ] Tracks token usage

## Testing Requirements

- Mock LLM service for unit tests
- Test response parsing
- Test validation logic
- Test retry mechanism
- Test error scenarios

## Checklist

- [ ] Create service class
- [ ] Implement generate method
- [ ] Add LLM communication
- [ ] Parse and validate responses
- [ ] Add retry logic
- [ ] Implement error handling
- [ ] Track metadata
- [ ] Write unit tests
