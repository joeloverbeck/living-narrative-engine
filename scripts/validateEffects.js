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
import { goapTokens } from '../src/dependencyInjection/tokens/tokens-goap.js';
import { createLoadContext } from '../src/loaders/LoadContext.js';
import fs from 'fs/promises';

/**
 *
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Create and configure container
  const container = new AppContainer();
  await configureMinimalContainer(container);

  // Override data fetcher for Node.js environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());

  const logger = container.resolve(tokens.ILogger);
  const effectsValidator = container.resolve(goapTokens.IEffectsValidator);
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

/**
 *
 * @param results
 * @param logger
 */
function displayResults(results, logger) {
  logger.info('\n=== Validation Results ===\n');

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

  logger.info('\n=== Summary ===');
  logger.info(`Valid: ${results.summary.valid}`);
  logger.warn(`Warnings: ${results.summary.warnings}`);
  logger.error(`Errors: ${results.summary.errors}`);
  logger.info(`Total: ${results.summary.total}`);
}

/**
 *
 * @param reportPath
 * @param results
 * @param logger
 */
async function writeReport(reportPath, results, logger) {
  try {
    await fs.writeFile(
      reportPath,
      JSON.stringify(results, null, 2),
      'utf8'
    );
    logger.info(`\n✓ Report written to ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to write report to ${reportPath}`, error);
  }
}

/**
 *
 * @param argv
 */
function parseArgs(argv) {
  const args = {
    mod: null,
    report: null,
    mods: []
  };

  for (const arg of argv) {
    if (arg.startsWith('--mod=')) {
      args.mod = arg.substring(6);
      args.mods = [args.mod];
    } else if (arg.startsWith('--report=')) {
      args.report = arg.substring(9);
    }
  }

  return args;
}

main();
