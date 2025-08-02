#!/usr/bin/env node

/**
 * @file Validates facing_away component migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_COMPONENT_ID = 'intimacy:facing_away';
const NEW_COMPONENT_ID = 'positioning:facing_away';
const PROPERTY_NAME = 'facing_away_from';

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
  console.log('🔍 Validating facing_away component migration...\n');

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
    '**/workflows/**',
    '**/reports/**',
    '**/specs/**',
  ];

  let hasErrors = false;

  // Check for old references
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
    'data/mods/positioning/components/facing_away.component.json';
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

    // Validate component structure
    if (!component.dataSchema?.properties?.[PROPERTY_NAME]) {
      console.log(`\n❌ New component missing '${PROPERTY_NAME}' property`);
      hasErrors = true;
    } else {
      console.log(`\n✅ New component has correct '${PROPERTY_NAME}' property`);
    }

    if (!component.dataSchema?.required?.includes(PROPERTY_NAME)) {
      console.log(
        `\n❌ New component doesn't require '${PROPERTY_NAME}' property`
      );
      hasErrors = true;
    } else {
      console.log(
        `\n✅ New component correctly requires '${PROPERTY_NAME}' property`
      );
    }
  } catch (error) {
    console.log(`\n❌ Failed to read new component: ${error.message}`);
    hasErrors = true;
  }

  // Check component structure
  console.log('\n📋 Checking component references in other files...');

  // Check actions that should reference positioning:facing_away
  const actionsToCheck = [
    'data/mods/intimacy/actions/massage_back.action.json',
    'data/mods/intimacy/actions/place_hand_on_waist.action.json',
    'data/mods/intimacy/actions/turn_around_to_face.action.json',
  ];

  // Check conditions that should reference positioning:facing_away
  const conditionsToCheck = [
    'data/mods/intimacy/conditions/entity-in-facing-away.condition.json',
    'data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json',
    'data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json',
    'data/mods/intimacy/conditions/actor-is-behind-entity.condition.json',
    'data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json',
  ];

  // Check rules that should reference positioning:facing_away
  const rulesToCheck = [
    'data/mods/intimacy/rules/turn_around.rule.json',
    'data/mods/intimacy/rules/turn_around_to_face.rule.json',
    'data/mods/intimacy/rules/step_back.rule.json',
  ];

  // Check scopes that should reference positioning:facing_away
  const scopesToCheck = [
    'data/mods/intimacy/scopes/actors_im_facing_away_from.scope',
    'data/mods/intimacy/scopes/close_actors_facing_away.scope',
  ];

  // Check all file types
  const allFilesToCheck = [
    ...actionsToCheck.map((f) => ({ file: f, type: 'action' })),
    ...conditionsToCheck.map((f) => ({ file: f, type: 'condition' })),
    ...rulesToCheck.map((f) => ({ file: f, type: 'rule' })),
    ...scopesToCheck.map((f) => ({ file: f, type: 'scope' })),
  ];

  for (const { file, type } of allFilesToCheck) {
    try {
      const content = await fs.readFile(file, 'utf8');

      // Check for correct references
      const hasCorrectRef = content.includes(NEW_COMPONENT_ID);
      const hasOldRef = content.includes(OLD_COMPONENT_ID);

      if (hasOldRef) {
        console.log(`  ❌ ${file} (${type}) still has old reference`);
        hasErrors = true;
      } else if (hasCorrectRef) {
        console.log(`  ✅ ${file} (${type}) correctly updated`);
      } else if (type === 'scope' && content.includes('facing_away')) {
        // For scopes, also check the property name patterns
        const hasFacingAwayFrom = content.includes('facing_away_from');
        if (hasFacingAwayFrom) {
          console.log(`  ✅ ${file} (${type}) uses correct property name`);
        } else {
          console.log(`  ❌ ${file} (${type}) may need property name update`);
          hasErrors = true;
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Could not check ${file}: ${error.message}`);
    }
  }

  // Check if old component still exists
  const oldComponentPath =
    'data/mods/intimacy/components/facing_away.component.json';
  try {
    await fs.access(oldComponentPath);
    console.log(
      '\n⚠️  Warning: Old component file still exists. Remember to remove it after validation.'
    );
  } catch {
    console.log('\n✅ Old component file has been removed');
  }

  // Check positioning mod manifest
  try {
    const manifestPath = 'data/mods/positioning/mod-manifest.json';
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    if (manifest.content?.components?.includes('facing_away.component.json')) {
      console.log(
        '\n✅ Positioning mod manifest includes facing_away component'
      );
    } else {
      console.log(
        '\n❌ Positioning mod manifest missing facing_away component'
      );
      hasErrors = true;
    }
  } catch (error) {
    console.log(
      `\n❌ Failed to check positioning mod manifest: ${error.message}`
    );
    hasErrors = true;
  }

  if (!hasErrors) {
    console.log('\n✨ Migration validation passed!');
  } else {
    console.log('\n❌ Migration validation failed. Fix the issues above.');
    process.exit(1);
  }
}

validateMigration().catch(console.error);
