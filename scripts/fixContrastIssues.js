#!/usr/bin/env node

/**
 * @file Generic script to fix contrast ratio issues for all mods
 * Analyzes failing contrasts and suggests fixes to meet WCAG 2.1 AA standards
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WCAG 2.1 AA standards
const WCAG_AA_NORMAL_TEXT = 4.5;
const TARGET_CONTRAST = 4.6; // Slightly above minimum for safety margin

// ============================================================================
// Color Manipulation Utilities
// ============================================================================

/**
 * Convert hex color to RGB
 *
 * @param {string} hex - Hex color code
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
function hexToRgb(hex) {
  const rgb = hex.replace('#', '');
  return {
    r: parseInt(rgb.substr(0, 2), 16),
    g: parseInt(rgb.substr(2, 2), 16),
    b: parseInt(rgb.substr(4, 2), 16),
  };
}

/**
 * Convert RGB to hex color
 *
 * @param {{r: number, g: number, b: number}} rgb - RGB values (0-255)
 * @returns {string} Hex color code
 */
function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to HSL
 *
 * @param {{r: number, g: number, b: number}} rgb - RGB values (0-255)
 * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s/l: 0-100)
 */
function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB
 *
 * @param {{h: number, s: number, l: number}} hsl - HSL values (h: 0-360, s/l: 0-100)
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
function hslToRgb({ h, s, l }) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Calculate relative luminance of a color
 *
 * @param {string} hex - Hex color code
 * @returns {number} Relative luminance
 */
function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  
  const gammaCorrect = (value) => {
    value = value / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rLinear = gammaCorrect(r);
  const gLinear = gammaCorrect(g);
  const bLinear = gammaCorrect(b);

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
 * Adjust color lightness to achieve target contrast
 *
 * @param {string} color - Hex color to adjust
 * @param {string} against - Color to contrast against
 * @param {number} targetRatio - Target contrast ratio
 * @param {boolean} makeLighter - Whether to make color lighter (true) or darker (false)
 * @returns {string|null} Adjusted hex color or null if impossible
 */
function adjustColorForContrast(color, against, targetRatio, makeLighter) {
  const rgb = hexToRgb(color);
  const hsl = rgbToHsl(rgb);
  
  let bestL = hsl.l;
  let bestDiff = Infinity;
  
  // Try different lightness values
  const start = makeLighter ? hsl.l : 0;
  const end = makeLighter ? 100 : hsl.l;
  const step = makeLighter ? 1 : -1;
  
  for (let l = start; makeLighter ? l <= end : l >= end; l += step) {
    const testColor = rgbToHex(hslToRgb({ ...hsl, l }));
    const ratio = getContrastRatio(testColor, against);
    
    if (ratio >= targetRatio) {
      const diff = Math.abs(ratio - targetRatio);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestL = l;
      }
      if (ratio < targetRatio + 0.5) {
        // Close enough, stop searching
        break;
      }
    }
  }
  
  if (bestDiff === Infinity) {
    return null; // Couldn't achieve target contrast
  }
  
  return rgbToHex(hslToRgb({ ...hsl, l: bestL }));
}

/**
 * Generate fix suggestions for a failing contrast
 *
 * @param {string} bgColor - Background color
 * @param {string} textColor - Text color
 * @param {number} currentRatio - Current contrast ratio
 * @returns {Array} Array of fix suggestions
 */
