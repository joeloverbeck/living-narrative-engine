#!/usr/bin/env node
/**
 * @file Main build script for Living Narrative Engine
 * Entry point for the build system with CLI support
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const BuildSystem = require('./lib/BuildSystem');
const buildConfig = require('./build.config');

/**
 * Parse command line arguments and execute build operations
 */
const argv = yargs(hideBin(process.argv))
  .scriptName('build')
  .usage('$0 [options]')
  .option('mode', {
    alias: 'm',
    description: 'Build mode',
    choices: ['development', 'production'],
    default: 'development',
  })
  .option('watch', {
    alias: 'w',
    description: 'Enable watch mode',
    type: 'boolean',
    default: false,
  })
  .option('parallel', {
    description: 'Enable parallel building',
    type: 'boolean',
    default: true,
  })
  .option('validate-only', {
    description: 'Only validate existing build',
    type: 'boolean',
    default: false,
  })
  .option('verbose', {
    alias: 'v',
    description: 'Verbose output',
    type: 'boolean',
    default: false,
  })
  .option('no-parallel', {
    description: 'Disable parallel building',
    type: 'boolean',
  })
  .example('$0', 'Build in development mode')
  .example('$0 --mode production', 'Build for production')
  .example('$0 --watch', 'Build and watch for changes')
  .example('$0 --validate-only', 'Validate existing build')
  .example('$0 --verbose --no-parallel', 'Debug build issues')
  .help()
  .alias('help', 'h')
  .version(false).argv;

// Main execution
/**
 * Main build execution function
 */
async function main() {
  try {
    // Show build header
    console.log(
      chalk.bold.blue('\n🏗️  Living Narrative Engine Build System\n')
    );
    console.log(chalk.gray(`Mode: ${argv.mode}`));
    console.log(
      chalk.gray(`Parallel: ${argv.parallel ? 'enabled' : 'disabled'}`)
    );

    if (argv.verbose) {
      console.log(chalk.gray(`Verbose: enabled`));
    }

    console.log('');

    // Validate only mode
    if (argv.validateOnly) {
      await validateOnly();
      return;
    }

    // Watch mode
    if (argv.watch) {
      await startWatchMode();
      return;
    }

    // Normal build
    await runBuild();
  } catch (error) {
    console.error(chalk.red('\n💥 Build system error:'));
    console.error(chalk.red(error.message));

    if (argv.verbose && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  }
}

/**
 * Run a normal build
 */
async function runBuild() {
  const buildSystem = new BuildSystem(buildConfig, {
    mode: argv.mode,
    parallel: argv.parallel,
    verbose: argv.verbose,
  });

  await buildSystem.build();
}

/**
 * Validate existing build
 */
async function validateOnly() {
  console.log(chalk.blue('Running validation only...\n'));

  const BuildValidator = require('./lib/BuildValidator');
  const validator = new BuildValidator(buildConfig);

  const result = await validator.validate();

  console.log(result.summary);

  if (result.errors.length > 0) {
    console.log(chalk.red('\nValidation errors:'));
    result.errors.forEach((error, index) => {
      console.log(chalk.red(`${index + 1}. ${error.message}`));
      if (error.file) {
        console.log(chalk.gray(`   File: ${error.file}`));
      }
    });
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nValidation warnings:'));
    result.warnings.forEach((warning, index) => {
      console.log(chalk.yellow(`${index + 1}. ${warning.message}`));
      if (warning.file) {
        console.log(chalk.gray(`   File: ${warning.file}`));
      }
    });
  }

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Start watch mode
 */
async function startWatchMode() {
  console.log(chalk.blue('Starting watch mode...\n'));

  // First run initial build
  await runBuild();

  // Then start watching
  const WatchMode = require('./lib/WatchMode');
  const buildSystem = new BuildSystem(buildConfig, {
    mode: argv.mode,
    parallel: argv.parallel,
    verbose: argv.verbose,
  });

  const watcher = new WatchMode(buildSystem);
  await watcher.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\nShutting down watch mode...'));
    await watcher.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await watcher.stop();
    process.exit(0);
  });
}

// Run main if executed directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { main };
