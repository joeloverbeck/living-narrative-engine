# CHACOMENH-009: Create Integration Tests

**Phase**: Testing  
**Priority**: High  
**Complexity**: High  
**Dependencies**: CHACOMENH-001 through CHACOMENH-006  
**Estimated Time**: 4-5 hours

## Summary

Create comprehensive integration tests to verify the end-to-end flow of the psychological components from entity creation through prompt generation. Tests should verify component loading, data extraction, formatting, and final prompt assembly.

## Background

Integration tests validate that all components work together correctly. This includes verifying that the new psychological components are properly loaded from JSON files, extracted from entities, formatted correctly, and included in the final LLM prompts.

## Technical Requirements

### Files to Create

1. **tests/integration/characterComponents/psychologicalComponents.integration.test.js**
   - End-to-end component flow testing
   - Component loading verification
   - Prompt generation validation

2. **tests/integration/prompting/enhancedCharacterPrompts.integration.test.js**
   - Full prompt generation with new components
   - LLM prompt structure validation

### Testing Scope

- Component file loading and registration
- Entity creation with new components
- Data extraction pipeline
- Formatting and prompt assembly
- Backward compatibility

## Test Implementation

### 1. Component Loading Integration Tests

```javascript
// tests/integration/characterComponents/psychologicalComponents.integration.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';
import ComponentLoader from '../../../src/loaders/componentLoader.js';
import DataRegistry from '../../../src/registries/dataRegistry.js';
import EntityManager from '../../../src/entities/entityManager.js';
import {
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  CORE_DILEMMAS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Psychological Components Integration', () => {
  let testBed;
  let componentLoader;
  let dataRegistry;
  let entityManager;

  beforeAll(async () => {
    testBed = await createIntegrationTestBed();

    // Initialize real services
    dataRegistry = new DataRegistry({ logger: testBed.logger });
    componentLoader = new ComponentLoader({
      logger: testBed.logger,
      dataRegistry: dataRegistry,
    });
    entityManager = new EntityManager({
      logger: testBed.logger,
      dataRegistry: dataRegistry,
      eventBus: testBed.eventBus,
    });

    // Load actual component files
    await componentLoader.loadComponents('data/mods/core/components/');
  });

  afterAll(() => {
    testBed.cleanup();
  });

  describe('Component Loading and Registration', () => {
    it('should load motivations component from JSON file', () => {
      // Assert
      const component = dataRegistry.getComponent(MOTIVATIONS_COMPONENT_ID);
      expect(component).toBeDefined();
      expect(component.id).toBe('core:motivations');
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.properties.text).toBeDefined();
    });

    it('should load internal tensions component from JSON file', () => {
      // Assert
      const component = dataRegistry.getComponent(
        INTERNAL_TENSIONS_COMPONENT_ID
      );
      expect(component).toBeDefined();
      expect(component.id).toBe('core:internal_tensions');
      expect(component.dataSchema.properties.text).toBeDefined();
    });

    it('should load core dilemmas component from JSON file', () => {
      // Assert
      const component = dataRegistry.getComponent(CORE_DILEMMAS_COMPONENT_ID);
      expect(component).toBeDefined();
      expect(component.id).toBe('core:core_dilemmas');
      expect(component.dataSchema.properties.text).toBeDefined();
    });

    it('should validate component schemas are properly structured', () => {
      // Arrange
      const components = [
        MOTIVATIONS_COMPONENT_ID,
        INTERNAL_TENSIONS_COMPONENT_ID,
        CORE_DILEMMAS_COMPONENT_ID,
      ];

      // Assert
      components.forEach((componentId) => {
        const component = dataRegistry.getComponent(componentId);
        expect(component.dataSchema.type).toBe('object');
        expect(component.dataSchema.required).toContain('text');
        expect(component.dataSchema.additionalProperties).toBe(false);
      });
    });
  });

  describe('Entity Creation with Psychological Components', () => {
    it('should create entity with all psychological components', () => {
      // Arrange
      const entityData = {
        id: 'test-character',
        components: {
          'core:actor': { name: 'Integration Test Character' },
          'core:motivations': {
            text: 'I seek knowledge to understand my past.',
          },
          'core:internal_tensions': {
            text: 'I want answers but fear what I might discover.',
          },
          'core:core_dilemmas': {
            text: 'Is ignorance truly bliss?',
          },
        },
      };

      // Act
      const entity = entityManager.createEntity(entityData);

      // Assert
      expect(entity).toBeDefined();
      expect(entity.components[MOTIVATIONS_COMPONENT_ID]).toBeDefined();
      expect(entity.components[MOTIVATIONS_COMPONENT_ID].text).toBe(
        'I seek knowledge to understand my past.'
      );
      expect(entity.components[INTERNAL_TENSIONS_COMPONENT_ID].text).toBe(
        'I want answers but fear what I might discover.'
      );
      expect(entity.components[CORE_DILEMMAS_COMPONENT_ID].text).toBe(
        'Is ignorance truly bliss?'
      );
    });

    it('should validate component data against schemas', () => {
      // Arrange
      const invalidData = {
        id: 'invalid-character',
        components: {
          'core:actor': { name: 'Invalid Test' },
          'core:motivations': {
            // Missing required 'text' field
            wrongField: 'This should fail validation',
          },
        },
      };

      // Act & Assert
      expect(() => {
        entityManager.createEntity(invalidData);
      }).toThrow();
    });

    it('should handle entities without psychological components', () => {
      // Arrange
      const minimalEntity = {
        id: 'minimal-character',
        components: {
          'core:actor': { name: 'Minimal Character' },
          'core:description': { text: 'A simple character' },
        },
      };

      // Act
      const entity = entityManager.createEntity(minimalEntity);

      // Assert
      expect(entity).toBeDefined();
      expect(entity.components[MOTIVATIONS_COMPONENT_ID]).toBeUndefined();
      expect(entity.components[INTERNAL_TENSIONS_COMPONENT_ID]).toBeUndefined();
      expect(entity.components[CORE_DILEMMAS_COMPONENT_ID]).toBeUndefined();
    });
  });
});
```

