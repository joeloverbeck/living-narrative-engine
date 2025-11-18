/**
 * @file Integration tests for ModManifestProcessor using real loader components.
 * @description Exercises manifest processing with real dependency validation,
 * load order resolution, and version compatibility checks.
 */

import {
  describe,
  it,
  expect,
  afterEach,
} from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ModManifestLoader from '../../../src/modding/modManifestLoader.js';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';
import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import ModDependencyValidator from '../../../src/modding/modDependencyValidator.js';
import validateModEngineVersions from '../../../src/modding/modVersionValidator.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import { createMockLogger } from '../../common/mockFactories.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class TestConfiguration {
  constructor(basePath) {
    this.basePath = basePath;
  }

  getBaseDataPath() {
    return this.basePath;
  }

  getSchemaBasePath() {
    return 'schemas';
  }

  getContentBasePath(registryKey) {
    return registryKey;
  }

  getGameConfigFilename() {
    return 'game.json';
  }

  getModsBasePath() {
    return 'mods';
  }

  getModManifestFilename() {
    return 'mod-manifest.json';
  }

  getContentTypeSchemaId(contentType) {
    return `test-schema:${contentType}`;
  }
}

class FileDataFetcher {
  async fetch(filePath) {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }
}

class TestSchemaValidator {
  constructor(overrides = {}) {
    this.overrides = overrides;
  }

  getValidator(schemaId) {
    if (this.overrides[schemaId]) {
      return this.overrides[schemaId];
    }

    return (data) => {
      if (!data || typeof data !== 'object') {
        return { isValid: false, errors: ['Manifest must be an object'] };
      }

      if (!data.id || !data.version) {
        return {
          isValid: false,
          errors: ['Manifest must include id and version'],
        };
      }

      return { isValid: true, errors: [] };
    };
  }
}

class TestSafeDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return Promise.resolve(true);
  }
}

/**
 *
 * @param id
 * @param overrides
 */
function createManifest(id, overrides = {}) {
  return {
    id,
    version: '1.0.0',
    dependencies: [],
    ...overrides,
  };
}

/**
 *
 * @param absoluteBaseDir
 * @param manifests
 */
