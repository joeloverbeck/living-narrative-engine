#!/usr/bin/env node
/**
 * @file Migration script for perceptionType values
 *
 * Migrates legacy snake_case perception types to new dotted notation format.
 * Uses context-aware mapping for generic types (action_self_general, action_target_general)
 * based on mod folder to determine appropriate new type.
 *
 * Usage:
 *   node scripts/migratePerceptionTypes.js --dry-run   # Preview changes
 *   node scripts/migratePerceptionTypes.js             # Apply changes
 *   node scripts/migratePerceptionTypes.js --report    # Generate migration report only
 *
 * @see specs/perceptionType-consolidation.md
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODS_DIR = path.join(PROJECT_ROOT, 'data', 'mods');

// ============================================================================
// LEGACY TYPE MAPPINGS
// ============================================================================

/**
 * Direct 1:1 mappings for legacy types to new format
 */
const DIRECT_MAPPINGS = {
  // Communication
  'speech_local': 'communication.speech',
  'thought_internal': 'communication.thought',
  'notes_jotted': 'communication.notes',

  // Movement
  'character_enter': 'movement.arrival',
  'character_exit': 'movement.departure',
  'dimensional_arrival': 'movement.arrival',
  'dimensional_departure': 'movement.departure',

  // Combat
  'combat_attack': 'combat.attack',
  'combat_effect': 'combat.damage',
  'damage_received': 'combat.damage',
  'entity_died': 'combat.death',

  // Item
  'item_pickup': 'item.pickup',
  'item_picked_up': 'item.pickup',
  'item_pickup_failed': 'error.action_failed',
  'item_drop': 'item.drop',
  'item_dropped': 'item.drop',
  'item_transfer': 'item.transfer',
  'item_transfer_failed': 'error.action_failed',
  'item_use': 'item.use',
  'item_examined': 'item.examine',
  'item_read': 'item.examine',

  // Container
  'container_opened': 'container.open',
  'container_open_failed': 'error.action_failed',
  'item_taken_from_container': 'container.take',
  'take_from_container_failed': 'error.action_failed',
  'item_taken_from_nearby_surface': 'container.take',
  'take_from_nearby_surface_failed': 'error.action_failed',
  'item_put_in_container': 'container.put',
  'put_in_container_failed': 'error.action_failed',
  'item_put_on_nearby_surface': 'container.put',
  'put_on_nearby_surface_failed': 'error.action_failed',

  // Connection
  'connection_locked': 'connection.lock',
  'connection_lock_failed': 'error.action_failed',
  'connection_unlocked': 'connection.unlock',
  'connection_unlock_failed': 'error.action_failed',

  // Consumption
  'drink_consumed': 'consumption.consume',
  'food_consumed': 'consumption.consume',
  'liquid_consumed': 'consumption.consume',
  'liquid_consumed_entirely': 'consumption.consume',

  // State
  'state_change_observable': 'state.observable_change',
  'rest_action': 'state.observable_change',

  // Error
  'error': 'error.system_error',
};

/**
 * Context-aware mappings for action_self_general and action_target_general
 * Based on mod folder name patterns
 */
const CONTEXT_MAPPINGS = {
  // Performance
  'music': 'performance.music',
  'ballet': 'performance.dance',
  'gymnastics': 'performance.dance',
  'dance': 'performance.dance',

  // Combat
  'weapons': 'combat.attack',
  'ranged': 'combat.attack',
  'violence': 'combat.violence',
  'melee': 'combat.attack',

  // Intimacy
  'sex': 'intimacy.sexual',
  'intimacy': 'intimacy.sensual',
  'seduction': 'intimacy.sensual',

  // Magic
  'warding': 'magic.spell',
  'hexing': 'magic.spell',
  'magic': 'magic.spell',
  'ritual': 'magic.ritual',

  // Social
  'hugging': 'social.affection',
  'hand-holding': 'social.affection',
  'affection': 'social.affection',
  'kissing': 'social.affection',
  'caressing': 'social.affection',

  // Positioning defaults to physical
  'positioning': 'physical.target_action',
  'deference': 'physical.target_action',
  'recovery': 'physical.self_action',
  'movement': 'movement.arrival',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Walk directory recursively and find JSON files
 * @param {string} dirPath
 * @param {string[]} extensions
 * @returns {string[]}
 */
function walkDirectory(dirPath, extensions = ['.json']) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(walkDirectory(fullPath, extensions));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Determine mod folder from file path
 * @param {string} filePath
 * @returns {string}
 */
function getModFolder(filePath) {
  const relative = path.relative(MODS_DIR, filePath);
  const parts = relative.split(path.sep);
  return parts[0] || '';
}

/**
 * Get new type for a generic type based on context
 * @param {string} legacyType
 * @param {string} modFolder
 * @returns {string}
 */
function getContextAwareMapping(legacyType, modFolder) {
  // Check for context-specific mapping
  const folderLower = modFolder.toLowerCase();

  for (const [pattern, newType] of Object.entries(CONTEXT_MAPPINGS)) {
    if (folderLower.includes(pattern)) {
      return newType;
    }
  }

  // Default fallback based on type
  if (legacyType === 'action_self_general') {
    return 'physical.self_action';
  }
  return 'physical.target_action';
}

/**
 * Get new type for a legacy type
 * @param {string} legacyType
 * @param {string} filePath
 * @returns {string|null}
 */
function getNewType(legacyType, filePath) {
  // Check direct mapping first
  if (DIRECT_MAPPINGS[legacyType]) {
    return DIRECT_MAPPINGS[legacyType];
  }

  // Context-aware mapping for generic types
  if (legacyType === 'action_self_general' || legacyType === 'action_target_general') {
    const modFolder = getModFolder(filePath);
    return getContextAwareMapping(legacyType, modFolder);
  }

  // Already in new format or unknown
  return null;
}

/**
 * Check if type is a new dotted format
 * @param {string} type
 * @returns {boolean}
 */
function isNewFormat(type) {
  return type && type.includes('.');
}

/**
 * Find all perception_type occurrences in JSON content
 * @param {object} obj
 * @param {string} filePath
 * @returns {Array<{path: string, oldType: string, newType: string}>}
 */
function findPerceptionTypes(obj, filePath, currentPath = '') {
  const results = [];

  if (obj === null || typeof obj !== 'object') {
    return results;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...findPerceptionTypes(obj[i], filePath, `${currentPath}[${i}]`));
    }
    return results;
  }

  for (const [key, value] of Object.entries(obj)) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;

    if (key === 'perception_type' && typeof value === 'string') {
      if (!isNewFormat(value)) {
        const newType = getNewType(value, filePath);
        if (newType) {
          results.push({
            path: newPath,
            oldType: value,
            newType: newType,
          });
        }
      }
    } else if (typeof value === 'object') {
      results.push(...findPerceptionTypes(value, filePath, newPath));
    }
  }

  return results;
}

