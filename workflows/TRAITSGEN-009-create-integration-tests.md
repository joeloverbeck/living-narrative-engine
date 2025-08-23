# TRAITSGEN-009: Create Integration Tests

## Ticket Overview

- **Epic**: Traits Generator Implementation
- **Type**: Testing/Quality Assurance
- **Priority**: High
- **Estimated Effort**: 1.5 days
- **Dependencies**: TRAITSGEN-003 (Service), TRAITSGEN-005 (Controller), TRAITSGEN-007 (Service Integration)

## Description

Create comprehensive integration tests that validate the complete traits generation workflow from user input through LLM integration to results display. These tests ensure all components work together correctly and handle various scenarios.

## Requirements

### Test File Creation

- **File**: `tests/integration/traitsGenerator/traitsGeneratorIntegration.test.js`
- **Template**: Follow existing integration test patterns from other character-builder tests
- **Coverage**: End-to-end workflow testing with mocked LLM services

### Test Architecture

Follow established integration testing patterns:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraitsGeneratorIntegrationTestBed } from '../../common/testBeds/traitsGeneratorIntegrationTestBed.js';

describe('Traits Generator Integration Tests', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new TraitsGeneratorIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // Test suites defined below
});
```

### Required Test Suites

#### 1. End-to-End Workflow Tests

```javascript
describe('Complete Traits Generation Workflow', () => {
  it('should complete full generation workflow with valid inputs', async () => {
    // Arrange: Set up concept, direction, user inputs, and clichés
    const concept = testBed.createValidConcept();
    const direction = testBed.createValidDirection();
    const userInputs = testBed.createValidUserInputs();
    const cliches = testBed.createValidCliches();

    // Mock LLM response
    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    // Act: Execute full workflow
    const result = await testBed.executeTraitsGeneration(
      concept,
      direction,
      userInputs,
      cliches
    );

    // Assert: Verify successful generation
    expect(result).toBeDefined();
    expect(result.names).toHaveLength(3);
    expect(result.physicalDescription).toBeTruthy();
    expect(result.personality).toHaveLength(3);
    // ... verify all 12 trait categories
  });

  it('should handle generation with minimal user inputs', async () => {
    // Test with minimum required inputs
    const minimalUserInputs = {
      coreMotivation: 'Simple motivation',
      internalContradiction: 'Basic contradiction',
      centralQuestion: 'Simple question',
    };

    const result = await testBed.executeTraitsGeneration(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      minimalUserInputs,
      []
    );

    expect(result).toBeDefined();
    testBed.verifyAllTraitCategoriesPresent(result);
  });

  it('should handle generation with extensive user inputs', async () => {
    // Test with lengthy, complex user inputs
    const complexUserInputs = testBed.createComplexUserInputs();

    const result = await testBed.executeTraitsGeneration(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      complexUserInputs,
      testBed.createExtensiveCliches()
    );

    expect(result).toBeDefined();
    testBed.verifyAllTraitCategoriesPresent(result);
  });
});
```

#### 2. Service Integration Tests

```javascript
describe('Service Layer Integration', () => {
  it('should integrate CharacterBuilderService with TraitsGenerator', async () => {
    // Test service-to-service communication
    const characterBuilderService = testBed.getCharacterBuilderService();
    const concept = testBed.createValidConcept();
    const direction = testBed.createValidDirection();
    const userInputs = testBed.createValidUserInputs();

    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    const result = await characterBuilderService.generateTraitsForDirection(
      concept,
      direction,
      userInputs,
      []
    );

    expect(result).toBeDefined();
    testBed.verifyTraitsStructure(result);
  });

  it('should properly filter directions with dual requirements', async () => {
    // Test dual filtering (clichés + core motivations)
    const characterBuilderService = testBed.getCharacterBuilderService();

    // Set up test data with some directions having both, some having only one
    testBed.setupDirectionsWithMixedRequirements();

    const eligibleDirections = await characterBuilderService.getDirectionsWithClichesAndMotivations();

    // Should only return directions with both clichés AND core motivations
    expect(eligibleDirections).toHaveLength(2); // Based on test data setup

    for (const directionData of eligibleDirections) {
      const hasClichés = await characterBuilderService.hasClichesForDirection(directionData.direction.id);
      const hasMotivations = await characterBuilderService.hasCoreMot­ivationsForDirection(directionData.direction.id);

      expect(hasClichés).toBe(true);
      expect(hasMotivations).toBe(true);
    }
  });

  it('should maintain storage policy compliance', async () => {
    // Verify no persistent storage occurs
    const database = testBed.getDatabaseMock();
    const characterBuilderService = testBed.getCharacterBuilderService();

    await characterBuilderService.generateTraitsForDirection(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      testBed.createValidUserInputs(),
      []
    );

    // Assert no storage methods were called
    expect(database.storeTraits).not.toHaveBeenCalled();
    expect(database.associateTraitsWithDirection).not.toHaveBeenCalled();
    expect(database.saveTraitsData).not.toHaveBeenCalled();
  });
});
```

#### 3. Controller Integration Tests

```javascript
describe('Controller Integration', () => {
  it('should integrate controller with service layer', async () => {
    // Test controller-to-service communication
    const controller = testBed.getTraitsGeneratorController();

    // Set up UI state
    testBed.setupValidUIState();
    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    // Execute controller workflow
    await controller.generateTraits();

    // Verify UI updated correctly
    expect(testBed.getResultsContainer().hidden).toBe(false);
    expect(testBed.getExportButton().hidden).toBe(false);
    testBed.verifyResultsDisplay();
  });

  it('should handle controller error states properly', async () => {
    const controller = testBed.getTraitsGeneratorController();

    // Mock LLM service failure
    testBed.mockLLMServiceFailure(new Error('LLM service unavailable'));

    testBed.setupValidUIState();

    await controller.generateTraits();

    // Verify error state displayed
    expect(testBed.getErrorContainer().hidden).toBe(false);
    expect(testBed.getErrorMessage()).toContain('Generation failed');
    expect(testBed.getRetryButton().disabled).toBe(false);
  });

  it('should validate user inputs through controller', async () => {
    const controller = testBed.getTraitsGeneratorController();

    // Set up invalid inputs
    testBed.setUserInput('coreMotivation', '');
    testBed.setUserInput('internalContradiction', '   '); // Whitespace only
    testBed.setUserInput('centralQuestion', 'Valid question');

    const isValid = controller.validateUserInputs();

    expect(isValid).toBe(false);
    expect(testBed.getValidationError('coreMotivation')).toBeTruthy();
    expect(testBed.getValidationError('internalContradiction')).toBeTruthy();
    expect(testBed.getValidationError('centralQuestion')).toBeFalsy();
  });
});
```

#### 4. LLM Integration Tests

```javascript
describe('LLM Service Integration', () => {
  it('should handle successful LLM response', async () => {
    const traitsGenerator = testBed.getTraitsGeneratorService();

    const validResponse = testBed.createValidTraitsResponse();
    testBed.mockLLMResponse(validResponse);

    const result = await traitsGenerator.generateTraits(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      testBed.createValidUserInputs(),
      []
    );

    expect(result).toEqual(validResponse);
    testBed.verifyLLMCalledWithCorrectPrompt();
  });

  it('should handle malformed LLM responses', async () => {
    const traitsGenerator = testBed.getTraitsGeneratorService();

    // Mock malformed JSON response
    testBed.mockLLMResponse('{ "incomplete": true, "names": ['); // Invalid JSON

    await expect(
      traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )
    ).rejects.toThrow('Invalid LLM response');
  });

  it('should handle LLM service timeout', async () => {
    const traitsGenerator = testBed.getTraitsGeneratorService();

    // Mock service timeout
    testBed.mockLLMTimeout();

    await expect(
      traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )
    ).rejects.toThrow('Request timeout');
  });

  it('should handle LLM response validation failures', async () => {
    const traitsGenerator = testBed.getTraitsGeneratorService();

    // Mock response missing required fields
    const invalidResponse = {
      names: [{ name: 'Test', justification: 'Test' }],
      // Missing other required categories
    };
    testBed.mockLLMResponse(invalidResponse);

    await expect(
      traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )
    ).rejects.toThrow('Response validation failed');
  });
});
```

#### 5. Event System Integration Tests

```javascript
describe('Event System Integration', () => {
  it('should dispatch events throughout generation workflow', async () => {
    const eventBus = testBed.getEventBusMock();
    const characterBuilderService = testBed.getCharacterBuilderService();

    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    await characterBuilderService.generateTraitsForDirection(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      testBed.createValidUserInputs(),
      []
    );

    // Verify events dispatched in correct order
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'traits_generation_started' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'traits_generation_completed' })
    );
  });

  it('should dispatch error events on failures', async () => {
    const eventBus = testBed.getEventBusMock();
    const characterBuilderService = testBed.getCharacterBuilderService();

    testBed.mockLLMServiceFailure(new Error('Service failure'));

    await expect(
      characterBuilderService.generateTraitsForDirection(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )
    ).rejects.toThrow();

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'traits_generation_failed',
        payload: expect.objectContaining({
          error: 'Service failure',
        }),
      })
    );
  });

  it('should include proper metadata in events', async () => {
    const eventBus = testBed.getEventBusMock();
    const characterBuilderService = testBed.getCharacterBuilderService();

    const concept = testBed.createValidConcept();
    const direction = testBed.createValidDirection();

    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    await characterBuilderService.generateTraitsForDirection(
      concept,
      direction,
      testBed.createValidUserInputs(),
      []
    );

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'traits_generation_started',
        payload: expect.objectContaining({
          conceptId: concept.id,
          directionId: direction.id,
          timestamp: expect.any(String),
        }),
      })
    );
  });
});
```

#### 6. Display and Export Integration Tests

```javascript
describe('Display and Export Integration', () => {
  it('should integrate display enhancer with controller', async () => {
    const controller = testBed.getTraitsGeneratorController();
    const displayEnhancer = testBed.getTraitsDisplayEnhancer();

    testBed.setupValidUIState();
    testBed.mockLLMResponse(testBed.createValidTraitsResponse());

    await controller.generateTraits();

    // Verify display enhancer was called
    expect(displayEnhancer.enhanceForDisplay).toHaveBeenCalled();

    // Verify UI displays enhanced data
    testBed.verifyEnhancedResultsDisplayed();
  });

  it('should handle export functionality integration', async () => {
    const controller = testBed.getTraitsGeneratorController();
    const displayEnhancer = testBed.getTraitsDisplayEnhancer();

    // Set up generated traits
    testBed.setupGeneratedTraits();

    // Mock file download
    const downloadSpy = testBed.mockFileDownload();

    controller.exportToText();

    expect(displayEnhancer.formatForExport).toHaveBeenCalled();
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining('traits_'),
      expect.any(String)
    );
  });

  it('should handle export with all trait categories', async () => {
    const displayEnhancer = testBed.getTraitsDisplayEnhancer();

    const completeTraits = testBed.createCompleteTraitsData();
    const exportText = displayEnhancer.formatForExport(completeTraits);

    // Verify all categories included in export
    expect(exportText).toContain('NAMES');
    expect(exportText).toContain('PHYSICAL DESCRIPTION');
    expect(exportText).toContain('PERSONALITY');
    expect(exportText).toContain('STRENGTHS');
    expect(exportText).toContain('WEAKNESSES');
    expect(exportText).toContain('LIKES');
    expect(exportText).toContain('DISLIKES');
    expect(exportText).toContain('FEARS');
    expect(exportText).toContain('GOALS');
    expect(exportText).toContain('NOTES');
    expect(exportText).toContain('PROFILE');
    expect(exportText).toContain('SECRETS');
    expect(exportText).toContain('USER INPUTS');
  });
});
```

### Test Bed Implementation

#### Integration Test Bed Class

Create comprehensive test bed for integration testing:

```javascript
/**
 * Integration test bed for traits generator testing
 */
