/**
 * @file Integration tests for giant spider anatomy generation
 * Tests the complete workflow of generating spider anatomy with specific subType values
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';

describe('Giant Spider Anatomy Generation', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let anatomyGenerationService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    anatomyGenerationService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  afterEach(() => {
    if (testBed && testBed.cleanup) {
      testBed.cleanup();
    }
  });

  describe('subType Validation', () => {
    it('should succeed with correctly matching subType values', async () => {
      // Test validates that spider entity subTypes correctly match recipe partTypes
      // Create a test entity
      const spider = await testBed.createActor({
        recipeId: 'anatomy:giant_forest_spider',
      });

      // Generate spider anatomy - should succeed
      const result = await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

      // Verify anatomy was successfully generated
      expect(result).toBe(true);
    });

    it('should generate complete spider anatomy with correct part counts', async () => {
      // Validates complete spider anatomy generation with all expected parts
      // Create a test entity
      const spider = await testBed.createActor({
        recipeId: 'anatomy:giant_forest_spider',
      });

      // Generate spider anatomy
      const result = await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

      // Verify anatomy was created
      expect(result).toBe(true);

      // Verify spider has anatomy:body component
      const bodyComponent = testBed.entityManager.getComponentData(spider.id, 'anatomy:body');
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.parts).toBeDefined();
      expect(Object.keys(bodyComponent.body.parts).length).toBeGreaterThan(0);

      // Verify spider has correct number of legs (8)
      const legParts = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_leg';
        }
      );
      expect(legParts).toHaveLength(8);

      // Verify spider has pedipalps (2)
      const pedipalpParts = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_pedipalp';
        }
      );
      expect(pedipalpParts).toHaveLength(2);

      // Verify spider has abdomen (1)
      const abdomenParts = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_abdomen';
        }
      );
      expect(abdomenParts).toHaveLength(1);

      // Verify spider has cephalothorax (1)
      const cephalothoraxParts = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_cephalothorax';
        }
      );
      expect(cephalothoraxParts).toHaveLength(1);
    });

    it('should handle optional slots correctly (spinnerets)', async () => {
      // Test that optional spinnerets are created
      const spider = await testBed.createActor({
        recipeId: 'anatomy:giant_forest_spider',
      });

      const result = await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

      expect(result).toBe(true);

      // Verify spider has spinnerets (if specified in recipe)
      const bodyComponent = testBed.entityManager.getComponentData(spider.id, 'anatomy:body');
      const spinneretParts = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spinneret';
        }
      );

      // Spinnerets are optional, so should be 0 or 1
      expect(spinneretParts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Entity Selection with Specific subTypes', () => {
    it('should select spider-specific entities based on partType', async () => {
      const spider = await testBed.createActor({
        recipeId: 'anatomy:giant_forest_spider',
      });

      await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

      // Verify that spider_leg entities were selected (not human_leg or other leg types)
      const bodyComponent = testBed.entityManager.getComponentData(spider.id, 'anatomy:body');
      const legPartIds = Object.values(bodyComponent.body.parts).filter(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_leg';
        }
      );

      // Verify all legs have the spider_leg entity definition ID
      legPartIds.forEach(partId => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        // Entity should have been created from anatomy:spider_leg definition
        expect(partEntity).toBeDefined();
        const partComponent = partEntity.getComponentData('anatomy:part');
        expect(partComponent).toBeDefined();
        expect(partComponent.subType).toBe('spider_leg');
      });
    });
  });

  describe('Socket Compatibility', () => {
    it('should verify socket allowedTypes match entity subTypes', async () => {
      const spider = await testBed.createActor({
        recipeId: 'anatomy:giant_forest_spider',
      });

      await anatomyGenerationService.generateAnatomyIfNeeded(spider.id);

      // Get the cephalothorax entity (root body part)
      const bodyComponent = testBed.entityManager.getComponentData(spider.id, 'anatomy:body');
      const cephalothoraxPartId = Object.values(bodyComponent.body.parts).find(
        partId => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === 'spider_cephalothorax';
        }
      );

      expect(cephalothoraxPartId).toBeDefined();

      const cephalothoraxEntity = testBed.entityManager.getEntityInstance(cephalothoraxPartId);
      const socketsComponent = cephalothoraxEntity.getComponentData('anatomy:sockets');

      expect(socketsComponent).toBeDefined();
      expect(socketsComponent.sockets).toBeDefined();

      // Verify leg sockets allow "spider_leg" type
      const legSockets = socketsComponent.sockets.filter(s => s.id.startsWith('leg_'));
      expect(legSockets).toHaveLength(8);
      legSockets.forEach(socket => {
        expect(socket.allowedTypes).toContain('spider_leg');
      });

      // Verify pedipalp sockets allow "spider_pedipalp" type
      const pedipalpSockets = socketsComponent.sockets.filter(s => s.id.includes('pedipalp'));
      expect(pedipalpSockets.length).toBeGreaterThanOrEqual(2); // At least 2 pedipalp sockets
      pedipalpSockets.forEach(socket => {
        expect(socket.allowedTypes).toContain('spider_pedipalp');
      });

      // Verify abdomen socket allows "spider_abdomen" type
      const abdomenSocket = socketsComponent.sockets.find(s => s.id === 'abdomen');
      expect(abdomenSocket).toBeDefined();
      expect(abdomenSocket.allowedTypes).toContain('spider_abdomen');
    });
  });
});
