#!/usr/bin/env node

/**
 * @file Validates positioning conditions migration
 * @description Ensures all conditions have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const MIGRATED_CONDITIONS = [
  'entity-in-facing-away',
  'entity-not-in-facing-away',
  'actor-in-entity-facing-away',
  'actor-is-behind-entity',
  'both-actors-facing-each-other',
];

const OLD_COMPONENT_REF = 'intimacy:facing_away.facing_away_from';
const NEW_COMPONENT_REF = 'positioning:facing_away.facing_away_from';

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating positioning conditions migration...\n');

  const errors = [];

  // Check new condition files exist and are correct
  for (const conditionName of MIGRATED_CONDITIONS) {
    const filePath = `data/mods/positioning/conditions/${conditionName}.condition.json`;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const condition = JSON.parse(content);

      // Check ID is updated
      if (condition.id !== `positioning:${conditionName}`) {
        errors.push(`${conditionName} has wrong ID: ${condition.id}`);
      }

      // Check component references are updated (they should already be correct)
      if (content.includes('positioning:facing_away.facing_away_from')) {
        console.log(`✅ ${conditionName} migrated correctly`);
      } else {
        errors.push(`${conditionName} missing correct component reference`);
      }
    } catch (error) {
      errors.push(`Failed to read ${conditionName}: ${error.message}`);
    }
  }

  // Check positioning mod manifest includes all conditions
  try {
    const manifestContent = await fs.readFile(
      'data/mods/positioning/mod-manifest.json',
      'utf8'
    );
    const manifest = JSON.parse(manifestContent);

    for (const conditionName of MIGRATED_CONDITIONS) {
      const fileName = `${conditionName}.condition.json`;
      if (!manifest.content.conditions.includes(fileName)) {
        errors.push(`Positioning manifest missing ${fileName}`);
      }
    }

    console.log('✅ Positioning mod manifest updated');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check for old references across all mods
  const allModFiles = await glob('data/mods/**/*.{json,scope}', {
    ignore: ['**/*.backup'],
  });

  let foundOldRefs = false;
  for (const file of allModFiles) {
    const content = await fs.readFile(file, 'utf8');

    for (const conditionName of MIGRATED_CONDITIONS) {
      const oldRef = `intimacy:${conditionName}`;
      if (content.includes(oldRef)) {
        errors.push(`${file} still references ${oldRef}`);
        foundOldRefs = true;
      }
    }
  }

  if (!foundOldRefs) {
    console.log('✅ All references updated to positioning namespace');
  }

  // Check intimacy mod manifest no longer contains migrated conditions
  try {
    const intimacyManifestContent = await fs.readFile(
      'data/mods/intimacy/mod-manifest.json',
      'utf8'
    );
    const intimacyManifest = JSON.parse(intimacyManifestContent);

    for (const conditionName of MIGRATED_CONDITIONS) {
      const fileName = `${conditionName}.condition.json`;
      if (intimacyManifest.content.conditions.includes(fileName)) {
        errors.push(`Intimacy manifest still contains ${fileName}`);
      }
    }

    console.log('✅ Intimacy mod manifest cleaned up');
  } catch (error) {
    errors.push(`Failed to validate intimacy manifest: ${error.message}`);
  }

  // Check old condition files are removed
  for (const conditionName of MIGRATED_CONDITIONS) {
    const oldPath = `data/mods/intimacy/conditions/${conditionName}.condition.json`;
    try {
      await fs.access(oldPath);
      errors.push(`Old condition file still exists: ${conditionName}`);
    } catch {
      // File doesn't exist, which is what we want
    }
  }
  console.log('✅ Old condition files removed');

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`  - Conditions migrated: ${MIGRATED_CONDITIONS.length}`);
  console.log(`  - Errors found: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Conditions migration validation passed!');
  }
}

validateMigration().catch(console.error);
