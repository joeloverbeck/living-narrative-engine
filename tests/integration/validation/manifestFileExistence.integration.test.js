/**
 * @file Integration test to validate that all files referenced in mod manifests actually exist
 * @description Prevents runtime 404 errors by ensuring manifest integrity
 */

/* global process */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

/**
 * Reads a mod manifest file
 *
 * @param {string} modPath - Path to mod directory
 * @returns {Promise<object>} Parsed manifest
 */
async function readManifest(modPath) {
  const manifestPath = path.join(modPath, 'mod-manifest.json');
  const content = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Gets all mod directories in data/mods
 *
 * @returns {Promise<string[]>} Array of mod directory names
 */
async function getModDirectories() {
  const modsDir = path.join(process.cwd(), 'data', 'mods');
  const entries = await fs.readdir(modsDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * Validates that all files in a content category exist
 *
 * @param {string} modId - Mod identifier
 * @param {string} category - Content category (actions, rules, conditions, etc.)
 * @param {string[]} files - Array of filenames
 * @returns {Promise<{missing: string[], category: string}>}
 */
async function validateContentCategory(modId, category, files) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return { missing: [], category };
  }

  const modPath = path.join(process.cwd(), 'data', 'mods', modId);
  const categoryPath = path.join(modPath, category);

  const missing = [];

  for (const file of files) {
    const filePath = path.join(categoryPath, file);
    try {
      await fs.access(filePath);
    } catch {
      missing.push(file);
    }
  }

  return { missing, category };
}

describe('Manifest File Existence Validation', () => {
  it('should validate all manifest file references exist on disk', async () => {
    const modDirs = await getModDirectories();
    const allIssues = [];

    for (const modId of modDirs) {
      const modPath = path.join(process.cwd(), 'data', 'mods', modId);

      let manifest;
      try {
        manifest = await readManifest(modPath);
      } catch {
        // Skip mods without manifests or with invalid JSON
        continue;
      }

      const content = manifest.content || {};
      const categories = [
        'actions',
        'rules',
        'conditions',
        'components',
        'scopes',
        'entities'
      ];

      for (const category of categories) {
        const files = content[category];
        if (!files) continue;

        const { missing } = await validateContentCategory(modId, category, files);

        if (missing.length > 0) {
          allIssues.push({
            modId,
            category,
            missing
          });
        }
      }
    }

    // Build detailed error message if issues found
    if (allIssues.length > 0) {
      const errorMessages = allIssues.map(issue => {
        const fileList = issue.missing.map(f => `    - ${f}`).join('\n');
        return `\n  Mod: ${issue.modId}\n  Category: ${issue.category}\n  Missing files:\n${fileList}`;
      });

      throw new Error(`Manifest references files that don't exist:${errorMessages.join('\n')}`);
    }

    // If we get here, all files exist
    expect(allIssues).toHaveLength(0);
  }, 30000); // 30 second timeout for filesystem operations

  it('should detect underscore vs hyphen mismatches', async () => {
    const modDirs = await getModDirectories();
    const namingIssues = [];

    for (const modId of modDirs) {
      const modPath = path.join(process.cwd(), 'data', 'mods', modId);

      let manifest;
      try {
        manifest = await readManifest(modPath);
      } catch {
        continue;
      }

      const content = manifest.content || {};
      const categories = ['actions', 'rules', 'conditions', 'components', 'scopes', 'entities'];

      for (const category of categories) {
        const files = content[category];
        if (!files || !Array.isArray(files)) continue;

        for (const file of files) {
          // Check if file contains underscores
          if (file.includes('_')) {
            // Check if hyphenated version exists instead
            const hyphenatedFile = file.replace(/_/g, '-');
            const originalPath = path.join(modPath, category, file);
            const hyphenatedPath = path.join(modPath, category, hyphenatedFile);

            try {
              await fs.access(originalPath);
              // Original exists, no issue
            } catch {
              // Original doesn't exist, check if hyphenated version does
              try {
                await fs.access(hyphenatedPath);
                namingIssues.push({
                  modId,
                  category,
                  manifestRef: file,
                  actualFile: hyphenatedFile,
                  issue: 'Manifest uses underscores but file uses hyphens'
                });
              } catch {
                // Neither exists, will be caught by main test
              }
            }
          }
        }
      }
    }

    if (namingIssues.length > 0) {
      const errorMessages = namingIssues.map(issue =>
        `\n  Mod: ${issue.modId}\n  Category: ${issue.category}\n  Manifest ref: ${issue.manifestRef}\n  Actual file: ${issue.actualFile}\n  Issue: ${issue.issue}`
      );

      throw new Error(`Naming convention mismatches found:${errorMessages.join('\n')}`);
    }

    expect(namingIssues).toHaveLength(0);
  }, 30000);
});
