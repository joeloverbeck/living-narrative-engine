// tests/services/modManifestLoader.harness.test.js
// -----------------------------------------------------------------------------
// MODLOADER‑005 F — exhaustive branch & integration harness
// -----------------------------------------------------------------------------
// This file complements modManifestLoader.test.js by mopping‑up constructor/
// edge branches *and* wiring a **real AjvSchemaValidator** to exercise true
// validation, ensuring we trap the once‑failing path where `getValidator()`
// returned undefined because the schema had not been registered.
// -----------------------------------------------------------------------------

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ModManifestLoader from '../../src/modding/modManifestLoader.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';

/* -------------------------------------------------------------------------- */
/* Local helper factories (kept small to avoid cross‑test bleed)               */
/* -------------------------------------------------------------------------- */

const createMockConfiguration = (overrides = {}) => ({
  getContentTypeSchemaId: jest.fn((t) => {
    // IMPORTANT: keep "mod-manifest" mapping consistent with production code
    if (t === 'mod-manifest') {
      return 'http://example.com/schemas/mod.manifest.schema.json'; // ← dot, not hyphen
    }
    return `http://example.com/schemas/${t}.schema.json`;
  }),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModManifestPath: jest.fn(
    (id) => `./data/mods/${id}/mod.manifest.json`
  ),
  ...overrides,
});

// generic switchable fetcher
const createMockFetcher = (idToResponse = {}, errorIds = []) => ({
  fetch: jest.fn((path) => {
    const [, modId] = /mods\/(.*)\/mod\.manifest\.json/.exec(path) || [];
    if (errorIds.includes(modId))
      return Promise.reject(new Error(`Fail ${modId}`));
    if (modId in idToResponse) return Promise.resolve(idToResponse[modId]);
    return Promise.reject(new Error(`404 ${modId}`));
  }),
});

const createMockRegistry = () => ({
  store: jest.fn(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const buildLoader = (d) =>
  new ModManifestLoader(
    d.configuration,
    d.pathResolver,
    d.fetcher,
    d.validator,
    d.registry,
    d.logger
  );

/* -------------------------------------------------------------------------- */
/* 1️⃣ Constructor / branch edge cases                                         */
/* -------------------------------------------------------------------------- */

describe('ModManifestLoader — branch edges', () => {
  let deps;
  beforeEach(() => {
    deps = {
      configuration: createMockConfiguration(),
      pathResolver: createMockPathResolver(),
      fetcher: createMockFetcher(),
      validator: { getValidator: jest.fn(() => () => ({ isValid: true })) },
      registry: createMockRegistry(),
      logger: createMockLogger(),
    };
    jest.clearAllMocks();
  });

  it('throws on non‑array param', async () => {
    await expect(buildLoader(deps).loadRequestedManifests('x')).rejects.toThrow(
      TypeError
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/MODLOADER_INVALID_REQUEST_ARRAY/i),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('throws on empty id', async () => {
    await expect(
      buildLoader(deps).loadRequestedManifests([''])
    ).rejects.toThrow(TypeError);
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/INVALID_REQUEST_ID/i),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('throws when schema validator missing', async () => {
    deps.validator.getValidator.mockReturnValue(undefined);
    await expect(
      buildLoader(deps).loadRequestedManifests(['modA'])
    ).rejects.toThrow(/no validator available/);
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/NO_SCHEMA_VALIDATOR/i),
      expect.any(String),
      expect.objectContaining({ schemaId: expect.any(String) })
    );
  });

  it('throws on first fetch rejection if every fetch rejects', async () => {
    deps.fetcher = createMockFetcher({}, ['a', 'b']);
    await expect(buildLoader(deps).loadRequestedManifests(['a', 'b'])).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'a'. Path: ./data/mods/a/mod.manifest.json. Reason: Fail a"
    );
    expect(deps.registry.store).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/MOD_MANIFEST_FETCH_FAIL/i),
      expect.stringContaining("Critical error - could not fetch manifest for requested mod 'a'"),
      expect.objectContaining({ modId: 'a', reason: 'Fail a' })
    );
    expect(deps.logger.warn).not.toHaveBeenCalled();
    expect(deps.logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('fetched 0/2')
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2️⃣ Integration — real AjvSchemaValidator in play                           */
/* -------------------------------------------------------------------------- */

describe('ModManifestLoader — integration (AjvSchemaValidator)', () => {
  const MOD_SCHEMA_ID = 'http://example.com/schemas/mod.manifest.schema.json';

  // lean schema — enough for loader purposes
  const manifestSchema = {
    $id: MOD_SCHEMA_ID,
    type: 'object',
    required: ['id', 'name', 'version'],
    properties: {
      id: { type: 'string', minLength: 1 },
      name: { type: 'string', minLength: 1 },
      version: { type: 'string', minLength: 1 },
    },
    additionalProperties: true,
  };

  // fixtures
  const m1 = { id: 'good1', name: 'Good 1', version: '1.0.0' };
  const m2 = { id: 'good2', name: 'Good 2', version: '2.0.0' };

  let deps;

  beforeEach(async () => {
    // *** FIX START: Create logger first, then pass it to validator ***
    const mockLogger = createMockLogger(); // Create the logger instance
    // real validator and schema registration, now with logger dependency
    const schemaValidator = new AjvSchemaValidator(mockLogger); // Pass the logger
    await schemaValidator.addSchema(manifestSchema, MOD_SCHEMA_ID);

    deps = {
      configuration: createMockConfiguration(),
      pathResolver: createMockPathResolver(),
      fetcher: createMockFetcher({ good1: m1, good2: m2 }, ['bad']),
      validator: schemaValidator, // The validator instance already has the logger
      registry: createMockRegistry(),
      logger: mockLogger, // Store the same logger instance in deps
    };
    // *** FIX END ***
  });

  it('throws on first failing fetch and does not store successfully fetched manifests from the same batch', async () => {
    const loader = buildLoader(deps);
    await expect(loader.loadRequestedManifests(['good1', 'bad', 'good2'])).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'bad'. Path: ./data/mods/bad/mod.manifest.json. Reason: Fail bad"
    );

    expect(deps.registry.store).not.toHaveBeenCalled();

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/MOD_MANIFEST_FETCH_FAIL/),
      expect.stringContaining("Critical error - could not fetch manifest for requested mod 'bad'"),
      expect.objectContaining({ modId: 'bad' })
    );
    expect(deps.logger.warn).not.toHaveBeenCalled();

    expect(deps.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("manifest for 'good1' schema-validated OK")
    );
    expect(deps.logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining("manifest for 'good2' schema-validated OK")
    );
  });
});
