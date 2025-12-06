#!/usr/bin/env node

/**
 * @file scripts/lintSchemaPatterns.js
 * Detects operation schemas using local oneOf patterns for template strings
 * instead of $ref to common.schema.json. This enforces INV-2 (Template Pattern Consistency).
 * @see tickets/SCHVALTESINT-009-schema-pattern-lint-script.md
 * @see data/schemas/common.schema.json - Expected $ref target
 */

const defaultFs = require('fs/promises');
const defaultPath = require('path');

/**
 * Regex pattern to detect template string patterns in JSON schemas.
 * Matches patterns like: ^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$
 */
const TEMPLATE_PATTERN_REGEX = /\^\\\\\{.*\}\$/;

/**
 * Get all schema files from the operations directory.
 *
 * @param {string} operationsDir - Path to operations schema directory
 * @param {object} fs - fs/promises module (injectable for testing)
 * @returns {Promise<string[]>} Array of .schema.json file names
 */
async function getSchemaFiles(operationsDir, fs = defaultFs) {
  try {
    const files = await fs.readdir(operationsDir);
    return files.filter((f) => f.endsWith('.schema.json'));
  } catch (error) {
    console.error(`Error reading operations directory: ${error.message}`);
    return [];
  }
}

/**
 * Find local oneOf patterns that contain template string regex patterns.
 * These should be replaced with $ref to common.schema.json definitions.
 *
 * @param {object} obj - JSON object to search
 * @param {string[]} path - Current path in the object tree
 * @returns {string[]} Array of paths where local oneOf patterns were found
 */
function findLocalOneOfPatterns(obj, path = []) {
  const found = [];

  if (obj && typeof obj === 'object') {
    // Check if this is a oneOf array
    if (obj.oneOf && Array.isArray(obj.oneOf)) {
      // Check if oneOf contains a template string pattern
      const hasTemplatePattern = obj.oneOf.some(
        (branch) =>
          branch.type === 'string' &&
          branch.pattern &&
          TEMPLATE_PATTERN_REGEX.test(branch.pattern)
      );

      if (hasTemplatePattern) {
        found.push(path.join('.') || '(root)');
      }
    }

    // Recurse into nested objects (skip $ref which is correct usage)
    for (const [key, value] of Object.entries(obj)) {
      if (key !== '$ref' && typeof value === 'object' && value !== null) {
        found.push(...findLocalOneOfPatterns(value, [...path, key]));
      }
    }
  }

  return found;
}

/**
 * Lint a single schema file for local oneOf template patterns.
 *
 * @param {string} filePath - Full path to schema file
 * @param {object} fs - fs/promises module (injectable for testing)
 * @returns {Promise<{file: string, paths: string[], suggestion: string} | null>}
 *          Violation object or null if valid
 */
async function lintSchemaFile(filePath, fs = defaultFs) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const schema = JSON.parse(content);
    const localOneOfs = findLocalOneOfPatterns(schema);

    if (localOneOfs.length > 0) {
      return {
        file: filePath,
        paths: localOneOfs,
        suggestion:
          'Replace with $ref to common.schema.json#/definitions/* (e.g., integerOrTemplate, stringOrTemplate)',
      };
    }

    return null;
  } catch (error) {
    // JSON parse errors or file read errors
    return {
      file: filePath,
      paths: ['(parse error)'],
      suggestion: `Error: ${error.message}`,
    };
  }
}

/**
 * Main linting function. Scans all operation schemas for violations.
 *
 * @param {string} [operationsDirArg] - Optional path to operations directory
 * @param {object} [fs] - fs/promises module (injectable for testing)
 * @param {object} [path] - path module (injectable for testing)
 * @returns {Promise<{file: string, paths: string[], suggestion: string}[]>} Array of violations
 */
async function lintSchemas(
  operationsDirArg,
  fs = defaultFs,
  path = defaultPath
) {
  const operationsDir =
    operationsDirArg ||
    path.join(__dirname, '..', 'data', 'schemas', 'operations');

  const schemaFiles = await getSchemaFiles(operationsDir, fs);
  const violations = [];

  for (const file of schemaFiles) {
    const filePath = path.join(operationsDir, file);
    const violation = await lintSchemaFile(filePath, fs);
    if (violation) {
      violations.push(violation);
    }
  }

  return violations;
}

/**
 * CLI entry point. Runs the linter and outputs results.
 *
 * @param {string} [operationsDirArg] - Optional path to operations directory
 * @param {object} [fs] - fs/promises module (injectable for testing)
 * @param {object} [path] - path module (injectable for testing)
 */
async function main(operationsDirArg, fs = defaultFs, path = defaultPath) {
  try {
    const violations = await lintSchemas(operationsDirArg, fs, path);

    if (violations.length === 0) {
      console.log('✅ All operation schemas use $ref patterns correctly');
      process.exit(0);
    } else {
      console.error('❌ Found schemas with local oneOf patterns:\n');
      for (const v of violations) {
        console.error(`  ${v.file}:`);
        for (const p of v.paths) {
          console.error(`    - ${p}`);
        }
        console.error(`    Suggestion: ${v.suggestion}\n`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  TEMPLATE_PATTERN_REGEX,
  getSchemaFiles,
  findLocalOneOfPatterns,
  lintSchemaFile,
  lintSchemas,
  main,
};

if (require.main === module) {
  main();
}
