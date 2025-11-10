# GOAP-TIER1-004: Content Generation and Validation Tools

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 5-6
**Status:** Not Started
**Dependencies:** GOAP-TIER1-002, GOAP-TIER1-003

## Overview

Create CLI tools and scripts for generating planning effects for all actions and validating the generated effects. This includes generating effects for 100-200 actions across all mods and ensuring consistency between effects and rules.

## Objectives

1. Create effects generation CLI script
2. Create effects validation CLI script
3. Generate effects for all state-changing actions
4. Implement validation tool for effects consistency
5. Create validation reports
6. Add npm scripts for effects workflows

## Technical Details

### 1. Effects Generation Script

**File:** `scripts/generateEffects.js`

```javascript
#!/usr/bin/env node

/**
 * @file CLI script to generate planning effects for actions
 * Usage:
 *   npm run generate:effects
 *   npm run generate:effects -- --mod=positioning
 *   npm run generate:effects -- --action=positioning:sit_down
 */

import { createContainer } from '../src/dependencyInjection/containerFactory.js';
import { goapTokens } from '../src/dependencyInjection/tokens/tokens-goap.js';
import { tokens } from '../src/dependencyInjection/tokens/tokens-core.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const container = createContainer();

  const logger = container.resolve(tokens.ILogger);
  const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);
  const modsLoader = container.resolve(tokens.IModsLoader);

  try {
    // Load mods
    logger.info('Loading mods...');
    await modsLoader.load();

    if (args.action) {
      // Generate for single action
      await generateForAction(args.action, effectsGenerator, logger);
    } else if (args.mod) {
      // Generate for single mod
      await generateForMod(args.mod, effectsGenerator, logger);
    } else {
      // Generate for all mods
      await generateForAllMods(effectsGenerator, modsLoader, logger);
    }

    logger.info('✓ Effects generation complete');
    process.exit(0);
  } catch (error) {
    logger.error('✗ Effects generation failed', error);
    process.exit(1);
  }
}

async function generateForAction(actionId, effectsGenerator, logger) {
  logger.info(`Generating effects for action: ${actionId}`);

  const effects = await effectsGenerator.generateForAction(actionId);

  if (effects) {
    logger.info(`Generated ${effects.effects.length} effects`);
    logger.info(JSON.stringify(effects, null, 2));

    // Write to action file
    await writeEffectsToAction(actionId, effects, logger);
  } else {
    logger.warn('No effects generated');
  }
}

async function generateForMod(modId, effectsGenerator, logger) {
  logger.info(`Generating effects for mod: ${modId}`);

  const effectsMap = await effectsGenerator.generateForMod(modId);

  logger.info(`Generated effects for ${effectsMap.size} actions`);

  // Write effects to action files
  for (const [actionId, effects] of effectsMap.entries()) {
    await writeEffectsToAction(actionId, effects, logger);
  }
}

async function generateForAllMods(effectsGenerator, modsLoader, logger) {
  logger.info('Generating effects for all mods...');

  const modIds = modsLoader.getLoadedModIds();
  let totalActions = 0;

  for (const modId of modIds) {
    try {
      const effectsMap = await effectsGenerator.generateForMod(modId);
      totalActions += effectsMap.size;

      // Write effects to action files
      for (const [actionId, effects] of effectsMap.entries()) {
        await writeEffectsToAction(actionId, effects, logger);
      }
    } catch (error) {
      logger.error(`Failed to generate effects for mod ${modId}`, error);
    }
  }

  logger.info(`Generated effects for ${totalActions} actions across ${modIds.length} mods`);
}

async function writeEffectsToAction(actionId, effects, logger) {
  const [modId, actionName] = actionId.split(':');
  const actionFilePath = path.join(
    process.cwd(),
    'data',
    'mods',
    modId,
    'actions',
    `${actionName}.action.json`
  );

  try {
    // Read action file
    const actionContent = await fs.readFile(actionFilePath, 'utf8');
    const action = JSON.parse(actionContent);

    // Add planningEffects
    action.planningEffects = effects;

    // Write back with pretty formatting
    await fs.writeFile(
      actionFilePath,
      JSON.stringify(action, null, 2) + '\n',
      'utf8'
    );

    logger.debug(`✓ Updated ${actionFilePath}`);
  } catch (error) {
    logger.error(`Failed to write effects to ${actionFilePath}`, error);
    throw error;
  }
}

function parseArgs(argv) {
  const args = {
    mod: null,
    action: null
  };

  for (const arg of argv) {
    if (arg.startsWith('--mod=')) {
      args.mod = arg.substring(6);
    } else if (arg.startsWith('--action=')) {
      args.action = arg.substring(9);
    }
  }

  return args;
}

main();
```

