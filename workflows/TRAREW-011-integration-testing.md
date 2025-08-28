# TRAREW-011: Integration Testing for TraitsRewriter Workflows

## Priority: 🟡 MEDIUM  

**Phase**: 3 - Testing & Validation  
**Story Points**: 4  
**Estimated Time**: 4-5 hours

## Problem Statement

The TraitsRewriter feature requires comprehensive integration testing to validate that all services work together correctly in realistic scenarios. Integration tests must verify complete workflows, service interactions, event handling, and error recovery across the entire trait rewriting pipeline.

## Requirements

1. Test complete end-to-end trait rewriting workflows
2. Validate service integration and dependency resolution
3. Test event system integration and proper event flow
4. Verify error handling and recovery across service boundaries
5. Test with realistic character data and LLM responses
6. Validate UI controller integration with backend services

## Acceptance Criteria

- [ ] **Complete Workflow Testing**: Full trait rewriting pipeline from input to export
- [ ] **Service Integration**: All TraitsRewriter services working together seamlessly
- [ ] **Event System Validation**: Proper event dispatching and handling throughout workflow
- [ ] **Error Recovery Testing**: Error scenarios propagating correctly across services
- [ ] **Realistic Data Testing**: Tests with actual character definitions and LLM responses
- [ ] **Performance Integration**: Workflow performance under realistic conditions
- [ ] **UI Integration**: Controller properly orchestrating backend services

## Implementation Details

### File Structure
Create integration test files:

```
/tests/integration/characterBuilder/
├── traitsRewriterWorkflows.integration.test.js
├── traitsRewriterServiceIntegration.integration.test.js
├── traitsRewriterEventFlow.integration.test.js
├── traitsRewriterErrorHandling.integration.test.js
└── traitsRewriterPerformance.integration.test.js
```

### Integration Test Framework
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';
import { TraitsRewriterGenerator } from '../../../src/characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
import { TraitsRewriterController } from '../../../src/characterBuilder/controllers/TraitsRewriterController.js';

