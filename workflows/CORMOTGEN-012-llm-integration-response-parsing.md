# CORMOTGEN-012: Add LLM Integration and Response Parsing

## Ticket ID

CORMOTGEN-012

## Title

Implement LLM integration and response parsing for Core Motivations

## Status

TODO

## Priority

HIGH

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-011 (CoreMotivationsGenerator service)
- LLM proxy server running

## Related Specs

- specs/core-motivations-generator.spec.md
- LLM service: llm-proxy-server/

## Description

Implement the LLM communication layer and response parsing logic for Core Motivations generation, including JSON parsing, error recovery, and validation.

## Technical Requirements

### 1. LLM Communication Layer

```javascript
// Configuration
const LLM_CONFIG = {
  model: 'gpt-4', // or from config
  temperature: 0.8,
  max_tokens: 2000,
  response_format: { type: 'json_object' }
};

// Communication method
async #communicateWithLLM(prompt) {
  const request = {
    prompt,
    ...LLM_CONFIG,
    metadata: {
      feature: 'core-motivations',
      timestamp: Date.now()
    }
  };

  const response = await this.#llmService.generateCompletion(request);
  return response;
}
```

### 2. Response Parser

```javascript
class MotivationResponseParser {
  parse(rawResponse) {
    // 1. Extract JSON from response
    // 2. Handle malformed JSON
    // 3. Validate structure
    // 4. Transform to expected format

    try {
      const parsed = this.#extractJSON(rawResponse);
      const validated = this.#validateStructure(parsed);
      return this.#transformMotivations(validated);
    } catch (error) {
      return this.#attemptRecovery(rawResponse);
    }
  }

  #extractJSON(text) {
    // Find JSON block in text
    // Handle markdown code blocks
    // Clean up formatting
  }

  #attemptRecovery(text) {
    // Try to repair JSON
    // Extract partial data
    // Generate fallback structure
  }
}
```

### 3. Response Validation

```javascript
#validateResponse(response) {
  // Check for motivations array
  if (!response.motivations || !Array.isArray(response.motivations)) {
    throw new ValidationError('Invalid response structure');
  }

  // Check count (3-5)
  if (response.motivations.length < 3 || response.motivations.length > 5) {
    throw new ValidationError('Must have 3-5 motivations');
  }

  // Validate each motivation
  response.motivations.forEach(m => {
    if (!m.coreMotivation || !m.contradiction || !m.centralQuestion) {
      throw new ValidationError('Missing required fields');
    }
  });
}
```

### 4. Error Recovery Strategies

- **Malformed JSON**: Use json-repair library
- **Missing fields**: Use defaults or regenerate
- **Wrong format**: Attempt extraction with regex
- **Empty response**: Retry with modified prompt
- **Token limit**: Reduce prompt size and retry

## Implementation Steps

1. Set up LLM configuration
2. Implement communication method
3. Create response parser class
4. Add JSON extraction logic
5. Implement validation
6. Add error recovery
7. Create fallback strategies
8. Add logging and metrics

## Validation Criteria

- [ ] Successfully parses valid JSON responses
- [ ] Recovers from malformed JSON
- [ ] Validates all required fields
- [ ] Handles edge cases gracefully
- [ ] Logs parsing issues for debugging
- [ ] Maintains <10 second response time

## Testing Requirements

- Test with various response formats
- Test malformed JSON recovery
- Test validation logic
- Test error scenarios
- Mock LLM responses

## Checklist

- [ ] Implement LLM communication
- [ ] Create response parser
- [ ] Add JSON extraction
- [ ] Implement validation
- [ ] Add error recovery
- [ ] Create fallbacks
- [ ] Add logging
- [ ] Write tests