### 2. Prompt Generation Integration Tests

```javascript
// tests/integration/prompting/enhancedCharacterPrompts.integration.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';
import ActorDataExtractor from '../../../src/turns/services/actorDataExtractor.js';
import CharacterDataFormatter from '../../../src/prompting/CharacterDataFormatter.js';
import AIPromptContentProvider from '../../../src/prompting/AIPromptContentProvider.js';

describe('Enhanced Character Prompts Integration', () => {
  let testBed;
  let extractor;
  let formatter;
  let promptProvider;

  beforeAll(async () => {
    testBed = await createIntegrationTestBed();

    // Initialize services with real dependencies
    extractor = new ActorDataExtractor({
      logger: testBed.logger,
      dataManager: testBed.dataManager,
    });

    formatter = new CharacterDataFormatter({
      logger: testBed.logger,
    });

    promptProvider = new AIPromptContentProvider({
      logger: testBed.logger,
      formatter: formatter,
      extractor: extractor,
    });
  });

  afterAll(() => {
    testBed.cleanup();
  });

  describe('End-to-End Prompt Generation', () => {
    it('should generate complete prompt with all psychological components', () => {
      // Arrange
      const actorState = {
        id: 'complete-character',
        components: {
          'core:actor': { name: 'Complete Character' },
          'core:description': { text: 'A complex individual' },
          'core:personality': { text: 'Thoughtful and introspective' },
          'core:profile': { text: 'Years of experience have shaped me' },
          'core:motivations': {
            text: 'I seek to understand the nature of existence itself.',
          },
          'core:internal_tensions': {
            text: 'I crave certainty but know that doubt drives discovery.',
          },
          'core:core_dilemmas': {
            text: 'Can truth exist without consciousness to perceive it?',
          },
          'core:likes': { text: 'Philosophy and quiet contemplation' },
          'core:dislikes': { text: 'Shallow conversations' },
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(actorState);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('YOU ARE Complete Character');
      expect(formattedPersona).toContain(
        '## Your Description\nA complex individual'
      );
      expect(formattedPersona).toContain(
        '## Your Core Motivations\nI seek to understand'
      );
      expect(formattedPersona).toContain(
        '## Your Internal Tensions\nI crave certainty'
      );
      expect(formattedPersona).toContain(
        '## Your Core Dilemmas\nCan truth exist'
      );

      // Verify section order
      const descIndex = formattedPersona.indexOf('## Your Description');
      const profileIndex = formattedPersona.indexOf('## Your Profile');
      const motivIndex = formattedPersona.indexOf('## Your Core Motivations');
      const tensionsIndex = formattedPersona.indexOf(
        '## Your Internal Tensions'
      );
      const dilemmasIndex = formattedPersona.indexOf('## Your Core Dilemmas');
      const likesIndex = formattedPersona.indexOf('## Your Likes');

      expect(profileIndex).toBeGreaterThan(descIndex);
      expect(motivIndex).toBeGreaterThan(profileIndex);
      expect(tensionsIndex).toBeGreaterThan(motivIndex);
      expect(dilemmasIndex).toBeGreaterThan(tensionsIndex);
      expect(likesIndex).toBeGreaterThan(dilemmasIndex);
    });

    it('should handle partial psychological components in prompt', () => {
      // Arrange
      const partialActor = {
        id: 'partial-character',
        components: {
          'core:actor': { name: 'Partial Character' },
          'core:description': { text: 'A simpler character' },
          'core:motivations': {
            text: 'I just want to survive another day.',
          },
          // No internal tensions
          'core:core_dilemmas': {
            text: 'Is survival enough?',
          },
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(partialActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).toContain('## Your Core Dilemmas');
    });

    it('should maintain backward compatibility for legacy characters', () => {
      // Arrange
      const legacyActor = {
        id: 'legacy-character',
        components: {
          'core:actor': { name: 'Legacy Character' },
          'core:description': { text: 'An old-style character' },
          'core:personality': { text: 'Traditional traits' },
          'core:profile': { text: 'Standard background' },
          'core:likes': { text: 'Simple pleasures' },
          'core:dislikes': { text: 'Complications' },
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(legacyActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('YOU ARE Legacy Character');
      expect(formattedPersona).toContain('## Your Description');
      expect(formattedPersona).toContain('## Your Personality');
      expect(formattedPersona).not.toContain('## Your Core Motivations');
      expect(formattedPersona).not.toContain('## Your Internal Tensions');
      expect(formattedPersona).not.toContain('## Your Core Dilemmas');

      // Should still be valid prompt
      expect(formattedPersona.length).toBeGreaterThan(100);
      expect(formattedPersona.split('##').length).toBeGreaterThan(3);
    });
  });

  describe('Data Flow Validation', () => {
    it('should preserve text formatting through entire pipeline', () => {
      // Arrange
      const formattedActor = {
        id: 'formatted-character',
        components: {
          'core:actor': { name: 'Formatted Character' },
          'core:motivations': {
            text: '**Bold** motivations with _italic_ emphasis and\n- bullet points\n- for clarity',
          },
          'core:internal_tensions': {
            text: 'Tensions with "quotes" and special chars: & < >',
          },
          'core:core_dilemmas': {
            text: 'Questions? More questions? Even more questions???',
          },
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(formattedActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain('**Bold**');
      expect(formattedPersona).toContain('_italic_');
      expect(formattedPersona).toContain('- bullet points');
      expect(formattedPersona).toContain('"quotes"');
      expect(formattedPersona).toContain('&');
      expect(formattedPersona).toContain('???');
    });

    it('should handle very long component text', () => {
      // Arrange
      const longText = 'This is a very long motivation. '.repeat(100);
      const longActor = {
        id: 'long-character',
        components: {
          'core:actor': { name: 'Long Character' },
          'core:motivations': { text: longText },
        },
      };

      // Act
      const extractedData = extractor.extractPromptData(longActor);
      const formattedPersona = formatter.formatCharacterPersona(extractedData);

      // Assert
      expect(formattedPersona).toContain(longText.trim());
      expect(formattedPersona.length).toBeGreaterThan(3000);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed component data gracefully', () => {
      // Arrange
      const malformedActor = {
        id: 'malformed-character',
        components: {
          'core:actor': { name: 'Malformed Character' },
          'core:motivations': null,
          'core:internal_tensions': {},
          'core:core_dilemmas': { text: null },
        },
      };

      // Act & Assert
      expect(() => {
        const extractedData = extractor.extractPromptData(malformedActor);
        const formattedPersona =
          formatter.formatCharacterPersona(extractedData);
        expect(formattedPersona).toBeDefined();
        expect(formattedPersona).not.toContain('## Your Core Motivations');
      }).not.toThrow();
    });
  });
});
```

