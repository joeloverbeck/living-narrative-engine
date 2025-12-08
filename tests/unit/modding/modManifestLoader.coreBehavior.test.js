import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModManifestLoader from '../../../src/modding/modManifestLoader.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDependencies = (overrides = {}) => {
  const logger = createLogger();
  const deps = {
    configuration: {
      getContentTypeSchemaId: jest.fn(() => 'schema://mod-manifest'),
    },
    pathResolver: {
      resolveModManifestPath: jest.fn((id) => `/mods/${id}/manifest.json`),
    },
    dataFetcher: {
      fetch: jest.fn(() => Promise.resolve({})),
    },
    schemaValidator: {
      getValidator: jest.fn(() => jest.fn(() => ({ isValid: true }))),
    },
    dataRegistry: {
      store: jest.fn(),
    },
    logger,
  };

  return { ...deps, ...overrides, logger: overrides.logger ?? logger };
};

const instantiateLoader = (overrides = {}) => {
  const dependencies = createDependencies(overrides);
  const loader = new ModManifestLoader(
    dependencies.configuration,
    dependencies.pathResolver,
    dependencies.dataFetcher,
    dependencies.schemaValidator,
    dependencies.dataRegistry,
    dependencies.logger
  );
  return { loader, dependencies };
};

describe('ModManifestLoader core behavior', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor validation', () => {
    it('logs debug message when constructed with valid dependencies', () => {
      const { dependencies } = instantiateLoader();
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        'ModManifestLoader: Instance created and dependencies validated.'
      );
    });

    it.each([
      {
        name: 'configuration with missing getContentTypeSchemaId',
        overrides: { configuration: {} },
        message:
          "ModManifestLoader: Missing or invalid 'configuration' dependency (IConfiguration). Requires getContentTypeSchemaId() method.",
      },
      {
        name: 'pathResolver without resolveModManifestPath',
        overrides: { pathResolver: {} },
        message:
          "ModManifestLoader: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveModManifestPath() method.",
      },
      {
        name: 'dataFetcher without fetch',
        overrides: { dataFetcher: {} },
        message:
          "ModManifestLoader: Missing or invalid 'dataFetcher' dependency (IDataFetcher). Requires fetch() method.",
      },
      {
        name: 'schemaValidator without getValidator',
        overrides: { schemaValidator: {} },
        message:
          "ModManifestLoader: Missing or invalid 'schemaValidator' dependency (ISchemaValidator). Requires getValidator() method.",
      },
      {
        name: 'dataRegistry without store',
        overrides: { dataRegistry: {} },
        message:
          "ModManifestLoader: Missing or invalid 'dataRegistry' dependency (IDataRegistry). Requires store() method.",
      },
      {
        name: 'logger missing required methods',
        overrides: { logger: { info: jest.fn() } },
        message:
          "ModManifestLoader: Missing or invalid 'logger' dependency (ILogger). Requires info(), warn(), error(), and debug() methods.",
      },
    ])('throws for $name', ({ overrides, message }) => {
      const deps = createDependencies(overrides);
      expect(
        () =>
          new ModManifestLoader(
            deps.configuration,
            deps.pathResolver,
            deps.dataFetcher,
            deps.schemaValidator,
            deps.dataRegistry,
            deps.logger
          )
      ).toThrow(message);
    });
  });

  describe('_validateRequestIds', () => {
    it('rejects non-array inputs with logging', () => {
      const { loader, dependencies } = instantiateLoader();
      expect(() => loader._validateRequestIds('mod')).toThrow(TypeError);
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_INVALID_REQUEST_ARRAY',
        expect.stringContaining('expected an array of mod-IDs.'),
        {}
      );
    });

    it('rejects invalid identifiers and logs details', () => {
      const { loader, dependencies } = instantiateLoader();
      expect(() => loader._validateRequestIds(['valid', ''])).toThrow(
        TypeError
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_INVALID_REQUEST_ID',
        expect.stringContaining('mod-IDs must be non-empty strings.'),
        { badValue: '' }
      );
    });

    it('rejects duplicate identifiers', () => {
      const { loader, dependencies } = instantiateLoader();
      expect(() => loader._validateRequestIds(['alpha', 'alpha'])).toThrow(
        "ModManifestLoader.loadRequestedManifests: duplicate mod-ID 'alpha' in request list."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_DUPLICATE_REQUEST_ID',
        expect.stringContaining("duplicate mod-ID 'alpha'")
      );
    });

    it('returns trimmed unique identifiers', () => {
      const { loader, dependencies } = instantiateLoader();
      const result = loader._validateRequestIds([' modA ', 'modB']);
      expect(result).toEqual(['modA', 'modB']);
      expect(dependencies.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('_getManifestValidator', () => {
    it('returns the validator function when available', () => {
      const { loader, dependencies } = instantiateLoader();
      const validator = jest.fn();
      dependencies.schemaValidator.getValidator.mockReturnValue(validator);
      expect(loader._getManifestValidator('schema-id')).toBe(validator);
      expect(dependencies.schemaValidator.getValidator).toHaveBeenCalledWith(
        'schema-id'
      );
      expect(dependencies.logger.error).not.toHaveBeenCalled();
    });

    it('throws when validator is missing', () => {
      const { loader, dependencies } = instantiateLoader();
      dependencies.schemaValidator.getValidator.mockReturnValue(null);
      expect(() => loader._getManifestValidator('schema-id')).toThrow(
        "ModManifestLoader.loadRequestedManifests: no validator available for 'schema-id'."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_NO_SCHEMA_VALIDATOR',
        expect.stringContaining('no validator available'),
        { schemaId: 'schema-id' }
      );
    });
  });

  describe('_fetchManifests', () => {
    it('fetches each manifest using resolved paths', async () => {
      const { loader, dependencies } = instantiateLoader();
      dependencies.dataFetcher.fetch.mockImplementation((path) =>
        Promise.resolve({ id: path })
      );

      const { fetchJobs, settled } = await loader._fetchManifests([
        'core',
        'addon',
      ]);
      expect(
        dependencies.pathResolver.resolveModManifestPath
      ).toHaveBeenCalledWith('core');
      expect(
        dependencies.pathResolver.resolveModManifestPath
      ).toHaveBeenCalledWith('addon');
      expect(fetchJobs).toHaveLength(2);
      expect(fetchJobs[0]).toMatchObject({
        modId: 'core',
        path: '/mods/core/manifest.json',
      });
      expect(settled.every((result) => result.status === 'fulfilled')).toBe(
        true
      );
    });
  });

  describe('_validateAndCheckIds', () => {
    it('throws when a fetch promise is rejected', () => {
      const { loader, dependencies } = instantiateLoader({
        configuration: {
          getContentTypeSchemaId: jest.fn(() => 'schema://mod'),
        },
      });

      const error = new Error('network down');
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [{ status: 'rejected', reason: error }];

      expect(() =>
        loader._validateAndCheckIds(fetchJobs, settled, jest.fn())
      ).toThrow(
        "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'alpha'. Path: /alpha.json. Reason: network down"
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MOD_MANIFEST_FETCH_FAIL',
        expect.stringContaining('could not fetch manifest'),
        { modId: 'alpha', path: '/alpha.json', reason: 'network down' }
      );
    });

    it('throws when schema validation fails', () => {
      const { loader, dependencies } = instantiateLoader();
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [
        {
          status: 'fulfilled',
          value: { id: 'alpha' },
        },
      ];
      const validator = jest.fn(() => ({
        isValid: false,
        errors: [{ field: 'id' }],
      }));

      expect(() =>
        loader._validateAndCheckIds(fetchJobs, settled, validator)
      ).toThrow(
        "ModManifestLoader.loadRequestedManifests: manifest for 'alpha' failed schema validation. See log for Ajv error details."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MOD_MANIFEST_SCHEMA_INVALID',
        expect.stringContaining(
          "manifest for 'alpha' failed schema validation."
        ),
        expect.objectContaining({
          modId: 'alpha',
          path: '/alpha.json',
        })
      );
    });

    it('logs schema failures for unknown content keys', () => {
      const { loader, dependencies } = instantiateLoader();
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [
        {
          status: 'fulfilled',
          value: { id: 'alpha', content: { 'status-effects': [] } },
        },
      ];
      const validator = jest.fn(() => ({
        isValid: false,
        errors: [
          {
            instancePath: '/content',
            params: { additionalProperty: 'status-effects' },
            message: 'must NOT have additional properties',
          },
        ],
      }));

      expect(() =>
        loader._validateAndCheckIds(fetchJobs, settled, validator)
      ).toThrow(
        "ModManifestLoader.loadRequestedManifests: manifest for 'alpha' failed schema validation. See log for Ajv error details."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MOD_MANIFEST_SCHEMA_INVALID',
        expect.stringContaining(
          "manifest for 'alpha' failed schema validation."
        ),
        expect.objectContaining({
          details: expect.stringContaining('status-effects'),
        })
      );
    });

    it('throws when manifest is missing id', () => {
      const { loader, dependencies } = instantiateLoader();
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [
        {
          status: 'fulfilled',
          value: {},
        },
      ];
      const validator = jest.fn(() => ({ isValid: true }));

      expect(() =>
        loader._validateAndCheckIds(fetchJobs, settled, validator)
      ).toThrow(
        "ModManifestLoader.loadRequestedManifests: manifest '/alpha.json' is missing an 'id' field."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_MANIFEST_MISSING_ID',
        expect.stringContaining("missing an 'id' field."),
        { modId: 'alpha', path: '/alpha.json' }
      );
    });

    it('throws when manifest id mismatches request', () => {
      const { loader, dependencies } = instantiateLoader();
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [
        {
          status: 'fulfilled',
          value: { id: 'beta' },
        },
      ];
      const validator = jest.fn(() => ({ isValid: true }));

      expect(() =>
        loader._validateAndCheckIds(fetchJobs, settled, validator)
      ).toThrow(
        "ModManifestLoader.loadRequestedManifests: manifest ID 'beta' does not match expected mod ID 'alpha'."
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MOD_MANIFEST_ID_MISMATCH',
        expect.stringContaining("manifest ID 'beta'"),
        { modId: 'alpha', path: '/alpha.json' }
      );
    });

    it('returns validated manifests when all checks pass', () => {
      const { loader, dependencies } = instantiateLoader();
      const fetchJobs = [{ modId: 'alpha', path: '/alpha.json' }];
      const settled = [
        {
          status: 'fulfilled',
          value: { id: 'alpha' },
        },
      ];
      const validator = jest.fn(() => ({ isValid: true }));

      const validated = loader._validateAndCheckIds(
        fetchJobs,
        settled,
        validator
      );
      expect(validated).toEqual([
        { modId: 'alpha', data: { id: 'alpha' }, path: '/alpha.json' },
      ]);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        "ModManifestLoader.loadRequestedManifests: manifest for 'alpha' schema-validated OK."
      );
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        "ModManifestLoader.loadRequestedManifests: manifest ID consistency check passed for 'alpha'."
      );
    });
  });

  describe('_storeValidatedManifests', () => {
    it('stores each manifest and returns a populated map', () => {
      const { loader, dependencies } = instantiateLoader();
      const validated = [
        { modId: 'alpha', data: { id: 'alpha' }, path: '/alpha.json' },
        { modId: 'beta', data: { id: 'beta' }, path: '/beta.json' },
      ];

      const stored = loader._storeValidatedManifests(validated);
      expect(stored).toBeInstanceOf(Map);
      expect(stored.get('alpha')).toEqual({ id: 'alpha' });
      expect(dependencies.dataRegistry.store).toHaveBeenCalledWith(
        'mod_manifests',
        'alpha',
        { id: 'alpha' }
      );
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        "ModManifestLoader.loadRequestedManifests: stored manifest 'alpha'."
      );
    });

    it('wraps registry errors with context information', () => {
      const dataRegistry = {
        store: jest.fn(() => {
          throw new Error('db down');
        }),
      };
      const { loader, dependencies } = instantiateLoader({ dataRegistry });
      const validated = [
        { modId: 'alpha', data: { id: 'alpha' }, path: '/alpha.json' },
      ];

      expect(() => loader._storeValidatedManifests(validated)).toThrow(
        "ModManifestLoader.loadRequestedManifests: failed to store manifest 'alpha'. – db down"
      );
      expect(dependencies.logger.error).toHaveBeenCalledWith(
        'MODLOADER_REGISTRY_STORE_FAIL',
        expect.stringContaining("failed to store manifest 'alpha'."),
        { modId: 'alpha', path: '/alpha.json' }
      );
    });
  });

  describe('loadRequestedManifests end-to-end', () => {
    it('loads, validates, stores, and freezes manifests', async () => {
      const { loader, dependencies } = instantiateLoader();
      const validator = jest
        .fn()
        .mockReturnValueOnce({ isValid: true })
        .mockReturnValueOnce({ isValid: true });
      dependencies.schemaValidator.getValidator.mockReturnValue(validator);
      dependencies.dataFetcher.fetch.mockImplementation((path) =>
        Promise.resolve({ id: path.includes('alpha') ? 'alpha' : 'beta' })
      );

      const result = await loader.loadRequestedManifests([' alpha ', 'beta']);
      expect(Array.from(result.keys())).toEqual(['alpha', 'beta']);
      expect(result.get('alpha')).toEqual({ id: 'alpha' });
      expect(() => result.set('gamma', {})).toThrow(TypeError);
      expect(loader.getLoadedManifests()).toBe(result);
      expect(dependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('finished – fetched 2/2')
      );
    });
  });

  describe('loadModManifests', () => {
    it('delegates to loadRequestedManifests with warning', async () => {
      const { loader, dependencies } = instantiateLoader();
      const expected = new Map();
      loader.loadRequestedManifests = jest.fn().mockResolvedValue(expected);

      const result = await loader.loadModManifests(['core']);
      expect(dependencies.logger.warn).toHaveBeenCalledWith(
        'ModManifestLoader.loadModManifests: Called but deprecated in favor of loadRequestedManifests.'
      );
      expect(loader.loadRequestedManifests).toHaveBeenCalledWith(['core']);
      expect(result).toBe(expected);
    });
  });

  describe('getLoadedManifests', () => {
    it('returns null before any manifests are loaded', () => {
      const { loader } = instantiateLoader();
      expect(loader.getLoadedManifests()).toBeNull();
    });
  });
});
