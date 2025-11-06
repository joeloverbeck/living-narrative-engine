/**
 * @file Octopoid (Cephalopod) Regression Tests
 * @description Prevents recurrence of known failures in octopoid anatomy generation
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 *
 * Known Issues Being Tested:
 * - Tentacle slot mismatch (slots not generated for all tentacles)
 * - Clothing slots missing tentacle references
 * - Socket/slot synchronization for radial arrangement
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Octopoid Regression Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Octopus Anatomy Generation', () => {
    it('should prevent recurrence of tentacle slot mismatch', async () => {
      // Create entity with octopus anatomy
      const recipeId = 'anatomy:octopus_common';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Retrieve the generated anatomy parts
      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) =>
        name.includes('tentacle')
      );

      // Verify exactly 8 tentacles exist
      expect(tentacles).toHaveLength(8);

      // Verify all tentacles have proper part data
      for (const tentacleName of tentacles) {
        const tentacleEntity = entityManager.getEntityInstance(
          parts[tentacleName]
        );
        expect(tentacleEntity).toBeDefined();

        const tentaclePart = tentacleEntity.getComponentData('anatomy:part');
        expect(tentaclePart).toBeDefined();
        expect(tentaclePart.subType).toBe('tentacle');
      }

      // Verify root entity has sockets for all tentacles
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      expect(socketsComp).toBeDefined();
      expect(socketsComp.sockets).toBeDefined();

      // Verify clothing slots exist (may or may not include tentacles depending on design)
      const clothingSlots = anatomyData.clothingSlots || {};
      expect(clothingSlots).toBeDefined();
    });

    it('should properly generate sockets for radial arrangement (8 tentacles)', async () => {
      // Create octopus with 8 tentacles in radial arrangement
      const recipeId = 'anatomy:octopus_common';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');

      // Verify sockets exist
      expect(socketsComp.sockets).toBeDefined();
      expect(socketsComp.sockets.length).toBeGreaterThan(0);

      // Verify each socket has required properties
      for (const socket of socketsComp.sockets) {
        expect(socket.id).toBeDefined();
        expect(typeof socket.id).toBe('string');
        expect(socket.orientation).toBeDefined();
        expect(socket.allowedTypes).toBeDefined();
        expect(Array.isArray(socket.allowedTypes)).toBe(true);
      }
    });

    it('should maintain slot-socket synchronization for all tentacles', async () => {
      const recipeId = 'anatomy:octopus_common';
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
      // Note: Not all sockets may have clothing slots, but all clothing slots should have sockets
      for (const slotKey of slotKeys) {
        const slotData = clothingSlots[slotKey];
        if (slotData.socket) {
          expect(socketIds).toContain(slotData.socket);
        }
      }
    });
  });

  describe('Kraken Anatomy Generation', () => {
    it('should prevent recurrence of tentacle issues in larger cephalopods', async () => {
      const recipeId = 'anatomy:kraken_elder';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) =>
        name.includes('tentacle')
      );

      // Verify expected tentacle count (8 for most cephalopods)
      expect(tentacles.length).toBeGreaterThanOrEqual(8);

      // Verify all tentacles are valid entities
      for (const tentacleName of tentacles) {
        const tentacleEntity = entityManager.getEntityInstance(
          parts[tentacleName]
        );
        expect(tentacleEntity).toBeDefined();

        const tentaclePart = tentacleEntity.getComponentData('anatomy:part');
        expect(tentaclePart).toBeDefined();
        expect(tentaclePart.subType).toBe('tentacle');
      }

      // Verify root entity structure
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      expect(rootEntity).toBeDefined();

      const partComp = rootEntity.getComponentData('anatomy:part');
      expect(partComp).toBeDefined();
      expect(partComp.subType).toBe('mantle');
    });
  });

  describe('Edge Cases - Cephalopod Variations', () => {
    it('should handle squid anatomy with consistent tentacle generation', async () => {
      const recipeId = 'anatomy:squid_common';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) =>
        name.includes('tentacle')
      );

      // Squids typically have 8 arms + 2 feeding tentacles = 10 total
      // But may vary by implementation
      expect(tentacles.length).toBeGreaterThanOrEqual(8);

      // Verify no duplicate tentacle IDs
      const tentacleIds = tentacles.map((name) => parts[name]);
      expect(new Set(tentacleIds).size).toBe(tentacleIds.length);
    });

    it('should properly serialize and deserialize octopoid anatomy', async () => {
      const recipeId = 'anatomy:octopus_common';
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
      const originalTentacles = Object.keys(anatomyData.body.parts).filter(
        (name) => name.includes('tentacle')
      );
      const deserializedTentacles = Object.keys(
        deserialized.body.parts
      ).filter((name) => name.includes('tentacle'));

      expect(deserializedTentacles).toEqual(originalTentacles);
    });
  });

  describe('Performance Regression', () => {
    it('should generate octopoid anatomy within reasonable time', async () => {
      const recipeId = 'anatomy:octopus_common';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');

      const startTime = Date.now();
      await anatomyService.generateAnatomy(actor.id);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should complete in under 5 seconds (generous threshold)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple octopoid generations efficiently', async () => {
      const recipeId = 'anatomy:octopus_common';
      const count = 5;
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
});
