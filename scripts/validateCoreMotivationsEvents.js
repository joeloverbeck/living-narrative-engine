#!/usr/bin/env node

/**
 * @file Manual validation script for core motivations events
 * This script validates that the core motivations events can be loaded and dispatched correctly
 */

/* eslint-env node */

import ValidatedEventDispatcher from '../src/events/validatedEventDispatcher.js';
import EventDefinitionLoader from '../src/loaders/eventDefinitionLoader.js';
import { ensureValidLogger } from '../src/utils/loggerUtils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 *
 */
async function validateCoreMotivationsEvents() {
  console.log('🔍 Validating Core Motivations Events...\n');

  const logger = ensureValidLogger(console);
  const eventDispatcher = new ValidatedEventDispatcher({ logger });
  const eventLoader = new EventDefinitionLoader({ logger });

  // Define the event files to test
  const coreMotivationsEventFiles = [
    'core_motivations_generation_started.event.json',
    'core_motivations_generation_completed.event.json',
    'core_motivations_generation_failed.event.json',
    'core_motivations_stored.event.json',
    'core_motivations_deleted.event.json',
    'core_motivations_retrieved.event.json',
    'core_motivations_ui_initialized.event.json',
    'core_motivations_direction_selected.event.json',
  ];

  const eventsDir = path.join(__dirname, '../data/mods/core/events');

  let allPassed = true;
  let loadedEvents = [];

  // Test 1: Load all event definitions
  console.log('📋 Test 1: Loading event definitions...');
  for (const eventFile of coreMotivationsEventFiles) {
    const eventPath = path.join(eventsDir, eventFile);

    try {
      // Check if file exists
      if (!fs.existsSync(eventPath)) {
        console.error(`❌ ${eventFile}: File not found`);
        allPassed = false;
        continue;
      }

      // Load event definition
      const eventDef = await eventLoader.loadEventDefinition(eventPath);
      eventDispatcher.registerEventDefinition(eventDef);

      // Verify expected event ID
      const expectedId = 'core:' + eventFile.replace('.event.json', '');
      if (eventDef.id !== expectedId) {
        console.error(
          `❌ ${eventFile}: Expected ID '${expectedId}', got '${eventDef.id}'`
        );
        allPassed = false;
      } else {
        console.log(
          `✅ ${eventFile}: Loaded successfully (ID: ${eventDef.id})`
        );
        loadedEvents.push(eventDef);
      }
    } catch (error) {
      console.error(`❌ ${eventFile}: Failed to load - ${error.message}`);
      allPassed = false;
    }
  }

  // Test 2: Dispatch test events
  console.log('\n🚀 Test 2: Dispatching test events...');

  const testEvents = [
    {
      type: 'core:core_motivations_generation_started',
      payload: { conceptId: 'test', directionId: 'test' },
    },
    {
      type: 'core:core_motivations_generation_completed',
      payload: { conceptId: 'test', directionId: 'test', motivationIds: [] },
    },
    {
      type: 'core:core_motivations_generation_failed',
      payload: { conceptId: 'test', directionId: 'test', error: 'test' },
    },
    {
      type: 'core:core_motivations_stored',
      payload: { directionId: 'test', motivationIds: [], count: 0 },
    },
    {
      type: 'core:core_motivations_deleted',
      payload: { directionId: 'test', motivationId: 'test', remainingCount: 0 },
    },
    {
      type: 'core:core_motivations_retrieved',
      payload: { directionId: 'test', count: 0 },
    },
    {
      type: 'core:core_motivations_ui_initialized',
      payload: { conceptId: 'test', eligibleDirectionsCount: 0 },
    },
    {
      type: 'core:core_motivations_direction_selected',
      payload: { directionId: 'test', conceptId: 'test' },
    },
  ];

  let dispatched = 0;
  for (const event of testEvents) {
    try {
      const result = eventDispatcher.dispatch(event);
      if (result !== false) {
        console.log(`✅ ${event.type}: Dispatched successfully`);
        dispatched++;
      } else {
        console.error(`❌ ${event.type}: Dispatch failed`);
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ ${event.type}: Dispatch error - ${error.message}`);
      allPassed = false;
    }
  }

  // Test 3: Check mod manifest registration
  console.log('\n📜 Test 3: Checking mod manifest registration...');
  const manifestPath = path.join(
    __dirname,
    '../data/mods/core/mod-manifest.json'
  );

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    let allEventsRegistered = true;
    for (const eventFile of coreMotivationsEventFiles) {
      if (!manifest.content.events.includes(eventFile)) {
        console.error(`❌ ${eventFile}: Not registered in mod manifest`);
        allEventsRegistered = false;
        allPassed = false;
      } else {
        console.log(`✅ ${eventFile}: Registered in mod manifest`);
      }
    }

    if (allEventsRegistered) {
      console.log('✅ All events properly registered in mod manifest');
    }
  } catch (error) {
    console.error(`❌ Failed to check mod manifest: ${error.message}`);
    allPassed = false;
  }

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log(
    `Events loaded: ${loadedEvents.length}/${coreMotivationsEventFiles.length}`
  );
  console.log(`Events dispatched: ${dispatched}/${testEvents.length}`);

  if (allPassed) {
    console.log('🎉 All Core Motivations events validated successfully!');
    process.exit(0);
  } else {
    console.log(
      '💥 Some validations failed. Check the output above for details.'
    );
    process.exit(1);
  }
}

// Run the validation
validateCoreMotivationsEvents().catch((error) => {
  console.error('💥 Validation script failed:', error);
  process.exit(1);
});
