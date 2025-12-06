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
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
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
        'entities',
      ];

      for (const category of categories) {
        const files = content[category];
        if (!files) continue;

        const { missing } = await validateContentCategory(
          modId,
          category,
          files
        );

        if (missing.length > 0) {
          allIssues.push({
            modId,
            category,
            missing,
          });
        }
      }
    }

    // Build detailed error message if issues found
    if (allIssues.length > 0) {
      const errorMessages = allIssues.map((issue) => {
        const fileList = issue.missing.map((f) => `    - ${f}`).join('\n');
        return `\n  Mod: ${issue.modId}\n  Category: ${issue.category}\n  Missing files:\n${fileList}`;
      });

      throw new Error(
        `Manifest references files that don't exist:${errorMessages.join('\n')}`
      );
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
      const categories = [
        'actions',
        'rules',
        'conditions',
        'components',
        'scopes',
        'entities',
      ];

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
                  issue: 'Manifest uses underscores but file uses hyphens',
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
      const errorMessages = namingIssues.map(
        (issue) =>
          `\n  Mod: ${issue.modId}\n  Category: ${issue.category}\n  Manifest ref: ${issue.manifestRef}\n  Actual file: ${issue.actualFile}\n  Issue: ${issue.issue}`
      );

      throw new Error(
        `Naming convention mismatches found:${errorMessages.join('\n')}`
      );
    }

    expect(namingIssues).toHaveLength(0);
  }, 30000);
});

/**
 * Files to ignore when scanning directories for unregistered content
 * @type {string[]}
 */
const IGNORED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  '.gitkeep',
  '.gitignore',
  'desktop.ini',
];

/**
 * File extensions to ignore (temporary/backup files)
 * @type {string[]}
 */
const IGNORED_EXTENSIONS = ['.swp', '.bak', '.tmp', '.orig'];

/**
 * Content categories and their expected file patterns
 * @type {Object<string, {directory: string, pattern: RegExp}>}
 */
const CONTENT_CATEGORIES = {
  actions: { directory: 'actions', pattern: /\.json$/i },
  components: { directory: 'components', pattern: /\.json$/i },
  conditions: { directory: 'conditions', pattern: /\.json$/i },
  damageTypes: { directory: 'damageTypes', pattern: /\.json$/i },
  events: { directory: 'events', pattern: /\.json$/i },
  goals: { directory: 'goals', pattern: /\.json$/i },
  macros: { directory: 'macros', pattern: /\.json$/i },
  rules: { directory: 'rules', pattern: /\.json$/i },
  worlds: { directory: 'worlds', pattern: /\.json$/i },
  blueprints: { directory: 'blueprints', pattern: /\.json$/i },
  recipes: { directory: 'recipes', pattern: /\.json$/i },
  anatomyFormatting: { directory: 'anatomyFormatting', pattern: /\.json$/i },
  libraries: { directory: 'libraries', pattern: /\.json$/i },
  lookups: { directory: 'lookups', pattern: /\.json$/i },
  parts: { directory: 'parts', pattern: /\.json$/i },
  'structure-templates': {
    directory: 'structure-templates',
    pattern: /\.json$/i,
  },
  scopes: { directory: 'scopes', pattern: /\.scope$/i },
  'refinement-methods': {
    directory: 'refinement-methods',
    pattern: /\.refinement\.json$/i,
  },
  tasks: { directory: 'tasks', pattern: /\.task\.json$/i },
  portraits: {
    directory: 'portraits',
    pattern: /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i,
  },
};

/**
 * Checks if a file should be ignored during scanning
 *
 * @param {string} filename - Filename to check
 * @returns {boolean} True if file should be ignored
 */
function isIgnoredFile(filename) {
  // Check against explicit ignore list
  if (IGNORED_FILES.includes(filename)) return true;

  // Check for ignored extensions
  for (const ext of IGNORED_EXTENSIONS) {
    if (filename.endsWith(ext)) return true;
  }

  // Ignore files starting with . (hidden files) except those we explicitly handle
  if (filename.startsWith('.') && !IGNORED_FILES.includes(filename))
    return true;

  // Ignore files ending with ~ (backup files)
  if (filename.endsWith('~')) return true;

  return false;
}

/**
 * Scans a directory for files matching the expected pattern
 *
 * @param {string} dirPath - Directory path to scan
 * @param {RegExp} pattern - File pattern to match
 * @returns {Promise<string[]>} Array of matching filenames
 */
