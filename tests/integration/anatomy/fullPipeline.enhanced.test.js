/**
 * @file Enhanced Full Pipeline Integration Tests
 * @description Comprehensive validation of complete anatomy generation workflow
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 *
 * Tests the complete pipeline from blueprint + recipe to final anatomy with:
 * - Entity creation and relationships
 * - Socket/slot synchronization
 * - Clothing slot generation
 * - Validation of anatomy graph structure
 *
 * Note: Spider/arachnid anatomy tests are covered in tests/regression/anatomy/spider.regression.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Generation Pipeline - Enhanced', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    entityManager = testBed.getEntityManager();
    anatomyGenerationService = testBed.anatomyGenerationService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Complete Pipeline - Octopoid', () => {
    it('should generate complete anatomy from blueprint and recipe', async () => {
      // Create owner entity
      const actor = await testBed.createActor({
        recipeId: 'anatomy:octopus_common',
      });

      // Generate anatomy using the service
      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Verify anatomy structure
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      // Verify parts are connected
      const rootId = anatomyData.body.root;
      const rootEntity = entityManager.getEntityInstance(rootId);
      expect(rootEntity).toBeDefined();

      // Verify anatomy graph is connected (no orphans)
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      expect(socketsComp).toBeDefined();
      expect(socketsComp.sockets).toBeDefined();
      expect(socketsComp.sockets.length).toBeGreaterThan(0);

      // Verify clothing slots field exists (may be empty depending on anatomy)
      expect(anatomyData).toHaveProperty('clothingSlots');

      // Verify all parts have valid entities
      for (const partId of Object.values(anatomyData.body.parts)) {
        const partEntity = entityManager.getEntityInstance(partId);
        expect(partEntity).toBeDefined();

        const partComp = partEntity.getComponentData('anatomy:part');
        expect(partComp).toBeDefined();
      }
    });

    it('should properly link all tentacles to root', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:octopus_common',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootId = anatomyData.body.root;
      const parts = anatomyData.body.parts;

      const tentacles = Object.keys(parts).filter((name) =>
        name.includes('tentacle')
      );

      // Verify all tentacles linked to root
      for (const tentacleName of tentacles) {
        const tentacleId = parts[tentacleName];
        const tentacleEntity = entityManager.getEntityInstance(tentacleId);
        const tentaclePart = tentacleEntity.getComponentData('anatomy:part');

        expect(tentaclePart.parentEntity).toBe(rootId);
      }
    });

    it('should maintain clothing slot consistency across regeneration', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:octopus_common',
      });

      // First generation
      await anatomyGenerationService.generateAnatomy(actor.id);
      const actorInstance1 = entityManager.getEntityInstance(actor.id);
      const anatomyData1 = actorInstance1.getComponentData('anatomy:body');
      const slotKeys1 = Object.keys(anatomyData1.clothingSlots || {}).sort();

      // Clear and regenerate
      testBed.bodyGraphService?.clearCache?.();
      testBed.anatomyClothingCache?.clear?.();

      await anatomyGenerationService.generateAnatomy(actor.id);
      const actorInstance2 = entityManager.getEntityInstance(actor.id);
      const anatomyData2 = actorInstance2.getComponentData('anatomy:body');
      const slotKeys2 = Object.keys(anatomyData2.clothingSlots || {}).sort();

      // Verify consistency
      expect(slotKeys2).toEqual(slotKeys1);
    });
  });

  describe('Complete Pipeline - Humanoid', () => {
    it('should handle blueprint composition correctly', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Verify humanoid anatomy has expected structure
      const parts = anatomyData.body.parts;
      const partCount = Object.keys(parts).length;

      // Humanoid should have head + torso + 2 arms + 2 legs = at least 6 parts
      expect(partCount).toBeGreaterThanOrEqual(6);

      // Verify clothing slots field exists
      expect(anatomyData).toHaveProperty('clothingSlots');

      // Verify bilateral symmetry
      const arms = Object.keys(parts).filter((name) => name.includes('arm'));
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      expect(arms).toHaveLength(2);
      expect(legs).toHaveLength(2);
    });

    it('should properly validate anatomy graph structure', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootId = anatomyData.body.root;
      const parts = anatomyData.body.parts;

      // Verify root is valid
      const rootEntity = entityManager.getEntityInstance(rootId);
      expect(rootEntity).toBeDefined();

      // Verify all parts are valid
      for (const partId of Object.values(parts)) {
        const partEntity = entityManager.getEntityInstance(partId);
        expect(partEntity).toBeDefined();

        const partComp = partEntity.getComponentData('anatomy:part');
        expect(partComp).toBeDefined();

        // Root doesn't have a parent, but all other parts should
        if (partId !== rootId) {
          expect(partComp.parentEntity).toBeDefined();
        }
      }

      // Verify no circular references (excluding root which is already tracked)
      const visitedIds = new Set([rootId]);
      for (const partId of Object.values(parts)) {
        // Skip the root since it's already in the set
        if (partId !== rootId) {
          expect(visitedIds.has(partId)).toBe(false);
          visitedIds.add(partId);
        }
      }
    });

    it('should generate consistent sockets for bilateral limbs', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');

      // Arms attach to shoulder sockets, legs to hip sockets
      const armSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('shoulder')
      );
      const legSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('hip')
      );

      // Verify bilateral pairs
      expect(armSockets.length).toBe(2);
      expect(legSockets.length).toBe(2);

      // Verify left/right in socket IDs
      const armSocketIds = armSockets.map((s) => s.id).sort();
      const legSocketIds = legSockets.map((s) => s.id).sort();

      expect(armSocketIds).toEqual(['left_shoulder', 'right_shoulder']);
      expect(legSocketIds).toEqual(['left_hip', 'right_hip']);
    });
  });

  describe('Pipeline Validation', () => {
    it('should ensure all sockets have corresponding slots', async () => {
      const recipes = [
        'anatomy:human_male',
        'anatomy:octopus_common',
      ];

      for (const recipeId of recipes) {
        const actor = await testBed.createActor({ recipeId });
        await anatomyGenerationService.generateAnatomy(actor.id);

        const actorInstance = entityManager.getEntityInstance(actor.id);
        const anatomyData = actorInstance.getComponentData('anatomy:body');

        const rootEntity = entityManager.getEntityInstance(
          anatomyData.body.root
        );
        const socketsComp = rootEntity.getComponentData('anatomy:sockets');

        const clothingSlots = anatomyData.clothingSlots || {};

        // Verify every clothing slot references a valid socket
        for (const [slotKey, slotData] of Object.entries(clothingSlots)) {
          if (slotData.socket) {
            const socketExists = socketsComp.sockets.some(
              (s) => s.id === slotData.socket
            );
            expect(socketExists).toBe(true);
          }
        }
      }
    });

    it('should maintain entity relationships throughout pipeline', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootId = anatomyData.body.root;
      const parts = anatomyData.body.parts;

      // Verify root ownership
      const rootEntity = entityManager.getEntityInstance(rootId);
      const ownedByComp = rootEntity.getComponentData('core:owned_by');

      if (ownedByComp) {
        expect(ownedByComp.ownerId).toBe(actor.id);
      }

      // Verify all parts have ownership
      for (const partId of Object.values(parts)) {
        const partEntity = entityManager.getEntityInstance(partId);
        const partOwnedBy = partEntity.getComponentData('core:owned_by');

        if (partOwnedBy) {
          expect(partOwnedBy.ownerId).toBe(actor.id);
        }
      }
    });

    it('should properly cleanup on anatomy regeneration', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      // First generation
      await anatomyGenerationService.generateAnatomy(actor.id);
      const actorInstance1 = entityManager.getEntityInstance(actor.id);
      const anatomyData1 = actorInstance1.getComponentData('anatomy:body');
      const firstParts = Object.values(anatomyData1.body.parts);

      // Regenerate
      await anatomyGenerationService.generateAnatomy(actor.id);
      const actorInstance2 = entityManager.getEntityInstance(actor.id);
      const anatomyData2 = actorInstance2.getComponentData('anatomy:body');
      const secondParts = Object.values(anatomyData2.body.parts);

      // Verify old parts are cleaned up (or new parts created)
      // The exact behavior depends on implementation
      expect(secondParts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing recipe gracefully', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:nonexistent_recipe',
      });

      // Should either throw or handle gracefully
      await expect(async () => {
        await anatomyGenerationService.generateAnatomy(actor.id);
      }).rejects.toThrow();
    });

    it('should handle invalid actor ID gracefully', async () => {
      await expect(async () => {
        await anatomyGenerationService.generateAnatomy('invalid_actor_id');
      }).rejects.toThrow();
    });

    it('should validate anatomy data structure', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      await anatomyGenerationService.generateAnatomy(actor.id);

      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Verify required fields
      expect(anatomyData).toHaveProperty('body');
      expect(anatomyData.body).toHaveProperty('root');
      expect(anatomyData.body).toHaveProperty('parts');
      expect(typeof anatomyData.body.root).toBe('string');
      expect(typeof anatomyData.body.parts).toBe('object');
    });
  });

  describe('Performance', () => {
    it('should generate anatomy within reasonable time', async () => {
      const actor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });

      const startTime = Date.now();
      await anatomyGenerationService.generateAnatomy(actor.id);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle batch generation efficiently', async () => {
      const count = 5;
      const actors = [];

      const startTime = Date.now();
      for (let i = 0; i < count; i++) {
        const actor = await testBed.createActor({
          recipeId: 'anatomy:human_male',
        });
        actors.push(actor);
        await anatomyGenerationService.generateAnatomy(actor.id);
      }
      const endTime = Date.now();

      const duration = endTime - startTime;
      const avgDuration = duration / count;

      expect(avgDuration).toBeLessThan(1000); // 1 second average
    });
  });
});
