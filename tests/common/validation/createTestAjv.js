import Ajv from 'ajv';
import loadOperationSchemas from '../../unit/helpers/loadOperationSchemas.js';
import loadConditionSchemas from '../../unit/helpers/loadConditionSchemas.js';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import ruleSchema from '../../../data/schemas/rule.schema.json';

/**
 * Creates a pre-configured AJV instance with all common schemas loaded.
 * This reduces duplication across test files that need schema validation.
 *
 * @returns {Ajv} Configured AJV instance with all schemas loaded
 */
export default function createTestAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });

  // Add core schemas
  ajv.addSchema(
    commonSchema,
    'schema://living-narrative-engine/common.schema.json'
  );
  ajv.addSchema(
    operationSchema,
    'schema://living-narrative-engine/operation.schema.json'
  );
  ajv.addSchema(
    jsonLogicSchema,
    'schema://living-narrative-engine/json-logic.schema.json'
  );
  ajv.addSchema(
    ruleSchema,
    'schema://living-narrative-engine/rule.schema.json'
  );

  // Load operation and condition schemas using existing helpers
  // Note: loadOperationSchemas already adds damage-capability-entry.schema.json
  // Note: loadConditionSchemas already adds condition.schema.json and condition-container.schema.json
  loadOperationSchemas(ajv);
  loadConditionSchemas(ajv);

  return ajv;
}
