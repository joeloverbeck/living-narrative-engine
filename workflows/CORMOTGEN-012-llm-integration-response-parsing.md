# CORMOTGEN-012: Enhance LLM Integration and Response Processing

## Ticket ID
CORMOTGEN-012

## Title
Enhance LLM integration response processing and error recovery for Core Motivations

## Status
TODO

## Priority
MEDIUM (downgraded - most functionality already implemented)

## Estimated Effort
1-2 hours (reduced - mainly enhancements to existing system)

## Dependencies
- CORMOTGEN-011 (CoreMotivationsGenerator service) - ✅ COMPLETED
- LLM proxy server running
- Existing LlmJsonService and ConfigurableLLMAdapter

## Related Files
- `src/characterBuilder/services/CoreMotivationsGenerator.js` (EXISTS - enhance)
- `src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js` (EXISTS - review)
- `src/llms/llmJsonService.js` (EXISTS - utilize)
- `src/turns/adapters/configurableLLMAdapter.js` (EXISTS - utilize)

## Description
The CoreMotivationsGenerator service is already implemented with LLM integration and basic response parsing. This ticket enhances the existing system with improved error recovery, response quality validation, and performance monitoring.

## Current Architecture Review

### Existing LLM Communication (WORKING)
```javascript
// Current implementation in CoreMotivationsGenerator
async #callLLM(prompt, llmConfigId) {
  const requestOptions = {
    toolSchema: CORE_MOTIVATIONS_RESPONSE_SCHEMA,
    toolName: 'generate_core_motivations',
    toolDescription: 'Generate core motivations for character development...'
  };

  const response = await this.#llmStrategyFactory.getAIDecision(
    prompt,
    null,
    requestOptions
  );
  return response;
}
```

### Existing Response Processing (WORKING)
```javascript
// Current implementation in CoreMotivationsGenerator
async #parseResponse(rawResponse) {
  const cleanedResponse = this.#llmJsonService.clean(rawResponse);
  const parsedResponse = await this.#llmJsonService.parseAndRepair(
    cleanedResponse,
    { logger: this.#logger }
  );
  return parsedResponse;
}

#validateMotivations(response) {
  validateCoreMotivationsGenerationResponse(response);
}
```

## Enhancement Requirements

### 1. Response Quality Validation
Add content quality checks beyond structural validation:

```javascript
// NEW: Add to CoreMotivationsGenerator
#validateResponseQuality(response) {
  const issues = [];
  
  response.motivations.forEach((motivation, index) => {
    // Check minimum content length
    if (motivation.coreDesire.length < 20) {
      issues.push(`Motivation ${index + 1}: Core desire too brief`);
    }
    
    if (motivation.internalContradiction.length < 30) {
      issues.push(`Motivation ${index + 1}: Internal contradiction too brief`);
    }
    
    // Check for question mark in central question
    if (!motivation.centralQuestion.includes('?')) {
      issues.push(`Motivation ${index + 1}: Central question missing question mark`);
    }
    
    // Check for repetitive content (basic check)
    const words = motivation.coreDesire.toLowerCase().split(' ');
    if (words.length < 5) {
      issues.push(`Motivation ${index + 1}: Core desire lacks depth`);
    }
  });
  
  if (issues.length > 0) {
    throw new CoreMotivationsGenerationError(
      `Response quality issues: ${issues.join('; ')}`,
      { qualityIssues: issues }
    );
  }
}
```

### 2. Enhanced Error Recovery
Improve existing error handling with retry strategies:

```javascript
// NEW: Add to CoreMotivationsGenerator  
async #generateWithRetry(params, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Use existing generate method logic
      const prompt = buildCoreMotivationsGenerationPrompt(
        params.concept.concept,
        params.direction,
        params.clichés
      );
      
      const llmResponse = await this.#callLLM(prompt, params.llmConfigId);
      const parsedResponse = await this.#parseResponse(llmResponse);
      
      // ENHANCE: Add quality validation
      this.#validateMotivations(parsedResponse);
      this.#validateResponseQuality(parsedResponse);
      
      return parsedResponse;
    } catch (error) {
      lastError = error;
      
      if (attempt <= maxRetries) {
        this.#logger.warn(
          `CoreMotivationsGenerator: Attempt ${attempt} failed, retrying...`,
          { error: error.message, attempt }
        );
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
}
```

### 3. Performance Monitoring Enhancement
Add detailed performance and token tracking:

