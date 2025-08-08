#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACTIONS_DIR = path.join(__dirname, '../data/mods/intimacy/actions');
const errors = [];
const warnings = [];

// Known valid component IDs
const VALID_COMPONENTS = new Set([
  'positioning:closeness',
  'positioning:facing_away',
  'intimacy:kissing',
  'anatomy:mouth',
  'clothing:torso_upper',
  // Add more as we discover them
]);

/**
 *
 */
async function validateIntegrity() {
  console.log('🔍 Starting Intimacy Actions Integrity Validation\n');

  const files = await fs.readdir(ACTIONS_DIR);
  const actionFiles = files.filter((f) => f.endsWith('.action.json'));

  console.log(`Found ${actionFiles.length} action files to validate\n`);

  for (const file of actionFiles) {
    const filePath = path.join(ACTIONS_DIR, file);
    let content;

    try {
      content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (err) {
      errors.push(`Failed to parse ${file}: ${err.message}`);
      continue;
    }

    const expectedId = `intimacy:${file.replace('.action.json', '')}`;

    // Check ID matches filename
    if (content.id !== expectedId) {
      errors.push(
        `ID mismatch in ${file}: expected ${expectedId}, got ${content.id}`
      );
    }

    // Check targets exists (all actions should have it now)
    if (!content.targets) {
      errors.push(`Missing targets in ${file}`);
    }

    // Check no root-level scope remains
    if (content.scope) {
      errors.push(`Legacy scope still exists at root level in ${file}`);
    }

    // Check template placeholders
    if (content.template) {
      // Check for multi-target format
      if (
        typeof content.targets === 'object' &&
        !Array.isArray(content.targets)
      ) {
        // Multi-target action
        const hasPlaceholders = [];
        if (
          content.targets.primary &&
          !content.template.includes('{primary}')
        ) {
          errors.push(
            `Template missing {primary} placeholder in ${file}: "${content.template}"`
          );
        }
        if (
          content.targets.secondary &&
          !content.template.includes('{secondary}')
        ) {
          errors.push(
            `Template missing {secondary} placeholder in ${file}: "${content.template}"`
          );
        }
        if (
          content.targets.tertiary &&
          !content.template.includes('{tertiary}')
        ) {
          errors.push(
            `Template missing {tertiary} placeholder in ${file}: "${content.template}"`
          );
        }
      } else {
        // Single-target action - should have {target}
        if (!content.template.includes('{target}')) {
          errors.push(
            `Template missing {target} placeholder in ${file}: "${content.template}"`
          );
        }
      }
    } else {
      warnings.push(`No template defined in ${file}`);
    }

    // Check required components
    if (content.required_components) {
      for (const [entity, components] of Object.entries(
        content.required_components
      )) {
        for (const comp of components) {
          if (!VALID_COMPONENTS.has(comp)) {
            // Not an error, just a warning - we may not know all valid components
            warnings.push(
              `Unknown required component ${comp} in ${file} (entity: ${entity}) - may need to add to valid list`
            );
          }
        }
      }
    }

    // Check forbidden components
    if (content.forbidden_components) {
      for (const [entity, components] of Object.entries(
        content.forbidden_components
      )) {
        for (const comp of components) {
          if (!VALID_COMPONENTS.has(comp)) {
            warnings.push(
              `Unknown forbidden component ${comp} in ${file} (entity: ${entity}) - may need to add to valid list`
            );
          }
        }
      }
    }

    // Check prerequisites format
    if (content.prerequisites && !Array.isArray(content.prerequisites)) {
      errors.push(`Prerequisites must be an array in ${file}`);
    }
  }

  // Check for duplicate IDs
  const ids = new Map();
  for (const file of actionFiles) {
    const filePath = path.join(ACTIONS_DIR, file);
    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (ids.has(content.id)) {
        errors.push(
          `Duplicate ID ${content.id} found in ${file} and ${ids.get(content.id)}`
        );
      } else {
        ids.set(content.id, file);
      }
    } catch (err) {
      // Already reported above
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════\n');

  console.log(`✅ Actions validated: ${actionFiles.length}`);
  console.log(`❌ Errors found: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}\n`);

  if (errors.length > 0) {
    console.error('❌ ERRORS:');
    errors.forEach((e) => console.error(`  - ${e}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.warn('⚠️  WARNINGS:');
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.log();
  }

  if (errors.length === 0) {
    console.log('✅ All integrity checks passed!');
    process.exit(0);
  } else {
    console.error('❌ Validation failed with errors');
    process.exit(1);
  }
}

validateIntegrity().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
