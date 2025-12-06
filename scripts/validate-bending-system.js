#!/usr/bin/env node

/**
 * @file Validation script for the bending over system.
 * @description Validates all components, actions, conditions, rules, and scopes
 * for the bending over positioning system against their schemas.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AjvSchemaValidator from '../src/validation/ajvSchemaValidator.js';
import chalk from 'chalk';

// Handle module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple logger for the validator
const simpleLogger = {
  debug: () => {},
  info: () => {},
  warn: (msg) => console.warn(chalk.yellow(msg)),
  error: (msg) => console.error(chalk.red(msg)),
};

// Schema IDs
const COMPONENT_SCHEMA =
  'schema://living-narrative-engine/component.schema.json';
const ACTION_SCHEMA = 'schema://living-narrative-engine/action.schema.json';
const CONDITION_SCHEMA =
  'schema://living-narrative-engine/condition.schema.json';
const RULE_SCHEMA = 'schema://living-narrative-engine/rule.schema.json';

/**
 * Load and parse JSON file
 *
 * @param filePath
 */
async function loadJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

/**
 * Check if file exists
 *
 * @param filePath
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a file against its schema
 *
 * @param validator
 * @param filePath
 * @param schemaId
 * @param category
 */
async function validateFile(validator, filePath, schemaId, category) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  try {
    // Check if file exists
    if (!(await fileExists(filePath))) {
      return {
        file: relativePath,
        category,
        valid: false,
        error: 'File not found',
      };
    }

    // Load file content
    const content = await loadJsonFile(filePath);

    // Validate against schema
    const validationResult = validator.validate(content, schemaId);

    return {
      file: relativePath,
      category,
      valid: validationResult.valid,
      error: validationResult.valid ? null : validationResult.errors.join(', '),
    };
  } catch (error) {
    return {
      file: relativePath,
      category,
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Validate scope file (DSL syntax check)
 *
 * @param filePath
 */
async function validateScopeFile(filePath) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  try {
    // Check if file exists
    if (!(await fileExists(filePath))) {
      return {
        file: relativePath,
        category: 'scopes',
        valid: false,
        error: 'File not found',
      };
    }

    // Read scope content
    const content = await fs.readFile(filePath, 'utf-8');

    // Basic validation: check for common scope DSL patterns
    const validPatterns = [
      'actor',
      'target',
      'position',
      'positioning:',
      '[]',
      '{}',
      'var',
      '==',
      'locationId',
    ];

    const hasValidPattern = validPatterns.some((pattern) =>
      content.includes(pattern)
    );

    if (!hasValidPattern && content.trim().length > 0) {
      return {
        file: relativePath,
        category: 'scopes',
        valid: false,
        error: 'No valid scope DSL patterns detected',
      };
    }

    return {
      file: relativePath,
      category: 'scopes',
      valid: true,
      error: null,
    };
  } catch (error) {
    return {
      file: relativePath,
      category: 'scopes',
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Main validation function
 */
async function validateBendingSystem() {
  console.log(chalk.blue.bold('\n🔍 Validating Bending Over System...\n'));

  // Create validator
  const validator = new AjvSchemaValidator({ logger: simpleLogger });

  // Load schemas
  const schemaDir = path.join(__dirname, '..', 'data', 'schemas');

  // Load schemas in dependency order
  const schemaFiles = [
    'common.schema.json',
    'json-logic.schema.json',
    'condition-container.schema.json',
    'base-operation.schema.json',
    'component.schema.json',
    'action.schema.json',
    'condition.schema.json',
    'rule.schema.json',
  ];

  console.log(chalk.gray('Loading schemas...'));
  for (const schemaFile of schemaFiles) {
    const schemaPath = path.join(schemaDir, schemaFile);
    const schema = await loadJsonFile(schemaPath);
    validator.addSchema(schema, schema.$id || schema.id);
  }

  const results = {
    components: [],
    actions: [],
    conditions: [],
    rules: [],
    scopes: [],
  };

  const basePath = path.join(__dirname, '..', 'data', 'mods', 'positioning');

  // Validate Components
  console.log(chalk.yellow('\n📦 Validating Components:'));
  const components = [
    path.join(basePath, 'components', 'allows_bending_over.component.json'),
    path.join(basePath, 'components', 'bending_over.component.json'),
  ];

  for (const file of components) {
    const result = await validateFile(
      validator,
      file,
      COMPONENT_SCHEMA,
      'components'
    );
    results.components.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Actions
  console.log(chalk.yellow('\n🎯 Validating Actions:'));
  const actions = [
    path.join(basePath, 'actions', 'bend_over.action.json'),
    path.join(basePath, 'actions', 'straighten_up.action.json'),
  ];

  for (const file of actions) {
    const result = await validateFile(
      validator,
      file,
      ACTION_SCHEMA,
      'actions'
    );
    results.actions.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Conditions
  console.log(chalk.yellow('\n🔧 Validating Conditions:'));
  const conditions = [
    path.join(
      basePath,
      'conditions',
      'event-is-action-bend-over.condition.json'
    ),
    path.join(
      basePath,
      'conditions',
      'event-is-action-straighten-up.condition.json'
    ),
  ];

  for (const file of conditions) {
    const result = await validateFile(
      validator,
      file,
      CONDITION_SCHEMA,
      'conditions'
    );
    results.conditions.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Rules
  console.log(chalk.yellow('\n📜 Validating Rules:'));
  const rules = [
    path.join(basePath, 'rules', 'bend_over.rule.json'),
    path.join(basePath, 'rules', 'straighten_up.rule.json'),
  ];

  for (const file of rules) {
    const result = await validateFile(validator, file, RULE_SCHEMA, 'rules');
    results.rules.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Scopes
  console.log(chalk.yellow('\n🔍 Validating Scopes:'));
  const scopes = [
    path.join(basePath, 'scopes', 'available_surfaces.scope'),
    path.join(basePath, 'scopes', 'surface_im_bending_over.scope'),
  ];

  for (const file of scopes) {
    const result = await validateScopeFile(file);
    results.scopes.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Summary
  console.log(chalk.blue.bold('\n📊 Validation Summary:'));
  console.log(
    chalk.cyan(
      `  Components: ${results.components.filter((r) => r.valid).length}/${results.components.length}`
    )
  );
  console.log(
    chalk.cyan(
      `  Actions: ${results.actions.filter((r) => r.valid).length}/${results.actions.length}`
    )
  );
  console.log(
    chalk.cyan(
      `  Conditions: ${results.conditions.filter((r) => r.valid).length}/${results.conditions.length}`
    )
  );
  console.log(
    chalk.cyan(
      `  Rules: ${results.rules.filter((r) => r.valid).length}/${results.rules.length}`
    )
  );
  console.log(
    chalk.cyan(
      `  Scopes: ${results.scopes.filter((r) => r.valid).length}/${results.scopes.length}`
    )
  );

  // Check overall status
  const allValid = [
    ...results.components,
    ...results.actions,
    ...results.conditions,
    ...results.rules,
    ...results.scopes,
  ].every((r) => r.valid);

  if (allValid) {
    console.log(
      chalk.green.bold('\n✅ All bending system files validated successfully!')
    );
    console.log(
      chalk.gray('\nThe bending over system is ready for production use.\n')
    );
    process.exit(0);
  } else {
    console.log(
      chalk.red.bold(
        '\n❌ Some files failed validation. Check the output above.'
      )
    );
    console.log(
      chalk.yellow('\nPlease fix the errors before deploying to production.\n')
    );
    process.exit(1);
  }
}

// Run validation
validateBendingSystem().catch((error) => {
  console.error(chalk.red.bold('\n❌ Validation script failed:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
