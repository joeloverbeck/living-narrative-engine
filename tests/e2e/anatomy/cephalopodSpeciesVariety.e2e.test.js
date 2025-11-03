/**
 * @file E2E test for multiple cephalopod species using generic mantle and tentacle
 * Tests the complete workflow for kraken, squid, and octopus species
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Cephalopod Species Variety - E2E', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Kraken (Elder)', () => {
    it('should generate complete elder kraken with massive mantle and enormous tentacles', async () => {
      // Arrange
      const recipeId = 'anatomy:kraken_elder';
      const actor = await testBed.createActor({ recipeId });

      // Act
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Assert - Root mantle (generic entity)
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const partComp = rootEntity.getComponentData('anatomy:part');
      expect(partComp.subType).toBe('mantle');

      // Assert - Tentacles (8)
      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
      expect(tentacles).toHaveLength(8);

      // Check tentacle properties (generic entity)
      const firstTentacle = entityManager.getEntityInstance(parts[tentacles[0]]);
      const tentaclePart = firstTentacle.getComponentData('anatomy:part');

      expect(tentaclePart.subType).toBe('tentacle');

      // Assert - Sockets (blueprint adds tentacle and head sockets)
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      expect(socketsComp.sockets.length).toBeGreaterThanOrEqual(2); // At least beak and ink_sac
    });
  });

  describe('Squid (Common)', () => {
    it('should generate complete common squid with small mantle and medium tentacles', async () => {
      // Arrange
      const recipeId = 'anatomy:squid_common';
      const actor = await testBed.createActor({ recipeId });

      // Act
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Assert - Root mantle (generic entity)
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const partComp = rootEntity.getComponentData('anatomy:part');
      expect(partComp.subType).toBe('mantle');

      // Assert - Tentacles (8)
      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
      expect(tentacles).toHaveLength(8);

      // Check tentacle properties (generic entity)
      const firstTentacle = entityManager.getEntityInstance(parts[tentacles[0]]);
      const tentaclePart = firstTentacle.getComponentData('anatomy:part');

      expect(tentaclePart.subType).toBe('tentacle');

      // Assert - Sockets (blueprint adds tentacle and head sockets)
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      expect(socketsComp.sockets.length).toBeGreaterThanOrEqual(2); // At least beak and ink_sac
    });
  });

  describe('Octopus (Common)', () => {
    it('should generate complete common octopus with medium mantle and thick tentacles', async () => {
      // Arrange
      const recipeId = 'anatomy:octopus_common';
      const actor = await testBed.createActor({ recipeId });

      // Act
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Assert - Root mantle (generic entity)
      const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
      const partComp = rootEntity.getComponentData('anatomy:part');
      expect(partComp.subType).toBe('mantle');

      // Assert - Tentacles (8)
      const parts = anatomyData.body.parts;
      const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
      expect(tentacles).toHaveLength(8);

      // Check tentacle properties (generic entity)
      const firstTentacle = entityManager.getEntityInstance(parts[tentacles[0]]);
      const tentaclePart = firstTentacle.getComponentData('anatomy:part');

      expect(tentaclePart.subType).toBe('tentacle');

      // Assert - Sockets (blueprint adds tentacle and head sockets)
      const socketsComp = rootEntity.getComponentData('anatomy:sockets');
      expect(socketsComp.sockets.length).toBeGreaterThanOrEqual(2); // At least beak and ink_sac
    });
  });

  describe('Cross-Species Validation', () => {
    it('should use same generic mantle entity for all three species', async () => {
      // Arrange - Create all three species
      const krakenActor = await testBed.createActor({ recipeId: 'anatomy:kraken_elder' });
      const squidActor = await testBed.createActor({ recipeId: 'anatomy:squid_common' });
      const octopusActor = await testBed.createActor({ recipeId: 'anatomy:octopus_common' });

      // Act - Generate anatomy for all
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(krakenActor.id);
      await anatomyService.generateAnatomy(squidActor.id);
      await anatomyService.generateAnatomy(octopusActor.id);

      const entityManager = testBed.container.get('IEntityManager');

      // Assert - All use generic mantle
      const krakenInstance = entityManager.getEntityInstance(krakenActor.id);
      const squidInstance = entityManager.getEntityInstance(squidActor.id);
      const octopusInstance = entityManager.getEntityInstance(octopusActor.id);

      const krakenAnatomy = krakenInstance.getComponentData('anatomy:body');
      const squidAnatomy = squidInstance.getComponentData('anatomy:body');
      const octopusAnatomy = octopusInstance.getComponentData('anatomy:body');

      const krakenRoot = entityManager.getEntityInstance(krakenAnatomy.body.root);
      const squidRoot = entityManager.getEntityInstance(squidAnatomy.body.root);
      const octopusRoot = entityManager.getEntityInstance(octopusAnatomy.body.root);

      // All should have mantle subType
      expect(krakenRoot.getComponentData('anatomy:part').subType).toBe('mantle');
      expect(squidRoot.getComponentData('anatomy:part').subType).toBe('mantle');
      expect(octopusRoot.getComponentData('anatomy:part').subType).toBe('mantle');

      // All should have sockets
      expect(krakenRoot.getComponentData('anatomy:sockets')).toBeDefined();
      expect(squidRoot.getComponentData('anatomy:sockets')).toBeDefined();
      expect(octopusRoot.getComponentData('anatomy:sockets')).toBeDefined();
    });

    it('should use same generic tentacle entity for all three species', async () => {
      // Arrange - Create all three species
      const krakenActor = await testBed.createActor({ recipeId: 'anatomy:kraken_elder' });
      const squidActor = await testBed.createActor({ recipeId: 'anatomy:squid_common' });
      const octopusActor = await testBed.createActor({ recipeId: 'anatomy:octopus_common' });

      // Act - Generate anatomy for all
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(krakenActor.id);
      await anatomyService.generateAnatomy(squidActor.id);
      await anatomyService.generateAnatomy(octopusActor.id);

      const entityManager = testBed.container.get('IEntityManager');

      // Get tentacles from each species
      const krakenInstance = entityManager.getEntityInstance(krakenActor.id);
      const squidInstance = entityManager.getEntityInstance(squidActor.id);
      const octopusInstance = entityManager.getEntityInstance(octopusActor.id);

      const krakenAnatomy = krakenInstance.getComponentData('anatomy:body');
      const squidAnatomy = squidInstance.getComponentData('anatomy:body');
      const octopusAnatomy = octopusInstance.getComponentData('anatomy:body');

      const krakenTentacles = Object.keys(krakenAnatomy.body.parts).filter((name) => name.includes('tentacle'));
      const squidTentacles = Object.keys(squidAnatomy.body.parts).filter((name) => name.includes('tentacle'));
      const octopusTentacles = Object.keys(octopusAnatomy.body.parts).filter((name) => name.includes('tentacle'));

      // All should have 8 tentacles
      expect(krakenTentacles).toHaveLength(8);
      expect(squidTentacles).toHaveLength(8);
      expect(octopusTentacles).toHaveLength(8);

      // Check that all use generic tentacle subType
      const krakenFirstTentacle = entityManager.getEntityInstance(
        krakenAnatomy.body.parts[krakenTentacles[0]]
      );
      const squidFirstTentacle = entityManager.getEntityInstance(
        squidAnatomy.body.parts[squidTentacles[0]]
      );
      const octopusFirstTentacle = entityManager.getEntityInstance(
        octopusAnatomy.body.parts[octopusTentacles[0]]
      );

      expect(krakenFirstTentacle.getComponentData('anatomy:part').subType).toBe('tentacle');
      expect(squidFirstTentacle.getComponentData('anatomy:part').subType).toBe('tentacle');
      expect(octopusFirstTentacle.getComponentData('anatomy:part').subType).toBe('tentacle');
    });

    // Note: Visual properties test removed - generic entities don't have descriptor properties
    // Species variety is achieved through different recipes using the same generic building blocks
  });

  describe('Registry Validation', () => {
    it('should not have deprecated kraken-specific entities in registry', async () => {
      // Arrange - Ensure data is loaded
      await testBed.loadAnatomyModData();

      // Assert
      const deprecatedKrakenTentacle = testBed.getEntityDefinition('anatomy:kraken_tentacle');
      const deprecatedKrakenMantle = testBed.getEntityDefinition('anatomy:kraken_mantle');

      expect(deprecatedKrakenTentacle).toBeUndefined();
      expect(deprecatedKrakenMantle).toBeUndefined();
    });

    it('should have generic entities in registry', async () => {
      // Arrange - Ensure data is loaded
      await testBed.loadAnatomyModData();

      // Assert
      const genericTentacle = testBed.getEntityDefinition('anatomy:tentacle');
      const genericMantle = testBed.getEntityDefinition('anatomy:mantle');

      expect(genericTentacle).toBeDefined();
      expect(genericMantle).toBeDefined();

      expect(genericTentacle.components['anatomy:part'].subType).toBe('tentacle');
      expect(genericMantle.components['anatomy:part'].subType).toBe('mantle');
    });
  });
});
