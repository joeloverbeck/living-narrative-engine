import { describe, it, expect, jest } from '@jest/globals';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import {
  createMockEventDispatchService,
  createMockLogger,
} from '../../common/mockFactories/index.js';

const createMockDataRegistry = (definitions) => ({
  get: jest.fn((type, id) => definitions.find((d) => d.id === id)),
  getAll: jest.fn(() => definitions),
});

describe('PartSelectionService additional branch coverage', () => {
  it('constructor validates required dependencies', () => {
    const logger = createMockLogger();
    const dispatchService = createMockEventDispatchService();
    expect(
      () =>
        new PartSelectionService({
          logger,
          eventDispatchService: dispatchService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new PartSelectionService({
          dataRegistry: {},
          eventDispatchService: dispatchService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () => new PartSelectionService({ dataRegistry: {}, logger })
    ).toThrow(InvalidArgumentError);
  });

  it('falls back when preferId does not meet requirements', async () => {
    const defs = [
      { id: 'preferred', components: { 'anatomy:part': { subType: 'leg' } } },
      { id: 'candidate', components: { 'anatomy:part': { subType: 'arm' } } },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const dispatchService = createMockEventDispatchService();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: dispatchService,
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart(
      { partType: 'arm' },
      ['arm'],
      { preferId: 'preferred' },
      rng
    );
    expect(result).toBe('candidate');
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining("Using preferred part 'preferred'")
    );
  });

  it('filters candidates using tags, exclusions and properties', async () => {
    const defs = [
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'arm' },
          tag1: {},
          tag2: {},
          stat: { locked: true },
        },
      },
      {
        id: 'missingTag',
        components: {
          'anatomy:part': { subType: 'arm' },
          tag1: {},
          stat: { locked: true },
        },
      },
      {
        id: 'excluded',
        components: {
          'anatomy:part': { subType: 'arm' },
          tag1: {},
          tag2: {},
          bad: {},
          stat: { locked: true },
        },
      },
      {
        id: 'wrongProp',
        components: {
          'anatomy:part': { subType: 'arm' },
          tag1: {},
          tag2: {},
          stat: { locked: false },
        },
      },
    ];

    const registry = createMockDataRegistry(defs);
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger: createMockLogger(),
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const recipeSlot = {
      tags: ['tag2'],
      notTags: ['bad'],
      properties: { stat: { locked: true } },
    };
    const result = await service.selectPart(
      { components: ['tag1'] },
      ['arm'],
      recipeSlot,
      rng
    );
    expect(result).toBe('valid');
    expect(rng).toHaveBeenCalled();
  });

  it('rejects candidates that fail base property requirements', async () => {
    const defs = [
      {
        id: 'fails-properties',
        components: {
          'anatomy:part': { subType: 'arm' },
          stat: { locked: false },
        },
      },
      {
        id: 'matches-properties',
        components: {
          'anatomy:part': { subType: 'arm' },
          stat: { locked: true },
        },
      },
    ];

    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0.3);
    const requirements = { properties: { stat: { locked: true } } };

    const result = await service.selectPart(requirements, ['arm'], undefined, rng);

    expect(result).toBe('matches-properties');
    expect(rng).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      "PartSelectionService: Selected 'matches-properties' from 1 candidates"
    );
  });

  it('builds detailed error context when no candidates match', async () => {
    const defs = [
      {
        id: 'only',
        components: {
          'anatomy:part': { subType: 'leg' },
          tag2: {},
        },
      },
    ];

    const registry = createMockDataRegistry(defs);
    const dispatchService = createMockEventDispatchService();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger: createMockLogger(),
      eventDispatchService: dispatchService,
    });

    const requirements = { partType: 'arm', components: ['tag1'] };
    const slot = { tags: ['tag2'], notTags: ['bad'] };

    await expect(
      service.selectPart(requirements, ['leg'], slot, Math.random)
    ).rejects.toThrow(ValidationError);

    const message = dispatchService.safeDispatchEvent.mock.calls[0][1].message;
    expect(message).toContain("Need part type: 'arm'");
    expect(message).toContain('Allowed types: [leg]');
    expect(message).toContain('Required components: [tag1]');
    expect(message).toContain('Required tags: [tag2]');
    expect(message).toContain('Excluded tags: [bad]');
  });

  it('logs diagnostic information when kraken_head definition is present', async () => {
    const krakenHead = {
      id: 'anatomy:kraken_head',
      components: {
        'anatomy:part': { subType: 'tentacle' },
      },
    };
    const defs = [krakenHead];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart({}, ['tentacle'], undefined, rng);

    expect(result).toBe('anatomy:kraken_head');
    expect(logger.info).toHaveBeenCalledWith(
      'PartSelectionService: Checking kraken_head against requirements',
      {
        entityId: 'anatomy:kraken_head',
        allowedTypes: ['tentacle'],
        requirements: {},
        hasAnatomyPart: true,
        subType: 'tentacle',
      }
    );
  });

  it('logs when kraken_head is missing the anatomy part component', async () => {
    const defs = [
      { id: 'anatomy:kraken_head', components: {} },
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart({}, ['arm'], undefined, rng);

    expect(result).toBe('valid');
    expect(logger.info).toHaveBeenCalledWith(
      'PartSelectionService: kraken_head FAILED - no anatomy:part component'
    );
  });

  it('logs when kraken_head subtype is not in allowed types', async () => {
    const defs = [
      {
        id: 'anatomy:kraken_head',
        components: {
          'anatomy:part': { subType: 'tentacle' },
        },
      },
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart({}, ['arm'], undefined, rng);

    expect(result).toBe('valid');
    expect(logger.info).toHaveBeenCalledWith(
      "PartSelectionService: kraken_head FAILED - subType 'tentacle' not in allowedTypes [arm]"
    );
  });

  it('logs when kraken_head subtype does not satisfy partType requirement', async () => {
    const defs = [
      {
        id: 'anatomy:kraken_head',
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      },
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'leg' },
        },
      },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart(
      { partType: 'leg' },
      ['arm', 'leg'],
      undefined,
      rng
    );

    expect(result).toBe('valid');
    expect(logger.info).toHaveBeenCalledWith(
      "PartSelectionService: kraken_head FAILED - subType 'arm' !== required 'leg'"
    );
  });

  it('logs missing required components for kraken_head', async () => {
    const defs = [
      {
        id: 'anatomy:kraken_head',
        components: {
          'anatomy:part': { subType: 'head' },
        },
      },
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'head' },
          'anatomy:brain': {},
        },
      },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const result = await service.selectPart(
      { components: ['anatomy:brain'] },
      ['head'],
      undefined,
      rng
    );

    expect(result).toBe('valid');
    expect(logger.info).toHaveBeenCalledWith(
      'PartSelectionService: kraken_head FAILED - missing required components: [anatomy:brain]',
      { hasComponents: ['anatomy:part'] }
    );
  });

  it('logs missing required tags for kraken_head', async () => {
    const defs = [
      {
        id: 'anatomy:kraken_head',
        components: {
          'anatomy:part': { subType: 'head' },
          'tag:fire': {},
        },
      },
      {
        id: 'valid',
        components: {
          'anatomy:part': { subType: 'head' },
          'tag:water': {},
        },
      },
    ];
    const registry = createMockDataRegistry(defs);
    const logger = createMockLogger();
    const service = new PartSelectionService({
      dataRegistry: registry,
      logger,
      eventDispatchService: createMockEventDispatchService(),
    });

    const rng = jest.fn().mockReturnValue(0);
    const recipeSlot = { tags: ['tag:water'] };
    const result = await service.selectPart({}, ['head'], recipeSlot, rng);

    expect(result).toBe('valid');
    expect(logger.info).toHaveBeenCalledWith(
      'PartSelectionService: kraken_head FAILED - missing required tags: [tag:water]',
      {
        requiredTags: ['tag:water'],
        hasComponents: expect.arrayContaining(['anatomy:part', 'tag:fire']),
      }
    );
  });
});
