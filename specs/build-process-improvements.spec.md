# Build Process Improvements Specification

## Overview

This specification outlines the implementation of a robust, maintainable build system for the Living Narrative Engine to replace the current single-line build command that has become unwieldy and error-prone.

## Goals

1. **Reliability**: Ensure all files are consistently copied and built correctly
2. **Performance**: Leverage parallel execution for faster builds (target: 60% improvement)
3. **Maintainability**: Create a modular, well-structured build system
4. **Developer Experience**: Provide clear progress feedback and error reporting
5. **Flexibility**: Support different build modes (development, production, watch)

## Current Issues to Address

1. Missing `character-concepts-manager.html` file in build output
2. Single-line command difficult to debug and maintain
3. Sequential execution missing parallelization opportunities
4. No build validation or error recovery
5. Platform-specific shell command issues

## Architecture

### Core Components

```
scripts/
├── build.js              # Main build orchestrator
├── build.config.js       # Build configuration
├── lib/
│   ├── BuildSystem.js    # Core build system class
│   ├── BuildProgress.js  # Progress reporting
│   ├── BuildValidator.js # Output validation
│   └── BuildError.js     # Custom error handling
└── utils/
    ├── fileUtils.js      # File operations
    ├── parallelUtils.js  # Parallel execution
    └── logUtils.js       # Logging utilities
```

### Build Pipeline Stages

1. **Initialization** - Clean dist, validate environment
2. **JavaScript Bundling** - Parallel esbuild execution
3. **Static Asset Copying** - HTML, CSS, data, config
4. **Validation** - Verify all expected outputs
5. **Reporting** - Success/failure summary

## Implementation Details

### 1. Build Configuration Schema

```javascript
// build.config.js
module.exports = {
  // Output directory
  distDir: 'dist',

  // JavaScript bundles configuration
  bundles: [
    {
      name: 'main',
      entry: 'src/main.js',
      output: 'bundle.js',
    },
    {
      name: 'anatomy-visualizer',
      entry: 'src/anatomy-visualizer.js',
      output: 'anatomy-visualizer.js',
    },
    {
      name: 'thematic-direction',
      entry: 'src/thematic-direction-main.js',
      output: 'thematic-direction.js',
    },
    {
      name: 'thematic-directions-manager',
      entry: 'src/thematicDirectionsManager/thematicDirectionsManagerMain.js',
      output: 'thematic-directions-manager.js',
    },
    {
      name: 'character-concepts-manager',
      entry: 'src/character-concepts-manager-main.js',
      output: 'character-concepts-manager.js',
    },
  ],

  // HTML files (explicit list to prevent missing files)
  htmlFiles: [
    'index.html',
    'game.html',
    'anatomy-visualizer.html',
    'character-concepts-manager.html',
    'thematic-direction-generator.html',
    'thematic-directions-manager.html',
  ],

  // Static asset directories
  staticDirs: [
    { source: 'css', target: 'css' },
    { source: 'data', target: 'data' },
    { source: 'config', target: 'config' },
  ],

  // Individual asset patterns
  assetPatterns: ['*.ico', '*.png', '*.webmanifest'],

  // esbuild options
  esbuildOptions: {
    platform: 'browser',
    sourcemap: true,
    target: 'es2020',
    format: 'iife',
  },

  // Build modes
  modes: {
    development: {
      minify: false,
      sourcemap: true,
    },
    production: {
      minify: true,
      sourcemap: false,
    },
  },
};
```

### 2. Core Build System Class

