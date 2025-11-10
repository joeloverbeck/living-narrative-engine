# GOAP-TIER1-004: Content Generation and Validation Tools

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 5-6
**Status:** Not Started
**Dependencies:** GOAP-TIER1-002, GOAP-TIER1-003

**Last Validated:** 2025-11-10
**Validation Status:** ✅ All assumptions validated against codebase

## Validation Summary

This workflow has been validated against the actual codebase. Key corrections made:

1. **Dependency Injection**:
   - ✅ Uses `AppContainer` and `configureMinimalContainer` (not `createContainer`)
   - ✅ Tokens imported from `src/dependencyInjection/tokens.js` (includes all token groups)
   - ✅ Token names verified: `IEffectsGenerator`, `IEffectsValidator`, `IEffectsAnalyzer`

2. **Data Access**:
   - ✅ Uses `IDataRegistry` with `get(type, id)` and `getAll(type)` methods
   - ✅ No separate `IActionLoader` or `IRuleLoader` - unified registry approach
   - ✅ Actions accessed via: `dataRegistry.get('actions', actionId)`
   - ✅ Rules accessed via: `dataRegistry.get('rules', ruleId)`

3. **CLI Setup**:
   - ✅ Requires `NodeDataFetcher` override for file system access
   - ✅ Requires `SchemaPhase` for schema loading
   - ✅ Requires `ModsPhase` for mod data loading (CRITICAL)
   - ✅ Uses `createLoadContext` for initialization

4. **File Structure**:
   - ✅ Action files location: `data/mods/{modId}/actions/{actionName}.action.json`
   - ✅ Action files currently don't have `planningEffects` field (will be added)
   - ✅ Rule naming convention: `{modId}:handle_{actionName}`

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

