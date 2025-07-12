/**
 * @file Integration test for Amaia Castillo recipe with clothing instantiation
 * @see src/anatomy/integration/anatomyClothingIntegrationService.js
 * @see src/anatomy/bodyGraphService.js
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import AnatomyClothingIntegrationService from '../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('Amaia Castillo Recipe Clothing Integration', () => {
  let entityManager;
  let logger;
  let bodyGraphService;
  let anatomyClothingIntegrationService;
  let mockDataRegistry;

  beforeEach(() => {
    // Create test helpers
    entityManager = new SimpleEntityManager();
    logger = createMockLogger();

    // Create real services to test integration
    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: { dispatch: jest.fn() },
    });

    // Mock data registry with anatomy blueprint and clothing data
    mockDataRegistry = {
      get: jest.fn().mockImplementation((category, id) => {
        if (category === 'anatomyBlueprints' && id === 'anatomy:human_female') {
          return {
            id: 'anatomy:human_female',
            clothingSlotMappings: {
              torso_clothing: {
                anatomySockets: ['torso_clothing'],
                allowedLayers: ['base', 'middle', 'outer'],
                layerOrder: ['base', 'middle', 'outer'],
                defaultLayer: 'middle',
              },
              underwear_bra: {
                anatomySockets: ['chest_clothing'],
                allowedLayers: ['base'],
                layerOrder: ['base'],
                defaultLayer: 'base',
              },
              underwear_bottom: {
                anatomySockets: ['pelvis_clothing'],
                allowedLayers: ['base'],
                layerOrder: ['base'],
                defaultLayer: 'base',
              },
            },
          };
        }
        return null;
      }),
    };

    // Create anatomy clothing integration service
    anatomyClothingIntegrationService = new AnatomyClothingIntegrationService({
      logger,
      entityManager,
      bodyGraphService,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('getBodyGraph method integration', () => {
    it('should successfully get body graph for entity with anatomy:body component', async () => {
      const entityId = 'test_entity_1';

      // Setup entity with anatomy:body component
      const bodyComponent = {
        body: {
          root: 'torso_1',
        },
      };

      entityManager.addComponent(entityId, 'anatomy:body', bodyComponent);

      // Mock the anatomy parts for getAllParts
      entityManager.addComponent('torso_1', 'anatomy:part', { type: 'torso' });

      // Test the getBodyGraph method
      const bodyGraph = await bodyGraphService.getBodyGraph(entityId);

      expect(bodyGraph).toBeDefined();
      expect(bodyGraph.getAllPartIds).toBeDefined();
      expect(typeof bodyGraph.getAllPartIds).toBe('function');

      const partIds = bodyGraph.getAllPartIds();
      expect(Array.isArray(partIds)).toBe(true);
    });

    it('should handle anatomy clothing integration without throwing getBodyGraph error', async () => {
      const actorId = 'amaia_castillo_actor';

      // Setup actor entity with anatomy:body component and anatomy:recipe
      const bodyComponent = {
        body: {
          root: 'torso_1',
        },
      };

      const recipeComponent = {
        blueprintId: 'anatomy:human_female',
      };

      entityManager.addComponent(actorId, 'anatomy:body', bodyComponent);
      entityManager.addComponent(actorId, 'anatomy:recipe', recipeComponent);

      // Setup body parts
      entityManager.addComponent('torso_1', 'anatomy:part', { type: 'torso' });
      entityManager.addComponent('torso_1', 'anatomy:sockets', {
        sockets: [
          { id: 'torso_clothing', orientation: 'neutral' },
          { id: 'chest_clothing', orientation: 'neutral' },
          { id: 'pelvis_clothing', orientation: 'neutral' },
        ],
      });

      // Test getting available clothing slots - this should not throw getBodyGraph error
      let availableSlots;
      let threwError = false;
      try {
        availableSlots =
          await anatomyClothingIntegrationService.getAvailableClothingSlots(
            actorId
          );
      } catch (error) {
        threwError = true;
        // Should not be the original getBodyGraph error
        expect(error.message).not.toContain('getBodyGraph is not a function');
      }

      // The method should execute without the original getBodyGraph error
      // (it may return undefined or empty Map for other reasons, but that's not the focus)
      if (!threwError) {
        expect(availableSlots).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should throw appropriate error when entity has no anatomy:body component', async () => {
      const entityId = 'entity_without_body';

      // Create entity without anatomy:body component (just add any other component)
      entityManager.addComponent(entityId, 'other:component', {});

      await expect(bodyGraphService.getBodyGraph(entityId)).rejects.toThrow(
        `Entity ${entityId} has no anatomy:body component`
      );
    });

    it('should throw InvalidArgumentError for invalid entity ID', async () => {
      await expect(bodyGraphService.getBodyGraph(null)).rejects.toThrow(
        'Entity ID is required and must be a string'
      );

      await expect(bodyGraphService.getBodyGraph(123)).rejects.toThrow(
        'Entity ID is required and must be a string'
      );
    });
  });
});
