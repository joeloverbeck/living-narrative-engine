# CLIGEN-014: Integration Test Suite

## Summary

Create comprehensive integration tests for the Clichés Generator system, validating database operations, workflow processes, and the one-to-one relationship between thematic directions and clichés.

## Parent Issue

- **Phase**: Phase 4 - Testing & Integration
- **Specification**: [Clichés Generator Implementation Specification](../specs/cliches-generator.spec.md)
- **Overview**: [CLIGEN-000](./CLIGEN-000-implementation-overview.md)

## Description

This ticket focuses on creating integration tests that validate the Clichés Generator's core workflows. The tests must verify database operations (storage and retrieval of clichés), the one-to-one relationship enforcement between thematic directions and clichés, the complete generation workflow from direction selection to cliché storage, and the integration between different service layers.

**Note**: This workflow complements existing integration tests in `tests/integration/clichesGenerator/` (accessibility.test.js, bootstrapIntegration.test.js, errorHandling.test.js) and utilizes the project's dedicated performance testing infrastructure.

## Acceptance Criteria

- [ ] Integration test file created at `tests/integration/clichesGenerator/clicheStorage.integration.test.js`
- [ ] Workflow test file created at `tests/integration/clichesGenerator/clichesGeneratorWorkflow.integration.test.js`
- [ ] Tests validate IndexedDB operations for cliché storage
- [ ] Tests enforce one-to-one relationship between directions and clichés
- [ ] Tests verify complete generation workflow
- [ ] Tests validate service layer integration
- [ ] Tests handle error scenarios and edge cases
- [ ] All tests pass in CI/CD pipeline
- [ ] Test coverage meets 80% threshold for integration scenarios

## Technical Requirements

### Storage Integration Test File

```javascript
// tests/integration/clichesGenerator/clicheStorage.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';
import { v4 as uuidv4 } from 'uuid';

describe('Clichés Storage - Database Integration', () => {
  let testBed;
  let characterDatabase;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();

    characterDatabase = testBed.getDatabase();
    characterBuilderService = testBed.mockCharacterBuilderService;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Database Schema Extension', () => {
    it('should have cliches store with proper indexes', async () => {
      // Note: Database schema testing should be done at the database layer
      // This test validates that the cliches store exists and can be accessed
      const testCliche = testBed.createMockClichesData();

      // Verify we can store and retrieve clichés (implicit schema validation)
      await characterBuilderService.storeCliches(testCliche);
      const retrieved = await characterBuilderService.getClichesByDirectionId(
        testCliche.directionId
      );

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(testCliche.id);
    });

    it('should enforce unique directionId index', async () => {
      const cliche1 = testBed.createCliche({
        directionId: 'direction-1',
        conceptId: 'concept-1',
      });

      const cliche2 = testBed.createCliche({
        directionId: 'direction-1', // Same direction ID
        conceptId: 'concept-2',
      });

      await characterBuilderService.storeCliches(cliche1);

      // Should throw error for duplicate directionId
      await expect(
        characterBuilderService.storeCliches(cliche2)
      ).rejects.toThrow(/unique.*directionId/i);
    });
  });
});
```

### Workflow Integration Test File

