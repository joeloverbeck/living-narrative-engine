import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(...args) {
    this.debugMessages.push(args);
  }

  info(...args) {
    this.infoMessages.push(args);
  }

  warn(...args) {
    this.warnMessages.push(args);
  }

  error(...args) {
    this.errorMessages.push(args);
  }
}

describe('AjvSchemaValidator fault tolerance integration', () => {
  it('throws a descriptive error when the logger dependency is incomplete', () => {
    expect(() => new AjvSchemaValidator({ logger: {} })).toThrow(
      "AjvSchemaValidator: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, debug."
    );
  });

  it('does not verify schema retrieval on add (performance optimization)', async () => {
    // HISTORY: This test previously verified that a warning was logged when a schema
    // could not be retrieved immediately after being added. That post-add verification
    // was removed as a performance optimization (avoids 20-75ms compilation overhead
    // per schema). Schema correctness is now validated lazily at validation time.
    class NonRetrievableAjv extends Ajv {
      constructor(options) {
        super(options);
        this._failedLookups = new Set();
      }

      getSchema(id) {
        const schemaEnv = super.getSchema(id);
        if (schemaEnv && !this._failedLookups.has(id)) {
          this._failedLookups.add(id);
          return undefined;
        }
        return schemaEnv;
      }
    }

    const logger = new RecordingLogger();
    const ajvInstance = new NonRetrievableAjv({
      allErrors: true,
      strict: false,
    });
    addFormats(ajvInstance);
    const validator = new AjvSchemaValidator({ logger, ajvInstance });

    const schema = {
      $id: 'schema://diagnostics/unretrievable.schema.json',
      type: 'object',
      properties: { id: { type: 'string' } },
    };

    // Schema addition should succeed without post-add verification
    await expect(
      validator.addSchema(schema, schema.$id)
    ).resolves.toBeUndefined();

    // No warning about retrieval failure at add time (performance optimization)
    expect(
      logger.warnMessages.some((args) =>
        String(args[0]).includes('was added but cannot be retrieved')
      )
    ).toBe(false);

    // The schema is registered in the map
    expect(validator.isSchemaLoaded(schema.$id)).toBe(true);
  });

  it('surfaces Ajv validation errors when schema registration throws', async () => {
    class ExplodingAjv extends Ajv {
      addSchema(schema, key) {
        const id =
          typeof key === 'string' && key.length > 0 ? key : schema?.$id;
        if (id === 'schema://diagnostics/exploding.schema.json') {
          const error = new Error('schema explosion');
          error.errors = [
            {
              instancePath: '',
              schemaPath: '#/type',
              keyword: 'type',
              params: {},
              message: 'must be object',
            },
          ];
          throw error;
        }
        return super.addSchema(schema, key);
      }
    }

    const logger = new RecordingLogger();
    const ajvInstance = new ExplodingAjv({ allErrors: true, strict: false });
    addFormats(ajvInstance);
    const validator = new AjvSchemaValidator({ logger, ajvInstance });

    const schema = {
      $id: 'schema://diagnostics/exploding.schema.json',
      type: 'object',
    };

    await expect(validator.addSchema(schema, schema.$id)).rejects.toThrow(
      'schema explosion'
    );

    expect(
      logger.errorMessages.some((args) =>
        String(args[0]).includes('Ajv Validation Errors (during addSchema):')
      )
    ).toBe(true);
  });

  it('wraps runtime exceptions from Ajv validator functions with diagnostic context', async () => {
    const logger = new RecordingLogger();
    const ajvInstance = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });
    addFormats(ajvInstance);
    const validator = new AjvSchemaValidator({ logger, ajvInstance });

    const schemaId = 'schema://diagnostics/runtime.schema.json';
    const schema = {
      $id: schemaId,
      type: 'string',
    };

    await validator.addSchema(schema, schemaId);

    const originalGetSchema = ajvInstance.getSchema.bind(ajvInstance);
    ajvInstance.getSchema = (id) => {
      if (id === schemaId) {
        const throwingValidator = () => {
          throw new Error('dynamic failure');
        };
        throwingValidator.errors = [{ keyword: 'type', message: 'boom' }];
        return throwingValidator;
      }
      return originalGetSchema(id);
    };

    const result = validator.validate(schemaId, 'value');

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ keyword: 'runtimeError' }),
    ]);

    expect(
      logger.errorMessages.some((args) =>
        String(args[0]).includes('Runtime error during validation with schema')
      )
    ).toBe(true);
  });

  it('rejects addSchemas when entries are missing identifiers', async () => {
    const logger = new RecordingLogger();
    const validator = new AjvSchemaValidator({ logger });

    await expect(validator.addSchemas([null])).rejects.toThrow(
      'All schemas must be objects with a valid $id.'
    );

    expect(
      logger.errorMessages.some((args) =>
        String(args[0]).includes(
          'All schemas must be objects with a valid $id.'
        )
      )
    ).toBe(true);
  });

  it('prefers Ajv errors when generated validators report success', async () => {
    const logger = new RecordingLogger();
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

    const schemaId = 'component://mismatched';
    const ajvSchema = {
      $id: schemaId,
      type: 'object',
      properties: {
        tone: { type: 'string' },
        mood: { type: 'string' },
      },
      required: ['tone'],
      additionalProperties: false,
    };

    await validator.addSchema(ajvSchema, schemaId);

    const componentDefinition = {
      id: schemaId,
      dataSchema: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
        },
      },
      validationRules: {
        generateValidator: true,
      },
    };

    dataRegistry.store('components', schemaId, componentDefinition);

    const ajvOnlyValidator = validator.getValidator(schemaId);
    const ajvOnlyResult = ajvOnlyValidator({ mood: 'calm' });

    const combinedResult = validator.validate(schemaId, { mood: 'calm' });

    expect(combinedResult).toEqual(ajvOnlyResult);
    expect(combinedResult.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: 'required' })])
    );
  });
});
