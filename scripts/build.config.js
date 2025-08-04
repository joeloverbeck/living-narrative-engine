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
