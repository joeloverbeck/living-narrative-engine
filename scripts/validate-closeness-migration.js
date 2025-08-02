#!/usr/bin/env node

/**
 * @file Validates closeness component migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_COMPONENT_ID = 'intimacy:closeness';
const NEW_COMPONENT_ID = 'positioning:closeness';

/**
 *
 * @param pattern
 * @param excludePatterns
 */
async function findReferences(pattern, excludePatterns = []) {
  const files = await glob(pattern, { ignore: excludePatterns });
  const references = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (content.includes(OLD_COMPONENT_ID)) {
      const lines = content.split('\n');
      const matches = lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => line.includes(OLD_COMPONENT_ID));

      references.push({ file, matches });
    }
  }

  return references;
}

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating closeness component migration...\n');

  const patterns = [
    'data/mods/**/*.json',
    'data/mods/**/*.scope',
    'src/**/*.js',
    'tests/**/*.js',
  ];

  const excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.backup',
  ];

  let hasErrors = false;

  for (const pattern of patterns) {
    const references = await findReferences(pattern, excludePatterns);

    if (references.length > 0) {
      console.log(
        `❌ Found ${references.length} files with old references in ${pattern}:`
      );
      hasErrors = true;

      for (const { file, matches } of references) {
        console.log(`\n  File: ${file}`);
        for (const { line, number } of matches) {
          console.log(`    Line ${number}: ${line.trim()}`);
        }
      }
    }
  }

  // Verify new component exists
  const newComponentPath =
    'data/mods/positioning/components/closeness.component.json';
  try {
    const content = await fs.readFile(newComponentPath, 'utf8');
    const component = JSON.parse(content);

    if (component.id !== NEW_COMPONENT_ID) {
      console.log(`\n❌ New component has incorrect ID: ${component.id}`);
      hasErrors = true;
    } else {
      console.log(
        `\n✅ New component exists with correct ID: ${NEW_COMPONENT_ID}`
      );
    }
  } catch (error) {
    console.log(`\n❌ Failed to read new component: ${error.message}`);
    hasErrors = true;
  }

  // Check if old component still exists
  const oldComponentPath =
    'data/mods/intimacy/components/closeness.component.json';
  try {
    await fs.access(oldComponentPath);
    console.log(
      '\n⚠️  Warning: Old component file still exists. Remember to remove it.'
    );
  } catch {
    console.log('\n✅ Old component file has been removed');
  }

  if (!hasErrors) {
    console.log('\n✨ Migration validation passed!');
  } else {
    console.log('\n❌ Migration validation failed. Fix the issues above.');
    process.exit(1);
  }
}

validateMigration().catch(console.error);
