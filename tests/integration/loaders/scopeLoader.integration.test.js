// tests/integration/loaders/scopeLoader.integration.test.js

import ScopeLoader from '../../../src/loaders/scopeLoader.js';
import TextDataFetcher from '../../../src/data/textDataFetcher.js';
import { createMockConfiguration } from '../../common/mockFactories/index.js';

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
      resolvePath: jest.fn((modId, diskFolder, filename) => 
        `./data/mods/${modId}/${diskFolder}/${filename}`
      ),
      resolveModContentPath: jest.fn((modId, registryKey, filename) => 
        `./data/mods/${modId}/scopes/${filename}`
      ),
    };

    // Use the actual TextDataFetcher for integration testing
    mockDataFetcher = new TextDataFetcher();
    
    mockSchemaValidator = {
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      getValidator: jest.fn(),
      isSchemaLoaded: jest.fn(() => true),
      validate: jest.fn(() => ({ isValid: true, errors: null })),
    };

    mockDataRegistry = {
      store: jest.fn(),
      get: jest.fn(() => undefined),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

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
      const scopeContent = 'directions := location.core:exits[].target';
      
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
        'scopes',
        'scopes',
        'scopes'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockDataRegistry.store).toHaveBeenCalledWith(
        'scopes',
        'core:directions',
        expect.objectContaining({
          name: 'core:directions',
          dsl: 'location.core:exits[].target',
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
      const scopeContent = 'directions := location.core:exits[].target';
      
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
      await expect(scopeLoader.loadItemsForMod(
        'core',
        manifest,
        'scopes',
        'scopes',
        'scopes'
      )).resolves.not.toThrow();
    });
  });
}); 