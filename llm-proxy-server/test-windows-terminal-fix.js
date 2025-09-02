/**
 * @file Test Windows Terminal Focus Fix
 * @description Simple test to demonstrate the Windows Terminal focus-dependent logging fix
 * 
 * This script logs multiple batches of messages to test whether they appear immediately
 * in Windows Terminal without requiring focus changes.
 * 
 * Run with: node test-windows-terminal-fix.js
 * 
 * Expected behavior:
 * - BEFORE FIX: Messages only appear when you Alt+Tab away and back to terminal
 * - AFTER FIX: Messages appear immediately as they are logged
 */

import { ConsoleLogger } from './src/consoleLogger.js';

const logger = new ConsoleLogger();

/**
 * Test the Windows Terminal focus fix by logging batches of messages
 */
function testWindowsTerminalFix() {
  console.log('\n=== Windows Terminal Focus Fix Test ===');
  console.log('This test demonstrates the fix for Windows Terminal buffering issue.');
  console.log('Messages should appear immediately without requiring focus changes.\n');

  let batchNumber = 1;
  const maxBatches = 5;
  const messagesPerBatch = 10;
  const batchInterval = 2000; // 2 seconds between batches

  const logBatch = () => {
    console.log(`\n--- Batch ${batchNumber}/${maxBatches} ---`);
    
    for (let i = 1; i <= messagesPerBatch; i++) {
      logger.info(`Test message ${i} in batch ${batchNumber}`, {
        batchNumber,
        messageNumber: i,
        timestamp: new Date().toISOString(),
        platform: process.platform
      });
    }
    
    console.log(`Batch ${batchNumber} completed at ${new Date().toLocaleTimeString()}`);
    
    if (batchNumber < maxBatches) {
      batchNumber++;
      setTimeout(logBatch, batchInterval);
    } else {
      console.log('\n=== Test Complete ===');
      console.log('If you see all messages immediately without Alt+Tab, the fix works!');
      console.log('Platform:', process.platform);
      console.log('Node.js version:', process.version);
      process.exit(0);
    }
  };

  // Start the test
  logBatch();
}

// Run the test
testWindowsTerminalFix();