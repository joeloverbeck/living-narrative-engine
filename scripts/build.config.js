/**
 * @file Build configuration for Living Narrative Engine
 * Central configuration for the build system
 */

const path = require('path');

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
      entry: 'src/character-concepts-manager-entry.js',
      output: 'character-concepts-manager.js',
    },
    {
      name: 'cliches-generator',
      entry: 'src/cliches-generator-main.js',
      output: 'cliches-generator-main.js',
    },
    {
      name: 'core-motivations-generator',
      entry: 'src/core-motivations-generator-main.js',
      output: 'core-motivations-generator.js',
    },
    {
      name: 'traits-generator',
      entry: 'src/traits-generator-main.js',
      output: 'traits-generator.js',
    },
    {
      name: 'speech-patterns-generator',
      entry: 'src/speech-patterns-generator-main.js',
      output: 'speech-patterns-generator.js',
    },
    {
      name: 'traits-rewriter',
      entry: 'src/traits-rewriter-main.js',
      output: 'traits-rewriter.js',
    },
    {
      name: 'index-llm-selector',
      entry: 'src/index-llm-selector.js',
      output: 'index-llm-selector.js',
    },
    {
      name: 'mod-manager',
      entry: 'src/mod-manager-main.js',
      output: 'mod-manager.js',
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
    'cliches-generator.html',
    'core-motivations-generator.html',
    'traits-generator.html',
    'speech-patterns-generator.html',
    'traits-rewriter.html',
    'mod-manager.html',
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
    define: {
      // Inject environment variables for browser build
      __PROXY_HOST__: JSON.stringify(process.env.PROXY_HOST || 'localhost'),
      __PROXY_PORT__: JSON.stringify(process.env.PROXY_PORT || '3001'),
      __PROXY_USE_HTTPS__: JSON.stringify(
        process.env.PROXY_USE_HTTPS || 'false'
      ),

      // Core environment variables for browser compatibility
      __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
      __DEBUG_LOG_MODE__: JSON.stringify(process.env.DEBUG_LOG_MODE || ''),
      __DEBUG_LOG_SILENT__: JSON.stringify(
        process.env.DEBUG_LOG_SILENT || 'false'
      ),
      __SKIP_DEBUG_CONFIG__: JSON.stringify(
        process.env.SKIP_DEBUG_CONFIG || 'false'
      ),

      // Test mode detection for browser
      __TEST_MODE__: JSON.stringify(
        process.env.NODE_ENV === 'test' ? 'true' : 'false'
      ),

      // Development mode helpers
      __DEVELOPMENT__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      __PRODUCTION__: JSON.stringify(process.env.NODE_ENV === 'production'),
    },
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

  // Performance targets
  performance: {
    targetImprovement: 0.6, // 60% improvement target
    parallelism: true,
    maxConcurrent: 5,
  },

  // Validation settings
  validation: {
    checkEmptyFiles: true,
    minFileSize: 1000, // bytes
    checkSourcemaps: true,
  },
};