### 3. System-Level Integration Tests

```javascript
describe('System-Level Integration', () => {
  it('should handle complete character lifecycle', async () => {
    // This test would require more setup but validates:
    // 1. Loading components from files
    // 2. Creating entities with components
    // 3. Extracting data for prompts
    // 4. Formatting complete prompts
    // 5. Sending to LLM proxy (mocked)

    // Arrange
    const gameEngine = await createGameEngine(testBed);
    await gameEngine.initialize();

    // Create character with psychological components
    const character = await gameEngine.createCharacter({
      name: 'System Test Character',
      motivations: 'System-level motivations',
      internalTensions: 'System-level tensions',
      coreDilemmas: 'System-level questions?',
    });

    // Act
    const prompt = await gameEngine.generateCharacterPrompt(character.id);

    // Assert
    expect(prompt).toContain('System Test Character');
    expect(prompt).toContain('System-level motivations');
    expect(prompt).toContain('System-level tensions');
    expect(prompt).toContain('System-level questions?');
  });
});
```

## Test Data Fixtures

Create reusable test data:

```javascript
// tests/fixtures/psychologicalCharacters.js
export const completeCharacter = {
  id: 'fixture-complete',
  components: {
    'core:actor': { name: 'Complete Fixture' },
    'core:motivations': { text: 'Standard motivation text' },
    'core:internal_tensions': { text: 'Standard tension text' },
    'core:core_dilemmas': { text: 'Standard dilemma text?' },
  },
};

export const minimalCharacter = {
  id: 'fixture-minimal',
  components: {
    'core:actor': { name: 'Minimal Fixture' },
  },
};

export const partialCharacter = {
  id: 'fixture-partial',
  components: {
    'core:actor': { name: 'Partial Fixture' },
    'core:motivations': { text: 'Only motivations' },
  },
};
```

