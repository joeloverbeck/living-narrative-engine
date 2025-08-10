# CLIGEN-013: Unit Test Implementation

## Summary

Implement comprehensive unit tests for all Clichés Generator components including models, services, controllers, and utilities. Achieve minimum 90% code coverage while ensuring all critical paths and edge cases are tested.

## Status

- **Type**: Testing
- **Priority**: High
- **Complexity**: Medium
- **Estimated Time**: 6 hours
- **Dependencies**: CLIGEN-001 through CLIGEN-012 (All implementation tickets)

## Objectives

### Primary Goals

1. **Model Testing** - Test Cliche model validation and methods
2. **Service Testing** - Test ClicheGenerator and service extensions
3. **Controller Testing** - Test controller logic and UI updates
4. **State Testing** - Test state management and data flow
5. **Utility Testing** - Test prompts and helpers
6. **Coverage Target** - Achieve 90%+ code coverage

### Success Criteria

- [ ] All unit tests passing
- [ ] 90% code coverage achieved
- [ ] Critical paths tested
- [ ] Edge cases covered
- [ ] Error scenarios validated
- [ ] Mocks properly implemented
- [ ] Tests run in < 30 seconds

## Technical Specification

### 1. Model Tests

#### File: `tests/unit/characterBuilder/models/cliche.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('Cliche Model', () => {
  let validData;

  beforeEach(() => {
    jest.clearAllMocks();

    validData = {
      directionId: 'dir-123',
      conceptId: 'concept-456',
      categories: {
        names: ['John Doe', 'Jane Smith', 'Jack Johnson'],
        physicalDescriptions: [
          'Tall, dark, and handsome',
          'Mysterious scar',
          'Piercing eyes',
        ],
        personalityTraits: ['Brooding', 'Lone wolf', 'Haunted past'],
        skillsAbilities: [
          'Master swordsman',
          'Unbeatable fighter',
          'Natural leader',
        ],
        typicalLikes: ['Justice', 'Honor', 'Freedom'],
        typicalDislikes: ['Injustice', 'Tyranny', 'Bullies'],
        commonFears: ['Losing loved ones', 'Failure', 'Being powerless'],
        genericGoals: ['Save the world', 'Avenge family', 'Find redemption'],
        backgroundElements: [
          'Orphaned as child',
          'Trained by master',
          'Lost everything',
        ],
        overusedSecrets: [
          'Secret royal blood',
          'Hidden power',
          'True identity',
        ],
        speechPatterns: ['...', 'This ends now', 'I work alone'],
      },
      tropesAndStereotypes: [
        'The Chosen One',
        'Reluctant Hero',
        'Dark and Troubled Past',
        'Last of Their Kind',
        'Destiny Says',
      ],
    };
  });

  describe('Constructor', () => {
    it('should create a valid Cliche instance with all required fields', () => {
      const cliche = new Cliche(validData);

      expect(cliche).toBeInstanceOf(Cliche);
      expect(cliche.id).toBe('mock-uuid-123');
      expect(cliche.directionId).toBe('dir-123');
      expect(cliche.conceptId).toBe('concept-456');
      expect(cliche.categories).toEqual(validData.categories);
      expect(cliche.tropesAndStereotypes).toEqual(
        validData.tropesAndStereotypes
      );
      expect(cliche.createdAt).toBeDefined();
      expect(cliche.llmMetadata).toEqual({});
    });

    it('should use provided id if given', () => {
      validData.id = 'custom-id-789';
      const cliche = new Cliche(validData);

      expect(cliche.id).toBe('custom-id-789');
      expect(uuidv4).not.toHaveBeenCalled();
    });

    it('should use provided createdAt if given', () => {
      const customDate = '2024-01-01T00:00:00.000Z';
      validData.createdAt = customDate;

      const cliche = new Cliche(validData);
      expect(cliche.createdAt).toBe(customDate);
    });

    it('should include llmMetadata if provided', () => {
      validData.llmMetadata = {
        model: 'gpt-4',
        temperature: 0.7,
        tokens: 1500,
      };

      const cliche = new Cliche(validData);
      expect(cliche.llmMetadata).toEqual(validData.llmMetadata);
    });

    it('should freeze the instance to prevent mutations', () => {
      const cliche = new Cliche(validData);

      expect(() => {
        cliche.directionId = 'new-id';
      }).toThrow(TypeError);

      expect(() => {
        cliche.categories.names.push('New Name');
      }).toThrow(TypeError);

      expect(() => {
        cliche.tropesAndStereotypes.push('New Trope');
      }).toThrow(TypeError);
    });
  });

  describe('Validation', () => {
    it('should throw error when data is missing', () => {
      expect(() => new Cliche()).toThrow('Cliche data is required');
      expect(() => new Cliche(null)).toThrow('Cliche data is required');
    });

    it('should throw error when directionId is missing', () => {
      delete validData.directionId;
      expect(() => new Cliche(validData)).toThrow('Direction ID is required');
    });

    it('should throw error when directionId is empty', () => {
      validData.directionId = '';
      expect(() => new Cliche(validData)).toThrow('Direction ID is required');

      validData.directionId = '   ';
      expect(() => new Cliche(validData)).toThrow('Direction ID is required');
    });

    it('should throw error when conceptId is missing', () => {
      delete validData.conceptId;
      expect(() => new Cliche(validData)).toThrow('Concept ID is required');
    });

    it('should throw error when categories is missing', () => {
      delete validData.categories;
      expect(() => new Cliche(validData)).toThrow('Categories are required');
    });
  });

  describe('Category Validation', () => {
    it('should handle missing category arrays gracefully', () => {
      validData.categories = {
        names: ['John'],
        // Missing other categories
      };

      const cliche = new Cliche(validData);

      expect(cliche.categories.physicalDescriptions).toEqual([]);
      expect(cliche.categories.personalityTraits).toEqual([]);
      expect(cliche.categories.skillsAbilities).toEqual([]);
    });

    it('should filter out empty strings from categories', () => {
      validData.categories.names = ['John', '', '   ', 'Jane'];

      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John', 'Jane']);
    });

    it('should trim whitespace from category items', () => {
      validData.categories.names = ['  John  ', 'Jane   ', '   Jack'];

      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John', 'Jane', 'Jack']);
    });

    it('should filter out non-string items from categories', () => {
      validData.categories.names = ['John', 123, null, undefined, 'Jane'];

      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual(['John', 'Jane']);
    });

    it('should handle non-array category values', () => {
      validData.categories.names = 'not an array';
      validData.categories.physicalDescriptions = null;
      validData.categories.personalityTraits = undefined;

      const cliche = new Cliche(validData);

      expect(cliche.categories.names).toEqual([]);
      expect(cliche.categories.physicalDescriptions).toEqual([]);
      expect(cliche.categories.personalityTraits).toEqual([]);
    });
  });

  describe('Static Methods', () => {
    describe('fromRawData', () => {
      it('should create instance from raw data', () => {
        const cliche = Cliche.fromRawData(validData);

        expect(cliche).toBeInstanceOf(Cliche);
        expect(cliche.directionId).toBe('dir-123');
      });

      it('should handle database data format', () => {
        const dbData = {
          ...validData,
          _id: 'mongodb-id',
          __v: 0,
        };

        const cliche = Cliche.fromRawData(dbData);
        expect(cliche).toBeInstanceOf(Cliche);
      });
    });
  });

  describe('Instance Methods', () => {
    let cliche;

    beforeEach(() => {
      cliche = new Cliche(validData);
    });

    describe('toJSON', () => {
      it('should convert to plain object for storage', () => {
        const json = cliche.toJSON();

        expect(json).toEqual({
          id: 'mock-uuid-123',
          directionId: 'dir-123',
          conceptId: 'concept-456',
          categories: validData.categories,
          tropesAndStereotypes: validData.tropesAndStereotypes,
          createdAt: expect.any(String),
          llmMetadata: {},
        });

        // Verify it's a plain object, not frozen
        expect(Object.isFrozen(json)).toBe(false);
        json.test = 'mutable';
        expect(json.test).toBe('mutable');
      });
    });

    describe('getTotalCount', () => {
      it('should calculate total count correctly', () => {
        const count = cliche.getTotalCount();

        // 3 items per 11 categories + 5 tropes = 38
        expect(count).toBe(38);
      });

      it('should handle empty categories', () => {
        const emptyData = {
          ...validData,
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
        };

        const emptyCliche = new Cliche(emptyData);
        expect(emptyCliche.getTotalCount()).toBe(0);
      });
    });

    describe('getCategoryStats', () => {
      it('should return statistics for each category', () => {
        const stats = cliche.getCategoryStats();

        expect(stats).toEqual({
          names: 3,
          physicalDescriptions: 3,
          personalityTraits: 3,
          skillsAbilities: 3,
          typicalLikes: 3,
          typicalDislikes: 3,
          commonFears: 3,
          genericGoals: 3,
          backgroundElements: 3,
          overusedSecrets: 3,
          speechPatterns: 3,
          tropesAndStereotypes: 5,
          total: 38,
        });
      });
    });

    describe('isEmpty', () => {
      it('should return false when clichés exist', () => {
        expect(cliche.isEmpty()).toBe(false);
      });

      it('should return true when no clichés exist', () => {
        const emptyData = {
          ...validData,
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
        };

        const emptyCliche = new Cliche(emptyData);
        expect(emptyCliche.isEmpty()).toBe(true);
      });

      it('should return false when only tropes exist', () => {
        const tropesOnly = {
          ...validData,
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
        };

        const cliche = new Cliche(tropesOnly);
        expect(cliche.isEmpty()).toBe(false);
      });
    });

    describe('getDisplayData', () => {
      it('should format data for UI display', () => {
        const display = cliche.getDisplayData();

        expect(display).toHaveProperty('categories');
        expect(display).toHaveProperty('tropesAndStereotypes');
        expect(display).toHaveProperty('metadata');

        expect(display.categories).toBeInstanceOf(Array);
        expect(display.categories[0]).toEqual({
          id: 'names',
          title: 'Common Names',
          items: ['John Doe', 'Jane Smith', 'Jack Johnson'],
          count: 3,
        });

        expect(display.metadata).toEqual({
          createdAt: expect.any(String),
          totalCount: 38,
          model: 'Unknown',
        });
      });

      it('should only include non-empty categories', () => {
        validData.categories.names = [];
        validData.categories.physicalDescriptions = [];

        const cliche = new Cliche(validData);
        const display = cliche.getDisplayData();

        const categoryIds = display.categories.map((c) => c.id);
        expect(categoryIds).not.toContain('names');
        expect(categoryIds).not.toContain('physicalDescriptions');
        expect(categoryIds).toContain('personalityTraits');
      });

      it('should use model from llmMetadata if available', () => {
        validData.llmMetadata = { model: 'gpt-4' };

        const cliche = new Cliche(validData);
        const display = cliche.getDisplayData();

        expect(display.metadata.model).toBe('gpt-4');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large category arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
      validData.categories.names = largeArray;

      const cliche = new Cliche(validData);
      expect(cliche.categories.names).toHaveLength(1000);
      expect(cliche.getTotalCount()).toBe(1030); // 1000 + 30 from other categories
    });

    it('should handle special characters in text', () => {
      validData.categories.names = [
        'John "The Duke" Smith',
        "O'Malley",
        'José García',
        'Владимир',
        '山田太郎',
        '<script>alert("xss")</script>',
      ];

      const cliche = new Cliche(validData);
      expect(cliche.categories.names).toEqual(validData.categories.names);
    });

    it('should handle circular references in llmMetadata', () => {
      const circular = { prop: null };
      circular.prop = circular;
      validData.llmMetadata = circular;

      // Should not throw
      const cliche = new Cliche(validData);
      expect(cliche.llmMetadata).toBe(circular);
    });
  });
});
```

### 2. Service Tests

#### File: `tests/unit/characterBuilder/services/ClicheGenerator.test.js`

````javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { ClicheGenerator } from '../../../../src/characterBuilder/services/ClicheGenerator.js';

describe('ClicheGenerator Service', () => {
  let generator;
  let mockLLMService;
  let mockLogger;

  beforeEach(() => {
    mockLLMService = {
      generateCompletion: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    generator = new ClicheGenerator({
      llmService: mockLLMService,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with dependencies', () => {
      expect(generator).toBeInstanceOf(ClicheGenerator);
    });

    it('should validate dependencies', () => {
      expect(() => new ClicheGenerator({})).toThrow();
      expect(() => new ClicheGenerator({ llmService: null })).toThrow();
    });
  });

  describe('generateCliches', () => {
    const conceptText = 'A brave warrior seeking redemption';
    const direction = {
      title: 'The Fallen Hero',
      description: 'Once noble, now disgraced',
      coreTension: 'Redemption vs past sins',
    };

    it('should generate clichés successfully', async () => {
      const mockResponse = {
        content: JSON.stringify({
          categories: {
            names: ['Marcus', 'Darius', 'Kane'],
            physicalDescriptions: ['Battle scars', 'Weary eyes'],
            personalityTraits: ['Guilt-ridden', 'Stoic'],
            skillsAbilities: ['Master swordsman'],
            typicalLikes: ['Honor', 'Justice'],
            typicalDislikes: ['Betrayal', 'Cowardice'],
            commonFears: ['Repeating past mistakes'],
            genericGoals: ['Redemption', 'Atonement'],
            backgroundElements: ['Betrayed comrades'],
            overusedSecrets: ['Actually innocent'],
            speechPatterns: ['Few words', 'Grim warnings'],
          },
          tropesAndStereotypes: ['The Atoner', 'Fallen Hero'],
        }),
        model: 'gpt-4',
        usage: { total_tokens: 1500 },
      };

      mockLLMService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await generator.generateCliches(conceptText, direction);

      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('tropesAndStereotypes');
      expect(result).toHaveProperty('metadata');

      expect(result.categories.names).toEqual(['Marcus', 'Darius', 'Kane']);
      expect(result.metadata.model).toBe('gpt-4');
      expect(result.metadata.tokens).toBe(1500);
      expect(result.metadata.responseTime).toBeGreaterThan(0);
    });

    it('should validate input parameters', async () => {
      await expect(generator.generateCliches('', direction)).rejects.toThrow(
        'Concept text is required'
      );

      await expect(
        generator.generateCliches(conceptText, null)
      ).rejects.toThrow('Direction is required');

      await expect(
        generator.generateCliches(conceptText, { title: '' })
      ).rejects.toThrow('Direction title is required');
    });

    it('should handle LLM service errors', async () => {
      mockLLMService.generateCompletion.mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(
        generator.generateCliches(conceptText, direction)
      ).rejects.toThrow('Cliché generation failed');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should retry on transient failures', async () => {
      // First two calls fail, third succeeds
      mockLLMService.generateCompletion
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            categories: {
              names: ['Test'],
              physicalDescriptions: [],
              personalityTraits: [],
              skillsAbilities: [],
              typicalLikes: [],
              typicalDislikes: [],
              commonFears: [],
              genericGoals: [],
              backgroundElements: [],
              overusedSecrets: [],
              speechPatterns: [],
            },
            tropesAndStereotypes: ['Test Trope'],
          }),
        });

      const result = await generator.generateCliches(conceptText, direction);

      expect(mockLLMService.generateCompletion).toHaveBeenCalledTimes(3);
      expect(result.categories.names).toEqual(['Test']);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockLLMService.generateCompletion.mockRejectedValue(
        new Error('Persistent error')
      );

      await expect(
        generator.generateCliches(conceptText, direction)
      ).rejects.toThrow('Failed after 3 attempts');

      expect(mockLLMService.generateCompletion).toHaveBeenCalledTimes(3);
    });
  });

  describe('Response Parsing', () => {
    it('should parse valid JSON response', async () => {
      const validResponse = {
        content: JSON.stringify({
          categories: {
            names: ['Test Name'],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: ['Test Trope'],
        }),
      };

      mockLLMService.generateCompletion.mockResolvedValue(validResponse);

      const result = await generator.generateCliches('concept', {
        title: 'test',
      });
      expect(result.categories.names).toEqual(['Test Name']);
    });

    it('should handle malformed JSON with fallback parsing', async () => {
      const malformedResponse = {
        content: 'Invalid JSON content with some items:\n- Item 1\n- Item 2',
      };

      mockLLMService.generateCompletion.mockResolvedValue(malformedResponse);

      const result = await generator.generateCliches('concept', {
        title: 'test',
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempting fallback parsing'
      );
      expect(result).toHaveProperty('categories');
    });

    it('should clean markdown code blocks from response', async () => {
      const markdownResponse = {
        content:
          '```json\n{"categories": {"names": ["Test"]}, "tropesAndStereotypes": []}\n```',
      };

      mockLLMService.generateCompletion.mockResolvedValue(markdownResponse);

      const result = await generator.generateCliches('concept', {
        title: 'test',
      });
      expect(result.categories.names).toContain('Test');
    });

    it('should normalize missing categories', async () => {
      const incompleteResponse = {
        content: JSON.stringify({
          categories: {
            names: ['Test'],
            // Missing other categories
          },
          tropesAndStereotypes: ['Trope'],
        }),
      };

      mockLLMService.generateCompletion.mockResolvedValue(incompleteResponse);

      const result = await generator.generateCliches('concept', {
        title: 'test',
      });

      expect(result.categories.physicalDescriptions).toEqual([]);
      expect(result.categories.personalityTraits).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      generator.updateConfiguration({
        temperature: 0.9,
        maxTokens: 3000,
        maxRetries: 5,
        timeout: 45000,
      });

      const config = generator.getConfiguration();

      expect(config.temperature).toBe(0.9);
      expect(config.maxTokens).toBe(3000);
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(45000);
    });

    it('should enforce configuration limits', () => {
      generator.updateConfiguration({
        temperature: 3, // Above max
        maxTokens: 10, // Below min
        maxRetries: 10, // Above max
        timeout: 1000, // Below min
      });

      const config = generator.getConfiguration();

      expect(config.temperature).toBe(2); // Clamped to max
      expect(config.maxTokens).toBe(100); // Clamped to min
      expect(config.maxRetries).toBe(5); // Clamped to max
      expect(config.timeout).toBe(5000); // Clamped to min
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running requests', async () => {
      jest.useFakeTimers();

      // Mock a request that never resolves
      mockLLMService.generateCompletion.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const promise = generator.generateCliches('concept', { title: 'test' });

      // Fast-forward past timeout
      jest.advanceTimersByTime(31000);

      await expect(promise).rejects.toThrow('Generation timeout');

      jest.useRealTimers();
    });
  });
});
````

### 3. Controller Tests

#### File: `tests/unit/clichesGenerator/controllers/ClichesGeneratorController.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClichesGeneratorController } from '../../../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('ClichesGeneratorController', () => {
  let controller;
  let mockServices;
  let mockEventBus;
  let mockLogger;
  let mockClicheGenerator;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <select id="direction-selector">
        <option value="">-- Choose --</option>
      </select>
      <button id="generate-btn" disabled>Generate</button>
      <div id="selected-direction-display" style="display: none;"></div>
      <div id="direction-content"></div>
      <div id="direction-meta"></div>
      <div id="original-concept-display" style="display: none;"></div>
      <div id="concept-content"></div>
      <div id="cliches-container"></div>
      <div id="status-messages"></div>
      <button id="back-to-menu-btn">Back</button>
    `;

    // Create mocks
    mockServices = {
      characterBuilderService: {
        getAllThematicDirections: jest.fn(),
        getCharacterConcept: jest.fn(),
        getClichesByDirectionId: jest.fn(),
        hasClichesForDirection: jest.fn(),
        generateClichesForDirection: jest.fn(),
      },
    };

    mockEventBus = {
      on: jest.fn(),
      off: jest.fn(),
      dispatch: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockClicheGenerator = {
      generateCliches: jest.fn(),
    };

    controller = new ClichesGeneratorController({
      services: mockServices,
      eventBus: mockEventBus,
      logger: mockLogger,
      clicheGenerator: mockClicheGenerator,
    });
  });

  describe('Initialization', () => {
    it('should initialize and cache DOM elements', async () => {
      await controller.initialize();

      expect(controller._elements).toBeDefined();
      // Verify critical elements are cached
    });

    it('should set up event listeners', async () => {
      await controller.initialize();

      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Verify event listeners are attached
      expect(selector.onchange).toBeDefined();
    });

    it('should load initial data on initialization', async () => {
      const mockDirections = [
        { id: 'dir-1', title: 'Direction 1', conceptId: 'concept-1' },
        { id: 'dir-2', title: 'Direction 2', conceptId: 'concept-1' },
      ];

      mockServices.characterBuilderService.getAllThematicDirections.mockResolvedValue(
        mockDirections
      );

      mockServices.characterBuilderService.getCharacterConcept.mockResolvedValue(
        { id: 'concept-1', text: 'Test concept' }
      );

      await controller.initialize();

      expect(
        mockServices.characterBuilderService.getAllThematicDirections
      ).toHaveBeenCalled();

      // Check dropdown is populated
      const selector = document.getElementById('direction-selector');
      expect(selector.options.length).toBeGreaterThan(1);
    });

    it('should handle empty directions gracefully', async () => {
      mockServices.characterBuilderService.getAllThematicDirections.mockResolvedValue(
        []
      );

      await controller.initialize();

      // Should show empty state message
      expect(document.getElementById('status-messages').textContent).toContain(
        'No thematic directions found'
      );
    });
  });

  describe('Direction Selection', () => {
    beforeEach(async () => {
      // Set up initial state
      const mockDirections = [
        { id: 'dir-1', title: 'Direction 1', conceptId: 'concept-1' },
      ];

      mockServices.characterBuilderService.getAllThematicDirections.mockResolvedValue(
        mockDirections
      );

      mockServices.characterBuilderService.getCharacterConcept.mockResolvedValue(
        { id: 'concept-1', text: 'Test concept' }
      );

      await controller.initialize();
    });

    it('should handle direction selection', async () => {
      const selector = document.getElementById('direction-selector');

      // Simulate selection
      selector.value = 'dir-1';
      selector.dispatchEvent(new Event('change'));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check displays are updated
      expect(
        document.getElementById('selected-direction-display').style.display
      ).not.toBe('none');
      expect(
        document.getElementById('original-concept-display').style.display
      ).not.toBe('none');
    });

    it('should check for existing clichés', async () => {
      mockServices.characterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );

      const mockCliches = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {
          /* ... */
        },
      });

      mockServices.characterBuilderService.getClichesByDirectionId.mockResolvedValue(
        mockCliches
      );

      const selector = document.getElementById('direction-selector');
      selector.value = 'dir-1';
      selector.dispatchEvent(new Event('change'));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        mockServices.characterBuilderService.hasClichesForDirection
      ).toHaveBeenCalledWith('dir-1');
      expect(
        mockServices.characterBuilderService.getClichesByDirectionId
      ).toHaveBeenCalledWith('dir-1');
    });

    it('should enable generate button when no clichés exist', async () => {
      mockServices.characterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      const selector = document.getElementById('direction-selector');
      selector.value = 'dir-1';
      selector.dispatchEvent(new Event('change'));

      await new Promise((resolve) => setTimeout(resolve, 0));

      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(false);
    });
  });

  describe('Cliché Generation', () => {
    it('should generate clichés when button clicked', async () => {
      const mockCliches = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {
          names: ['Test Name'],
          // ... other categories
        },
      });

      mockServices.characterBuilderService.generateClichesForDirection.mockResolvedValue(
        mockCliches
      );

      // Set up state
      controller._selectedDirectionId = 'dir-1';
      controller._currentDirection = { id: 'dir-1' };
      controller._currentConcept = { id: 'concept-1' };

      const generateBtn = document.getElementById('generate-btn');
      generateBtn.disabled = false;
      generateBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(
        mockServices.characterBuilderService.generateClichesForDirection
      ).toHaveBeenCalled();

      // Check results are displayed
      const container = document.getElementById('cliches-container');
      expect(container.innerHTML).toContain('cliche');
    });

    it('should handle generation errors', async () => {
      mockServices.characterBuilderService.generateClichesForDirection.mockRejectedValue(
        new Error('Generation failed')
      );

      // Set up state
      controller._selectedDirectionId = 'dir-1';
      controller._currentDirection = { id: 'dir-1' };
      controller._currentConcept = { id: 'concept-1' };

      const generateBtn = document.getElementById('generate-btn');
      generateBtn.disabled = false;
      generateBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.error).toHaveBeenCalled();
      expect(document.getElementById('status-messages').textContent).toContain(
        'Failed to generate'
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await controller.initialize();
      await controller.cleanup();

      // Verify state is cleared
      expect(controller._selectedDirectionId).toBeNull();
      expect(controller._currentDirection).toBeNull();
      expect(controller._currentCliches).toBeNull();

      // Verify event listeners are removed
      expect(mockEventBus.off).toHaveBeenCalled();
    });
  });
});
```

