#!/usr/bin/env node
/**
 * Manual test script to trigger trace writing directly
 * This bypasses the action execution pipeline to test the trace output system
 */

import { ActionTraceOutputService } from './src/actions/tracing/actionTraceOutputService.js';
import ConsoleLogger from './src/logging/consoleLogger.js';
import FileTraceOutputHandler from './src/actions/tracing/fileTraceOutputHandler.js';

/**
 *
 */
async function testManualTrace() {
  console.log('Testing manual trace writing...\n');

  const logger = new ConsoleLogger();

  // Create a mock trace object that mimics what the action system would generate
  const mockTrace = {
    actionId: 'sex:rub_vagina_over_clothes',
    actorId: 'test_manual_actor',
    isComplete: true,
    hasError: false,
    duration: 125,
    timestamp: Date.now(),

    // Add toJSON method that the output service expects
    toJSON() {
      return {
        actionId: this.actionId,
        actorId: this.actorId,
        isComplete: this.isComplete,
        hasError: this.hasError,
        duration: this.duration,
        timestamp: this.timestamp,
        pipeline: {
          componentFiltering: {
            startTime: Date.now() - 100,
            duration: 10,
            passed: true,
          },
          prerequisiteEvaluation: {
            startTime: Date.now() - 90,
            duration: 15,
            result: true,
          },
          targetResolution: {
            startTime: Date.now() - 75,
            duration: 20,
            resolvedTargets: [{ id: 'target_1', displayName: 'Test Target' }],
          },
          formatting: {
            startTime: Date.now() - 55,
            duration: 5,
            formattedCommand: 'rub vagina over clothes',
          },
        },
        execution: {
          startTime: Date.now() - 50,
          endTime: Date.now(),
          duration: 50,
          result: 'success',
        },
      };
    },

    // Add other methods that might be expected
    getExecutionPhases() {
      return [
        'filtering',
        'prerequisites',
        'resolution',
        'formatting',
        'execution',
      ];
    },
  };

  try {
    console.log('Creating ActionTraceOutputService with file output...');

    // Create the output service directly with file output enabled
    const outputService = new ActionTraceOutputService({
      logger: logger,
      outputToFiles: true,
      outputDirectory: './traces/rub-vagina-debugging',
    });

    console.log('\nManually triggering trace write...');
    console.log('  Action ID:', mockTrace.actionId);
    console.log('  Actor ID:', mockTrace.actorId);
    console.log('  Output Directory: ./traces/rub-vagina-debugging');

    // Trigger the trace write
    await outputService.writeTrace(mockTrace);

    // Wait a bit for async processing
    console.log('\nWaiting for async processing...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for any pending writes
    console.log('Waiting for pending writes...');
    await outputService.waitForPendingWrites();

    console.log('\n✓ Manual trace write completed!');
    console.log('\nCheck the trace directory:');
    console.log('  ls -la traces/rub-vagina-debugging/');

    // Get statistics
    const stats = outputService.getStatistics();
    console.log('\nOutput Service Statistics:');
    console.log('  Total Writes:', stats.totalWrites);
    console.log('  Total Errors:', stats.totalErrors);
    console.log('  Pending Writes:', stats.pendingWrites);
  } catch (error) {
    console.error('✗ Manual trace test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testManualTrace().catch(console.error);
