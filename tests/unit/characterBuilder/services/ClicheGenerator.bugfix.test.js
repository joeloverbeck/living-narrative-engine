/**
 * @file Unit tests for ClicheGenerator bug fix
 * Tests the fix for incorrect method parameters
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ClicheGenerator from '../../../../src/characterBuilder/services/ClicheGenerator.js';
import { ClicheGenerationError } from '../../../../src/errors/clicheErrors.js';

describe('ClicheGenerator - Bug Fix Unit Tests', () => {
  let generator;
  let mockLLMJsonService;
  let mockLLMStrategyFactory;
  let mockLLMConfigManager;
  let mockLogger;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockLLMJsonService = {
      clean: jest.fn((text) => text),
      parseAndRepair: jest.fn((text) => JSON.parse(text)),
    };

    mockLLMStrategyFactory = {
      getAIDecision: jest.fn().mockResolvedValue(
        JSON.stringify({
          categories: {
            names: ['John Doe'],
            physicalDescriptions: ['Tall, dark and handsome'],
            personalityTraits: ['Brooding'],
            skillsAbilities: ['Master swordsman'],
            typicalLikes: ['Justice'],
            typicalDislikes: ['Injustice'],
            commonFears: ['Losing loved ones'],
            genericGoals: ['Save the world'],
            backgroundElements: ['Orphaned as a child'],
            overusedSecrets: ['Secret royal bloodline'],
            speechPatterns: ['Always speaks in riddles'],
          },
          tropesAndStereotypes: ['The Chosen One'],
        })
      ),
    };

    mockLLMConfigManager = {
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        temperature: 0.7,
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
      loadConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
      }),
    };

    generator = new ClicheGenerator({
      logger: mockLogger,
      llmJsonService: mockLLMJsonService,
      llmStrategyFactory: mockLLMStrategyFactory,
      llmConfigManager: mockLLMConfigManager,
    });
  });

  describe('generateCliches method signature', () => {
    it('should throw error when parameters are in wrong order (bug reproduction)', async () => {
      // Arrange
      const conceptText = 'A young hero on a quest';
      const direction = {
        title: 'The Chosen One',
        description: 'Classic hero journey',
        coreTension: 'Destiny vs free will',
      };

      // Act & Assert - This reproduces the original bug where parameters were passed in wrong order
      await expect(async () => {
        // This is what was happening before the fix - calling with wrong parameters
        await generator.generateCliches(
          conceptText, // Wrong - this should be conceptId (string is passed but wrong content)
          direction, // Wrong - this should be conceptText (object passed instead of string)
          {} // Wrong - this should be direction (empty object instead of direction)
        );
      }).rejects.toThrow('conceptText must be a non-empty string'); // Fails validation on second param
    });

    it('should accept correct parameters: conceptId, conceptText, direction', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const conceptText = 'A young hero on a quest';
      const direction = {
        title: 'The Chosen One',
        description: 'Classic hero journey',
        coreTension: 'Destiny vs free will',
      };

      // Act
      const result = await generator.generateCliches(
        conceptId,
        conceptText,
        direction
      );

      // Assert - ClicheGenerator now returns an object with categories, tropesAndStereotypes, and metadata
      expect(result).toBeDefined();
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('tropesAndStereotypes');
      expect(result).toHaveProperty('metadata');
      expect(mockLLMStrategyFactory.getAIDecision).toHaveBeenCalled();
    });

    it('should validate conceptId is non-empty string', async () => {
      // Arrange
      const conceptText = 'A young hero on a quest';
      const direction = {
        title: 'The Chosen One',
        description: 'Classic hero journey',
        coreTension: 'Destiny vs free will',
      };

      // Act & Assert - Empty conceptId
      await expect(async () => {
        await generator.generateCliches('', conceptText, direction);
      }).rejects.toThrow('conceptId must be a non-empty string');

      // Act & Assert - Null conceptId
      await expect(async () => {
        await generator.generateCliches(null, conceptText, direction);
      }).rejects.toThrow('conceptId must be a non-empty string');

      // Act & Assert - Undefined conceptId
      await expect(async () => {
        await generator.generateCliches(undefined, conceptText, direction);
      }).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should validate conceptText is non-empty string', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const direction = {
        title: 'The Chosen One',
        description: 'Classic hero journey',
        coreTension: 'Destiny vs free will',
      };

      // Act & Assert - Empty conceptText
      await expect(async () => {
        await generator.generateCliches(conceptId, '', direction);
      }).rejects.toThrow('conceptText must be a non-empty string');

      // Act & Assert - Null conceptText
      await expect(async () => {
        await generator.generateCliches(conceptId, null, direction);
      }).rejects.toThrow('conceptText must be a non-empty string');

      // Act & Assert - Undefined conceptText
      await expect(async () => {
        await generator.generateCliches(conceptId, undefined, direction);
      }).rejects.toThrow('conceptText must be a non-empty string');
    });

    it('should validate direction is valid object', async () => {
      // Arrange
      const conceptId = 'concept-123';
      const conceptText = 'A young hero on a quest';

      // Act & Assert - Null direction
      await expect(async () => {
        await generator.generateCliches(conceptId, conceptText, null);
      }).rejects.toThrow('direction must be a valid object');

      // Act & Assert - Undefined direction
      await expect(async () => {
        await generator.generateCliches(conceptId, conceptText, undefined);
      }).rejects.toThrow('direction must be a valid object');

      // Act & Assert - String instead of object
      await expect(async () => {
        await generator.generateCliches(
          conceptId,
          conceptText,
          'not an object'
        );
      }).rejects.toThrow('direction must be a valid object');
    });
  });

  describe('CharacterBuilderService integration', () => {
    it('should be called with correct parameters from service', async () => {
      // This test verifies the service would call the generator correctly
      // after our fix
      const conceptId = 'concept-456';
      const conceptText = 'A mysterious stranger arrives in town';
      const direction = {
        title: 'Mysterious Stranger',
        description: 'Unknown past, hidden agenda',
        coreTension: 'Trust vs suspicion',
      };

      // Act
      const result = await generator.generateCliches(
        conceptId, // First param: concept ID
        conceptText, // Second param: concept text
        direction // Third param: direction object
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation for concept'),
        expect.objectContaining({
          conceptId: conceptId,
          conceptLength: conceptText.length,
          direction: direction.title,
        })
      );
    });
  });
});
