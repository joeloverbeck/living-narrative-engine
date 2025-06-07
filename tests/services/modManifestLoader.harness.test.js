// tests/services/modManifestLoader.harness.test.js
// -----------------------------------------------------------------------------
// MODLOADER‑005 F — exhaustive branch & integration harness
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
    if (t === 'mod-manifest') {
      return 'http://example.com/schemas/mod.manifest.schema.json';
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
/* 1️⃣ Constructor / branch edge cases                                         */
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
      expect.stringMatching(/INVALID_REQUEST_ARRAY/i),
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

  it('logs & returns empty Map if every fetch rejects', async () => {
    deps.fetcher = createMockFetcher({}, ['a', 'b']);
    const result = await buildLoader(deps).loadRequestedManifests(['a', 'b']);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(deps.registry.store).not.toHaveBeenCalled();
    // *** FIX: Removed colon from 'fetched: 0/2' ***
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('fetched 0/2')
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2️⃣ Integration — real AjvSchemaValidator in play                           */
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
    const schemaValidator = new AjvSchemaValidator({
      logger: mockLogger,
      dispatcher: { dispatch: jest.fn() },
    });
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

  it('loads two valid mods, skips failing fetch, and stores exactly two', async () => {
    const loader = buildLoader(deps);
    const map = await loader.loadRequestedManifests(['good1', 'bad', 'good2']);

    expect(map).toBeInstanceOf(Map);
    expect([...map.keys()].sort()).toEqual(['good1', 'good2']);
    expect(map.get('good1')).toEqual(m1);

    // registry interactions
    expect(deps.registry.store).toHaveBeenCalledTimes(2);
    expect(deps.registry.store).toHaveBeenNthCalledWith(
      1,
      'mod_manifests',
      'good1',
      m1
    );
    expect(deps.registry.store).toHaveBeenNthCalledWith(
      2,
      'mod_manifests',
      'good2',
      m2
    );

    // warning for failed fetch
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/MOD_MANIFEST_FETCH_FAIL/),
      expect.any(String),
      expect.objectContaining({ modId: 'bad' })
    );

    // final summary reflects 2/3 fetched ok
    // *** FIX: Removed colon from 'fetched: 2/3' ***
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('fetched 2/3')
    );
  });
});
