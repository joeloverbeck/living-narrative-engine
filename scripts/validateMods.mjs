import fs from 'fs/promises';
import path from 'path';
import StaticConfiguration from '../src/services/staticConfiguration.js';
import DefaultPathResolver from '../src/services/defaultPathResolver.js';
import AjvSchemaValidator from '../src/services/ajvSchemaValidator.js';
import ConsoleLogger, { LogLevel } from '../src/services/consoleLogger.js';
import SchemaLoader from '../src/loaders/schemaLoader.js';
import ModManifestLoader from '../src/modding/modManifestLoader.js';
import ModDependencyValidator from '../src/modding/modDependencyValidator.js';
import validateModEngineVersions from '../src/modding/modVersionValidator.js';
import InMemoryDataRegistry from '../src/services/inMemoryDataRegistry.js';

/** Simple IDataFetcher implementation using Node's fs module. */
class NodeDataFetcher {
  async fetch(identifier) {
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new Error('NodeDataFetcher: invalid identifier');
    }
    const data = await fs.readFile(identifier, 'utf8');
    return JSON.parse(data);
  }
}

const logger = new ConsoleLogger(LogLevel.INFO);
const config = new StaticConfiguration();
const resolver = new DefaultPathResolver(config);
const fetcher = new NodeDataFetcher();
const validator = new AjvSchemaValidator(logger);
const registry = new InMemoryDataRegistry();
const schemaLoader = new SchemaLoader(
  config,
  resolver,
  fetcher,
  validator,
  logger
);
const manifestLoader = new ModManifestLoader(
  config,
  resolver,
  fetcher,
  validator,
  registry,
  logger
);

/**
 *
 * @param modId
 * @param manifest
 */
async function validateContent(modId, manifest) {
  if (!manifest.content) return [];
  const errors = [];
  for (const [type, files] of Object.entries(manifest.content)) {
    if (!Array.isArray(files)) continue;
    const schemaId = config.getContentTypeSchemaId(type);
    for (const file of files) {
      try {
        const filePath = resolver.resolveModContentPath(modId, type, file);
        const data = await fetcher.fetch(filePath);
        if (schemaId) {
          const res = validator.validate(schemaId, data);
          if (!res.isValid) {
            errors.push(
              `Mod ${modId}: file ${type}/${file} failed schema validation.`
            );
            logger.error(
              `Validation errors for ${modId} ${type}/${file}:`,
              res.errors
            );
          }
        }
      } catch (e) {
        errors.push(
          `Mod ${modId}: error processing ${type}/${file} - ${e.message}`
        );
        logger.error(
          `Error processing ${modId} ${type}/${file}: ${e.message}`,
          e
        );
      }
    }
  }
  return errors;
}

/**
 *
 */
async function run() {
  try {
    await schemaLoader.loadAndCompileAllSchemas();
    const modsDir = path.join(
      config.getBaseDataPath(),
      config.getModsBasePath()
    );
    const dirEntries = await fs.readdir(modsDir, { withFileTypes: true });
    const modIds = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name);
    const manifests = await manifestLoader.loadRequestedManifests(modIds);

    const manifestMap = new Map();
    const duplicateErrors = [];
    for (const [id, manifest] of manifests.entries()) {
      const lc = id.toLowerCase();
      if (manifestMap.has(lc)) {
        duplicateErrors.push(
          `Duplicate mod ID '${lc}' from directories '${manifestMap.get(lc).id}' and '${manifest.id}'.`
        );
      } else {
        manifestMap.set(lc, manifest);
      }
    }

    duplicateErrors.forEach((err) => logger.error(err));
    if (duplicateErrors.length) {
      console.log('Mod ID duplication errors detected.');
    }

    try {
      ModDependencyValidator.validate(manifestMap, logger);
      validateModEngineVersions(manifestMap, logger);
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    }

    const contentErrors = [];
    for (const [lcId, manifest] of manifestMap.entries()) {
      const errs = await validateContent(manifest.id, manifest);
      contentErrors.push(...errs);
    }
    contentErrors.forEach((e) => logger.error(e));

    if (
      duplicateErrors.length === 0 &&
      contentErrors.length === 0 &&
      process.exitCode !== 1
    ) {
      console.log('All mods passed validation.');
    } else {
      console.log('Mod validation completed with issues.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error during validation:', err);
    process.exitCode = 1;
  }
}

run();
