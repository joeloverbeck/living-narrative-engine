import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import SlotResolver from '../../../../src/anatomy/integration/SlotResolver.js';
import { ClothingSlotNotFoundError } from '../../../../src/errors/clothingSlotErrors.js';
import BlueprintSlotStrategy from '../../../../src/anatomy/integration/strategies/BlueprintSlotStrategy.js';
import DirectSocketStrategy from '../../../../src/anatomy/integration/strategies/DirectSocketStrategy.js';
import ClothingSlotMappingStrategy from '../../../../src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js';
import { CacheKeyTypes } from '../../../../src/anatomy/cache/AnatomyClothingCache.js';
import { ensureValidLogger } from '../../../../src/utils/loggerUtils.js';
import { assertPresent, validateDependency } from '../../../../src/utils/dependencyUtils.js';

jest.mock('../../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
  assertPresent: jest.fn((value, message) => {
    if (value === undefined || value === null) {
      throw new Error(message);
    }
  }),
}));

jest.mock('../../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn((logger) => logger),
}));

jest.mock('../../../../src/anatomy/cache/AnatomyClothingCache.js', () => {
  const mockCreateSlotResolutionKey = jest.fn((entityId, slotId) => `${entityId}:${slotId}`);
  return {
    __esModule: true,
    CacheKeyTypes: { SLOT_RESOLUTION: 'slot_resolution' },
    AnatomyClothingCache: { createSlotResolutionKey: mockCreateSlotResolutionKey },
    __mockCreateSlotResolutionKey: mockCreateSlotResolutionKey,
  };
});

const { __mockCreateSlotResolutionKey: mockCreateSlotResolutionKey } = jest.requireMock(
  '../../../../src/anatomy/cache/AnatomyClothingCache.js'
);

