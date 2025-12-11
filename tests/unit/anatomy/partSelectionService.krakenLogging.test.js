import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import {
  createMockEventDispatchService,
  createMockLogger,
} from '../../common/mockFactories/index.js';

const createMockDataRegistry = (definitions) => ({
  get: jest.fn((type, id) => definitions.find((d) => d.id === id)),
  getAll: jest.fn(() => definitions),
});

describe('PartSelectionService kraken diagnostics', () => {
  let mockLogger;
  let mockDispatchService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDispatchService = createMockEventDispatchService();
  });

  const createService = (definitions) =>
    new PartSelectionService({
      dataRegistry: createMockDataRegistry(definitions),
      logger: mockLogger,
      eventDispatchService: mockDispatchService,
    });

  it('logs detailed diagnostics when kraken tentacle passes validation', async () => {
    const definitions = [
      {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          'anatomy:part': { subType: 'tentacle' },
          tentacle_component: {},
          rare_tag: {},
        },
      },
    ];

    const service = createService(definitions);
    const requirements = {
      partType: 'tentacle',
      components: ['tentacle_component'],
    };
    const recipeSlot = { tags: ['rare_tag'] };

    const result = await service.selectPart(
      requirements,
      ['tentacle'],
      recipeSlot,
      () => 0
    );

    expect(result).toBe('anatomy-creatures:kraken_tentacle');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'PartSelectionService: Checking kraken_tentacle against requirements',
      expect.objectContaining({ entityId: 'anatomy-creatures:kraken_tentacle' })
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'PartSelectionService: kraken_tentacle PASSED all validation checks'
    );
  });

  it('logs missing anatomy component diagnostics for kraken tentacle', async () => {
    const definitions = [
      {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {},
      },
    ];

    const service = createService(definitions);

    await expect(
      service.selectPart(
        { partType: 'tentacle' },
        ['tentacle'],
        undefined,
        () => 0
      )
    ).rejects.toThrow(ValidationError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'PartSelectionService: kraken_tentacle FAILED - no anatomy:part component'
    );
  });

  it('logs allowed type mismatch diagnostics for kraken tentacle', async () => {
    const definitions = [
      {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      },
    ];

    const service = createService(definitions);

    await expect(
      service.selectPart({}, ['tentacle'], undefined, () => 0)
    ).rejects.toThrow(ValidationError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "PartSelectionService: kraken_tentacle FAILED - subType 'arm' not in allowedTypes [tentacle]"
    );
  });

  it('logs required partType mismatch diagnostics for kraken tentacle', async () => {
    const definitions = [
      {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          'anatomy:part': { subType: 'tentacle' },
        },
      },
    ];

    const service = createService(definitions);
    const requirements = { partType: 'special_tentacle' };

    await expect(
      service.selectPart(requirements, ['tentacle'], undefined, () => 0)
    ).rejects.toThrow(ValidationError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "PartSelectionService: kraken_tentacle FAILED - subType 'tentacle' !== required 'special_tentacle'"
    );
  });

  it('logs missing component diagnostics for kraken tentacle', async () => {
    const definitions = [
      {
        id: 'anatomy-creatures:kraken_tentacle',
        components: {
          'anatomy:part': { subType: 'tentacle' },
        },
      },
    ];

    const service = createService(definitions);
    const requirements = { components: ['bio_component'] };

    await expect(
      service.selectPart(requirements, ['tentacle'], undefined, () => 0)
    ).rejects.toThrow(ValidationError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'PartSelectionService: kraken_tentacle FAILED - missing required components: [bio_component]'
      ),
      expect.objectContaining({ hasComponents: ['anatomy:part'] })
    );
  });

  it('logs recipe tag failures for diagnostic tentacles', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const definitions = [
        {
          id: 'anatomy:tentacle',
          components: {
            'anatomy:part': { subType: 'tentacle' },
          },
        },
        {
          id: 'anatomy-creatures:kraken_tentacle',
          components: {
            'anatomy:part': { subType: 'tentacle' },
          },
        },
      ];

      const service = createService(definitions);
      const recipeSlot = { tags: ['diagnostic_tag'] };

      await expect(
        service.selectPart({}, ['tentacle'], recipeSlot, () => 0)
      ).rejects.toThrow(ValidationError);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'anatomy:tentacle FAILED - missing required tags'
        )
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'PartSelectionService: kraken_tentacle FAILED - missing required tags'
        ),
        expect.objectContaining({ requiredTags: ['diagnostic_tag'] })
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
