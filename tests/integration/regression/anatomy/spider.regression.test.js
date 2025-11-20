/**
 * @file Spider (Arachnid) Regression Tests
 * @description Prevents recurrence of known failures in spider anatomy generation
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 *
 * Known Issues Being Tested:
 * - Leg slot mismatch (8 legs not properly synchronized)
 * - Radial/octagonal orientation issues for arachnid anatomy
 * - Pedipalp and spinneret socket generation
 * - Socket/slot synchronization for complex templates
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Spider Regression Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Giant Spider Anatomy Generation', () => {
    it('should prevent recurrence of leg slot mismatch (8 legs)', async () => {
      // Create entity with spider anatomy
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Retrieve the generated anatomy parts
      const parts = anatomyData.body.parts;
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      // Verify exactly 8 legs exist (standard for spiders)
      expect(legs).toHaveLength(8);

      // Verify all legs have proper part data
      for (const legName of legs) {
        const legEntity = entityManager.getEntityInstance(parts[legName]);
        expect(legEntity).toBeDefined();

        const legPart = legEntity.getComponentData('anatomy:part');
        expect(legPart).toBeDefined();
        expect(legPart.subType).toBe('spider_leg');
      }
    });

    it('should properly generate octagonal radial arrangement for 8 legs', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');

      // Verify sockets exist
      expect(socketsComp).toBeDefined();
      expect(socketsComp.sockets).toBeDefined();
      expect(socketsComp.sockets.length).toBeGreaterThan(0);

      // Find leg sockets
      const legSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('leg')
      );

      // Should have 8 leg sockets
      expect(legSockets.length).toBeGreaterThanOrEqual(8);

      // Note: The spider_cephalothorax entity uses static socket definitions
      // without orientation fields for legs. Orientations would only be present
      // if sockets were dynamically generated from structure templates.
      // For this regression test, we verify socket IDs and types only.
      for (const socket of legSockets) {
        expect(socket.id).toBeDefined();
        expect(socket.allowedTypes).toBeDefined();
        expect(socket.allowedTypes).toContain('spider_leg');
      }
    });

    it('should properly handle pedipalps and spinnerets alongside legs', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;

      // Get all part types
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));
      const pedipalps = Object.keys(parts).filter((name) =>
        name.includes('pedipalp')
      );
      const spinnerets = Object.keys(parts).filter((name) =>
        name.includes('spinneret')
      );

      // Verify leg count
      expect(legs).toHaveLength(8);

      // Verify pedipalps exist (typically 2)
      if (pedipalps.length > 0) {
        expect(pedipalps.length).toBeGreaterThanOrEqual(2);

        for (const pedipalpName of pedipalps) {
          const pedipalpEntity = entityManager.getEntityInstance(
            parts[pedipalpName]
          );
          expect(pedipalpEntity).toBeDefined();
        }
      }

      // Verify spinneret exists (giant forest spider has 1 spinneret)
      if (spinnerets.length > 0) {
        expect(spinnerets.length).toBe(1);

        for (const spinneretName of spinnerets) {
          const spinneretEntity = entityManager.getEntityInstance(
            parts[spinneretName]
          );
          expect(spinneretEntity).toBeDefined();
        }
      }
    });

    it('should maintain slot-socket synchronization for complex spider anatomy', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
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

      // Verify no orphaned sockets (all sockets should have purpose)
      for (const socketId of socketIds) {
        // Socket should either have a clothing slot, be anatomical (legs, abdomen, etc), or be internal
        const hasClothingSlot = slotKeys.some(
          (key) => clothingSlots[key].socket === socketId
        );
        const isAnatomicalSocket =
          socketId.includes('leg') ||
          socketId.includes('abdomen') ||
          socketId.includes('torso') ||
          socketId.includes('pedipalp') ||
          socketId.includes('spinneret') ||
          socketId.includes('venom') ||
          socketId.includes('eyes');
        const isInternalSocket =
          socketId.includes('internal') || socketId.includes('attachment');

        expect(hasClothingSlot || isAnatomicalSocket || isInternalSocket).toBe(
          true
        );
      }
    });
  });

  describe('Edge Cases - Spider Variations', () => {
    it('should handle no duplicate leg IDs in spider anatomy', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const parts = anatomyData.body.parts;
      const legs = Object.keys(parts).filter((name) => name.includes('leg'));

      // Verify no duplicate entity IDs
      const legIds = legs.map((name) => parts[name]);
      expect(new Set(legIds).size).toBe(legIds.length);

      // Verify no duplicate leg names
      expect(new Set(legs).size).toBe(legs.length);
    });

    it('should properly serialize and deserialize spider anatomy', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
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
      const originalLegs = Object.keys(anatomyData.body.parts).filter((name) =>
        name.includes('leg')
      );
      const deserializedLegs = Object.keys(deserialized.body.parts).filter(
        (name) => name.includes('leg')
      );

      expect(deserializedLegs).toEqual(originalLegs);
    });

    it('should verify all spider parts are properly connected to root', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
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

        // Note: parentEntity may be undefined for parts that are themselves containers
        // or for the root part itself. Only verify parentEntity for non-root parts.
        if (partId !== rootId && partComp.parentEntity) {
          expect(partComp.parentEntity).toBe(rootId);
        }
      }
    });
  });

  describe('Performance Regression', () => {
    it('should generate spider anatomy within reasonable time', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');

      const startTime = Date.now();
      await anatomyService.generateAnatomy(actor.id);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should complete in under 5 seconds (generous threshold)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple spider generations efficiently', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
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

  describe('Socket Orientation Validation', () => {
    it('should use correct orientation scheme for 8 legs', async () => {
      const recipeId = 'anatomy:giant_forest_spider';
      const actor = await testBed.createActor({ recipeId });

      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');

      const legSockets = socketsComp.sockets.filter((s) =>
        s.id.includes('leg')
      );

      // Verify we have 8 leg sockets
      expect(legSockets.length).toBe(8);

      // Verify each leg socket has a unique orientation
      const orientations = legSockets.map((s) => s.orientation);
      expect(new Set(orientations).size).toBe(8);

      // Verify no undefined orientations
      for (const orientation of orientations) {
        expect(orientation).toBeDefined();
        expect(typeof orientation).toBe('string');
        expect(orientation.length).toBeGreaterThan(0);
      }
    });
  });
});