jest.mock('../../../../src/anatomy/integration/strategies/BlueprintSlotStrategy.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../../src/anatomy/integration/strategies/DirectSocketStrategy.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../../src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('SlotResolver', () => {
  /** @type {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} */
  let logger;
  let blueprintStrategy;
  let directStrategy;
  let clothingStrategy;

  const createLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const defaultDeps = () => ({
    logger,
    entityManager: { getComponentData: jest.fn(), getEntityInstance: jest.fn() },
    bodyGraphService: { getAllParts: jest.fn() },
    anatomyBlueprintRepository: { getBlueprint: jest.fn() },
    anatomySocketIndex: { findSockets: jest.fn() },
    slotEntityMappings: new Map([
      ['torso', 'entity-torso'],
    ]),
  });

  const installStrategyMocks = () => {
    blueprintStrategy = {
      constructor: { name: 'BlueprintSlotStrategy' },
      canResolve: jest.fn(() => true),
      resolve: jest.fn(async () => ['bp:attachment']),
      setSlotEntityMappings: jest.fn(),
    };
    directStrategy = {
      constructor: { name: 'DirectSocketStrategy' },
      canResolve: jest.fn(() => false),
      resolve: jest.fn(async () => ['direct:attachment']),
    };
    clothingStrategy = {
      constructor: { name: 'ClothingSlotMappingStrategy' },
      canResolve: jest.fn(() => false),
      resolve: jest.fn(async () => ['clothing:attachment']),
    };

    BlueprintSlotStrategy.mockImplementation(() => blueprintStrategy);
    DirectSocketStrategy.mockImplementation(() => directStrategy);
    ClothingSlotMappingStrategy.mockImplementation(() => clothingStrategy);
  };

  const createResolver = (overrides = {}) => {
    return new SlotResolver({
      ...defaultDeps(),
      ...overrides,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger();
    installStrategyMocks();
  });

  it('constructs default strategies and validates each dependency', () => {
    const deps = defaultDeps();

    const resolver = new SlotResolver(deps);

    expect(ensureValidLogger).toHaveBeenCalledWith(logger, 'SlotResolver');
    expect(BlueprintSlotStrategy).toHaveBeenCalledWith({
      logger,
      entityManager: deps.entityManager,
      bodyGraphService: deps.bodyGraphService,
      anatomyBlueprintRepository: deps.anatomyBlueprintRepository,
      anatomySocketIndex: deps.anatomySocketIndex,
      slotEntityMappings: deps.slotEntityMappings,
    });
    expect(DirectSocketStrategy).toHaveBeenCalledWith({
      logger,
      entityManager: deps.entityManager,
      bodyGraphService: deps.bodyGraphService,
    });
    expect(ClothingSlotMappingStrategy).toHaveBeenCalledWith({
      logger,
      entityManager: deps.entityManager,
      anatomyBlueprintRepository: deps.anatomyBlueprintRepository,
      blueprintSlotStrategy: blueprintStrategy,
      directSocketStrategy: directStrategy,
    });
    expect(validateDependency).toHaveBeenCalledTimes(3);
    expect(resolver.getStrategyCount()).toBe(3);
  });

  it('accepts custom strategies without instantiating defaults', () => {
    const customStrategies = [
      { constructor: { name: 'CustomA' }, canResolve: jest.fn(), resolve: jest.fn() },
      { constructor: { name: 'CustomB' }, canResolve: jest.fn(), resolve: jest.fn() },
    ];

    const resolver = new SlotResolver({
      ...defaultDeps(),
      strategies: customStrategies,
    });

    expect(BlueprintSlotStrategy).not.toHaveBeenCalled();
    expect(DirectSocketStrategy).not.toHaveBeenCalled();
    expect(ClothingSlotMappingStrategy).not.toHaveBeenCalled();
    expect(validateDependency).toHaveBeenCalledTimes(customStrategies.length);
    expect(resolver.getStrategyCount()).toBe(customStrategies.length);
  });

  it('returns cached slot resolution results with AnatomyClothingCache service', async () => {
    const cachedAttachment = ['cached'];
    const cache = {
      get: jest.fn((cacheType, key) => cachedAttachment),
      set: jest.fn((cacheType, key, value) => value),
      clearType: jest.fn(),
    };

    const resolver = createResolver({ cache });

    const result = await resolver.resolve('actor-1', 'slot-1', { type: 'mock' });

    expect(mockCreateSlotResolutionKey).toHaveBeenCalledWith('actor-1', 'slot-1');
    expect(cache.get).toHaveBeenCalledWith(CacheKeyTypes.SLOT_RESOLUTION, 'actor-1:slot-1');
    expect(cache.set).not.toHaveBeenCalled();
    expect(result).toBe(cachedAttachment);
  });

  it('returns cached results using legacy map-style caches', async () => {
    const legacyCache = new Map();
    legacyCache.set('actor-1:legacy-slot', ['legacy-cached']);

    const resolver = createResolver({ cache: legacyCache });

    const result = await resolver.resolve('actor-1', 'legacy-slot', { type: 'legacy' });

    expect(result).toEqual(['legacy-cached']);
    expect(logger.debug).toHaveBeenCalledWith(
      'Cache hit for slot resolution: actor-1:legacy-slot'
    );
  });

  it('resolves using strategies and caches the result when not cached', async () => {
    const cache = {
      get: jest
        .fn((cacheType, key) => undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(['cached-second-call']),
      set: jest.fn((cacheType, key, value) => value),
      clearType: jest.fn(),
    };
    clothingStrategy.canResolve.mockReturnValueOnce(false);
    blueprintStrategy.resolve.mockResolvedValueOnce(['bp-1', 'bp-2']);

    const resolver = createResolver({ cache });

    const result = await resolver.resolve('actor-7', 'slot-arm', { type: 'blueprint' });

    expect(cache.get).toHaveBeenCalledWith(CacheKeyTypes.SLOT_RESOLUTION, 'actor-7:slot-arm');
    expect(blueprintStrategy.resolve).toHaveBeenCalledWith('actor-7', { type: 'blueprint' });
    expect(cache.set).toHaveBeenCalledWith(
      CacheKeyTypes.SLOT_RESOLUTION,
      'actor-7:slot-arm',
      ['bp-1', 'bp-2']
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "Resolved slot 'slot-arm' to 2 attachment points using BlueprintSlotStrategy"
    );
    expect(result).toEqual(['bp-1', 'bp-2']);

    const cached = await resolver.resolve('actor-7', 'slot-arm', { type: 'blueprint' });
    expect(cached).toEqual(['cached-second-call']);
  });

  it('stores resolved results in legacy map caches when modern interface is unavailable', async () => {
    clothingStrategy.canResolve.mockReturnValueOnce(false);
    blueprintStrategy.resolve.mockResolvedValueOnce(['legacy-result']);
    const legacyCache = new Map();

    const resolver = createResolver({ cache: legacyCache });

    const result = await resolver.resolve('actor-legacy', 'legacy-slot', {
      type: 'blueprint',
    });

    expect(result).toEqual(['legacy-result']);
    expect(legacyCache.get('actor-legacy:legacy-slot')).toEqual(['legacy-result']);
  });

  it('logs a warning and returns an empty array when no strategy can resolve a mapping', async () => {
    clothingStrategy.canResolve.mockReturnValue(false);
    blueprintStrategy.canResolve.mockReturnValue(false);
    directStrategy.canResolve.mockReturnValue(false);

    const resolver = createResolver({
      cache: {
        get: jest.fn((cacheType, key) => undefined),
        set: jest.fn((cacheType, key, value) => value),
        clearType: jest.fn(),
      },
    });

    const result = await resolver.resolve('actor-x', 'slot-x', { kind: 'unsupported' });

    expect(logger.warn).toHaveBeenCalledWith("No strategy found for mapping type in slot 'slot-x'");
    expect(result).toEqual([]);
  });

  it('logs errors from strategies and rethrows them', async () => {
    const failure = new Error('strategy failed');
    clothingStrategy.canResolve.mockReturnValueOnce(true);
    clothingStrategy.resolve.mockRejectedValueOnce(failure);

    const resolver = createResolver({
      cache: {
        get: jest.fn((cacheType, key) => undefined),
        set: jest.fn((cacheType, key, value) => value),
        clearType: jest.fn(),
      },
    });

    await expect(
      resolver.resolve('actor-fail', 'slot-fail', { type: 'clothing' })
    ).rejects.toThrow(failure);

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to resolve slot 'slot-fail' for entity 'actor-fail'",
      failure
    );
  });

  it('validates required parameters using assertPresent', async () => {
    const resolver = createResolver({
      cache: {
        get: jest.fn((cacheType, key) => undefined),
        set: jest.fn((cacheType, key, value) => value),
        clearType: jest.fn(),
      },
    });
    assertPresent.mockClear();

    await expect(resolver.resolve(undefined, 'slot', {})).rejects.toThrow('Entity ID is required');
    await expect(resolver.resolve('actor', undefined, {})).rejects.toThrow('Slot ID is required');
    await expect(resolver.resolve('actor', 'slot', null)).rejects.toThrow('Mapping is required');

    expect(assertPresent).toHaveBeenCalledWith(undefined, 'Entity ID is required');
    expect(assertPresent).toHaveBeenCalledWith(undefined, 'Slot ID is required');
    expect(assertPresent).toHaveBeenCalledWith(null, 'Mapping is required');
  });

  it('adds custom strategies after validating dependencies', () => {
    const resolver = createResolver();
    const customStrategy = { constructor: { name: 'InjectedStrategy' }, canResolve: jest.fn(), resolve: jest.fn() };

    validateDependency.mockClear();
    resolver.addStrategy(customStrategy);

    expect(validateDependency).toHaveBeenCalledWith(customStrategy, 'ISlotResolutionStrategy', null, {
      requiredMethods: ['canResolve', 'resolve'],
    });
    expect(resolver.getStrategyCount()).toBe(4);
    expect(logger.debug).toHaveBeenCalledWith('Added new strategy: InjectedStrategy');
  });

  it('clears cached results using the cache service when available', () => {
    const cache = { get: jest.fn(), set: jest.fn(), clearType: jest.fn() };
    const resolver = createResolver({ cache });

    resolver.clearCache();

    expect(cache.clearType).toHaveBeenCalledWith(CacheKeyTypes.SLOT_RESOLUTION);
    expect(logger.debug).toHaveBeenCalledWith('Slot resolution cache cleared');
  });

  it('falls back to clearing legacy caches that only expose clear()', () => {
    const legacyCache = {
      get: jest.fn(() => undefined),
      set: jest.fn(),
      clear: jest.fn(),
    };
    const resolver = createResolver({ cache: legacyCache });

    resolver.clearCache();

    expect(legacyCache.clear).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('Slot resolution cache cleared');
  });

  it('updates blueprint strategy slot mappings when available', () => {
    const resolver = createResolver();
    const newMappings = new Map([
      ['arm', 'entity-arm'],
    ]);

    resolver.setSlotEntityMappings(newMappings);

    expect(blueprintStrategy.setSlotEntityMappings).toHaveBeenCalledWith(newMappings);
  });

  it('silently ignores slot mapping updates when blueprint strategy lacks the updater', () => {
    blueprintStrategy.setSlotEntityMappings = undefined;
    const resolver = createResolver({ strategies: [blueprintStrategy] });

    expect(() => resolver.setSlotEntityMappings(new Map())).not.toThrow();
  });

  it('resolves clothing slots strictly through the clothing slot mapping strategy', async () => {
    clothingStrategy.canResolve.mockImplementation(({ clothingSlotId }) => clothingSlotId === 'belt');
    clothingStrategy.resolve.mockResolvedValueOnce(['resolved-belt']);
    const resolver = createResolver();

    assertPresent.mockClear();
    const result = await resolver.resolveClothingSlot('actor-4', 'belt');

    expect(assertPresent).toHaveBeenNthCalledWith(1, 'actor-4', 'Entity ID is required');
    expect(assertPresent).toHaveBeenNthCalledWith(2, 'belt', 'Slot ID is required');
    expect(clothingStrategy.resolve).toHaveBeenCalledWith('actor-4', { clothingSlotId: 'belt' });
    expect(result).toEqual(['resolved-belt']);
  });

  it('throws a ClothingSlotNotFoundError when no clothing slot strategy is registered', async () => {
    clothingStrategy.canResolve.mockReturnValue(false);
    blueprintStrategy.canResolve.mockReturnValue(false);
    directStrategy.canResolve.mockReturnValue(false);
    const resolver = createResolver();

    await expect(resolver.resolveClothingSlot('actor-2', 'missing-slot')).rejects.toBeInstanceOf(
      ClothingSlotNotFoundError
    );
  });
});
