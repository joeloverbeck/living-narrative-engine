# CHACOMENH-007: Create Unit Tests for Data Extraction

**Phase**: Testing  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: CHACOMENH-004 (data extraction implementation)  
**Estimated Time**: 3-4 hours

## Summary

Create comprehensive unit tests for the actor data extraction logic to verify that the three new psychological components (motivations, internal tensions, core dilemmas) are correctly extracted from entity state and included in the prompt data structure.

## Background

The actorDataExtractor service is critical for preparing character data for LLM prompts. Comprehensive testing ensures the new components are extracted correctly, handle edge cases gracefully, and maintain backward compatibility with existing functionality.

## Technical Requirements

### Files to Create/Modify

1. **tests/unit/turns/services/actorDataExtractor.test.js**
   - Add test cases for new components
   - Verify optional behavior
   - Test edge cases

### Testing Framework

- Jest with jsdom environment
- Use existing test utilities from `/tests/common/`
- Follow established testing patterns

## Test Implementation

### 1. Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActorDataExtractor from '../../../../src/turns/services/actorDataExtractor.js';
import {
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  CORE_DILEMMAS_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('ActorDataExtractor - Psychological Components', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockDataManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockDataManager = testBed.createMock('dataManager', ['getEntitiesWithComponent']);
    
    extractor = new ActorDataExtractor({
      logger: mockLogger,
      dataManager: mockDataManager,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('extractPromptData - new psychological components', () => {
    // Test cases here
  });
});
```

### 2. Test Cases for Each Component

#### Test: Motivations Component Extraction

```javascript
it('should extract motivations when component exists', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' },
      'core:motivations': { 
        text: 'I seek power because I fear being powerless again.' 
      }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.motivations).toBe('I seek power because I fear being powerless again.');
  expect(result.id).toBe('test-actor');
  expect(result.name).toBe('Test Character');
});

it('should return undefined for motivations when component is missing', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' }
      // No motivations component
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.motivations).toBeUndefined();
  expect(result.name).toBe('Test Character');
});

it('should handle empty motivations text', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' },
      'core:motivations': { text: '' }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.motivations).toBeUndefined();
});
```

#### Test: Internal Tensions Component Extraction

```javascript
it('should extract internal tensions when component exists', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' },
      'core:internal_tensions': { 
        text: 'I want revenge but also want to forgive.' 
      }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.internalTensions).toBe('I want revenge but also want to forgive.');
});

