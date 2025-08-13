# CLIGEN-015: Build Configuration & Entry Point

## Summary

Create the entry point file for the Clichés Generator page and update the build configuration to include the new bundle in the esbuild process.

## Parent Issue

- **Phase**: Phase 4 - Testing & Integration
- **Specification**: [Clichés Generator Implementation Specification](../specs/cliches-generator.spec.md)
- **Overview**: [CLIGEN-000](./CLIGEN-000-implementation-overview.md)

## Description

This ticket focuses on setting up the build infrastructure for the Clichés Generator page. This includes creating the entry point file that bootstraps the application, updating the esbuild configuration to create a new bundle, ensuring proper module resolution and dependencies, and verifying the build process works correctly with the new page.

## Acceptance Criteria

- [ ] Entry point file created at `src/cliches-generator-main.js`
- [ ] Build configuration updated in `scripts/build.config.js`
- [ ] New bundle `cliches-generator.js` generated successfully
- [ ] HTML file included in build process
- [ ] All dependencies properly resolved
- [ ] Build completes without errors
- [ ] Bundle size is reasonable (< 500KB)
- [ ] Source maps generated for debugging
- [ ] Production build optimizations applied

## Technical Requirements

### Entry Point File

```javascript
// src/cliches-generator-main.js

/**
 * @file Entry point for the Clichés Generator page
 * @description Bootstraps the Clichés Generator application using the character builder infrastructure
 */

import { ClichesGeneratorController } from './clichesGenerator/controllers/ClichesGeneratorController.js';
import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { setupDependencyContainer } from './dependencyInjection/container.js';
import { registerClichesGeneratorServices } from './dependencyInjection/registrations/clichesGeneratorRegistrations.js';
import { ensureValidLogger } from './utils/loggerUtils.js';

/**
 * Initialize the Clichés Generator application
 */
const initializeClichesGenerator = async () => {
  const logger = ensureValidLogger(console);

  try {
    logger.info('Initializing Clichés Generator...');

    // Setup dependency injection container
    const container = setupDependencyContainer();

    // Register clichés-specific services
    registerClichesGeneratorServices(container);

    // Create bootstrap instance
    const bootstrap = new CharacterBuilderBootstrap({
      container,
      logger,
    });

    // Bootstrap the application
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      pageConfig: {
        title: 'Clichés Generator',
        description: 'Identify overused tropes to avoid',
        requiresConcepts: true,
        requiresDirections: true,
        enableLLM: true,
      },
    });

    if (result.success) {
      logger.info('Clichés Generator initialized successfully');

      // Emit ready event
      window.dispatchEvent(
        new CustomEvent('cliches-generator:ready', {
          detail: { controller: result.controller },
        })
      );
    } else {
      throw new Error(result.error || 'Failed to initialize Clichés Generator');
    }
  } catch (error) {
    logger.error('Failed to initialize Clichés Generator:', error);

    // Display error to user
    displayInitializationError(error);

    // Emit error event
    window.dispatchEvent(
      new CustomEvent('cliches-generator:error', {
        detail: { error },
      })
    );
  }
};

/**
 * Display initialization error to user
 * @param {Error} error - The error that occurred
 */
const displayInitializationError = (error) => {
  const container = document.getElementById('cliches-generator-container');

  if (container) {
    container.innerHTML = `
      <div class="error-state">
        <h2>Failed to Initialize</h2>
        <p>The Clichés Generator could not be loaded.</p>
        <details>
          <summary>Error Details</summary>
          <pre>${error.message}</pre>
        </details>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeClichesGenerator);
} else {
  // DOM already loaded
  initializeClichesGenerator();
}

// Export for testing
export { initializeClichesGenerator };
```

### Service Registration File

```javascript
// src/dependencyInjection/registrations/clichesGeneratorRegistrations.js

/**
 * @file Service registrations specific to the Clichés Generator
 */

import { ClicheGenerator } from '../../clichesGenerator/services/ClicheGenerator.js';
import { tokens } from '../tokens.js';

/**
 * Register Clichés Generator specific services
 * @param {Container} container - Dependency injection container
 */
export const registerClichesGeneratorServices = (container) => {
  // Register ClicheGenerator service
  container.register(tokens.IClicheGenerator, ClicheGenerator, {
    singleton: true,
    dependencies: [tokens.ILLMService, tokens.ILogger, tokens.IValidator],
  });

  // Additional registrations for clichés-specific services
  // These will be added as services are implemented
};
```

### Build Configuration Update

```javascript
// scripts/build.config.js

const { build } = require('esbuild');
const path = require('path');

const bundles = [
  // ... existing bundles (main, anatomy-visualizer, etc.)

  // Add Clichés Generator bundle
  {
    name: 'cliches-generator',
    entry: 'src/cliches-generator-main.js',
    output: 'cliches-generator.js',
    external: [], // No external dependencies for this bundle
  },
];

const htmlFiles = [
  // ... existing HTML files
  'cliches-generator.html', // Add new HTML file
];

/**
 * Build configuration for Clichés Generator bundle
 */