import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import { createLoadContext } from '../src/loaders/LoadContext.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Create and configure container
  const container = new AppContainer();
  await configureMinimalContainer(container);

  // Override data fetcher for Node.js environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());

  const logger = container.resolve(tokens.ILogger);
  const effectsGenerator = container.resolve(tokens.IEffectsGenerator);
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const schemaPhase = container.resolve(tokens.SchemaPhase);

  try {
    // Load schemas
    logger.info('📚 Loading schemas...');
    const loadContext = createLoadContext({
      worldName: 'effects-generation',
      requestedMods: args.mods || [],
      registry: dataRegistry
    });
    await schemaPhase.execute(loadContext);
    logger.info('✅ Schemas loaded');

    // Load mod data
    logger.info('📦 Loading mod data...');
    const modsPhase = container.resolve(tokens.ModsPhase);
    await modsPhase.execute(loadContext);
    logger.info('✅ Mod data loaded');

    if (args.action) {
      // Generate for single action
      await generateForAction(args.action, effectsGenerator, logger);
    } else if (args.mod) {
      // Generate for single mod
      await generateForMod(args.mod, effectsGenerator, dataRegistry, logger);
    } else {
      // Generate for all mods
      await generateForAllMods(effectsGenerator, dataRegistry, logger);
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

async function generateForMod(modId, effectsGenerator, dataRegistry, logger) {
  logger.info(`Generating effects for mod: ${modId}`);

  const effectsMap = effectsGenerator.generateForMod(modId);

  logger.info(`Generated effects for ${effectsMap.size} actions`);

  // Write effects to action files
  for (const [actionId, effects] of effectsMap.entries()) {
    await writeEffectsToAction(actionId, effects, logger);
  }
}

async function generateForAllMods(effectsGenerator, dataRegistry, logger) {
  logger.info('Generating effects for all mods...');

  // Get all actions from registry
  const allActions = dataRegistry.getAll('actions');

  // Extract unique mod IDs
  const modIds = new Set(
    allActions
      .map(action => action.id?.split(':')[0])
      .filter(Boolean)
  );

  let totalActions = 0;

  for (const modId of modIds) {
    try {
      const effectsMap = effectsGenerator.generateForMod(modId);
      totalActions += effectsMap.size;

      // Write effects to action files
      for (const [actionId, effects] of effectsMap.entries()) {
        await writeEffectsToAction(actionId, effects, logger);
      }
    } catch (error) {
      logger.error(`Failed to generate effects for mod ${modId}`, error);
    }
  }

  logger.info(`Generated effects for ${totalActions} actions across ${modIds.size} mods`);
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

import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import { createLoadContext } from '../src/loaders/LoadContext.js';
import fs from 'fs/promises';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Create and configure container
  const container = new AppContainer();
  await configureMinimalContainer(container);

  // Override data fetcher for Node.js environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());

  const logger = container.resolve(tokens.ILogger);
  const effectsValidator = container.resolve(tokens.IEffectsValidator);
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const schemaPhase = container.resolve(tokens.SchemaPhase);

  try {
    // Load schemas
    logger.info('📚 Loading schemas...');
    const loadContext = createLoadContext({
      worldName: 'effects-validation',
      requestedMods: args.mods || [],
      registry: dataRegistry
    });
    await schemaPhase.execute(loadContext);
    logger.info('✅ Schemas loaded');

    // Load mod data
    logger.info('📦 Loading mod data...');
    const modsPhase = container.resolve(tokens.ModsPhase);
    await modsPhase.execute(loadContext);
    logger.info('✅ Mod data loaded');

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
  #dataRegistry;

  constructor({ logger, effectsAnalyzer, dataRegistry }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(effectsAnalyzer, 'IEffectsAnalyzer', logger, {
      requiredMethods: ['analyzeRule']
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll']
    });

    this.#logger = logger;
    this.#effectsAnalyzer = effectsAnalyzer;
    this.#dataRegistry = dataRegistry;
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

    const actions = this.#dataRegistry.getAll('actions');

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

    const allActions = this.#dataRegistry.getAll('actions');
    const actions = allActions.filter(action => action.id?.startsWith(`${modId}:`));

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
      // Get action from registry
      const action = this.#dataRegistry.get('actions', actionId);
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
      const rules = this.#findRulesForAction(actionId);
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

  #findRulesForAction(actionId) {
    const [modId, actionName] = actionId.split(':');
    const ruleId = `${modId}:handle_${actionName}`;

    try {
      const rule = this.#dataRegistry.get('rules', ruleId);
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
- [ ] `scripts/utils/nodeDataFetcher.js` (if not exists - check `scripts/validateMods.js` for reference)
- [ ] `src/goap/validation/effectsValidator.js`

## Files to Update

- [ ] `package.json` - Add npm scripts
- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` - Register EffectsValidator
- [ ] `src/dependencyInjection/tokens/tokens-goap.js` - Ensure IEffectsValidator token exists (already exists)

## Important Implementation Notes

### CLI Container Setup

The scripts use the standard CLI container pattern used by other scripts in the codebase:

1. **Container Creation**: Use `AppContainer` and `configureMinimalContainer`
2. **Data Fetcher**: Override with `NodeDataFetcher` for file system access
3. **Schema Loading**: Use `SchemaPhase` and `createLoadContext` to load schemas
4. **Data Access**: Use `IDataRegistry` with `get(type, id)` and `getAll(type)` methods

### Data Registry Usage

- Actions: `dataRegistry.get('actions', actionId)` or `dataRegistry.getAll('actions')`
- Rules: `dataRegistry.get('rules', ruleId)` or `dataRegistry.getAll('rules')`
- The registry is populated by the loading phases

**CRITICAL**: After loading schemas, you must also load the actual mod data:

```javascript
// After schemaPhase.execute(loadContext)

// Load mod data (actions, rules, components, etc.)
const modsPhase = container.resolve(tokens.ModsPhase);
await modsPhase.execute(loadContext);
```

Without this step, the data registry will be empty and no actions/rules will be found.

**Note on requestedMods**: The `createLoadContext` requires a `requestedMods` array. For scripts that need to load all mods:
- Either read from `game.json` (like the main app does)
- Or pass an empty array and let the system load all available mods
- Or specify mods explicitly via command-line args

### Action File Structure

Currently, action files don't have a `planningEffects` field. The generation script will:
1. Read the existing action JSON
2. Add the `planningEffects` field
3. Write back with proper formatting

Example action structure after generation:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:sit_down",
  "name": "Sit down",
  "description": "Sit down on available furniture",
  "targets": "positioning:available_furniture",
  "planningEffects": {
    "effects": [
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:sitting_on",
        "data": { "furniture": "target" }
      }
    ]
  }
}
```

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
