import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService fallback branch coverage', () => {
  let service;
  let bodyPartDescriptionBuilder;
  let bodyDescriptionComposer;
  let bodyGraphService;
  let entityFinder;
  let componentManager;

  const createEntity = (id, components = {}) => ({
    id,
    hasComponent: jest.fn((componentId) => Boolean(components[componentId])),
    getComponentData: jest.fn((componentId) => components[componentId]),
  });

  beforeEach(() => {
    bodyPartDescriptionBuilder = { buildDescription: jest.fn() };
    bodyDescriptionComposer = { composeDescription: jest.fn() };
    bodyGraphService = { getAllParts: jest.fn() };
    entityFinder = { getEntityInstance: jest.fn() };
    componentManager = { addComponent: jest.fn() };

    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder,
      bodyDescriptionComposer,
      bodyGraphService,
      entityFinder,
      componentManager,
      eventDispatchService: null,
    });
  });

  it('executes the legacy generation pipeline when orchestrator services are absent', async () => {
    const bodyEntity = createEntity('actor-1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'spine' } },
    });

    const torso = createEntity('spine', {
      [ANATOMY_PART_COMPONENT_ID]: { type: 'torso' },
    });
    const head = createEntity('head', {
      [ANATOMY_PART_COMPONENT_ID]: { type: 'head' },
    });

    bodyGraphService.getAllParts.mockReturnValue(['spine', 'head']);
    entityFinder.getEntityInstance.mockImplementation((id) => {
      if (id === 'spine') return torso;
      if (id === 'head') return head;
      if (id === 'actor-1') return bodyEntity;
      return null;
    });
    bodyPartDescriptionBuilder.buildDescription.mockImplementation(
      (entity) => `desc:${entity.id}`
    );
    bodyDescriptionComposer.composeDescription.mockResolvedValue('body desc');

    await service.generateAllDescriptions(bodyEntity);

    expect(bodyPartDescriptionBuilder.buildDescription).toHaveBeenCalledTimes(
      2
    );
    expect(componentManager.addComponent).toHaveBeenCalledWith(
      'head',
      DESCRIPTION_COMPONENT_ID,
      { text: 'desc:head' }
    );
    expect(componentManager.addComponent).toHaveBeenCalledWith(
      'actor-1',
      DESCRIPTION_COMPONENT_ID,
      { text: 'body desc' }
    );
  });

  it('throws the documented errors when anatomy prerequisites are missing', async () => {
    const missingBody = createEntity('actor-1', {});
    await expect(service.generateAllDescriptions(missingBody)).rejects.toThrow(
      'Entity must have an anatomy:body component'
    );

    const missingRoot = createEntity('actor-1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: {} },
    });
    await expect(service.generateAllDescriptions(missingRoot)).rejects.toThrow(
      'Body component must have a body.root property'
    );
  });

  it('skips part generation when the entity lookup fails or lacks anatomy data', () => {
    entityFinder.getEntityInstance.mockReturnValue(null);
    service.generatePartDescription('ghost-part');
    expect(bodyPartDescriptionBuilder.buildDescription).not.toHaveBeenCalled();

    const part = createEntity('arm-1', {});
    entityFinder.getEntityInstance.mockReturnValue(part);
    service.generatePartDescription('arm-1');
    expect(bodyPartDescriptionBuilder.buildDescription).not.toHaveBeenCalled();
  });

  it('avoids persisting empty part descriptions from the legacy builder', () => {
    const part = createEntity('arm-1', {
      [ANATOMY_PART_COMPONENT_ID]: { type: 'arm' },
    });
    entityFinder.getEntityInstance.mockReturnValue(part);
    bodyPartDescriptionBuilder.buildDescription.mockReturnValue('');

    service.generatePartDescription('arm-1');
    expect(componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('returns cached body descriptions when they are marked current', async () => {
    const entity = createEntity('actor-1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      [DESCRIPTION_COMPONENT_ID]: { text: 'cached body' },
    });
    const currentSpy = jest
      .spyOn(service, 'isDescriptionCurrent')
      .mockReturnValue(true);

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(currentSpy).toHaveBeenCalledWith(entity);
    expect(result).toBe('cached body');
    expect(bodyDescriptionComposer.composeDescription).not.toHaveBeenCalled();
  });

  it('returns null when composition fails to produce a description', async () => {
    const entity = createEntity('actor-1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
    });
    bodyDescriptionComposer.composeDescription.mockResolvedValue('');

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBeNull();
  });

  it('dispatches a system error when composed descriptions are empty', async () => {
    service.eventDispatchService = { safeDispatchEvent: jest.fn() };

    const entity = createEntity('actor-1', {
      [ANATOMY_BODY_COMPONENT_ID]: {
        body: { root: 'torso' },
        recipeId: 'recipe:1',
      },
      'core:name': { text: 'Test Actor' },
    });
    bodyDescriptionComposer.composeDescription.mockResolvedValue('');
    entityFinder.getEntityInstance.mockReturnValue(entity);

    await service.generateBodyDescription(entity);

    const [eventName, payload] =
      service.eventDispatchService.safeDispatchEvent.mock.calls.at(-1);
    expect(eventName).toBe('core:system_error_occurred');
    expect(payload.message).toContain('Test Actor');
    expect(payload.details.raw).toContain('recipe:1');
  });

  it('returns cached and generated descriptions for non-anatomy and anatomy entities', async () => {
    const cached = createEntity('civilian', {
      [DESCRIPTION_COMPONENT_ID]: { text: 'cached text' },
    });
    const cachedResult = await service.getOrGenerateBodyDescription(cached);
    expect(cachedResult).toBe('cached text');

    const bodyEntity = createEntity('body-entity', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'core' } },
    });
    bodyGraphService.getAllParts.mockReturnValue(['core']);
    entityFinder.getEntityInstance.mockReturnValue(
      createEntity('core', {
        [ANATOMY_PART_COMPONENT_ID]: { type: 'core' },
      })
    );
    bodyPartDescriptionBuilder.buildDescription.mockReturnValue('part desc');
    bodyDescriptionComposer.composeDescription.mockResolvedValue('full body');

    const generated = await service.getOrGenerateBodyDescription(bodyEntity);
    expect(generated).toBe('full body');
    expect(componentManager.addComponent).toHaveBeenCalledWith(
      'body-entity',
      DESCRIPTION_COMPONENT_ID,
      { text: 'full body' }
    );
  });

  it('returns null immediately when getOrGenerateBodyDescription receives no entity', async () => {
    await expect(
      service.getOrGenerateBodyDescription(null)
    ).resolves.toBeNull();
  });

  it('exits early when updateDescription cannot resolve the entity', () => {
    entityFinder.getEntityInstance.mockReturnValue(null);
    service.updateDescription('missing', 'ignored');
    expect(componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('exposes the testable helpers for description state and regeneration', async () => {
    expect(service.isDescriptionCurrent({})).toBe(false);

    const withoutAnatomy = createEntity('actor-2', {});
    await service.regenerateDescriptions(withoutAnatomy.id);

    const withAnatomy = createEntity('actor-3', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'spine' } },
    });
    entityFinder.getEntityInstance.mockReturnValueOnce(withAnatomy);
    const allDescriptionsSpy = jest
      .spyOn(service, 'generateAllDescriptions')
      .mockResolvedValue();

    await service.regenerateDescriptions(withAnatomy.id);
    expect(allDescriptionsSpy).toHaveBeenCalledWith(withAnatomy);
  });

  describe('when enhanced services are provided', () => {
    let orchestratedService;
    let partDescriptionGenerator;
    let bodyDescriptionOrchestrator;
    let descriptionPersistenceService;
    let eventDispatchService;

    beforeEach(() => {
      partDescriptionGenerator = { generatePartDescription: jest.fn() };
      bodyDescriptionOrchestrator = {
        generateAllDescriptions: jest.fn(),
        generateBodyDescription: jest.fn(),
        getOrGenerateBodyDescription: jest.fn(),
      };
      descriptionPersistenceService = {
        updateDescription: jest.fn(),
        updateMultipleDescriptions: jest.fn(),
      };
      eventDispatchService = { safeDispatchEvent: jest.fn() };

      orchestratedService = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder,
        bodyDescriptionComposer,
        bodyGraphService,
        entityFinder,
        componentManager,
        eventDispatchService,
        partDescriptionGenerator,
        bodyDescriptionOrchestrator,
        descriptionPersistenceService,
      });
    });

    it('delegates bulk generation to the orchestrator and persists the results', async () => {
      const entity = createEntity('hero', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'core' } },
      });
      const orchestrationResult = {
        bodyDescription: 'assembled body',
        partDescriptions: [
          { entityId: 'arm', description: 'left arm' },
          { entityId: 'leg', description: 'left leg' },
        ],
      };
      bodyDescriptionOrchestrator.generateAllDescriptions.mockResolvedValue(
        orchestrationResult
      );

      await orchestratedService.generateAllDescriptions(entity);

      expect(
        bodyDescriptionOrchestrator.generateAllDescriptions
      ).toHaveBeenCalledWith(entity);
      expect(
        descriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('hero', 'assembled body');
      expect(
        descriptionPersistenceService.updateMultipleDescriptions
      ).toHaveBeenCalledWith(orchestrationResult.partDescriptions);
    });

    it('uses the dedicated part generator and persistence helpers', () => {
      partDescriptionGenerator.generatePartDescription.mockReturnValue(
        'tail description'
      );

      orchestratedService.generatePartDescription('tail');

      expect(
        partDescriptionGenerator.generatePartDescription
      ).toHaveBeenCalledWith('tail');
      expect(
        descriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('tail', 'tail description');
    });

    it('delegates body description generation to the orchestrator', async () => {
      const entity = createEntity('hero', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'core' } },
      });
      bodyDescriptionOrchestrator.generateBodyDescription.mockResolvedValue(
        'heroic description'
      );

      await orchestratedService.generateBodyDescription(entity);

      expect(
        bodyDescriptionOrchestrator.generateBodyDescription
      ).toHaveBeenCalledWith(entity);
      expect(
        descriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('hero', 'heroic description');
    });

    it('returns orchestrated descriptions via getOrGenerateBodyDescription', async () => {
      const entity = createEntity('hero', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'core' } },
      });
      bodyDescriptionOrchestrator.getOrGenerateBodyDescription.mockResolvedValue(
        'cached orchestrated body'
      );

      const result =
        await orchestratedService.getOrGenerateBodyDescription(entity);

      expect(
        bodyDescriptionOrchestrator.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(entity);
      expect(result).toBe('cached orchestrated body');
      expect(
        descriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('hero', 'cached orchestrated body');
    });

    it('routes updateDescription through the persistence service when present', () => {
      orchestratedService.updateDescription('actor', 'from orchestrator');
      expect(
        descriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('actor', 'from orchestrator');
    });
  });
});