const clichesGeneratorConfig = {
  entryPoints: ['src/cliches-generator-main.js'],
  bundle: true,
  outfile: 'dist/cliches-generator.js',
  format: 'iife',
  globalName: 'ClichesGenerator',
  platform: 'browser',
  target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
  sourcemap: process.env.NODE_ENV !== 'production',
  minify: process.env.NODE_ENV === 'production',
  keepNames: true,
  treeShaking: true,
  metafile: true,
  loader: {
    '.js': 'js',
    '.json': 'json',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development'
    ),
  },
  plugins: [
    // Add any necessary plugins
  ],
};

// Export for use in build script
module.exports = {
  bundles,
  htmlFiles,
  configs: {
    // ... existing configs
    'cliches-generator': clichesGeneratorConfig,
  },
};
```

### Build Script Update

```javascript
// scripts/build.js

const { configs, htmlFiles } = require('./build.config.js');
const fs = require('fs-extra');
const path = require('path');

/**
 * Build all bundles
 */
const buildAll = async () => {
  console.log('Building all bundles...');

  // Ensure dist directory exists
  await fs.ensureDir('dist');

  // Build each bundle
  for (const [name, config] of Object.entries(configs)) {
    console.log(`Building ${name}...`);

    try {
      const result = await build(config);

      if (result.metafile) {
        // Write metafile for bundle analysis
        await fs.writeJson(`dist/${name}.meta.json`, result.metafile, {
          spaces: 2,
        });

        // Log bundle size
        const outfile = config.outfile;
        const stats = await fs.stat(outfile);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  ✓ ${name}: ${sizeKB} KB`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to build ${name}:`, error);
      process.exit(1);
    }
  }

  // Copy HTML files
  console.log('Copying HTML files...');
  for (const htmlFile of htmlFiles) {
    const src = path.join('src', 'pages', htmlFile);
    const dest = path.join('dist', htmlFile);

    if (await fs.pathExists(src)) {
      await fs.copy(src, dest);
      console.log(`  ✓ ${htmlFile}`);
    } else {
      console.warn(`  ⚠ ${htmlFile} not found at ${src}`);
    }
  }

  console.log('Build complete!');
};

// Run build
buildAll().catch(console.error);
```

### Package.json Scripts Update

```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "build:cliches": "node scripts/build.js --only cliches-generator",
    "build:watch": "node scripts/build.js --watch",
    "build:analyze": "node scripts/analyze-bundle.js",
    "dev:cliches": "npm run build:cliches && npm run serve",
    "serve": "http-server dist -p 8080"
  }
}
```

### Development Build Script

```javascript
// scripts/dev-build.js

const { build } = require('esbuild');
const { configs } = require('./build.config.js');
const chokidar = require('chokidar');

/**
 * Development build with watch mode
 */
const devBuild = async (bundleName) => {
  const config = configs[bundleName];

  if (!config) {
    console.error(`Unknown bundle: ${bundleName}`);
    process.exit(1);
  }

  // Add watch mode
  const context = await build({
    ...config,
    sourcemap: 'inline',
    minify: false,
    banner: {
      js: '// Development build - ' + new Date().toISOString(),
    },
    watch: {
      onRebuild(error, result) {
        if (error) {
          console.error('Build failed:', error);
        } else {
          console.log(
            `Rebuilt ${bundleName} at ${new Date().toLocaleTimeString()}`
          );
        }
      },
    },
  });

  console.log(`Watching ${bundleName} for changes...`);

  // Also watch HTML file
  const htmlPath = `src/pages/${bundleName}.html`;
  chokidar.watch(htmlPath).on('change', () => {
    console.log(`HTML changed, copying ${bundleName}.html...`);
    fs.copyFileSync(htmlPath, `dist/${bundleName}.html`);
  });
};

// Get bundle name from command line
const bundleName = process.argv[2] || 'cliches-generator';
devBuild(bundleName);
```

### Bundle Analysis Script

```javascript
// scripts/analyze-bundle.js

const fs = require('fs-extra');
const path = require('path');

/**
 * Analyze bundle sizes and dependencies
 */
const analyzeBundle = async (bundleName) => {
  const metaPath = path.join('dist', `${bundleName}.meta.json`);

  if (!(await fs.pathExists(metaPath))) {
    console.error(`Metafile not found: ${metaPath}`);
    console.log('Run build first to generate metafiles');
    return;
  }

  const meta = await fs.readJson(metaPath);
  const outputs = Object.values(meta.outputs);

  if (outputs.length === 0) {
    console.log('No outputs found in metafile');
    return;
  }

  const output = outputs[0];

  console.log(`\nBundle Analysis: ${bundleName}`);
  console.log('='.repeat(50));

  // Total size
  const totalBytes = output.bytes;
  const totalKB = (totalBytes / 1024).toFixed(2);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

  console.log(`Total Size: ${totalKB} KB (${totalMB} MB)`);

  // Largest inputs
  console.log('\nLargest Dependencies:');
  const inputs = Object.entries(output.inputs)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 10);

  for (const [file, data] of inputs) {
    const sizeKB = (data.bytes / 1024).toFixed(2);
    const percent = ((data.bytes / totalBytes) * 100).toFixed(1);
    console.log(`  ${sizeKB} KB (${percent}%) - ${file}`);
  }

  // Import analysis
  console.log('\nMost Imported Modules:');
  const importCounts = {};

  for (const [file, data] of Object.entries(output.inputs)) {
    if (data.imports) {
      for (const imp of data.imports) {
        importCounts[imp.path] = (importCounts[imp.path] || 0) + 1;
      }
    }
  }

  const sortedImports = Object.entries(importCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [module, count] of sortedImports) {
    console.log(`  ${count}x - ${module}`);
  }
};

