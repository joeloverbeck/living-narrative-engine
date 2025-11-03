/**
 * @file Integration test for kraken tentacle generation with property-based entity selection
 * Tests that kraken recipe properties correctly filter to kraken_tentacle entity
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Kraken Tentacle Generation - Property-Based Selection', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate 8 tentacles matching recipe property requirements', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act - Generate anatomy for the actor
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Assert
    expect(anatomyData).toBeDefined();
    expect(anatomyData.body).toBeDefined();
    expect(anatomyData.body.parts).toBeDefined();

    const parts = anatomyData.body.parts;

    // Count tentacles
    const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
    expect(tentacles).toHaveLength(8);

    // Verify each tentacle has kraken-specific properties
    for (const tentacleName of tentacles) {
      const tentacleEntity = entityManager.getEntityInstance(parts[tentacleName]);
      expect(tentacleEntity).toBeDefined();

      // Check for kraken-specific descriptor components
      const sizeCategory = tentacleEntity.getComponentData('descriptors:size_category');
      const lengthCategory = tentacleEntity.getComponentData('descriptors:length_category');
      const texture = tentacleEntity.getComponentData('descriptors:texture');
      const color = tentacleEntity.getComponentData('descriptors:color_extended');
      const shape = tentacleEntity.getComponentData('descriptors:shape_general');

      expect(sizeCategory).toBeDefined();
      expect(sizeCategory.size).toBe('enormous');

      expect(lengthCategory).toBeDefined();
      expect(lengthCategory.length).toBe('extremely-long');

      expect(texture).toBeDefined();
      expect(texture.texture).toBe('suckered');

      expect(color).toBeDefined();
      expect(color.color).toBe('dark-purple');

      expect(shape).toBeDefined();
      expect(shape.shape).toBe('cylindrical');
    }
  });

  it('should use kraken_tentacle entity definition with required properties', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');
    const parts = anatomyData.body.parts;

    // Find first tentacle
    const firstTentacleName = Object.keys(parts).find((name) => name.includes('tentacle'));
    const tentacleEntity = entityManager.getEntityInstance(parts[firstTentacleName]);

    // Assert - Check that it uses tentacle subType
    const partComponent = tentacleEntity.getComponentData('anatomy:part');
    expect(partComponent).toBeDefined();
    expect(partComponent.subType).toBe('tentacle');

    // Verify it's based on anatomy:kraken_tentacle definition (has all required properties)
    expect(tentacleEntity.definitionId).toBe('anatomy:kraken_tentacle');
    const entityDefinition = testBed.getEntityDefinition('anatomy:kraken_tentacle');
    expect(entityDefinition).toBeDefined();
    expect(entityDefinition.components['anatomy:part'].subType).toBe('tentacle');

    // Verify it has all kraken-specific properties
    expect(entityDefinition.components['descriptors:size_category']).toBeDefined();
    expect(entityDefinition.components['descriptors:length_category']).toBeDefined();
    expect(entityDefinition.components['descriptors:texture']).toBeDefined();
    expect(entityDefinition.components['descriptors:color_extended']).toBeDefined();
    expect(entityDefinition.components['descriptors:shape_general']).toBeDefined();
  });

  it('should validate part type compatibility after migration', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Assert - Get structure template and verify compatibility
    const blueprint = testBed.getBlueprint('anatomy:kraken');

    expect(blueprint).toBeDefined();
    expect(blueprint.structureTemplate).toBe('anatomy:structure_octopoid');

    // Verify tentacles match allowed types in structure template
    const structureTemplate = testBed
      .getDataRegistry()
      .get('anatomyStructureTemplates', 'anatomy:structure_octopoid');
    expect(structureTemplate).toBeDefined();

    const tentacleLimbSet = structureTemplate.topology.limbSets.find(
      (ls) => ls.type === 'tentacle'
    );
    expect(tentacleLimbSet).toBeDefined();
    expect(tentacleLimbSet.socketPattern.allowedTypes).toContain('tentacle');

    // Verify tentacles were actually generated
    const parts = anatomyData.body.parts;
    const tentacles = Object.keys(parts).filter((name) => name.includes('tentacle'));
    expect(tentacles.length).toBeGreaterThan(0);
  });

  it('should generate correct anatomy description with generic tentacles', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const description = await testBed.anatomyDescriptionService.getOrGenerateBodyDescription(
      actorInstance
    );

    // Assert - Description should include body descriptors
    expect(description).toBeDefined();

    // For krakens, the description includes body descriptors from the recipe
    expect(description.toLowerCase()).toContain('hulking');
  });

  it('should handle tentacle constraints correctly', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    const result = await anatomyService.generateAnatomy(actor.id);

    // Assert - Generation should succeed (constraints satisfied)
    // generateAnatomy returns a boolean, not an object
    expect(result).toBe(true);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    // Verify required parts exist per constraints
    const parts = anatomyData.body.parts;

    // Recipe requires tentacle and ink_reservoir
    const hasTentacles = Object.keys(parts).some((name) => name.includes('tentacle'));
    const hasInkReservoir = Object.values(parts).some((partId) => {
      const partEntity = entityManager.getEntityInstance(partId);
      const partComp = partEntity.getComponentData('anatomy:part');
      return partComp && partComp.subType === 'ink_reservoir';
    });

    expect(hasTentacles).toBe(true);
    expect(hasInkReservoir).toBe(true);
  });

  it('should have both kraken_tentacle and generic tentacle entities', () => {
    // Assert - kraken_tentacle entity should exist with all required properties
    const krakenEntity = testBed.getEntityDefinition('anatomy:kraken_tentacle');
    expect(krakenEntity).toBeDefined();
    expect(krakenEntity.components['anatomy:part'].subType).toBe('tentacle');
    expect(krakenEntity.components['descriptors:size_category']).toBeDefined();
    expect(krakenEntity.components['descriptors:length_category']).toBeDefined();
    expect(krakenEntity.components['descriptors:texture']).toBeDefined();
    expect(krakenEntity.components['descriptors:color_extended']).toBeDefined();
    expect(krakenEntity.components['descriptors:shape_general']).toBeDefined();

    // Generic tentacle should also exist (for non-kraken use cases)
    const genericEntity = testBed.getEntityDefinition('anatomy:tentacle');
    expect(genericEntity).toBeDefined();
    expect(genericEntity.components['anatomy:part'].subType).toBe('tentacle');
  });

  it('should use generic head entity for kraken', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');
    const parts = anatomyData.body.parts;

    // Find head
    const headName = Object.keys(parts).find((name) => name.includes('head'));
    expect(headName).toBeDefined();

    const headEntity = entityManager.getEntityInstance(parts[headName]);

    // Assert - Check that it uses generic head subType
    const partComponent = headEntity.getComponentData('anatomy:part');
    expect(partComponent).toBeDefined();
    expect(partComponent.subType).toBe('head'); // Generic, not "kraken_head"

    // Verify kraken-specific sensory component exists
    const sensoryComponent = headEntity.getComponentData('anatomy:sensory');
    expect(sensoryComponent).toBeDefined();
    expect(sensoryComponent.acuity).toBe('abyssal');
    expect(sensoryComponent.echolocation).toBe(true);
  });

  it('should generate unique tentacle instances', async () => {
    // Arrange
    const recipeId = 'anatomy:kraken_elder';
    const actor = await testBed.createActor({ recipeId });

    // Act
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');
    const parts = anatomyData.body.parts;

    // Get all tentacle IDs
    const tentacleIds = Object.keys(parts)
      .filter((name) => name.includes('tentacle'))
      .map((name) => parts[name]);

    // Assert - All tentacles should be unique instances
    const uniqueIds = new Set(tentacleIds);
    expect(uniqueIds.size).toBe(tentacleIds.length);
    expect(uniqueIds.size).toBe(8);

    // Each should be a valid entity
    tentacleIds.forEach((id) => {
      const entity = entityManager.getEntityInstance(id);
      expect(entity).toBeDefined();
    });
  });
});
