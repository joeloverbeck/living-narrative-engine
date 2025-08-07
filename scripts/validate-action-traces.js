#!/usr/bin/env node

/**
 * @file Validates action traces for intimacy actions migration
 * @description Ensures all intimacy actions are being traced correctly
 */

import { promises as fs } from 'fs';
import path from 'path';

const TRACE_DIR = './traces/intmig-migration';
const EXPECTED_ACTIONS = [
  'intimacy:accept_kiss_passively',
  'intimacy:break_kiss_gently',
  'intimacy:brush_hand',
  'intimacy:cup_face_while_kissing',
  'intimacy:explore_mouth_with_tongue',
  'intimacy:feel_arm_muscles',
  'intimacy:fondle_ass',
  'intimacy:kiss_back_passionately',
  'intimacy:kiss_cheek',
  'intimacy:kiss_neck_sensually',
  'intimacy:lean_in_for_deep_kiss',
  'intimacy:lick_lips',
  'intimacy:massage_back',
  'intimacy:massage_shoulders',
  'intimacy:nibble_earlobe_playfully',
  'intimacy:nibble_lower_lip',
  'intimacy:nuzzle_face_into_neck',
  'intimacy:peck_on_lips',
  'intimacy:place_hand_on_waist',
  'intimacy:pull_back_breathlessly',
  'intimacy:pull_back_in_revulsion',
  'intimacy:suck_on_neck_to_leave_hickey',
  'intimacy:suck_on_tongue',
  'intimacy:thumb_wipe_cheek',
];

/**
 *
 */
async function validateTraces() {
  console.log('🔍 Validating intimacy action traces...\n');

  // Check if trace directory exists
  try {
    await fs.access(TRACE_DIR);
  } catch {
    console.log(`ℹ️  Trace directory does not exist: ${TRACE_DIR}`);
    console.log(
      "No traces to validate yet. This is expected if actions haven't been used."
    );
    console.log(
      'Action tracing will create files when intimacy actions are executed.\n'
    );
    return;
  }

  const traceFiles = await fs.readdir(TRACE_DIR);

  if (traceFiles.length === 0) {
    console.log('ℹ️  No trace files found yet.');
    console.log(
      'Trace files will be created when intimacy actions are executed.\n'
    );
    return;
  }

  const tracedActions = new Set();
  const errors = [];

  console.log(`Found ${traceFiles.length} trace file(s)\n`);

  for (const file of traceFiles) {
    try {
      const filePath = path.join(TRACE_DIR, file);
      const content = await fs.readFile(filePath, 'utf8');
      const trace = JSON.parse(content);

      // Validate trace structure
      if (!trace.timestamp || !trace.actionId || !trace.eventPayload) {
        errors.push(`Invalid trace structure in ${file}`);
        continue;
      }

      // Track which actions have been traced
      if (trace.actionId && trace.actionId.startsWith('intimacy:')) {
        tracedActions.add(trace.actionId);
        console.log(`✅ Found trace for: ${trace.actionId}`);
      }
    } catch (error) {
      errors.push(`Failed to parse ${file}: ${error.message}`);
    }
  }

  // Report on traced vs expected actions
  const missing = EXPECTED_ACTIONS.filter((a) => !tracedActions.has(a));

  console.log('\n=== Trace Validation Summary ===\n');
  console.log(
    `Actions traced: ${tracedActions.size}/${EXPECTED_ACTIONS.length}`
  );

  if (missing.length > 0) {
    console.log('\nActions not yet traced (will be traced when used):');
    missing.forEach((action) => console.log(`  - ${action}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors found:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else if (tracedActions.size === EXPECTED_ACTIONS.length) {
    console.log('\n✨ All expected intimacy actions have been traced!');
  } else {
    console.log(
      '\n✅ Trace validation passed. More traces will be created as actions are used.'
    );
  }
}

validateTraces().catch(console.error);
