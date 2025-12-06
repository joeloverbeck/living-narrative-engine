import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import anatomySlotLibrarySchema from '../../../data/schemas/anatomy.slot-library.schema.json';
import anatomyBlueprintPartSchema from '../../../data/schemas/anatomy.blueprint-part.schema.json';
import anatomyBlueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';
import { createMockValidatedEventDispatcherForIntegration } from '../../common/mockFactories/index.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, ...args) {
    this.debugMessages.push(String(message), ...args.map(String));
  }

  info(message, ...args) {
    this.infoMessages.push(String(message), ...args.map(String));
  }

  warn(message, ...args) {
    this.warnMessages.push(String(message), ...args.map(String));
  }

  error(message, ...args) {
    this.errorMessages.push(String(message), ...args.map(String));
  }
}

class TestConfiguration extends StaticConfiguration {
  constructor(basePath) {
    super();
    this._basePathOverride = basePath;
  }

  getBaseDataPath() {
    return this._basePathOverride;
  }
}

class FileSystemDataFetcher {
  async fetch(identifier) {
    let normalized = identifier;
    if (normalized.startsWith('.//')) {
      normalized = normalized.slice(1);
    }
    const resolvedPath = path.isAbsolute(normalized)
      ? normalized
      : path.resolve(normalized);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${identifier}`);
    }
    const contents = fs.readFileSync(resolvedPath, 'utf8');
    return JSON.parse(contents);
  }
}

/**
 *
 * @param baseDir
 * @param segments
 * @param filename
 * @param data
 */
function writeJsonFile(baseDir, segments, filename, data) {
  const targetDir = path.join(baseDir, ...segments);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, filename),
    JSON.stringify(data, null, 2)
  );
}

/**
 *
 * @param baseDir
 */
async function createTestEnvironment(baseDir) {
  const container = new AppContainer();
  const logger = new TestLogger();
  container.register(tokens.ILogger, logger);
  container.register(
    tokens.IValidatedEventDispatcher,
    createMockValidatedEventDispatcherForIntegration()
  );
  container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });

  await registerLoaders(container);

  const configuration = new TestConfiguration(baseDir);
  container.register(tokens.IConfiguration, configuration);
  container.register(
    tokens.IPathResolver,
    new DefaultPathResolver(configuration)
  );
  container.register(tokens.IDataFetcher, new FileSystemDataFetcher());

  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const schemaEntries = [
    [commonSchema, 'schema://living-narrative-engine/common.schema.json'],
    [
      modManifestSchema,
      'schema://living-narrative-engine/mod-manifest.schema.json',
    ],
    [
      anatomySlotLibrarySchema,
      'schema://living-narrative-engine/anatomy.slot-library.schema.json',
    ],
    [
      anatomyBlueprintPartSchema,
      'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
    ],
    [
      anatomyBlueprintSchema,
      'schema://living-narrative-engine/anatomy.blueprint.schema.json',
    ],
  ];
  for (const [schema, id] of schemaEntries) {
    if (!schemaValidator.isSchemaLoaded(id)) {
      await schemaValidator.addSchema(schema, id);
    }
  }

  return {
    container,
    logger,
    slotLibraryLoader: container.resolve(tokens.AnatomySlotLibraryLoader),
    partLoader: container.resolve(tokens.AnatomyBlueprintPartLoader),
    blueprintLoader: (() => {
      const loader = container.resolve(tokens.AnatomyBlueprintLoader);
      loader._primarySchemaId = null;
      return loader;
    })(),
    dataRegistry: container.resolve(tokens.IDataRegistry),
  };
}

describe('AnatomyBlueprintLoader integration coverage', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'anatomy-blueprint-loader-')
    );
    fs.mkdirSync(path.join(tempDir, 'mods'), { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('composes blueprints from parts, compose instructions, and attachments with real collaborators', async () => {
    const modId = 'integration_mod';
    const manifest = {
      id: modId,
      content: {
        libraries: ['library.json'],
        parts: ['common.part.json', 'advanced.part.json'],
        blueprints: ['composed.blueprint.json'],
      },
    };

    const library = {
      $schema:
        'schema://living-narrative-engine/anatomy.slot-library.schema.json',
      id: `${modId}:library`,
      slotDefinitions: {
        head_base: {
          socket: 'neck_socket',
          requirements: {
            partType: 'head',
            components: ['anatomy:part'],
          },
        },
        arm_base: {
          socket: 'shoulder_socket',
          requirements: {
            partType: 'arm',
            components: ['anatomy:part'],
          },
        },
      },
      clothingDefinitions: {
        helmet: {
          blueprintSlots: ['head'],
          allowedLayers: ['outer'],
        },
        gloves: {
          blueprintSlots: ['left_arm', 'right_arm'],
          allowedLayers: ['base'],
        },
      },
    };

    const commonPart = {
      $schema:
        'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
      id: `${modId}:common_part`,
      slots: {
        torso: {
          socket: 'torso_socket',
          requirements: {
            partType: 'torso',
            components: ['anatomy:part'],
          },
        },
      },
      clothingSlotMappings: {
        chest: {
          blueprintSlots: ['torso'],
          allowedLayers: ['base'],
        },
      },
    };

    const advancedPart = {
      $schema:
        'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
      id: `${modId}:advanced_part`,
      library: `${modId}:library`,
      slots: {
        head: { $use: 'head_base', optional: true },
        left_arm: { $use: 'arm_base' },
      },
      clothingSlotMappings: {
        helmet: { $use: 'helmet', accent: 'plume' },
        gloves: { $use: 'gloves' },
      },
    };

    const blueprint = {
      $schema: 'schema://living-narrative-engine/anatomy.blueprint.schema.json',
      id: `${modId}:assembled`,
      root: `${modId}:torso`,
      attachments: [
        { parent: 'torso', socket: 'neck', child: 'head' },
        { parent: 'torso', socket: 'neck', child: 'head_variant' },
      ],
      parts: [`${modId}:common_part`],
      compose: [
        {
          part: `${modId}:advanced_part`,
          include: ['slots', 'clothingSlotMappings'],
          excludeSlots: ['left_arm'],
          excludeClothingSlots: ['gloves'],
        },
      ],
    };

    writeJsonFile(
      tempDir,
      ['mods', modId, 'libraries'],
      'library.json',
      library
    );
    writeJsonFile(
      tempDir,
      ['mods', modId, 'parts'],
      'common.part.json',
      commonPart
    );
    writeJsonFile(
      tempDir,
      ['mods', modId, 'parts'],
      'advanced.part.json',
      advancedPart
    );
    writeJsonFile(
      tempDir,
      ['mods', modId, 'blueprints'],
      'composed.blueprint.json',
      blueprint
    );

    const env = await createTestEnvironment(tempDir);

    const libraryResult = await env.slotLibraryLoader.loadItemsForMod(
      modId,
      manifest,
      'libraries',
      'libraries',
      'anatomySlotLibraries'
    );
    expect(libraryResult.errors).toBe(0);

    const partResult = await env.partLoader.loadItemsForMod(
      modId,
      manifest,
      'parts',
      'parts',
      'anatomyBlueprintParts'
    );
    expect(partResult.errors).toBe(0);

    const blueprintResult = await env.blueprintLoader.loadItemsForMod(
      modId,
      manifest,
      'blueprints',
      'blueprints',
      'anatomyBlueprints'
    );
    expect(blueprintResult.errors).toBe(0);

    await env.blueprintLoader.finalize();

    const storedBlueprint = env.dataRegistry.get(
      'anatomyBlueprints',
      `${modId}:assembled`
    );
    expect(storedBlueprint).toBeDefined();
    expect(storedBlueprint.parts).toBeUndefined();
    expect(storedBlueprint.compose).toBeUndefined();

    expect(storedBlueprint.slots.torso).toEqual({
      socket: 'torso_socket',
      requirements: {
        partType: 'torso',
        components: ['anatomy:part'],
      },
    });
    expect(storedBlueprint.slots.head).toEqual({
      socket: 'neck_socket',
      requirements: {
        partType: 'head',
        components: ['anatomy:part'],
      },
      optional: true,
    });
    expect(storedBlueprint.slots.left_arm).toBeUndefined();

    expect(storedBlueprint.clothingSlotMappings.chest).toEqual({
      blueprintSlots: ['torso'],
      allowedLayers: ['base'],
    });
    expect(storedBlueprint.clothingSlotMappings.helmet).toEqual({
      blueprintSlots: ['head'],
      allowedLayers: ['outer'],
      accent: 'plume',
    });
    expect(storedBlueprint.clothingSlotMappings.gloves).toBeUndefined();

    expect(storedBlueprint.attachments).toHaveLength(2);
    expect(
      env.logger.warnMessages.some((message) =>
        message.includes("Duplicate parent-socket pair 'torso:neck'")
      )
    ).toBe(true);
  });

  it('fails composition when referenced part is missing', async () => {
    const modId = 'missing_part_mod';
    const manifest = {
      id: modId,
      content: {
        blueprints: ['missing-part.blueprint.json'],
      },
    };

    const blueprint = {
      $schema: 'schema://living-narrative-engine/anatomy.blueprint.schema.json',
      id: `${modId}:needs_parts`,
      root: `${modId}:torso`,
      parts: [`${modId}:absent_part`],
    };

    writeJsonFile(
      tempDir,
      ['mods', modId, 'blueprints'],
      'missing-part.blueprint.json',
      blueprint
    );

    const env = await createTestEnvironment(tempDir);

    const blueprintResult = await env.blueprintLoader.loadItemsForMod(
      modId,
      manifest,
      'blueprints',
      'blueprints',
      'anatomyBlueprints'
    );
    expect(blueprintResult.errors).toBe(0);

    await expect(env.blueprintLoader.finalize()).rejects.toThrow(
      `Blueprint '${modId}:needs_parts' references unknown part '${modId}:absent_part'`
    );
  });

  it('throws when a composed part relies on an unavailable slot library definition', async () => {
    const modId = 'missing_library_mod';
    const manifest = {
      id: modId,
      content: {
        parts: ['library-dependent.part.json'],
        blueprints: ['needs-library.blueprint.json'],
      },
    };

    const part = {
      $schema:
        'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
      id: `${modId}:dependent_part`,
      library: `${modId}:undefined_library`,
      slots: {
        head: { $use: 'head_base' },
      },
    };

    const blueprint = {
      $schema: 'schema://living-narrative-engine/anatomy.blueprint.schema.json',
      id: `${modId}:needs_library`,
      root: `${modId}:torso`,
      compose: [
        {
          part: `${modId}:dependent_part`,
          include: ['slots'],
        },
      ],
    };

    writeJsonFile(
      tempDir,
      ['mods', modId, 'parts'],
      'library-dependent.part.json',
      part
    );
    writeJsonFile(
      tempDir,
      ['mods', modId, 'blueprints'],
      'needs-library.blueprint.json',
      blueprint
    );

    const env = await createTestEnvironment(tempDir);

    const partResult = await env.partLoader.loadItemsForMod(
      modId,
      manifest,
      'parts',
      'parts',
      'anatomyBlueprintParts'
    );
    expect(partResult.errors).toBe(0);

    const blueprintResult = await env.blueprintLoader.loadItemsForMod(
      modId,
      manifest,
      'blueprints',
      'blueprints',
      'anatomyBlueprints'
    );
    expect(blueprintResult.errors).toBe(0);

    await expect(env.blueprintLoader.finalize()).rejects.toThrow(
      "Slot definition uses $use but no library or library section 'slotDefinitions' available"
    );
  });

  it('records schema validation failures for malformed attachments', async () => {
    const modId = 'attachment_failure_mod';
    const manifest = {
      id: modId,
      content: {
        blueprints: ['invalid-attachment.blueprint.json'],
      },
    };

    const blueprint = {
      $schema: 'schema://living-narrative-engine/anatomy.blueprint.schema.json',
      id: `${modId}:invalid_attachment`,
      root: `${modId}:torso`,
      attachments: [{ parent: 'torso', socket: 'neck' }],
    };

    writeJsonFile(
      tempDir,
      ['mods', modId, 'blueprints'],
      'invalid-attachment.blueprint.json',
      blueprint
    );

    const env = await createTestEnvironment(tempDir);

    const result = await env.blueprintLoader.loadItemsForMod(
      modId,
      manifest,
      'blueprints',
      'blueprints',
      'anatomyBlueprints'
    );

    expect(result.errors).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBeInstanceOf(Error);
    expect(result.failures[0].error.message).toContain(
      "Invalid attachment in blueprint 'invalid-attachment.blueprint.json' from mod 'attachment_failure_mod'"
    );
    expect(env.blueprintLoader._pendingBlueprints.size).toBe(0);
  });
});
