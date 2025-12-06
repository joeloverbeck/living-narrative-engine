import { describe, it, beforeEach, expect } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

class RecordingLogger {
  constructor() {
    /** @type {{message: string, args: any[]}[]} */
    this.debugMessages = [];
    /** @type {{message: string, args: any[]}[]} */
    this.infoMessages = [];
    /** @type {{message: string, args: any[]}[]} */
    this.warnMessages = [];
    /** @type {{message: string, args: any[]}[]} */
    this.errorMessages = [];
  }

  debug(message, ...args) {
    this.debugMessages.push({ message, args });
  }

  info(message, ...args) {
    this.infoMessages.push({ message, args });
  }

  warn(message, ...args) {
    this.warnMessages.push({ message, args });
  }

  error(message, ...args) {
    this.errorMessages.push({ message, args });
  }
}

describe('AjvSchemaValidator real-module integration', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {AjvSchemaValidator} */
  let validator;
  const baseSchemaId = 'schema://living-narrative-engine/common.schema.json';
  const baseSchema = {
    $id: baseSchemaId,
    type: 'object',
    $defs: {
      nonEmptyString: {
        type: 'string',
        minLength: 1,
      },
    },
  };

  beforeEach(async () => {
    logger = new RecordingLogger();
    validator = new AjvSchemaValidator({ logger });
    await validator.addSchema(baseSchema, baseSchemaId);
  });

  it('resolves relative references, validates data, and removes schemas', async () => {
    const derivedSchemaId =
      'schema://living-narrative-engine/entities/character.schema.json';
    const derivedSchema = {
      $id: derivedSchemaId,
      type: 'object',
      properties: {
        name: { $ref: '../common.schema.json#/$defs/nonEmptyString' },
        title: { $ref: '../common.schema.json#/$defs/nonEmptyString' },
      },
      required: ['name'],
      additionalProperties: false,
    };

    await validator.addSchema(derivedSchema, derivedSchemaId);

    const success = validator.validate(derivedSchemaId, {
      name: 'Aria',
      title: 'Scout',
    });
    expect(success.isValid).toBe(true);

    const failure = validator.validate(derivedSchemaId, { name: '' });
    expect(failure.isValid).toBe(false);
    expect(failure.errors?.[0]?.instancePath).toBe('/name');

    const formattedError = validator.formatAjvErrors(failure.errors || [], {
      name: '',
    });
    expect(formattedError).toContain('name');

    expect(
      validator.validateAgainstSchema(
        { name: 'Finn', title: 'Ranger' },
        derivedSchemaId,
        {
          skipPreValidation: true,
          validationDebugMessage: 'Validating derived schema',
          failureMessage: (errors) =>
            `Validation failed with ${errors.length} issues`,
        }
      )
    ).toBe(true);

    expect(validator.validateSchemaRefs(derivedSchemaId)).toBe(true);
    expect(validator.isSchemaLoaded(derivedSchemaId)).toBe(true);

    const loadedIds = validator.getLoadedSchemaIds();
    expect(loadedIds).toEqual(
      expect.arrayContaining([baseSchemaId, derivedSchemaId])
    );

    expect(validator.removeSchema(derivedSchemaId)).toBe(true);
    expect(validator.isSchemaLoaded(derivedSchemaId)).toBe(false);
    expect(validator.removeSchema(derivedSchemaId)).toBe(false);
  });

  it('handles lifecycle guards and schema-not-found scenarios gracefully', async () => {
    await expect(validator.addSchema(baseSchema, baseSchemaId)).rejects.toThrow(
      "AjvSchemaValidator: Schema with ID 'schema://living-narrative-engine/common.schema.json' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended."
    );

    const missingResult = validator.validate(
      'schema://living-narrative-engine/missing.schema.json',
      { foo: 'bar' }
    );
    expect(missingResult.isValid).toBe(false);
    expect(missingResult.errors?.[0]?.keyword).toBe('schemaNotFound');

    expect(
      validator.getValidator(
        'schema://living-narrative-engine/missing.schema.json'
      )
    ).toBeUndefined();

    expect(validator.validateSchemaRefs('schema://not-found.schema.json')).toBe(
      false
    );
    expect(validator.isSchemaLoaded('schema://not-found.schema.json')).toBe(
      false
    );
    expect(
      validator.validateAgainstSchema(
        { foo: 'bar' },
        'schema://not-found.schema.json',
        {
          skipPreValidation: true,
          skipIfSchemaNotLoaded: true,
          notLoadedMessage: 'Schema unavailable',
          notLoadedLogLevel: 'warn',
        }
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some(
        ({ message }) => message === 'Schema unavailable'
      )
    ).toBe(true);
  });

  it('supports preloading and batch schema additions without duplicates', async () => {
    const preloadedLogger = new RecordingLogger();
    const preloadSchema = {
      $id: 'schema://living-narrative-engine/items/base.schema.json',
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    };

    const preloadedValidator = new AjvSchemaValidator({
      logger: preloadedLogger,
      preloadSchemas: [{ schema: preloadSchema, id: preloadSchema.$id }],
    });

    expect(preloadedValidator.isSchemaLoaded(preloadSchema.$id)).toBe(true);

    const weaponSchema = {
      $id: 'schema://living-narrative-engine/items/weapon.schema.json',
      type: 'object',
      properties: {
        id: { $ref: 'base.schema.json#/properties/id' },
        damage: { type: 'integer', minimum: 1 },
      },
      required: ['id', 'damage'],
      additionalProperties: false,
    };

    const potionSchema = {
      $id: 'schema://living-narrative-engine/items/potion.schema.json',
      type: 'object',
      properties: {
        id: { $ref: 'base.schema.json#/properties/id' },
        potency: { type: 'integer', minimum: 0 },
      },
      required: ['id', 'potency'],
      additionalProperties: false,
    };

    await preloadedValidator.addSchemas([weaponSchema, potionSchema]);
    expect(preloadedValidator.isSchemaLoaded(weaponSchema.$id)).toBe(true);
    expect(preloadedValidator.isSchemaLoaded(potionSchema.$id)).toBe(true);

    await preloadedValidator.addSchemas([weaponSchema, potionSchema]);
    const duplicateSkipMessage = preloadedLogger.debugMessages.filter(
      ({ message }) => message.includes('already exists, skipping duplicate')
    );
    expect(duplicateSkipMessage.length).toBeGreaterThan(0);

    expect(preloadedValidator.validateSchemaRefs(weaponSchema.$id)).toBe(true);

    const validWeapon = preloadedValidator.validate(weaponSchema.$id, {
      id: 'iron-sword',
      damage: 4,
    });
    expect(validWeapon.isValid).toBe(true);

    const invalidPotion = preloadedValidator.validate(potionSchema.$id, {
      id: 'healing-tonic',
      potency: -1,
    });
    expect(invalidPotion.isValid).toBe(false);
    expect(
      preloadedValidator.formatAjvErrors(invalidPotion.errors || [], null)
    ).toContain('potency');
  });
});
