import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { BodyDescriptionOrchestrator } from '../../../src/anatomy/BodyDescriptionOrchestrator.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('BodyDescriptionOrchestrator Integration Coverage', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {BodyDescriptionOrchestrator} */
  let orchestrator;

  beforeAll(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new BodyDescriptionOrchestrator({
      logger: testBed.logger,
      bodyDescriptionComposer: testBed.bodyDescriptionComposer,
      bodyGraphService: testBed.bodyGraphService,
      eventDispatcher: testBed.eventDispatcher,
      entityManager: testBed.entityManager,
      partDescriptionGenerator: testBed.mockPartDescriptionGenerator,
    });
  });

  afterAll(async () => {
    if (typeof testBed?.cleanup === 'function') {
      await testBed.cleanup();
    }
  });

  const createActorEntityWithGeneratedAnatomy = async () => {
    const actor = await testBed.entityManager.createEntityInstance('core:actor');

    await testBed.entityManager.addComponent(actor.id, ANATOMY_BODY_COMPONENT_ID, {
      recipeId: 'anatomy:human_female_balanced',
      bodyParts: [],
    });

    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    return testBed.entityManager.getEntityInstance(actor.id);
  };

  describe('dependency validation', () => {
    it('throws when bodyDescriptionComposer dependency is missing', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: testBed.logger,
            // bodyDescriptionComposer intentionally omitted to exercise validation branch
            bodyGraphService: testBed.bodyGraphService,
            eventDispatcher: testBed.eventDispatcher,
            entityManager: testBed.entityManager,
            partDescriptionGenerator: testBed.mockPartDescriptionGenerator,
          })
      ).toThrow('bodyDescriptionComposer is required');
    });

    it('throws when partDescriptionGenerator dependency is missing', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: testBed.logger,
            bodyDescriptionComposer: testBed.bodyDescriptionComposer,
            bodyGraphService: testBed.bodyGraphService,
            eventDispatcher: testBed.eventDispatcher,
            entityManager: testBed.entityManager,
            // partDescriptionGenerator intentionally omitted to exercise validation branch
          })
      ).toThrow('partDescriptionGenerator is required');
    });
  });

  describe('getOrGenerateBodyDescription integration behaviour', () => {
    it('returns cached description when metadata marks it current', async () => {
      const actorEntity = await createActorEntityWithGeneratedAnatomy();

      await testBed.entityManager.addComponent(actorEntity.id, DESCRIPTION_COMPONENT_ID, {
        text: 'Existing anatomy description',
        metadata: { isCurrent: true },
      });

      const composeSpy = jest.spyOn(
        testBed.bodyDescriptionComposer,
        'composeDescription'
      );

      const description = await orchestrator.getOrGenerateBodyDescription(
        actorEntity
      );

      expect(description).toBe('Existing anatomy description');
      expect(composeSpy).not.toHaveBeenCalled();

      composeSpy.mockRestore();
    });

    it('returns null when composition produces an empty result', async () => {
      const actorEntity = await createActorEntityWithGeneratedAnatomy();

      const composeSpy = jest
        .spyOn(testBed.bodyDescriptionComposer, 'composeDescription')
        .mockResolvedValueOnce('');

      const description = await orchestrator.getOrGenerateBodyDescription(
        actorEntity
      );

      expect(description).toBeNull();
      expect(composeSpy).toHaveBeenCalledWith(actorEntity);

      composeSpy.mockRestore();
    });
  });
});
