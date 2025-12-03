/**
 * @file Integration tests for visual properties across all mods
 * Verifies that all action files have proper visual properties with correct color schemes
 */

const { describe, it, expect, beforeAll } = require('@jest/globals');
const { promises: fs } = require('fs');
const path = require('path');

// Expected color schemes for each mod (WCAG AA compliant)
const EXPECTED_COLOR_SCHEMES = {
  core: {
    backgroundColor: '#455a64', // Updated to match current actions
    textColor: '#ffffff',
    hoverBackgroundColor: '#37474f',
    hoverTextColor: '#ffffff',
  },
  deference: {
    backgroundColor: '#1f2d3d',
    textColor: '#f7f9ff',
    hoverBackgroundColor: '#152133',
    hoverTextColor: '#e8edf7',
  },
  clothing: {
    backgroundColor: '#6d4c41',
    textColor: '#ffffff',
    hoverBackgroundColor: '#795548',
    hoverTextColor: '#efebe9',
  },
  affection: {
    backgroundColor: '#6a1b9a',
    textColor: '#f3e5f5',
    hoverBackgroundColor: '#8e24aa',
    hoverTextColor: '#ffffff',
  },
  positioning: {
    backgroundColor: '#bf360c', // Updated to match current actions
    textColor: '#ffffff',
    hoverBackgroundColor: '#8d2c08', // Updated to match current actions
    hoverTextColor: '#ffffff',
  },
  sex: {
    backgroundColor: '#4a148c', // Updated to match current actions
    textColor: '#e1bee7', // Updated to match current actions
    hoverBackgroundColor: '#6a1b9a', // Updated to match current actions
    hoverTextColor: '#f3e5f5',
  },
  violence: {
    backgroundColor: '#8b0000', // Updated to match current actions
    textColor: '#ffffff',
    hoverBackgroundColor: '#b71c1c', // Updated to match current actions
    hoverTextColor: '#ffebee', // Updated to match current actions
  },
};

// WCAG 2.1 AA minimum contrast ratio
const MIN_CONTRAST_RATIO = 4.5;

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
 * Load all action files from a mod
 *
 * @param {string} modName - Name of the mod
 * @returns {Promise<Array>} Array of action objects with file info
 */