## Implementation Tasks

### Phase 1: Model Tests (1.5 hours)

1. **Test Cliche model**
   - [ ] Constructor tests
   - [ ] Validation tests
   - [ ] Method tests
   - [ ] Edge cases

### Phase 2: Service Tests (1.5 hours)

1. **Test ClicheGenerator**
   - [ ] Generation flow
   - [ ] Retry logic
   - [ ] Error handling
   - [ ] Response parsing

2. **Test service extensions**
   - [ ] CRUD operations
   - [ ] Cache behavior
   - [ ] Event dispatching

### Phase 3: Controller Tests (1.5 hours)

1. **Test controller logic**
   - [ ] Initialization
   - [ ] User interactions
   - [ ] State management
   - [ ] UI updates

### Phase 4: Integration Points (1.5 hours)

1. **Test integrations**
   - [ ] State manager tests
   - [ ] Data flow tests
   - [ ] Event flow tests
   - [ ] Error propagation

## Coverage Requirements

```javascript
// Jest coverage configuration
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/characterBuilder/models/': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95,
    },
    './src/characterBuilder/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
```

## Test Execution

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:unit -- --coverage

# Run specific test file
npm run test:unit -- cliche.test.js

# Run in watch mode
npm run test:unit -- --watch

# Generate coverage report
npm run test:coverage
```

## Acceptance Criteria

- [ ] All tests passing
- [ ] 90% code coverage achieved
- [ ] No console errors/warnings
- [ ] Tests run in < 30 seconds
- [ ] Mocks properly isolated
- [ ] Edge cases covered
- [ ] Documentation complete

## Definition of Done

- [ ] All test files created
- [ ] Tests passing locally
- [ ] Coverage targets met
- [ ] CI/CD integration verified
- [ ] Code reviewed
- [ ] Documentation updated
