import { describe, expect, test, jest } from '@jest/globals';
import StatusEffectRegistryLoader from '../../../src/loaders/statusEffectRegistryLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class TestConfiguration {
  getModsBasePath() {
    return '/mods';
  }

  getContentTypeSchemaId(key) {
    return key === 'statusEffects'
      ? 'schema://living-narrative-engine/status-effect.registry.schema.json'
      : null;
  }
}

class TestPathResolver {
  resolveModContentPath(modId, diskFolder, filename) {
    return `/mods/${modId}/${diskFolder}/${filename}`;
  }
}

describe('StatusEffectRegistryLoader', () => {
  test('stores registry entries using the statusEffects registry key', async () => {
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const dataRegistry = new InMemoryDataRegistry({ logger });
    const pathResolver = new TestPathResolver();
    const config = new TestConfiguration();
    const registryPayload = {
      id: 'anatomy:status_effects',
      effects: [{ id: 'bleeding', effectType: 'bleed', defaults: {} }],
    };
    const dataFetcher = {
      fetch: jest.fn(async (path) => {
        if (path.includes('status-effects.registry.json')) {
          return registryPayload;
        }
        throw new Error(`Unexpected path ${path}`);
      }),
    };
    const schemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      getValidator: jest.fn().mockReturnValue(() => true),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    const loader = new StatusEffectRegistryLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    const manifest = {
      content: {
        statusEffects: ['status-effects.registry.json'],
      },
    };

    await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'statusEffects',
      'status-effects',
      'statusEffects'
    );

    const stored = dataRegistry.getAll('statusEffects');
    expect(stored).toHaveLength(1);
    expect(stored[0]._fullId).toBe('anatomy:status_effects');
    expect(stored[0].effects[0]).toEqual(
      expect.objectContaining({ id: 'bleeding', effectType: 'bleed' })
    );
  });
});
