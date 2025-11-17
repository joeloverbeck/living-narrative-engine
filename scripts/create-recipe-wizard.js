#!/usr/bin/env node

/**
 * @file Interactive Recipe Wizard
 * Creates anatomy recipes with step-by-step guidance and real-time validation
 *
 * Usage:
 *   npm run create:recipe
 *   npm run create:recipe -- --verbose
 */

import inquirer from 'inquirer';
import { program } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import RecipeValidationRunner from '../src/anatomy/validation/RecipeValidationRunner.js';
import AppContainer from '../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../src/dependencyInjection/tokens.js';
import { BODY_DESCRIPTOR_REGISTRY, getAllDescriptorNames } from '../src/anatomy/registries/bodyDescriptorRegistry.js';

/**
 * Creates validation context with full mod loading
 *
 * @param {boolean} verbose - Whether to show verbose output
 * @returns {Promise<object>} Validation dependencies
 */
async function createWizardContext(verbose = false) {
  if (verbose) {
    console.log(chalk.blue('\n🔧 Initializing wizard context...\n'));
  }

  // Create and configure container
  const container = new AppContainer();
  await configureMinimalContainer(container);

  // Override data fetchers for CLI environment
  const NodeDataFetcher = (await import('./utils/nodeDataFetcher.js')).default;
  const NodeTextDataFetcher = (await import('./utils/nodeTextDataFetcher.js')).default;
  container.register(tokens.IDataFetcher, () => new NodeDataFetcher());
  container.register(tokens.ITextDataFetcher, () => new NodeTextDataFetcher());

  // Resolve core services
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  const anatomyBlueprintRepository = container.resolve(tokens.IAnatomyBlueprintRepository);
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const slotGenerator = container.resolve(tokens.ISlotGenerator);
  const entityMatcherService = container.resolve(tokens.IEntityMatcherService);
  const monitoringCoordinator =
    typeof container.isRegistered === 'function' &&
    container.isRegistered(tokens.IMonitoringCoordinator)
      ? container.resolve(tokens.IMonitoringCoordinator)
      : null;

  // Load mods
  if (verbose) {
    console.log(chalk.blue('📚 Loading mods (core, descriptors, anatomy)...'));
  }

  try {
    const essentialMods = ['core', 'descriptors', 'anatomy'];
    const { createLoadContext } = await import('../src/loaders/LoadContext.js');

    let context = createLoadContext({
      worldName: 'recipe-wizard',
      requestedMods: essentialMods,
      registry: dataRegistry,
    });

    // Execute phases
    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    context = await schemaPhase.execute(context);
    context = await manifestPhase.execute(context);
    context = await contentPhase.execute(context);

    if (verbose) {
      console.log(chalk.green(`✅ Loaded ${context.finalModOrder.length} mods successfully\n`));
    }
  } catch (error) {
    throw new Error(`Failed to load mods: ${error.message}`);
  }

  return {
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    entityMatcherService,
    logger: {
      info: verbose ? (msg) => console.log(chalk.blue(msg)) : () => {},
      warn: (msg) => console.warn(chalk.yellow(`⚠️  ${msg}`)),
      error: (msg, err) => console.error(chalk.red(`❌ ${msg}`), err || ''),
      debug: verbose ? (msg) => console.log(chalk.gray(msg)) : () => {},
    },
    monitoringCoordinator,
  };
}

/**
 * Get all available blueprints with version info
 *
 * @param {object} dataRegistry - Data registry instance
 * @returns {Array} Array of blueprint info objects
 */
function getAvailableBlueprints(dataRegistry) {
  const blueprints = dataRegistry.getAll('anatomyBlueprints') || [];

  return blueprints.map(blueprint => ({
    // Use _fullId which includes namespace (e.g., 'anatomy:human_female')
    // instead of id which might not include it (e.g., 'human_female')
    id: blueprint._fullId || blueprint.id,
    version: blueprint.schemaVersion === '2.0' ? 'V2' : 'V1',
    description: blueprint.description || 'No description',
    template: blueprint.structureTemplate || null,
  }));
}

