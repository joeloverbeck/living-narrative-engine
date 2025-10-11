import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { EntityInstanceLoader } from '../../../src/loaders/entityInstanceLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { ValidationError } from '../../../src/errors/validationError.js';

const ENTITY_INSTANCE_SCHEMA_PATH = path.resolve(
  'data/schemas/entity-instance.schema.json'
);

const COMPLEX_COMPONENT_SCHEMA_ID = 'integration-tests:complexComponent';
const COMPLEX_COMPONENT_SCHEMA = {
  $id: COMPLEX_COMPONENT_SCHEMA_ID,
  type: 'object',
  anyOf: Array.from({ length: 60 }, (_, index) => ({
    type: 'object',
    properties: {
      type: { const: `op${index}` },
      parameters: {
        type: 'object',
        properties: {
          requiredField: { type: 'string' },
          numericField: { type: 'number', minimum: 0 },
        },
        required: ['requiredField', 'numericField'],
        additionalProperties: false,
      },
    },
    required: ['type', 'parameters'],
    additionalProperties: false,
  })),
};

const SIMPLE_COMPONENT_SCHEMA_ID = 'integration-tests:simpleComponent';
const SIMPLE_COMPONENT_SCHEMA = {
  $id: SIMPLE_COMPONENT_SCHEMA_ID,
  type: 'object',
  properties: {
    mandatory: { type: 'string' },
  },
  required: ['mandatory'],
  additionalProperties: false,
};

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

let entityInstanceSchema;

beforeAll(async () => {
  const schemaText = await fs.readFile(ENTITY_INSTANCE_SCHEMA_PATH, 'utf8');
  entityInstanceSchema = JSON.parse(schemaText);
});

describe('formatAjvErrors integration via EntityInstanceLoader', () => {
  let logger;
  let schemaValidator;
  let dataFetcher;
  let pathResolver;
  let configuration;
  let dataRegistry;
  let loader;
  const manifest = {
    id: 'integration-mod',
    content: {
      entities: {
        instances: ['complex-instance.json'],
      },
    },
  };

  beforeEach(async () => {
    logger = new TestLogger();
    schemaValidator = new AjvSchemaValidator({ logger });
    await schemaValidator.addSchema(entityInstanceSchema, entityInstanceSchema.$id);
    await schemaValidator.addSchema(
      COMPLEX_COMPONENT_SCHEMA,
      COMPLEX_COMPONENT_SCHEMA_ID
    );
    await schemaValidator.addSchema(
      SIMPLE_COMPONENT_SCHEMA,
      SIMPLE_COMPONENT_SCHEMA_ID
    );

    configuration = {
      getContentTypeSchemaId: jest
        .fn()
        .mockImplementation((key) =>
          key === 'entityInstances' ? entityInstanceSchema.$id : null
        ),
      getModsBasePath: jest.fn(() => '/tmp/mods'),
      get: jest.fn(() => null),
    };

    pathResolver = {
      resolveModContentPath: jest.fn(() => '/tmp/mods/integration-mod/entity.json'),
    };

    dataFetcher = {
      fetch: jest.fn(),
    };

    dataRegistry = new InMemoryDataRegistry();

    loader = new EntityInstanceLoader(
      configuration,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  });

  it('summarizes cascading errors for a known operation type', async () => {
    dataFetcher.fetch.mockResolvedValueOnce({
      $schema: entityInstanceSchema.$id,
      instanceId: 'integration:invalid-known',
      definitionId: 'integration:definition',
      componentOverrides: {
        [COMPLEX_COMPONENT_SCHEMA_ID]: {
          type: 'op5',
          parameters: { requiredField: 123 },
        },
      },
    });

    const result = await loader.loadItemsForMod(
      manifest.id,
      manifest,
      'entities.instances',
      'entities/instances',
      'entityInstances'
    );

    expect(result.errors).toBe(1);
    expect(result.failures[0].error).toBeInstanceOf(ValidationError);
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes("Validation failed for operation type 'op5'") &&
        message.includes('numericField') &&
        message.includes('requiredField')
      )
    ).toBe(true);
  });

  it('provides cascading error warning when operation type is missing', async () => {
    dataFetcher.fetch.mockResolvedValueOnce({
      $schema: entityInstanceSchema.$id,
      instanceId: 'integration:missing-type',
      definitionId: 'integration:definition',
      componentOverrides: {
        [COMPLEX_COMPONENT_SCHEMA_ID]: {
          parameters: {},
        },
      },
    });

    const result = await loader.loadItemsForMod(
      manifest.id,
      manifest,
      'entities.instances',
      'entities/instances',
      'entityInstances'
    );

    expect(result.errors).toBe(1);
    expect(result.failures[0].error).toBeInstanceOf(ValidationError);
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('Warning:') &&
          message.includes('validation errors detected')
      )
    ).toBe(true);
  });

  it('falls back to raw Ajv JSON output for compact error sets', async () => {
    dataFetcher.fetch.mockResolvedValueOnce({
      $schema: entityInstanceSchema.$id,
      instanceId: 'integration:simple-invalid',
      definitionId: 'integration:definition',
      componentOverrides: {
        [SIMPLE_COMPONENT_SCHEMA_ID]: {
          mandatory: 123,
        },
      },
    });

    const result = await loader.loadItemsForMod(
      manifest.id,
      manifest,
      'entities.instances',
      'entities/instances',
      'entityInstances'
    );

    expect(result.errors).toBe(1);
    expect(result.failures[0].error).toBeInstanceOf(ValidationError);
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('must be string') && message.includes('"keyword": "type"')
      )
    ).toBe(true);
  });
});