async function writeManifests(absoluteBaseDir, manifests) {
  const modsDir = path.join(absoluteBaseDir, 'mods');
  await fs.mkdir(modsDir, { recursive: true });

  for (const manifest of manifests) {
    const modDir = path.join(modsDir, manifest.id);
    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(
      path.join(modDir, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
  }
}

/**
 *
 * @param manifests
 * @param options
 */
async function setupProcessor(manifests, options = {}) {
  const baseFolder = path.join('tmp', 'mod-manifest-processor-tests');
  const absoluteBaseRoot = path.join(process.cwd(), baseFolder);
  await fs.mkdir(absoluteBaseRoot, { recursive: true });
  const uniqueId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const absoluteDir = path.join(absoluteBaseRoot, uniqueId);
  await fs.mkdir(absoluteDir, { recursive: true });
  const relativeDir = `./${path.join(baseFolder, uniqueId)}`;

  await writeManifests(absoluteDir, manifests);

  const logger = createMockLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const configuration = new TestConfiguration(relativeDir);
  const pathResolver = new DefaultPathResolver(configuration);
  const dataFetcher = new FileDataFetcher();
  const schemaValidator = new TestSchemaValidator(
    options.schemaValidatorOverrides
  );
  const loader = new ModManifestLoader(
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );
  const safeDispatcher = new TestSafeDispatcher();
  const resolver = new ModLoadOrderResolver(logger);

  const orchestrator =
    typeof options.orchestratorFactory === 'function'
      ? options.orchestratorFactory({
          loader,
          resolver,
          logger,
        })
      : null;

  const processor = new ModManifestProcessor({
    modManifestLoader: loader,
    logger,
    registry,
    validatedEventDispatcher: safeDispatcher,
    modDependencyValidator: ModDependencyValidator,
    modVersionValidator: validateModEngineVersions,
    modLoadOrderResolver: resolver,
    modValidationOrchestrator: orchestrator,
  });

  return {
    processor,
    logger,
    registry,
    safeDispatcher,
    loader,
    tempDir: absoluteDir,
  };
}

describe('Integration: ModManifestProcessor', () => {
  const tempDirs = [];

  afterEach(async () => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
         
        console.warn('Failed to clean temporary directory', error);
      }
    }
  });

  /**
   *
   * @param manifests
   * @param options
   */
  async function createProcessor(manifests, options = {}) {
    const context = await setupProcessor(manifests, options);
    tempDirs.push(context.tempDir);
    return context;
  }

  it('loads dependency trees and stores results when orchestrator is disabled', async () => {
    const manifests = [
      createManifest('core', { version: '1.0.0' }),
      createManifest('positioning', {
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
        ],
      }),
      createManifest('intimacy', {
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
          { id: 'positioning', version: '^1.0.0', required: true },
        ],
      }),
    ];

    const { processor, registry, logger } = await createProcessor(manifests);

    const result = await processor.processManifests(
      ['intimacy'],
      'integration-world'
    );

    expect(Array.from(result.loadedManifestsMap.keys()).sort()).toEqual([
      'core',
      'intimacy',
      'positioning',
    ]);
    expect(result.finalModOrder).toEqual([
      'core',
      'positioning',
      'intimacy',
    ]);
    expect(result.validationWarnings).toEqual([]);
    expect(result.incompatibilityCount).toBe(0);

    expect(registry.get('mod_manifests', 'core')).toEqual(
      expect.objectContaining({ id: 'core' })
    );
    expect(registry.get('meta', 'final_mod_order')).toEqual([
      'core',
      'positioning',
      'intimacy',
    ]);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Loaded 3 mod manifests')
      )
    ).toBe(true);
  });

  it('short-circuits to the orchestrator when cross-reference validation is enabled', async () => {
    const manifests = [
      createManifest('core'),
      createManifest('positioning', {
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
        ],
      }),
    ];

    let orchestratorCalls = 0;
    const orchestratorFactory = ({ loader, resolver, logger }) => ({
      async validateForLoading(modIds) {
        orchestratorCalls += 1;
        const manifestsMap = await loader.loadRequestedManifests(
          modIds,
          'validation-world'
        );
        ModDependencyValidator.validate(manifestsMap, logger);
        const loadOrder = resolver.resolve(modIds, manifestsMap);
        return {
          canLoad: true,
          loadOrder,
          warnings: ['core manifest missing optional metadata'],
        };
      },
    });

    const { processor, registry, logger } = await createProcessor(manifests, {
      orchestratorFactory,
    });

    const result = await processor.processManifests(
      ['positioning'],
      'integration-world',
      { validateCrossReferences: true }
    );

    expect(result.finalModOrder).toEqual(['core', 'positioning']);
    expect(result.validationWarnings).toEqual([]);
    expect(orchestratorCalls).toBe(1);
    expect(registry.get('meta', 'final_mod_order')).toEqual([
      'core',
      'positioning',
    ]);

    expect(
      logger.info.mock.calls.some(([message]) =>
        message.includes('Using ModValidationOrchestrator')
      )
    ).toBe(true);
  });

  it('falls back to traditional flow when orchestrator fails in non-strict mode', async () => {
    const manifests = [
      createManifest('core'),
      createManifest('positioning', {
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
        ],
      }),
    ];

    const failingFactory = () => ({
      async validateForLoading() {
        throw new Error('Cross-reference validation failed');
      },
    });

    const { processor, logger } = await createProcessor(manifests, {
      orchestratorFactory: failingFactory,
    });

    const result = await processor.processManifests(
      ['positioning'],
      'integration-world',
      { validateCrossReferences: true, strictMode: false }
    );

    expect(result.finalModOrder).toEqual(['core', 'positioning']);
    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Validation orchestrator failed, falling back')
      )
    ).toBe(true);
  });

  it('propagates orchestrator errors when strict mode is enabled', async () => {
    const manifests = [
      createManifest('core'),
      createManifest('positioning', {
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
        ],
      }),
    ];

    const failingFactory = () => ({
      async validateForLoading() {
        throw new Error('Strict validation failure');
      },
    });

    const { processor, logger } = await createProcessor(manifests, {
      orchestratorFactory: failingFactory,
    });

    await expect(
      processor.processManifests(['positioning'], 'integration-world', {
        validateCrossReferences: true,
        strictMode: true,
      })
    ).rejects.toThrow('Strict validation failure');

    expect(
      logger.warn.mock.calls.every(([message]) =>
        !message.includes('Validation orchestrator failed, falling back')
      )
    ).toBe(true);
  });

  it('aborts when orchestrator reports the ecosystem cannot load', async () => {
    const manifests = [createManifest('core')];

    let orchestratorCalls = 0;
    const denyingFactory = () => ({
      async validateForLoading() {
        orchestratorCalls += 1;
        return {
          canLoad: false,
          warnings: [],
        };
      },
    });

    const { processor } = await createProcessor(manifests, {
      orchestratorFactory: denyingFactory,
    });

    await expect(
      processor.processManifests(['core'], 'integration-world', {
        validateCrossReferences: true,
        strictMode: true,
      })
    ).rejects.toThrow(ModDependencyError);
    expect(orchestratorCalls).toBe(1);
  });

  it('surfaces dependency validation errors from the fallback path', async () => {
    const manifests = [
      createManifest('core', { version: '1.0.0' }),
      createManifest('positioning', {
        version: '1.0.0',
        dependencies: [
          { id: 'core', version: '^2.0.0', required: true },
        ],
      }),
    ];

    const { processor } = await createProcessor(manifests);

    await expect(
      processor.processManifests(['positioning'], 'integration-world')
    ).rejects.toThrow(ModDependencyError);
  });

  it('dispatches engine incompatibility errors when versions do not satisfy requirements', async () => {
    const manifests = [
      createManifest('core', { gameVersion: '>=1.0.0' }),
      createManifest('positioning', {
        gameVersion: '>=1.0.0',
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
        ],
      }),
    ];

    const { processor, logger, safeDispatcher } = await createProcessor(
      manifests
    );

    await expect(
      processor.processManifests(['positioning'], 'integration-world')
    ).rejects.toThrow(ModDependencyError);

    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Encountered 1 engine version incompatibilities')
      )
    ).toBe(true);
    expect(safeDispatcher.events).toHaveLength(1);
    expect(safeDispatcher.events[0].eventName).toBe(
      SYSTEM_ERROR_OCCURRED_ID
    );
  });
});
