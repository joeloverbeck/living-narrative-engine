/**
 * @file Integration coverage for AnatomyRecipeLoader interactions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { ValidationError } from '../../../src/errors/validationError.js';

/**
 * @class TestConfiguration
 * @description Minimal configuration service used to satisfy AnatomyRecipeLoader dependencies.
 */
class TestConfiguration {
  /**
   * @description Creates a new test configuration stub.
   * @param {string} [schemaId='schema://living-narrative-engine/anatomy-recipe.schema.json']
   * @returns {void}
   */
  constructor(
    schemaId = 'schema://living-narrative-engine/anatomy-recipe.schema.json'
  ) {
    this._schemaId = schemaId;
  }

  /**
   * @description Retrieves the base path for mods used in tests.
   * @returns {string} Base mods directory.
   */
  getModsBasePath() {
    return '/virtual-mods';
  }

  /**
   * @description Returns the configured schema identifier for the provided content type.
   * @param {string} contentType - Loader content type (e.g., anatomyRecipes).
   * @returns {string|null} Schema identifier when content type matches.
   */
  getContentTypeSchemaId(contentType) {
    return contentType === 'anatomyRecipes' ? this._schemaId : null;
  }
}

/**
 * @class TestPathResolver
 * @description Resolves content paths inside the virtual mod layout for tests.
 */
class TestPathResolver {
  /**
   * @description Resolves the absolute path for a mod content file.
   * @param {string} modId - Identifier of the mod being processed.
   * @param {string} diskFolder - Disk folder segment provided to the loader.
   * @param {string} filename - Filename from the manifest entry.
   * @returns {string} Deterministic path used by the in-memory fetcher.
   */
  resolveModContentPath(modId, diskFolder, filename) {
    return `/virtual-mods/${modId}/${diskFolder}/${filename}`;
  }
}

/**
 * @class MapDataFetcher
 * @description Supplies JSON data from an in-memory map keyed by resolved file paths.
 */
class MapDataFetcher {
  /**
   * @description Creates a new fetcher with the provided backing map.
   * @param {Map<string, any>} fileMap - Map of resolved paths to JSON fixtures.
   * @returns {void}
   */
  constructor(fileMap) {
    this._fileMap = fileMap;
  }

  /**
   * @description Fetches JSON content for the requested path.
   * @param {string} path - Fully resolved path built by the path resolver.
   * @returns {Promise<any>} Deep cloned data for the request.
   */
  async fetch(path) {
    if (!this._fileMap.has(path)) {
      throw new Error(`Missing fixture for path: ${path}`);
    }

    const value = this._fileMap.get(path);
    if (typeof value === 'object' && value !== null) {
      return JSON.parse(JSON.stringify(value));
    }
    return value;
  }
}

/**
 * @class SkippingSchemaValidator
 * @description Schema validator that reports schemas as unloaded so loaders skip validation during tests.
 */
class SkippingSchemaValidator {
  /**
   * @description No-op constructor for symmetry with real validators.
   * @returns {void}
   */
  constructor() {}

  /**
   * @description Indicates whether a schema is loaded. Always false to exercise skip branch.
   * @param {string} _schemaId - Requested schema identifier.
   * @returns {boolean} False so validation is skipped.
   */
  isSchemaLoaded(_schemaId) {
    return false;
  }

  /**
   * @description Returns a permissive validator function; unused because schemas are marked as unloaded.
   * @param {string} _schemaId - Requested schema identifier.
   * @returns {Function|undefined} No-op validator function.
   */
  getValidator(_schemaId) {
    return () => ({ isValid: true, errors: null });
  }

  /**
   * @description Validates the provided data. Always reports success.
   * @param {string} _schemaId - Schema identifier.
   * @param {any} _data - Data to validate.
   * @returns {{isValid: boolean, errors: null}} Successful validation result.
   */
  validate(_schemaId, _data) {
    return { isValid: true, errors: null };
  }
}

/**
 * @description Creates a Jest-friendly logger implementation for integration tests.
 * @returns {{error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock}} Logger with spy functions.
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * @description Instantiates an AnatomyRecipeLoader wired with concrete collaborators for integration testing.
 * @param {Map<string, any>} fileMap - Map of resolved paths to recipe JSON definitions.
 * @returns {{
 *   loader: AnatomyRecipeLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: SkippingSchemaValidator,
 *   config: TestConfiguration
 * }} Fully configured loader and dependencies.
 */
function createLoader(fileMap) {
  const logger = createTestLogger();
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const schemaValidator = new SkippingSchemaValidator();
  const registry = new InMemoryDataRegistry({ logger });

  const loader = new AnatomyRecipeLoader(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );

  return {
    loader,
    registry,
    logger,
    pathResolver,
    dataFetcher,
    schemaValidator,
    config,
  };
}

