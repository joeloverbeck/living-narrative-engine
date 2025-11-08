#!/usr/bin/env node

/**
 * @file Operation Registration Completeness Validator
 * @description Checks that all operation handlers are properly registered across all required files
 *
 * Usage: npm run validate:operations
 *
 * Performs 8 comprehensive validation checks:
 * 1. Schema files check
 * 2. Schema references check
 * 3. Pre-validation whitelist check
 * 4. DI token definitions check
 * 5. Handler factory registrations check
 * 6. Operation registry mappings check
 * 7. Handler file existence check
 * 8. Naming consistency check
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];

console.log('🔍 Validating operation registration completeness...\n');

// Step 1: Collect all operation schemas
console.log('📋 Step 1: Scanning operation schemas...');
const operationsFromSchemas = scanOperationSchemas();
console.log(`  Found ${operationsFromSchemas.length} operation schemas\n`);

// Step 2: Check operation.schema.json references
console.log('📋 Step 2: Checking operation.schema.json references...');
checkSchemaReferences(operationsFromSchemas);

// Step 3: Check KNOWN_OPERATION_TYPES
console.log('\n📋 Step 3: Checking pre-validation whitelist...');
checkPreValidationWhitelist(operationsFromSchemas);

// Step 4: Check DI tokens
console.log('\n📋 Step 4: Checking DI tokens...');
checkDITokens(operationsFromSchemas);

// Step 5: Check handler registrations
console.log('\n📋 Step 5: Checking handler factory registrations...');
checkHandlerRegistrations(operationsFromSchemas);

// Step 6: Check operation registry mappings
console.log('\n📋 Step 6: Checking operation registry mappings...');
checkOperationMappings(operationsFromSchemas);

// Step 7: Check handler files exist
console.log('\n📋 Step 7: Checking handler file existence...');
checkHandlerFiles(operationsFromSchemas);

// Step 8: Check naming consistency
console.log('\n📋 Step 8: Checking naming consistency...');
checkNamingConsistency(operationsFromSchemas);

// Report results
console.log('\n' + '='.repeat(70));
console.log('📊 Validation Results\n');

if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  warnings.forEach(w => console.log(`  ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.log('❌ Errors found (' + errors.length + ' total):\n');
  errors.forEach((e, idx) => {
    console.log(`  ${idx + 1}. ${e}\n`);
  });
  console.log(`Found ${errors.length} error(s) that must be fixed.\n`);
  console.log('📚 See CLAUDE.md section "Adding New Operations" for guidance.');
  console.log('='.repeat(70));
  process.exit(1);
} else {
  console.log('✅ All operation handlers are properly registered!\n');
  console.log(`✓ ${operationsFromSchemas.length} operations validated`);
  console.log('✓ All schemas referenced');
  console.log('✓ All types in whitelist');
  console.log('✓ All tokens defined');
  console.log('✓ All handlers registered');
  console.log('✓ All operations mapped');
  console.log('✓ All handler files exist');
  console.log('✓ All naming conventions followed');
  console.log('='.repeat(70));
  process.exit(0);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Scan operation schema files and extract operation types
 */
function scanOperationSchemas() {
  const schemaPattern = path.join(projectRoot, 'data/schemas/operations/*.schema.json');
  const schemaFiles = glob.sync(schemaPattern)
    .filter(f =>
      !f.endsWith('base-operation.schema.json') &&
      !f.endsWith('nested-operation.schema.json')
    );

  const operations = [];

  for (const schemaFile of schemaFiles) {
    try {
      const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
      // Extract operation type from allOf[1].properties.type.const
      const operationType = schema.allOf?.[1]?.properties?.type?.const;

      if (operationType) {
        operations.push({
          type: operationType,
          schemaFile: path.basename(schemaFile),
          schemaPath: schemaFile,
        });
      } else {
        warnings.push(`⚠️  Schema ${path.basename(schemaFile)} does not define operation type constant`);
      }
    } catch (error) {
      errors.push(`❌ Failed to parse schema ${path.basename(schemaFile)}: ${error.message}`);
    }
  }

  return operations;
}

