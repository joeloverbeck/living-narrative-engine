// tests/integration/loaders/scopeLoader.integration.test.js

import ScopeLoader from '../../../src/loaders/scopeLoader.js';
import TextDataFetcher from '../../../src/data/textDataFetcher.js';
import {
  createMockConfiguration,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';
import { SCOPES_KEY } from '../../../src/constants/dataRegistryKeys.js';

describe('ScopeLoader Integration Tests', () => {
  let scopeLoader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    mockConfig = createMockConfiguration();

    mockPathResolver = {
      resolvePath: jest.fn(
        (modId, diskFolder, filename) =>
          `./data/mods/${modId}/${diskFolder}/${filename}`
      ),
      resolveModContentPath: jest.fn(
        (modId, registryKey, filename) =>
          `./data/mods/${modId}/scopes/${filename}`
      ),
    };

    mockDataFetcher = new TextDataFetcher();

    mockSchemaValidator = createMockSchemaValidator();
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.validate.mockReturnValue({
      isValid: true,
      errors: null,
    });

    mockDataRegistry = createSimpleMockDataRegistry();

    mockLogger = createMockLogger();

    scopeLoader = new ScopeLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('loading real scope files', () => {
    beforeEach(() => {
      // Mock fetch to return real scope file content
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
    });

    it('should successfully load a simple scope definition', async () => {
      const scopeContent = 'core:directions := location.core:exits[].target';

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(scopeContent),
      });

      const manifest = {
        content: {
          scopes: ['directions.scope'],
        },
      };

      const result = await scopeLoader.loadItemsForMod(
        'core',
        manifest,
        SCOPES_KEY,
        SCOPES_KEY,
        SCOPES_KEY
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockDataRegistry.store).toHaveBeenCalledWith(
        SCOPES_KEY,
        'core:directions',
        expect.objectContaining({
          name: 'core:directions',
          expr: 'location.core:exits[].target',
          modId: 'core',
          source: 'file',
        })
      );
    });

    it('should use TextDataFetcher, not WorkspaceDataFetcher', () => {
      // Verify that the ScopeLoader is using TextDataFetcher
      expect(scopeLoader._dataFetcher).toBeInstanceOf(TextDataFetcher);
    });

    it('should NOT try to parse scope content as JSON', async () => {
      const scopeContent = 'core:directions := location.core:exits[].target';

      // Mock a response that would fail JSON parsing but should work for text
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(scopeContent),
      });

      const manifest = {
        content: {
          scopes: ['directions.scope'],
        },
      };

      // This should NOT throw a JSON parsing error
      await expect(
        scopeLoader.loadItemsForMod(
          'core',
          manifest,
          SCOPES_KEY,
          SCOPES_KEY,
          SCOPES_KEY
        )
      ).resolves.not.toThrow();
    });
  });
});
