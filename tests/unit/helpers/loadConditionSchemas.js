import containerSchema from '../../../data/schemas/condition-container.schema.json' assert { type: 'json' };
import conditionSchema from '../../../data/schemas/condition.schema.json' assert { type: 'json' };

/**
 * Registers condition-related schemas with AJV for testing.
 *
 * @param {import('ajv').default} ajv - AJV instance
 * @returns {void}
 */
export default function loadConditionSchemas(ajv) {
  ajv.addSchema(
    containerSchema,
    'http://example.com/schemas/condition-container.schema.json'
  );
  ajv.addSchema(
    conditionSchema,
    'http://example.com/schemas/condition.schema.json'
  );
}
