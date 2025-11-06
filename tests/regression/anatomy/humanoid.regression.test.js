/**
 * @file Humanoid Regression Tests
 * @description Prevents recurrence of known failures in humanoid anatomy generation
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 *
 * Known Issues Being Tested:
 * - Bilateral symmetry issues (left/right limb mismatch)
 * - Head/torso attachment problems
 * - Clothing slot synchronization for complex humanoid bodies
 * - Gender-specific anatomy variations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Humanoid Regression Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Human Male Anatomy Generation', () => {
    it('should prevent recurrence of bilateral symmetry issues', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;

      // Check for bilateral limbs
      const arms = Object.keys(parts).filter((name) => name.includes('arm'));
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      // Verify exactly 2 arms and 2 legs
      expect(arms).toHaveLength(2);
      expect(legs).toHaveLength(2);

      // Verify left/right symmetry
      const hasLeftArm = arms.some((name) => name.includes('left'));
      const hasRightArm = arms.some((name) => name.includes('right'));
      const hasLeftLeg = legs.some((name) => name.includes('left'));
      const hasRightLeg = legs.some((name) => name.includes('right'));

      expect(hasLeftArm).toBe(true);
      expect(hasRightArm).toBe(true);
      expect(hasLeftLeg).toBe(true);
      expect(hasRightLeg).toBe(true);
    });

    it('should properly generate head attachment', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;
      const rootId = anatomyData.body.root;

      // Find head
      const heads = Object.keys(parts).filter((name) => name.includes('head'));
      expect(heads.length).toBeGreaterThan(0);

      const headId = parts[heads[0]];
      const headEntity = entityManager.getEntityInstance(headId);
      expect(headEntity).toBeDefined();

      const headPart = headEntity.getComponentData('anatomy:part');
      expect(headPart).toBeDefined();
      expect(headPart.parentEntity).toBe(rootId);
    });

    it('should maintain slot-socket synchronization for humanoid body', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Get clothing slots
      const clothingSlots = anatomyData.clothingSlots || {};
      const slotKeys = Object.keys(clothingSlots);

      // Get sockets from root
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      const socketIds = socketsComp.sockets.map((s) => s.id);

      // Verify every clothing slot has a corresponding socket
      for (const slotKey of slotKeys) {
        const slotData = clothingSlots[slotKey];
        if (slotData.socket) {
          expect(socketIds).toContain(slotData.socket);
        }
      }

      // Verify expected humanoid clothing slots exist
      expect(slotKeys.length).toBeGreaterThan(0);
    });
  });

  describe('Human Female Anatomy Generation', () => {
    it('should handle female-specific anatomy correctly', async () => {
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Verify basic structure
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      const parts = anatomyData.body.parts;

      // Verify bilateral limbs
      const arms = Object.keys(parts).filter((name) => name.includes('arm'));
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      expect(arms).toHaveLength(2);
      expect(legs).toHaveLength(2);
    });

    it('should maintain consistency across gender variations', async () => {
      const maleActor = await testBed.createActor({
        recipeId: 'anatomy:human_male',
      });
      const femaleActor = await testBed.createActor({
        recipeId: 'anatomy:human_female',
      });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      const entityManager = testBed.container.get('IEntityManager');

      await anatomyService.generateAnatomy(maleActor.id);
      await anatomyService.generateAnatomy(femaleActor.id);

      const maleInstance = entityManager.getEntityInstance(maleActor.id);
      const femaleInstance = entityManager.getEntityInstance(femaleActor.id);

      const maleAnatomy = maleInstance.getComponentData('anatomy:body');
      const femaleAnatomy = femaleInstance.getComponentData('anatomy:body');

      // Both should have same number of limbs
      const maleParts = Object.keys(maleAnatomy.body.parts);
      const femaleParts = Object.keys(femaleAnatomy.body.parts);

      const maleArms = maleParts.filter((name) => name.includes('arm'));
      const femaleArms = femaleParts.filter((name) => name.includes('arm'));
      const maleLegs = maleParts.filter((name) => name.includes('leg'));
      const femaleLegs = femaleParts.filter((name) => name.includes('leg'));

      expect(maleArms.length).toBe(femaleArms.length);
      expect(maleLegs.length).toBe(femaleLegs.length);
    });
  });

  describe('Edge Cases - Humanoid Variations', () => {
    it('should handle no duplicate limb IDs in humanoid anatomy', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;
      const partIds = Object.values(parts);

      // Verify no duplicate entity IDs
      expect(new Set(partIds).size).toBe(partIds.length);

      // Verify no duplicate part names
      const partNames = Object.keys(parts);
      expect(new Set(partNames).size).toBe(partNames.length);
    });

    it('should properly serialize and deserialize humanoid anatomy', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Serialize to JSON
      const serialized = JSON.stringify(anatomyData);
      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(0);

      // Deserialize
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toBeDefined();
      expect(deserialized.body).toBeDefined();
      expect(deserialized.body.parts).toBeDefined();

      // Verify structure maintained
      const originalParts = Object.keys(anatomyData.body.parts);
      const deserializedParts = Object.keys(deserialized.body.parts);

      expect(deserializedParts.sort()).toEqual(originalParts.sort());
    });

    it('should verify all humanoid parts are properly connected to root', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootId = anatomyData.body.root;
      const parts = anatomyData.body.parts;

      // Verify root exists
      expect(rootId).toBeDefined();

      // Verify all parts reference valid entities
      for (const [partName, partId] of Object.entries(parts)) {
        const partEntity = entityManager.getEntityInstance(partId);
        expect(partEntity).toBeDefined();

        const partComp = partEntity.getComponentData('anatomy:part');
        expect(partComp).toBeDefined();
        expect(partComp.parentEntity).toBe(rootId);
      }
    });

    it('should handle futa variation correctly', async () => {
      const recipeId = 'anatomy:human_futa';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Verify basic structure is consistent with other humanoids
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();

      const parts = anatomyData.body.parts;

      // Verify bilateral limbs
      const arms = Object.keys(parts).filter((name) => name.includes('arm'));
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      expect(arms).toHaveLength(2);
      expect(legs).toHaveLength(2);
    });
  });

  describe('Performance Regression', () => {
    it('should generate humanoid anatomy within reasonable time', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');

      const startTime = Date.now();
      await anatomyService.generateAnatomy(actor.id);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should complete in under 5 seconds (generous threshold)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple humanoid generations efficiently', async () => {
      const recipeId = 'anatomy:human_male';
      const count = 10;
      const actors = [];

      const anatomyService = testBed.container.get('AnatomyGenerationService');

      const startTime = Date.now();
      for (let i = 0; i < count; i++) {
        const actor = await testBed.createActor({ recipeId });
        actors.push(actor);
        await anatomyService.generateAnatomy(actor.id);
      }
      const endTime = Date.now();

      const duration = endTime - startTime;
      const avgDuration = duration / count;

      // Average should be reasonable (under 1 second each)
      expect(avgDuration).toBeLessThan(1000);
    });
  });

  describe('Bilateral Orientation Validation', () => {
    it('should use correct bilateral orientation for arms and legs', async () => {
      const recipeId = 'anatomy:human_male';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');

      const armSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('arm')
      );
      const legSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('leg')
      );

      // Verify we have 2 arm sockets and 2 leg sockets
      expect(armSockets.length).toBe(2);
      expect(legSockets.length).toBe(2);

      // Verify orientations are left/right
      const armOrientations = armSockets.map((s) => s.orientation);
      const legOrientations = legSockets.map((s) => s.orientation);

      expect(armOrientations.sort()).toEqual(['left', 'right']);
      expect(legOrientations.sort()).toEqual(['left', 'right']);
    });

    it('should maintain consistent orientations across multiple generations', async () => {
      const recipeId = 'anatomy:human_male';
      const count = 3;

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      const entityManager = testBed.container.get('IEntityManager');

      const allOrientations = [];

      for (let i = 0; i < count; i++) {
        const actor = await testBed.createActor({ recipeId });
        await anatomyService.generateAnatomy(actor.id);

        const actorInstance = entityManager.getEntityInstance(actor.id);
        const anatomyData = actorInstance.getComponentData('anatomy:body');
        const rootEntity = entityManager.getEntityInstance(
          anatomyData.body.root
        );
        const socketsComp = rootEntity.getComponentData('anatomy:sockets');

        const armSockets = socketsComp.sockets.filter((s) =>
          s.id.includes('arm')
        );
        const orientations = armSockets
          .map((s) => s.orientation)
          .sort()
          .join(',');

        allOrientations.push(orientations);
      }

      // All should be identical
      expect(new Set(allOrientations).size).toBe(1);
    });
  });
});
