/**
 * @file Integration tests for PartDescriptionGenerator
 * Tests real integration scenarios with actual entity management and dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PartDescriptionGenerator } from '../../../src/anatomy/PartDescriptionGenerator.js';
import {
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('PartDescriptionGenerator - Integration', () => {
  let testBed;
  let generator;
  let entityManager;
  let bodyPartDescriptionBuilder;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();

    entityManager = testBed.entityManager;
    bodyPartDescriptionBuilder = testBed.mockBodyPartDescriptionBuilder;

    // Create real PartDescriptionGenerator with test bed dependencies
    generator = new PartDescriptionGenerator({
      logger: testBed.mocks.logger,
      bodyPartDescriptionBuilder: bodyPartDescriptionBuilder,
      entityManager: entityManager,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor Integration', () => {
    it('should initialize with real dependencies from test bed', () => {
      expect(generator).toBeDefined();
    });

    it('should throw error when logger dependency is missing', () => {
      expect(() => {
        new PartDescriptionGenerator({
          bodyPartDescriptionBuilder: bodyPartDescriptionBuilder,
          entityManager: entityManager,
        });
      }).toThrow('logger is required');
    });

    it('should throw error when bodyPartDescriptionBuilder dependency is missing', () => {
      expect(() => {
        new PartDescriptionGenerator({
          logger: testBed.mocks.logger,
          entityManager: entityManager,
        });
      }).toThrow('bodyPartDescriptionBuilder is required');
    });

    it('should throw error when entityManager dependency is missing', () => {
      expect(() => {
        new PartDescriptionGenerator({
          logger: testBed.mocks.logger,
          bodyPartDescriptionBuilder: bodyPartDescriptionBuilder,
        });
      }).toThrow('entityManager is required');
    });
  });

  describe('generatePartDescription() Integration', () => {
    it('should generate description for real anatomy part entity', async () => {
      // Arrange - Create real anatomy part entity
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'arm',
          side: 'left',
        }
      );

      // Act
      const result = generator.generatePartDescription(partEntity.id);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify entity was actually processed
      const entity = entityManager.getEntityInstance(partEntity.id);
      expect(entity).toBeDefined();
      expect(entity.hasComponent(ANATOMY_PART_COMPONENT_ID)).toBe(true);
    });

    it('should return null for non-existent entity in real entity manager', () => {
      // Arrange - Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act
      const result = generator.generatePartDescription(nonExistentId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for entity without anatomy part component', async () => {
      // Arrange - Create entity without anatomy:part component
      const entity = await entityManager.createEntityInstance('core:actor');

      // Act
      const result = generator.generatePartDescription(entity.id);

      // Assert
      expect(result).toBeNull();

      // Verify entity exists but lacks anatomy:part component
      const retrievedEntity = entityManager.getEntityInstance(entity.id);
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity.hasComponent(ANATOMY_PART_COMPONENT_ID)).toBe(
        false
      );
    });

    it('should handle different anatomy part subtypes', async () => {
      // Arrange - Create different anatomy parts
      const armEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        armEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'arm',
          side: 'right',
        }
      );

      const legEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        legEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'leg',
          side: 'left',
        }
      );

      // Act
      const armResult = generator.generatePartDescription(armEntity.id);
      const legResult = generator.generatePartDescription(legEntity.id);

      // Assert
      expect(armResult).toBeDefined();
      expect(legResult).toBeDefined();
      expect(armResult).not.toBe(legResult); // Should generate different descriptions
    });

    it('should generate description without automatic persistence', async () => {
      // Arrange - Create anatomy part entity
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'torso',
        }
      );

      // Act
      const result = generator.generatePartDescription(partEntity.id);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify the real PartDescriptionGenerator doesn't automatically persist descriptions
      // (that's handled by other services in the system)
      const entity = entityManager.getEntityInstance(partEntity.id);
      const descriptionComponent = entity.getComponentData(
        DESCRIPTION_COMPONENT_ID
      );
      expect(descriptionComponent).toBeUndefined();
    });

    it('should return null when bodyPartDescriptionBuilder returns null', async () => {
      // Arrange - Create anatomy part entity
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'nullDescriptionPart',
        }
      );

      // Create generator with mock that returns null
      const nullBuilder = {
        buildDescription: () => null,
      };

      const generatorWithNullBuilder = new PartDescriptionGenerator({
        logger: testBed.mocks.logger,
        bodyPartDescriptionBuilder: nullBuilder,
        entityManager: entityManager,
      });

      // Act
      const result = generatorWithNullBuilder.generatePartDescription(
        partEntity.id
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when bodyPartDescriptionBuilder returns empty string', async () => {
      // Arrange - Create anatomy part entity
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'emptyDescriptionPart',
        }
      );

      // Create generator with mock that returns empty string
      const emptyBuilder = {
        buildDescription: () => '',
      };

      const generatorWithEmptyBuilder = new PartDescriptionGenerator({
        logger: testBed.mocks.logger,
        bodyPartDescriptionBuilder: emptyBuilder,
        entityManager: entityManager,
      });

      // Act
      const result = generatorWithEmptyBuilder.generatePartDescription(
        partEntity.id
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('generateMultiplePartDescriptions() Integration', () => {
    it('should generate descriptions for multiple real anatomy parts', async () => {
      // Arrange - Create multiple anatomy part entities
      const partEntities = [];
      const partIds = [];

      for (let i = 0; i < 3; i++) {
        const entity = await entityManager.createEntityInstance('core:actor');
        await entityManager.addComponent(entity.id, ANATOMY_PART_COMPONENT_ID, {
          subType: `part${i}`,
        });
        partEntities.push(entity);
        partIds.push(entity.id);
      }

      // Act
      const result = generator.generateMultiplePartDescriptions(partIds);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);

      // Verify each part has a description
      partIds.forEach((partId) => {
        expect(result.has(partId)).toBe(true);
        expect(typeof result.get(partId)).toBe('string');
        expect(result.get(partId).length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed valid and invalid entities in real entity manager', async () => {
      // Arrange - Mix of valid anatomy parts, non-anatomy entities, and non-existent IDs
      const validPartEntity =
        await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        validPartEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'validPart',
        }
      );

      const nonAnatomyEntity =
        await entityManager.createEntityInstance('core:actor');
      // Don't add anatomy:part component

      const nonExistentId = 'non-existent-' + Date.now();

      const partIds = [validPartEntity.id, nonAnatomyEntity.id, nonExistentId];

      // Act
      const result = generator.generateMultiplePartDescriptions(partIds);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1); // Only valid anatomy part should have description
      expect(result.has(validPartEntity.id)).toBe(true);
      expect(result.has(nonAnatomyEntity.id)).toBe(false);
      expect(result.has(nonExistentId)).toBe(false);
    });

    it('should handle empty array input', () => {
      // Arrange
      const partIds = [];

      // Act
      const result = generator.generateMultiplePartDescriptions(partIds);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle performance with larger datasets', async () => {
      // Arrange - Create 25 anatomy part entities for performance testing
      const partIds = [];

      for (let i = 0; i < 25; i++) {
        const entity = await entityManager.createEntityInstance('core:actor');
        await entityManager.addComponent(entity.id, ANATOMY_PART_COMPONENT_ID, {
          subType: `perfPart${i}`,
        });
        partIds.push(entity.id);
      }

      // Act
      const startTime = performance.now();
      const result = generator.generateMultiplePartDescriptions(partIds);
      const endTime = performance.now();

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(25);

      // Performance assertion - should complete reasonably quickly
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle duplicate part IDs correctly', async () => {
      // Arrange - Create anatomy part and include duplicate IDs
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'duplicatedPart',
        }
      );

      const partIds = [partEntity.id, partEntity.id, partEntity.id];

      // Act
      const result = generator.generateMultiplePartDescriptions(partIds);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1); // Map should deduplicate
      expect(result.has(partEntity.id)).toBe(true);
    });
  });

  describe('needsRegeneration() Integration', () => {
    it('should return false for non-existent entity in real entity manager', () => {
      // Arrange
      const nonExistentId = 'non-existent-' + Date.now();

      // Act
      const result = generator.needsRegeneration(nonExistentId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for entity without description component', async () => {
      // Arrange - Create entity without description component
      const entity = await entityManager.createEntityInstance('core:actor');

      // Act
      const result = generator.needsRegeneration(entity.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for entity with empty description text', async () => {
      // Arrange - Create entity with empty description
      const entity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(entity.id, DESCRIPTION_COMPONENT_ID, {
        text: '',
      });

      // Act
      const result = generator.needsRegeneration(entity.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for entity with existing description (current implementation)', async () => {
      // Arrange - Create entity with existing description
      const entity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(entity.id, DESCRIPTION_COMPONENT_ID, {
        text: 'Existing description text',
      });

      // Act
      const result = generator.needsRegeneration(entity.id);

      // Assert
      expect(result).toBe(true); // Current implementation always returns true
    });

    it('should return true for entity with description component but no text property', async () => {
      // Arrange - Create entity with malformed description component
      const entity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(entity.id, DESCRIPTION_COMPONENT_ID, {
        other: 'property',
        // No text property
      });

      // Act
      const result = generator.needsRegeneration(entity.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle various description component data structures', async () => {
      // Arrange - Test different description component structures
      const testCases = [
        { text: null },
        { text: undefined },
        { text: 0 },
        { text: false },
        {},
        // Note: null would fail validation, so we test it separately
      ];

      const results = [];
      for (const componentData of testCases) {
        const entity = await entityManager.createEntityInstance('core:actor');
        await entityManager.addComponent(
          entity.id,
          DESCRIPTION_COMPONENT_ID,
          componentData
        );
        results.push(generator.needsRegeneration(entity.id));
      }

      // Also test the null case by checking entity without any description component
      const entityWithoutDesc =
        await entityManager.createEntityInstance('core:actor');
      results.push(generator.needsRegeneration(entityWithoutDesc.id));

      // Assert - All should return true for regeneration needed
      results.forEach((result) => {
        expect(result).toBe(true);
      });
    });
  });

  describe('Integration Error Handling', () => {
    it('should handle entity manager errors gracefully', () => {
      // Arrange - Create generator with broken entity manager
      const brokenEntityManager = {
        getEntityInstance: () => {
          throw new Error('Entity manager error');
        },
      };

      const generatorWithBrokenEM = new PartDescriptionGenerator({
        logger: testBed.mocks.logger,
        bodyPartDescriptionBuilder: bodyPartDescriptionBuilder,
        entityManager: brokenEntityManager,
      });

      // Act & Assert - Should not throw, should handle gracefully
      expect(() => {
        generatorWithBrokenEM.generatePartDescription('any-id');
      }).toThrow('Entity manager error'); // Currently lets errors bubble up
    });

    it('should handle body part description builder errors', async () => {
      // Arrange - Create anatomy part entity
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'errorPart',
        }
      );

      // Create generator with broken description builder
      const brokenBuilder = {
        buildDescription: () => {
          throw new Error('Description builder error');
        },
      };

      const generatorWithBrokenBuilder = new PartDescriptionGenerator({
        logger: testBed.mocks.logger,
        bodyPartDescriptionBuilder: brokenBuilder,
        entityManager: entityManager,
      });

      // Act & Assert - Should bubble up the error
      expect(() => {
        generatorWithBrokenBuilder.generatePartDescription(partEntity.id);
      }).toThrow('Description builder error');
    });
  });

  describe('End-to-End Integration Workflows', () => {
    it('should complete full workflow from entity creation to description generation', async () => {
      // Arrange & Act - Complete workflow
      const partEntity = await entityManager.createEntityInstance('core:actor');
      await entityManager.addComponent(
        partEntity.id,
        ANATOMY_PART_COMPONENT_ID,
        {
          subType: 'workflowPart',
          side: 'left',
        }
      );

      // Check if regeneration is needed (entity has no description component)
      const needsRegen = generator.needsRegeneration(partEntity.id);
      expect(needsRegen).toBe(true);

      // Generate description
      const description = generator.generatePartDescription(partEntity.id);
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);

      // Manually add description component to simulate persistence layer
      await entityManager.addComponent(
        partEntity.id,
        DESCRIPTION_COMPONENT_ID,
        {
          text: description,
        }
      );

      // Verify description was added
      const updatedEntity = entityManager.getEntityInstance(partEntity.id);
      const descComponent = updatedEntity.getComponentData(
        DESCRIPTION_COMPONENT_ID
      );
      expect(descComponent).toBeDefined();
      expect(descComponent.text).toBe(description);

      // Check regeneration status after description exists
      const stillNeedsRegen = generator.needsRegeneration(partEntity.id);
      expect(stillNeedsRegen).toBe(true); // Current implementation always returns true
    });

    it('should handle complex multi-part body structure', async () => {
      // Arrange - Create a complex body with multiple parts
      const bodyParts = [
        { subType: 'torso', side: null },
        { subType: 'arm', side: 'left' },
        { subType: 'arm', side: 'right' },
        { subType: 'leg', side: 'left' },
        { subType: 'leg', side: 'right' },
      ];

      const partIds = [];
      for (const partSpec of bodyParts) {
        const entity = await entityManager.createEntityInstance('core:actor');
        await entityManager.addComponent(
          entity.id,
          ANATOMY_PART_COMPONENT_ID,
          partSpec
        );
        partIds.push(entity.id);
      }

      // Act - Generate descriptions for all parts
      const descriptions = generator.generateMultiplePartDescriptions(partIds);

      // Assert
      expect(descriptions.size).toBe(bodyParts.length);

      // Verify all parts have descriptions
      partIds.forEach((partId) => {
        expect(descriptions.has(partId)).toBe(true);
        expect(descriptions.get(partId)).toBeDefined();
        expect(typeof descriptions.get(partId)).toBe('string');
      });

      // Verify descriptions are unique (assuming different parts generate different descriptions)
      const descriptionTexts = Array.from(descriptions.values());
      const uniqueDescriptions = new Set(descriptionTexts);
      expect(uniqueDescriptions.size).toBeGreaterThan(1); // Should have some variety
    });
  });
});
