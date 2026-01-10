/**
 * @file Integration tests for emotions joy/arousal expression content.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StaticConfiguration from '../../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../../src/loaders/schemaLoader.js';

const POSITIVE_AFFECT_DIR = path.resolve(
  'data/mods/emotions-positive-affect/expressions'
);
const AFFILIATION_DIR = path.resolve(
  'data/mods/emotions-affiliation/expressions'
);
const SEXUALITY_DIR = path.resolve(
  'data/mods/emotions-sexuality/expressions'
);
const EXPRESSION_FILES = [
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'euphoric_excitement.expression.json',
  },
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'quiet_contentment.expression.json',
  },
  {
    dir: AFFILIATION_DIR,
    file: 'warm_affection.expression.json',
  },
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'playful_mischief.expression.json',
  },
  {
    dir: SEXUALITY_DIR,
    file: 'intense_desire.expression.json',
  },
];

describe('Emotions joy/arousal expressions', () => {
  let expressionsById;
  let schemaValidator;

  beforeAll(async () => {
    const logger = new ConsoleLogger('ERROR');
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    schemaValidator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(filePath) {
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    const schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      schemaValidator,
      logger
    );

    await schemaLoader.loadAndCompileAllSchemas();
    const expressions = await Promise.all(
      EXPRESSION_FILES.map(async ({ dir, file }) => {
        const filePath = path.join(dir, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    expressionsById = Object.fromEntries(
      expressions.map((expression) => [expression.id, expression])
    );

  });

  it('validates joy/arousal expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all joy/arousal expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });
});
