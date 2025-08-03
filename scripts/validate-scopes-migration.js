#!/usr/bin/env node

/**
 * @file Validates positioning scopes migration
 * @description Ensures scopes have been migrated and updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const MIGRATED_SCOPES = [
  'close_actors.scope', // Only this scope needs migration
];

const ALREADY_MIGRATED_SCOPES = [
  'actors_im_facing_away_from.scope',
  'close_actors_facing_each_other_or_behind_target.scope',
];

const OLD_COMPONENT_REFS = ['intimacy:closeness', 'intimacy:facing_away'];

const NEW_COMPONENT_REFS = ['positioning:closeness', 'positioning:facing_away'];

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating positioning scopes migration...\n');

  const errors = [];

  // Check all scopes in positioning mod
  const allPositioningScopes = [...MIGRATED_SCOPES, ...ALREADY_MIGRATED_SCOPES];

  for (const scopeName of allPositioningScopes) {
    const filePath = `data/mods/positioning/scopes/${scopeName}`;

    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Check for old component references
      for (const oldRef of OLD_COMPONENT_REFS) {
        if (content.includes(oldRef)) {
          errors.push(`${scopeName} still contains ${oldRef}`);
        }
      }

      // Check for new component references
      let hasNewRef = false;
      for (const newRef of NEW_COMPONENT_REFS) {
        if (content.includes(newRef)) {
          hasNewRef = true;
          break;
        }
      }

      if (!hasNewRef && !content.includes('condition_ref')) {
        errors.push(`${scopeName} missing positioning component references`);
      }

      console.log(`✅ ${scopeName} in positioning mod and correctly formatted`);
    } catch (error) {
      errors.push(`Failed to read ${scopeName}: ${error.message}`);
    }
  }

  // Check positioning mod manifest
  try {
    const manifestContent = await fs.readFile(
      'data/mods/positioning/mod-manifest.json',
      'utf8'
    );
    const manifest = JSON.parse(manifestContent);

    for (const scopeName of allPositioningScopes) {
      if (!manifest.content.scopes.includes(scopeName)) {
        errors.push(`Positioning manifest missing ${scopeName}`);
      }
    }

    console.log('✅ Positioning mod manifest contains all expected scopes');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check intimacy scopes are updated
  const intimacyScopes = await glob('data/mods/intimacy/scopes/*.scope');

  for (const scopeFile of intimacyScopes) {
    const content = await fs.readFile(scopeFile, 'utf8');

    // Check if still using old component references
    for (const oldRef of OLD_COMPONENT_REFS) {
      if (content.includes(oldRef)) {
        errors.push(`${path.basename(scopeFile)} still uses ${oldRef}`);
      }
    }
  }

  console.log('✅ Intimacy scopes updated to use positioning components');

  // Check old scope files are removed
  for (const scopeName of MIGRATED_SCOPES) {
    const oldPath = `data/mods/intimacy/scopes/${scopeName}`;
    try {
      await fs.access(oldPath);
      console.log(`⚠️  Warning: Old scope file still exists: ${scopeName}`);
    } catch {
      console.log(`✅ Old scope file removed: ${scopeName}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Scopes migration validation passed!');
  }
}

validateMigration().catch(console.error);
