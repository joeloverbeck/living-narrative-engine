/**
 * @file Integration tests for giant spider anatomy generation
 * Tests the complete workflow of generating spider anatomy with specific subType values
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Giant Spider Anatomy Generation', () => {
  let testBed;
  let anatomyGenerationService;
  let entityManager;
  let dataRegistry;

  beforeEach(async () => {
    testBed = createTestBed();

    // Get required services
    anatomyGenerationService = testBed.get('IAnatomyGenerationService');
    entityManager = testBed.get('IEntityManager');
    dataRegistry = testBed.get('IDataRegistry');

    // Ensure anatomy mod data is loaded
    await dataRegistry.loadModData('anatomy');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('subType Validation', () => {
    it('should fail with mismatched subType values (reproducing current bug)', async () => {
      // This test reproduces the current bug where entity subType doesn't match recipe partType
      // Create a test entity
      const spiderId = testBed.createEntity('test_spider');

      // Attempt to generate spider anatomy
      // Expected: Should fail because spider_leg has subType="leg" but recipe requires partType="spider_leg"
      await expect(async () => {
        await anatomyGenerationService.generateForEntity(
          spiderId,
          'anatomy:giant_spider',
          'anatomy:giant_forest_spider'
        );
      }).rejects.toThrow(/No entity definitions found matching anatomy requirements/);
    });

    it('should succeed with matching subType values (after fix)', async () => {
      // This test will pass after fixing entity subType values
      // Create a test entity
      const spiderId = testBed.createEntity('test_spider');

      // Generate spider anatomy
      const result = await anatomyGenerationService.generateForEntity(
        spiderId,
        'anatomy:giant_spider',
        'anatomy:giant_forest_spider'
      );

      // Verify anatomy was created
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify spider has anatomy:body component
      const bodyComponent = entityManager.getComponent(spiderId, 'anatomy:body');
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.parts).toBeDefined();
      expect(Object.keys(bodyComponent.parts).length).toBeGreaterThan(0);

      // Verify spider has correct number of legs (8)
      const legParts = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_leg';
        }
      );
      expect(legParts).toHaveLength(8);

      // Verify spider has pedipalps (2)
      const pedipalpParts = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_pedipalp';
        }
      );
      expect(pedipalpParts).toHaveLength(2);

      // Verify spider has abdomen (1)
      const abdomenParts = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_abdomen';
        }
      );
      expect(abdomenParts).toHaveLength(1);

      // Verify spider has cephalothorax (1)
      const cephalothoraxParts = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_cephalothorax';
        }
      );
      expect(cephalothoraxParts).toHaveLength(1);
    });

    it('should handle optional slots correctly (spinnerets)', async () => {
      // Test that optional spinnerets are created
      const spiderId = testBed.createEntity('test_spider_with_spinnerets');

      const result = await anatomyGenerationService.generateForEntity(
        spiderId,
        'anatomy:giant_spider',
        'anatomy:giant_forest_spider'
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify spider has spinnerets (if specified in recipe)
      const bodyComponent = entityManager.getComponent(spiderId, 'anatomy:body');
      const spinneretParts = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spinneret';
        }
      );

      // Spinnerets are optional, so should be 0 or 1
      expect(spinneretParts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Entity Selection with Specific subTypes', () => {
    it('should select spider-specific entities based on partType', async () => {
      const spiderId = testBed.createEntity('test_spider_entity_selection');

      await anatomyGenerationService.generateForEntity(
        spiderId,
        'anatomy:giant_spider',
        'anatomy:giant_forest_spider'
      );

      // Verify that spider_leg entities were selected (not human_leg or other leg types)
      const bodyComponent = entityManager.getComponent(spiderId, 'anatomy:body');
      const legPartIds = Object.values(bodyComponent.parts).filter(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_leg';
        }
      );

      // Verify all legs have the spider_leg entity definition ID
      legPartIds.forEach(partId => {
        const partEntity = entityManager.getEntity(partId);
        // Entity should have been created from anatomy:spider_leg definition
        expect(partEntity).toBeDefined();
        expect(partEntity.components['anatomy:part']).toBeDefined();
        expect(partEntity.components['anatomy:part'].subType).toBe('spider_leg');
      });
    });
  });

  describe('Socket Compatibility', () => {
    it('should verify socket allowedTypes match entity subTypes', async () => {
      const spiderId = testBed.createEntity('test_spider_socket_compat');

      await anatomyGenerationService.generateForEntity(
        spiderId,
        'anatomy:giant_spider',
        'anatomy:giant_forest_spider'
      );

      // Get the cephalothorax entity (root body part)
      const bodyComponent = entityManager.getComponent(spiderId, 'anatomy:body');
      const cephalothoraxPartId = Object.values(bodyComponent.parts).find(
        partId => {
          const partEntity = entityManager.getEntity(partId);
          const partComponent = partEntity.components['anatomy:part'];
          return partComponent && partComponent.subType === 'spider_cephalothorax';
        }
      );

      expect(cephalothoraxPartId).toBeDefined();

      const cephalothoraxEntity = entityManager.getEntity(cephalothoraxPartId);
      const socketsComponent = cephalothoraxEntity.components['anatomy:sockets'];

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
      expect(pedipalpSockets).toHaveLength(2);
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
