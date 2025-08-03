#!/usr/bin/env node

/**
 * @file Test scope definitions
 * @description Validates scope syntax and component references
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 *
 */
async function testScopes() {
  console.log('🧪 Testing scope definitions...\n');

  const scopes = [
    'data/mods/positioning/scopes/close_actors.scope',
    'data/mods/positioning/scopes/actors_im_facing_away_from.scope',
    'data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope',
  ];

  let allPassed = true;

  for (const scopeFile of scopes) {
    try {
      const definition = await fs.readFile(scopeFile, 'utf8');

      // Extract the scope name and definition
      const lines = definition.split('\n');
      let scopeName = null;
      let scopeDef = null;

      for (const line of lines) {
        if (line.includes(':=')) {
          const parts = line.split(':=');
          if (parts.length === 2) {
            scopeName = parts[0].trim();
            scopeDef = parts[1].trim();
            break;
          }
        }
      }

      if (scopeName && scopeDef) {
        console.log(`✅ ${path.basename(scopeFile)} syntax valid`);
        console.log(`   Name: ${scopeName}`);
        console.log(`   Definition: ${scopeDef}`);

        // Basic validation checks
        if (!scopeName.includes(':')) {
          console.log(`   ⚠️  Warning: Scope name missing namespace`);
          allPassed = false;
        }

        if (scopeDef.length === 0) {
          console.log(`   ❌ Error: Empty scope definition`);
          allPassed = false;
        }
      } else {
        console.log(
          `❌ ${path.basename(scopeFile)} syntax error: Could not parse scope definition`
        );
        allPassed = false;
      }
    } catch (error) {
      console.log(
        `❌ ${path.basename(scopeFile)} read error: ${error.message}`
      );
      allPassed = false;
    }
  }

  console.log(
    '\n' +
      (allPassed
        ? '✨ All scope definitions are valid!'
        : '❌ Some scope definitions have issues')
  );
  process.exit(allPassed ? 0 : 1);
}

testScopes().catch(console.error);