it('should handle missing internal tensions gracefully', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.internalTensions).toBeUndefined();
  expect(() => extractor.extractPromptData(actorState)).not.toThrow();
});
```

#### Test: Core Dilemmas Component Extraction

```javascript
it('should extract core dilemmas when component exists', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Test Character' },
      'core:core_dilemmas': { 
        text: 'Can I achieve justice without becoming a monster?' 
      }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.coreDilemmas).toBe('Can I achieve justice without becoming a monster?');
});
```

### 3. Integration Test Cases

#### Test: All Three Components Present

```javascript
it('should extract all three psychological components when present', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Complex Character' },
      'core:motivations': { 
        text: 'I must prove myself worthy.' 
      },
      'core:internal_tensions': { 
        text: 'I crave approval yet resent needing it.' 
      },
      'core:core_dilemmas': { 
        text: 'Is my worth determined by others or myself?' 
      }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.motivations).toBe('I must prove myself worthy.');
  expect(result.internalTensions).toBe('I crave approval yet resent needing it.');
  expect(result.coreDilemmas).toBe('Is my worth determined by others or myself?');
});
```

#### Test: Mixed Presence

```javascript
it('should handle partial psychological components correctly', () => {
  // Arrange
  const actorState = {
    id: 'test-actor',
    components: {
      'core:actor': { name: 'Partial Character' },
      'core:motivations': { 
        text: 'I seek redemption.' 
      },
      // No internal_tensions
      'core:core_dilemmas': { 
        text: 'Can past sins be forgiven?' 
      }
    }
  };

  // Act
  const result = extractor.extractPromptData(actorState);

  // Assert
  expect(result.motivations).toBe('I seek redemption.');
  expect(result.internalTensions).toBeUndefined();
  expect(result.coreDilemmas).toBe('Can past sins be forgiven?');
});
```

### 4. Edge Cases and Error Handling

```javascript
describe('edge cases and error handling', () => {
  it('should handle malformed component data', () => {
    // Arrange
    const actorState = {
      id: 'test-actor',
      components: {
        'core:actor': { name: 'Test Character' },
        'core:motivations': { 
          // Missing 'text' property
          wrongProperty: 'Some value' 
        }
      }
    };

    // Act
    const result = extractor.extractPromptData(actorState);

    // Assert
    expect(result.motivations).toBeUndefined();
    expect(() => extractor.extractPromptData(actorState)).not.toThrow();
  });

  it('should handle null component values', () => {
    // Arrange
    const actorState = {
      id: 'test-actor',
      components: {
        'core:actor': { name: 'Test Character' },
        'core:motivations': null
      }
    };

    // Act
    const result = extractor.extractPromptData(actorState);

    // Assert
    expect(result.motivations).toBeUndefined();
  });

  it('should handle whitespace-only text', () => {
    // Arrange
    const actorState = {
      id: 'test-actor',
      components: {
        'core:actor': { name: 'Test Character' },
        'core:motivations': { text: '   \n\t   ' }
      }
    };

    // Act
    const result = extractor.extractPromptData(actorState);

    // Assert
    expect(result.motivations).toBeUndefined();
  });
});
```

### 5. Backward Compatibility Tests

```javascript
describe('backward compatibility', () => {
  it('should not affect existing component extraction', () => {
    // Arrange
    const actorState = {
      id: 'test-actor',
      components: {
        'core:actor': { name: 'Legacy Character' },
        'core:description': { text: 'A tall figure' },
        'core:personality': { text: 'Brave and bold' },
        'core:profile': { text: 'A veteran warrior' }
      }
    };

    // Act
    const result = extractor.extractPromptData(actorState);

    // Assert
    expect(result.description).toBe('A tall figure');
    expect(result.personality).toBe('Brave and bold');
    expect(result.profile).toBe('A veteran warrior');
    expect(result.motivations).toBeUndefined();
  });

  it('should maintain all existing fallback behaviors', () => {
    // Arrange
    const actorState = {
      id: 'test-actor',
      components: {
        'core:actor': { name: 'Test Character' }
        // No optional components
      }
    };

    // Act
    const result = extractor.extractPromptData(actorState);

    // Assert
    // Existing components should have fallbacks
    expect(result.description).toBe('No description available.');
    expect(result.personality).toBe('Personality unknown.');
    // New components should not have fallbacks
    expect(result.motivations).toBeUndefined();
    expect(result.internalTensions).toBeUndefined();
    expect(result.coreDilemmas).toBeUndefined();
  });
});
```

### 6. Performance Tests

```javascript
describe('performance', () => {
  it('should extract components efficiently', () => {
    // Arrange
    const actorState = createLargeActorState(); // Helper to create complex state
    
    // Act
    const startTime = performance.now();
    const result = extractor.extractPromptData(actorState);
    const endTime = performance.now();

    // Assert
    expect(endTime - startTime).toBeLessThan(10); // Should complete in under 10ms
    expect(result).toBeDefined();
  });
});
```

## Test Coverage Requirements

### Required Coverage
- Branch coverage: ≥ 80%
- Function coverage: ≥ 90%
- Line coverage: ≥ 90%

### Critical Paths to Cover
1. Component exists with valid text
2. Component missing entirely
3. Component exists with empty/null text
4. Mixed presence of components
5. Backward compatibility maintained

## Acceptance Criteria

- [ ] All test cases implemented and passing
- [ ] Each component has dedicated test cases
- [ ] Edge cases and error conditions tested
- [ ] Backward compatibility verified
- [ ] Performance benchmarks met
- [ ] Code coverage requirements satisfied
- [ ] Tests follow project patterns
- [ ] Mock objects used appropriately
- [ ] Test isolation maintained
- [ ] Clear test descriptions

## Running the Tests

```bash
# Run specific test file
npm run test:unit tests/unit/turns/services/actorDataExtractor.test.js

# Run with coverage
npm run test:unit -- --coverage tests/unit/turns/services/actorDataExtractor.test.js

# Run in watch mode for development
npm run test:unit -- --watch tests/unit/turns/services/actorDataExtractor.test.js

# Run all turn service tests
npm run test:unit tests/unit/turns/services/
```

## Debugging Failed Tests

### Common Issues
1. **Import paths incorrect**: Verify relative paths
2. **Mock setup incomplete**: Check all dependencies mocked
3. **Component IDs mismatch**: Ensure using constants
4. **Test isolation**: Each test should be independent

### Debug Helpers

```javascript
// Add console logs to debug
console.log('Extracted data:', JSON.stringify(result, null, 2));
console.log('Actor state:', JSON.stringify(actorState, null, 2));

// Use focused tests during development
it.only('should extract motivations', () => {
  // Test implementation
});
```

## Notes

- Use existing test utilities from `/tests/common/`
- Follow established patterns in existing test files
- Maintain test independence and isolation
- Clear, descriptive test names aid debugging
- Consider both positive and negative test cases

---

*Ticket created from character-components-analysis.md report*