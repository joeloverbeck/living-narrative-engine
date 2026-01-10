/**
 * @file Integration tests for emotions-loss expression content.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StaticConfiguration from '../../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../../src/loaders/schemaLoader.js';

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-loss/expressions');
const AFFILIATION_DIR = path.resolve(
  'data/mods/emotions-affiliation/expressions'
);
const EXPRESSION_FILES = [
  { dir: EXPRESSIONS_DIR, file: 'deep_despair.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'quiet_grief.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'melancholic_disappointment.expression.json' },
  { dir: AFFILIATION_DIR, file: 'lonely_isolation.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'tearful_sorrow.expression.json' },
];

describe('Emotions loss expressions', () => {
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

  it('validates loss expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all loss expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });
});