// Analyze all bundles or specific one
const bundleName = process.argv[2];

if (bundleName) {
  analyzeBundle(bundleName);
} else {
  // Analyze all bundles
  const distFiles = fs.readdirSync('dist');
  const metaFiles = distFiles.filter((f) => f.endsWith('.meta.json'));

  for (const metaFile of metaFiles) {
    const bundleName = metaFile.replace('.meta.json', '');
    analyzeBundle(bundleName);
  }
}
```

## Implementation Steps

1. **Create Entry Point File** (30 minutes)
   - Implement main initialization logic
   - Setup error handling
   - Configure bootstrap parameters

2. **Create Service Registration** (30 minutes)
   - Define clichés-specific service registrations
   - Setup dependency injection configuration
   - Ensure proper token definitions

3. **Update Build Configuration** (45 minutes)
   - Add new bundle to build config
   - Configure esbuild settings
   - Setup source map generation

4. **Update Build Scripts** (45 minutes)
   - Modify main build script
   - Add development build script
   - Create bundle analysis script

5. **Test Build Process** (30 minutes)
   - Run full build
   - Verify bundle generation
   - Check bundle size
   - Test in browser

6. **Documentation** (30 minutes)
   - Document build commands
   - Add troubleshooting guide
   - Update README

## Dependencies

### Depends On

- CLIGEN-005: ClichesGeneratorController (referenced in entry point)
- CLIGEN-003: ClicheGenerator Service (registered in DI)
- Existing CharacterBuilderBootstrap system
- Existing build infrastructure

### Blocks

- CLIGEN-016: End-to-End Testing (needs built bundle)
- Production deployment
- Performance testing

## Estimated Effort

- **Estimated Hours**: 3 hours
- **Complexity**: Low
- **Risk**: Low (standard build configuration)

## Success Metrics

- [ ] Build completes without errors
- [ ] Bundle size < 500KB
- [ ] Page loads successfully in browser
- [ ] All dependencies resolved correctly
- [ ] Source maps work for debugging
- [ ] Development build with watch mode works
- [ ] Production build is optimized
- [ ] Bundle analysis provides useful insights

## Testing Approach

### Manual Testing

1. Run `npm run build:cliches`
2. Verify `dist/cliches-generator.js` exists
3. Verify `dist/cliches-generator.html` exists
4. Open HTML file in browser
5. Check console for errors
6. Verify page initializes

### Automated Testing

```javascript
// tests/build/cliches-generator-build.test.js
import { describe, it, expect } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

describe('Clichés Generator Build', () => {
  it('should build successfully', () => {
    // Run build
    execSync('npm run build:cliches', { stdio: 'inherit' });

    // Check output files exist
    const jsPath = path.join('dist', 'cliches-generator.js');
    const htmlPath = path.join('dist', 'cliches-generator.html');

    expect(fs.existsSync(jsPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);

    // Check bundle size
    const stats = fs.statSync(jsPath);
    const sizeKB = stats.size / 1024;

    expect(sizeKB).toBeLessThan(500); // Should be under 500KB
  });

  it('should include required modules', () => {
    const bundlePath = path.join('dist', 'cliches-generator.js');
    const content = fs.readFileSync(bundlePath, 'utf-8');

    // Check for key components
    expect(content).toContain('ClichesGeneratorController');
    expect(content).toContain('CharacterBuilderBootstrap');
    expect(content).toContain('ClicheGenerator');
  });
});
```

## Notes

- Use esbuild for fast builds and small bundle sizes
- Ensure proper tree-shaking to minimize bundle size
- Include source maps for development debugging
- Consider code splitting if bundle becomes too large
- Test on multiple browsers for compatibility
- Monitor bundle size over time
- Use metafile for bundle analysis
- Consider adding bundle size budgets

## Related Files

- Entry Point: `src/cliches-generator-main.js`
- Service Registration: `src/dependencyInjection/registrations/clichesGeneratorRegistrations.js`
- Build Config: `scripts/build.config.js`
- Build Script: `scripts/build.js`
- Dev Build: `scripts/dev-build.js`
- Bundle Analysis: `scripts/analyze-bundle.js`
- HTML Page: `src/pages/cliches-generator.html`
- Output Bundle: `dist/cliches-generator.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 4 - Integration)
**Labels**: build, configuration, integration, cliches-generator, phase-4, esbuild
