import { describe, it, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const DESCRIPTOR_VALUE_KEYS = [
  'height',
  'build',
  'composition',
  'density',
  'skinColor',
];

const DESCRIPTOR_ORDER = [
  'descriptors:build',
  'descriptors:body_composition',
  'descriptors:body_hair',
  'descriptors:skin_color',
  'descriptors:height',
];

describe('BodyDescriptionComposer real module integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;

  beforeAll(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * @param {ReturnType<typeof createFormattingService>} formattingService
   * @returns {{ composer: BodyDescriptionComposer, partBuilder: BodyPartDescriptionBuilder }}
   */
  const createComposerWithRealDependencies = (formattingService) => {
    const descriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: formattingService,
    });

    const partBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService: formattingService,
    });

    const partDescriptionGenerator = {
      generatePartDescription: (partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        if (!partEntity) return '';
        const subType =
          partEntity.getComponentData('anatomy:part')?.subType || 'body part';

        if (subType === 'torso') {
          // Force a missing structured line branch for torso entries.
          testBed.entityManager.addComponent(partId, 'core:description', {
            text: '',
          });
          return '';
        }

        const description = partBuilder.buildDescription(partEntity);
        if (description) {
          testBed.entityManager.addComponent(partId, 'core:description', {
            text: description,
          });
        }
        return description;
      },
      generateDescription: (entity) => {
        if (!entity) return '';
        const description = partBuilder.buildDescription(entity);
        if (description && entity.id) {
          testBed.entityManager.addComponent(entity.id, 'core:description', {
            text: description,
          });
        }
        return description;
      },
      generateMultiplePartDescriptions: (partIds) => {
        const result = new Map();
        for (const id of partIds) {
          const entity = testBed.entityManager.getEntityInstance(id);
          if (!entity) continue;
          const description = partBuilder.buildDescription(entity);
          if (description) {
            testBed.entityManager.addComponent(id, 'core:description', {
              text: description,
            });
            result.set(id, description);
          }
        }
        return result;
      },
    };

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: partBuilder,
      bodyGraphService: testBed.bodyGraphService,
      entityFinder: testBed.entityManager,
      anatomyFormattingService: formattingService,
      partDescriptionGenerator,
      // Intentionally omit equipmentDescriptionService and logger to exercise
      // default argument branches and console backed logging fallback.
    });

    return { composer, partBuilder };
  };

  const createFormattingService = () => ({
    getDescriptionOrder: () => [
      'build',
      'arm',
      'equipment',
      'torso',
      'body_composition',
      'body_hair',
      'skin_color',
      'tail',
      'build',
    ],
    getPairedParts: () => new Set(['arm']),
    getIrregularPlurals: () => ({ foot: 'feet' }),
    getDescriptorOrder: () => [...DESCRIPTOR_ORDER],
    getDescriptorValueKeys: () => [...DESCRIPTOR_VALUE_KEYS],
  });

  it('composes descriptions with fallback descriptors and real entity data', async () => {
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_male_balanced',
    });

    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);
    await testBed.bodyGraphService.buildAdjacencyCache(actor.id);

    const formattingService = createFormattingService();
    const { composer } = createComposerWithRealDependencies(formattingService);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const bodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      ANATOMY_BODY_COMPONENT_ID,
    );

    bodyComponent.body.descriptors = { build: 'broad-shouldered' };
    await testBed.entityManager.addComponent(
      actor.id,
      ANATOMY_BODY_COMPONENT_ID,
      bodyComponent,
    );

    await testBed.entityManager.addComponent(actor.id, 'descriptors:height', {
      height: '6ft 2in',
    });
    await testBed.entityManager.addComponent(
      actor.id,
      'descriptors:body_composition',
      { composition: 'athletic' },
    );
    await testBed.entityManager.addComponent(actor.id, 'descriptors:body_hair', {
      density: 'sparse',
    });
    await testBed.entityManager.addComponent(actor.id, 'descriptors:skin_color', {
      skinColor: 'bronzed',
    });

    const actorEntity = testBed.entityManager.getEntityInstance(actor.id);
    const description = await composer.composeDescription(actorEntity);

    const lines = description.split('\n').filter((line) => line.length > 0);

    expect(lines[0]).toBe('Height: 6ft 2in');
    expect(description).toContain('Build: broad-shouldered');
    expect(description).toContain('Body composition: athletic');
    expect(description).toContain('Hair density: sparse');
    expect(description).toContain('Skin color: bronzed');
    expect(description).not.toContain('Equipped');
    expect(description).not.toContain('tail');
    expect(
      warnSpy.mock.calls.some(([message]) =>
        message.includes('[DEPRECATION] Entity'),
      ),
    ).toBe(true);

    warnSpy.mockRestore();
  });

  it('skips missing descriptors and avoids duplicate processing', async () => {
    const actor = await testBed.createActor({
      recipeId: 'anatomy:human_female_balanced',
    });

    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);
    await testBed.bodyGraphService.buildAdjacencyCache(actor.id);

    const formattingService = createFormattingService();
    const { composer } = createComposerWithRealDependencies(formattingService);

    const actorEntity = testBed.entityManager.getEntityInstance(actor.id);

    const emptyBodyComponent = testBed.entityManager.getComponentData(
      actor.id,
      ANATOMY_BODY_COMPONENT_ID,
    );
    emptyBodyComponent.body.descriptors = {};
    await testBed.entityManager.addComponent(
      actor.id,
      ANATOMY_BODY_COMPONENT_ID,
      emptyBodyComponent,
    );

    const description = await composer.composeDescription(actorEntity);
    const lines = description.split('\n').filter((line) => line.length > 0);

    // When no descriptors exist the composer should skip the descriptor loop
    // entirely but still produce structured part descriptions where available.
    expect(lines.some((line) => line.startsWith('Height'))).toBe(false);
    expect(lines.some((line) => line.includes('arm'))).toBe(true);

    // Ensure duplicate descriptor types do not result in duplicate entries.
    const buildLines = lines.filter((line) => line.startsWith('Build'));
    expect(buildLines).toHaveLength(0);
  });
});