/**
 * Check that all schemas are referenced in operation.schema.json
 */
function checkSchemaReferences(operations) {
  try {
    const operationSchemaPath = path.join(projectRoot, 'data/schemas/operation.schema.json');
    const operationSchema = JSON.parse(fs.readFileSync(operationSchemaPath, 'utf8'));

    // Schema uses anyOf within $defs.Operation
    const referencedSchemas = operationSchema.$defs?.Operation?.anyOf?.map(ref =>
      path.basename(ref.$ref)
    ) || [];

    console.log(`  ${referencedSchemas.length} schemas referenced`);

    let missingRefs = 0;
    for (const op of operations) {
      if (!referencedSchemas.includes(op.schemaFile)) {
        errors.push(
          `❌ Schema ${op.schemaFile} not referenced in operation.schema.json\n` +
          `   Fix: Add { "$ref": "./operations/${op.schemaFile}" } to anyOf array in $defs.Operation\n` +
          `   File: data/schemas/operation.schema.json`
        );
        missingRefs++;
      }
    }

    if (missingRefs === 0) {
      console.log('  ✓ All schemas properly referenced');
    } else {
      console.log(`  ⚠️  ${missingRefs} schema(s) not referenced`);
    }
  } catch (error) {
    errors.push(`❌ Failed to check schema references: ${error.message}`);
  }
}

/**
 * Check that all operation types are in KNOWN_OPERATION_TYPES whitelist
 */
function checkPreValidationWhitelist(operations) {
  try {
    const preValidationPath = path.join(projectRoot, 'src/utils/preValidationUtils.js');
    const preValidationContent = fs.readFileSync(preValidationPath, 'utf8');

    const whitelistMatch = preValidationContent.match(/const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/);
    const knownTypes = [];

    if (whitelistMatch) {
      const whitelistBody = whitelistMatch[1];
      const matches = whitelistBody.matchAll(/'([^']+)'/g);
      for (const match of matches) {
        knownTypes.push(match[1]);
      }
    }

    console.log(`  ${knownTypes.length} operation types in whitelist`);

    let missingTypes = 0;
    for (const op of operations) {
      if (!knownTypes.includes(op.type)) {
        errors.push(
          `❌ Operation type ${op.type} not in KNOWN_OPERATION_TYPES (preValidationUtils.js)\n` +
          `   Fix: Add '${op.type}' to KNOWN_OPERATION_TYPES array\n` +
          `   File: src/utils/preValidationUtils.js`
        );
        missingTypes++;
      }
    }

    if (missingTypes === 0) {
      console.log('  ✓ All operation types in whitelist');
    } else {
      console.log(`  ⚠️  ${missingTypes} operation type(s) missing from whitelist`);
    }
  } catch (error) {
    errors.push(`❌ Failed to check pre-validation whitelist: ${error.message}`);
  }
}

/**
 * Check that all operations have DI tokens defined
 */