```javascript
// lib/BuildSystem.js
class BuildSystem {
  constructor(config) {
    this.config = config;
    this.progress = new BuildProgress();
    this.validator = new BuildValidator(config);
    this.errors = [];
    this.startTime = null;
  }

  async build(options = {}) {
    this.startTime = Date.now();

    try {
      await this.initialize();
      await this.buildJavaScript(options);
      await this.copyStaticAssets();
      await this.validate();
      this.reportSuccess();
    } catch (error) {
      this.reportFailure(error);
      throw error;
    }
  }

  async initialize() {
    this.progress.start('Initializing build');
    await this.cleanDistDirectory();
    await this.ensureDirectories();
    this.progress.complete('Initialization complete');
  }

  async buildJavaScript(options) {
    this.progress.start('Building JavaScript bundles');
    const bundles = this.prepareBundleConfigs(options);

    // Parallel execution
    const results = await Promise.allSettled(
      bundles.map((bundle) => this.buildBundle(bundle))
    );

    this.handleBuildResults(results);
    this.progress.complete('JavaScript bundling complete');
  }

  async copyStaticAssets() {
    this.progress.start('Copying static assets');

    // Copy HTML files with validation
    await this.copyHtmlFiles();

    // Copy directories
    await this.copyDirectories();

    // Copy individual assets
    await this.copyAssetPatterns();

    this.progress.complete('Static assets copied');
  }

  async validate() {
    this.progress.start('Validating build output');
    const validationResult = await this.validator.validate();

    if (!validationResult.success) {
      throw new BuildError('Validation failed', validationResult.errors);
    }

    this.progress.complete('Validation successful');
  }
}
```

### 3. Progress Reporting System

```javascript
// lib/BuildProgress.js
class BuildProgress {
  constructor() {
    this.steps = [];
    this.currentStep = null;
    this.startTime = Date.now();
  }

  start(message) {
    this.currentStep = {
      message,
      startTime: Date.now(),
      status: 'running',
    };

    console.log(chalk.blue(`▶ ${message}...`));
  }

  complete(message) {
    if (this.currentStep) {
      this.currentStep.endTime = Date.now();
      this.currentStep.status = 'completed';
      this.steps.push(this.currentStep);

      const duration = this.currentStep.endTime - this.currentStep.startTime;
      console.log(chalk.green(`✓ ${message} (${duration}ms)`));
    }
  }

  error(message, error) {
    console.log(chalk.red(`✗ ${message}`));
    if (error) {
      console.error(chalk.red(`  ${error.message}`));
    }
  }

  summary() {
    const totalTime = Date.now() - this.startTime;
    console.log(chalk.bold('\nBuild Summary:'));
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Steps completed: ${this.steps.length}`);
  }
}
```

### 4. Build Validation System

```javascript
// lib/BuildValidator.js
class BuildValidator {
  constructor(config) {
    this.config = config;
    this.requiredFiles = this.buildRequiredFilesList();
  }

  buildRequiredFilesList() {
    const files = [];

    // JavaScript bundles
    this.config.bundles.forEach((bundle) => {
      files.push(path.join(this.config.distDir, bundle.output));
    });

    // HTML files
    this.config.htmlFiles.forEach((htmlFile) => {
      files.push(path.join(this.config.distDir, htmlFile));
    });

    // Add other required files...
    return files;
  }

  async validate() {
    const errors = [];
    const warnings = [];

    // Check required files
    for (const file of this.requiredFiles) {
      if (!(await fs.pathExists(file))) {
        errors.push({
          type: 'missing_file',
          file,
          message: `Required file missing: ${file}`,
        });
      }
    }

    // Check file sizes
    await this.validateFileSizes(errors, warnings);

    // Check sourcemaps if enabled
    await this.validateSourcemaps(errors, warnings);

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateFileSizes(errors, warnings) {
    // Validate that bundles aren't empty
    for (const bundle of this.config.bundles) {
      const filePath = path.join(this.config.distDir, bundle.output);

      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          errors.push({
            type: 'empty_file',
            file: filePath,
            message: `Bundle is empty: ${bundle.output}`,
          });
        } else if (stats.size < 1000) {
          warnings.push({
            type: 'small_file',
            file: filePath,
            message: `Bundle unusually small: ${bundle.output} (${stats.size} bytes)`,
          });
        }
      }
    }
  }
}
```

### 5. Package.json Script Updates

```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "build:dev": "node scripts/build.js --mode=development",
    "build:prod": "node scripts/build.js --mode=production",
    "build:watch": "node scripts/build.js --watch",
    "build:clean": "rimraf dist",
    "build:validate": "node scripts/build.js --validate-only",
    "build:debug": "node scripts/build.js --verbose --no-parallel",
    "prebuild": "npm run build:clean"
  }
}
```

### 6. CLI Options Support

```javascript
// scripts/build.js
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
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
  .help().argv;