describe('AnatomyRecipeLoader integration coverage', () => {
  let fileMap;
  let loader;
  let registry;
  let logger;

  beforeEach(() => {
    fileMap = new Map();
    ({ loader, registry, logger } = createLoader(fileMap));
  });

  it('loads anatomy recipes and stores enriched entries in the registry', async () => {
    const manifest = {
      id: 'core',
      version: '1.0.0',
      name: 'Core Test Mod',
      content: {
        anatomy: {
          recipes: ['humanoid.recipe.json'],
        },
      },
    };

    const resolvedPath = '/virtual-mods/core/anatomy/recipes/humanoid.recipe.json';
    fileMap.set(resolvedPath, {
      recipeId: 'core:humanoid',
      includes: ['core:macro.base', 'core:macro.extra'],
      constraints: {
        requires: [
          {
            components: ['core:heart', 'core:brain'],
          },
          {
            partTypes: ['core:spine', 'core:skull'],
          },
        ],
        excludes: [
          {
            components: ['core:stone_skin', 'core:feather_skin'],
          },
        ],
      },
      bodyDescriptors: {
        build: 'athletic',
        hairDensity: 'light',
        composition: 'lean',
        height: 'tall',
        skinColor: 'bronze',
      },
    });

    const result = await loader.loadItemsForMod(
      manifest.id,
      manifest,
      'anatomy.recipes',
      'anatomy/recipes',
      'anatomyRecipes'
    );

    expect(result).toEqual({
      count: 1,
      overrides: 0,
      errors: 0,
      failures: [],
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Recipe 'humanoid' includes 2 macro(s)")
    );

    const storedRecipe = registry.get('anatomyRecipes', 'core:humanoid');
    expect(storedRecipe).toBeDefined();
    expect(storedRecipe.id).toBe('humanoid');
    expect(storedRecipe._fullId).toBe('core:humanoid');
    expect(storedRecipe._sourceFile).toBe('humanoid.recipe.json');
    expect(storedRecipe.bodyDescriptors.build).toBe('athletic');
  });

  it('reports validation failures for malformed recipes while still storing valid ones', async () => {
    const manifest = {
      id: 'core',
      version: '1.0.0',
      name: 'Core Test Mod',
      content: {
        anatomy: {
          recipes: [
            'humanoid.recipe.json',
            'invalid-constraint.recipe.json',
            'invalid-descriptor.recipe.json',
          ],
        },
      },
    };

    const basePath = '/virtual-mods/core/anatomy/recipes';
    fileMap.set(`${basePath}/humanoid.recipe.json`, {
      recipeId: 'core:humanoid',
      constraints: {
        requires: [
          {
            components: ['core:heart', 'core:brain'],
          },
          {
            partTypes: ['core:lungs', 'core:spine'],
          },
        ],
      },
      bodyDescriptors: {
        build: 'toned',
        hairDensity: 'sparse',
        composition: 'average',
        height: 'average',
      },
    });

    fileMap.set(`${basePath}/invalid-constraint.recipe.json`, {
      recipeId: 'core:invalidConstraint',
      constraints: {
        requires: [
          {
            components: ['only-one'],
          },
        ],
      },
    });

    fileMap.set(`${basePath}/invalid-descriptor.recipe.json`, {
      recipeId: 'core:invalidDescriptor',
      bodyDescriptors: {
        build: 42,
      },
    });

    const result = await loader.loadItemsForMod(
      manifest.id,
      manifest,
      'anatomy.recipes',
      'anatomy/recipes',
      'anatomyRecipes'
    );

    expect(result.count).toBe(1);
    expect(result.overrides).toBe(0);
    expect(result.errors).toBe(2);
    expect(result.failures).toHaveLength(2);

    const constraintFailure = result.failures.find(
      (failure) => failure.file === 'invalid-constraint.recipe.json'
    );
    expect(constraintFailure).toBeDefined();
    expect(constraintFailure.error).toBeInstanceOf(ValidationError);
    expect(constraintFailure.error.message).toContain(
      "must contain at least 2 items"
    );

    const descriptorFailure = result.failures.find(
      (failure) => failure.file === 'invalid-descriptor.recipe.json'
    );
    expect(descriptorFailure).toBeDefined();
    expect(descriptorFailure.error).toBeInstanceOf(ValidationError);
    expect(descriptorFailure.error.message).toContain(
      "Body descriptor 'build' must be a string"
    );

    const storedRecipe = registry.get('anatomyRecipes', 'core:humanoid');
    expect(storedRecipe).toBeDefined();
    expect(storedRecipe.bodyDescriptors.build).toBe('toned');
  });
});