```javascript
// tests/integration/clichesGenerator/clichesGeneratorWorkflow.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Workflow Integration', () => {
  let testBed;
  let controller;
  let characterBuilderService;
  let clicheGenerator;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();

    controller = testBed.getController();
    characterBuilderService = testBed.mockCharacterBuilderService;
    clicheGenerator = testBed.mockClicheGenerator;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Complete Generation Workflow', () => {
    it('should execute full workflow from direction selection to storage', async () => {
      // Setup: Create test data
      const concept = testBed.createCharacterConcept({
        id: 'concept-1',
        text: 'A mysterious wanderer',
      });

      const direction = testBed.createThematicDirection({
        id: 'direction-1',
        conceptId: 'concept-1',
        title: 'The Lone Wolf',
        description: 'A solitary figure who trusts no one',
        coreTension: 'Independence vs Connection',
      });

      // Store test data
      await characterBuilderService.storeCharacterConcept(concept);
      await characterBuilderService.storeThematicDirection(direction);

      // Step 1: Check if clichés exist (should not)
      const existingCliches =
        await characterBuilderService.hasClichesForDirection('direction-1');
      expect(existingCliches).toBe(false);

      // Step 2: Generate clichés
      const generatedCliches =
        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

      // Verify generation result
      expect(generatedCliches).toBeDefined();
      expect(generatedCliches.directionId).toBe('direction-1');
      expect(generatedCliches.conceptId).toBe('concept-1');
      expect(generatedCliches.categories).toBeDefined();
      expect(generatedCliches.categories.names).toBeInstanceOf(Array);
      expect(generatedCliches.tropesAndStereotypes).toBeInstanceOf(Array);

      // Step 3: Verify storage
      const storedCliches =
        await characterBuilderService.getClichesByDirectionId('direction-1');
      expect(storedCliches).toBeDefined();
      expect(storedCliches.id).toBe(generatedCliches.id);

      // Step 4: Verify one-to-one relationship
      const hasCliches =
        await characterBuilderService.hasClichesForDirection('direction-1');
      expect(hasCliches).toBe(true);
    });

    it('should prevent duplicate generation for same direction', async () => {
      const direction = testBed.createThematicDirection({
        id: 'direction-2',
        conceptId: 'concept-2',
      });

      // First generation
      const firstCliches =
        await characterBuilderService.generateClichesForDirection(
          testBed.createCharacterConcept({ id: 'concept-2' }),
          direction
        );

      // Attempt second generation
      const secondAttempt =
        await characterBuilderService.generateClichesForDirection(
          testBed.createCharacterConcept({ id: 'concept-2' }),
          direction
        );

      // Should return existing clichés, not generate new ones
      expect(secondAttempt.id).toBe(firstCliches.id);
      expect(secondAttempt.createdAt).toBe(firstCliches.createdAt);
    });
  });
});
```

### Test Scenarios

#### 1. Service Layer Integration

```javascript
describe('Service Layer Integration', () => {
  it('should integrate CharacterBuilderService with ClicheGenerator', async () => {
    const mockLLMResponse = {
      categories: {
        names: ['Shadow', 'Raven', 'Wolf'],
        physicalDescriptions: ['Scarred face', 'Dark cloak', 'Piercing eyes'],
        personalityTraits: ['Brooding', 'Mysterious', 'Cynical'],
        skillsAbilities: ['Master swordsman', 'Stealth expert'],
        typicalLikes: ['Solitude', 'Night time'],
        typicalDislikes: ['Crowds', 'Authority'],
        commonFears: ['Betrayal', 'Vulnerability'],
        genericGoals: ['Revenge', 'Redemption'],
        backgroundElements: ['Tragic past', 'Lost family'],
        overusedSecrets: ['Royal bloodline', 'Hidden power'],
        speechPatterns: ['Speaks in riddles', 'One-word answers'],
      },
      tropesAndStereotypes: ['Byronic hero', 'Dark and troubled past'],
    };

    // Mock LLM service
    testBed.mockLLMService(mockLLMResponse);

    const concept = testBed.createCharacterConcept({
      text: 'A battle-hardened warrior',
    });

    const direction = testBed.createThematicDirection({
      title: 'The Vengeful Warrior',
    });

    const result = await clicheGenerator.generateCliches(
      concept.text,
      direction.description
    );

    // Verify parsing
    expect(result.categories.names).toEqual(mockLLMResponse.categories.names);
    expect(result.tropesAndStereotypes).toEqual(
      mockLLMResponse.tropesAndStereotypes
    );

    // Verify all categories are arrays
    Object.values(result.categories).forEach((category) => {
      expect(Array.isArray(category)).toBe(true);
    });
  });

  it('should handle LLM service errors gracefully', async () => {
    testBed.mockLLMServiceError('Service unavailable');

    const concept = testBed.createCharacterConcept({
      text: 'A noble knight',
    });

    const direction = testBed.createThematicDirection({
      title: 'The Righteous Defender',
    });

    await expect(
      clicheGenerator.generateCliches(concept.text, direction.description)
    ).rejects.toThrow('Failed to generate clichés');
  });
});
```

#### 2. Data Persistence Testing

