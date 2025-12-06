import { storeItemInRegistry } from '../../../src/utils/registryStoreUtils.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { SCOPES_KEY } from '../../../src/constants/dataRegistryKeys.js';
import DuplicateContentError from '../../../src/errors/duplicateContentError.js';

class TestLogger {
  constructor() {
    this.debug = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.error = jest.fn();
  }
}

describe('storeItemInRegistry integration with real registry', () => {
  /** @type {TestLogger} */
  let logger;
  /** @type {InMemoryDataRegistry} */
  let registry;

  beforeEach(() => {
    logger = new TestLogger();
    registry = new InMemoryDataRegistry({ logger });
  });

  it('stores plain objects with metadata and delegates to the registry', () => {
    const storeSpy = jest.spyOn(registry, 'store');

    const result = storeItemInRegistry(
      logger,
      registry,
      'ComponentLoader',
      'components',
      'core',
      'vision',
      { value: 42 },
      'mods/core/components/vision.json'
    );

    expect(result).toEqual({ qualifiedId: 'core:vision', didOverride: false });
    expect(storeSpy).toHaveBeenCalledWith(
      'components',
      'core:vision',
      expect.objectContaining({ value: 42 })
    );

    const stored = registry.get('components', 'core:vision');
    expect(stored).toMatchObject({
      value: 42,
      _modId: 'core',
      _sourceFile: 'mods/core/components/vision.json',
      _fullId: 'core:vision',
      id: 'vision',
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'ComponentLoader [core]: Storing item in registry'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "ComponentLoader [core]: Item 'core:vision' (Base: 'vision') stored successfully"
      )
    );
  });

  it('qualifies special categories and prevents duplicate content', () => {
    storeItemInRegistry(
      logger,
      registry,
      'ActionLoader',
      'actions',
      'core',
      'dash',
      { staminaCost: 3 },
      'mods/core/actions/dash.json'
    );

    const stored = registry.get('actions', 'core:dash');
    expect(stored).toMatchObject({
      staminaCost: 3,
      id: 'core:dash',
      _fullId: 'core:dash',
    });

    let capturedError;
    try {
      storeItemInRegistry(
        logger,
        registry,
        'ActionLoader',
        'actions',
        'core',
        'dash',
        { staminaCost: 4 },
        'mods/core/actions/dash.json'
      );
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DuplicateContentError);
    expect(capturedError.message).toContain(
      "Duplicate action identifier 'core:dash'"
    );
    expect(capturedError.context).toMatchObject({
      contentType: 'action',
      qualifiedId: 'core:dash',
      modId: 'core',
      existingModId: 'core',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('preserves class instances and defines metadata as read-only', () => {
    class Behavior {
      constructor(name) {
        this.name = name;
      }
    }

    const behavior = new Behavior('stealth');

    storeItemInRegistry(
      logger,
      registry,
      'BehaviorLoader',
      'behaviors',
      'core',
      'stealth',
      behavior,
      'mods/core/behaviors/stealth.js'
    );

    const stored = registry.get('behaviors', 'core:stealth');
    expect(stored).toBe(behavior);

    const modIdDescriptor = Object.getOwnPropertyDescriptor(stored, '_modId');
    const idDescriptor = Object.getOwnPropertyDescriptor(stored, 'id');
    expect(modIdDescriptor?.writable).toBe(false);
    expect(idDescriptor?.writable).toBe(false);
    expect(stored._modId).toBe('core');
    expect(stored._sourceFile).toBe('mods/core/behaviors/stealth.js');
    expect(stored.id).toBe('stealth');
  });

  describe('input validation', () => {
    const baseArgs = {
      loaderName: 'ScopeLoader',
      category: SCOPES_KEY,
      modId: 'core',
      baseItemId: 'zone',
      dataToStore: { visibility: 'public' },
      sourceFile: 'mods/core/scopes/zone.json',
    };

    it.each([
      ['category', { category: '' }, 'Category must be a non-empty string'],
      ['modId', { modId: '' }, 'ModId must be a non-empty string'],
      [
        'baseItemId',
        { baseItemId: '' },
        'BaseItemId must be a non-empty string',
      ],
      [
        'dataToStore',
        { dataToStore: 17 },
        "Data for 'core:zone' (category: scopes) must be an object",
      ],
    ])('validates %s and logs errors', (_, overrides, expectedMessage) => {
      const args = { ...baseArgs, ...overrides };
      const storeSpy = jest.spyOn(registry, 'store');

      expect(() =>
        storeItemInRegistry(
          logger,
          registry,
          args.loaderName,
          args.category,
          args.modId,
          args.baseItemId,
          args.dataToStore,
          args.sourceFile
        )
      ).toThrow(TypeError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(expectedMessage)
      );
      expect(storeSpy).not.toHaveBeenCalled();
    });
  });

  it('prefers legacy modId metadata when _modId is absent', () => {
    registry.store('customTypes', 'core:artifact', { modId: 'legacy-pack' });

    let capturedError;
    try {
      storeItemInRegistry(
        logger,
        registry,
        'LegacyLoader',
        'customTypes',
        'core',
        'artifact',
        { rarity: 'legendary' },
        'mods/core/customTypes/artifact.json'
      );
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DuplicateContentError);
    expect(capturedError.context).toMatchObject({
      existingModId: 'legacy-pack',
      contentType: 'customType',
    });
  });

  it('falls back to unknown when existing metadata is missing', () => {
    registry.store('custom', 'core:token', { rarity: 'common' });

    let capturedError;
    try {
      storeItemInRegistry(
        logger,
        registry,
        'CustomLoader',
        'custom',
        'core',
        'token',
        { rarity: 'rare' },
        'mods/core/custom/token.json'
      );
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(DuplicateContentError);
    expect(capturedError.context).toMatchObject({
      existingModId: 'unknown',
      contentType: 'custom',
    });
  });
});
