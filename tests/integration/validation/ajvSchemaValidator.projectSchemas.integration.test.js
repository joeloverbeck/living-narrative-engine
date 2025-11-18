import { beforeEach, describe, expect, it } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 *
 */
function createRecordingLogger() {
  const logs = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const record = (level, message, ...rest) => {
    const parts = [message, ...rest].map((item) => {
      if (item instanceof Error) {
        return item.message;
      }
      if (typeof item === 'string') {
        return item;
      }
      try {
        return JSON.stringify(item);
      } catch (error) {
        return String(item);
      }
    });
    logs[level].push(parts.join(' '));
  };

  return {
    logs,
    debug: (...args) => record('debug', ...args),
    info: (...args) => record('info', ...args),
    warn: (...args) => record('warn', ...args),
    error: (...args) => record('error', ...args),
  };
}

/**
 *
 * @param relativePath
 */
async function loadSchema(relativePath) {
  const filePath = path.join('data', 'schemas', relativePath);
  const fileContents = await readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

describe('AjvSchemaValidator with project schemas', () => {
  /** @type {ReturnType<typeof createRecordingLogger>} */
  let logger;

  beforeEach(() => {
    logger = createRecordingLogger();
  });

  it('reports missing schema dependencies for operations schema', async () => {
    const dispatchSchema = await loadSchema('operations/dispatchSpeech.schema.json');
    const validator = new AjvSchemaValidator({ logger });

    await validator.addSchema(dispatchSchema, dispatchSchema.$id);

    expect(validator.isSchemaLoaded(dispatchSchema.$id)).toBe(false);

    const missingValidator = validator.getValidator(dispatchSchema.$id);
    expect(missingValidator).toBeUndefined();

    const missingResult = validator.validate(dispatchSchema.$id, {
      type: 'DISPATCH_SPEECH',
      parameters: {
        entity_id: 'npc:alpha',
        speech_content: 'hello',
      },
    });
    expect(missingResult.isValid).toBe(false);
    expect(missingResult.errors?.[0]?.keyword).toBe('schemaNotFound');

    expect(validator.validateSchemaRefs(dispatchSchema.$id)).toBe(false);

    const warnOutput = logger.logs.warn.join('\n');
    expect(warnOutput).toContain("can't resolve reference ../base-operation.schema.json");
    expect(warnOutput).toContain('validate called for schemaId');

    const errorOutput = logger.logs.error.join('\n');
    expect(errorOutput).toContain('has unresolved $refs or other issues');

    const againstSchema = validator.validateAgainstSchema(
      {
        type: 'DISPATCH_SPEECH',
        parameters: {
          entity_id: 'npc:alpha',
          speech_content: 'hello',
        },
      },
      dispatchSchema.$id,
      { skipPreValidation: true }
    );
    expect(againstSchema).toBe(false);
  });

  it('validates dispatch speech operations once dependencies are loaded', async () => {
    const jsonLogicSchema = await loadSchema('json-logic.schema.json');
    const conditionSchema = await loadSchema('condition-container.schema.json');
    const commonSchema = await loadSchema('common.schema.json');
    const baseOperationSchema = await loadSchema('base-operation.schema.json');
    const dispatchSchema = await loadSchema('operations/dispatchSpeech.schema.json');
    const validator = new AjvSchemaValidator({ logger });

    await validator.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
    await validator.addSchema(conditionSchema, conditionSchema.$id);
    await validator.addSchema(commonSchema, commonSchema.$id);
    await validator.addSchema(baseOperationSchema, baseOperationSchema.$id);
    await validator.addSchema(dispatchSchema, dispatchSchema.$id);

    expect(validator.validateSchemaRefs(baseOperationSchema.$id)).toBe(true);
    expect(validator.validateSchemaRefs(dispatchSchema.$id)).toBe(true);

    const validData = {
      type: 'DISPATCH_SPEECH',
      parameters: {
        entity_id: 'npc:alpha',
        speech_content: 'Hello there!',
        thoughts: 'Is anyone listening?',
        allow_html: true,
      },
    };

    const validResult = validator.validate(dispatchSchema.$id, validData);
    expect(validResult).toEqual({ isValid: true, errors: null });

    expect(
      validator.validateAgainstSchema(validData, dispatchSchema.$id, {
        skipPreValidation: true,
        validationDebugMessage: 'Validating dispatch speech operation',
      })
    ).toBe(true);

    const invalidData = {
      type: 'DISPATCH_SPEECH',
      parameters: {
        entity_id: '',
      },
    };

    const invalidResult = validator.validate(dispatchSchema.$id, invalidData);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors?.length).toBeGreaterThan(0);

    const formatted = validator.formatAjvErrors(
      invalidResult.errors || [],
      invalidData
    );
    expect(formatted).toContain('speech_content');

    const againstInvalid = validator.validateAgainstSchema(
      invalidData,
      dispatchSchema.$id,
      { skipPreValidation: true }
    );
    expect(againstInvalid).toBe(false);

    expect(
      logger.logs.error.some((entry) =>
        entry.includes('validateAgainstSchema failed for schema')
      )
    ).toBe(true);

    const loadedIds = validator.getLoadedSchemaIds();
    expect(loadedIds).toEqual(
      expect.arrayContaining([
        jsonLogicSchema.$id,
        conditionSchema.$id,
        commonSchema.$id,
        baseOperationSchema.$id,
        dispatchSchema.$id,
      ])
    );

    expect(validator.removeSchema(dispatchSchema.$id)).toBe(true);
    expect(validator.isSchemaLoaded(dispatchSchema.$id)).toBe(false);
    expect(validator.validate(dispatchSchema.$id, validData).isValid).toBe(
      false
    );
  });
});