### 2. Effects Validation Script

**File:** `scripts/validateEffects.js`

```javascript
#!/usr/bin/env node

/**
 * @file CLI script to validate planning effects consistency
 * Usage:
 *   npm run validate:effects
 *   npm run validate:effects -- --mod=positioning
 *   npm run validate:effects -- --report=effects-validation.json
 */

import { createContainer } from '../src/dependencyInjection/containerFactory.js';
import { goapTokens } from '../src/dependencyInjection/tokens/tokens-goap.js';
import { tokens } from '../src/dependencyInjection/tokens/tokens-core.js';
import fs from 'fs/promises';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const container = createContainer();

  const logger = container.resolve(tokens.ILogger);
  const effectsValidator = container.resolve(goapTokens.IEffectsValidator);
  const modsLoader = container.resolve(tokens.IModsLoader);

  try {
    // Load mods
    logger.info('Loading mods...');
    await modsLoader.load();

    let results;

    if (args.mod) {
      // Validate single mod
      results = await effectsValidator.validateMod(args.mod);
    } else {
      // Validate all mods
      results = await effectsValidator.validateAllMods();
    }

    // Display results
    displayResults(results, logger);

    // Write report if requested
    if (args.report) {
      await writeReport(args.report, results, logger);
    }

    // Exit with appropriate code
    const hasErrors = results.summary.errors > 0;
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    logger.error('✗ Validation failed', error);
    process.exit(1);
  }
}

function displayResults(results, logger) {
  logger.info('\\n=== Validation Results ===\\n');

  for (const result of results.actions) {
    if (result.valid) {
      logger.info(`✓ ${result.actionId} - effects match rule operations`);
    } else {
      logger.error(`✗ ${result.actionId} - ${result.errors.length} errors`);
      for (const error of result.errors) {
        logger.error(`  - ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      logger.warn(`⚠ ${result.actionId} - ${result.warnings.length} warnings`);
      for (const warning of result.warnings) {
        logger.warn(`  - ${warning.message}`);
      }
    }
  }

  logger.info('\\n=== Summary ===');
  logger.info(`Valid: ${results.summary.valid}`);
  logger.warn(`Warnings: ${results.summary.warnings}`);
  logger.error(`Errors: ${results.summary.errors}`);
  logger.info(`Total: ${results.summary.total}`);
}

async function writeReport(reportPath, results, logger) {
  try {
    await fs.writeFile(
      reportPath,
      JSON.stringify(results, null, 2),
      'utf8'
    );
    logger.info(`\\n✓ Report written to ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to write report to ${reportPath}`, error);
  }
}

function parseArgs(argv) {
  const args = {
    mod: null,
    report: null
  };

  for (const arg of argv) {
    if (arg.startsWith('--mod=')) {
      args.mod = arg.substring(6);
    } else if (arg.startsWith('--report=')) {
      args.report = arg.substring(9);
    }
  }

  return args;
}

