#!/usr/bin/env node

/**
 * @file Validation script to verify visual properties and contrast ratios
 * Checks all action files for WCAG 2.1 AA compliance
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WCAG 2.1 AA standards
const WCAG_AA_NORMAL_TEXT = 4.5;
const WCAG_AAA_NORMAL_TEXT = 7.0;

// Color utility functions
/**
 * Calculate relative luminance of a color
 *
 * @param {string} hex - Hex color code
 * @returns {number} Relative luminance
 */
function getLuminance(hex) {
  // Remove # if present
  const rgb = hex.replace('#', '');

  // Convert to RGB values
  const r = parseInt(rgb.substr(0, 2), 16) / 255;
  const g = parseInt(rgb.substr(2, 2), 16) / 255;
  const b = parseInt(rgb.substr(4, 2), 16) / 255;

  // Apply gamma correction
  const gammaCorrect = (value) => {
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rLinear = gammaCorrect(r);
  const gLinear = gammaCorrect(g);
  const bLinear = gammaCorrect(b);

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 *
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @returns {number} Contrast ratio
 */
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG compliance level based on contrast ratio
 *
 * @param {number} ratio - Contrast ratio
 * @returns {string} Compliance level
 */
function getComplianceLevel(ratio) {
  if (ratio >= WCAG_AAA_NORMAL_TEXT) {
    return 'AAA';
  } else if (ratio >= WCAG_AA_NORMAL_TEXT) {
    return 'AA';
  } else {
    return 'FAIL';
  }
}

/**
 * Format contrast ratio with compliance indicator
 *
 * @param {number} ratio - Contrast ratio
 * @returns {string} Formatted string
 */
function formatContrast(ratio) {
  const level = getComplianceLevel(ratio);
  const emoji = level === 'AAA' ? '🌟' : level === 'AA' ? '✅' : '❌';
  return `${ratio.toFixed(2)}:1 ${emoji} ${level}`;
}

class VisualContrastValidator {
  constructor() {
    this.results = {
      total: 0,
      withVisual: 0,
      withoutVisual: 0,
      passing: 0,
      failing: 0,
      byMod: {},
      issues: [],
    };
  }

  /**
   * Validate a single action file
   *
   * @param {string} filePath - Path to action file
   * @param {string} modName - Name of the mod
   */
  async validateActionFile(filePath, modName) {
    const fileName = path.basename(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const action = JSON.parse(content);

      this.results.total++;

      if (!action.visual) {
        this.results.withoutVisual++;
        this.results.issues.push({
          type: 'missing',
          mod: modName,
          file: fileName,
          action: action.id,
          message: 'No visual properties defined',
        });
        return;
      }

      this.results.withVisual++;

      // Check required fields
      const requiredFields = [
        'backgroundColor',
        'textColor',
        'hoverBackgroundColor',
        'hoverTextColor',
      ];

      const missingFields = requiredFields.filter(
        (field) => !action.visual[field]
      );

      if (missingFields.length > 0) {
        this.results.issues.push({
          type: 'incomplete',
          mod: modName,
          file: fileName,
          action: action.id,
          message: `Missing fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Validate color format
      const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      for (const [field, value] of Object.entries(action.visual)) {
        if (!hexPattern.test(value)) {
          this.results.issues.push({
            type: 'invalid_format',
            mod: modName,
            file: fileName,
            action: action.id,
            message: `Invalid color format for ${field}: ${value}`,
          });
          return;
        }
      }

      // Check contrast ratios
      const normalRatio = getContrastRatio(
        action.visual.backgroundColor,
        action.visual.textColor
      );
      const hoverRatio = getContrastRatio(
        action.visual.hoverBackgroundColor,
        action.visual.hoverTextColor
      );

      const normalPass = normalRatio >= WCAG_AA_NORMAL_TEXT;
      const hoverPass = hoverRatio >= WCAG_AA_NORMAL_TEXT;

      if (!normalPass) {
        this.results.issues.push({
          type: 'contrast_fail',
          mod: modName,
          file: fileName,
          action: action.id,
          message: `Normal state contrast too low: ${normalRatio.toFixed(
            2
          )}:1 (minimum: ${WCAG_AA_NORMAL_TEXT}:1)`,
        });
      }

      if (!hoverPass) {
        this.results.issues.push({
          type: 'contrast_fail',
          mod: modName,
          file: fileName,
          action: action.id,
          message: `Hover state contrast too low: ${hoverRatio.toFixed(
            2
          )}:1 (minimum: ${WCAG_AA_NORMAL_TEXT}:1)`,
        });
      }

      if (normalPass && hoverPass) {
        this.results.passing++;
      } else {
        this.results.failing++;
      }

      // Store detailed results for mod
      if (!this.results.byMod[modName]) {
        this.results.byMod[modName] = {
          actions: [],
          avgNormalContrast: 0,
          avgHoverContrast: 0,
        };
      }

      this.results.byMod[modName].actions.push({
        id: action.id,
        normalContrast: normalRatio,
        hoverContrast: hoverRatio,
        normalLevel: getComplianceLevel(normalRatio),
        hoverLevel: getComplianceLevel(hoverRatio),
      });
    } catch (error) {
      this.results.issues.push({
        type: 'error',
        mod: modName,
        file: fileName,
        message: error.message,
      });
    }
  }

  /**
   * Process all actions in a mod
   *
   * @param {string} modName - Name of the mod
   */
  async validateMod(modName) {
    const modPath = path.join(__dirname, '../data/mods', modName, 'actions');

    try {
      await fs.access(modPath);
    } catch {
      return; // No actions directory
    }

    const files = await fs.readdir(modPath);
    const actionFiles = files.filter((f) => f.endsWith('.action.json'));

    for (const file of actionFiles) {
      const filePath = path.join(modPath, file);
      await this.validateActionFile(filePath, modName);
    }

    // Calculate averages for mod
    if (this.results.byMod[modName]?.actions.length > 0) {
      const actions = this.results.byMod[modName].actions;
      const avgNormal =
        actions.reduce((sum, a) => sum + a.normalContrast, 0) / actions.length;
      const avgHover =
        actions.reduce((sum, a) => sum + a.hoverContrast, 0) / actions.length;

      this.results.byMod[modName].avgNormalContrast = avgNormal;
      this.results.byMod[modName].avgHoverContrast = avgHover;
    }
  }

  /**
   * Generate and print the validation report
   */
  generateReport() {
    console.log('\n🎨 Visual Properties Contrast Validation Report');
    console.log('=================================================\n');

    // Overall summary
    console.log('📊 Overall Summary');
    console.log('------------------');
    console.log(`Total Actions: ${this.results.total}`);
    console.log(`With Visual Properties: ${this.results.withVisual}`);
    console.log(`Without Visual Properties: ${this.results.withoutVisual}`);
    console.log(`Passing WCAG AA: ${this.results.passing}`);
    console.log(`Failing WCAG AA: ${this.results.failing}`);

    const coverage = this.results.total
      ? ((this.results.withVisual / this.results.total) * 100).toFixed(1)
      : '0.0';
    console.log(`Coverage: ${coverage}%`);

    // Mod-by-mod breakdown
    console.log('\n📦 Mod Breakdown');
    console.log('----------------');

    for (const [modName, modData] of Object.entries(this.results.byMod)) {
      if (modData.actions.length > 0) {
        console.log(`\n${modName.toUpperCase()} MOD:`);
        console.log(
          `  Average Normal Contrast: ${formatContrast(
            modData.avgNormalContrast
          )}`
        );
        console.log(
          `  Average Hover Contrast: ${formatContrast(
            modData.avgHoverContrast
          )}`
        );

        // Show individual actions if verbose
        if (process.argv.includes('--verbose')) {
          modData.actions.forEach((action) => {
            console.log(`    ${action.id}:`);
            console.log(
              `      Normal: ${formatContrast(action.normalContrast)}`
            );
            console.log(`      Hover: ${formatContrast(action.hoverContrast)}`);
          });
        }
      }
    }

    // Issues
    if (this.results.issues.length > 0) {
      console.log('\n⚠️  Issues Found');
      console.log('----------------');

      const issuesByType = {};
      this.results.issues.forEach((issue) => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push(issue);
      });

      for (const [type, issues] of Object.entries(issuesByType)) {
        console.log(`\n${type.toUpperCase().replace('_', ' ')}:`);
        issues.forEach((issue) => {
          console.log(`  ${issue.mod}/${issue.file}: ${issue.message}`);
        });
      }
    } else {
      console.log('\n✅ No Issues Found!');
    }

    // Recommendations
    console.log('\n💡 Recommendations');
    console.log('------------------');

    if (this.results.withoutVisual > 0) {
      console.log(
        `• Add visual properties to ${this.results.withoutVisual} actions`
      );
    }

    if (this.results.failing > 0) {
      console.log(
        `• Fix contrast ratios for ${this.results.failing} actions to meet WCAG AA`
      );
    }

    const aaaCount = Object.values(this.results.byMod).reduce((sum, mod) => {
      return (
        sum +
        mod.actions.filter(
          (a) => a.normalLevel === 'AAA' && a.hoverLevel === 'AAA'
        ).length
      );
    }, 0);

    if (aaaCount > 0) {
      console.log(`• ${aaaCount} actions already meet WCAG AAA standards! 🌟`);
    }

    return this.results.issues.length === 0;
  }

  /**
   * Discover all mods that contain action files
   *
   * @returns {Promise<string[]>} Array of mod names with actions
   */
  async discoverModsWithActions() {
    const modsPath = path.join(__dirname, '../data/mods');
    const mods = [];

    try {
      const entries = await fs.readdir(modsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const actionsPath = path.join(modsPath, entry.name, 'actions');
          try {
            // Check if actions directory exists and contains .action.json files
            await fs.access(actionsPath);
            const files = await fs.readdir(actionsPath);
            const hasActionFiles = files.some((f) =>
              f.endsWith('.action.json')
            );

            if (hasActionFiles) {
              mods.push(entry.name);
            }
          } catch {
            // No actions directory or it's not accessible - skip this mod
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error discovering mods:', error);
      process.exit(1);
    }

    return mods.sort(); // Sort alphabetically for consistent output
  }

  /**
   * Parse command-line arguments for include/exclude filters
   *
   * @returns {{include: string[], exclude: string[]}} Filter options
   */
  parseFilterOptions() {
    const args = process.argv.slice(2);
    const options = {
      include: [],
      exclude: [],
    };

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--include' && args[i + 1]) {
        options.include = args[i + 1].split(',').map((s) => s.trim());
        i++;
      } else if (args[i] === '--exclude' && args[i + 1]) {
        options.exclude = args[i + 1].split(',').map((s) => s.trim());
        i++;
      }
    }

    return options;
  }

  /**
   * Filter mods based on command-line options
   *
   * @param {string[]} mods - All discovered mods
   * @param {{include: string[], exclude: string[]}} options - Filter options
   * @returns {string[]} Filtered mod list
   */
  filterMods(mods, options) {
    let filtered = mods;

    if (options.include.length > 0) {
      filtered = filtered.filter((mod) => options.include.includes(mod));
    }

    if (options.exclude.length > 0) {
      filtered = filtered.filter((mod) => !options.exclude.includes(mod));
    }

    return filtered;
  }

  /**
   * Run the validation
   */
  async run() {
    // Check for --list-mods option
    if (process.argv.includes('--list-mods')) {
      const allMods = await this.discoverModsWithActions();
      console.log('Mods with actions:');
      allMods.forEach((mod) => console.log(`  - ${mod}`));
      process.exit(0);
    }

    // Discover all mods with actions
    const allMods = await this.discoverModsWithActions();

    if (allMods.length === 0) {
      console.log('No mods with actions found.');
      process.exit(0);
    }

    // Apply filters
    const options = this.parseFilterOptions();
    const mods = this.filterMods(allMods, options);

    if (mods.length === 0) {
      console.log('No mods to check after applying filters.');
      process.exit(0);
    }

    console.log(`Checking ${mods.length} mod(s): ${mods.join(', ')}\n`);

    for (const mod of mods) {
      await this.validateMod(mod);
    }

    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Help text
if (process.argv.includes('--help')) {
  console.log(`
Usage: node validateVisualContrast.js [options]

Options:
  --verbose          Show detailed action-by-action contrast ratios
  --include <mods>   Only check specified mods (comma-separated)
  --exclude <mods>   Skip specified mods (comma-separated)
  --list-mods        List all mods with actions and exit
  --help             Show this help message

This script validates visual properties and contrast ratios for all action files
across all mods that contain actions. It checks for WCAG 2.1 AA compliance 
(4.5:1 minimum contrast ratio).

Examples:
  node validateVisualContrast.js                        # Check all mods
  node validateVisualContrast.js --verbose              # Show detailed output
  node validateVisualContrast.js --include core,intimacy # Check only specific mods
  node validateVisualContrast.js --exclude violence     # Skip specific mods
  node validateVisualContrast.js --list-mods            # List available mods
`);
  process.exit(0);
}

// Run the validator
const validator = new VisualContrastValidator();
validator.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
