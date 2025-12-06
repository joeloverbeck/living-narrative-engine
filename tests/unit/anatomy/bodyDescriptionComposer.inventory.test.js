import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Inventory', () => {
  let composer;
  let mockAnatomyFormattingService;
  let mockEntityFinder;
  let mockBodyGraphService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn().mockReturnValue(['inventory']),
      getEquipmentIntegrationConfig: jest.fn().mockReturnValue({}),
      getActivityIntegrationConfig: jest.fn().mockReturnValue({}),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue([]),
    };

    composer = new BodyDescriptionComposer({
      anatomyFormattingService: mockAnatomyFormattingService,
      entityFinder: mockEntityFinder,
      bodyGraphService: mockBodyGraphService,
      logger: mockLogger,
    });
  });

  it('should include conspicuous items in description', async () => {
    const actor = {
      id: 'actor1',
      hasComponent: jest.fn().mockImplementation((id) => {
        return id === 'items:inventory' || id === 'anatomy:body';
      }),
      getComponentData: jest.fn().mockImplementation((id) => {
        if (id === 'anatomy:body') return { body: { root: 'torso' } };
        if (id === 'items:inventory') {
          return { items: ['item1', 'item2'] };
        }
        return null;
      }),
    };

    const item1 = {
      id: 'item1',
      hasComponent: jest.fn((id) => id === 'core:conspicuous'),
      getComponentData: jest.fn((id) => {
        if (id === 'core:name') return { text: 'conspicuous sword' };
        return null;
      }),
    };

    const item2 = {
      id: 'item2',
      hasComponent: jest.fn((id) => false), // Not conspicuous
      getComponentData: jest.fn((id) => {
        if (id === 'core:name') return { text: 'hidden dagger' };
        return null;
      }),
    };

    mockEntityFinder.getEntityInstance
      .mockReturnValueOnce(item1)
      .mockReturnValueOnce(item2);

    const description = await composer.composeDescription(actor);

    expect(description).toContain('Inventory: conspicuous sword.');
    expect(description).not.toContain('hidden dagger');
  });

  it('should return empty string if no conspicuous items', async () => {
    const actor = {
      id: 'actor1',
      hasComponent: jest.fn().mockImplementation((id) => {
        return id === 'items:inventory' || id === 'anatomy:body';
      }),
      getComponentData: jest.fn().mockImplementation((id) => {
        if (id === 'anatomy:body') return { body: { root: 'torso' } };
        if (id === 'items:inventory') {
          return { items: ['item2'] };
        }
        return null;
      }),
    };

    const item2 = {
      id: 'item2',
      hasComponent: jest.fn((id) => false), // Not conspicuous
      getComponentData: jest.fn((id) => {
        if (id === 'core:name') return { text: 'hidden dagger' };
        return null;
      }),
    };

    mockEntityFinder.getEntityInstance.mockReturnValue(item2);

    const description = await composer.composeDescription(actor);

    expect(description).toBe('');
  });

  it('should return empty string if no inventory component', async () => {
    const actor = {
      id: 'actor1',
      hasComponent: jest.fn().mockImplementation((id) => {
        return id === 'anatomy:body'; // No inventory
      }),
      getComponentData: jest.fn().mockImplementation((id) => {
        if (id === 'anatomy:body') return { body: { root: 'torso' } };
        return null;
      }),
    };

    const description = await composer.composeDescription(actor);

    expect(description).toBe('');
  });
});
