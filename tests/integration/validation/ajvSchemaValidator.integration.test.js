import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';

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

const storeComponentDefinition = (registry, definition) => {
  registry.store('components', definition.id, definition);
};

describe('AjvSchemaValidator integration - schema resolution', () => {
  it('resolves relative references with pointer decoding via fallback search', async () => {
    const logger = new TestLogger();
    const validator = new AjvSchemaValidator({ logger });

    const baseSchema = {
      $id: 'schema://custom-pack/components/base.schema.json',
      type: 'object',
      definitions: {
        'stats/speed': { type: 'number', minimum: 0 },
        'tilde~name': { type: 'string', const: 'decoded-value' },
      },
    };

    await validator.addSchema(baseSchema, baseSchema.$id);

    const aliasSchema = JSON.parse(JSON.stringify(baseSchema));
    aliasSchema.$id =
      'schema://living-narrative-engine/components/base.schema.json';
    await validator.addSchema(aliasSchema, aliasSchema.$id);

    const referencingSchema = {
      $id: 'schema://living-narrative-engine/features/child.schema.json',
      type: 'object',
      properties: {
        speed: {
          $ref: '../components/base.schema.json#/definitions/stats~1speed',
        },
        label: {
          $ref: '../components/base.schema.json#/definitions/tilde~0name',
        },
      },
      required: ['speed', 'label'],
    };

    await validator.addSchema(referencingSchema, referencingSchema.$id);

    expect(validator.validateSchemaRefs(referencingSchema.$id)).toBe(true);
    expect(validator.isSchemaLoaded(referencingSchema.$id)).toBe(true);

    const result = validator.validate(referencingSchema.$id, {
      speed: 5,
      label: 'decoded-value',
    });

    expect(result).toEqual({ isValid: true, errors: null });
    expect(validator.getLoadedSchemaIds()).toEqual(
      expect.arrayContaining([
        'schema://custom-pack/components/base.schema.json',
        'schema://living-narrative-engine/components/base.schema.json',
        referencingSchema.$id,
      ])
    );
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('throws a descriptive error when relative fragments cannot be resolved', async () => {
    const logger = new TestLogger();
    const validator = new AjvSchemaValidator({ logger });

    const baseSchema = {
      $id: 'schema://custom-pack/components/base.schema.json',
      type: 'object',
      definitions: {
        existing: { type: 'string' },
      },
    };
    await validator.addSchema(baseSchema, baseSchema.$id);

    const schemaWithMissingFragment = {
      $id: 'schema://living-narrative-engine/features/broken.schema.json',
      type: 'object',
      properties: {
        value: {
          $ref: '../components/base.schema.json#/definitions/missing-fragment',
        },
      },
    };

    await validator.addSchema(
      schemaWithMissingFragment,
      schemaWithMissingFragment.$id
    );

    expect(validator.validateSchemaRefs(schemaWithMissingFragment.$id)).toBe(
      false
    );

    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes(
          "AjvSchemaValidator: Schema 'schema://living-narrative-engine/features/broken.schema.json' has unresolved $refs"
        )
      )
    ).toBe(true);
  });
});

describe('AjvSchemaValidator integration - schema removal and diagnostics', () => {
  class StickyAjv extends Ajv {
    removeSchema() {
      return this;
    }
  }

  it('reports an error when Ajv refuses to remove a schema', async () => {
    const logger = new TestLogger();
    const ajvInstance = new StickyAjv({ allErrors: true, strict: false });
    addFormats(ajvInstance);

    const validator = new AjvSchemaValidator({ logger, ajvInstance });

    const schema = {
      $id: 'schema://diagnostics/sticky.schema.json',
      type: 'object',
    };

    await validator.addSchema(schema, schema.$id);

    const removalResult = validator.removeSchema(schema.$id);

    expect(removalResult).toBe(false);
    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes(
          "AjvSchemaValidator: Called removeSchema for 'schema://diagnostics/sticky.schema.json', but it still appears present."
        )
      )
    ).toBe(true);
  });

  it('recovers gracefully when Ajv refuses to expose loaded schema identifiers', () => {
    const logger = new TestLogger();
    const ajvInstance = new Ajv({ allErrors: true, strict: false });
    addFormats(ajvInstance);
    Object.defineProperty(ajvInstance, 'schemas', {
      configurable: true,
      get() {
        throw new Error('introspection failure');
      },
    });

    const validator = new AjvSchemaValidator({ logger, ajvInstance });

    const ids = validator.getLoadedSchemaIds();

    expect(ids).toEqual([]);
    expect(
      logger.errorMessages.some(
        ({ message }) =>
          message === 'AjvSchemaValidator: Error getting loaded schema IDs'
      )
    ).toBe(true);
  });
});

