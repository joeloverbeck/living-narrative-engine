#!/usr/bin/env node

/**
 * @file Modifier entity path validation CLI tool
 * @description Scans action files and validates entity paths in modifier conditions
 *
 * Usage:
 *   node scripts/validateModifierPaths.js                    # Validate all mods
 *   node scripts/validateModifierPaths.js --mod positioning  # Validate specific mod
 *   node scripts/validateModifierPaths.js --verbose          # Detailed output
 *   npm run validate:modifier-paths                          # Via npm script
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import {
  validateModifierCondition,
  VALID_ENTITY_ROLES,
} from '../src/logic/utils/entityPathValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODS_DIR = path.join(PROJECT_ROOT, 'data', 'mods');

// CLI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Parse CLI arguments
 *
 * @param {string[]} argv - Command line arguments
 * @returns {{mods: string[], verbose: boolean, help: boolean, json: boolean}} Parsed arguments
 */
function parseArgs(argv) {
  const args = {
    mods: [],
    verbose: false,
    help: false,
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--mod' || arg === '-m') {
      if (argv[i + 1]) {
        args.mods.push(argv[++i]);
      }
    }
  }

  return args;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Modifier Entity Path Validator

Usage: node scripts/validateModifierPaths.js [OPTIONS]

Options:
  --mod, -m <name>    Validate specific mod(s) (can be repeated)
  --verbose, -v       Show detailed output including valid files
  --json              Output results as JSON
  --help, -h          Show this help message

Examples:
  node scripts/validateModifierPaths.js
  node scripts/validateModifierPaths.js --mod first-aid
  node scripts/validateModifierPaths.js --mod positioning --mod first-aid --verbose

Valid entity paths must:
  1. Start with "entity."
  2. Have a valid role: ${[...VALID_ENTITY_ROLES].join(', ')}
  3. Example: "entity.actor", "entity.primary.components.anatomy:part_health"
`);
}

/**
 * Load and parse a JSON file
 *
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<object>} Parsed JSON content
 */
async function loadJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Validate a single action file
 *
 * @param {string} filePath - Path to the action file
 * @returns {Promise<{filePath: string, errors: object[], hasModifiers: boolean}>} Validation result
 */
async function validateActionFile(filePath) {
  const actionData = await loadJsonFile(filePath);
  const errors = [];

  // Get modifiers from chanceBased if present
  const modifiers = actionData?.chanceBased?.modifiers;
  if (!Array.isArray(modifiers)) {
    return { filePath, errors, hasModifiers: false };
  }

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i];
    if (modifier?.condition) {
      const result = validateModifierCondition(modifier.condition);
      if (!result.isValid) {
        for (const err of result.errors) {
          errors.push({
            modifierIndex: i,
            modifierName: modifier.name || `modifier[${i}]`,
            ...err,
          });
        }
      }
    }
  }

  return { filePath, errors, hasModifiers: true };
}

/**
 * Main validation function
 */
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Build glob pattern
  let pattern;
  if (args.mods.length > 0) {
    const modPattern =
      args.mods.length === 1 ? args.mods[0] : `{${args.mods.join(',')}}`;
    pattern = `${MODS_DIR}/${modPattern}/actions/*.action.json`;
  } else {
    pattern = `${MODS_DIR}/**/actions/*.action.json`;
  }

  // Find all action files
  const actionFiles = await glob(pattern);

  if (actionFiles.length === 0) {
    console.log(
      `${colors.yellow}No action files found matching pattern${colors.reset}`
    );
    process.exit(0);
  }

  // Validate all files
  const results = {
    total: actionFiles.length,
    valid: 0,
    invalid: 0,
    noModifiers: 0,
    errors: [],
  };

  for (const filePath of actionFiles) {
    try {
      const result = await validateActionFile(filePath);
      const relativePath = path.relative(PROJECT_ROOT, filePath);

      if (!result.hasModifiers) {
        results.noModifiers++;
        if (args.verbose) {
          console.log(
            `${colors.dim}⚪ ${relativePath} - no modifiers${colors.reset}`
          );
        }
      } else if (result.errors.length === 0) {
        results.valid++;
        if (args.verbose) {
          console.log(`${colors.green}✅ ${relativePath}${colors.reset}`);
        }
      } else {
        results.invalid++;
        console.log(`${colors.red}❌ ${relativePath}${colors.reset}`);
        for (const err of result.errors) {
          console.log(
            `   ${colors.yellow}└─ ${err.modifierName}: "${err.path}" - ${err.error}${colors.reset}`
          );
          results.errors.push({
            file: relativePath,
            ...err,
          });
        }
      }
    } catch (err) {
      console.error(
        `${colors.red}Error processing ${filePath}: ${err.message}${colors.reset}`
      );
    }
  }

  // Output summary
  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('');
    console.log('━'.repeat(50));
    console.log(`${colors.cyan}Summary${colors.reset}`);
    console.log('━'.repeat(50));
    console.log(`Total action files:     ${results.total}`);
    console.log(
      `${colors.green}Valid (with modifiers): ${results.valid}${colors.reset}`
    );
    console.log(`${colors.red}Invalid:                ${results.invalid}${colors.reset}`);
    console.log(
      `${colors.dim}No modifiers:           ${results.noModifiers}${colors.reset}`
    );

    if (results.invalid > 0) {
      console.log('');
      console.log(
        `${colors.red}Validation failed with ${results.errors.length} error(s)${colors.reset}`
      );
      process.exit(1);
    } else {
      console.log('');
      console.log(
        `${colors.green}All modifier entity paths are valid!${colors.reset}`
      );
      process.exit(0);
    }
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