/**
 * Introspect V2 blueprint to show generated slots
 *
 * @param {object} blueprint - Blueprint object
 * @param {object} context - Wizard context
 * @returns {Promise<object>} Blueprint introspection info
 */
async function introspectBlueprint(blueprint, context) {
  // Handle null blueprint
  if (!blueprint) {
    return {
      version: 'Unknown',
      error: 'Blueprint not found',
      slots: [],
    };
  }

  // V1 blueprints don't have schemaVersion or have it undefined
  if (blueprint.schemaVersion !== '2.0') {
    return {
      version: 'V1',
      slots: Object.keys(blueprint.slots || {}),
    };
  }

  // V2 blueprint - load structure template and generate slots
  const template = context.dataRegistry.get('anatomyStructureTemplates', blueprint.structureTemplate);

  if (!template) {
    return {
      version: 'V2',
      template: blueprint.structureTemplate,
      error: 'Template not found',
      slots: [],
    };
  }

  // Generate slots using slot generator
  const generatedSlots = await context.slotGenerator.generateSlots(template);

  return {
    version: 'V2',
    template: blueprint.structureTemplate,
    slots: generatedSlots.map(slot => slot.key),
    limbSets: template.topology.limbSets || [],
    appendages: template.topology.appendages || [],
  };
}

/**
 * Get available component tags from loaded mods
 *
 * @param {object} dataRegistry - Data registry instance
 * @returns {Array} Array of component IDs
 */
function getAvailableComponentTags(dataRegistry) {
  const components = dataRegistry.getAll('components') || [];
  return components.map(c => c.id).sort();
}

/**
 * Prompt for body descriptors
 *
 * @returns {Promise<object>} Body descriptors object
 */
async function promptBodyDescriptors() {
  console.log(chalk.cyan('\n📋 Body Descriptors Configuration (Optional)'));
  console.log(chalk.gray('Body descriptors define physical characteristics like height, build, etc.\n'));

  const { configureDescriptors } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'configureDescriptors',
      message: 'Configure body descriptors?',
      default: false,
    },
  ]);

  if (!configureDescriptors) {
    return {};
  }

  const descriptors = {};
  const descriptorNames = getAllDescriptorNames();

  for (const descriptorName of descriptorNames) {
    const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];

    if (!metadata) continue;

    const { setValue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setValue',
        message: `Set ${metadata.displayLabel}?`,
        default: false,
      },
    ]);

    if (setValue) {
      if (metadata.validValues && metadata.validValues.length > 0) {
        // Enumerated descriptor - use list
        const { value } = await inquirer.prompt([
          {
            type: 'list',
            name: 'value',
            message: `${metadata.displayLabel}:`,
            choices: metadata.validValues,
          },
        ]);
        descriptors[metadata.schemaProperty] = value;
      } else {
        // Free-form descriptor - use input
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `${metadata.displayLabel}:`,
            validate: (input) => input.trim().length > 0 || 'Value cannot be empty',
          },
        ]);
        descriptors[metadata.schemaProperty] = value.trim();
      }
    }
  }

  return descriptors;
}

/**
 * Prompt for pattern configuration
 *
 * @param {object} introspection - Blueprint introspection info
 * @param {object} context - Wizard context
 * @returns {Promise<Array>} Array of pattern objects
 */