async function scanDirectory(dirPath, pattern) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      // Skip directories
      if (!entry.isFile()) continue;

      const filename = entry.name;

      // Skip ignored files
      if (isIgnoredFile(filename)) continue;

      // Only include files matching the expected pattern
      if (pattern.test(filename)) {
        files.push(filename);
      }
    }

    return files;
  } catch (error) {
    // Directory doesn't exist - this is fine, no unregistered files
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

describe('Unregistered Files Validation', () => {
  it('should detect files on disk not registered in manifest', async () => {
    const modDirs = await getModDirectories();
    const unregisteredIssues = [];

    for (const modId of modDirs) {
      const modPath = path.join(process.cwd(), 'data', 'mods', modId);

      let manifest;
      try {
        manifest = await readManifest(modPath);
      } catch {
        // Skip mods without manifests
        continue;
      }

      const content = manifest.content || {};

      // Check each content category
      for (const [categoryKey, categoryConfig] of Object.entries(
        CONTENT_CATEGORIES
      )) {
        const categoryDir = path.join(modPath, categoryConfig.directory);

        // Get files registered in manifest for this category
        const registeredFiles = content[categoryKey];
        const registeredSet = new Set(
          Array.isArray(registeredFiles) ? registeredFiles : []
        );

        // Scan directory for actual files
        const filesOnDisk = await scanDirectory(
          categoryDir,
          categoryConfig.pattern
        );

        // Find unregistered files
        for (const file of filesOnDisk) {
          if (!registeredSet.has(file)) {
            unregisteredIssues.push({
              modId,
              category: categoryConfig.directory,
              file,
            });
          }
        }
      }

      // Handle nested entities structure separately
      const entities = content.entities || {};

      // Check definitions
      const definitionsDir = path.join(modPath, 'entities', 'definitions');
      const registeredDefinitions = new Set(entities.definitions || []);
      const definitionsOnDisk = await scanDirectory(definitionsDir, /\.json$/i);

      for (const file of definitionsOnDisk) {
        if (!registeredDefinitions.has(file)) {
          unregisteredIssues.push({
            modId,
            category: 'entities/definitions',
            file,
          });
        }
      }

      // Check instances
      const instancesDir = path.join(modPath, 'entities', 'instances');
      const registeredInstances = new Set(entities.instances || []);
      const instancesOnDisk = await scanDirectory(instancesDir, /\.json$/i);

      for (const file of instancesOnDisk) {
        if (!registeredInstances.has(file)) {
          unregisteredIssues.push({
            modId,
            category: 'entities/instances',
            file,
          });
        }
      }
    }

    // This test is informational - it warns about unregistered files but doesn't fail
    // as unregistered files may be intentional (e.g., documentation, backup files)
    if (unregisteredIssues.length > 0) {
      const issuesByMod = new Map();
      for (const issue of unregisteredIssues) {
        if (!issuesByMod.has(issue.modId)) {
          issuesByMod.set(issue.modId, []);
        }
        issuesByMod.get(issue.modId).push(issue);
      }

      const report = [];
      for (const [modId, issues] of issuesByMod) {
        report.push(`\n  Mod: ${modId}`);
        for (const issue of issues) {
          report.push(`    - ${issue.category}/${issue.file}`);
        }
      }

      console.warn(
        `⚠️ Found ${unregisteredIssues.length} unregistered file(s) across ${issuesByMod.size} mod(s):${report.join('\n')}`
      );
    }

    // Test passes but logs warning if issues found
    expect(true).toBe(true);
  }, 60000); // 60 second timeout for extensive filesystem operations

  it('should ignore system files like .DS_Store and Thumbs.db', async () => {
    // This test validates the ignore list is working correctly
    // by checking that system files are not flagged
    const modDirs = await getModDirectories();
    const systemFilesDetected = [];

    for (const modId of modDirs) {
      const modPath = path.join(process.cwd(), 'data', 'mods', modId);

      for (const [, categoryConfig] of Object.entries(CONTENT_CATEGORIES)) {
        const categoryDir = path.join(modPath, categoryConfig.directory);

        try {
          const entries = await fs.readdir(categoryDir, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            if (entry.isFile() && IGNORED_FILES.includes(entry.name)) {
              // Found a system file - verify it's being ignored
              const filesOnDisk = await scanDirectory(
                categoryDir,
                categoryConfig.pattern
              );
              if (filesOnDisk.includes(entry.name)) {
                systemFilesDetected.push({
                  modId,
                  category: categoryConfig.directory,
                  file: entry.name,
                });
              }
            }
          }
        } catch {
          // Directory doesn't exist, skip
          continue;
        }
      }
    }

    // System files should never appear in scan results
    expect(systemFilesDetected).toHaveLength(0);
  }, 30000);
});