```javascript
// ENHANCE: Modify existing generate method
async generate(params, options = {}) {
  const startTime = Date.now();
  const startTokens = this.#estimateTokens(JSON.stringify(params));
  
  try {
    // ... existing validation logic ...
    
    // ENHANCE: Use retry mechanism
    const parsedResponse = await this.#generateWithRetry(params, options.maxRetries || 2);
    
    const processingTime = Date.now() - startTime;
    const responseTokens = this.#estimateTokens(JSON.stringify(parsedResponse));
    
    // ENHANCE: Add detailed metadata
    const llmMetadata = {
      model: activeConfig?.configId || 'unknown',
      promptTokens: startTokens,
      responseTokens: responseTokens,
      totalTokens: startTokens + responseTokens,
      responseTime: processingTime,
      retryAttempts: options.maxRetries || 0,
      promptVersion: PROMPT_VERSION_INFO.version,
      clicheIds: this.#extractClicheIds(params.clichés),
      qualityChecks: ['structure', 'length', 'format'],
      generationPrompt: prompt.substring(0, 500) + '...'
    };
    
    // ... rest of existing method ...
  } catch (error) {
    // ENHANCE: Add performance data to error events
    const processingTime = Date.now() - startTime;
    
    this.#eventBus.dispatch({
      type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
      payload: {
        conceptId: params.concept.id,
        directionId: params.direction.id,
        error: error.message,
        processingTime,
        failureStage: this.#determineFailureStage(error)
      }
    });
    
    throw error;
  }
}
```

### 4. Response Repair Fallbacks
Add intelligent fallback strategies using existing LlmJsonService:

```javascript
// NEW: Add to CoreMotivationsGenerator
async #parseWithFallbacks(rawResponse) {
  try {
    // Use existing parsing method
    return await this.#parseResponse(rawResponse);
  } catch (parseError) {
    this.#logger.warn('Primary parsing failed, attempting fallback strategies', {
      error: parseError.message
    });
    
    // Fallback 1: Try to extract JSON from markdown code blocks
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const extractedJson = jsonMatch[1];
        return await this.#llmJsonService.parseAndRepair(extractedJson, {
          logger: this.#logger
        });
      } catch (fallbackError) {
        this.#logger.debug('Markdown extraction fallback failed', {
          error: fallbackError.message
        });
      }
    }
    
    // Fallback 2: Try to extract any JSON-like structure
    const jsonObjectMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return await this.#llmJsonService.parseAndRepair(jsonObjectMatch[0], {
          logger: this.#logger
        });
      } catch (fallbackError) {
        this.#logger.debug('JSON object extraction fallback failed', {
          error: fallbackError.message
        });
      }
    }
    
    // All fallbacks failed
    throw new CoreMotivationsGenerationError(
      'All response parsing strategies failed',
      parseError
    );
  }
}
```

## Implementation Steps

1. **Enhance existing generate method** - Add retry logic and performance tracking
2. **Add response quality validation** - Content depth and format checks  
3. **Improve error recovery** - Multiple parsing fallback strategies
4. **Update tests** - Add tests for new quality validation and retry logic
5. **Update event payloads** - Include performance and failure stage data

## Validation Criteria

- [x] Existing LLM integration continues to work
- [ ] Response quality validation catches poor content
- [ ] Retry mechanism handles transient failures  
- [ ] Performance tracking provides detailed metrics
- [ ] Fallback parsing handles edge cases
- [ ] All tests pass including new quality checks
- [ ] Response time remains <10 seconds with retries

## Testing Requirements

### Enhance Existing Tests
- Add quality validation test cases to existing CoreMotivationsGenerator.test.js
- Test retry mechanism with mock failures
- Test performance metadata collection
- Test fallback parsing strategies

### New Test Cases
```javascript
describe('response quality validation', () => {
  it('should reject responses with insufficient content depth', async () => {
    const poorQualityResponse = {
      motivations: [{
        coreDesire: 'wants',  // Too brief
        internalContradiction: 'conflict',  // Too brief  
        centralQuestion: 'What'  // Missing question mark
      }]
    };
    
    expect(() => service.validateResponseQuality(poorQualityResponse))
      .toThrow(CoreMotivationsGenerationError);
  });
});
```

## Notes

- This workflow now correctly builds upon the existing, working implementation
- Focus is on enhancements rather than rebuilding existing functionality
- All proposed changes maintain compatibility with current architecture
- Error handling follows established patterns in the codebase
- Field names match the actual schema implementation

Based on my analysis, I recommend implementing this corrected workflow that enhances the existing, already-functional system rather than rebuilding components that are already working correctly.