```javascript
describe('Data Persistence', () => {
  it('should persist clichés across sessions', async () => {
    const cliche = testBed.createCliche({
      directionId: 'direction-3',
      conceptId: 'concept-3',
      categories: {
        names: ['Test Name 1', 'Test Name 2'],
        physicalDescriptions: ['Test Description'],
        // ... other categories
      },
    });

    // Store in first session
    await characterBuilderService.storeCliches(cliche);

    // Simulate new session
    await testBed.reinitialize();

    // Retrieve in new session
    const retrieved =
      await characterBuilderService.getClichesByDirectionId('direction-3');

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(cliche.id);
    expect(retrieved.categories.names).toEqual(cliche.categories.names);
  });

  it('should handle large cliché datasets', async () => {
    const largeCategories = {};
    const categoryNames = [
      'names',
      'physicalDescriptions',
      'personalityTraits',
      'skillsAbilities',
      'typicalLikes',
      'typicalDislikes',
      'commonFears',
      'genericGoals',
      'backgroundElements',
      'overusedSecrets',
      'speechPatterns',
    ];

    // Create large dataset
    categoryNames.forEach((category) => {
      largeCategories[category] = Array(100)
        .fill(null)
        .map((_, i) => `${category}-item-${i}`);
    });

    const largeCliche = testBed.createCliche({
      directionId: 'direction-large',
      categories: largeCategories,
      tropesAndStereotypes: Array(50)
        .fill(null)
        .map((_, i) => `trope-${i}`),
    });

    // Should handle storage without issues
    await characterBuilderService.storeCliches(largeCliche);

    const retrieved =
      await characterBuilderService.getClichesByDirectionId('direction-large');
    expect(retrieved.categories.names.length).toBe(100);
    expect(retrieved.tropesAndStereotypes.length).toBe(50);
  });
});
```

#### 3. Relationship Enforcement

```javascript
describe('One-to-One Relationship Enforcement', () => {
  it('should maintain one-to-one relationship between directions and clichés', async () => {
    const direction1 = testBed.createThematicDirection({ id: 'dir-1' });
    const direction2 = testBed.createThematicDirection({ id: 'dir-2' });

    const cliche1 = testBed.createCliche({ directionId: 'dir-1' });
    const cliche2 = testBed.createCliche({ directionId: 'dir-2' });

    await characterBuilderService.storeCliches(cliche1);
    await characterBuilderService.storeCliches(cliche2);

    // Each direction should have exactly one cliché set
    const result1 =
      await characterBuilderService.getClichesByDirectionId('dir-1');
    const result2 =
      await characterBuilderService.getClichesByDirectionId('dir-2');

    expect(result1.id).toBe(cliche1.id);
    expect(result2.id).toBe(cliche2.id);
    expect(result1.id).not.toBe(result2.id);
  });

  it('should update existing clichés for a direction', async () => {
    const originalCliche = testBed.createCliche({
      directionId: 'dir-update',
      categories: { names: ['Original'] },
    });

    await characterBuilderService.storeCliches(originalCliche);

    const updatedCliche = {
      ...originalCliche,
      categories: { names: ['Updated'] },
    };

    // Should replace existing clichés for the direction
    await characterBuilderService.storeCliches(updatedCliche);

    const retrieved =
      await characterBuilderService.getClichesByDirectionId('dir-update');
    expect(retrieved.categories.names).toEqual(['Updated']);
  });
});
```

#### 4. Error Handling

```javascript
describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    testBed.simulateDatabaseError();

    await expect(
      characterBuilderService.getClichesByDirectionId('any-id')
    ).rejects.toThrow(/database/i);
  });

  it('should handle malformed LLM responses', async () => {
    const malformedResponse = {
      // Missing required structure
      someField: 'invalid',
    };

    testBed.mockLLMService(malformedResponse);

    await expect(
      clicheGenerator.parseLLMResponse(malformedResponse)
    ).rejects.toThrow(/Invalid.*response/i);
  });

  it('should validate cliché data structure', async () => {
    const invalidCliche = {
      // Missing required fields
      categories: null,
    };

    await expect(
      characterBuilderService.storeCliches(invalidCliche)
    ).rejects.toThrow(/validation/i);
  });
});
```

### Test Bed Requirements

**Note**: This workflow uses the existing `ClichesGeneratorControllerTestBed` from `tests/common/clichesGeneratorControllerTestBed.js`.

The existing test bed already provides:

- Mock services for `CharacterBuilderService` and `ClicheGenerator`
- DOM structure for UI testing
- Helper methods for creating mock data
- Event tracking capabilities
- Comprehensive testing utilities

Key methods available from `ClichesGeneratorControllerTestBed`:

- `createMockClichesData()` - Creates mock cliché data
- `createMockConcept()` - Creates mock character concepts
- `createMockDirection()` - Creates mock thematic directions
- `mockCharacterBuilderService` - Mock service with all required methods
- `mockClicheGenerator` - Mock generator service
- Event tracking and validation methods

### Performance Testing Integration