```

### 7. Watch Mode Implementation

```javascript
// lib/WatchMode.js
class WatchMode {
  constructor(buildSystem) {
    this.buildSystem = buildSystem;
    this.watcher = null;
    this.rebuildQueue = new Set();
    this.isBuilding = false;
  }

  async start() {
    console.log(chalk.blue('Starting watch mode...'));

    // Initial build
    await this.buildSystem.build();

    // Setup file watching
    this.watcher = chokidar.watch(
      ['src/**/*.js', '*.html', 'css/**/*', 'data/**/*', 'config/**/*'],
      {
        persistent: true,
        ignoreInitial: true,
      }
    );

    this.watcher
      .on('change', (path) => this.handleChange(path))
      .on('add', (path) => this.handleChange(path))
      .on('unlink', (path) => this.handleChange(path));
  }

  async handleChange(changedPath) {
    console.log(chalk.yellow(`File changed: ${changedPath}`));

    this.rebuildQueue.add(changedPath);

    if (!this.isBuilding) {
      await this.processRebuildQueue();
    }
  }

  async processRebuildQueue() {
    this.isBuilding = true;

    const files = Array.from(this.rebuildQueue);
    this.rebuildQueue.clear();

    try {
      // Determine what needs rebuilding
      const rebuildTasks = this.analyzeChanges(files);

      // Execute incremental rebuild
      await this.incrementalBuild(rebuildTasks);
    } catch (error) {
      console.error(chalk.red('Rebuild failed:'), error);
    }

    this.isBuilding = false;

    // Process any new changes that came in during build
    if (this.rebuildQueue.size > 0) {
      await this.processRebuildQueue();
    }
  }
}
```

### 8. Error Handling

```javascript
// lib/BuildError.js
class BuildError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BuildError';
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  format() {
    const lines = [
      chalk.red.bold(`Build Error: ${this.message}`),
      chalk.gray(`Time: ${this.timestamp}`),
    ];

    if (this.details.step) {
      lines.push(chalk.yellow(`Step: ${this.details.step}`));
    }

    if (this.details.errors && this.details.errors.length > 0) {
      lines.push(chalk.red('\nErrors:'));
      this.details.errors.forEach((error, index) => {
        lines.push(chalk.red(`  ${index + 1}. ${error.message}`));
        if (error.file) {
          lines.push(chalk.gray(`     File: ${error.file}`));
        }
      });
    }

    if (this.stack) {
      lines.push(chalk.gray('\nStack trace:'));
      lines.push(chalk.gray(this.stack));
    }

    return lines.join('\n');
  }
}
```

## Performance Optimizations

### 1. Parallel Execution

- Run all JavaScript bundles in parallel using `Promise.allSettled()`
- Copy static assets concurrently where possible
- Target: 60% reduction in build time

### 2. Incremental Builds

- Track file dependencies
- Only rebuild affected bundles
- Smart cache invalidation

### 3. Build Caching

```javascript
// lib/BuildCache.js
class BuildCache {
  constructor(cacheDir = '.build-cache') {
    this.cacheDir = cacheDir;
    this.manifest = {};
  }

  async get(key) {
    const hash = this.calculateHash(key);
    const cachePath = path.join(this.cacheDir, hash);

    if (await fs.pathExists(cachePath)) {
      const cached = await fs.readJson(cachePath);
      if (this.isValid(cached)) {
        return cached.data;
      }
    }

    return null;
  }

