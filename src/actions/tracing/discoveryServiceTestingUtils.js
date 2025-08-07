/**
 * @file Testing utilities for ActionDiscoveryService action tracing
 */

/**
 * Test helper for ActionDiscoveryService action tracing functionality
 */
export class ActionDiscoveryServiceTracingTestHelper {
  #discoveryService;
  #originalGetValidActions;

  constructor(discoveryService) {
    this.#discoveryService = discoveryService;
    this.#originalGetValidActions =
      discoveryService.getValidActions.bind(discoveryService);
  }

  /**
   * Enable tracing for specific test and capture results
   *
   * @param {object} testConfig - Test configuration
   * @returns {object} Test helper with trace capture
   */
  enableTracingForTest(testConfig = {}) {
    const {
      tracedActions = ['*'],
      verbosity = 'standard',
      captureTraceData = true,
    } = testConfig;

    let capturedTraceData = null;

    // Override getValidActions to capture trace data
    this.#discoveryService.getValidActions = async (
      actorEntity,
      baseContext,
      options = {}
    ) => {
      const enhancedOptions = {
        ...options,
        trace: true, // Force tracing for test
      };

      const result = await this.#originalGetValidActions(
        actorEntity,
        baseContext,
        enhancedOptions
      );

      // Capture trace data if requested
      if (captureTraceData && result.context?.trace?.getTracedActions) {
        capturedTraceData = result.context.trace.getTracedActions();
      }

      return result;
    };

    return {
      getCapturedTraceData: () => capturedTraceData,
      resetTracingCapture: () => {
        capturedTraceData = null;
      },
      restoreOriginalMethod: () => {
        this.#discoveryService.getValidActions = this.#originalGetValidActions;
      },
    };
  }
}