describe('TraitsRewriter Integration Tests', () => {
  let testBed;
  let container;
  let services;

  beforeEach(async () => {
    testBed = createIntegrationTestBed();
    container = testBed.container;
    
    // Register all TraitsRewriter services
    await testBed.registerTraitsRewriterServices();
    
    // Resolve services for testing
    services = {
      generator: container.resolve('ITraitsRewriterGenerator'),
      processor: container.resolve('ITraitsRewriterResponseProcessor'),  
      enhancer: container.resolve('ITraitsRewriterDisplayEnhancer'),
      controller: container.resolve('ITraitsRewriterController')
    };
  });

  afterEach(async () => {
    await testBed.cleanup();
  });
});
```

## Test Categories

### 1. Complete Workflow Integration Tests

#### End-to-End Trait Rewriting Workflow
```javascript
describe('Complete Workflow Integration', () => {
  it('should execute complete trait rewriting workflow successfully', async () => {
    // Arrange
    const characterDefinition = testBed.getComplexCharacterDefinition();
    const expectedTraits = testBed.getExpectedRewrittenTraits();
    
    // Act - Execute complete workflow
    const result = await services.generator.generateRewrittenTraits(
      characterDefinition, 
      { includeMetadata: true }
    );
    
    const processedResult = await services.processor.processResponse(
      result.llmResponse,
      characterDefinition
    );
    
    const displayData = services.enhancer.enhanceForDisplay(
      processedResult.rewrittenTraits,
      processedResult.characterName
    );
    
    // Assert
    expect(result).toHaveProperty('rewrittenTraits');
    expect(processedResult).toHaveProperty('characterName');
    expect(displayData).toHaveProperty('sections');
    expect(displayData.sections).toHaveLength(3); // personality, likes, fears
  });

  it('should handle partial character data gracefully', async () => {
    const partialCharacterData = {
      'core:name': { text: 'Partial Character' },
      'core:personality': { text: 'Basic personality trait' }
    };
    
    const result = await services.generator.generateRewrittenTraits(partialCharacterData);
    
    expect(result.rewrittenTraits).toHaveProperty('core:personality');
    expect(Object.keys(result.rewrittenTraits)).toHaveLength(1);
  });

  it('should maintain data integrity across service boundaries', async () => {
    const characterData = testBed.getCharacterWithSpecialCharacters();
    
    const generated = await services.generator.generateRewrittenTraits(characterData);
    const processed = await services.processor.processResponse(generated.llmResponse, characterData);
    const enhanced = services.enhancer.enhanceForDisplay(processed.rewrittenTraits, processed.characterName);
    
    // Verify no data corruption
    expect(enhanced.characterName).toContain(characterData['core:name'].text);
    enhanced.sections.forEach(section => {
      expect(section.content).not.toContain('<script>'); // XSS protection
      expect(section.content).toMatch(/^[^<>&"']*$/); // HTML escaped
    });
  });
});
```

### 2. Service Integration Tests

#### Service Dependency Resolution
```javascript
describe('Service Integration', () => {
  it('should resolve all service dependencies correctly', () => {
    // Verify dependency injection worked correctly
    expect(services.generator).toBeDefined();
    expect(services.processor).toBeDefined();
    expect(services.enhancer).toBeDefined();
    expect(services.controller).toBeDefined();
    
    // Verify services can interact with each other
    expect(services.controller).toHaveProperty('generateRewrittenTraits');
  });

  it('should coordinate between Generator and ResponseProcessor', async () => {
    const characterData = testBed.getValidCharacterDefinition();
    
    // Generator creates LLM request
    const generatorResult = await services.generator.generateRewrittenTraits(characterData);
    
    // ResponseProcessor handles LLM response  
    const processorResult = await services.processor.processResponse(
      generatorResult.llmResponse,
      characterData
    );
    
    expect(processorResult.rewrittenTraits).toBeDefined();
    expect(processorResult.characterName).toBe(characterData['core:name'].text);
  });

  it('should coordinate between ResponseProcessor and DisplayEnhancer', async () => {
    const processedTraits = testBed.getProcessedTraitsData();
    
    const displayData = services.enhancer.enhanceForDisplay(
      processedTraits.rewrittenTraits,
      processedTraits.characterName
    );
    
    // Verify proper data transformation
    expect(displayData.sections).toBeInstanceOf(Array);
    expect(displayData.sections[0]).toHaveProperty('label');
    expect(displayData.sections[0]).toHaveProperty('content');
    expect(displayData.sections[0]).toHaveProperty('cssClass');
  });
});
```

### 3. Event System Integration Tests

#### Event Flow Validation
```javascript
describe('Event System Integration', () => {
  it('should dispatch events correctly throughout workflow', async () => {
    const eventSpy = testBed.createEventSpy();
    const characterData = testBed.getValidCharacterDefinition();
    
    // Execute workflow
    await services.generator.generateRewrittenTraits(characterData);
    
    // Verify event sequence
    expect(eventSpy.getEventsByType('GENERATION_STARTED')).toHaveLength(1);
    expect(eventSpy.getEventsByType('GENERATION_COMPLETED')).toHaveLength(1);
    
    const startedEvent = eventSpy.getEventsByType('GENERATION_STARTED')[0];
    expect(startedEvent.payload).toHaveProperty('characterName');
    
    const completedEvent = eventSpy.getEventsByType('GENERATION_COMPLETED')[0];
    expect(completedEvent.payload).toHaveProperty('rewrittenTraits');
  });

  it('should handle event system errors gracefully', async () => {
    const faultyEventBus = testBed.createFaultyEventBus();
    
    // Replace event bus with faulty one
    const generator = new TraitsRewriterGenerator({
      ...testBed.getGeneratorDependencies(),
      eventBus: faultyEventBus
    });
    
    // Should not crash on event bus failures
    await expect(
      generator.generateRewrittenTraits(testBed.getValidCharacterDefinition())
    ).not.toThrow();
  });

  it('should maintain event correlation across services', async () => {
    const eventTracker = testBed.createEventTracker();
    const characterData = testBed.getValidCharacterDefinition();
    
    const result = await services.generator.generateRewrittenTraits(characterData);
    
    const events = eventTracker.getAllEvents();
    const correlationId = events[0].payload.correlationId;
    
    // All events should share same correlation ID
    events.forEach(event => {
      expect(event.payload.correlationId).toBe(correlationId);
    });
  });
});
```

### 4. Error Handling Integration Tests

#### Cross-Service Error Propagation
```javascript
describe('Error Handling Integration', () => {
  it('should propagate errors correctly across service boundaries', async () => {
    const invalidCharacterData = { invalid: 'data' };
    
    // Should fail in Generator and propagate to Controller
    await expect(
      services.controller.generateRewrittenTraits(invalidCharacterData)
    ).rejects.toThrow('INVALID_CHARACTER_DEFINITION');
  });

  it('should handle LLM service failures gracefully', async () => {
    const faultyLLMService = testBed.createFaultyLLMService();
    
    const generator = new TraitsRewriterGenerator({
      ...testBed.getGeneratorDependencies(),
      llmJsonService: faultyLLMService
    });
    
    await expect(
      generator.generateRewrittenTraits(testBed.getValidCharacterDefinition())
    ).rejects.toThrow('LLM_SERVICE_ERROR');
  });

  it('should recover from partial failures', async () => {
    const partiallyBrokenProcessor = testBed.createPartiallyBrokenProcessor();
    
    // Should handle partial processing and return what's available
    const result = await partiallyBrokenProcessor.processResponse(
      testBed.getMalformedLLMResponse(),
      testBed.getValidCharacterDefinition()
    );
    
    expect(result).toHaveProperty('characterName');
    expect(result.rewrittenTraits).toBeDefined();
  });
});
```

### 5. Performance Integration Tests

#### Workflow Performance Under Load
```javascript
describe('Performance Integration', () => {
  it('should maintain acceptable performance with complex character data', async () => {
    const complexCharacterData = testBed.getLargeCharacterDefinition();
    
    const startTime = performance.now();
    await services.generator.generateRewrittenTraits(complexCharacterData);
    const duration = performance.now() - startTime;
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it('should handle concurrent requests efficiently', async () => {
    const characterData = testBed.getValidCharacterDefinition();
    
    const promises = Array(5).fill(null).map(() =>
      services.generator.generateRewrittenTraits(characterData)
    );
    
    const startTime = performance.now();
    const results = await Promise.all(promises);
    const duration = performance.now() - startTime;
    
    // All should succeed
    results.forEach(result => {
      expect(result).toHaveProperty('rewrittenTraits');
    });
    
    // Should not take more than 10 seconds for 5 concurrent requests
    expect(duration).toBeLessThan(10000);
  });
});
```

## Dependencies

**Blocking**:
- TRAREW-005 through TRAREW-009 (All service implementations)
- TRAREW-010 (Unit testing - provides test patterns and utilities)

**External Dependencies**:
- Integration test bed utilities in `/tests/common/`
- Dependency injection container for service resolution
- Event system infrastructure

## Test Data Requirements

### Realistic Character Definitions
```javascript
// Complex character definition for comprehensive testing
export const complexCharacterDefinition = {
  'core:name': { text: 'Elena Vasquez' },
  'core:personality': { text: 'Analytical software engineer with perfectionist tendencies' },
  'core:likes': { text: 'Clean code, challenging algorithms, espresso, and mystery novels' },
  'core:dislikes': { text: 'Technical debt, meetings without agenda, and inefficient processes' },
  'core:fears': { text: 'Public speaking, being seen as incompetent, and system failures' },
  'core:goals': { text: 'Lead a development team and contribute to open source projects' },
  'core:strengths': { text: 'Problem-solving, attention to detail, and code optimization' },
  'core:weaknesses': { text: 'Impatience with unclear requirements and delegation difficulties' }
};

// Character with special characters for XSS testing
export const characterWithSpecialCharacters = {
  'core:name': { text: 'Test <script>alert("xss")</script> Character' },
  'core:personality': { text: 'I have "quotes" and \'apostrophes\' & ampersands' }
};
```

### Mock LLM Responses
```javascript
// Realistic LLM response for integration testing
export const realisticLLMResponse = `{
  "characterName": "Elena Vasquez",
  "rewrittenTraits": {
    "core:personality": "I am an analytical software engineer with perfectionist tendencies, always striving for excellence in my work.",
    "core:likes": "I enjoy writing clean, efficient code and tackling challenging algorithms. I love starting my day with a strong espresso and unwinding with a good mystery novel.",
    "core:fears": "I fear being put on the spot in public speaking situations and worry about being perceived as incompetent by my peers.",
    "core:goals": "I aspire to lead a development team while making meaningful contributions to open source projects that benefit the developer community."
  },
  "generatedAt": "2024-01-15T10:30:00Z"
}`;
```

## Validation Steps

### Step 1: Integration Test Execution
```bash
# Run all integration tests
npm run test:integration -- --testPathPattern="characterBuilder.*TraitsRewriter"

# Run specific integration test suites
npm run test:integration tests/integration/characterBuilder/traitsRewriterWorkflows.integration.test.js
```

### Step 2: Service Resolution Validation
```bash
# Verify dependency injection works in integration environment
npm run test:integration -- --testNamePattern="should resolve all service dependencies"
```

### Step 3: Event Flow Validation
```bash
# Test complete event workflows
npm run test:integration -- --testNamePattern="Event System Integration"
```

## Files Modified

### New Files
- `/tests/integration/characterBuilder/traitsRewriterWorkflows.integration.test.js`
- `/tests/integration/characterBuilder/traitsRewriterServiceIntegration.integration.test.js`
- `/tests/integration/characterBuilder/traitsRewriterEventFlow.integration.test.js`
- `/tests/integration/characterBuilder/traitsRewriterErrorHandling.integration.test.js`
- `/tests/integration/characterBuilder/traitsRewriterPerformance.integration.test.js`

### Test Utilities (if needed)
- `/tests/common/integrationTestBed.js` - Integration-specific test utilities
- `/tests/common/fixtures/traitsRewriterIntegrationData.js` - Integration test data

## Success Metrics

- **Workflow Completion**: All integration test workflows execute successfully
- **Service Coordination**: All services interact correctly without integration issues  
- **Event System**: Proper event flow and correlation throughout workflows
- **Error Resilience**: Graceful error handling and recovery across service boundaries
- **Performance**: Acceptable performance under realistic load conditions
- **Data Integrity**: No data corruption or loss across service transitions

## Next Steps

After completion:
- **TRAREW-012**: End-to-end testing with UI automation
- **TRAREW-013**: Performance testing under load
- **TRAREW-014**: User acceptance testing scenarios

## Implementation Checklist

- [ ] Create integration test file structure
- [ ] Implement complete workflow integration tests
- [ ] Implement service integration and coordination tests
- [ ] Implement event system integration tests  
- [ ] Implement error handling and recovery tests
- [ ] Implement performance integration tests
- [ ] Create realistic test data and mock responses
- [ ] Validate dependency injection in integration environment
- [ ] Test concurrent request handling
- [ ] Verify data integrity across service boundaries
- [ ] Document integration testing patterns
- [ ] Ensure all integration tests pass consistently