**Performance Test File**: `tests/performance/clichesGenerator/generationPerformance.test.js`

```javascript
// Run with: npm run test:performance
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Performance Tests', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should generate clichés within performance budget', async () => {
    const startTime = performance.now();

    const cliches =
      await testBed.mockCharacterBuilderService.generateClichesForDirection(
        testBed.createMockConcept(),
        testBed.createMockDirection()
      );

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(2000); // 2 second budget
    expect(cliches).toBeDefined();
  });
});
```

**Memory Test File**: `tests/memory/clichesGenerator/memoryEfficiency.test.js`

```javascript
// Run with: npm run test:memory
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Memory Tests', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should not leak memory during batch generation', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Generate multiple batches
    for (let i = 0; i < 10; i++) {
      await testBed.mockCharacterBuilderService.generateClichesForDirection(
        testBed.createMockConcept(),
        testBed.createMockDirection()
      );
    }

    // Force garbage collection if available
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

## Implementation Steps

1. **Setup Integration Test Infrastructure** (45 minutes)
   - Utilize existing `ClichesGeneratorControllerTestBed`
   - Configure mock services for integration scenarios
   - Setup database test utilities

2. **Implement Storage Integration Tests** (90 minutes)
   - Database schema validation tests
   - One-to-one relationship tests
   - Data persistence tests
   - Error handling tests

3. **Implement Workflow Integration Tests** (90 minutes)
   - Complete generation workflow tests
   - Service layer integration tests
   - Multi-step process validation
   - Edge case handling

4. **Implement Error Scenario Tests** (60 minutes)
   - Database error handling
   - LLM service failure handling
   - Validation error tests
   - Recovery mechanism tests

5. **Create Performance and Memory Tests** (45 minutes)
   - Create performance tests in `tests/performance/clichesGenerator/`
   - Create memory efficiency tests in `tests/memory/clichesGenerator/`
   - Use dedicated test runners: `npm run test:performance` and `npm run test:memory`

## Dependencies

### Depends On

- CLIGEN-001: Database Schema Extension (for cliches store)
- CLIGEN-002: Service Layer Extension (for new methods)
- CLIGEN-003: ClicheGenerator Service (for generation logic)
- CLIGEN-008: Service Integration (for complete workflow)

### Blocks

- CLIGEN-016: End-to-End Testing (requires integration tests)
- Final system validation
- Production deployment

## Estimated Effort

- **Estimated Hours**: 5 hours
- **Complexity**: Medium
- **Risk**: Medium (due to IndexedDB testing complexity)

## Success Metrics

- [ ] All integration tests pass consistently
- [ ] Database operations validated
- [ ] One-to-one relationship enforced
- [ ] Complete workflow coverage achieved
- [ ] Error scenarios handled gracefully
- [ ] Test execution time < 10 seconds
- [ ] No flaky tests
- [ ] Clear test documentation

## Notes

- Use fake-indexeddb for testing IndexedDB operations
- Mock LLM service responses for predictable testing
- Ensure proper async/await handling throughout
- Test both success and failure paths
- Consider testing concurrent operations
- Validate data integrity after each operation
- Use descriptive test names for clarity
- **Performance Tests**: Use dedicated `npm run test:performance` for performance testing in `tests/performance/`
- **Memory Tests**: Use dedicated `npm run test:memory` for memory efficiency testing in `tests/memory/`
- **Integration with Existing Tests**: Coordinate with existing integration tests in `tests/integration/clichesGenerator/`

## Related Files

**New Files**:

- Test: `tests/integration/clichesGenerator/clicheStorage.integration.test.js`
- Test: `tests/integration/clichesGenerator/clichesGeneratorWorkflow.integration.test.js`
- Performance Test: `tests/performance/clichesGenerator/generationPerformance.test.js`
- Memory Test: `tests/memory/clichesGenerator/memoryEfficiency.test.js`

**Existing Files**:

- Test Bed: `tests/common/clichesGeneratorControllerTestBed.js` (reused)
- Integration Tests: `tests/integration/clichesGenerator/accessibility.test.js`
- Integration Tests: `tests/integration/clichesGenerator/bootstrapIntegration.test.js`
- Integration Tests: `tests/integration/clichesGenerator/errorHandling.test.js`

**Source Files**:

- Service: `src/characterBuilder/services/characterBuilderService.js`
- Service: `src/clichesGenerator/services/ClicheGenerator.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 4 - Testing)
**Labels**: testing, integration-test, cliches-generator, phase-4, database
