import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import ComponentLoader from '../../../src/loaders/componentLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

class RecordingSchemaValidator {
  constructor(logger) {
    this.logger = logger;
    this.schemas = new Map();
    this.removedSchemas = [];
    this.addedSchemas = [];
  }

  validate() {
    return { isValid: true, errors: null };
  }

  getValidator() {
    return () => ({ isValid: true, errors: null });
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  async addSchema(schema, schemaId) {
    this.schemas.set(schemaId, schema);
    this.addedSchemas.push(schemaId);
  }

  removeSchema(schemaId) {
    const existed = this.schemas.delete(schemaId);
    this.removedSchemas.push(schemaId);
    return existed;
  }
}

class FileSystemDataFetcher {
  async fetch(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  }
}

class TestConfiguration {
  constructor(baseModsPath) {
    this.baseModsPath = baseModsPath;
  }

  getModsBasePath() {
    return this.baseModsPath;
  }

  getContentTypeSchemaId(contentType) {
    if (contentType === 'components') {
      return null;
    }
    return null;
  }
}

class TestPathResolver {
  constructor(baseModsPath) {
    this.baseModsPath = baseModsPath;
  }

  resolveModContentPath(modId, registryKey, filename) {
    return path.join(this.baseModsPath, modId, registryKey, filename);
  }
}

/**
 *
 * @param dirPath
 */
async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 *
 * @param baseModsPath
 * @param modId
 * @param fileName
 * @param data
 */
async function writeComponentFile(baseModsPath, modId, fileName, data) {
  const targetDir = path.join(baseModsPath, modId, 'components');
  await ensureDirectory(targetDir);
  await fs.writeFile(path.join(targetDir, fileName), JSON.stringify(data, null, 2));
}

describe('Integration: BaseInlineSchemaLoader schema registration via ComponentLoader', () => {
  let tempModsRoot;

  beforeEach(async () => {
    tempModsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inline-schema-mods-'));
  });

  afterEach(async () => {
    await fs.rm(tempModsRoot, { recursive: true, force: true });
  });

  /**
   *
   * @param options
   */
  function createLoaderEnvironment(options = {}) {
    const logger = options.logger ?? new RecordingLogger();
    const schemaValidator =
      options.schemaValidator ?? new RecordingSchemaValidator(logger);
    const dataRegistry =
      options.dataRegistry ?? new InMemoryDataRegistry({ logger });
    const config = options.config ?? new TestConfiguration(tempModsRoot);
    const pathResolver = options.pathResolver ?? new TestPathResolver(tempModsRoot);
    const dataFetcher = options.dataFetcher ?? new FileSystemDataFetcher();
    const loader = new ComponentLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
    return {
      loader,
      logger,
      schemaValidator,
      dataRegistry,
      config,
      pathResolver,
      dataFetcher,
    };
  }

  it('registers inline data schemas when loading components', async () => {
    const modId = 'integrationMod';
    const componentId = `${modId}:glowing_component`;
    const manifest = {
      id: modId,
      content: {
        components: ['glowing-component.json'],
      },
    };

    const componentData = {
      id: componentId,
      description: 'Integration component with inline schema',
      dataSchema: {
        type: 'object',
        properties: {
          intensity: { type: 'number', minimum: 0 },
        },
        required: ['intensity'],
      },
    };

    await writeComponentFile(
      tempModsRoot,
      modId,
      manifest.content.components[0],
      componentData
    );

    const { loader, logger, schemaValidator, dataRegistry } =
      createLoaderEnvironment();

    const result = await loader.loadItemsForMod(
      modId,
      manifest,
      'components',
      'components',
      'components'
    );

    expect(result).toEqual({ count: 1, overrides: 0, errors: 0, failures: [] });
    expect(schemaValidator.schemas.get(componentId)).toEqual(
      componentData.dataSchema
    );
    expect(
      logger.debugLogs.some(({ message }) =>
        message.includes('Registered dataSchema for component ID')
      )
    ).toBe(true);

    const storedComponent = dataRegistry.get('components', componentId);
    expect(storedComponent).toMatchObject({
      id: 'glowing_component',
      _fullId: componentId,
      description: componentData.description,
      dataSchema: componentData.dataSchema,
    });
  });

  it('replaces previously registered schemas when the same component data is loaded again', async () => {
    const modId = 'overrideMod';
    const componentId = `${modId}:adjustable_component`;
    const manifest = {
      id: modId,
      content: {
        components: ['adjustable-component.json'],
      },
    };

    const logger = new RecordingLogger();
    const schemaValidator = new RecordingSchemaValidator(logger);
    const config = new TestConfiguration(tempModsRoot);
    const pathResolver = new TestPathResolver(tempModsRoot);
    const dataFetcher = new FileSystemDataFetcher();

    const initialDataRegistry = new InMemoryDataRegistry({ logger });
    const initialLoader = new ComponentLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      initialDataRegistry,
      logger
    );

    const initialData = {
      id: componentId,
      description: 'Initial version of the adjustable component',
      dataSchema: {
        type: 'object',
        properties: {
          range: { type: 'number', minimum: 0, maximum: 10 },
        },
        required: ['range'],
      },
    };

    await writeComponentFile(
      tempModsRoot,
      modId,
      manifest.content.components[0],
      initialData
    );

    await initialLoader.loadItemsForMod(
      modId,
      manifest,
      'components',
      'components',
      'components'
    );

    const updatedData = {
      id: componentId,
      description: 'Updated version requiring precision field',
      dataSchema: {
        type: 'object',
        properties: {
          range: { type: 'number', minimum: 0, maximum: 5 },
          precision: { type: 'integer', minimum: 0 },
        },
        required: ['range', 'precision'],
      },
    };

    await writeComponentFile(
      tempModsRoot,
      modId,
      manifest.content.components[0],
      updatedData
    );

    const reloadRegistry = new InMemoryDataRegistry({ logger });
    const reloadingLoader = new ComponentLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      reloadRegistry,
      logger
    );

    const reloadResult = await reloadingLoader.loadItemsForMod(
      modId,
      manifest,
      'components',
      'components',
      'components'
    );

    expect(reloadResult).toEqual({ count: 1, overrides: 0, errors: 0, failures: [] });
    expect(schemaValidator.removedSchemas).toContain(componentId);
    expect(schemaValidator.schemas.get(componentId)).toEqual(
      updatedData.dataSchema
    );
    expect(
      logger.warnLogs.some(({ message }) =>
        message.includes('overwriting an existing data schema')
      )
    ).toBe(true);
  });
});