function generateFixSuggestions(bgColor, textColor, currentRatio) {
  const suggestions = [];
  
  // Strategy 1: Darken background
  const darkerBg = adjustColorForContrast(bgColor, textColor, TARGET_CONTRAST, false);
  if (darkerBg) {
    suggestions.push({
      strategy: 'darken-background',
      description: 'Darken background color',
      backgroundColor: darkerBg,
      textColor: textColor,
      newRatio: getContrastRatio(darkerBg, textColor),
    });
  }
  
  // Strategy 2: Lighten text
  const lighterText = adjustColorForContrast(textColor, bgColor, TARGET_CONTRAST, true);
  if (lighterText) {
    suggestions.push({
      strategy: 'lighten-text',
      description: 'Lighten text color',
      backgroundColor: bgColor,
      textColor: lighterText,
      newRatio: getContrastRatio(bgColor, lighterText),
    });
  }
  
  // Strategy 3: Darken text (sometimes works better)
  const darkerText = adjustColorForContrast(textColor, bgColor, TARGET_CONTRAST, false);
  if (darkerText) {
    suggestions.push({
      strategy: 'darken-text',
      description: 'Darken text color',
      backgroundColor: bgColor,
      textColor: darkerText,
      newRatio: getContrastRatio(bgColor, darkerText),
    });
  }
  
  // Strategy 4: Lighten background
  const lighterBg = adjustColorForContrast(bgColor, textColor, TARGET_CONTRAST, true);
  if (lighterBg) {
    suggestions.push({
      strategy: 'lighten-background',
      description: 'Lighten background color',
      backgroundColor: lighterBg,
      textColor: textColor,
      newRatio: getContrastRatio(lighterBg, textColor),
    });
  }
  
  // Strategy 5: Balanced adjustment (adjust both slightly)
  const bgHsl = rgbToHsl(hexToRgb(bgColor));
  const textHsl = rgbToHsl(hexToRgb(textColor));
  
  // Make background slightly darker and text slightly lighter
  const balancedBg = rgbToHex(hslToRgb({ ...bgHsl, l: Math.max(0, bgHsl.l - 10) }));
  const balancedText = rgbToHex(hslToRgb({ ...textHsl, l: Math.min(100, textHsl.l + 10) }));
  const balancedRatio = getContrastRatio(balancedBg, balancedText);
  
  if (balancedRatio >= WCAG_AA_NORMAL_TEXT) {
    suggestions.push({
      strategy: 'balanced',
      description: 'Balanced adjustment (both colors)',
      backgroundColor: balancedBg,
      textColor: balancedText,
      newRatio: balancedRatio,
    });
  }
  
  // Sort by how close they are to target ratio (not too high, not too low)
  suggestions.sort((a, b) => {
    const aDiff = Math.abs(a.newRatio - TARGET_CONTRAST);
    const bDiff = Math.abs(b.newRatio - TARGET_CONTRAST);
    return aDiff - bDiff;
  });
  
  return suggestions;
}

// ============================================================================
// Validation Integration
// ============================================================================

/**
 * Run validation to find all contrast issues
 *
 * @returns {Promise<object>} Validation results with issues
 */
async function runValidation() {
  // Import and use the validator class
  const { VisualContrastValidator } = await import('./validateVisualContrast.js')
    .then(module => {
      // Export the class from validateVisualContrast.js if not already exported
      return module;
    })
    .catch(() => {
      // If can't import, we'll run it as a subprocess
      return null;
    });

  if (VisualContrastValidator) {
    const validator = new VisualContrastValidator();
    
    // Discover and validate all mods
    const mods = await validator.discoverModsWithActions();
    for (const mod of mods) {
      await validator.validateMod(mod);
    }
    
    return validator.results;
  } else {
    // Fallback: parse output from running the script
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    console.log('Running validation script...');
    const { stdout } = await execAsync('node scripts/validateVisualContrast.js');
    
    // Parse the output to extract issues
    // This is a simplified parser - would need enhancement for production
    const issues = [];
    const lines = stdout.split('\n');
    
    let currentMod = null;
    for (const line of lines) {
      if (line.includes('MOD:')) {
        currentMod = line.split(' ')[0].toLowerCase();
      } else if (line.includes('contrast too low:') && currentMod) {
        // Extract file and ratio from the line
        const match = line.match(/([^/]+\.json): .* contrast too low: ([\d.]+):1/);
        if (match) {
          issues.push({
            mod: currentMod,
            file: match[1],
            type: 'contrast_fail',
            ratio: parseFloat(match[2]),
          });
        }
      }
    }
    
    return { issues };
  }
}

