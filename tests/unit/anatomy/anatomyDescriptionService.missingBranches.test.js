import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';

const createEntity = (id, components = {}) => ({
  id,
  hasComponent: jest.fn((c) => !!components[c]),
  getComponentData: jest.fn((c) => components[c]),
});

describe('AnatomyDescriptionService missing branch', () => {
  let service;
  let mockComposer;
  let mockFinder;
  let mockManager;

  beforeEach(() => {
    mockComposer = { composeDescription: jest.fn() };
    mockFinder = { getEntityInstance: jest.fn() };
    mockManager = { addComponent: jest.fn() };
    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
      bodyDescriptionComposer: mockComposer,
      bodyGraphService: { getAllParts: jest.fn() },
      entityFinder: mockFinder,
      componentManager: mockManager,
      eventDispatchService: { safeDispatchEvent: jest.fn() },
    });
  });

  it('returns null for non-anatomy entity without description', () => {
    const entity = createEntity('npc1', {});

    const result = service.getOrGenerateBodyDescription(entity);

    expect(result).toBeNull();
    expect(mockComposer.composeDescription).not.toHaveBeenCalled();
    expect(mockManager.addComponent).not.toHaveBeenCalled();
  });
});
