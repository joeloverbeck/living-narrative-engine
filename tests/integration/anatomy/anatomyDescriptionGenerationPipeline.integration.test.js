/**
 * @file Integration test for the full anatomy description generation pipeline
 * Tests the fix for empty description issue when creating anatomy graphs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Description Generation Pipeline - Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    
    // Load basic entity definitions and components needed for tests
    testBed.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'A basic actor entity',
        components: {
          'core:name': {},
          'anatomy:body': {}
        }
      },
      'anatomy:body_part': {
        id: 'anatomy:body_part',
        description: 'A basic body part',
        components: {
          'anatomy:part': {},
          'core:description': {}
        }
      },
      'anatomy:head': {
        id: 'anatomy:head',
        description: 'Head anatomy part',
        components: {
          'anatomy:part': {
            subType: 'head'
          },
          'anatomy:sockets': { sockets: [] },
          'core:name': {
            text: 'head'
          },
          'core:description': {}
        }
      },
      'anatomy:torso': {
        id: 'anatomy:torso',
        description: 'Torso anatomy part',
        components: {
          'anatomy:part': {},
          'core:description': {}
        }
      },
      'anatomy:human_female_torso': {
        id: 'anatomy:human_female_torso',
        description: 'A human female torso',
        components: {
          'anatomy:part': {
            subType: 'torso'
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'neck',
                orientation: 'upper',
                allowedTypes: ['head', 'neck'],
                nameTpl: '{{type}}'
              },
              {
                id: 'left_shoulder',
                orientation: 'left',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}'
              },
              {
                id: 'right_shoulder',
                orientation: 'right',
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}'
              }
            ]
          },
          'core:name': {
            text: 'torso'
          },
          'core:description': {}
        }
      },
      'anatomy:humanoid_arm': {
        id: 'anatomy:humanoid_arm',
        description: 'A humanoid arm',
        components: {
          'anatomy:part': {
            subType: 'arm'
          },
          'core:name': {
            text: 'arm'
          },
          'core:description': {}
        }
      }
    });

    testBed.loadComponents({
      'core:name': {
        id: 'core:name',
        description: 'Name component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      'core:description': {
        id: 'core:description',
        description: 'Description component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      'anatomy:body': {
        id: 'anatomy:body',
        description: 'Body anatomy component',
        dataSchema: {
          type: 'object',
          properties: {
            body: { 
              type: ['object', 'null'],
              nullable: true 
            },
            recipeId: { type: 'string' }
          },
          required: []
        }
      },
      'anatomy:part': {
        id: 'anatomy:part',
        description: 'Anatomy part component',
        dataSchema: {
          type: 'object',
          properties: {
            partType: { type: 'string' }
          },
          required: ['partType']
        }
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        description: 'Socket configuration for anatomy parts',
        dataSchema: {
          type: 'object',
          properties: {
            sockets: { 
              type: 'array',
              items: { type: 'object' }
            }
          },
          required: []
        }
      }
    });

    // Load basic anatomy blueprint for human_female
    testBed.loadBlueprints({
      'human_female': {
        id: 'human_female',
        description: 'Human female anatomy blueprint',
        root: 'anatomy:human_female_torso',
        slots: {
          head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part']
            }
          },
          left_arm: {
            socket: 'left_shoulder',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part']
            }
          },
          right_arm: {
            socket: 'right_shoulder',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part']
            }
          }
        }
      }
    });

    // Load anatomy recipe
    testBed.loadRecipes({
      'test:human_female_recipe': {
        id: 'test:human_female_recipe',
        recipeId: 'test:human_female_recipe',
        description: 'Test recipe for human female',
        blueprintId: 'human_female',
        slots: {
          head: {
            partType: 'head',
            preferId: 'anatomy:head'
          }
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm'
          }
        ]
      }
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Full Pipeline - Anatomy Graph Creation to Description Generation', () => {
    it('should generate anatomy with proper core:description components', async () => {
      // Arrange - Create an entity that needs anatomy
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });

      // Act - Generate anatomy for the entity
      const result = await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      // Assert - Verify anatomy was created successfully
      expect(result).toBe(true);
      
      // Get the body entity
      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      expect(bodyEntity).toBeTruthy();
      expect(bodyEntity.hasComponent('anatomy:body')).toBe(true);

      // Verify body has a non-empty description
      const bodyDescription = bodyEntity.getComponentData('core:description');
      expect(bodyDescription).toBeTruthy();
      expect(bodyDescription.text).toBeTruthy();
      expect(bodyDescription.text.trim()).not.toBe('');
      expect(typeof bodyDescription.text).toBe('string');
    });

    it('should generate descriptions for individual body parts', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });

      // Act
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      // Get body data to access individual parts
      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      const bodyComponent = bodyEntity.getComponentData('anatomy:body');
      const allParts = testBed.bodyGraphService.getAllParts(bodyComponent.body);

      // Assert - Check that individual parts have descriptions
      let partsWithDescriptions = 0;
      let partsChecked = 0;

      for (const partId of allParts) {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        if (partEntity && partEntity.hasComponent('core:description')) {
          const description = partEntity.getComponentData('core:description');
          if (description && description.text && description.text.trim() !== '') {
            partsWithDescriptions++;
          }
        }
        partsChecked++;
      }

      // Assert that we have at least some parts with descriptions
      expect(partsChecked).toBeGreaterThan(0);
      expect(partsWithDescriptions).toBeGreaterThan(0);
      
      // For human anatomy, we should have most parts with descriptions
      const descriptionRate = partsWithDescriptions / partsChecked;
      expect(descriptionRate).toBeGreaterThan(0.2); // At least 20% of parts should have descriptions
    });

    it('should handle description composition without errors', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });

      // Act - Generate anatomy
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      // Get the body entity for direct composition testing
      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      
      // Act - Test description composition directly
      const composedDescription = testBed.bodyDescriptionComposer.composeDescription(bodyEntity);

      // Assert - Verify composition works without errors
      expect(composedDescription).toBeTruthy();
      expect(typeof composedDescription).toBe('string');
      expect(composedDescription.trim()).not.toBe('');
    });

    it('should not dispatch system error events for valid anatomy generation', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });
      
      // Clear any previous dispatch calls
      testBed.mocks.eventDispatcher.dispatch.mockClear();

      // Act
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      // Assert - No error events should have been dispatched
      const errorCalls = testBed.mocks.eventDispatcher.dispatch.mock.calls.filter(call => {
        const event = call[0];
        return event && event.type === 'core:system_error_occurred' && 
               event.payload && event.payload.message && 
               event.payload.message.includes('Description is empty');
      });
      expect(errorCalls).toHaveLength(0);
    });

    it('should generate body descriptions that include part information', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });

      // Act
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      // Get the composed description
      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      const bodyDescription = bodyEntity.getComponentData('core:description');

      // Assert - Description should contain typical body parts
      expect(bodyDescription.text).toBeTruthy();
      const descText = bodyDescription.text.toLowerCase();
      
      // Should contain at least some body parts (flexible test)
      const bodyParts = ['eye', 'hair', 'arm', 'leg', 'hand', 'foot', 'head', 'breast', 'torso'];
      const foundParts = bodyParts.filter(part => descText.includes(part));
      
      expect(foundParts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Fallback Behavior', () => {
    it('should generate descriptions even when some parts lack core:description initially', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'core:name', { text: 'Test Character' });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });

      // Generate anatomy but simulate missing descriptions on some parts
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);
      
      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      const bodyComponent = bodyEntity.getComponentData('anatomy:body');
      const allParts = testBed.bodyGraphService.getAllParts(bodyComponent.body);

      // Remove core:description from some parts to simulate the timing issue
      const partsToStrip = allParts.slice(0, Math.min(3, allParts.length));
      for (const partId of partsToStrip) {
        testBed.entityManager.removeComponent(partId, 'core:description');
      }

      // Act - Try to compose description (should use fallback generation)
      const composedDescription = testBed.bodyDescriptionComposer.composeDescription(bodyEntity);

      // Assert - Should still generate a valid description using fallback
      expect(composedDescription).toBeTruthy();
      expect(typeof composedDescription).toBe('string');
      expect(composedDescription.trim()).not.toBe('');
    });
  });

  describe('Template Description Extraction with Generator Fallback', () => {
    it('should extract descriptions from parts with fallback generation', async () => {
      // Arrange
      const entity = testBed.createMockEntity();
      testBed.entityManager.createEntityInstance('core:actor', { instanceId: entity.id });
      testBed.entityManager.addComponent(entity.id, 'anatomy:body', { 
        body: null,
        recipeId: 'test:human_female_recipe'
      });
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

      const bodyEntity = testBed.entityManager.getEntityInstance(entity.id);
      const bodyComponent = bodyEntity.getComponentData('anatomy:body');
      const allParts = testBed.bodyGraphService.getAllParts(bodyComponent.body);

      // Get some part entities
      const partEntities = allParts
        .slice(0, 5)
        .map(id => testBed.entityManager.getEntityInstance(id))
        .filter(entity => entity);

      // Remove descriptions from parts to test fallback
      for (const partEntity of partEntities) {
        if (partEntity.hasComponent('core:description')) {
          testBed.entityManager.removeComponent(partEntity.id, 'core:description');
        }
      }

      // Act - Extract descriptions using template (should use fallback generation)
      const descriptions = testBed.descriptionTemplate.extractDescriptions(partEntities);

      // Assert - Should have generated descriptions for the parts
      expect(descriptions).toBeTruthy();
      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBeGreaterThan(0);
      
      // All returned descriptions should be non-empty strings
      for (const desc of descriptions) {
        expect(typeof desc).toBe('string');
        expect(desc.trim()).not.toBe('');
      }
    });
  });
});