/**
 * Apply migrations to JSON content
 * @param {object} obj
 * @param {Array<{path: string, oldType: string, newType: string}>} migrations
 * @returns {object}
 */
function applyMigrations(obj, migrations) {
  // Deep clone
  const result = JSON.parse(JSON.stringify(obj));

  for (const migration of migrations) {
    const pathParts = migration.path.split(/\.|\[(\d+)\]/).filter(Boolean);
    let current = result;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!isNaN(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }

    const lastPart = pathParts[pathParts.length - 1];
    if (!isNaN(lastPart)) {
      current[parseInt(lastPart, 10)] = migration.newType;
    } else {
      current[lastPart] = migration.newType;
    }
  }

  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reportOnly = args.includes('--report');

  console.log('='.repeat(70));
  console.log('Perception Type Migration Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : reportOnly ? 'REPORT ONLY' : 'APPLY CHANGES'}`);
  console.log('');

  // Find all JSON files in mods directory
  const files = walkDirectory(MODS_DIR);
  console.log(`Found ${files.length} JSON files in mods directory`);
  console.log('');

  const allMigrations = [];
  const filesByMod = {};

  // Process each file
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);
      const migrations = findPerceptionTypes(json, filePath);

      if (migrations.length > 0) {
        const modFolder = getModFolder(filePath);
        const relativePath = path.relative(PROJECT_ROOT, filePath);

        if (!filesByMod[modFolder]) {
          filesByMod[modFolder] = [];
        }

        filesByMod[modFolder].push({
          file: relativePath,
          migrations: migrations,
        });

        allMigrations.push({
          file: relativePath,
          fullPath: filePath,
          content: json,
          migrations: migrations,
        });
      }
    } catch (err) {
      console.error(`Error processing ${filePath}: ${err.message}`);
    }
  }

  // Print summary by mod
  console.log('Migration Summary by Mod:');
  console.log('-'.repeat(70));

  const modFolders = Object.keys(filesByMod).sort();
  for (const mod of modFolders) {
    const modMigrations = filesByMod[mod];
    const totalChanges = modMigrations.reduce((sum, f) => sum + f.migrations.length, 0);
    console.log(`\n${mod}: ${modMigrations.length} files, ${totalChanges} changes`);

    if (dryRun || reportOnly) {
      for (const fileInfo of modMigrations) {
        console.log(`  ${fileInfo.file}`);
        for (const m of fileInfo.migrations) {
          console.log(`    ${m.oldType} → ${m.newType}`);
        }
      }
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`Total: ${allMigrations.length} files, ${allMigrations.reduce((sum, f) => sum + f.migrations.length, 0)} changes`);
  console.log('');

  // Type change statistics
  const typeStats = {};
  for (const item of allMigrations) {
    for (const m of item.migrations) {
      const key = `${m.oldType} → ${m.newType}`;
      typeStats[key] = (typeStats[key] || 0) + 1;
    }
  }

  console.log('Type Change Statistics:');
  console.log('-'.repeat(70));
  const sortedStats = Object.entries(typeStats).sort((a, b) => b[1] - a[1]);
  for (const [change, count] of sortedStats) {
    console.log(`  ${count.toString().padStart(4)} : ${change}`);
  }

  if (reportOnly) {
    console.log('\nReport complete (no changes applied).');
    return;
  }

  if (dryRun) {
    console.log('\nDry run complete. Run without --dry-run to apply changes.');
    return;
  }

  // Apply changes
  console.log('\nApplying changes...');
  let successCount = 0;
  let errorCount = 0;

  for (const item of allMigrations) {
    try {
      const updated = applyMigrations(item.content, item.migrations);
      const newContent = JSON.stringify(updated, null, 2) + '\n';
      fs.writeFileSync(item.fullPath, newContent, 'utf8');
      successCount++;
    } catch (err) {
      console.error(`Error updating ${item.file}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} files updated, ${errorCount} errors`);
}

main();
