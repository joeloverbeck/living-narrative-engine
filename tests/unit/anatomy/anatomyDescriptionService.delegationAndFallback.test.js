import { describe, it, expect, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 *
 * @param overrides
 */
function createService(overrides = {}) {
  const defaults = {
    bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
    bodyDescriptionComposer: {
      composeDescription: jest.fn().mockResolvedValue('fallback-body-description'),
    },
    bodyGraphService: { getAllParts: jest.fn().mockReturnValue([]) },
    entityFinder: { getEntityInstance: jest.fn().mockReturnValue(null) },
    componentManager: { addComponent: jest.fn() },
    eventDispatchService: { safeDispatchEvent: jest.fn() },
    partDescriptionGenerator: null,
    bodyDescriptionOrchestrator: null,
    descriptionPersistenceService: null,
  };

  return new AnatomyDescriptionService({ ...defaults, ...overrides });
}

describe('AnatomyDescriptionService delegation and fallback coverage', () => {
  it('delegates generateAllDescriptions to the orchestrator and persists results when services exist', async () => {
    const orchestrator = {
      generateAllDescriptions: jest.fn().mockResolvedValue({
        bodyDescription: 'body-summary',
        partDescriptions: [{ id: 'part-1', description: 'arm description' }],
      }),
    };
    const persistence = {
      updateDescription: jest.fn(),
      updateMultipleDescriptions: jest.fn(),
    };
    const service = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });
    const bodyEntity = { id: 'body-1' };

    await expect(service.generateAllDescriptions(bodyEntity)).resolves.toEqual({
      bodyDescription: 'body-summary',
      partDescriptions: [{ id: 'part-1', description: 'arm description' }],
    });

    expect(orchestrator.generateAllDescriptions).toHaveBeenCalledWith(bodyEntity);
    expect(persistence.updateDescription).toHaveBeenCalledWith('body-1', 'body-summary');
    expect(persistence.updateMultipleDescriptions).toHaveBeenCalledWith(
      [{ id: 'part-1', description: 'arm description' }],
    );
  });

  it('skips persistence updates when orchestrator is present without a persistence service', async () => {
    const orchestrator = {
      generateAllDescriptions: jest.fn().mockResolvedValue({
        bodyDescription: 'ignored',
        partDescriptions: [],
      }),
    };
    const service = createService({ bodyDescriptionOrchestrator: orchestrator });
    const bodyEntity = { id: 'body-2' };

    await expect(service.generateAllDescriptions(bodyEntity)).resolves.toEqual({
      bodyDescription: 'ignored',
      partDescriptions: [],
    });
    expect(orchestrator.generateAllDescriptions).toHaveBeenCalledWith(bodyEntity);
  });

  it('uses partDescriptionGenerator results and persists them when available', () => {
    const generator = {
      generatePartDescription: jest.fn().mockReturnValue('fresh-description'),
    };
    const persistence = { updateDescription: jest.fn() };
    const service = createService({
      partDescriptionGenerator: generator,
      descriptionPersistenceService: persistence,
    });

    service.generatePartDescription('part-42');

    expect(generator.generatePartDescription).toHaveBeenCalledWith('part-42');
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'part-42',
      'fresh-description',
    );
  });

  it('returns early from generatePartDescription when the generator produces no description', () => {
    const generator = {
      generatePartDescription: jest.fn().mockReturnValue(''),
    };
    const persistence = { updateDescription: jest.fn() };
    const service = createService({
      partDescriptionGenerator: generator,
      descriptionPersistenceService: persistence,
    });

    service.generatePartDescription('part-99');

    expect(generator.generatePartDescription).toHaveBeenCalledWith('part-99');
    expect(persistence.updateDescription).not.toHaveBeenCalled();
  });

  it('delegates generateBodyDescription to the orchestrator and persists the output', async () => {
    const orchestrator = {
      generateBodyDescription: jest.fn().mockResolvedValue('assembled-body'),
    };
    const persistence = { updateDescription: jest.fn() };
    const service = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });
    const bodyEntity = { id: 'body-3' };

    await service.generateBodyDescription(bodyEntity);

    expect(orchestrator.generateBodyDescription).toHaveBeenCalledWith(bodyEntity);
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'body-3',
      'assembled-body',
    );
  });

  it('handles orchestrated body description generation without persistence gracefully', async () => {
    const orchestrator = {
      generateBodyDescription: jest.fn().mockResolvedValue('ignored-body'),
    };
    const service = createService({ bodyDescriptionOrchestrator: orchestrator });

    await service.generateBodyDescription({ id: 'body-4' });

    expect(orchestrator.generateBodyDescription).toHaveBeenCalled();
  });

  it('persists orchestrated getOrGenerateBodyDescription results when entity has anatomy data', async () => {
    const orchestrator = {
      getOrGenerateBodyDescription: jest.fn().mockResolvedValue('cached-body'),
    };
    const persistence = { updateDescription: jest.fn() };
    const entity = {
      id: 'actor-1',
      hasComponent: jest.fn().mockImplementation((componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID,
      ),
    };
    const service = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    await expect(service.getOrGenerateBodyDescription(entity)).resolves.toBe(
      'cached-body',
    );
    expect(orchestrator.getOrGenerateBodyDescription).toHaveBeenCalledWith(entity);
    expect(persistence.updateDescription).toHaveBeenCalledWith('actor-1', 'cached-body');
  });

  it('still returns orchestrated descriptions when the entity lacks anatomy data', async () => {
    const orchestrator = {
      getOrGenerateBodyDescription: jest.fn().mockResolvedValue('outline'),
    };
    const persistence = { updateDescription: jest.fn() };
    const entity = {
      id: 'actor-2',
      hasComponent: jest.fn().mockReturnValue(false),
    };
    const service = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('outline');
    expect(persistence.updateDescription).not.toHaveBeenCalled();
  });

  it('skips persistence when orchestrated description is missing even if other dependencies exist', async () => {
    const orchestrator = {
      getOrGenerateBodyDescription: jest.fn().mockResolvedValue(''),
    };
    const persistence = { updateDescription: jest.fn() };
    const entity = {
      id: 'actor-3',
      hasComponent: jest.fn().mockReturnValue(true),
    };
    const service = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('');
    expect(persistence.updateDescription).not.toHaveBeenCalled();
  });

  it('returns existing descriptions for non-anatomy entities', async () => {
    const entity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest
        .fn()
        .mockImplementation((componentId) =>
          componentId === DESCRIPTION_COMPONENT_ID ? { text: 'stored desc' } : null,
        ),
    };
    const service = createService();

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('stored desc');
  });

  it('returns null when a non-anatomy entity has no description component', async () => {
    const entity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockReturnValue(null),
    };
    const service = createService();

    await expect(service.getOrGenerateBodyDescription(entity)).resolves.toBeNull();
  });

  it('respects cached descriptions when isDescriptionCurrent reports true', async () => {
    const entity = {
      id: 'actor-4',
      hasComponent: jest.fn().mockImplementation((componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID
      ),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'cached-body' };
        }
        return undefined;
      }),
    };
    const service = createService();
    jest.spyOn(service, 'isDescriptionCurrent').mockReturnValue(true);

    const description = await service.getOrGenerateBodyDescription(entity);

    expect(description).toBe('cached-body');
    expect(service.bodyDescriptionComposer.composeDescription).not.toHaveBeenCalled();
  });

  it('propagates null when body description composition produces no result', async () => {
    const entity = {
      id: 'actor-5',
      hasComponent: jest.fn().mockImplementation((componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID
      ),
      getComponentData: jest.fn().mockReturnValue(null),
    };
    const service = createService({
      bodyDescriptionComposer: { composeDescription: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.getOrGenerateBodyDescription(entity)).resolves.toBeNull();
  });

  it('delegates updateDescription to the persistence service when available', () => {
    const persistence = { updateDescription: jest.fn() };
    const service = createService({ descriptionPersistenceService: persistence });

    service.updateDescription('entity-42', 'latest');

    expect(persistence.updateDescription).toHaveBeenCalledWith('entity-42', 'latest');
  });

  it('exits early from updateDescription when the entity cannot be found', () => {
    const entityFinder = { getEntityInstance: jest.fn().mockReturnValue(null) };
    const componentManager = { addComponent: jest.fn() };
    const service = createService({ entityFinder, componentManager });

    service.updateDescription('missing', 'should-not-write');

    expect(componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('always reports descriptions as stale via isDescriptionCurrent', () => {
    const service = createService();
    expect(service.isDescriptionCurrent({})).toBe(false);
  });

  it('regenerateDescriptions handles missing entities gracefully', () => {
    const entityFinder = { getEntityInstance: jest.fn().mockReturnValue(null) };
    const service = createService({ entityFinder });
    service.generateAllDescriptions = jest.fn();

    service.regenerateDescriptions('nobody');

    expect(service.generateAllDescriptions).not.toHaveBeenCalled();
  });

  it('regenerateDescriptions ignores entities without anatomy components', () => {
    const entity = { hasComponent: jest.fn().mockReturnValue(false) };
    const entityFinder = { getEntityInstance: jest.fn().mockReturnValue(entity) };
    const service = createService({ entityFinder });
    service.generateAllDescriptions = jest.fn();

    service.regenerateDescriptions('actor-6');

    expect(service.generateAllDescriptions).not.toHaveBeenCalled();
  });

  it('regenerateDescriptions forwards valid entities to generateAllDescriptions', () => {
    const entity = {
      hasComponent: jest.fn().mockImplementation((componentId) =>
        componentId === ANATOMY_BODY_COMPONENT_ID
      ),
    };
    const entityFinder = { getEntityInstance: jest.fn().mockReturnValue(entity) };
    const service = createService({ entityFinder });
    service.generateAllDescriptions = jest.fn();

    service.regenerateDescriptions('actor-7');

    expect(service.generateAllDescriptions).toHaveBeenCalledWith(entity);
  });
});