describe('AjvSchemaValidator integration - generated validator coordination', () => {
  const createValidatorWithGenerator = () => {
    const logger = new TestLogger();
    const dataRegistry = new InMemoryDataRegistry({ logger });
    const similarityCalculator = new StringSimilarityCalculator({ logger });
    const validatorGenerator = new ValidatorGenerator({
      logger,
      similarityCalculator,
    });
    const validator = new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry,
    });
    return { validator, logger, dataRegistry };
  };

  const registerComponent = async (
    validator,
    dataRegistry,
    ajvSchema,
    componentDefinition
  ) => {
    await validator.addSchema(ajvSchema, ajvSchema.$id);
    storeComponentDefinition(dataRegistry, componentDefinition);
  };

  it('prefers generated errors when Ajv passes but the generated validator fails', async () => {
    const { validator, dataRegistry } = createValidatorWithGenerator();

    const schemaId = 'component://emotion-profile';
    const ajvSchema = {
      $id: schemaId,
      type: 'object',
      properties: {
        mood: { type: 'string' },
        tone: { type: 'string' },
      },
      required: ['tone'],
      additionalProperties: false,
    };

    const componentDefinition = {
      id: schemaId,
      dataSchema: {
        type: 'object',
        properties: {
          mood: {
            type: 'string',
            enum: ['happy', 'calm'],
          },
          tone: {
            type: 'string',
          },
        },
        required: ['mood'],
      },
      validationRules: {
        generateValidator: true,
        errorMessages: {
          invalidEnum: 'Unexpected mood {{value}}',
        },
        suggestions: {
          enableSimilarity: true,
        },
      },
    };

    await registerComponent(
      validator,
      dataRegistry,
      ajvSchema,
      componentDefinition
    );

    const result = validator.validate(schemaId, {
      mood: 'angry',
      tone: 'measured',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        type: 'invalidEnum',
        property: 'mood',
        value: 'angry',
      }),
    ]);
  });

  it('falls back to Ajv errors when generated validation succeeds but Ajv fails', async () => {
    const { validator, dataRegistry } = createValidatorWithGenerator();

    const schemaId = 'component://emotion-profile';
    const ajvSchema = {
      $id: schemaId,
      type: 'object',
      properties: {
        mood: { type: 'string' },
        tone: { type: 'string' },
      },
      required: ['tone'],
      additionalProperties: false,
    };

    const componentDefinition = {
      id: schemaId,
      dataSchema: {
        type: 'object',
        properties: {
          mood: {
            type: 'string',
            enum: ['happy', 'calm'],
          },
          tone: {
            type: 'string',
          },
        },
        required: ['mood'],
      },
      validationRules: {
        generateValidator: true,
      },
    };

    await registerComponent(
      validator,
      dataRegistry,
      ajvSchema,
      componentDefinition
    );

    const result = validator.validate(schemaId, {
      tone: 'bright',
      extra: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: 'additionalProperties' }),
      ])
    );
  });

  it('merges Ajv and generated errors when both validators fail different fields', async () => {
    const { validator, dataRegistry } = createValidatorWithGenerator();

    const schemaId = 'component://emotion-profile';
    const ajvSchema = {
      $id: schemaId,
      type: 'object',
      properties: {
        mood: { type: 'string' },
        tone: { type: 'string' },
      },
      required: ['tone'],
      additionalProperties: false,
    };

    const componentDefinition = {
      id: schemaId,
      dataSchema: {
        type: 'object',
        properties: {
          mood: {
            type: 'string',
            enum: ['happy', 'calm'],
          },
          tone: {
            type: 'string',
          },
        },
        required: ['mood'],
      },
      validationRules: {
        generateValidator: true,
      },
    };

    await registerComponent(
      validator,
      dataRegistry,
      ajvSchema,
      componentDefinition
    );

    const result = validator.validate(schemaId, {
      mood: 'angry',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'mood', type: 'invalidEnum' }),
        expect.objectContaining({ keyword: 'required' }),
      ])
    );
    expect(
      result.errors.filter((error) => error.keyword === 'required').length
    ).toBe(1);
  });

  it('logs and short-circuits when enhanced validation is disabled', () => {
    const logger = new TestLogger();
    const validator = new AjvSchemaValidator({ logger });

    validator.preGenerateValidators();

    expect(
      logger.debugMessages.some(
        ({ message }) =>
          message === 'Pre-generation skipped: Enhanced validation not enabled'
      )
    ).toBe(true);
  });

  it('pre-generates validators and logs failures from generator exceptions', async () => {
    const logger = new TestLogger();
    const dataRegistry = new InMemoryDataRegistry({ logger });
    const similarityCalculator = new StringSimilarityCalculator({ logger });
    const validatorGenerator = new ValidatorGenerator({
      logger,
      similarityCalculator,
    });
    const validator = new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry,
    });

    const validComponent = {
      id: 'component://valid',
      dataSchema: {
        type: 'object',
        properties: {
          mood: { type: 'string', enum: ['happy'] },
        },
        required: ['mood'],
      },
      validationRules: {
        generateValidator: true,
      },
    };

    const invalidComponent = {
      id: 'component://invalid',
      validationRules: {
        generateValidator: true,
      },
    };

    storeComponentDefinition(dataRegistry, validComponent);
    storeComponentDefinition(dataRegistry, invalidComponent);

    validator.preGenerateValidators([validComponent, invalidComponent]);

    expect(
      logger.infoMessages.some(({ message }) =>
        message.startsWith('Pre-generating validators for 2 component schemas')
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some(({ message }) =>
        message.startsWith(
          'Failed to pre-generate validator for component://invalid'
        )
      )
    ).toBe(true);
  });

  it('captures generator exceptions during validation as structured errors', async () => {
    const logger = new TestLogger();
    const dataRegistry = new InMemoryDataRegistry({ logger });
    const similarityCalculator = new StringSimilarityCalculator({ logger });
    const validatorGenerator = new ValidatorGenerator({
      logger,
      similarityCalculator,
    });
    const validator = new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry,
    });

    const schemaId = 'component://broken-component';
    const ajvSchema = {
      $id: schemaId,
      type: 'object',
    };

    await validator.addSchema(ajvSchema, ajvSchema.$id);

    const brokenDefinition = {
      id: schemaId,
      validationRules: {
        generateValidator: true,
      },
    };
    storeComponentDefinition(dataRegistry, brokenDefinition);

    const result = validator.validate(schemaId, {});

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        keyword: 'validationError',
        message: expect.stringContaining(
          'Component schema must have dataSchema'
        ),
      }),
    ]);
    expect(
      logger.errorMessages.some(
        ({ message }) => message === `Validation failed for schema ${schemaId}`
      )
    ).toBe(true);
  });
});