async function promptPatterns(introspection, context) {
  console.log(chalk.cyan('\n🎯 Pattern Configuration'));
  console.log(chalk.gray('Patterns define how to populate multiple slots at once.\n'));

  const { usePatterns } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'usePatterns',
      message: 'Use pattern-based configuration?',
      default: true,
    },
  ]);

  if (!usePatterns) {
    return [];
  }

  const patterns = [];
  let addMore = true;

  while (addMore) {
    console.log(chalk.yellow(`\n➕ Pattern #${patterns.length + 1}`));

    const { patternType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'patternType',
        message: 'Pattern type:',
        choices: [
          { name: 'matchesGroup (select limb set or appendage type)', value: 'matchesGroup' },
          { name: 'matchesPattern (wildcard matching)', value: 'matchesPattern' },
          { name: 'matchesAll (property-based filtering)', value: 'matchesAll' },
          { name: 'matches (explicit slot list - V1)', value: 'matches' },
        ],
      },
    ]);

    const pattern = {};

    // Get pattern matcher value based on type
    if (patternType === 'matchesGroup') {
      // Build choices from introspection
      const choices = [];

      if (introspection.limbSets) {
        introspection.limbSets.forEach(ls => {
          choices.push({ name: `limbSet:${ls.type} (${ls.count} limbs)`, value: `limbSet:${ls.type}` });
        });
      }

      if (introspection.appendages) {
        introspection.appendages.forEach(app => {
          choices.push({ name: `appendage:${app.type} (${app.count} appendages)`, value: `appendage:${app.type}` });
        });
      }

      if (choices.length === 0) {
        choices.push({ name: 'Custom value', value: 'custom' });
      }

      const { groupValue } = await inquirer.prompt([
        {
          type: 'list',
          name: 'groupValue',
          message: 'Select group:',
          choices,
        },
      ]);

      if (groupValue === 'custom') {
        const { customValue } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customValue',
            message: 'Enter custom group value (e.g., limbSet:leg):',
            validate: (input) => input.trim().length > 0 || 'Value cannot be empty',
          },
        ]);
        pattern.matchesGroup = customValue.trim();
      } else {
        pattern.matchesGroup = groupValue;
      }
    } else if (patternType === 'matchesPattern') {
      const { patternValue } = await inquirer.prompt([
        {
          type: 'input',
          name: 'patternValue',
          message: 'Wildcard pattern (e.g., leg_*, *_left, *tentacle*):',
          validate: (input) => input.trim().length > 0 || 'Pattern cannot be empty',
        },
      ]);
      pattern.matchesPattern = patternValue.trim();
    } else if (patternType === 'matchesAll') {
      console.log(chalk.gray('Property-based filtering (leave empty to skip a property):'));

      const { slotType } = await inquirer.prompt([
        {
          type: 'input',
          name: 'slotType',
          message: 'Slot type (optional):',
        },
      ]);

      const { orientation } = await inquirer.prompt([
        {
          type: 'input',
          name: 'orientation',
          message: 'Orientation (optional, supports wildcards):',
        },
      ]);

      const { socketId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'socketId',
          message: 'Socket ID (optional, supports wildcards):',
        },
      ]);

      const filter = {};
      if (slotType.trim()) filter.slotType = slotType.trim();
      if (orientation.trim()) filter.orientation = orientation.trim();
      if (socketId.trim()) filter.socketId = socketId.trim();

      pattern.matchesAll = filter;
    } else if (patternType === 'matches') {
      const { slotList } = await inquirer.prompt([
        {
          type: 'input',
          name: 'slotList',
          message: 'Comma-separated slot list (e.g., leg_1, leg_2, leg_3):',
          validate: (input) => input.trim().length > 0 || 'Slot list cannot be empty',
        },
      ]);
      pattern.matches = slotList.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Get part type
    const { partType } = await inquirer.prompt([
      {
        type: 'input',
        name: 'partType',
        message: 'Part type:',
        validate: (input) => input.trim().length > 0 || 'Part type cannot be empty',
      },
    ]);
    pattern.partType = partType.trim();

    // Get tags
    const availableTags = getAvailableComponentTags(context.dataRegistry);
    const { tags } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'tags',
        message: 'Select tags (space to select, enter when done):',
        choices: availableTags.slice(0, 50), // Limit to first 50 for usability
        default: ['anatomy:part'],
      },
    ]);
    pattern.tags = tags;

    // Optional properties
    const { addProperties } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addProperties',
        message: 'Add component properties?',
        default: false,
      },
    ]);

    if (addProperties) {
      pattern.properties = {};

      let addMoreProps = true;
      while (addMoreProps) {
        const { componentId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'componentId',
            message: 'Component ID (e.g., anatomy:scaled):',
            validate: (input) => input.trim().length > 0 || 'Component ID cannot be empty',
          },
        ]);

        const { propertyName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'propertyName',
            message: 'Property name:',
            validate: (input) => input.trim().length > 0 || 'Property name cannot be empty',
          },
        ]);

        const { propertyValue } = await inquirer.prompt([
          {
            type: 'input',
            name: 'propertyValue',
            message: 'Property value:',
            validate: (input) => input.trim().length > 0 || 'Property value cannot be empty',
          },
        ]);

        if (!pattern.properties[componentId.trim()]) {
          pattern.properties[componentId.trim()] = {};
        }
        pattern.properties[componentId.trim()][propertyName.trim()] = propertyValue.trim();

        const { addAnother } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addAnother',
            message: 'Add another property?',
            default: false,
          },
        ]);
        addMoreProps = addAnother;
      }
    }

    // Optional preferId
    const { addPreferId } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addPreferId',
        message: 'Prefer specific entity?',
        default: false,
      },
    ]);

    if (addPreferId) {
      const { preferId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'preferId',
          message: 'Preferred entity ID (e.g., anatomy:dragon_wing_large):',
          validate: (input) => input.trim().length > 0 || 'Entity ID cannot be empty',
        },
      ]);
      pattern.preferId = preferId.trim();
    }

    patterns.push(pattern);

    const { continueAdding } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAdding',
        message: 'Add another pattern?',
        default: false,
      },
    ]);
    addMore = continueAdding;
  }

  return patterns;
}

