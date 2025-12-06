#!/usr/bin/env node

/**
 * @file Socket Consistency Validation Script
 * @description Validates anatomy entity sockets using a category-based inference system.
 *              Instead of expecting all entities of the same subType to have identical sockets,
 *              this script infers which socket categories an entity belongs to based on its
 *              existing sockets, then validates that the entity has ALL sockets required by
 *              its inferred categories.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// CLI Arguments parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    format: 'console',
    strict: false,
    help: false,
    verbose: false,
  };

  args.forEach((arg) => {
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg.startsWith('--format=')) {
      config.format = arg.split('=')[1];
    } else if (arg === '--strict') {
      config.strict = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    }
  });

  return config;
}

function showHelp() {
  console.log(`
Socket Consistency Validation (Category-Based)
===============================================

Usage: node scripts/validateSocketConsistency.js [options]

Options:
  --format=console|json   Output format (default: console)
  --strict                Exit with code 1 if inconsistencies found
  --verbose, -v           Show detailed category inference for each entity
  --help                  Show this help message

This script uses category-based validation with inference:
- Socket categories are defined in scripts/config/socketCategories.json
- Categories are inferred based on entity properties (existing sockets, ID patterns)
- Entities are validated to have ALL sockets from their inferred categories

Examples:
  node scripts/validateSocketConsistency.js
  node scripts/validateSocketConsistency.js --strict
  node scripts/validateSocketConsistency.js --verbose
  node scripts/validateSocketConsistency.js --format=json
`);
}

/**
 * Gets socket IDs from an entity
 * @param {object} entity - Entity definition
 * @returns {string[]} Sorted array of socket IDs
 */
function getSocketIds(entity) {
  const sockets = entity.components?.['anatomy:sockets']?.sockets || [];
  return sockets.map((s) => s.id).sort();
}

/**
 * Loads socket categories configuration
 * @param {string} configPath - Path to socketCategories.json
 * @returns {object|null} Categories config or null if not found
 */
function loadCategoriesConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(
      `Warning: Could not load categories config from ${configPath}: ${err.message}`
    );
    console.warn('Falling back to legacy union-based validation.\n');
    return null;
  }
}

/**
 * Infers which socket categories apply to an entity based on inference rules
 * @param {object} entity - Entity definition
 * @param {object} categoriesConfig - Categories configuration
 * @returns {Set<string>} Set of category names that apply to this entity
 */
function inferCategoriesForEntity(entity, categoriesConfig) {
  const inferredCategories = new Set();
  const entitySockets = new Set(getSocketIds(entity));
  const subType = entity.components?.['anatomy:part']?.subType;
  const entityId = entity.id || '';

  for (const [categoryName, categoryDef] of Object.entries(
    categoriesConfig.categories
  )) {
    const appliesTo = categoryDef.appliesTo || {};
    let applies = false;

    // Check subType-based application
    if (appliesTo.subTypes && appliesTo.subTypes.includes(subType)) {
      // Check exclusions
      if (
        !appliesTo.excludeSubTypes ||
        !appliesTo.excludeSubTypes.includes(subType)
      ) {
        applies = true;
      }
    }

    // Check inference rules
    if (appliesTo.inferFrom) {
      const inferFrom = appliesTo.inferFrom;

      // Infer from any_socket: if entity has ANY of these sockets, category applies
      if (inferFrom.any_socket) {
        for (const socket of inferFrom.any_socket) {
          if (entitySockets.has(socket)) {
            applies = true;
            break;
          }
        }
      }

      // Infer from id_contains: if entity ID contains any of these patterns
      if (inferFrom.id_contains) {
        for (const pattern of inferFrom.id_contains) {
          if (entityId.toLowerCase().includes(pattern.toLowerCase())) {
            applies = true;
            break;
          }
        }
      }
    }

    if (applies) {
      inferredCategories.add(categoryName);
    }
  }

  return inferredCategories;
}

/**
 * Validates an entity against its inferred categories
 * @param {object} entity - Entity definition
 * @param {object} categoriesConfig - Categories configuration
 * @returns {object} Validation result with missing sockets by category
 */
function validateEntityCategories(entity, categoriesConfig) {
  const entitySockets = new Set(getSocketIds(entity));
  const inferredCategories = inferCategoriesForEntity(entity, categoriesConfig);
  const missingByCategory = {};
  let hasIssues = false;

  for (const categoryName of inferredCategories) {
    const categoryDef = categoriesConfig.categories[categoryName];
    if (!categoryDef || !categoryDef.sockets) continue;

    const missingSockets = categoryDef.sockets.filter(
      (socket) => !entitySockets.has(socket)
    );
    if (missingSockets.length > 0) {
      missingByCategory[categoryName] = missingSockets;
      hasIssues = true;
    }
  }

  return {
    entityId: entity.id,
    inferredCategories: [...inferredCategories],
    missingByCategory,
    hasIssues,
  };
}

