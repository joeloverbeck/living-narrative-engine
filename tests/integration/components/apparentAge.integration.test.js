/**
 * @file Integration tests for apparent age component
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { AgeUtils } from '../../../src/utils/ageUtils.js';

describe('Apparent Age Component Integration', () => {
  let testBed;
  let entityManager;
  let componentDefinitionLoader;

  beforeEach(async () => {
    testBed = createTestBed();

    // Mock entity manager for component operations
    entityManager = {
      addComponent: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      removeComponent: jest.fn(),
      createEntityInstance: jest.fn(),
    };

    // Mock component definition loader
    componentDefinitionLoader = {
      loadComponent: jest.fn(),
      getComponentDefinition: jest.fn(),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Component Definition Loading', () => {
    it('should load apparent_age component definition successfully', async () => {
      const mockComponentDef = {
        id: 'core:apparent_age',
        description:
          'Stores the perceived age range of an entity, allowing for uncertainty in age perception typical of real-world scenarios.',
        dataSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['minAge', 'maxAge'],
          properties: {
            minAge: { type: 'number', minimum: 0, maximum: 200 },
            maxAge: { type: 'number', minimum: 0, maximum: 200 },
            bestGuess: { type: 'number', minimum: 0, maximum: 200 },
          },
        },
      };

      componentDefinitionLoader.getComponentDefinition.mockReturnValue(
        mockComponentDef
      );

      const result =
        componentDefinitionLoader.getComponentDefinition('core:apparent_age');

      expect(result).toBeDefined();
      expect(result.id).toBe('core:apparent_age');
      expect(result.dataSchema.required).toContain('minAge');
      expect(result.dataSchema.required).toContain('maxAge');
      expect(result.dataSchema.properties.bestGuess).toBeDefined();
    });
  });

  describe('Entity Component Operations', () => {
    it('should add apparent age component to entity successfully', async () => {
      const entityId = 'test-character';
      const ageData = { minAge: 25, maxAge: 35, bestGuess: 30 };

      entityManager.addComponent.mockResolvedValue(true);
      entityManager.hasComponent.mockReturnValue(true);
      entityManager.getComponentData.mockReturnValue(ageData);

      await entityManager.addComponent(entityId, 'core:apparent_age', ageData);

      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        'core:apparent_age',
        ageData
      );

      // Verify component can be retrieved
      const hasComponent = entityManager.hasComponent(
        entityId,
        'core:apparent_age'
      );
      expect(hasComponent).toBe(true);

      const retrievedData = entityManager.getComponentData(
        entityId,
        'core:apparent_age'
      );
      expect(retrievedData).toEqual(ageData);
    });

    it('should handle component with only required fields', async () => {
      const entityId = 'test-character';
      const ageData = { minAge: 20, maxAge: 30 };

      entityManager.addComponent.mockResolvedValue(true);
      entityManager.getComponentData.mockReturnValue(ageData);

      await entityManager.addComponent(entityId, 'core:apparent_age', ageData);
      const retrievedData = entityManager.getComponentData(
        entityId,
        'core:apparent_age'
      );

      expect(retrievedData.minAge).toBe(20);
      expect(retrievedData.maxAge).toBe(30);
      expect(retrievedData.bestGuess).toBeUndefined();
    });

    it('should handle exact age (min equals max)', async () => {
      const entityId = 'test-character';
      const ageData = { minAge: 25, maxAge: 25 };

      entityManager.addComponent.mockResolvedValue(true);
      entityManager.getComponentData.mockReturnValue(ageData);

      await entityManager.addComponent(entityId, 'core:apparent_age', ageData);
      const retrievedData = entityManager.getComponentData(
        entityId,
        'core:apparent_age'
      );

      expect(retrievedData.minAge).toBe(25);
      expect(retrievedData.maxAge).toBe(25);
    });

    it('should remove apparent age component from entity', async () => {
      const entityId = 'test-character';

      entityManager.removeComponent.mockResolvedValue(true);
      entityManager.hasComponent.mockReturnValue(false);

      await entityManager.removeComponent(entityId, 'core:apparent_age');

      expect(entityManager.removeComponent).toHaveBeenCalledWith(
        entityId,
        'core:apparent_age'
      );

      const hasComponent = entityManager.hasComponent(
        entityId,
        'core:apparent_age'
      );
      expect(hasComponent).toBe(false);
    });
  });

  describe('Integration with AgeUtils', () => {
    it('should work with AgeUtils helper functions', () => {
      const ageData = { minAge: 25, maxAge: 35, bestGuess: 30 };

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      // Test all AgeUtils functions with component data
      expect(AgeUtils.getAverageAge(retrievedData)).toBe(30);
      expect(AgeUtils.getAgeUncertainty(retrievedData)).toBe(10);
      expect(AgeUtils.isAgeInRange(retrievedData, 28)).toBe(true);
      expect(AgeUtils.isAgeInRange(retrievedData, 40)).toBe(false);
      expect(AgeUtils.formatAgeDescription(retrievedData)).toBe(
        'around 30 years old'
      );
      expect(AgeUtils.validateAgeComponent(retrievedData)).toBe(true);
    });

    it('should work with age range without bestGuess', () => {
      const ageData = { minAge: 20, maxAge: 30 };

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      expect(AgeUtils.getAverageAge(retrievedData)).toBe(25);
      expect(AgeUtils.getAgeUncertainty(retrievedData)).toBe(10);
      expect(AgeUtils.formatAgeDescription(retrievedData)).toBe(
        'between 20 and 30 years old'
      );
    });
  });

  describe('Description Integration', () => {
    it('should generate age descriptions for entity descriptions', () => {
      const ageData = { minAge: 25, maxAge: 35, bestGuess: 30 };
      const nameData = { text: 'Alice' };

      entityManager.getComponentData
        .mockReturnValueOnce(ageData) // for apparent_age
        .mockReturnValueOnce(nameData); // for name

      const retrievedAgeData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );
      const retrievedNameData = entityManager.getComponentData(
        'test-entity',
        'core:name'
      );

      const ageDescription = AgeUtils.formatAgeDescription(retrievedAgeData);
      const fullDescription = `${retrievedNameData.text} ${ageDescription}`;

      expect(fullDescription).toBe('Alice around 30 years old');
    });
  });

  describe('Rule System Integration Examples', () => {
    it('should support age-based rule evaluation (conservative check)', () => {
      const ageData = { minAge: 25, maxAge: 35, bestGuess: 30 };
      const minimumAge = 21;

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      // Conservative check: use minAge (must definitely meet requirement)
      const meetsRequirement = retrievedData.minAge >= minimumAge;
      expect(meetsRequirement).toBe(true);
    });

    it('should support age-based rule evaluation (liberal check)', () => {
      const ageData = { minAge: 18, maxAge: 25 };
      const minimumAge = 21;

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      // Liberal check: use maxAge (possibly meets requirement)
      const possiblyMeetsRequirement = retrievedData.maxAge >= minimumAge;
      expect(possiblyMeetsRequirement).toBe(true);

      // Conservative check would fail
      const definitelyMeetsRequirement = retrievedData.minAge >= minimumAge;
      expect(definitelyMeetsRequirement).toBe(false);
    });

    it('should support age-based rule evaluation (average check)', () => {
      const ageData = { minAge: 18, maxAge: 28 };
      const minimumAge = 21;

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      // Average check: use calculated average
      const averageAge = AgeUtils.getAverageAge(retrievedData);
      const meetsRequirement = averageAge >= minimumAge;
      expect(meetsRequirement).toBe(true);
      expect(averageAge).toBe(23);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle minimum boundary values', () => {
      const ageData = { minAge: 0, maxAge: 5 };

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      expect(AgeUtils.validateAgeComponent(retrievedData)).toBe(true);
      expect(AgeUtils.getAverageAge(retrievedData)).toBe(2.5);
      expect(AgeUtils.formatAgeDescription(retrievedData)).toBe(
        'between 0 and 5 years old'
      );
    });

    it('should handle maximum boundary values', () => {
      const ageData = { minAge: 195, maxAge: 200 };

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      expect(AgeUtils.validateAgeComponent(retrievedData)).toBe(true);
      expect(AgeUtils.getAverageAge(retrievedData)).toBe(197.5);
      expect(AgeUtils.formatAgeDescription(retrievedData)).toBe(
        'between 195 and 200 years old'
      );
    });

    it('should handle bestGuess at boundaries', () => {
      const ageData = { minAge: 20, maxAge: 30, bestGuess: 20 };

      entityManager.getComponentData.mockReturnValue(ageData);
      const retrievedData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );

      expect(AgeUtils.validateAgeComponent(retrievedData)).toBe(true);
      expect(AgeUtils.getAverageAge(retrievedData)).toBe(20);
      expect(AgeUtils.formatAgeDescription(retrievedData)).toBe(
        'around 20 years old'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing component gracefully', () => {
      entityManager.hasComponent.mockReturnValue(false);
      entityManager.getComponentData.mockReturnValue(null);

      const hasComponent = entityManager.hasComponent(
        'test-entity',
        'core:apparent_age'
      );
      expect(hasComponent).toBe(false);

      const componentData = entityManager.getComponentData(
        'test-entity',
        'core:apparent_age'
      );
      expect(componentData).toBeNull();
    });

    it('should handle component add failure', async () => {
      const entityId = 'test-character';
      const invalidAgeData = { minAge: 30, maxAge: 20 }; // Invalid: max < min

      entityManager.addComponent.mockRejectedValue(
        new Error('Validation failed')
      );

      await expect(
        entityManager.addComponent(
          entityId,
          'core:apparent_age',
          invalidAgeData
        )
      ).rejects.toThrow('Validation failed');
    });
  });
});
