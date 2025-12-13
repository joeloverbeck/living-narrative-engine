/**
 * @file Test suite for PartDescriptionGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PartDescriptionGenerator } from '../../../src/anatomy/PartDescriptionGenerator.js';
import {
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('PartDescriptionGenerator', () => {
  let generator;
  let mockLogger;
  let mockBodyPartDescriptionBuilder;
  let mockEntityManager;
  let mockEntity;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup mock body part description builder
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
    };

    // Setup mock entity
    mockEntity = {
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    generator = new PartDescriptionGenerator({
      logger: mockLogger,
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => {
        new PartDescriptionGenerator({
          bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
          entityManager: mockEntityManager,
        });
      }).toThrow('logger is required');
    });

    it('should throw error when bodyPartDescriptionBuilder is not provided', () => {
      expect(() => {
        new PartDescriptionGenerator({
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).toThrow('bodyPartDescriptionBuilder is required');
    });

    it('should throw error when entityManager is not provided', () => {
      expect(() => {
        new PartDescriptionGenerator({
          logger: mockLogger,
          bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        });
      }).toThrow('entityManager is required');
    });

    it('should create instance with valid dependencies', () => {
      const instance = new PartDescriptionGenerator({
        logger: mockLogger,
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('generatePartDescription', () => {
    it('should generate description for valid anatomy part', () => {
      const partId = 'test-part';
      const expectedDescription = 'A muscular left arm';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        expectedDescription
      );

      const result = generator.generatePartDescription(partId);

      expect(result).toBe(expectedDescription);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(partId);
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_PART_COMPONENT_ID
      );
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PartDescriptionGenerator: Generated description for part '${partId}'`
      );
    });

    it('should return null when entity not found', () => {
      const partId = 'non-existent';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = generator.generatePartDescription(partId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PartDescriptionGenerator: Entity '${partId}' is not an anatomy part`
      );
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).not.toHaveBeenCalled();
    });

    it('should return null when entity is not an anatomy part', () => {
      const partId = 'not-a-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(false);

      const result = generator.generatePartDescription(partId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PartDescriptionGenerator: Entity '${partId}' is not an anatomy part`
      );
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).not.toHaveBeenCalled();
    });

    it('should return null when description builder returns null', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(null);

      const result = generator.generatePartDescription(partId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PartDescriptionGenerator: No description generated for part '${partId}'`
      );
    });

    it('should return null when description builder returns empty string', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('');

      const result = generator.generatePartDescription(partId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `PartDescriptionGenerator: No description generated for part '${partId}'`
      );
    });
  });

  describe('generateMultiplePartDescriptions', () => {
    it('should generate descriptions for all valid parts', () => {
      const partIds = ['part1', 'part2', 'part3'];
      const descriptions = ['Desc 1', 'Desc 2', 'Desc 3'];

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription
        .mockReturnValueOnce(descriptions[0])
        .mockReturnValueOnce(descriptions[1])
        .mockReturnValueOnce(descriptions[2]);

      const result = generator.generateMultiplePartDescriptions(partIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get('part1')).toBe(descriptions[0]);
      expect(result.get('part2')).toBe(descriptions[1]);
      expect(result.get('part3')).toBe(descriptions[2]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PartDescriptionGenerator: Generated 3 descriptions out of 3 parts'
      );
    });

    it('should handle mixed valid and invalid parts', () => {
      const partIds = ['valid1', 'invalid', 'valid2', 'no-desc'];

      // Mock different scenarios
      mockEntityManager.getEntityInstance
        .mockReturnValueOnce(mockEntity) // valid1
        .mockReturnValueOnce(null) // invalid - not found
        .mockReturnValueOnce(mockEntity) // valid2
        .mockReturnValueOnce(mockEntity); // no-desc

      mockEntity.hasComponent
        .mockReturnValueOnce(true) // valid1
        .mockReturnValueOnce(true) // valid2
        .mockReturnValueOnce(true); // no-desc

      mockBodyPartDescriptionBuilder.buildDescription
        .mockReturnValueOnce('Description 1')
        .mockReturnValueOnce('Description 2')
        .mockReturnValueOnce(null); // no-desc returns null

      const result = generator.generateMultiplePartDescriptions(partIds);

      expect(result.size).toBe(2);
      expect(result.get('valid1')).toBe('Description 1');
      expect(result.get('valid2')).toBe('Description 2');
      expect(result.has('invalid')).toBe(false);
      expect(result.has('no-desc')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PartDescriptionGenerator: Generated 2 descriptions out of 4 parts'
      );
    });

    it('should handle empty array', () => {
      const partIds = [];

      const result = generator.generateMultiplePartDescriptions(partIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PartDescriptionGenerator: Generated 0 descriptions out of 0 parts'
      );
    });

    it('should handle array with duplicate IDs', () => {
      const partIds = ['part1', 'part2', 'part1']; // part1 is duplicated

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription
        .mockReturnValueOnce('Desc 1')
        .mockReturnValueOnce('Desc 2')
        .mockReturnValueOnce('Desc 1 Updated');

      const result = generator.generateMultiplePartDescriptions(partIds);

      expect(result.size).toBe(2);
      expect(result.get('part1')).toBe('Desc 1 Updated'); // Should have the last value
      expect(result.get('part2')).toBe('Desc 2');
    });
  });

  describe('needsRegeneration', () => {
    it('should return true when entity has no description component', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue(null);

      const result = generator.needsRegeneration(partId);

      expect(result).toBe(true);
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
    });

    it('should return true when description text is empty', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue({ text: '' });

      const result = generator.needsRegeneration(partId);

      expect(result).toBe(true);
    });

    it('should return true when description exists (always regenerate for now)', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue({
        text: 'Existing description',
      });

      const result = generator.needsRegeneration(partId);

      expect(result).toBe(true); // Currently always returns true for existing descriptions
    });

    it('should return false when entity not found', () => {
      const partId = 'non-existent';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = generator.needsRegeneration(partId);

      expect(result).toBe(false);
      expect(mockEntity.getComponentData).not.toHaveBeenCalled();
    });

    it('should return true when description component has no text property', () => {
      const partId = 'test-part';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue({ other: 'data' }); // No text property

      const result = generator.needsRegeneration(partId);

      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow for part description generation', () => {
      const partId = 'arm-part';
      const description = 'A strong muscular arm';

      // Check if needs regeneration
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue(null);

      const needsRegen = generator.needsRegeneration(partId);
      expect(needsRegen).toBe(true);

      // Generate description
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        description
      );

      const generatedDesc = generator.generatePartDescription(partId);
      expect(generatedDesc).toBe(description);
    });

    it('should efficiently process large batch of parts', () => {
      const partIds = Array.from({ length: 100 }, (_, i) => `part-${i}`);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation(
        () => 'Generated description'
      );

      const result = generator.generateMultiplePartDescriptions(partIds);

      expect(result.size).toBe(100);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(100);
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).toHaveBeenCalledTimes(100);
    });

    it('should handle error scenarios gracefully', () => {
      const partIds = ['part1', 'part2'];

      // First part succeeds
      mockEntityManager.getEntityInstance.mockReturnValueOnce(mockEntity);
      mockEntity.hasComponent.mockReturnValueOnce(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValueOnce(
        'Desc 1'
      );

      // Second part throws error
      mockEntityManager.getEntityInstance.mockReturnValueOnce(mockEntity);
      mockEntity.hasComponent.mockReturnValueOnce(true);
      mockBodyPartDescriptionBuilder.buildDescription.mockImplementationOnce(
        () => {
          throw new Error('Builder error');
        }
      );

      // The current implementation doesn't catch errors in buildDescription,
      // so this would throw. In a real scenario, you might want to add error handling.
      expect(() => {
        generator.generateMultiplePartDescriptions(partIds);
      }).toThrow('Builder error');
    });
  });
});
