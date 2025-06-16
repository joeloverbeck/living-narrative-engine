import { describe, it, expect } from '@jest/globals';
import { readFile } from 'node:fs/promises';

import StaticConfiguration from '../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../src/loaders/schemaLoader.js';

describe('Integration – SchemaLoader operations', () => {
  it('loads and compiles all configured schemas', async () => {
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    const logger = new ConsoleLogger('ERROR');
    const validator = new AjvSchemaValidator(logger);

    const extraOps = [
      'operations/removeFromClosenessCircle.schema.json',
      'operations/mergeClosenessCircle.schema.json',
    ];
    const files = config.getSchemaFiles().concat(extraOps);
    config.getSchemaFiles = () => files;

    const fetcher = {
      async fetch(path) {
        try {
          const data = await readFile(path, { encoding: 'utf-8' });
          return JSON.parse(data);
        } catch (err) {
          if (err && err.code === 'ENOENT') {
            const alt = path.replace('/schemas/', '/schemas/operations/');
            const altData = await readFile(alt, { encoding: 'utf-8' });
            return JSON.parse(altData);
          }
          throw err;
        }
      },
    };

    const loader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      validator,
      logger
    );

    await expect(loader.loadAndCompileAllSchemas()).resolves.toBeUndefined();

    expect(validator.isSchemaLoaded(config.getRuleSchemaId())).toBe(true);
  });
});