main();
```

### 3. Effects Validator Class

**File:** `src/goap/validation/effectsValidator.js`

```javascript
/**
 * @file Effects validator for GOAP planning
 * Validates consistency between effects and rules
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

class EffectsValidator {
  #logger;
  #effectsAnalyzer;
  #actionLoader;
  #ruleLoader;

  constructor({ logger, effectsAnalyzer, actionLoader, ruleLoader }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(effectsAnalyzer, 'IEffectsAnalyzer', logger, {
      requiredMethods: ['analyzeRule']
    });
    validateDependency(actionLoader, 'IActionLoader', logger, {
      requiredMethods: ['getAction', 'getActions']
    });
    validateDependency(ruleLoader, 'IRuleLoader', logger, {
      requiredMethods: ['getRule', 'getRules']
    });

    this.#logger = logger;
    this.#effectsAnalyzer = effectsAnalyzer;
    this.#actionLoader = actionLoader;
    this.#ruleLoader = ruleLoader;
  }

  /**
   * Validates all actions across all mods
   * @returns {Promise<Object>} Validation results
   */
  async validateAllMods() {
    const results = {
      actions: [],
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0
      }
    };

    const actions = await this.#actionLoader.getAllActions();

    for (const action of actions) {
      const result = await this.validateAction(action.id);
      results.actions.push(result);

      results.summary.total++;
      if (result.valid) results.summary.valid++;
      results.summary.warnings += result.warnings.length;
      results.summary.errors += result.errors.length;
    }

    return results;
  }

  /**
   * Validates all actions in a specific mod
   * @param {string} modId - Mod identifier
   * @returns {Promise<Object>} Validation results
   */
  async validateMod(modId) {
    string.assertNonBlank(modId, 'modId', 'validateMod', this.#logger);

    const results = {
      actions: [],
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0
      }
    };

    const actions = await this.#actionLoader.getActions(modId);

    for (const action of actions) {
      const result = await this.validateAction(action.id);
      results.actions.push(result);

      results.summary.total++;
      if (result.valid) results.summary.valid++;
      results.summary.warnings += result.warnings.length;
      results.summary.errors += result.errors.length;
    }

    return results;
  }

  /**
   * Validates effects for a single action
   * @param {string} actionId - Full action ID
   * @returns {Promise<Object>} Validation result
   */
  async validateAction(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'validateAction', this.#logger);

    const result = {
      actionId,
      valid: true,
      warnings: [],
      errors: []
    };

    try {
      // Get action
      const action = await this.#actionLoader.getAction(actionId);
      if (!action) {
        result.valid = false;
        result.errors.push({ message: 'Action not found' });
        return result;
      }

      // Check if action has planning effects
      if (!action.planningEffects) {
        result.warnings.push({ message: 'No planning effects defined' });
        return result;
      }

      // Get rule(s)
      const rules = await this.#findRulesForAction(actionId);
      if (rules.length === 0) {
        result.warnings.push({ message: 'No rules found for action' });
        return result;
      }

      // Analyze rules to generate expected effects
      const expectedEffects = [];
      for (const rule of rules) {
        const analyzed = this.#effectsAnalyzer.analyzeRule(rule);
        expectedEffects.push(...analyzed.effects);
      }

      // Compare actual vs expected effects
      const comparison = this.#compareEffects(
        action.planningEffects.effects,
        expectedEffects
      );

      result.warnings.push(...comparison.warnings);
      result.errors.push(...comparison.errors);
      result.valid = comparison.errors.length === 0;

      return result;
    } catch (error) {
      this.#logger.error(`Failed to validate action ${actionId}`, error);
      result.valid = false;
      result.errors.push({ message: error.message });
      return result;
    }
  }

  // Private helper methods

  async #findRulesForAction(actionId) {
    const [modId, actionName] = actionId.split(':');
    const ruleId = `${modId}:handle_${actionName}`;

    try {
      const rule = await this.#ruleLoader.getRule(ruleId);
      return rule ? [rule] : [];
    } catch (error) {
      return [];
    }
  }

  #compareEffects(actual, expected) {
    const warnings = [];
    const errors = [];

    // Check for missing effects
    for (const expectedEffect of expected) {
      const found = actual.some(actualEffect =>
        this.#effectsMatch(actualEffect, expectedEffect)
      );

      if (!found) {
        errors.push({
          message: `Missing effect: ${JSON.stringify(expectedEffect)}`
        });
      }
    }

    // Check for unexpected effects
    for (const actualEffect of actual) {
      const found = expected.some(expectedEffect =>
        this.#effectsMatch(actualEffect, expectedEffect)
      );

      if (!found) {
        warnings.push({
          message: `Unexpected effect: ${JSON.stringify(actualEffect)}`
        });
      }
    }

    return { warnings, errors };
  }

  #effectsMatch(effect1, effect2) {
    // Deep comparison of effects
    if (effect1.operation !== effect2.operation) return false;
    if (effect1.entity !== effect2.entity) return false;
    if (effect1.component !== effect2.component) return false;

    // For now, simplified comparison
    // Could be more sophisticated based on operation type
    return true;
  }
}

