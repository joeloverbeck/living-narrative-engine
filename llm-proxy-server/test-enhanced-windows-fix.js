/**
 * @file Test Enhanced Windows Terminal Focus Fix
 * @description Test script to validate the enhanced Windows Terminal fix with real-world log batch sizes
 * 
 * This script simulates the log batch sizes observed in the error logs (306, 336, 500, 450, 495, etc.)
 * to verify that the enhanced fix works with high-volume logging scenarios.
 * 
 * Run with: node test-enhanced-windows-fix.js
 * 
 * Expected behavior:
 * - All log batches appear immediately in Windows Terminal
 * - No dependency on Alt+Tab focus changes  
 * - Consistent display regardless of batch size
 */

import { getEnhancedConsoleLogger } from './src/logging/enhancedConsoleLogger.js';

const logger = getEnhancedConsoleLogger();

/**
 * Test the enhanced Windows Terminal fix with realistic log batch sizes
 */
function testEnhancedWindowsFix() {
  console.log('\n=== Enhanced Windows Terminal Focus Fix Test ===');
  console.log('Testing with realistic log batch sizes from error logs...');
  console.log('Batches should appear immediately without focus changes.\n');

  // Realistic batch sizes from actual error logs
  const batchSizes = [306, 336, 500, 450, 495, 432, 475, 445];
  let currentBatch = 0;
  const batchInterval = 3000; // 3 seconds between batches

  const processBatch = () => {
    if (currentBatch >= batchSizes.length) {
      console.log('\n=== Test Complete ===');
      console.log('If all log batches appeared immediately, the enhanced fix works!');
      console.log('Platform:', process.platform);
      console.log('Node.js version:', process.version);
      console.log('Total logs processed:', batchSizes.reduce((a, b) => a + b, 0));
      process.exit(0);
      return;
    }

    const batchSize = batchSizes[currentBatch];
    const startTime = Date.now();
    
    console.log(`\n--- Processing Batch ${currentBatch + 1}/${batchSizes.length} (${batchSize} logs) ---`);
    
    // Simulate high-volume logging like in the actual system
    for (let i = 1; i <= batchSize; i++) {
      const logLevel = i % 20 === 0 ? 'warn' : i % 50 === 0 ? 'error' : 'debug';
      logger[logLevel](`LogStorageService.writeLogs: Processing log ${i}/${batchSize} in batch ${currentBatch + 1}`, {
        batchNumber: currentBatch + 1,
        logNumber: i,
        totalBatchSize: batchSize,
        timestamp: new Date().toISOString(),
        platform: process.platform,
        testScenario: 'high-volume-batch'
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info(`Batch ${currentBatch + 1} completed: ${batchSize} logs processed in ${duration}ms`, {
      batchNumber: currentBatch + 1,
      logsProcessed: batchSize,
      durationMs: duration,
      logsPerSecond: Math.round((batchSize / duration) * 1000)
    });
    
    currentBatch++;
    
    if (currentBatch < batchSizes.length) {
      console.log(`Next batch starts in ${batchInterval / 1000} seconds...`);
      setTimeout(processBatch, batchInterval);
    } else {
      processBatch(); // Complete the test
    }
  };

  // Start the test
  processBatch();
}

// Run the test
console.log('Starting enhanced Windows Terminal fix test...');
console.log('This test simulates the exact log batch scenarios from your error logs.');
console.log('Watch for immediate log appearance without needing Alt+Tab focus changes.\n');

testEnhancedWindowsFix();