/**
 * Run the recipe wizard
 *
 * @param {object} options - CLI options
 */
async function runWizard(options) {
  try {
    console.log(chalk.bold.cyan('\n🧙 Interactive Recipe Wizard\n'));
    console.log(chalk.gray('This wizard will guide you through creating an anatomy recipe.\n'));

    // Initialize context
    const context = await createWizardContext(options.verbose);
    const validator = new RecipeValidationRunner(context);

    // Step 1: Recipe ID
    const { recipeId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'recipeId',
        message: 'Recipe ID (without namespace, e.g., red_dragon):',
        validate: (input) => {
          if (!input.trim()) return 'Recipe ID cannot be empty';
          if (!/^[a-z0-9_]+$/.test(input.trim())) {
            return 'Recipe ID must contain only lowercase letters, numbers, and underscores';
          }
          return true;
        },
      },
    ]);

    const fullRecipeId = `anatomy:${recipeId.trim()}`;

    // Step 2: Blueprint Selection
    console.log(chalk.cyan('\n📐 Blueprint Selection'));
    const blueprints = getAvailableBlueprints(context.dataRegistry);

    if (blueprints.length === 0) {
      console.error(chalk.red('\n❌ No blueprints found. Please ensure anatomy mods are loaded.\n'));
      process.exit(1);
    }

    const blueprintChoices = blueprints.map(bp => ({
      name: `${bp.id} (${bp.version}${bp.template ? ' - ' + bp.template : ''})`,
      value: bp.id,
    }));

    const { blueprintId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'blueprintId',
        message: 'Select blueprint:',
        choices: blueprintChoices,
      },
    ]);

    // Load and introspect blueprint
    const blueprint = await context.anatomyBlueprintRepository.getBlueprint(blueprintId);

    // Check if blueprint was found
    if (!blueprint) {
      console.error(chalk.red(`\n❌ Blueprint '${blueprintId}' not found in registry.\n`));
      console.error(chalk.yellow('Available blueprints:'));
      blueprints.forEach(bp => {
        console.error(chalk.gray(`  - ${bp.id}`));
      });
      process.exit(1);
    }

    const introspection = await introspectBlueprint(blueprint, context);

    // Display blueprint info
    console.log(chalk.green(`\n✓ Blueprint: ${blueprintId} selected (${introspection.version})`));

    if (introspection.version === 'V2') {
      console.log(chalk.gray('\nBlueprint info:'));
      console.log(chalk.gray(`  Schema version: 2.0`));
      console.log(chalk.gray(`  Structure template: ${introspection.template}`));
      console.log(chalk.gray(`  Generated slots: ${introspection.slots.join(', ')}`));
    } else {
      console.log(chalk.gray(`\nBlueprint slots: ${introspection.slots.join(', ')}`));
    }

    // Step 3: Body Descriptors
    const bodyDescriptors = await promptBodyDescriptors();

    // Step 4: Patterns
    const patterns = await promptPatterns(introspection, context);

    // Step 5: Individual Slots (optional)
    const { addSlots } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addSlots',
        message: 'Add individual slot overrides?',
        default: false,
      },
    ]);

    const slots = {};
    if (addSlots) {
      console.log(chalk.cyan('\n⚙️  Individual Slot Configuration'));
      console.log(chalk.gray('Override specific slots with unique configurations.\n'));

      // For simplicity, we'll skip implementing the full slot override UI
      // Users can edit the generated recipe file manually for complex overrides
      console.log(chalk.yellow('Note: Individual slot configuration can be added by editing the generated file.\n'));
    }

    // Step 6: Constraints (optional)
    const { addConstraints } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addConstraints',
        message: 'Add constraints (requires/excludes)?',
        default: false,
      },
    ]);

    if (addConstraints) {
      console.log(chalk.cyan('\n🔒 Constraint Configuration'));
      console.log(chalk.gray('Define requirements and exclusions.\n'));

      // For simplicity, we'll skip implementing the full constraints UI
      console.log(chalk.yellow('Note: Constraints can be added by editing the generated file.\n'));
    }

    // Build recipe object
    const recipe = {
      $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
      recipeId: fullRecipeId,
      blueprintId,
    };

    if (Object.keys(bodyDescriptors).length > 0) {
      recipe.bodyDescriptors = bodyDescriptors;
    }

    if (Object.keys(slots).length > 0) {
      recipe.slots = slots;
    }

    if (patterns.length > 0) {
      recipe.patterns = patterns;
    }

    // Validate recipe
    console.log(chalk.cyan('\n🔍 Validating recipe...\n'));

    const report = await validator.validate(recipe, {
      recipePath: `${recipeId}.recipe.json`,
    });

    if (!report.isValid) {
      console.log(chalk.red('\n❌ Recipe validation failed!\n'));
      console.log(report.toString());

      const { saveAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveAnyway',
          message: 'Save recipe anyway?',
          default: false,
        },
      ]);

      if (!saveAnyway) {
        console.log(chalk.yellow('\nRecipe not saved. Please fix the errors and try again.\n'));
        process.exit(1);
      }
    } else {
      console.log(chalk.green('✓ Recipe validation passed!\n'));
    }

    // Save recipe
    const recipePath = path.join(process.cwd(), 'data', 'mods', 'anatomy', 'recipes', `${recipeId}.recipe.json`);
    const recipeJson = JSON.stringify(recipe, null, 2);

    await fs.writeFile(recipePath, recipeJson, 'utf-8');

    console.log(chalk.green(`✅ Recipe saved to: ${recipePath}\n`));
    console.log(chalk.gray('Generated recipe:'));
    console.log(chalk.gray(recipeJson));
    console.log();

    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`\n❌ Wizard Error: ${error.message}\n`));
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Configure CLI
program
  .name('create-recipe-wizard')
  .description('Interactive wizard for creating anatomy recipes')
  .option('-v, --verbose', 'Verbose output')
  .action(runWizard);

program.parse();
