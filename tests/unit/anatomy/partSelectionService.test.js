import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import {
  createMockEventDispatchService,
  createMockLogger,
} from '../../common/mockFactories/index.js';

/**
 * Creates a minimal mock data registry holding entity definitions.
 *
 * @param {object[]} definitions - Definitions to return from the registry
 * @returns {{get: jest.Mock, getAll: jest.Mock}} Mock registry
 */
const createMockDataRegistry = (definitions) => ({
  get: jest.fn((type, id) => definitions.find((d) => d.id === id)),
  getAll: jest.fn(() => definitions),
});

describe('PartSelectionService', () => {
  let service;
  let mockRegistry;
  let mockLogger;
  let mockDispatchService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDispatchService = createMockEventDispatchService();
  });

  it('uses preferId when all requirements are met', async () => {
    const defs = [
      {
        id: 'preferred',
        components: {
          'anatomy:part': { subType: 'arm' },
          tag1: {},
          compA: { foo: 'bar' },
        },
      },
    ];
    mockRegistry = createMockDataRegistry(defs);
    service = new PartSelectionService({
      dataRegistry: mockRegistry,
      logger: mockLogger,
      eventDispatchService: mockDispatchService,
    });

    const requirements = {
      partType: 'arm',
      components: ['tag1'],
      properties: { compA: { foo: 'bar' } },
    };

    const result = await service.selectPart(
      requirements,
      ['arm'],
      { preferId: 'preferred' },
      Math.random
    );

    expect(result).toBe('preferred');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "PartSelectionService: Using preferred part 'preferred'"
    );
  });

  it('selects a candidate when preferId is absent', async () => {
    const defs = [
      {
        id: 'a',
        components: { 'anatomy:part': { subType: 'arm' } },
      },
      {
        id: 'b',
        components: { 'anatomy:part': { subType: 'arm' } },
      },
    ];
    mockRegistry = createMockDataRegistry(defs);
    service = new PartSelectionService({
      dataRegistry: mockRegistry,
      logger: mockLogger,
      eventDispatchService: mockDispatchService,
    });

    const rng = jest.fn().mockReturnValue(0.6); // pick second entry
    const result = await service.selectPart({}, ['arm'], undefined, rng);

    expect(result).toBe('b');
    expect(rng).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("PartSelectionService: Selected 'b'")
    );
  });

  it('throws ValidationError and dispatches event when no candidates found', async () => {
    const defs = [
      {
        id: 'a',
        components: { 'anatomy:part': { subType: 'arm' }, tagExcluded: {} },
      },
    ];
    mockRegistry = createMockDataRegistry(defs);
    service = new PartSelectionService({
      dataRegistry: mockRegistry,
      logger: mockLogger,
      eventDispatchService: mockDispatchService,
    });

    const requirements = {
      partType: 'leg',
      components: ['tag1'],
      properties: { compA: { color: 'blue' } },
    };
    const slot = { tags: ['tag2'], notTags: ['tagExcluded'] };

    await expect(
      service.selectPart(requirements, ['leg'], slot, Math.random)
    ).rejects.toThrow(ValidationError);

    expect(mockDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('No entity definitions found'),
      })
    );
  });
});
