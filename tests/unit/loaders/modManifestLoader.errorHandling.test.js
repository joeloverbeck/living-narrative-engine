import ModManifestLoader from '../../../src/modding/modManifestLoader.js';
import { ERR } from '../../../src/modding/modManifestLoader.js'; // Import ERR codes

describe('ModManifestLoader Error Handling', () => {
  let mockConfiguration;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;
  let modManifestLoader;

  const MOD_MANIFEST_SCHEMA_ID =
    'http://example.com/schemas/mod-manifest.schema.json';

  beforeEach(() => {
    mockConfiguration = {
      getContentTypeSchemaId: jest.fn((type) => {
        if (type === 'mod-manifest') return MOD_MANIFEST_SCHEMA_ID;
        return null;
      }),
    };
    mockPathResolver = {
      resolveModManifestPath: jest.fn(
        (modId) => `path/to/${modId}/mod-manifest.json`
      ),
    };
    mockDataFetcher = {
      fetch: jest.fn(),
    };
    mockSchemaValidator = {
      getValidator: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume schema is loaded
      addSchema: jest.fn(),
    };
    mockDataRegistry = {
      store: jest.fn(),
      get: jest.fn(),
      clear: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock a basic validator function
    const mockValidatorFn = jest.fn((data) => ({ isValid: true, errors: [] }));
    mockSchemaValidator.getValidator.mockReturnValue(mockValidatorFn);

    modManifestLoader = new ModManifestLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  test('should throw an error if fetching a manifest fails for a requested mod', async () => {
    const requestedModIds = ['core', 'modA', 'modB_fails'];
    const coreManifest = { id: 'core', name: 'Core Mod', version: '1.0.0' };
    const modAManifest = { id: 'modA', name: 'Mod A', version: '1.0.0' };
    const fetchError = new Error('Network Error');

    mockDataFetcher.fetch
      .mockResolvedValueOnce(coreManifest) // core succeeds
      .mockResolvedValueOnce(modAManifest) // modA succeeds
      .mockRejectedValueOnce(fetchError); // modB_fails

    // Ensure the validator function is called for successful fetches
    const mockValidatorFn = mockSchemaValidator.getValidator();
    mockValidatorFn.mockImplementation((data) => {
      // Basic check, actual validation isn't the focus here
      if (data && data.id) return { isValid: true, errors: [] };
      return { isValid: false, errors: [{ message: 'Missing id' }] };
    });

    await expect(
      modManifestLoader.loadRequestedManifests(requestedModIds)
    ).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'modB_fails'. Path: path/to/modB_fails/mod-manifest.json. Reason: Network Error"
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('MOD_MANIFEST_FETCH_FAIL'), // Using expect.stringContaining for the ERR code part
      expect.stringContaining(
        "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'modB_fails'"
      ),
      expect.objectContaining({
        modId: 'modB_fails',
        path: 'path/to/modB_fails/mod-manifest.json',
        reason: 'Network Error',
      })
    );

    // Verify that store was NOT called for any mod if one fails to fetch
    expect(mockDataRegistry.store).not.toHaveBeenCalled();
  });

  test('should throw if manifest ID does not match expected mod ID', async () => {
    const requestedModIds = ['modX'];
    const manifestWithWrongId = {
      id: 'modY',
      name: 'Mod X with wrong ID',
      version: '1.0.0',
    };

    mockDataFetcher.fetch.mockResolvedValueOnce(manifestWithWrongId);

    await expect(
      modManifestLoader.loadRequestedManifests(requestedModIds)
    ).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: manifest ID 'modY' does not match expected mod ID 'modX'."
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('MOD_MANIFEST_ID_MISMATCH'),
      expect.stringContaining(
        "manifest ID 'modY' does not match expected mod ID 'modX'"
      ),
      expect.objectContaining({ modId: 'modX' })
    );
  });

  test('should throw if manifest is missing an id field', async () => {
    const requestedModIds = ['modZ'];
    const manifestWithoutId = { name: 'Mod Z without ID', version: '1.0.0' };

    mockDataFetcher.fetch.mockResolvedValueOnce(manifestWithoutId);

    await expect(
      modManifestLoader.loadRequestedManifests(requestedModIds)
    ).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: manifest 'path/to/modZ/mod-manifest.json' is missing an 'id' field."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('MODLOADER_MANIFEST_MISSING_ID'),
      expect.stringContaining(
        "manifest 'path/to/modZ/mod-manifest.json' is missing an 'id' field."
      ),
      expect.objectContaining({ modId: 'modZ' })
    );
  });

  test('should throw if manifest fails schema validation', async () => {
    const requestedModIds = ['modW'];
    const invalidManifest = { id: 'modW', name: 'Mod W', version: 123 }; // version should be string

    mockDataFetcher.fetch.mockResolvedValueOnce(invalidManifest);

    const mockValidatorFn = mockSchemaValidator.getValidator();
    mockValidatorFn.mockReturnValueOnce({
      isValid: false,
      errors: [{ instancePath: '/version', message: 'should be string' }],
    });

    await expect(
      modManifestLoader.loadRequestedManifests(requestedModIds)
    ).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: manifest for 'modW' failed schema validation. See log for Ajv error details."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('MOD_MANIFEST_SCHEMA_INVALID'),
      expect.stringContaining("manifest for 'modW' failed schema validation."),
      expect.objectContaining({
        modId: 'modW',
        schemaId: MOD_MANIFEST_SCHEMA_ID,
        details: expect.stringContaining('"instancePath": "/version"'),
      })
    );
  });
});
