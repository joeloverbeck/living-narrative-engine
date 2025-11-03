/**
 * @file Integration test for kraken mantle generation with property-based entity selection
 * Tests that kraken recipe properties correctly filter to kraken_mantle entity
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Kraken Mantle Generation - Property-Based Selection', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate kraken with kraken_mantle root matching recipe properties', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Assert - Check root part is mantle with kraken properties
    expect(anatomyData).toBeDefined();
    expect(anatomyData.body).toBeDefined();
    expect(anatomyData.body.root).toBeDefined();

    const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
    const partComp = rootEntity.getComponentData('anatomy:part');
    expect(partComp.subType).toBe('mantle');

    // Verify it's the kraken_mantle entity (selected because it matches recipe properties)
    expect(rootEntity.definitionId).toBe('anatomy:kraken_mantle');

    // Verify all kraken-specific properties exist (from entity definition, not overrides)
    const sizeCategory = rootEntity.getComponentData('descriptors:size_category');
    const color = rootEntity.getComponentData('descriptors:color_extended');
    const texture = rootEntity.getComponentData('descriptors:texture');
    const shape = rootEntity.getComponentData('descriptors:shape_general');

    expect(sizeCategory.size).toBe('massive');
    expect(color.color).toBe('abyssal-black');
    expect(texture.texture).toBe('smooth');
    expect(shape.shape).toBe('oval');
  });

  it('should attach beak and ink sac to mantle sockets', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Get root mantle
    const rootEntity = entityManager.getEntityInstance(anatomyData.body.root);
    const socketsComp = rootEntity.getComponentData('anatomy:sockets');

    // Assert - Sockets exist on mantle
    expect(socketsComp).toBeDefined();
    expect(socketsComp.sockets).toBeDefined();
    // V2 blueprints merge template-generated sockets (9) with entity sockets (2) = 11 total
    expect(socketsComp.sockets).toHaveLength(11);

    const beakSocket = socketsComp.sockets.find((s) => s.id === 'beak');
    const inkSacSocket = socketsComp.sockets.find((s) => s.id === 'ink_sac');

    expect(beakSocket).toBeDefined();
    expect(inkSacSocket).toBeDefined();

    // Check that parts are actually attached
    const parts = anatomyData.body.parts;
    const beakPart = Object.values(parts).find((partId) => {
      const entity = entityManager.getEntityInstance(partId);
      const part = entity.getComponentData('anatomy:part');
      return part && part.subType === 'beak';
    });

    const inkSacPart = Object.values(parts).find((partId) => {
      const entity = entityManager.getEntityInstance(partId);
      const part = entity.getComponentData('anatomy:part');
      return part && part.subType === 'ink_reservoir';
    });

    expect(beakPart).toBeDefined();
    expect(inkSacPart).toBeDefined();
  });

  it('should generate complete kraken anatomy with all parts', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Assert - Count all parts
    const parts = anatomyData.body.parts;
    const partCount = Object.keys(parts).length;

    // Expected: 1 mantle (root) + 8 tentacles + 1 head + 1 beak + 1 ink_sac = 12 parts
    expect(partCount).toBeGreaterThanOrEqual(11); // At least 11 (beak is optional)
    expect(partCount).toBeLessThanOrEqual(12);

    // Verify tentacles
    const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
    expect(tentacles).toHaveLength(8);
  });

  it('should have both kraken_mantle and generic mantle entities', () => {
    // Assert - kraken_mantle entity should exist with all required properties
    const krakenEntity = testBed.getEntityDefinition('anatomy:kraken_mantle');
    expect(krakenEntity).toBeDefined();
    expect(krakenEntity.components['anatomy:part'].subType).toBe('mantle');

    // Verify kraken-specific descriptor properties
    expect(krakenEntity.components['descriptors:size_category']).toBeDefined();
    expect(krakenEntity.components['descriptors:size_category'].size).toBe('massive');
    expect(krakenEntity.components['descriptors:color_extended']).toBeDefined();
    expect(krakenEntity.components['descriptors:color_extended'].color).toBe('abyssal-black');
    expect(krakenEntity.components['descriptors:texture']).toBeDefined();
    expect(krakenEntity.components['descriptors:texture'].texture).toBe('smooth');
    expect(krakenEntity.components['descriptors:shape_general']).toBeDefined();
    expect(krakenEntity.components['descriptors:shape_general'].shape).toBe('oval');

    // Verify sockets for beak and ink_sac
    expect(krakenEntity.components['anatomy:sockets']).toBeDefined();
    expect(krakenEntity.components['anatomy:sockets'].sockets).toHaveLength(2);

    // Generic mantle should also exist (for non-kraken use cases)
    const genericEntity = testBed.getEntityDefinition('anatomy:mantle');
    expect(genericEntity).toBeDefined();
    expect(genericEntity.components['anatomy:part'].subType).toBe('mantle');
  });
});