export class TraitsGeneratorIntegrationTestBed {
  constructor() {
    this.mocks = {};
    this.testData = {};
    this.services = {};
  }

  async setup() {
    // Initialize test environment
    await this.setupMocks();
    await this.setupTestData();
    await this.setupServices();
  }

  async setupMocks() {
    // Mock LLM services
    this.mocks.llmService = new MockLLMService();
    this.mocks.database = new MockDatabase();
    this.mocks.eventBus = new MockEventBus();
    this.mocks.fileSystem = new MockFileSystem();
  }

  async setupTestData() {
    // Create test concepts, directions, user inputs
    this.testData.validConcept = this.createValidConcept();
    this.testData.validDirection = this.createValidDirection();
    this.testData.validUserInputs = this.createValidUserInputs();
    this.testData.validCliches = this.createValidCliches();
  }

  // Helper methods for test data creation and verification
  createValidConcept() {
    /* Implementation */
  }
  createValidDirection() {
    /* Implementation */
  }
  createValidUserInputs() {
    /* Implementation */
  }
  createValidCliches() {
    /* Implementation */
  }
  createValidTraitsResponse() {
    /* Implementation */
  }

  // Verification methods
  verifyAllTraitCategoriesPresent(traits) {
    /* Implementation */
  }
  verifyTraitsStructure(traits) {
    /* Implementation */
  }
  verifyEnhancedResultsDisplayed() {
    /* Implementation */
  }

