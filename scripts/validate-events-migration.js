#!/usr/bin/env node

/**
 * @file Validates positioning events migration
 * @description Ensures all events have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';

const MIGRATED_EVENTS = [
  'actor_turned_around',
  'actor_faced_forward',
  'actor_faced_everyone',
];

/**
 *
 */
async function validateMigration() {
  console.log('🔍 Validating positioning events migration...\n');

  const errors = [];

  // Check new event files exist and are correct
  for (const eventName of MIGRATED_EVENTS) {
    const filePath = `data/mods/positioning/events/${eventName}.event.json`;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const event = JSON.parse(content);

      // Check ID is updated
      if (event.id !== `positioning:${eventName}`) {
        errors.push(`${eventName} has wrong ID: ${event.id}`);
      }

      // Check payloadSchema structure (not payload)
      if (!event.payloadSchema || !event.payloadSchema.properties) {
        errors.push(`${eventName} missing payloadSchema structure`);
      }

      console.log(`✅ ${eventName} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${eventName}: ${error.message}`);
    }
  }

  // Check positioning mod manifest includes all events
  try {
    const manifestContent = await fs.readFile(
      'data/mods/positioning/mod-manifest.json',
      'utf8'
    );
    const manifest = JSON.parse(manifestContent);

    for (const eventName of MIGRATED_EVENTS) {
      const fileName = `${eventName}.event.json`;
      if (!manifest.content.events.includes(fileName)) {
        errors.push(`Positioning manifest missing ${fileName}`);
      }
    }

    console.log('✅ Positioning mod manifest updated');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check old event files are removed
  for (const eventName of MIGRATED_EVENTS) {
    const oldPath = `data/mods/intimacy/events/${eventName}.event.json`;
    try {
      await fs.access(oldPath);
      console.log(`⚠️  Warning: Old event file still exists: ${eventName}`);
    } catch {
      console.log(`✅ Old event file removed: ${eventName}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Events migration validation passed!');
  }
}

validateMigration().catch(console.error);