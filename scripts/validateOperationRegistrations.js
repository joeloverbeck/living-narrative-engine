#!/usr/bin/env node

/**
 * @file Validates that all operations are properly registered across the codebase
 * @description Checks schema files, schema references, and whitelist consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read KNOWN_OPERATION_TYPES from preValidationUtils.js
const preValidationUtilsPath = path.join(projectRoot, 'src/utils/preValidationUtils.js');
const preValidationContent = fs.readFileSync(preValidationUtilsPath, 'utf8');
const knownOpsMatch = preValidationContent.match(/const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/);
const knownOperations = knownOpsMatch[1]
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith("'"))
  .map(line => line.replace(/^'|',?$/g, ''));

console.log(`Found ${knownOperations.length} operations in KNOWN_OPERATION_TYPES\n`);

// Check each operation
let hasErrors = false;

for (const operationType of knownOperations) {
  const schemaFileName = operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('') + '.schema.json';

  const schemaPath = path.join(projectRoot, 'data/schemas/operations', schemaFileName);

  // Check 1: Schema file exists
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ ${operationType}: Schema file missing`);
    console.error(`   Expected: data/schemas/operations/${schemaFileName}\n`);
    hasErrors = true;
    continue;
  }

  // Check 2: Schema referenced in operation.schema.json
  const operationSchemaPath = path.join(projectRoot, 'data/schemas/operation.schema.json');
  const operationSchemaContent = fs.readFileSync(operationSchemaPath, 'utf8');

  if (!operationSchemaContent.includes(`./operations/${schemaFileName}`)) {
    console.error(`❌ ${operationType}: Not referenced in operation.schema.json`);
    console.error(`   Add: { "$ref": "./operations/${schemaFileName}" } to anyOf array\n`);
    hasErrors = true;
  } else {
    console.log(`✅ ${operationType}: All registrations valid`);
  }
}

if (hasErrors) {
  console.error('\n❌ Operation registration validation FAILED');
  process.exit(1);
} else {
  console.log('\n✅ All operations properly registered');
  process.exit(0);
}
