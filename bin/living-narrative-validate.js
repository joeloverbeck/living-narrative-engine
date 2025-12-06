#!/usr/bin/env node

/**
 * @file NPX executable wrapper for the mod validation CLI tool
 * @description Enables global installation and usage via npx
 *
 * Usage:
 *   npx living-narrative-validate [OPTIONS]
 *   ln-validate [OPTIONS]  (shorthand alias)
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamically import the main validation script
const { main } = await import(join(__dirname, '../scripts/validateMods.js'));

// Execute the main function
main();
