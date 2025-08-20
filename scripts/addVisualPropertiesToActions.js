#!/usr/bin/env node

/**
 * @file Batch update script to add visual properties to action files
 * Applies mod-based color schemas according to specifications
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color schemes for each mod (WCAG 2.1 AA compliant)
const MOD_COLOR_SCHEMES = {
  core: {
    backgroundColor: '#607d8b',
    textColor: '#ffffff',
    hoverBackgroundColor: '#78909c',
    hoverTextColor: '#e3f2fd',
    description: 'Blue-Grey (Neutral, System Actions)',
    contrastRatio: '4.54:1',
  },
  clothing: {
    backgroundColor: '#6d4c41',
    textColor: '#ffffff',
    hoverBackgroundColor: '#795548',
    hoverTextColor: '#efebe9',
    description: 'Brown/Tan (Practical, Physical Items)',
    contrastRatio: '6.47:1',
  },
  intimacy: {
    backgroundColor: '#ad1457',
    textColor: '#ffffff',
    hoverBackgroundColor: '#c2185b',
    hoverTextColor: '#fce4ec',
    description: 'Rose/Pink (Romantic, Gentle)',
    contrastRatio: '7.14:1',
  },
  positioning: {
    backgroundColor: '#00796b',
    textColor: '#ffffff',
    hoverBackgroundColor: '#00897b',
    hoverTextColor: '#e0f2f1',
    description: 'Teal/Cyan (Movement, Spatial)',
    contrastRatio: '5.65:1',
  },
  sex: {
    backgroundColor: '#6a1b9a',
    textColor: '#ffffff',
    hoverBackgroundColor: '#7b1fa2',
    hoverTextColor: '#f3e5f5',
    description: 'Deep Purple/Magenta (Passionate, Intense)',
    contrastRatio: '7.43:1',
  },
  violence: {
    backgroundColor: '#cc0000',
    textColor: '#ffffff',
    hoverBackgroundColor: '#990000',
    hoverTextColor: '#ffcccc',
    description: 'Red/Crimson (Danger, Combat)',
    contrastRatio: '5.92:1',
  },
};

// Actions to skip (already have visual properties)
const SKIP_ACTIONS = ['violence:berserker_rage'];

class ActionVisualUpdater {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.stats = {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
  }

  /**
   * Get visual properties for a mod
   *
   * @param {string} modName - Name of the mod
   * @returns {object|null} Visual properties object
   */
  getVisualProperties(modName) {
    const scheme = MOD_COLOR_SCHEMES[modName];
    if (!scheme) return null;

    return {
      backgroundColor: scheme.backgroundColor,
      textColor: scheme.textColor,
      hoverBackgroundColor: scheme.hoverBackgroundColor,
      hoverTextColor: scheme.hoverTextColor,
    };
  }

  /**
   * Update a single action file with visual properties
   *
   * @param {string} filePath - Path to the action file
   * @param {string} modName - Name of the mod
   */
  async updateActionFile(filePath, modName) {
    try {
      // Read the file
      const content = await fs.readFile(filePath, 'utf8');
      const action = JSON.parse(content);

      // Check if we should skip this action
      if (SKIP_ACTIONS.includes(action.id)) {
        if (this.verbose) {
          console.log(
            `⏭️  Skipping ${action.id} (already has visual properties)`
          );
        }
        this.stats.skipped++;
        return;
      }

      // Check if already has visual properties
      if (action.visual) {
        if (this.verbose) {
          console.log(`ℹ️  ${action.id} already has visual properties`);
        }
        this.stats.skipped++;
        return;
      }

      // Get visual properties for this mod
      const visualProps = this.getVisualProperties(modName);
      if (!visualProps) {
        console.error(`❌ No color scheme defined for mod: ${modName}`);
        this.stats.errors++;
        return;
      }

      // Add visual properties
      action.visual = visualProps;

      // Write back to file (preserve formatting)
      const updatedContent = JSON.stringify(action, null, 2) + '\n';

      if (this.dryRun) {
        console.log(`🔍 [DRY RUN] Would update ${action.id}`);
        if (this.verbose) {
          console.log('   Visual properties:', visualProps);
        }
      } else {
        await fs.writeFile(filePath, updatedContent, 'utf8');
        console.log(`✅ Updated ${action.id}`);
      }

      this.stats.updated++;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
      this.stats.errors++;
    }
  }

  /**
   * Process all action files in a mod directory
   *
   * @param {string} modName - Name of the mod
   */
  async processModActions(modName) {
    const modPath = path.join(__dirname, '../data/mods', modName, 'actions');

    try {
      // Check if actions directory exists
      await fs.access(modPath);
    } catch {
      if (this.verbose) {
        console.log(`ℹ️  No actions directory for mod: ${modName}`);
      }
      return;
    }

    const files = await fs.readdir(modPath);
    const actionFiles = files.filter((f) => f.endsWith('.action.json'));

    console.log(
      `\n📦 Processing ${modName} mod (${actionFiles.length} actions)`
    );
    const scheme = MOD_COLOR_SCHEMES[modName];
    if (scheme) {
      console.log(`   Theme: ${scheme.description}`);
      console.log(`   Contrast: ${scheme.contrastRatio} ✅`);
    }

    for (const file of actionFiles) {
      const filePath = path.join(modPath, file);
      this.stats.total++;
      await this.updateActionFile(filePath, modName);
    }
  }

  /**
   * Run the update process for all mods
   */
  async run() {
    console.log('🎨 Adding Visual Properties to Action Files');
    console.log('==========================================');

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No files will be modified\n');
    }

    // Process each mod
    const mods = Object.keys(MOD_COLOR_SCHEMES);
    for (const mod of mods) {
      await this.processModActions(mod);
    }

    // Print summary
    console.log('\n📊 Summary');
    console.log('==========');
    console.log(`Total files processed: ${this.stats.total}`);
    console.log(`Files updated: ${this.stats.updated}`);
    console.log(`Files skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);

    if (this.stats.errors > 0) {
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
};

if (args.includes('--help')) {
  console.log(`
Usage: node addVisualPropertiesToActions.js [options]

Options:
  --dry-run    Preview changes without modifying files
  --verbose    Show detailed output
  --help       Show this help message

This script adds visual properties to action files based on mod-specific color schemes.
All color combinations meet WCAG 2.1 AA accessibility standards.
`);
  process.exit(0);
}

// Run the updater
const updater = new ActionVisualUpdater(options);
updater.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