  async set(key, data) {
    const hash = this.calculateHash(key);
    const cachePath = path.join(this.cacheDir, hash);

    await fs.ensureDir(this.cacheDir);
    await fs.writeJson(cachePath, {
      key,
      data,
      timestamp: Date.now(),
      version: BUILD_CACHE_VERSION,
    });
  }
}
```

## Testing Strategy

### 1. Unit Tests

```javascript
// tests/unit/build/BuildSystem.test.js
describe('BuildSystem', () => {
  let buildSystem;
  let mockConfig;

  beforeEach(() => {
    mockConfig = createMockBuildConfig();
    buildSystem = new BuildSystem(mockConfig);
  });

  describe('initialization', () => {
    it('should clean dist directory', async () => {
      await buildSystem.initialize();
      expect(fs.remove).toHaveBeenCalledWith('dist');
    });

    it('should create required directories', async () => {
      await buildSystem.initialize();
      expect(fs.ensureDir).toHaveBeenCalledWith('dist');
    });
  });

  describe('JavaScript building', () => {
    it('should build all bundles in parallel', async () => {
      const buildSpy = jest.spyOn(buildSystem, 'buildBundle');
      await buildSystem.buildJavaScript();

      expect(buildSpy).toHaveBeenCalledTimes(5);
      // Verify parallel execution
    });

    it('should handle build failures gracefully', async () => {
      // Test error handling
    });
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/build.integration.test.js
describe('Build System Integration', () => {
  it('should produce valid build output', async () => {
    const buildSystem = new BuildSystem(realConfig);
    await buildSystem.build();

    // Verify all expected files exist
    const validator = new BuildValidator(realConfig);
    const result = await validator.validate();

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

## Migration Plan

### Phase 1: Immediate Fix (1-2 hours)

1. Create temporary build script addressing HTML copying issue
2. Test all HTML files are copied correctly
3. Update package.json to use temporary script

### Phase 2: Core Implementation (4-6 hours)

1. Implement BuildSystem class
2. Create build configuration
3. Implement parallel JavaScript building
4. Add progress reporting

### Phase 3: Enhanced Features (2-4 hours)

1. Implement watch mode
2. Add incremental builds
3. Create build caching system
4. Add performance metrics

### Phase 4: Testing & Documentation (2-3 hours)

1. Write comprehensive tests
2. Test on different platforms
3. Create usage documentation
4. Write troubleshooting guide

## Rollback Plan

If issues arise, the original build command will be preserved as:

```json
{
  "scripts": {
    "build:legacy": "esbuild src/main.js --bundle --outfile=dist/bundle.js --platform=browser --sourcemap && ..."
  }
}
```

## Success Metrics

1. **Reliability**: 100% of expected files present in build output
2. **Performance**: 60% reduction in build time
3. **Error Recovery**: Clear error messages for all failure scenarios
4. **Developer Satisfaction**: Positive feedback on clarity and usability

## Dependencies

- `esbuild`: Existing bundler (no change)
- `fs-extra`: Enhanced file operations
- `chalk`: Terminal colors for progress
- `chokidar`: File watching for dev mode
- `yargs`: CLI argument parsing
- `ora`: Spinner for long operations (optional)

## Configuration Examples

### Development Build

```bash
npm run build:dev
# Fast build with sourcemaps, no minification
```

### Production Build

```bash
npm run build:prod
# Optimized build with minification, no sourcemaps
```

### Watch Mode

```bash
npm run build:watch
# Continuous rebuilding on file changes
```

### Debug Mode

```bash
npm run build:debug
# Verbose output, sequential execution for debugging
```

## Future Enhancements

1. **Bundle Analysis**: Size reporting and visualization
2. **Asset Optimization**: Image compression, CSS minification
3. **Build Notifications**: Desktop notifications for build status
4. **Remote Caching**: Share build cache across team
5. **Plugin System**: Extensible build pipeline

## Conclusion

This specification provides a comprehensive solution to the current build system issues while establishing a foundation for future enhancements. The modular architecture ensures maintainability, while the focus on performance and developer experience addresses the immediate pain points.
