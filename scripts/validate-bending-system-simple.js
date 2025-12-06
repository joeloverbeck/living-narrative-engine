#!/usr/bin/env node

/**
 * @file Simple validation script for the bending over system.
 * @description Validates that all required bending system files exist and have basic JSON structure.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Handle module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Validate a JSON file structure
 *
 * @param filePath
 * @param category
 * @param requiredFields
 */
async function validateJsonFile(filePath, category, requiredFields = []) {
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

    // Check required fields
    const missingFields = requiredFields.filter((field) => !(field in content));
    if (missingFields.length > 0) {
      return {
        file: relativePath,
        category,
        valid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      };
    }

    return {
      file: relativePath,
      category,
      valid: true,
      error: null,
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
  console.log(
    chalk.blue.bold('\n🔍 Simple Validation of Bending Over System...\n')
  );

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
    {
      file: path.join(
        basePath,
        'components',
        'allows_bending_over.component.json'
      ),
      requiredFields: ['id', 'description', 'dataSchema'],
    },
    {
      file: path.join(basePath, 'components', 'bending_over.component.json'),
      requiredFields: ['id', 'description', 'dataSchema'],
    },
  ];

  for (const component of components) {
    const result = await validateJsonFile(
      component.file,
      'components',
      component.requiredFields
    );
    results.components.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(component.file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Actions
  console.log(chalk.yellow('\n🎯 Validating Actions:'));
  const actions = [
    {
      file: path.join(basePath, 'actions', 'bend_over.action.json'),
      requiredFields: ['id', 'name', 'description'],
    },
    {
      file: path.join(basePath, 'actions', 'straighten_up.action.json'),
      requiredFields: ['id', 'name', 'description'],
    },
  ];

  for (const action of actions) {
    const result = await validateJsonFile(
      action.file,
      'actions',
      action.requiredFields
    );
    results.actions.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(action.file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Conditions
  console.log(chalk.yellow('\n🔧 Validating Conditions:'));
  const conditions = [
    {
      file: path.join(
        basePath,
        'conditions',
        'event-is-action-bend-over.condition.json'
      ),
      requiredFields: ['id', 'description', 'logic'],
    },
    {
      file: path.join(
        basePath,
        'conditions',
        'event-is-action-straighten-up.condition.json'
      ),
      requiredFields: ['id', 'description', 'logic'],
    },
  ];

  for (const condition of conditions) {
    const result = await validateJsonFile(
      condition.file,
      'conditions',
      condition.requiredFields
    );
    results.conditions.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(condition.file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }
  }

  // Validate Rules
  console.log(chalk.yellow('\n📜 Validating Rules:'));
  const rules = [
    {
      file: path.join(basePath, 'rules', 'bend_over.rule.json'),
      requiredFields: ['rule_id', 'event_type', 'actions'],
    },
    {
      file: path.join(basePath, 'rules', 'straighten_up.rule.json'),
      requiredFields: ['rule_id', 'event_type', 'actions'],
    },
  ];

  for (const rule of rules) {
    const result = await validateJsonFile(
      rule.file,
      'rules',
      rule.requiredFields
    );
    results.rules.push(result);
    const icon = result.valid ? chalk.green('✅') : chalk.red('❌');
    console.log(`  ${icon} ${path.basename(rule.file)}`);
    if (!result.valid && result.error) {
      console.log(chalk.red(`     Error: ${result.error}`));
    }

    // Check for LOCK_MOVEMENT and UNLOCK_MOVEMENT operations
    if (result.valid) {
      const ruleData = await loadJsonFile(rule.file);
      const fileName = path.basename(rule.file);

      if (fileName === 'bend_over.rule.json') {
        const hasLockMovement = ruleData.actions.some(
          (action) => action.type === 'LOCK_MOVEMENT'
        );
        if (!hasLockMovement) {
          console.log(
            chalk.yellow(
              `     Warning: bend_over.rule.json missing LOCK_MOVEMENT operation`
            )
          );
        }
      } else if (fileName === 'straighten_up.rule.json') {
        const hasUnlockMovement = ruleData.actions.some(
          (action) => action.type === 'UNLOCK_MOVEMENT'
        );
        if (!hasUnlockMovement) {
          console.log(
            chalk.yellow(
              `     Warning: straighten_up.rule.json missing UNLOCK_MOVEMENT operation`
            )
          );
        }
      }
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
      chalk.gray('\nThe bending over system is ready for testing.\n')
    );
    process.exit(0);
  } else {
    console.log(
      chalk.red.bold(
        '\n❌ Some files failed validation. Check the output above.'
      )
    );
    console.log(
      chalk.yellow('\nPlease fix the errors before running tests.\n')
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
