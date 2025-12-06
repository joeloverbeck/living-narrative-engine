import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

/**
 * Builds the inputs required by GraphIntegrityValidator using live entities.
 *
 * @param {AnatomyIntegrationTestBed} testBed
 * @param {string} actorId
 */
function buildValidationInputs(testBed, actorId) {
  const { entityManager, bodyGraphService, recipeProcessor } = testBed;
  const bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');
  if (!bodyComponent) {
    throw new Error(`Actor ${actorId} is missing anatomy:body component`);
  }

  const rootId = bodyComponent.body?.root ?? actorId;
  const entityIds = new Set([rootId]);
  const socketOccupancy = new Set();

  const parts = (
    bodyGraphService.getAllParts(bodyComponent, actorId) || []
  ).filter(Boolean);
  for (const partId of parts) {
    entityIds.add(partId);
    const joint = entityManager.getComponentData(partId, 'anatomy:joint');
    if (joint?.parentId && joint?.socketId) {
      socketOccupancy.add(`${joint.parentId}:${joint.socketId}`);
    }
  }

  const recipeId = bodyComponent.recipeId;
  const recipe = recipeProcessor.processRecipe(
    recipeProcessor.loadRecipe(recipeId)
  );

  return {
    entityIds: Array.from(entityIds),
    recipe,
    socketOccupancy,
    rootId,
  };
}

describe('GraphIntegrityValidator real-world integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  it('accepts the anatomy graph generated for a human recipe', async () => {
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_female',
    });
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const { entityIds, recipe, socketOccupancy } = buildValidationInputs(
      testBed,
      actor.id
    );

    const result = await testBed.validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('emits a warning when multiple roots are present in the graph inputs', async () => {
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_female',
    });
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const { entityIds, recipe, socketOccupancy } = buildValidationInputs(
      testBed,
      actor.id
    );

    const strayEntityId = actor.id;
    entityIds.push(strayEntityId);

    const result = await testBed.validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Multiple root entities found');
    expect(result.warnings[0]).toContain(strayEntityId);
  });

  it('reports errors when a part references a missing parent socket', async () => {
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_female',
    });
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const { entityIds, recipe, socketOccupancy, rootId } =
      buildValidationInputs(testBed, actor.id);

    const firstPartId = entityIds.find((id) => id !== rootId);
    expect(firstPartId).toBeDefined();

    await testBed.entityManager.addComponent(firstPartId, 'anatomy:joint', {
      parentId: 'missing-parent',
      socketId: 'phantom-socket',
    });

    socketOccupancy.add('missing-parent:phantom-socket');

    const result = await testBed.validator.validateGraph(
      entityIds,
      recipe,
      socketOccupancy
    );

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((message) => message.includes('missing-parent'))
    ).toBe(true);
    expect(
      result.errors.some((message) => message.includes('phantom-socket'))
    ).toBe(true);
  });
});
