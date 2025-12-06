/**
 * @file Unit tests for PartSelectionService with generic tentacle entities
 * @see src/anatomy/partSelectionService.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PartSelectionService from '../../../src/anatomy/partSelectionService.js';

describe('PartSelectionService - Generic Tentacle Selection', () => {
  let service;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatchService;

  beforeEach(() => {
    // Mock logger with required methods
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock event dispatch service
    mockEventDispatchService = {
      dispatch: jest.fn(),
      safeDispatchEvent: jest.fn(),
    };

    // Mock data registry with generic tentacle entity
    mockDataRegistry = {
      getEntityDefinition: jest.fn((entityId) => {
        if (entityId === 'anatomy:tentacle') {
          return {
            id: 'anatomy:tentacle',
            components: {
              'anatomy:part': { subType: 'tentacle' },
              'core:name': { text: 'tentacle' },
            },
          };
        }
        return null;
      }),
      getAllEntityDefinitions: jest.fn(() => [
        {
          id: 'anatomy:tentacle',
          components: {
            'anatomy:part': { subType: 'tentacle' },
            'core:name': { text: 'tentacle' },
          },
        },
      ]),
      getAll: jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'anatomy:tentacle',
              components: {
                'anatomy:part': { subType: 'tentacle' },
                'core:name': { text: 'tentacle' },
              },
            },
          ];
        }
        return [];
      }),
    };

    service = new PartSelectionService({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatchService: mockEventDispatchService,
    });
  });

  it('should select generic tentacle for kraken pattern', async () => {
    const requirements = { partType: 'tentacle' };
    const allowedTypes = ['tentacle'];
    const descriptors = undefined;
    const randomFn = Math.random;

    const result = await service.selectPart(
      requirements,
      allowedTypes,
      descriptors,
      randomFn
    );

    expect(result).toBe('anatomy:tentacle');
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should filter by partType when multiple entities available', async () => {
    // Add another entity to the registry
    const entities = [
      {
        id: 'anatomy:tentacle',
        components: {
          'anatomy:part': { subType: 'tentacle' },
          'core:name': { text: 'tentacle' },
        },
      },
      {
        id: 'anatomy:arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'core:name': { text: 'arm' },
        },
      },
    ];
    mockDataRegistry.getAllEntityDefinitions = jest.fn(() => entities);
    mockDataRegistry.getAll = jest.fn((type) => {
      if (type === 'entityDefinitions') {
        return entities;
      }
      return [];
    });

    const requirements = { partType: 'tentacle' };
    const allowedTypes = ['tentacle'];

    const result = await service.selectPart(
      requirements,
      allowedTypes,
      undefined,
      Math.random
    );

    expect(result).toBe('anatomy:tentacle');
  });

  it('should throw error when allowed types is empty', async () => {
    const requirements = { partType: 'tentacle' };
    const allowedTypes = [];

    // Should throw ValidationError when no types are allowed
    await expect(
      service.selectPart(requirements, allowedTypes, undefined, Math.random)
    ).rejects.toThrow();
  });

  it('should throw error when no entities match partType', async () => {
    const requirements = { partType: 'nonexistent' };
    const allowedTypes = ['nonexistent'];

    await expect(
      service.selectPart(requirements, allowedTypes, undefined, Math.random)
    ).rejects.toThrow();
  });

  it('should work with tentacle in allowedTypes array', async () => {
    const requirements = { partType: 'tentacle' };
    const allowedTypes = ['tentacle', 'arm']; // Multiple allowed types

    const result = await service.selectPart(
      requirements,
      allowedTypes,
      undefined,
      Math.random
    );

    expect(result).toBe('anatomy:tentacle');
  });

  it('should log debug information during selection', async () => {
    const requirements = { partType: 'tentacle' };
    const allowedTypes = ['tentacle'];

    await service.selectPart(
      requirements,
      allowedTypes,
      undefined,
      Math.random
    );

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle case where generic tentacle replaces kraken_tentacle', async () => {
    // Simulate the migration scenario where old kraken_tentacle is gone
    mockDataRegistry.getEntityDefinition = jest.fn((entityId) => {
      if (entityId === 'anatomy:tentacle') {
        return {
          id: 'anatomy:tentacle',
          components: {
            'anatomy:part': { subType: 'tentacle' },
            'core:name': { text: 'tentacle' },
          },
        };
      }
      // Old kraken_tentacle no longer exists
      if (entityId === 'anatomy:kraken_tentacle') {
        return null;
      }
      return null;
    });

    const requirements = { partType: 'tentacle' };
    const allowedTypes = ['tentacle'];

    const result = await service.selectPart(
      requirements,
      allowedTypes,
      undefined,
      Math.random
    );

    expect(result).toBe('anatomy:tentacle');
    expect(mockDataRegistry.getEntityDefinition).not.toHaveBeenCalledWith(
      'anatomy:kraken_tentacle'
    );
  });
});