export default EffectsValidator;
```

### 4. Update package.json

Add npm scripts:

```json
{
  "scripts": {
    "generate:effects": "node scripts/generateEffects.js",
    "validate:effects": "node scripts/validateEffects.js"
  }
}
```

## Files to Create

- [ ] `scripts/generateEffects.js`
- [ ] `scripts/validateEffects.js`
- [ ] `src/goap/validation/effectsValidator.js`

## Files to Update

- [ ] `package.json` - Add npm scripts
- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` - Register EffectsValidator

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/validation/effectsValidator.test.js`

- Validate single action (valid)
- Validate single action (invalid)
- Validate mod
- Validate all mods
- Compare effects (matching)
- Compare effects (missing effects)
- Compare effects (unexpected effects)

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/goap/effectsValidation.integration.test.js`

- Generate and validate effects for positioning mod
- Generate and validate effects for items mod
- Detect desyncs between effects and rules
- Generate validation report
- Handle actions without rules
- Handle actions without effects

## Manual Testing

1. Generate effects for positioning mod: `npm run generate:effects -- --mod=positioning`
2. Validate effects: `npm run validate:effects -- --mod=positioning`
3. Generate effects for all mods: `npm run generate:effects`
4. Validate all effects: `npm run validate:effects --report=report.json`
5. Review generated effects in action files
6. Review validation report

## Documentation Requirements

- [ ] Create `docs/goap/effects-generation-workflow.md` with:
  - Step-by-step guide to generate effects
  - How to validate effects
  - How to fix validation errors
  - Understanding validation reports
  - Troubleshooting guide

## Acceptance Criteria

- [ ] Effects generation script works for single action
- [ ] Effects generation script works for single mod
- [ ] Effects generation script works for all mods
- [ ] Validation script works for single mod
- [ ] Validation script works for all mods
- [ ] Validation script generates detailed reports
- [ ] Effects written to action files correctly
- [ ] Effects validated against rules
- [ ] npm scripts work correctly
- [ ] All tests pass with 90%+ coverage
- [ ] Documentation complete
- [ ] Successfully generated effects for 100+ actions

## Success Metrics

- ✅ Generated effects for 100-200 actions
- ✅ Validation reports 90%+ valid actions
- ✅ No critical desyncs between effects and rules
- ✅ Clear actionable error messages
- ✅ Fast generation (<5s for all actions)

## Notes

- **Incremental Generation:** Start with small mods (positioning) before all mods
- **Manual Review:** Sample 10-20 generated effects for accuracy
- **Validation First:** Always validate after generation
- **Backup:** Keep backups of action files before modification

## Related Tickets

- Depends on: GOAP-TIER1-002 (Effects Analyzer)
- Depends on: GOAP-TIER1-003 (Effects Generator)
- Blocks: GOAP-TIER1-005 (Effects Testing Suite)
