#!/usr/bin/env node

/**
 * @file Validates turn around actions and rules migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_REFS = ['intimacy:turn_around', 'intimacy:turn_around_to_face'];

const NEW_REFS = ['positioning:turn_around', 'positioning:turn_around_to_face'];

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating turn around actions/rules migration...\n');

  const errors = [];

  // Check new files exist and have correct content
  const newFiles = [
    'data/mods/positioning/actions/turn_around.action.json',
    'data/mods/positioning/actions/turn_around_to_face.action.json',
    'data/mods/positioning/rules/turn_around.rule.json',
    'data/mods/positioning/rules/turn_around_to_face.rule.json',
    'data/mods/positioning/conditions/event-is-action-turn-around.condition.json',
    'data/mods/positioning/conditions/event-is-action-turn-around-to-face.condition.json',
    'data/mods/positioning/conditions/both-actors-facing-each-other.condition.json',
    'data/mods/positioning/conditions/actor-is-behind-entity.condition.json',
    'data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope',
    'data/mods/positioning/scopes/actors_im_facing_away_from.scope',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');

      // Parse JSON files, skip scope files (DSL format)
      let data = null;
      if (file.endsWith('.json')) {
        data = JSON.parse(content);
      }

      // Check for old references
      for (const oldRef of OLD_REFS) {
        if (content.includes(oldRef)) {
          errors.push(`${path.basename(file)} still contains ${oldRef}`);
        }
      }

      // Specific validations for JSON files
      if (data) {
        if (
          file.includes('turn_around.action.json') &&
          !file.includes('to_face')
        ) {
          if (data.id !== 'positioning:turn_around') {
            errors.push(`Turn around action has wrong ID: ${data.id}`);
          }
          if (!data.scope || !data.scope.includes('positioning:')) {
            errors.push('Turn around action missing positioning scope');
          }
          if (!data.template) {
            errors.push('Turn around action missing template');
          }
        }

        if (file.includes('turn_around_to_face.action.json')) {
          if (data.id !== 'positioning:turn_around_to_face') {
            errors.push(`Turn around to face action has wrong ID: ${data.id}`);
          }
          if (
            !data.required_components?.actor?.includes('positioning:closeness')
          ) {
            errors.push('Turn around to face missing closeness requirement');
          }
          if (
            !data.required_components?.actor?.includes(
              'positioning:facing_away'
            )
          ) {
            errors.push('Turn around to face missing facing_away requirement');
          }
        }

        if (file.includes('.rule.json')) {
          if (!data.rule_id) {
            errors.push(`Rule ${path.basename(file)} missing rule_id`);
          }
          if (!data.event_type) {
            errors.push(`Rule ${path.basename(file)} missing event_type`);
          }
          if (!data.actions || !Array.isArray(data.actions)) {
            errors.push(`Rule ${path.basename(file)} missing actions array`);
          }
        }

        if (file.includes('.condition.json')) {
          if (!data.id || !data.id.startsWith('positioning:')) {
            errors.push(
              `Condition ${path.basename(file)} missing correct positioning namespace`
            );
          }
        }
      }

      // Scope file validation
      if (file.endsWith('.scope')) {
        if (!content.includes('positioning:')) {
          errors.push(
            `Scope ${path.basename(file)} missing positioning namespace`
          );
        }
      }

      console.log(`✅ ${path.basename(file)} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check rule operations use proper operation handlers
  try {
    const turnAroundRule = JSON.parse(
      await fs.readFile(
        'data/mods/positioning/rules/turn_around.rule.json',
        'utf8'
      )
    );

    if (!turnAroundRule.actions || !Array.isArray(turnAroundRule.actions)) {
      errors.push('Turn around rule missing actions array');
    } else {
      const hasProperOperations = turnAroundRule.actions.some((action) =>
        ['GET_NAME', 'QUERY_COMPONENT', 'IF', 'MODIFY_ARRAY_FIELD'].includes(
          action.type
        )
      );
      if (!hasProperOperations) {
        errors.push('Turn around rule missing proper operation handlers');
      }

      // Check for correct event dispatching namespace
      const dispatchEvents = turnAroundRule.actions.filter(
        (action) => action.type === 'DISPATCH_EVENT'
      );
      for (const event of dispatchEvents) {
        if (
          event.parameters?.eventType &&
          event.parameters.eventType.includes('intimacy:')
        ) {
          errors.push('Turn around rule still dispatches intimacy events');
        }
      }
    }

    const turnToFaceRule = JSON.parse(
      await fs.readFile(
        'data/mods/positioning/rules/turn_around_to_face.rule.json',
        'utf8'
      )
    );

    if (!turnToFaceRule.actions || !Array.isArray(turnToFaceRule.actions)) {
      errors.push('Turn to face rule missing actions array');
    } else {
      const hasRemoveComponent = turnToFaceRule.actions.some(
        (action) => action.type === 'REMOVE_COMPONENT'
      );
      if (!hasRemoveComponent) {
        errors.push('Turn to face rule missing REMOVE_COMPONENT operation');
      }

      // Check for correct event dispatching namespace
      const dispatchEvents = turnToFaceRule.actions.filter(
        (action) => action.type === 'DISPATCH_EVENT'
      );
      for (const event of dispatchEvents) {
        if (
          event.parameters?.eventType &&
          event.parameters.eventType.includes('intimacy:')
        ) {
          errors.push('Turn to face rule still dispatches intimacy events');
        }
      }
    }

    console.log('✅ Rule operations are correct');
  } catch (error) {
    errors.push(`Failed to validate rule operations: ${error.message}`);
  }

  // Check positioning mod manifest
  try {
    const manifest = JSON.parse(
      await fs.readFile('data/mods/positioning/mod-manifest.json', 'utf8')
    );

    const expectedActions = [
      'turn_around.action.json',
      'turn_around_to_face.action.json',
    ];
    const expectedRules = [
      'turn_around.rule.json',
      'turn_around_to_face.rule.json',
    ];
    const expectedConditions = [
      'event-is-action-turn-around.condition.json',
      'event-is-action-turn-around-to-face.condition.json',
      'both-actors-facing-each-other.condition.json',
      'actor-is-behind-entity.condition.json',
    ];
    const expectedScopes = [
      'close_actors_facing_each_other_or_behind_target.scope',
      'actors_im_facing_away_from.scope',
    ];

    for (const action of expectedActions) {
      if (!manifest.content.actions.includes(action)) {
        errors.push(`Manifest missing action: ${action}`);
      }
    }

    for (const rule of expectedRules) {
      if (!manifest.content.rules.includes(rule)) {
        errors.push(`Manifest missing rule: ${rule}`);
      }
    }

    for (const condition of expectedConditions) {
      if (!manifest.content.conditions.includes(condition)) {
        errors.push(`Manifest missing condition: ${condition}`);
      }
    }

    for (const scope of expectedScopes) {
      if (!manifest.content.scopes.includes(scope)) {
        errors.push(`Manifest missing scope: ${scope}`);
      }
    }

    console.log('✅ Positioning mod manifest is correct');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check for remaining old references in codebase
  const patterns = [
    'data/mods/**/*.json',
    'data/mods/**/*.scope',
    'tests/**/*.js',
  ];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup'],
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        for (const oldRef of OLD_REFS) {
          if (content.includes(oldRef)) {
            // Skip backup files
            if (file.includes('.backup')) continue;

            // Skip intimacy mod files (we'll remove these later)
            if (
              file.includes('data/mods/intimacy/') &&
              (file.includes('turn_around.action.json') ||
                file.includes('turn_around_to_face.action.json') ||
                file.includes('turn_around.rule.json') ||
                file.includes('turn_around_to_face.rule.json') ||
                file.includes('event-is-action-turn-around') ||
                file.includes(
                  'close_actors_facing_each_other_or_behind_target.scope'
                ) ||
                file.includes('actors_im_facing_away_from.scope'))
            ) {
              continue;
            }

            errors.push(`${file} still contains ${oldRef}`);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  // Check test files have been updated
  try {
    const testPath =
      'tests/integration/mods/positioning/turn_around_to_face_action.test.js';
    const testContent = await fs.readFile(testPath, 'utf8');

    if (testContent.includes('intimacy:turn_around_to_face')) {
      errors.push('Test file still references intimacy namespace');
    }

    if (!testContent.includes('positioning:turn_around_to_face')) {
      errors.push('Test file missing positioning namespace reference');
    }

    console.log('✅ Test files have been updated');
  } catch (error) {
    errors.push(`Failed to validate test files: ${error.message}`);
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Turn around migration validation passed!');
    console.log('Migration is complete and ready for testing.');
  }
}

validateMigration().catch(console.error);
