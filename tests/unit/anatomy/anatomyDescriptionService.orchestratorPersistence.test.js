import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const createEntity = (id, components = {}) => ({
  id,
  hasComponent: jest.fn((component) => Boolean(components[component])),
  getComponentData: jest.fn((component) => components[component]),
});

const createService = (overrides = {}) => {
  const baseDependencies = {
    bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
    bodyDescriptionComposer: { composeDescription: jest.fn() },
    bodyGraphService: { getAllParts: jest.fn() },
    entityFinder: { getEntityInstance: jest.fn() },
    componentManager: { addComponent: jest.fn() },
    eventDispatchService: { safeDispatchEvent: jest.fn() },
    partDescriptionGenerator: { generatePartDescription: jest.fn() },
    bodyDescriptionOrchestrator: null,
    descriptionPersistenceService: null,
  };

  return {
    dependencies: { ...baseDependencies, ...overrides },
    service: new AnatomyDescriptionService({
      ...baseDependencies,
      ...overrides,
    }),
  };
};

describe('AnatomyDescriptionService orchestrator and persistence integration', () => {
  let orchestrator;
  let persistence;

  beforeEach(() => {
    orchestrator = {
      generateAllDescriptions: jest.fn(),
      generateBodyDescription: jest.fn(),
      getOrGenerateBodyDescription: jest.fn(),
    };

    persistence = {
      updateDescription: jest.fn(),
      updateMultipleDescriptions: jest.fn(),
    };
  });

  it('delegates generateAllDescriptions to the orchestrator and persists results', async () => {
    const partDescriptions = new Map([
      ['part-1', 'desc-1'],
      ['part-2', 'desc-2'],
    ]);

    orchestrator.generateAllDescriptions.mockResolvedValue({
      bodyDescription: 'body-desc',
      partDescriptions,
    });

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const entity = { id: 'entity-1' };
    await service.generateAllDescriptions(entity);

    expect(orchestrator.generateAllDescriptions).toHaveBeenCalledWith(entity);
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'entity-1',
      'body-desc',
    );
    expect(persistence.updateMultipleDescriptions).toHaveBeenCalledWith(
      partDescriptions,
    );
  });

  it('supports orchestrator delegation when no persistence service is provided', async () => {
    orchestrator.generateAllDescriptions.mockResolvedValue({
      bodyDescription: 'body-desc',
      partDescriptions: new Map(),
    });

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: null,
    });

    await expect(
      service.generateAllDescriptions({ id: 'entity-noop' }),
    ).resolves.toEqual({
      bodyDescription: 'body-desc',
      partDescriptions: expect.any(Map),
    });
    expect(orchestrator.generateAllDescriptions).toHaveBeenCalled();
  });

  it('uses partDescriptionGenerator when available and persists the description', () => {
    const partDescriptionGenerator = {
      generatePartDescription: jest.fn().mockReturnValue('arm-ready'),
    };

    const { service } = createService({
      partDescriptionGenerator,
      descriptionPersistenceService: persistence,
    });

    service.generatePartDescription('arm-1');

    expect(partDescriptionGenerator.generatePartDescription).toHaveBeenCalledWith(
      'arm-1',
    );
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'arm-1',
      'arm-ready',
    );
  });

  it('skips persistence when the part generator returns nothing', () => {
    const partDescriptionGenerator = {
      generatePartDescription: jest.fn().mockReturnValue(undefined),
    };

    const { service } = createService({
      partDescriptionGenerator,
      descriptionPersistenceService: persistence,
    });

    service.generatePartDescription('arm-2');

    expect(partDescriptionGenerator.generatePartDescription).toHaveBeenCalledWith(
      'arm-2',
    );
    expect(persistence.updateDescription).not.toHaveBeenCalled();
  });

  it('delegates generateBodyDescription to the orchestrator and persists the description', async () => {
    orchestrator.generateBodyDescription.mockResolvedValue('full-body');

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const bodyEntity = { id: 'entity-2' };
    await service.generateBodyDescription(bodyEntity);

    expect(orchestrator.generateBodyDescription).toHaveBeenCalledWith(
      bodyEntity,
    );
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'entity-2',
      'full-body',
    );
  });

  it('supports generateBodyDescription via orchestrator even without persistence', async () => {
    orchestrator.generateBodyDescription.mockResolvedValue('transient-body');

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: null,
    });

    const entity = { id: 'entity-3a' };
    await service.generateBodyDescription(entity);

    expect(orchestrator.generateBodyDescription).toHaveBeenCalledWith(entity);
  });

  it('returns orchestrator generated body description and persists it when applicable', async () => {
    orchestrator.getOrGenerateBodyDescription.mockResolvedValue('current-desc');

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const entity = createEntity('entity-3', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root-node' } },
    });

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('current-desc');
    expect(orchestrator.getOrGenerateBodyDescription).toHaveBeenCalledWith(
      entity,
    );
    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'entity-3',
      'current-desc',
    );
  });

  it('returns null without persisting when orchestrator provides no description', async () => {
    orchestrator.getOrGenerateBodyDescription.mockResolvedValue(null);

    const { service } = createService({
      bodyDescriptionOrchestrator: orchestrator,
      descriptionPersistenceService: persistence,
    });

    const entity = createEntity('entity-4', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root-node' } },
    });

    const description = await service.getOrGenerateBodyDescription(entity);

    expect(description).toBeNull();
    expect(persistence.updateDescription).not.toHaveBeenCalled();
  });

  it('returns the cached description when it is current for fallback logic', async () => {
    const { service, dependencies } = createService();
    const entity = createEntity('entity-8', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root-node' } },
      [DESCRIPTION_COMPONENT_ID]: { text: 'cached-summary' },
    });

    jest.spyOn(service, 'isDescriptionCurrent').mockReturnValue(true);

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('cached-summary');
    expect(dependencies.bodyDescriptionComposer.composeDescription).not.toHaveBeenCalled();
    expect(dependencies.componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('returns null when fallback composition does not produce a description', async () => {
    const { service, dependencies } = createService();
    dependencies.bodyDescriptionComposer.composeDescription.mockResolvedValue('');

    const entity = createEntity('entity-9', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root-node' } },
    });

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBeNull();
    expect(dependencies.componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('returns existing description for non-anatomy entities in fallback mode', async () => {
    const { service, dependencies } = createService();
    const entity = createEntity('entity-10', {
      [DESCRIPTION_COMPONENT_ID]: { text: 'non-anatomy description' },
    });

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('non-anatomy description');
    expect(dependencies.bodyDescriptionComposer.composeDescription).not.toHaveBeenCalled();
  });

  it('returns null for non-anatomy entities without existing descriptions', async () => {
    const { service, dependencies } = createService();
    const entity = createEntity('entity-11');

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBeNull();
    expect(dependencies.bodyDescriptionComposer.composeDescription).not.toHaveBeenCalled();
  });

  it('delegates updateDescription to the persistence service when available', () => {
    const { service } = createService({
      descriptionPersistenceService: persistence,
    });

    service.updateDescription('entity-5', 'stored');

    expect(persistence.updateDescription).toHaveBeenCalledWith(
      'entity-5',
      'stored',
    );
  });

  it('regenerates descriptions through generateAllDescriptions when entity has anatomy', () => {
    const { service, dependencies } = createService();
    const entity = createEntity('entity-6', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'origin' } },
    });

    dependencies.entityFinder.getEntityInstance.mockReturnValue(entity);
    const generateAllSpy = jest
      .spyOn(service, 'generateAllDescriptions')
      .mockResolvedValue(undefined);

    service.regenerateDescriptions('entity-6');

    expect(dependencies.entityFinder.getEntityInstance).toHaveBeenCalledWith(
      'entity-6',
    );
    expect(generateAllSpy).toHaveBeenCalledWith(entity);
  });

  it('regenerateDescriptions exits early when entity lacks anatomy information', () => {
    const { service, dependencies } = createService();
    const missingEntity = createEntity('entity-7', {
      [ANATOMY_PART_COMPONENT_ID]: {},
    });

    dependencies.entityFinder.getEntityInstance.mockReturnValue(missingEntity);
    const generateAllSpy = jest.spyOn(service, 'generateAllDescriptions');

    service.regenerateDescriptions('entity-7');

    expect(generateAllSpy).not.toHaveBeenCalled();
  });

  it('handles missing entities when persistence is not provided during updateDescription', () => {
    const { service, dependencies } = createService();
    dependencies.entityFinder.getEntityInstance.mockReturnValue(null);

    expect(() => service.updateDescription('missing', 'noop')).not.toThrow();
    expect(dependencies.componentManager.addComponent).not.toHaveBeenCalled();
  });

  it('exposes isDescriptionCurrent helper for completeness', () => {
    const { service } = createService();
    expect(service.isDescriptionCurrent({})).toBe(false);
  });
});