/**
 * Load action file and get visual properties
 *
 * @param {string} modName - Mod name
 * @param {string} fileName - Action file name
 * @returns {Promise<object>} Action data
 */
async function loadActionFile(modName, fileName) {
  const filePath = path.join(__dirname, '../data/mods', modName, 'actions', fileName);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Save action file with updated visual properties
 *
 * @param {string} modName - Mod name
 * @param {string} fileName - Action file name
 * @param {object} action - Updated action data
 */
async function saveActionFile(modName, fileName, action) {
  const filePath = path.join(__dirname, '../data/mods', modName, 'actions', fileName);
  const content = JSON.stringify(action, null, 2) + '\n';
  await fs.writeFile(filePath, content, 'utf8');
}

// ============================================================================
// Command Line Interface
// ============================================================================

/**
 * Parse command line arguments
 *
 * @returns {object} Parsed options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true, // Default to dry-run for safety
    apply: false,
    interactive: false,
    strategy: 'auto', // auto, darken-background, lighten-text, balanced
    include: [],
    exclude: [],
    verbose: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--apply':
        options.apply = true;
        options.dryRun = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        options.apply = false;
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--strategy':
        if (args[i + 1]) {
          options.strategy = args[i + 1];
          i++;
        }
        break;
      case '--include':
        if (args[i + 1]) {
          options.include = args[i + 1].split(',').map(s => s.trim());
          i++;
        }
        break;
      case '--exclude':
        if (args[i + 1]) {
          options.exclude = args[i + 1].split(',').map(s => s.trim());
          i++;
        }
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Usage: node fixContrastIssues.js [options]

Options:
  --dry-run           Preview fixes without applying (default)
  --apply             Apply fixes to files
  --interactive       Confirm each fix individually
  --strategy <type>   Fix strategy: auto, darken-background, lighten-text, balanced
  --include <mods>    Only fix specified mods (comma-separated)
  --exclude <mods>    Skip specified mods (comma-separated)
  --verbose           Show detailed information
  --help              Show this help message

This script analyzes all actions with failing contrast ratios and suggests
fixes to meet WCAG 2.1 AA standards (4.5:1 minimum contrast).

Examples:
  node fixContrastIssues.js                        # Preview all fixes
  node fixContrastIssues.js --apply                # Apply all fixes
  node fixContrastIssues.js --interactive          # Choose fixes interactively
  node fixContrastIssues.js --strategy balanced    # Use balanced adjustment
  node fixContrastIssues.js --apply --include core # Fix only core mod
`);
}

/**
 * Ask user for confirmation
 *
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>} User's answer
 */
async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question + ' (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Display a fix suggestion
 *
 * @param {object} suggestion - Fix suggestion
 * @param {object} current - Current colors
 */
function displaySuggestion(suggestion, current) {
  console.log(`  Strategy: ${suggestion.description}`);
  console.log(`    Background: ${current.backgroundColor} → ${suggestion.backgroundColor}`);
  console.log(`    Text:       ${current.textColor} → ${suggestion.textColor}`);
  console.log(`    Contrast:   ${current.ratio.toFixed(2)}:1 → ${suggestion.newRatio.toFixed(2)}:1 ✅`);
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function
 */
async function main() {
  const options = parseArgs();
  
  console.log('🎨 Generic Contrast Fixer for WCAG AA Compliance');
  console.log('=================================================\n');
  
  if (options.dryRun) {
    console.log('📋 Running in DRY-RUN mode (no files will be modified)');
    console.log('   Use --apply to actually apply fixes\n');
  }
  
  // Step 1: Run validation to find issues
  console.log('🔍 Analyzing contrast issues...\n');
  
  // For now, we'll run the validation script as a subprocess
  // since the class isn't exported from validateVisualContrast.js
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  let modIssues = {};
  
  let validationOutput = '';
  
  try {
    // Run validation and parse output
    const { stdout } = await execAsync('node scripts/validateVisualContrast.js --verbose');
    validationOutput = stdout;
  } catch (error) {
    // Script exits with code 1 when issues are found, but we still get stdout
    if (error.stdout) {
      validationOutput = error.stdout;
    } else {
      console.error('Error running validation:', error.message);
      process.exit(1);
    }
  }
  
  // Parse the output to extract detailed issues
  if (validationOutput) {
    const lines = validationOutput.split('\n');
    let currentMod = null;
    let currentAction = null;
    
    for (const line of lines) {
      // Match mod name
      if (line.match(/^[A-Z_]+ MOD:/)) {
        currentMod = line.split(' ')[0].toLowerCase();
        if (!modIssues[currentMod]) {
          modIssues[currentMod] = {};
        }
      }
      // Match action with contrast info (format: "modname:actionname:")
      else if (currentMod && line.trim().match(/^\w+:[\w_]+:$/)) {
        // Extract action ID without the trailing colon
        currentAction = line.trim().slice(0, -1);
      }
      // Match contrast values
      else if (line.includes('Normal:') && currentMod && currentAction) {
        const match = line.match(/([\d.]+):1/);
        if (match) {
          const ratio = parseFloat(match[1]);
          if (ratio < WCAG_AA_NORMAL_TEXT) {
            if (!modIssues[currentMod][currentAction]) {
              modIssues[currentMod][currentAction] = {};
            }
            modIssues[currentMod][currentAction].normalRatio = ratio;
          }
        }
      }
      else if (line.includes('Hover:') && currentMod && currentAction) {
        const match = line.match(/([\d.]+):1/);
        if (match) {
          const ratio = parseFloat(match[1]);
          if (ratio < WCAG_AA_NORMAL_TEXT) {
            if (!modIssues[currentMod][currentAction]) {
              modIssues[currentMod][currentAction] = {};
            }
            modIssues[currentMod][currentAction].hoverRatio = ratio;
          }
        }
      }
    }
  }
  
  // Filter mods based on options
  if (options.include.length > 0) {
    const filtered = {};
    for (const mod of options.include) {
      if (modIssues[mod]) {
        filtered[mod] = modIssues[mod];
      }
    }
    modIssues = filtered;
  }
  
  if (options.exclude.length > 0) {
    for (const mod of options.exclude) {
      delete modIssues[mod];
    }
  }
  
  // Check if there are any issues
  const totalIssues = Object.values(modIssues).reduce(
    (sum, mod) => sum + Object.keys(mod).length, 0
  );
  
  if (totalIssues === 0) {
    console.log('✅ No contrast issues found! All actions meet WCAG AA standards.');
    process.exit(0);
  }
  
  console.log(`Found contrast issues in ${Object.keys(modIssues).length} mod(s)\n`);
  
  // Step 2: Generate and apply fixes
  let totalFixed = 0;
  let totalSkipped = 0;
  
  for (const [modName, actions] of Object.entries(modIssues)) {
    if (Object.keys(actions).length === 0) continue;
    
    console.log(`\n📦 ${modName.toUpperCase()} MOD`);
    console.log('─'.repeat(40));
    
    for (const [actionId, issues] of Object.entries(actions)) {
      // Remove the mod prefix to get just the action name
      const actionName = actionId.split(':')[1];
      const fileName = `${actionName}.action.json`;
      
      try {
        // Load the action file
        const action = await loadActionFile(modName, fileName);
        
        if (!action.visual) {
          console.log(`  ⚠️  ${actionId}: No visual properties found`);
          totalSkipped++;
          continue;
        }
        
        console.log(`\n  🎯 ${actionId}`);
        
        let needsUpdate = false;
        const updates = {};
        
        // Fix normal state if needed
        if (issues.normalRatio) {
          console.log(`    Normal state contrast: ${issues.normalRatio.toFixed(2)}:1 ❌`);
          
          const suggestions = generateFixSuggestions(
            action.visual.backgroundColor,
            action.visual.textColor,
            issues.normalRatio
          );
          
          if (suggestions.length > 0) {
            let chosen = suggestions[0]; // Default to best suggestion
            
            if (options.interactive) {
              console.log('\n    Available fixes:');
              suggestions.forEach((s, i) => {
                console.log(`    ${i + 1}.`);
                displaySuggestion(s, {
                  backgroundColor: action.visual.backgroundColor,
                  textColor: action.visual.textColor,
                  ratio: issues.normalRatio,
                });
              });
              
              const answer = await askConfirmation('\n    Apply fix #1?');
              if (!answer) {
                console.log('    Skipped');
                totalSkipped++;
                continue;
              }
            } else if (options.strategy !== 'auto') {
              // Find matching strategy
              chosen = suggestions.find(s => s.strategy === options.strategy) || chosen;
            }
            
            if (options.verbose || !options.interactive) {
              console.log('    Selected fix:');
              displaySuggestion(chosen, {
                backgroundColor: action.visual.backgroundColor,
                textColor: action.visual.textColor,
                ratio: issues.normalRatio,
              });
            }
            
            updates.backgroundColor = chosen.backgroundColor;
            updates.textColor = chosen.textColor;
            needsUpdate = true;
          } else {
            console.log('    ⚠️  Could not generate automatic fix');
            totalSkipped++;
          }
        }
        
        // Fix hover state if needed
        if (issues.hoverRatio) {
          console.log(`    Hover state contrast: ${issues.hoverRatio.toFixed(2)}:1 ❌`);
          
          const suggestions = generateFixSuggestions(
            action.visual.hoverBackgroundColor,
            action.visual.hoverTextColor,
            issues.hoverRatio
          );
          
          if (suggestions.length > 0) {
            let chosen = suggestions[0];
            
            if (options.interactive) {
              console.log('\n    Available hover fixes:');
              suggestions.forEach((s, i) => {
                console.log(`    ${i + 1}.`);
                displaySuggestion(s, {
                  backgroundColor: action.visual.hoverBackgroundColor,
                  textColor: action.visual.hoverTextColor,
                  ratio: issues.hoverRatio,
                });
              });
              
              const answer = await askConfirmation('\n    Apply hover fix #1?');
              if (!answer) {
                console.log('    Skipped hover fix');
                continue;
              }
            } else if (options.strategy !== 'auto') {
              chosen = suggestions.find(s => s.strategy === options.strategy) || chosen;
            }
            
            if (options.verbose || !options.interactive) {
              console.log('    Selected hover fix:');
              displaySuggestion(chosen, {
                backgroundColor: action.visual.hoverBackgroundColor,
                textColor: action.visual.hoverTextColor,
                ratio: issues.hoverRatio,
              });
            }
            
            updates.hoverBackgroundColor = chosen.backgroundColor;
            updates.hoverTextColor = chosen.textColor;
            needsUpdate = true;
          } else {
            console.log('    ⚠️  Could not generate automatic hover fix');
            totalSkipped++;
          }
        }
        
        // Apply updates if needed
        if (needsUpdate && options.apply) {
          action.visual = { ...action.visual, ...updates };
          await saveActionFile(modName, fileName, action);
          console.log('    ✅ Fixed and saved');
          totalFixed++;
        } else if (needsUpdate) {
          console.log('    📋 Would be fixed (dry-run mode)');
          totalFixed++;
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing ${fileName}: ${error.message}`);
        totalSkipped++;
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('─'.repeat(50));
  console.log(`Total issues found: ${totalFixed + totalSkipped}`);
  console.log(`Fixed: ${totalFixed}`);
  console.log(`Skipped: ${totalSkipped}`);
  
  if (options.dryRun) {
    console.log('\n💡 This was a dry-run. Use --apply to apply these fixes.');
  } else {
    console.log('\n✅ Fixes applied successfully!');
    console.log('\nNext steps:');
    console.log('1. Run validation: node scripts/validateVisualContrast.js');
    console.log('2. Run tests: npm run test:integration');
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});