  async cleanup() {
    // Clean up test environment
    await this.cleanupServices();
    await this.cleanupMocks();
  }
}
```

## Performance Testing

### Load Testing

Include basic load testing for integration:

```javascript
describe('Performance Integration Tests', () => {
  it('should handle multiple concurrent generation requests', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        testBed.executeTraitsGeneration(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        )
      );
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result).toBeDefined();
      testBed.verifyAllTraitCategoriesPresent(result);
    });
  });

  it('should complete generation within reasonable time', async () => {
    const startTime = Date.now();

    await testBed.executeTraitsGeneration(
      testBed.createValidConcept(),
      testBed.createValidDirection(),
      testBed.createValidUserInputs(),
      []
    );

    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeLessThan(5000); // 5 second timeout
  });
});
```

## Acceptance Criteria

### Functional Integration Requirements

- [ ] Complete end-to-end workflow tests pass with valid inputs
- [ ] Service integration tests validate proper component communication
- [ ] Controller integration tests verify UI state management
- [ ] LLM integration tests handle success and failure scenarios
- [ ] Event system integration tests verify proper event flow

### Error Handling Integration Requirements

- [ ] All error scenarios tested with proper error propagation
- [ ] UI error states properly displayed for integration failures
- [ ] Service failures handled gracefully without breaking application state
- [ ] Error recovery mechanisms tested and functional

### Storage Policy Compliance Testing

- [ ] Integration tests verify no persistent storage occurs
- [ ] Tests confirm traits are not automatically associated with concepts
- [ ] Storage policy compliance validated through database mock verification

### Performance Integration Requirements

- [ ] Concurrent request handling tested and functional
- [ ] Generation workflow completes within reasonable time limits
- [ ] Memory usage remains stable during integration testing
- [ ] No memory leaks detected in integration test scenarios

### Testing Quality Requirements

- [ ] Integration tests achieve 80%+ coverage of integration scenarios
- [ ] Test bed provides comprehensive testing utilities
- [ ] All integration test scenarios documented and reproducible
- [ ] Tests run reliably in CI/CD environment

## Files Modified

- **NEW**: `tests/integration/traitsGenerator/traitsGeneratorIntegration.test.js`
- **NEW**: `tests/common/testBeds/traitsGeneratorIntegrationTestBed.js`
- **NEW**: Mock services and utilities for integration testing

## Dependencies For Next Tickets

This integration testing is required for:

- TRAITSGEN-010 (Unit Test Suite)
- TRAITSGEN-012 (End-to-End Testing)

## Notes

- Follow existing integration test patterns from other character-builder components
- Focus on testing component interactions and data flow
- Ensure storage policy compliance is thoroughly tested
- Pay special attention to error handling and recovery scenarios
- Consider performance implications of integration testing
