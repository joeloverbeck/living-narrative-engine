#!/usr/bin/env node

/**
 * @file Validates get_close action and rule migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_ACTION_ID = 'intimacy:get_close';
const NEW_ACTION_ID = 'positioning:get_close';

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating get_close action/rule migration...\n');

  const errors = [];

  // Check new files exist
  const newFiles = [
    'data/mods/positioning/actions/get_close.action.json',
    'data/mods/positioning/rules/get_close.rule.json',
    'data/mods/positioning/conditions/event-is-action-get-close.condition.json',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      // Verify IDs are updated
      if (file.includes('action.json') && data.id !== NEW_ACTION_ID) {
        errors.push(`Action file has wrong ID: ${data.id}`);
      }
      if (
        file.includes('rule.json') &&
        data.condition.condition_ref !== 'positioning:event-is-action-get-close'
      ) {
        errors.push('Rule file has wrong condition reference');
      }

      console.log(`✅ ${file} exists and has correct ID`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check for old references
  const patterns = ['data/mods/**/*.json', 'src/**/*.js', 'tests/**/*.js'];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup'],
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      if (content.includes(OLD_ACTION_ID)) {
        const lines = content.split('\n');
        const lineNumbers = lines
          .map((line, idx) => (line.includes(OLD_ACTION_ID) ? idx + 1 : null))
          .filter((n) => n !== null);

        errors.push(
          `${file} still contains old reference at lines: ${lineNumbers.join(', ')}`
        );
      }
    }
  }

  // Verify rule operations use correct component
  try {
    const ruleContent = await fs.readFile(
      'data/mods/positioning/rules/get_close.rule.json',
      'utf8'
    );
    const rule = JSON.parse(ruleContent);

    if (rule.actions[0].type !== 'MERGE_CLOSENESS_CIRCLE') {
      errors.push('Rule is missing MERGE_CLOSENESS_CIRCLE action');
    }

    console.log('✅ Rule operations are correct');
  } catch (error) {
    errors.push(`Failed to validate rule operations: ${error.message}`);
  }

  // Check old files are removed
  const oldFiles = [
    'data/mods/intimacy/actions/get_close.action.json',
    'data/mods/intimacy/rules/get_close.rule.json',
  ];

  for (const file of oldFiles) {
    try {
      await fs.access(file);
      console.log(`⚠️  Warning: Old file still exists: ${file}`);
    } catch {
      console.log(`✅ Old file removed: ${file}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Migration validation passed!');
  }
}

validateMigration().catch(console.error);
