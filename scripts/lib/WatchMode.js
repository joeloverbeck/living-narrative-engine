/**
 * @file Watch mode implementation for build system
 * Monitors file changes and triggers incremental rebuilds
 */

const chokidar = require('chokidar');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');

class WatchMode {
  /**
   * Create a new WatchMode instance
   *
   * @param {object} buildSystem - Build system instance
   */
  constructor(buildSystem) {
    this.buildSystem = buildSystem;
    this.watcher = null;
    this.rebuildQueue = new Set();
    this.isBuilding = false;
    this.debounceTimer = null;
    this.debounceDelay = 300; // ms

    // Track file dependencies
    this.dependencies = new Map();
  }

  /**
   * Start watching for file changes
   */
  async start() {
    console.log(chalk.blue('👁️  Watching for file changes...\n'));

    // Watch patterns
    const watchPatterns = [
      'src/**/*.js',
      '*.html',
      'css/**/*',
      'data/**/*',
      'config/**/*',
    ];

    // Ignore patterns
    const ignored = [
      /node_modules/,
      /\.git/,
      /dist/,
      /coverage/,
      /\.cache/,
      /\.DS_Store/,
    ];

    // Create watcher
    this.watcher = chokidar.watch(watchPatterns, {
      persistent: true,
      ignoreInitial: true,
      ignored,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    // Set up event handlers
    this.watcher
      .on('change', (path) => this.handleChange(path))
      .on('add', (path) => this.handleAdd(path))
      .on('unlink', (path) => this.handleUnlink(path))
      .on('error', (error) => this.handleError(error));

    console.log(chalk.gray('Press Ctrl+C to stop watching\n'));
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Handle file change
   *
   * @param {string} changedPath - Path of changed file
   */
  handleChange(changedPath) {
    this.logChange('changed', changedPath);
    this.queueRebuild(changedPath);
  }

  /**
   * Handle file addition
   *
   * @param {string} addedPath - Path of added file
   */
  handleAdd(addedPath) {
    this.logChange('added', addedPath);
    this.queueRebuild(addedPath);
  }

  /**
   * Handle file deletion
   *
   * @param {string} deletedPath - Path of deleted file
   */
  handleUnlink(deletedPath) {
    this.logChange('deleted', deletedPath);
    this.queueRebuild(deletedPath);
  }

  /**
   * Handle watcher error
   *
   * @param {Error} error - Watcher error
   */
  handleError(error) {
    console.error(chalk.red('Watch error:'), error.message);
  }

  /**
   * Log file change
   *
   * @param {string} action - Change action
   * @param {string} filePath - File path
   */
  logChange(action, filePath) {
    const time = new Date().toLocaleTimeString();
    const relativePath = path.relative(process.cwd(), filePath);

    let icon, color;
    switch (action) {
      case 'changed':
        icon = '✏️';
        color = 'yellow';
        break;
      case 'added':
        icon = '➕';
        color = 'green';
        break;
      case 'deleted':
        icon = '➖';
        color = 'red';
        break;
    }

    console.log(
      chalk.gray(`[${time}]`),
      icon,
      chalk[color](action),
      chalk.cyan(relativePath)
    );
  }

  /**
   * Queue a rebuild
   *
   * @param {string} changedPath - Path that changed
   */
  queueRebuild(changedPath) {
    this.rebuildQueue.add(changedPath);

    // Debounce rebuilds
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processRebuildQueue();
    }, this.debounceDelay);
  }

  /**
   * Process rebuild queue
   */
  async processRebuildQueue() {
    if (this.isBuilding) {
      // Already building, queue will be processed after
      return;
    }

    this.isBuilding = true;

    const files = Array.from(this.rebuildQueue);
    this.rebuildQueue.clear();

    console.log(chalk.blue('\n🔄 Rebuilding...\n'));

    try {
      // Determine what needs rebuilding
      const rebuildTasks = this.analyzeChanges(files);

      // Execute incremental rebuild
      await this.incrementalBuild(rebuildTasks);

      console.log(chalk.green('\n✨ Rebuild completed!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Rebuild failed:'));
      console.error(chalk.red(error.message));

      if (this.buildSystem.options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }

    this.isBuilding = false;

    // Process any new changes that came in during build
    if (this.rebuildQueue.size > 0) {
      setTimeout(() => this.processRebuildQueue(), 100);
    }
  }

  /**
   * Analyze changes to determine rebuild scope
   *
   * @param {Array<string>} changedFiles - Changed file paths
   * @returns {object} Rebuild tasks
   */
  analyzeChanges(changedFiles) {
    const tasks = {
      javascript: new Set(),
      html: new Set(),
      css: false,
      data: false,
      config: false,
      fullRebuild: false,
    };

    for (const file of changedFiles) {
      const ext = path.extname(file);
      const relativePath = path.relative(process.cwd(), file);

      // JavaScript changes
      if (ext === '.js') {
        // Find which bundle this file belongs to
        const bundle = this.findBundleForFile(relativePath);
        if (bundle) {
          tasks.javascript.add(bundle);
        } else {
          // Unknown JS file, trigger full rebuild
          tasks.fullRebuild = true;
          break;
        }
      }

      // HTML changes
      else if (ext === '.html') {
        const htmlFile = path.basename(file);
        if (this.buildSystem.config.htmlFiles.includes(htmlFile)) {
          tasks.html.add(htmlFile);
        }
      }

      // CSS changes
      else if (relativePath.startsWith('css/')) {
        tasks.css = true;
      }

      // Data changes
      else if (relativePath.startsWith('data/')) {
        tasks.data = true;
      }

      // Config changes
      else if (relativePath.startsWith('config/')) {
        tasks.config = true;
      }

      // Build config changes
      else if (file.includes('build.config.js')) {
        tasks.fullRebuild = true;
        break;
      }
    }

    return tasks;
  }

  /**
   * Find which bundle a file belongs to
   *
   * @param {string} filePath - File path
   * @returns {object | null} Bundle configuration
   */
  findBundleForFile(filePath) {
    // For now, use simple heuristics
    // In a real implementation, we'd track dependencies

    for (const bundle of this.buildSystem.config.bundles) {
      // Direct entry point
      if (filePath === bundle.entry) {
        return bundle;
      }

      // Try to match based on path patterns
      const bundleDir = path.dirname(bundle.entry);
      if (filePath.startsWith(bundleDir)) {
        return bundle;
      }
    }

    return null;
  }

  /**
   * Execute incremental rebuild
   *
   * @param {object} tasks - Rebuild tasks
   */
  async incrementalBuild(tasks) {
    // Full rebuild if needed
    if (tasks.fullRebuild) {
      console.log(chalk.yellow('Full rebuild required'));
      await this.buildSystem.build();
      return;
    }

    // JavaScript bundles
    if (tasks.javascript.size > 0) {
      await this.rebuildJavaScript(tasks.javascript);
    }

    // HTML files
    if (tasks.html.size > 0) {
      await this.copyHtmlFiles(tasks.html);
    }

    // CSS directory
    if (tasks.css) {
      await this.copyDirectory('css', 'css');
    }

    // Data directory
    if (tasks.data) {
      await this.copyDirectory('data', 'data');
    }

    // Config directory
    if (tasks.config) {
      await this.copyDirectory('config', 'config');
    }

    // Validate after incremental build
    if (this.buildSystem.options.verbose) {
      const validator = this.buildSystem.validator;
      const result = await validator.validate();
      if (!result.success) {
        console.warn(
          chalk.yellow('⚠️  Validation warnings after incremental build')
        );
      }
    }
  }

  /**
   * Rebuild specific JavaScript bundles
   *
   * @param {Set<object>} bundles - Bundles to rebuild
   */
  async rebuildJavaScript(bundles) {
    const progress = this.buildSystem.progress;
    progress.start(`Rebuilding ${bundles.size} JavaScript bundle(s)`);

    try {
      for (const bundle of bundles) {
        progress.update(`Building ${bundle.name}...`);
        const bundleConfig = this.buildSystem
          .prepareBundleConfigs()
          .find((b) => b.name === bundle.name);

        if (bundleConfig) {
          await this.buildSystem.buildBundle(bundleConfig);
        }
      }

      progress.complete('JavaScript bundles rebuilt');
    } catch (error) {
      progress.error('JavaScript rebuild failed', error);
      throw error;
    }
  }

  /**
   * Copy specific HTML files
   *
   * @param {Set<string>} htmlFiles - HTML files to copy
   */
  async copyHtmlFiles(htmlFiles) {
    const progress = this.buildSystem.progress;
    progress.start(`Copying ${htmlFiles.size} HTML file(s)`);

    try {
      for (const htmlFile of htmlFiles) {
        const destPath = path.join(this.buildSystem.config.distDir, htmlFile);
        await fs.copy(htmlFile, destPath, { overwrite: true });
      }

      progress.complete('HTML files copied');
    } catch (error) {
      progress.error('HTML copy failed', error);
      throw error;
    }
  }

  /**
   * Copy a directory
   *
   * @param {string} source - Source directory
   * @param {string} target - Target directory
   */
  async copyDirectory(source, target) {
    const progress = this.buildSystem.progress;
    progress.start(`Copying ${source} directory`);

    try {
      const destPath = path.join(this.buildSystem.config.distDir, target);
      await fs.copy(source, destPath, { overwrite: true });
      progress.complete(`${source} directory copied`);
    } catch (error) {
      progress.error(`Failed to copy ${source}`, error);
      throw error;
    }
  }
}

module.exports = WatchMode;