## Acceptance Criteria

- [ ] Component loading tests verify JSON files load correctly
- [ ] Entity creation tests validate schema compliance
- [ ] Data extraction tests confirm proper data flow
- [ ] Formatting tests verify markdown structure
- [ ] End-to-end tests validate complete pipeline
- [ ] Backward compatibility tests pass
- [ ] Error handling tests cover edge cases
- [ ] Performance benchmarks met
- [ ] All tests independent and repeatable
- [ ] Test fixtures reusable

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test suite
npm run test:integration tests/integration/characterComponents/

# Run with coverage
npm run test:integration -- --coverage

# Run in CI mode
npm run test:ci
```

## Performance Benchmarks

- Component loading: < 100ms for all three
- Entity creation: < 10ms per entity
- Prompt generation: < 50ms for complete character
- End-to-end flow: < 200ms total

## Troubleshooting

### Common Issues

1. **File not found**: Ensure component JSON files exist
2. **Schema validation fails**: Check JSON structure
3. **Timeout errors**: Increase Jest timeout for integration tests
4. **Service initialization**: Verify dependency injection

### Debug Helpers

```javascript
// Add verbose logging
testBed.logger.setLevel('debug');

// Inspect intermediate data
console.log('Extracted:', JSON.stringify(extractedData, null, 2));
console.log('Formatted:', formattedPersona);
```

## Notes

- Integration tests use real files and services
- Slower than unit tests but more comprehensive
- Critical for validating system behavior
- Should catch issues unit tests miss
- Run after unit tests pass

---

_Ticket created from character-components-analysis.md report_
