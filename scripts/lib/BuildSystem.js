/**
 * @file Core build system implementation
 * Orchestrates the entire build process with parallel execution
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const { default: chalk } = require('chalk');
const BuildProgress = require('./BuildProgress');
const BuildValidator = require('./BuildValidator');
const BuildError = require('./BuildError');
const fileUtils = require('../utils/fileUtils');
const { parallelLimit } = require('../utils/parallelUtils');

class BuildSystem {
  /**
   * Create a new BuildSystem instance
   *
   * @param {object} config - Build configuration
   * @param {object} [options] - Build options
   */
  constructor(config, options = {}) {
    this.config = config;
    this.options = {
      mode: 'development',
      parallel: true,
      verbose: false,
      fast: false,
      memoryTest: false,
      ...options,
    };

    this.progress = new BuildProgress();
    this.validator = new BuildValidator(config);
    this.errors = [];
    this.startTime = null;

    // Apply mode-specific config
    const modeConfig = config.modes[this.options.mode] || {};
    this.buildOptions = {
      ...config.esbuildOptions,
      ...modeConfig,
    };

    // Apply fast mode optimizations
    if (this.options.fast) {
      this.buildOptions.sourcemap = false;
      this.buildOptions.minify = false;
      this.buildOptions.treeShaking = false;
      this.options.skipValidation = true;
    }

    // Apply memory test mode optimizations (most aggressive)
    if (this.options.memoryTest) {
      this.buildOptions.sourcemap = false;
      this.buildOptions.minify = false;
      this.buildOptions.treeShaking = false;
      this.options.skipValidation = true;
      this.options.skipStaticAssets = true;
      this.options.skipFileVerification = true;
      this.options.minimal = true;
    }
  }

  /**
   * Execute full build
   *
   * @returns {Promise<void>}
   */
  async build() {
    this.startTime = Date.now();

    try {
      await this.initialize();
      await this.buildJavaScript();

      // Skip static assets in memory test mode
      if (!this.options.skipStaticAssets) {
        await this.copyStaticAssets();
      }

      // Skip validation in fast mode or memory test mode
      if (!this.options.skipValidation) {
        await this.validate();
      }

      this.reportSuccess();
    } catch (error) {
      this.reportFailure(error);
      throw error;
    } finally {
      this.progress.cleanup();
    }
  }

  /**
   * Initialize build environment
   */
  async initialize() {
    this.progress.start('Initializing build environment');

    try {
      // Clean dist directory
      await this.cleanDistDirectory();

      // Ensure required directories exist
      await this.ensureDirectories();

      // Verify source files exist (skip in fast mode or memory test mode)
      if (!this.options.fast && !this.options.skipFileVerification) {
        await this.verifySourceFiles();
      }

      this.progress.complete('Build environment initialized');
    } catch (error) {
      this.progress.error('Failed to initialize build environment', error);
      throw new BuildError('Initialization failed', {
        step: 'initialization',
        suggestion:
          'Check that all source files exist and you have write permissions',
      });
    }
  }

  /**
   * Clean dist directory
   */
  async cleanDistDirectory() {
    this.progress.update('Cleaning dist directory');
    await fileUtils.cleanDirectory(this.config.distDir);
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.config.distDir,
      ...this.config.staticDirs.map((d) =>
        path.join(this.config.distDir, d.target)
      ),
    ];

    for (const dir of dirs) {
      await fileUtils.ensureDirectory(dir);
    }
  }

  /**
   * Verify source files exist
   */
  async verifySourceFiles() {
    const missingFiles = [];

    // Check JavaScript entry points
    for (const bundle of this.config.bundles) {
      if (!(await fileUtils.fileExists(bundle.entry))) {
        missingFiles.push(bundle.entry);
      }
    }

    // Check HTML files
    for (const htmlFile of this.config.htmlFiles) {
      if (!(await fileUtils.fileExists(htmlFile))) {
        missingFiles.push(htmlFile);
      }
    }

    if (missingFiles.length > 0) {
      throw new BuildError('Source files missing', {
        errors: missingFiles.map((file) => ({
          type: 'missing_source',
          file,
          message: 'Source file not found',
        })),
      });
    }
  }

  /**
   * Build JavaScript bundles
   */
  async buildJavaScript() {
    this.progress.start('Building JavaScript bundles');

    const bundles = this.prepareBundleConfigs();
    const concurrency = this.options.parallel
      ? this.config.performance.maxConcurrent
      : 1;

    // Build bundles with controlled parallelism
    const buildTasks = bundles.map((bundle) => () => this.buildBundle(bundle));

    const results = await parallelLimit(buildTasks, concurrency);

    // Handle results
    this.handleBuildResults(results, bundles);

    this.progress.complete(`Built ${bundles.length} JavaScript bundles`);
  }

  /**
   * Prepare bundle configurations
   *
   * @returns {Array<object>} Bundle configs
   */
  prepareBundleConfigs() {
    return this.config.bundles.map((bundle) => ({
      ...bundle,
      entryPoints: [bundle.entry],
      outfile: path.join(this.config.distDir, bundle.output),
      ...this.buildOptions,
    }));
  }

  /**
   * Build a single bundle
   *
   * @param {object} bundleConfig - Bundle configuration
   * @returns {Promise<object>} Build result
   */
  async buildBundle(bundleConfig) {
    const startTime = Date.now();

    try {
      if (this.options.verbose) {
        this.progress.info(`Building ${bundleConfig.name}...`);
      }

      // Prepare esbuild command
      const args = [
        bundleConfig.entry,
        '--bundle',
        `--outfile=${bundleConfig.outfile}`,
        `--platform=${bundleConfig.platform}`,
        `--format=${bundleConfig.format}`,
        `--target=${bundleConfig.target}`,
      ];

      if (bundleConfig.sourcemap) {
        args.push('--sourcemap');
      }

      if (bundleConfig.minify) {
        args.push('--minify');
      }

      // Add define options if present
      if (bundleConfig.define) {
        for (const [key, value] of Object.entries(bundleConfig.define)) {
          // The values are already JSON.stringified from the config
          // but we need to ensure they're properly escaped for the shell
          // Empty string "" needs special handling
          let formattedValue = value;
          if (value === '""' || value === "''") {
            // Empty string needs to be passed as '""' to esbuild
            formattedValue = '\'""\'';
          }
          args.push(`--define:${key}=${formattedValue}`);
        }
      }

      // Run esbuild
      const command = ['npx', 'esbuild', ...args].join(' ');
      await this.runEsbuild(args, command);

      const duration = Date.now() - startTime;

      return {
        bundle: bundleConfig.name,
        success: true,
        duration,
      };
    } catch (error) {
      error.bundle = bundleConfig.name;
      error.entry = bundleConfig.entry;
      error.outfile = bundleConfig.outfile;
      throw error;
    }
  }

  /**
   * Run esbuild command
   *
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<void>}
   */
  runEsbuild(args, command) {
    return new Promise((resolve, reject) => {
      // Log the command being run for debugging
      if (this.options.verbose) {
        console.log('Running esbuild with args:', ['esbuild', ...args].join(' '));
      }

      // Use npx to run esbuild
      const proc = spawn('npx', ['esbuild', ...args], {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        shell: true,
      });

      let stderr = '';
      let stdout = '';

      if (!this.options.verbose) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const message =
            stderr.trim() ||
            stdout.trim() ||
            `esbuild exited with code ${code}`;
          const error = new Error(message);
          error.command = command || ['npx', 'esbuild', ...args].join(' ');
          error.exitCode = code;
          error.stderr = stderr.trim();
          error.stdout = stdout.trim();
          reject(error);
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Handle build results
   *
   * @param {Array} results - Build results
   * @param {Array} bundles - Bundle configurations
   */
  handleBuildResults(results, bundles) {
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      const errors = failures.map(({ result, index }) => {
        const bundle = bundles[index];
        const reason = result.reason;
        const enrichedError = BuildError.buildFailure(bundle.name, reason);
        enrichedError.details.errors[0].entry = bundle.entry;
        enrichedError.details.errors[0].outfile = bundle.outfile;
        return enrichedError;
      });

      throw new BuildError(`${failures.length} bundle(s) failed to build`, {
        step: 'javascript_bundling',
        errors: errors.map((e) => e.details.errors[0]),
      });
    }

    // Log performance stats if verbose
    if (this.options.verbose) {
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { bundle, duration } = result.value;
          this.progress.info(`✓ ${bundle} built in ${duration}ms`);
        }
      });
    }
  }

  /**
   * Copy static assets
   */
  async copyStaticAssets() {
    this.progress.start('Copying static assets');

    try {
      // Copy HTML files
      await this.copyHtmlFiles();

      // Copy static directories
      await this.copyDirectories();

      // Copy individual assets
      await this.copyAssetPatterns();

      this.progress.complete('Static assets copied');
    } catch (error) {
      this.progress.error('Failed to copy static assets', error);
      throw new BuildError('Failed to copy static assets', {
        step: 'static_assets',
        suggestion: 'Check that all source files exist',
      });
    }
  }

  /**
   * Copy HTML files
   */
  async copyHtmlFiles() {
    this.progress.update('Copying HTML files');

    for (const htmlFile of this.config.htmlFiles) {
      const destPath = path.join(this.config.distDir, htmlFile);
      await fs.copy(htmlFile, destPath, { overwrite: true });

      if (this.options.verbose) {
        this.progress.info(`Copied ${htmlFile}`);
      }
    }
  }

  /**
   * Copy static directories
   */
  async copyDirectories() {
    for (const dir of this.config.staticDirs) {
      this.progress.update(`Copying ${dir.source} directory`);

      const srcPath = dir.source;
      const destPath = path.join(this.config.distDir, dir.target);

      await fileUtils.copyDirectory(srcPath, destPath, (current, total) => {
        if (this.options.verbose && current % 50 === 0) {
          this.progress.update(
            `Copying ${dir.source}: ${current}/${total} files`
          );
        }
      });
    }
  }

  /**
   * Copy individual asset patterns
   */
  async copyAssetPatterns() {
    this.progress.update('Copying asset files');

    const copiedFiles = await fileUtils.copyPatterns(
      this.config.assetPatterns,
      this.config.distDir
    );

    if (this.options.verbose && copiedFiles.length > 0) {
      this.progress.info(`Copied ${copiedFiles.length} asset files`);
    }
  }

  /**
   * Validate build output
   */
  async validate() {
    this.progress.start('Validating build output');

    const validationResult = await this.validator.validate();

    if (!validationResult.success) {
      this.progress.error('Build validation failed');
      throw BuildError.validationFailure(validationResult.errors);
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      validationResult.warnings.forEach((warning) => {
        this.progress.warn(`${warning.message} (${warning.file})`);
      });
    }

    this.progress.complete('Build validation passed');

    if (this.options.verbose) {
      console.log('\n' + validationResult.summary);
    }
  }

  /**
   * Report build success
   */
  reportSuccess() {
    const totalTime = Date.now() - this.startTime;
    const improvement = this.calculateImprovement(totalTime);

    console.log('');
    this.progress.summary();

    if (improvement > 0) {
      console.log(
        chalk.green(
          `\n⚡ Performance: ${(improvement * 100).toFixed(1)}% faster than baseline`
        )
      );
    }

    console.log(chalk.green.bold('\n✨ Build completed successfully!'));
  }

  /**
   * Report build failure
   *
   * @param {Error} error - Build error
   */
  reportFailure(error) {
    console.log('');

    if (error instanceof BuildError) {
      console.error(error.format());
    } else {
      console.error(chalk.red.bold('Build failed:'));
      console.error(chalk.red(error.message));

      if (this.options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }

    this.progress.summary();
    console.log(chalk.red.bold('\n❌ Build failed!'));
  }

  /**
   * Calculate performance improvement
   *
   * @param {number} currentTime - Current build time
   * @returns {number} Improvement percentage (0-1)
   */
  calculateImprovement(currentTime) {
    // Baseline is approximately 10 seconds for sequential build
    const baseline = 10000;
    return Math.max(0, (baseline - currentTime) / baseline);
  }
}

module.exports = BuildSystem;
