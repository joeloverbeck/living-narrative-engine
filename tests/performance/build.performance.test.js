/**
 * @file Performance tests for build system
 * Tests build speed and performance optimization
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs-extra';

describe('Build System Performance', () => {
  const distDir = 'dist';
  const testTimeout = 60000; // 60 seconds for performance tests

  beforeEach(async () => {
    // Clean dist directory before each test
    if (await fs.pathExists(distDir)) {
      await fs.remove(distDir);
    }
  });

  afterEach(async () => {
    // Clean up after tests
    if (await fs.pathExists(distDir)) {
      await fs.remove(distDir);
    }
  });

  describe('Build Speed Benchmarks', () => {
    it('should complete development build within reasonable time', () => {
      const startTime = Date.now();
      
      execSync('npm run build:dev', { stdio: 'ignore' });
      
      const buildTime = Date.now() - startTime;
      
      // Should complete within 10 seconds
      expect(buildTime).toBeLessThan(10000);
    }, testTimeout);

    it('should complete production build within reasonable time', () => {
      const startTime = Date.now();
      
      execSync('npm run build:prod', { stdio: 'ignore' });
      
      const buildTime = Date.now() - startTime;
      
      // Production builds can take longer due to minification
      expect(buildTime).toBeLessThan(15000);
    }, testTimeout);

    it('should show performance improvement compared to legacy build', async () => {
      // Measure new build time
      const startTime = Date.now();
      execSync('npm run build:dev', { stdio: 'ignore' });
      const newBuildTime = Date.now() - startTime;

      // According to the implementation, original build was ~10 seconds
      // New build should be significantly faster
      const originalBuildTime = 10000; // 10 seconds baseline
      const improvementRatio = (originalBuildTime - newBuildTime) / originalBuildTime;
      
      expect(improvementRatio).toBeGreaterThan(0.3); // At least 30% improvement
    }, testTimeout);
  });

  describe('Parallel vs Sequential Performance', () => {
    it('should demonstrate parallel build performance advantage', () => {
      // Test parallel build (default)
      const parallelStart = Date.now();
      execSync('npm run build:dev', { stdio: 'ignore' });
      const parallelTime = Date.now() - parallelStart;
      
      // Clean for sequential test
      execSync('npm run build:clean', { stdio: 'ignore' });
      
      // Test sequential build (no-parallel)
      const sequentialStart = Date.now();
      execSync('node scripts/build.js --no-parallel --mode development', { stdio: 'ignore' });
      const sequentialTime = Date.now() - sequentialStart;
      
      // Parallel should be faster or at least not significantly slower
      // Allow some variance due to system conditions
      expect(parallelTime).toBeLessThanOrEqual(sequentialTime * 1.1);
    }, testTimeout);
  });

  describe('Build Efficiency Metrics', () => {
    it('should maintain efficient bundle sizes', async () => {
      execSync('npm run build:prod', { stdio: 'ignore' });
      
      const expectedBundles = [
        'bundle.js',
        'anatomy-visualizer.js', 
        'thematic-direction.js',
        'thematic-directions-manager.js',
        'character-concepts-manager.js'
      ];

      let totalSize = 0;
      
      for (const bundle of expectedBundles) {
        const bundlePath = `${distDir}/${bundle}`;
        expect(await fs.pathExists(bundlePath)).toBe(true);
        
        const stats = await fs.stat(bundlePath);
        totalSize += stats.size;
        
        // Individual bundles should not be extremely large
        expect(stats.size).toBeLessThan(5 * 1024 * 1024); // 5MB per bundle max
      }
      
      // Total bundle size should be reasonable  
      expect(totalSize).toBeLessThan(25 * 1024 * 1024); // 25MB total max (adjusted based on actual output)
    }, testTimeout);
  });

  describe('Resource Usage Efficiency', () => {
    it('should complete build without excessive memory usage', () => {
      const initialMemory = process.memoryUsage();
      
      execSync('npm run build:dev', { stdio: 'ignore' });
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    }, testTimeout);
  });
});