#!/usr/bin/env node

/**
 * Script to update all TargetResolutionService test files to use the new mock helper
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  '../tests/unit/actions/targetResolutionService.branches.test.js',
  '../tests/unit/actions/targetResolutionService.missingBranches.test.js',
  '../tests/unit/actions/targetResolutionService.errorPaths.test.js',
  '../tests/unit/actions/targetResolutionService.missingCoverage.test.js',
  '../tests/unit/actions/targetResolutionService.scope-loading.test.js',
  '../tests/unit/actions/targetResolutionServiceValidation.test.js',
  '../tests/unit/actions/followActionTargetResolutionFix.test.js',
  '../tests/unit/actions/targetResolutionService.additionalCoverage.test.js',
  '../tests/unit/actions/targetResolutionService.completeCoverage.test.js',
];

/**
 *
 * @param filePath
 */
async function updateTestFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Check if file already imports the helper
    if (content.includes('createTargetResolutionServiceWithMocks')) {
      console.log(`Skipping ${path.basename(filePath)} - already updated`);
      return;
    }

    // Add import for the helper if not present
    if (!content.includes('mockUnifiedScopeResolver')) {
      const importRegex =
        /(import[\s\S]*?from\s+['"].*?targetResolutionService\.js['"];?)/;
      const match = content.match(importRegex);
      if (match) {
        const newImport = `${match[0]}\nimport { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';`;
        content = content.replace(match[0], newImport);
      }
    }

    // Replace all occurrences of new TargetResolutionService with the helper
    content = content.replace(
      /new\s+TargetResolutionService\s*\(/g,
      'createTargetResolutionServiceWithMocks('
    );

    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

/**
 *
 */
async function main() {
  console.log('Updating TargetResolutionService test files...\n');

  for (const testFile of testFiles) {
    const fullPath = path.resolve(__dirname, testFile);
    await updateTestFile(fullPath);
  }

  console.log('\nDone! Now run the tests to verify everything works.');
}

main().catch(console.error);
