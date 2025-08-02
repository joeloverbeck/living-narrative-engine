#!/usr/bin/env node

/**
 * @file Updates all test file references to facing_away component
 * @description Updates all test files to use positioning:facing_away instead of intimacy:facing_away
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';

const OLD_COMPONENT_ID = 'intimacy:facing_away';
const NEW_COMPONENT_ID = 'positioning:facing_away';

/**
 *
 */
async function updateTestFiles() {
  console.log('🔄 Updating test file references...\n');

  // Find all test files that reference the old component
  const testFiles = await glob('tests/**/*.js', {
    ignore: ['**/node_modules/**', '**/coverage/**'],
  });

  let updatedCount = 0;

  for (const testFile of testFiles) {
    try {
      const content = await fs.readFile(testFile, 'utf8');

      if (content.includes(OLD_COMPONENT_ID)) {
        const updatedContent = content.replace(
          new RegExp(OLD_COMPONENT_ID, 'g'),
          NEW_COMPONENT_ID
        );
        await fs.writeFile(testFile, updatedContent, 'utf8');
        console.log(`✅ Updated ${testFile}`);
        updatedCount++;
      }
    } catch (error) {
      console.log(`❌ Failed to update ${testFile}: ${error.message}`);
    }
  }

  console.log(`\n📊 Updated ${updatedCount} test files`);
}

updateTestFiles().catch(console.error);
