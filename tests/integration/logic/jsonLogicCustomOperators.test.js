// tests/integration/logic/jsonLogicCustomOperators.test.js

import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

describe('JsonLogicCustomOperators Integration Tests', () => {
  let jsonLogicCustomOperators;
  let jsonLogicEvaluationService;
  let bodyGraphService;
  let entityManager;
  let logger;

  // Helper function to get all components of an entity
  const getComponents = (entityId) => {
    const entity = entityManager.getEntityInstance(entityId);
    return entity ? entity.components : {};
  };

  beforeEach(() => {
    // Create mock logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock event dispatcher
    const eventDispatcher = {
      dispatch: jest.fn(),
    };

    entityManager = new SimpleEntityManager();
    bodyGraphService = new BodyGraphService({
      logger,
      entityManager,
      eventDispatcher,
    });
    // Create mock lighting state service
    const lightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicEvaluationService = new JsonLogicEvaluationService({ logger });
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService,
      entityManager,
      lightingStateService,
    });

    // Register the custom operators
    jsonLogicCustomOperators.registerOperators(jsonLogicEvaluationService);
  });

  describe('hasPartOfType operator', () => {
    it('should find arms when character has arms in body graph', () => {
      // Create a character entity
      const characterId = 'test-character';
      const torsoId = 'torso-1';
      const leftArmId = 'left-arm-1';
      const rightArmId = 'right-arm-1';

      // Add components to create entities
      entityManager.addComponent(characterId, 'core:name', {
        text: 'Test Character',
      });

      entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
      entityManager.addComponent(torsoId, 'core:name', { text: 'torso' });

      entityManager.addComponent(leftArmId, 'anatomy:part', { subType: 'arm' });
      entityManager.addComponent(leftArmId, 'core:name', { text: 'left arm' });
      entityManager.addComponent(leftArmId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'left_shoulder',
      });

      entityManager.addComponent(rightArmId, 'anatomy:part', {
        subType: 'arm',
      });
      entityManager.addComponent(rightArmId, 'core:name', {
        text: 'right arm',
      });
      entityManager.addComponent(rightArmId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'right_shoulder',
      });

      // Add anatomy:body component to character
      entityManager.addComponent(characterId, 'anatomy:body', {
        recipeId: 'test_recipe',
        body: {
          root: torsoId,
          parts: {
            torso: torsoId,
            'left arm': leftArmId,
            'right arm': rightArmId,
          },
        },
      });

      // Create evaluation context
      const context = {
        actor: {
          id: characterId,
          components: getComponents(characterId),
        },
      };

      // Test hasPartOfType for arms
      const result = jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['actor', 'arm'] },
        context
      );

      expect(result).toBe(true);
    });

    it('should return false when character has no arms', () => {
      // Create a character entity without arms
      const characterId = 'armless-character';
      const torsoId = 'torso-2';

      entityManager.addComponent(characterId, 'core:name', {
        text: 'Armless Character',
      });

      entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
      entityManager.addComponent(torsoId, 'core:name', { text: 'torso' });

      // Add anatomy:body component without arms
      entityManager.addComponent(characterId, 'anatomy:body', {
        recipeId: 'test_recipe',
        body: {
          root: torsoId,
          parts: {
            torso: torsoId,
          },
        },
      });

      const context = {
        actor: {
          id: characterId,
          components: getComponents(characterId),
        },
      };

      const result = jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['actor', 'arm'] },
        context
      );

      expect(result).toBe(false);
    });

    it('should handle entity with no anatomy:body component', () => {
      const characterId = 'no-body-character';
      entityManager.addComponent(characterId, 'core:name', {
        text: 'No Body Character',
      });

      const context = {
        actor: {
          id: characterId,
          components: getComponents(characterId),
        },
      };

      const result = jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['actor', 'arm'] },
        context
      );

      expect(result).toBe(false);
    });

    it('should find multiple part types correctly', () => {
      const characterId = 'full-body-character';
      const torsoId = 'torso-4';
      const headId = 'head-4';
      const leftLegId = 'left-leg-4';

      entityManager.addComponent(characterId, 'core:name', {
        text: 'Full Body Character',
      });

      entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
      entityManager.addComponent(torsoId, 'core:name', { text: 'torso' });

      entityManager.addComponent(headId, 'anatomy:part', { subType: 'head' });
      entityManager.addComponent(headId, 'core:name', { text: 'head' });
      entityManager.addComponent(headId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'neck',
      });

      entityManager.addComponent(leftLegId, 'anatomy:part', { subType: 'leg' });
      entityManager.addComponent(leftLegId, 'core:name', { text: 'left leg' });
      entityManager.addComponent(leftLegId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'left_hip',
      });

      entityManager.addComponent(characterId, 'anatomy:body', {
        recipeId: 'test_recipe',
        body: {
          root: torsoId,
          parts: {
            torso: torsoId,
            head: headId,
            'left leg': leftLegId,
          },
        },
      });

      const context = {
        actor: {
          id: characterId,
          components: getComponents(characterId),
        },
      };

      // Should find head
      expect(
        jsonLogicEvaluationService.evaluate(
          { hasPartOfType: ['actor', 'head'] },
          context
        )
      ).toBe(true);

      // Should find leg
      expect(
        jsonLogicEvaluationService.evaluate(
          { hasPartOfType: ['actor', 'leg'] },
          context
        )
      ).toBe(true);

      // Should not find arm
      expect(
        jsonLogicEvaluationService.evaluate(
          { hasPartOfType: ['actor', 'arm'] },
          context
        )
      ).toBe(false);
    });
  });

  describe('Cache building behavior', () => {
    it('should build cache automatically when searching for parts', () => {
      const characterId = 'cache-test-character';
      const torsoId = 'torso-7';
      const armId = 'arm-7';

      entityManager.addComponent(characterId, 'core:name', {
        text: 'Test Character',
      });

      entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
      entityManager.addComponent(torsoId, 'core:name', { text: 'torso' });

      entityManager.addComponent(armId, 'anatomy:part', { subType: 'arm' });
      entityManager.addComponent(armId, 'core:name', { text: 'left arm' });
      entityManager.addComponent(armId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'left_shoulder',
      });

      entityManager.addComponent(characterId, 'anatomy:body', {
        recipeId: 'test_recipe',
        body: {
          root: torsoId,
          parts: {
            torso: torsoId,
            'left arm': armId,
          },
        },
      });

      const context = {
        actor: {
          id: characterId,
          components: getComponents(characterId),
        },
      };

      // Spy on buildAdjacencyCache to ensure it's called
      const buildCacheSpy = jest.spyOn(bodyGraphService, 'buildAdjacencyCache');

      // First call should build the cache
      jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['actor', 'arm'] },
        context
      );

      expect(buildCacheSpy).toHaveBeenCalledWith(torsoId);
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);

      // Reset spy count
      buildCacheSpy.mockClear();

      // Second call should also call buildAdjacencyCache (idempotent)
      jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['actor', 'arm'] },
        context
      );

      expect(buildCacheSpy).toHaveBeenCalledWith(torsoId);
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);

      buildCacheSpy.mockRestore();
    });
  });

  describe('Reproduction of the Iker Aguirre issue', () => {
    it('should find arms for a character with a recipe-generated body structure', () => {
      // This test reproduces the exact structure that was failing for Iker
      const characterId = 'p_erotica:iker_aguirre_instance';
      const torsoId = 'fb176e4b-3710-4471-8ff5-0ff176c2aa04';
      const leftArmId = '8a1b2c3d-4e5f-6789-0abc-def123456789';
      const rightArmId = '9b2c3d4e-5f6a-789b-0cde-f12345678901';

      // Add the character entity with minimal components like in the original
      entityManager.addComponent(characterId, 'core:name', {
        text: 'Iker Aguirre',
      });
      entityManager.addComponent(characterId, 'anatomy:body', {
        recipeId: 'p_erotica:iker_aguirre_recipe',
        body: {
          root: torsoId,
          parts: {
            torso: torsoId,
            head: '37050d90-0dcb-495e-8a25-9d004960e5eb',
            'left arm': leftArmId,
            'right arm': rightArmId,
          },
        },
      });

      // Create the body parts that should exist based on the recipe
      entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
      entityManager.addComponent(torsoId, 'core:name', { text: 'torso' });

      entityManager.addComponent(leftArmId, 'anatomy:part', { subType: 'arm' });
      entityManager.addComponent(leftArmId, 'core:name', { text: 'left arm' });
      entityManager.addComponent(leftArmId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'left_shoulder',
      });

      entityManager.addComponent(rightArmId, 'anatomy:part', {
        subType: 'arm',
      });
      entityManager.addComponent(rightArmId, 'core:name', {
        text: 'right arm',
      });
      entityManager.addComponent(rightArmId, 'anatomy:joint', {
        parentId: torsoId,
        socketId: 'right_shoulder',
      });

      // Create the same context structure as in the error log
      const context = {
        entity: {
          id: characterId,
          components: getComponents(characterId),
        },
        actor: {
          id: 'p_erotica:amaia_castillo_instance',
          components: {},
        },
        location: {
          id: 'p_erotica:outside_tables_coffee_shop_instance',
          components: {},
        },
      };

      // This is the exact check that was failing
      const result = jsonLogicEvaluationService.evaluate(
        { hasPartOfType: ['entity', 'arm'] },
        context
      );

      expect(result).toBe(true);
    });
  });
});