async function loadModActions(modName) {
  const modPath = path.join(
    __dirname,
    '../../../data/mods',
    modName,
    'actions'
  );

  try {
    await fs.access(modPath);
  } catch {
    return []; // No actions directory
  }

  const files = await fs.readdir(modPath);
  const actionFiles = files.filter((f) => f.endsWith('.action.json'));

  const actions = [];
  for (const file of actionFiles) {
    const filePath = path.join(modPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const action = JSON.parse(content);
    actions.push({
      ...action,
      _file: file,
      _mod: modName,
    });
  }

  return actions;
}

describe('Visual Properties - All Mods Integration', () => {
  let allActions;

  beforeAll(async () => {
    // Load all actions from all mods
    allActions = {};
    const mods = Object.keys(EXPECTED_COLOR_SCHEMES);

    for (const mod of mods) {
      allActions[mod] = await loadModActions(mod);
    }
  });

  describe('Visual Property Presence', () => {
    it('should have visual properties on all production actions', () => {
      const actionsWithoutVisual = [];

      for (const [mod, actions] of Object.entries(allActions)) {
        for (const action of actions) {
          if (!action.visual) {
            actionsWithoutVisual.push(`${mod}:${action._file}`);
          }
        }
      }

      expect(actionsWithoutVisual).toEqual([]);
    });

    it('should have all required visual property fields', () => {
      const incompleteActions = [];

      for (const [mod, actions] of Object.entries(allActions)) {
        for (const action of actions) {
          if (action.visual) {
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
              incompleteActions.push({
                action: `${mod}:${action._file}`,
                missingFields,
              });
            }
          }
        }
      }

      expect(incompleteActions).toEqual([]);
    });
  });

  describe('Color Scheme Consistency', () => {
    it.each(Object.keys(EXPECTED_COLOR_SCHEMES))(
      'should use correct color scheme for %s mod',
      (modName) => {
        const expectedScheme = EXPECTED_COLOR_SCHEMES[modName];
        const actions = allActions[modName] || [];

        for (const action of actions) {
          if (action.visual) {
            expect(action.visual).toEqual(expectedScheme);
          }
        }
      }
    );
  });

  describe('Color Format Validation', () => {
    it('should use valid hex color codes', () => {
      const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      const invalidColors = [];

      for (const [mod, actions] of Object.entries(allActions)) {
        for (const action of actions) {
          if (action.visual) {
            const colors = [
              action.visual.backgroundColor,
              action.visual.textColor,
              action.visual.hoverBackgroundColor,
              action.visual.hoverTextColor,
            ];

            for (const color of colors) {
              if (color && !hexPattern.test(color)) {
                invalidColors.push({
                  action: `${mod}:${action._file}`,
                  invalidColor: color,
                });
              }
            }
          }
        }
      }

      expect(invalidColors).toEqual([]);
    });
  });

  describe('Accessibility - WCAG 2.1 AA Compliance', () => {
    it('should meet minimum contrast ratio for normal state', () => {
      const lowContrastActions = [];

      for (const [mod, actions] of Object.entries(allActions)) {
        for (const action of actions) {
          if (action.visual) {
            const ratio = getContrastRatio(
              action.visual.backgroundColor,
              action.visual.textColor
            );

            if (ratio < MIN_CONTRAST_RATIO) {
              lowContrastActions.push({
                action: `${mod}:${action._file}`,
                ratio: ratio.toFixed(2),
                required: MIN_CONTRAST_RATIO,
              });
            }
          }
        }
      }

      expect(lowContrastActions).toEqual([]);
    });

    it('should meet minimum contrast ratio for hover state', () => {
      const lowContrastActions = [];

      for (const [mod, actions] of Object.entries(allActions)) {
        for (const action of actions) {
          if (action.visual) {
            const ratio = getContrastRatio(
              action.visual.hoverBackgroundColor,
              action.visual.hoverTextColor
            );

            if (ratio < MIN_CONTRAST_RATIO) {
              lowContrastActions.push({
                action: `${mod}:${action._file}`,
                ratio: ratio.toFixed(2),
                required: MIN_CONTRAST_RATIO,
              });
            }
          }
        }
      }

      expect(lowContrastActions).toEqual([]);
    });
  });

  // Removed Special Cases section as berserker_rage action no longer exists

  describe('Statistics', () => {
    it('should report visual property coverage statistics', () => {
      const stats = {};
      let totalActions = 0;
      let actionsWithVisual = 0;

      for (const [mod, actions] of Object.entries(allActions)) {
        const modStats = {
          total: actions.length,
          withVisual: actions.filter((a) => a.visual).length,
        };

        stats[mod] = modStats;
        totalActions += modStats.total;
        actionsWithVisual += modStats.withVisual;
      }

      // Log statistics for visibility
      console.log('\n📊 Visual Properties Coverage:');
      console.log('================================');
      for (const [mod, modStats] of Object.entries(stats)) {
        const percentage = modStats.total
          ? ((modStats.withVisual / modStats.total) * 100).toFixed(1)
          : '0.0';
        console.log(
          `${mod.padEnd(12)}: ${modStats.withVisual}/${
            modStats.total
          } (${percentage}%)`
        );
      }
      console.log('--------------------------------');
      const totalPercentage = totalActions
        ? ((actionsWithVisual / totalActions) * 100).toFixed(1)
        : '0.0';
      console.log(
        `${'TOTAL'.padEnd(12)}: ${actionsWithVisual}/${totalActions} (${totalPercentage}%)`
      );

      // All actions should have visual properties
      expect(actionsWithVisual).toBe(totalActions);
    });
  });
});
