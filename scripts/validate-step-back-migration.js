#!/usr/bin/env node

/**
 * @file Validates step_back action and rule migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_ACTION_ID = 'intimacy:step_back';
const NEW_ACTION_ID = 'positioning:step_back';
const OLD_COMPONENT_REF = 'intimacy:closeness';
const NEW_COMPONENT_REF = 'positioning:closeness';

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating step_back action/rule migration...\n');

  const errors = [];

  // Check new files exist
  const newFiles = [
    'data/mods/positioning/actions/step_back.action.json',
    'data/mods/positioning/rules/step_back.rule.json',
    'data/mods/positioning/conditions/event-is-action-step-back.condition.json',
    'data/mods/positioning/conditions/actor-is-in-closeness.condition.json',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      // Verify IDs and references are updated
      if (content.includes(OLD_ACTION_ID)) {
        errors.push(`${file} still contains old action ID`);
      }
      if (content.includes(OLD_COMPONENT_REF)) {
        errors.push(`${file} still contains old component reference`);
      }

      // Check specific validations
      if (file.includes('step_back.action.json')) {
        if (data.id !== NEW_ACTION_ID) {
          errors.push(`Action has wrong ID: ${data.id}`);
        }
        if (!data.required_components?.actor?.includes(NEW_COMPONENT_REF)) {
          errors.push('Action missing required component');
        }
      }

      console.log(`✅ ${path.basename(file)} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check for remaining old references
  const patterns = ['data/mods/**/*.json', 'src/**/*.js', 'tests/**/*.js'];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup', '**/positioning/**'],
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      if (content.includes(OLD_ACTION_ID)) {
        errors.push(`${file} still contains ${OLD_ACTION_ID}`);
      }
    }
  }

  // Verify rule operation
  try {
    const ruleContent = await fs.readFile(
      'data/mods/positioning/rules/step_back.rule.json',
      'utf8'
    );
    const rule = JSON.parse(ruleContent);

    if (rule.actions[0].type !== 'REMOVE_FROM_CLOSENESS_CIRCLE') {
      errors.push('Rule missing correct operation type');
    }

    console.log('✅ Rule operation is correct');
  } catch (error) {
    errors.push(`Failed to validate rule: ${error.message}`);
  }

  // Check old files removed
  const oldFiles = [
    'data/mods/intimacy/actions/step_back.action.json',
    'data/mods/intimacy/rules/step_back.rule.json',
    'data/mods/intimacy/conditions/event-is-action-step-back.condition.json',
  ];

  for (const file of oldFiles) {
    try {
      await fs.access(file);
      console.log(`⚠️  Warning: Old file still exists: ${file}`);
    } catch {
      console.log(`✅ Old file removed: ${path.basename(file)}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Step back migration validation passed!');
  }
}

validateMigration().catch(console.error);
