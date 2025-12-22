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
import { goapTokens } from '../src/dependencyInjection/tokens/tokens-goap.js';
import { createLoadContext } from '../src/loaders/LoadContext.js';
import fs from 'fs/promises';
import path from 'path';
import { overrideDataFetcher } from './utils/cliContainerOverrides.js';

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
  overrideDataFetcher(container, tokens.IDataFetcher, () => new NodeDataFetcher());

  const logger = container.resolve(tokens.ILogger);
  const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const schemaPhase = container.resolve(tokens.SchemaPhase);

  try {
    // Load schemas
    logger.info('📚 Loading schemas...');
    let loadContext = createLoadContext({
      worldName: 'effects-generation',
      requestedMods: args.mods || [],
      registry: dataRegistry,
    });
    loadContext = await schemaPhase.execute(loadContext);
    logger.info('✅ Schemas loaded');

    // Process manifests
    logger.info('📋 Processing manifests...');
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    loadContext = await manifestPhase.execute(loadContext);
    logger.info('✅ Manifests processed');

    // Load mod data
    logger.info('📦 Loading mod data...');
    const contentPhase = container.resolve(tokens.ContentPhase);
    loadContext = await contentPhase.execute(loadContext);
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

/**
 *
 * @param actionId
 * @param effectsGenerator
 * @param logger
 */
async function generateForAction(actionId, effectsGenerator, logger) {
  logger.info(`Generating effects for action: ${actionId}`);

  const effects = effectsGenerator.generateForAction(actionId);

  if (effects) {
    logger.info(`Generated ${effects.effects.length} effects`);
    logger.info(JSON.stringify(effects, null, 2));

    // Write to action file
    await writeEffectsToAction(actionId, effects, logger);
  } else {
    logger.warn('No effects generated');
  }
}

/**
 *
 * @param modId
 * @param effectsGenerator
 * @param dataRegistry
 * @param logger
 */
async function generateForMod(modId, effectsGenerator, dataRegistry, logger) {
  logger.info(`Generating effects for mod: ${modId}`);

  const effectsMap = effectsGenerator.generateForMod(modId);

  logger.info(`Generated effects for ${effectsMap.size} actions`);

  // Write effects to action files
  for (const [actionId, effects] of effectsMap.entries()) {
    await writeEffectsToAction(actionId, effects, logger);
  }
}

/**
 *
 * @param effectsGenerator
 * @param dataRegistry
 * @param logger
 */
async function generateForAllMods(effectsGenerator, dataRegistry, logger) {
  logger.info('Generating effects for all mods...');

  // Get all actions from registry
  const allActions = dataRegistry.getAll('actions');

  // Extract unique mod IDs
  const modIds = new Set(
    allActions.map((action) => action.id?.split(':')[0]).filter(Boolean)
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

  logger.info(
    `Generated effects for ${totalActions} actions across ${modIds.size} mods`
  );
}

/**
 *
 * @param actionId
 * @param effects
 * @param logger
 */
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

/**
 *
 * @param argv
 */
function parseArgs(argv) {
  const args = {
    mod: null,
    action: null,
    mods: [],
  };

  for (const arg of argv) {
    if (arg.startsWith('--mod=')) {
      args.mod = arg.substring(6);
      args.mods = [args.mod];
    } else if (arg.startsWith('--action=')) {
      args.action = arg.substring(9);
      // Extract mod ID from action ID (format: modId:actionName)
      const modId = args.action.split(':')[0];
      if (modId && !args.mods.includes(modId)) {
        args.mods.push(modId);
      }
    }
  }

  return args;
}

main();
