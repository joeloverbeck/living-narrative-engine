import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService additional coverage', () => {
  let service;
  let mockBodyPartDescriptionBuilder;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockComponentManager;

  const createEntity = (id, components = {}) => ({
    id,
    hasComponent: jest.fn((c) => !!components[c]),
    getComponentData: jest.fn((c) => components[c]),
  });

  beforeEach(() => {
    mockBodyPartDescriptionBuilder = { buildDescription: jest.fn() };
    mockBodyDescriptionComposer = { composeDescription: jest.fn() };
    mockBodyGraphService = { getAllParts: jest.fn() };
    mockEntityFinder = { getEntityInstance: jest.fn() };
    mockComponentManager = { addComponent: jest.fn() };

    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      componentManager: mockComponentManager,
      eventDispatchService: { safeDispatchEvent: jest.fn() },
    });
  });

  it('generatePartDescription does nothing when builder returns empty string', () => {
    const entity = createEntity('part1', { [ANATOMY_PART_COMPONENT_ID]: {} });
    mockEntityFinder.getEntityInstance.mockReturnValue(entity);
    mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('');

    service.generatePartDescription('part1');

    expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
  });

  it('updateDescription handles missing entity gracefully', () => {
    mockEntityFinder.getEntityInstance.mockReturnValue(null);
    expect(() => service.updateDescription('missing', 'desc')).not.toThrow();
    expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
  });

  it('getOrGenerateBodyDescription returns existing when current', async () => {
    const entity = createEntity('body1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root' } },
      [DESCRIPTION_COMPONENT_ID]: { text: 'exists' },
    });
    mockEntityFinder.getEntityInstance.mockReturnValue(entity);
    jest.spyOn(service, 'isDescriptionCurrent').mockReturnValue(true);

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBe('exists');
    expect(
      mockBodyDescriptionComposer.composeDescription
    ).not.toHaveBeenCalled();
    expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
  });

  it('getOrGenerateBodyDescription returns null when composer returns null', async () => {
    const entity = createEntity('body1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root' } },
    });
    mockEntityFinder.getEntityInstance.mockReturnValue(entity);
    mockBodyDescriptionComposer.composeDescription.mockReturnValue(null);

    const result = await service.getOrGenerateBodyDescription(entity);

    expect(result).toBeNull();
    expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
  });

  it('regenerateDescriptions triggers generateAllDescriptions when applicable', () => {
    const entity = createEntity('body1', {
      [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'root' } },
    });
    mockEntityFinder.getEntityInstance.mockReturnValue(entity);
    jest.spyOn(service, 'generateAllDescriptions').mockImplementation(() => {});

    service.regenerateDescriptions('body1');

    expect(service.generateAllDescriptions).toHaveBeenCalledWith(entity);
  });

  it('isDescriptionCurrent always returns false', () => {
    expect(service.isDescriptionCurrent({})).toBe(false);
  });
});
