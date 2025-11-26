/**
 * @file src/utils/parameterRuleGenerator.js
 * @description Generates parameter validation rules from operation schemas.
 * This module parses JSON Schema files in data/schemas/operations/ and extracts
 * metadata about required/optional parameters and template-capable fields.
 *
 * The generated rules are intended to be used by preValidationUtils.js for
 * comprehensive parameter validation across all 62 operations.
 * @see specs/schema-validation-test-integration.md - Section 4.1 for target structure
 * @see tickets/SCHVALTESINT-010-parameter-rule-generator.md
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Default path to the operations schemas directory
 *
 * @type {string}
 */
const DEFAULT_OPERATIONS_DIR = 'data/schemas/operations';

/**
 * Template definition names from common.schema.json that indicate template-capable fields
 *
 * @type {Set<string>}
 */
const TEMPLATE_DEFINITIONS = new Set([
  'templateString',
  'integerOrTemplate',
  'positiveIntegerOrTemplate',
  'stringOrTemplate',
  'booleanOrTemplate',
  'entityIdOrTemplate',
]);

/**
 * @typedef {object} ParameterRule
 * @property {string[]} required - Required parameter names
 * @property {string[]} optional - Optional parameter names
 * @property {string[]} templateFields - Fields that accept template strings
 * @property {string} schemaId - Source schema $id
 */

/**
 * @typedef {object} CoverageResult
 * @property {string[]} missing - Operation types with no generated rules
 * @property {string[]} extra - Generated rules not in known types
 */

/**
 * Generates parameter rules for all operation schemas in the specified directory.
 *
 * @param {string} [operationsDir] - Path to operations schema directory
 * @returns {Promise<{[key: string]: ParameterRule}>} Map of operation type to parameter rules
 * @throws {Error} If directory cannot be read or schemas are malformed
 */
export async function generateParameterRules(operationsDir = DEFAULT_OPERATIONS_DIR) {
  const files = await readdir(operationsDir);
  const schemaFiles = files.filter((f) => f.endsWith('.schema.json'));

  const rules = {};

  for (const file of schemaFiles) {
    const content = await readFile(join(operationsDir, file), 'utf8');
    const schema = JSON.parse(content);

    const rule = extractRuleFromSchema(schema);
    if (rule) {
      rules[rule.operationType] = {
        required: rule.required,
        optional: rule.optional,
        templateFields: rule.templateFields,
        schemaId: schema.$id,
      };
    }
  }

  return rules;
}

/**
 * Extracts parameter rule from a single operation schema.
 *
 * Navigation pattern:
 * - Operation type: allOf[1].properties.type.const
 * - Parameters: $defs.Parameters (resolved from allOf[1].properties.parameters.$ref)
 * - Required: $defs.Parameters.required[]
 * - All properties: $defs.Parameters.properties
 *
 * @param {object} schema - Parsed JSON schema object
 * @returns {object | null} Extracted rule with operationType, required, optional, templateFields
 *                        Returns null if schema is not a valid operation schema
 */
export function extractRuleFromSchema(schema) {
  // All operation schemas use allOf pattern
  const allOf = schema.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2) {
    return null;
  }

  let operationType = null;

  // Find operation type from allOf entries
  for (const part of allOf) {
    if (part.properties?.type?.const) {
      operationType = part.properties.type.const;
      break;
    }
  }

  if (!operationType) {
    return null;
  }

  // Get Parameters definition from $defs
  const parametersDef = schema.$defs?.Parameters;
  if (!parametersDef) {
    // Some operations might not have parameters (e.g., END_TURN)
    return {
      operationType,
      required: [],
      optional: [],
      templateFields: [],
    };
  }

  // Extract required and optional fields
  const required = Array.isArray(parametersDef.required) ? [...parametersDef.required] : [];
  const allProperties = Object.keys(parametersDef.properties || {});
  const optional = allProperties.filter((p) => !required.includes(p));

  // Detect template-capable fields
  const templateFields = detectTemplateFields(parametersDef.properties || {});

  return {
    operationType,
    required,
    optional,
    templateFields,
  };
}

/**
 * Detects which fields can accept template strings.
 *
 * A field is template-capable if:
 * 1. It has $ref to common.schema.json#/definitions/ with a template type
 * 2. It has a oneOf with a string branch that references templateString
 * 3. It is type: "string" (conservative default - strings can contain templates)
 *
 * @param {object} properties - Schema properties object from Parameters.$defs
 * @returns {string[]} Field names that accept templates
 */
export function detectTemplateFields(properties) {
  const templateFields = [];

  for (const [name, def] of Object.entries(properties)) {
    if (isTemplateCapable(def)) {
      templateFields.push(name);
    }
  }

  return templateFields;
}

/**
 * Checks if a property definition accepts template strings.
 *
 * @param {object} def - Property definition from schema
 * @returns {boolean} True if field can accept template strings
 */
function isTemplateCapable(def) {
  if (!def || typeof def !== 'object') {
    return false;
  }

  // Check for $ref to common.schema.json template definitions
  if (def.$ref) {
    // Pattern: "../common.schema.json#/definitions/positiveIntegerOrTemplate"
    const refMatch = def.$ref.match(
      /common\.schema\.json#\/definitions\/([a-zA-Z]+)/
    );
    if (refMatch && TEMPLATE_DEFINITIONS.has(refMatch[1])) {
      return true;
    }
  }

  // Check for oneOf with templateString reference
  if (Array.isArray(def.oneOf)) {
    for (const branch of def.oneOf) {
      // Check for $ref to templateString
      if (branch.$ref?.includes('templateString')) {
        return true;
      }
      // Check for string type with template pattern
      if (
        branch.type === 'string' &&
        branch.pattern?.includes('\\{')
      ) {
        return true;
      }
    }
  }

  // Strings are generally template-capable in this system
  // (template resolution happens at runtime for any string field)
  if (def.type === 'string') {
    return true;
  }

  return false;
}

/**
 * Validates that generated rules cover all known operation types.
 *
 * @param {{[key: string]: ParameterRule}} rules - Generated parameter rules
 * @param {string[]} knownTypes - Known operation types from KNOWN_OPERATION_TYPES whitelist
 * @returns {CoverageResult} Object with missing and extra arrays
 */
export function validateCoverage(rules, knownTypes) {
  const generatedTypes = Object.keys(rules);

  const missing = knownTypes.filter((t) => !generatedTypes.includes(t));
  const extra = generatedTypes.filter((t) => !knownTypes.includes(t));

  return { missing, extra };
}

export default {
  generateParameterRules,
  extractRuleFromSchema,
  detectTemplateFields,
  validateCoverage,
};