// Main execution
async function main() {
  const cliConfig = parseArgs();

  if (cliConfig.help) {
    showHelp();
    process.exit(0);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const definitionsDir = path.resolve(
    __dirname,
    '../data/mods/anatomy/entities/definitions'
  );
  const categoriesConfigPath = path.resolve(
    __dirname,
    './config/socketCategories.json'
  );

  try {
    // Load categories config
    const categoriesConfig = loadCategoriesConfig(categoriesConfigPath);

    // Load entities
    const files = fs
      .readdirSync(definitionsDir)
      .filter((f) => f.endsWith('.json'));
    const entities = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(definitionsDir, file),
          'utf-8'
        );
        const entity = JSON.parse(content);
        entities.push(entity);
      } catch (err) {
        console.error(`Error reading/parsing ${file}:`, err.message);
      }
    }

    // Group by subType for organized output
    const grouped = {};
    entities.forEach((entity) => {
      const subType = entity.components?.['anatomy:part']?.subType;
      if (subType) {
        if (!grouped[subType]) {
          grouped[subType] = [];
        }
        grouped[subType].push(entity);
      }
    });

    // Validate using category-based approach
    const results = {
      consistent: true,
      mode: categoriesConfig ? 'category-based' : 'legacy-union',
      subTypes: {},
      entityIssues: [],
    };

    let consoleOutput = 'Socket Consistency Validation (Category-Based)\n';
    consoleOutput += '==============================================\n\n';

    if (!categoriesConfig) {
      consoleOutput +=
        '⚠️  No categories config found. Using legacy union-based validation.\n\n';
    }

    for (const [subType, group] of Object.entries(grouped)) {
      if (group.length === 0) continue;

      const subTypeIssues = [];

      if (categoriesConfig) {
        // Category-based validation
        for (const entity of group) {
          const validation = validateEntityCategories(entity, categoriesConfig);

          if (cliConfig.verbose) {
            consoleOutput += `  ${entity.id}: categories [${validation.inferredCategories.join(', ')}]\n`;
          }

          if (validation.hasIssues) {
            results.consistent = false;
            subTypeIssues.push(validation);
            results.entityIssues.push(validation);
          }
        }

        if (subTypeIssues.length === 0) {
          results.subTypes[subType] = {
            consistent: true,
            entityCount: group.length,
          };
          consoleOutput += `✓ ${subType}: ${group.length} entities validated by category\n`;
        } else {
          results.subTypes[subType] = {
            consistent: false,
            entityCount: group.length,
            issues: subTypeIssues,
          };
          consoleOutput += `✗ ${subType}: ${group.length} entities, ${subTypeIssues.length} with issues\n`;
          for (const issue of subTypeIssues) {
            for (const [category, missingSockets] of Object.entries(
              issue.missingByCategory
            )) {
              consoleOutput += `  - ${issue.entityId} (${category}): missing ${missingSockets.join(', ')}\n`;
            }
          }
        }
      } else {
        // Legacy union-based validation (fallback)
        const allSeenSockets = new Set();
        group.forEach((e) =>
          getSocketIds(e).forEach((id) => allSeenSockets.add(id))
        );

        let subTypeConsistent = true;
        group.forEach((e) => {
          const eSockets = new Set(getSocketIds(e));
          const missing = [...allSeenSockets].filter((id) => !eSockets.has(id));
          if (missing.length > 0) {
            subTypeConsistent = false;
            subTypeIssues.push({
              entityId: e.id,
              missingSockets: missing,
            });
          }
        });

        if (!subTypeConsistent) {
          results.consistent = false;
          results.subTypes[subType] = {
            consistent: false,
            entityCount: group.length,
            issues: subTypeIssues,
          };
          consoleOutput += `✗ ${subType}: ${group.length} entities, INCONSISTENT\n`;
          subTypeIssues.forEach((issue) => {
            consoleOutput += `  - ${issue.entityId} missing: ${issue.missingSockets.join(', ')}\n`;
          });
        } else {
          results.subTypes[subType] = {
            consistent: true,
            entityCount: group.length,
            socketCount: getSocketIds(group[0]).length,
          };
          consoleOutput += `✓ ${subType}: ${group.length} entities, all consistent\n`;
        }
      }
    }

    const inconsistentCount = Object.values(results.subTypes).filter(
      (r) => !r.consistent
    ).length;
    const consistentCount = Object.values(results.subTypes).filter(
      (r) => r.consistent
    ).length;

    consoleOutput += `\nSummary: ${consistentCount} subTypes consistent, ${inconsistentCount} with issues\n`;

    if (results.consistent) {
      consoleOutput +=
        '\n✓ All entities are consistent with their inferred socket categories.\n';
    }

    if (cliConfig.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(consoleOutput);
    }

    if (cliConfig.strict && !results.consistent) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(2);
  }
}

main();
