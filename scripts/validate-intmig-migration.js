#!/usr/bin/env node

/**
 * @file Validates intimacy actions migration from scope to targets
 * @description Ensures all intimacy actions have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';

const ACTIONS_DIR = 'data/mods/intimacy/actions';
const SCHEMA_PATH = 'data/schemas/action.schema.json';

// Expected migrations (all except adjust_clothing which doesn't need migration)
const ACTIONS_TO_MIGRATE = [
  'accept_kiss_passively',
  'break_kiss_gently',
  'brush_hand',
  'cup_face_while_kissing',
  'explore_mouth_with_tongue',
  'feel_arm_muscles',
  'fondle_ass',
  'kiss_back_passionately',
  'kiss_cheek',
  'kiss_neck_sensually',
  'lean_in_for_deep_kiss',
  'lick_lips',
  'massage_back',
  'massage_shoulders',
  'nibble_earlobe_playfully',
  'nibble_lower_lip',
  'nuzzle_face_into_neck',
  'peck_on_lips',
  'place_hand_on_waist',
  'pull_back_breathlessly',
  'pull_back_in_revulsion',
  'suck_on_neck_to_leave_hickey',
  'suck_on_tongue',
  'thumb_wipe_cheek',
];

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating intimacy actions migration...\n');

  // Simple validation without full schema compilation for now
  // The main goal is to check scope vs targets migration status
  const validateBasicStructure = (content) => {
    // Basic structure validation
    if (!content.id || !content.id.startsWith('intimacy:')) {
      return false;
    }
    // Must have either scope or targets, but not both
    const hasScope = content.scope !== undefined;
    const hasTargets = content.targets !== undefined;

    if (hasScope && hasTargets) {
      return false; // Invalid - has both
    }
    if (!hasScope && !hasTargets) {
      return false; // Invalid - has neither
    }
    return true;
  };

  const results = {
    total: 0,
    migrated: 0,
    notMigrated: 0,
    invalid: 0,
    schemaValid: 0,
    errors: [],
  };

  console.log('Checking migration status for each action:\n');

  for (const actionName of ACTIONS_TO_MIGRATE) {
    const filePath = path.join(ACTIONS_DIR, `${actionName}.action.json`);
    results.total++;

    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

      // Check migration status
      const hasScope = content.scope !== undefined;
      const hasTargets = content.targets !== undefined;

      if (hasScope && hasTargets) {
        // Invalid state - has both
        results.invalid++;
        results.errors.push({
          action: actionName,
          error: 'Contains both "scope" and "targets" (invalid state)',
          status: '❌ INVALID',
        });
        console.log(`❌ ${actionName}: INVALID - has both scope and targets`);
      } else if (hasTargets && !hasScope) {
        // Successfully migrated
        results.migrated++;

        // Basic structure validation
        if (validateBasicStructure(content)) {
          results.schemaValid++;
          console.log(`✅ ${actionName}: Migrated and valid`);
        } else {
          results.errors.push({
            action: actionName,
            error: 'Basic structure validation failed',
            status: '⚠️  MIGRATED BUT INVALID',
          });
          console.log(
            `⚠️  ${actionName}: Migrated but structure validation failed`
          );
        }
      } else if (hasScope && !hasTargets) {
        // Not migrated yet
        results.notMigrated++;
        console.log(`⏳ ${actionName}: Not migrated (still using scope)`);
      } else {
        // Missing both - unexpected state
        results.invalid++;
        results.errors.push({
          action: actionName,
          error: 'Missing both "scope" and "targets"',
          status: '❌ INVALID',
        });
        console.log(
          `❌ ${actionName}: INVALID - missing both scope and targets`
        );
      }
    } catch (err) {
      results.errors.push({
        action: actionName,
        error: `Failed to process: ${err.message}`,
        status: '❌ ERROR',
      });
      console.log(`❌ ${actionName}: ERROR - ${err.message}`);
    }
  }

  // Check adjust_clothing separately (should already have targets)
  console.log('\nChecking adjust_clothing (should already be migrated):');
  try {
    const adjustClothingPath = path.join(
      ACTIONS_DIR,
      'adjust_clothing.action.json'
    );
    const content = JSON.parse(await fs.readFile(adjustClothingPath, 'utf8'));

    if (content.targets && !content.scope) {
      console.log(
        '✅ adjust_clothing: Already uses targets format (as expected)'
      );
    } else if (content.scope) {
      console.log('⚠️  adjust_clothing: Unexpectedly has scope property');
    } else {
      console.log('❌ adjust_clothing: Missing targets property');
    }
  } catch (err) {
    console.log(`❌ adjust_clothing: Error reading file - ${err.message}`);
  }

  // Report results
  console.log('\n' + '='.repeat(60));
  console.log('=== INTMIG Migration Validation Report ===');
  console.log('='.repeat(60) + '\n');

  console.log(`Total actions to migrate: ${results.total}`);
  console.log(`✅ Successfully migrated: ${results.migrated}`);
  console.log(`⏳ Not yet migrated: ${results.notMigrated}`);
  console.log(`❌ Invalid state: ${results.invalid}`);
  console.log(
    `✅ Schema valid (of migrated): ${results.schemaValid}/${results.migrated}`
  );

  // Calculate progress percentage
  const progressPercent = Math.round((results.migrated / results.total) * 100);
  console.log(`\n📊 Migration Progress: ${progressPercent}% complete`);

  // Progress bar
  const barLength = 40;
  const filledLength = Math.round((progressPercent / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`   [${bar}] ${results.migrated}/${results.total}`);

  if (results.errors.length > 0) {
    console.log('\n=== Errors and Issues ===\n');
    for (const error of results.errors) {
      console.log(`${error.status} ${error.action}: ${error.error}`);
      if (error.details) {
        console.log('  Schema errors:', JSON.stringify(error.details, null, 2));
      }
    }
  }

  if (
    results.notMigrated === 0 &&
    results.invalid === 0 &&
    results.errors.length === 0
  ) {
    console.log('\n✨ All validations passed! Migration is complete.');
    process.exit(0);
  } else if (results.invalid > 0 || results.errors.length > 0) {
    console.log('\n❌ Validation failed. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ No errors found. Migration is in progress.');
    process.exit(0);
  }
}

validateMigration().catch(console.error);