function checkDITokens(operations) {
  try {
    const tokensPath = path.join(projectRoot, 'src/dependencyInjection/tokens/tokens-core.js');
    const tokensContent = fs.readFileSync(tokensPath, 'utf8');

    // Extract tokens from coreTokens object
    // Look for pattern: TokenName: 'TokenName'
    const tokenMatches = tokensContent.matchAll(/(\w+Handler):\s*['"](\w+Handler)['"]/g);
    const definedTokens = new Set();

    for (const match of tokenMatches) {
      definedTokens.add(match[1]);
    }

    console.log(`  ${definedTokens.size} handler tokens defined`);

    let missingTokens = 0;
    for (const op of operations) {
      const expectedToken = toTokenName(op.type);

      if (!definedTokens.has(expectedToken)) {
        errors.push(
          `❌ Token ${expectedToken} not defined for operation ${op.type}\n` +
          `   Fix: Add ${expectedToken}: '${expectedToken}' to coreTokens object (NO "I" prefix)\n` +
          `   File: src/dependencyInjection/tokens/tokens-core.js`
        );
        missingTokens++;
      }
    }

    if (missingTokens === 0) {
      console.log('  ✓ All handler tokens defined');
    } else {
      console.log(`  ⚠️  ${missingTokens} handler token(s) missing`);
    }
  } catch (error) {
    errors.push(`❌ Failed to check DI tokens: ${error.message}`);
  }
}

/**
 * Check that all handlers are registered in handlerFactories array
 */
function checkHandlerRegistrations(operations) {
  try {
    const registrationsPath = path.join(
      projectRoot,
      'src/dependencyInjection/registrations/operationHandlerRegistrations.js'
    );
    const registrationsContent = fs.readFileSync(registrationsPath, 'utf8');

    // Extract registered tokens from handlerFactories array
    // Look for pattern: tokens.SomeHandler (within handlerFactories array)
    const registeredTokens = new Set();

    // Match tokens.HandlerName pattern (may be on separate line from bracket)
    const tokenMatches = registrationsContent.matchAll(/tokens\.(\w+Handler)/g);

    for (const match of tokenMatches) {
      registeredTokens.add(match[1]);
    }

    console.log(`  ${registeredTokens.size} handlers registered`);

    let missingRegistrations = 0;
    for (const op of operations) {
      const expectedToken = toTokenName(op.type);

      if (!registeredTokens.has(expectedToken)) {
        errors.push(
          `❌ Handler ${expectedToken} not registered in operationHandlerRegistrations.js\n` +
          `   Fix: Add entry to handlerFactories array:\n` +
          `   [tokens.${expectedToken}, ${expectedToken}, (c, Handler) => new Handler({ ... })]\n` +
          `   File: src/dependencyInjection/registrations/operationHandlerRegistrations.js`
        );
        missingRegistrations++;
      }
    }

    if (missingRegistrations === 0) {
      console.log('  ✓ All handlers registered');
    } else {
      console.log(`  ⚠️  ${missingRegistrations} handler(s) not registered`);
    }
  } catch (error) {
    errors.push(`❌ Failed to check handler registrations: ${error.message}`);
  }
}

/**
 * Check that all operations are mapped to tokens in interpreterRegistrations.js
 */
function checkOperationMappings(operations) {
  try {
    const interpreterPath = path.join(
      projectRoot,
      'src/dependencyInjection/registrations/interpreterRegistrations.js'
    );
    const interpreterContent = fs.readFileSync(interpreterPath, 'utf8');

    // Extract operation type -> token mappings
    // Look for pattern: registry.register('OPERATION_TYPE', bind(tokens.HandlerToken))
    // Pattern must handle both single-line and multi-line formats
    const mappedOperations = new Map();
    const mappingMatches = interpreterContent.matchAll(
      /registry\.register\(\s*['"]([A-Z_]+)['"]\s*,\s*bind\(tokens\.(\w+Handler)\)/gs
    );

    for (const match of mappingMatches) {
      mappedOperations.set(match[1], match[2]);
    }

    console.log(`  ${mappedOperations.size} operations mapped`);

    let missingMappings = 0;
    for (const op of operations) {
      const expectedToken = toTokenName(op.type);

      if (!mappedOperations.has(op.type)) {
        errors.push(
          `❌ Operation ${op.type} not mapped in interpreterRegistrations.js\n` +
          `   Fix: Add registry.register('${op.type}', bind(tokens.${expectedToken}))\n` +
          `   File: src/dependencyInjection/registrations/interpreterRegistrations.js`
        );
        missingMappings++;
      } else if (mappedOperations.get(op.type) !== expectedToken) {
        errors.push(
          `❌ Operation ${op.type} mapped to wrong token: ${mappedOperations.get(op.type)}\n` +
          `   Expected: ${expectedToken}\n` +
          `   File: src/dependencyInjection/registrations/interpreterRegistrations.js`
        );
        missingMappings++;
      }
    }

    if (missingMappings === 0) {
      console.log('  ✓ All operations mapped correctly');
    } else {
      console.log(`  ⚠️  ${missingMappings} operation(s) not mapped correctly`);
    }
  } catch (error) {
    errors.push(`❌ Failed to check operation mappings: ${error.message}`);
  }
}

/**
 * Check that all handler files exist
 */
function checkHandlerFiles(operations) {
  let missingFiles = 0;

  for (const op of operations) {
    const expectedFileName = toHandlerFileName(op.type);
    const handlerPath = path.join(projectRoot, 'src/logic/operationHandlers', expectedFileName);

    if (!fs.existsSync(handlerPath)) {
      errors.push(
        `❌ Handler file ${expectedFileName} not found for operation ${op.type}\n` +
        `   Expected: src/logic/operationHandlers/${expectedFileName}\n` +
        `   Action: Create handler file or check file name`
      );
      missingFiles++;
    }
  }

  const existingFiles = operations.length - missingFiles;
  console.log(`  ${existingFiles} handler file(s) exist`);

  if (missingFiles === 0) {
    console.log('  ✓ All handler files exist');
  } else {
    console.log(`  ⚠️  ${missingFiles} handler file(s) missing`);
  }
}

/**
 * Check naming consistency across all files
 */
function checkNamingConsistency(operations) {
  let inconsistencies = 0;

  for (const op of operations) {
    const expectedToken = toTokenName(op.type);
    const expectedSchemaFile = toSchemaFileName(op.type);

    // Check schema file naming
    if (op.schemaFile !== expectedSchemaFile) {
      errors.push(
        `❌ Schema file naming inconsistent for ${op.type}\n` +
        `   Expected: ${expectedSchemaFile}\n` +
        `   Actual: ${op.schemaFile}`
      );
      inconsistencies++;
    }

    // Check for "I" prefix in token name (operation handlers should NOT have it)
    // Pattern: I + uppercase letter (e.g., IEntityManager, ILogger)
    // Should NOT flag: IfHandler, IfCoLocatedHandler (legitimate operation names)
    if (/^I[A-Z]/.test(expectedToken)) {
      errors.push(
        `❌ Token ${expectedToken} should NOT have "I" prefix\n` +
        `   Operation handler tokens do not use "I" prefix (unlike service interfaces)\n` +
        `   Expected format: [OperationName]Handler (e.g., DrinkFromHandler)\n` +
        `   Current: ${expectedToken} → Suggested: ${expectedToken.substring(1)}`
      );
      inconsistencies++;
    }
  }

  if (inconsistencies === 0) {
    console.log('  ✓ All naming conventions followed');
  } else {
    console.log(`  ⚠️  ${inconsistencies} naming inconsistenc(ies) found`);
  }
}

// ============================================================================
// Naming Convention Helpers
// ============================================================================

/**
 * Convert operation type to token name
 * IMPORTANT: Operation handler tokens do NOT use "I" prefix (unlike service interfaces)
 * @example 'DRINK_FROM' -> 'DrinkFromHandler'
 */
function toTokenName(operationType) {
  return operationType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join('') + 'Handler';
}

/**
 * Convert operation type to handler file name
 * @example 'DRINK_FROM' -> 'drinkFromHandler.js'
 */
function toHandlerFileName(operationType) {
  const parts = operationType.split('_');
  return parts
    .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase())
    .join('') + 'Handler.js';
}

/**
 * Convert operation type to schema file name
 * @example 'DRINK_FROM' -> 'drinkFrom.schema.json'
 */
function toSchemaFileName(operationType) {
  const parts = operationType.split('_');
  return parts
    .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase())
    .join('') + '.schema.json';
}
