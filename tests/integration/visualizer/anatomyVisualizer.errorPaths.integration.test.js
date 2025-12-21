/**
 * @file Integration tests covering error and edge branches for anatomy-visualizer.js.
 *
 * Performance Optimization Notes:
 * - jest.resetModules() is required per-test because anatomy-visualizer.js uses static imports
 * - Spies must be set AFTER resetModules and BEFORE importing anatomy-visualizer.js
 * - Shared fetch mock to avoid repeated file I/O
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  performSharedBootstrap,
  cleanupSharedBootstrap,
  waitForCondition,
  TEST_TIMEOUT_MS,
} from '../../common/visualizer/visualizerTestUtils.js';

const VISUALIZER_HTML = `
  <div id="anatomy-visualizer-container">
    <header id="anatomy-header">
      <h1>Anatomy Visualizer</h1>
      <button id="back-button" class="menu-button">Back to Menu</button>
    </header>
    <div id="anatomy-content">
      <div id="error-output"></div>
    </div>
  </div>
`;

describe('anatomy-visualizer entrypoint error handling', () => {
  let readyStateValue;
  let sharedBootstrapContext;

  beforeAll(async () => {
    sharedBootstrapContext = await performSharedBootstrap();
  });

  afterAll(() => {
    cleanupSharedBootstrap();
    sharedBootstrapContext = null;
  });

  async function mockBootstrapWithSharedContext(wrapPostInitHook = null) {
    const bootstrapperModule = await import(
      '../../../src/bootstrapper/CommonBootstrapper.js'
    );
    const { CommonBootstrapper } = bootstrapperModule;

    jest
      .spyOn(CommonBootstrapper.prototype, 'bootstrap')
      .mockImplementation(async function wrapBootstrap(options = {}) {
        const { postInitHook, ...rest } = options;
        const wrappedHook =
          typeof wrapPostInitHook === 'function'
            ? wrapPostInitHook(postInitHook)
            : postInitHook;

        if (typeof wrappedHook === 'function') {
          await wrappedHook(
            sharedBootstrapContext.services,
            sharedBootstrapContext.container
          );
        }

        return {
          container: sharedBootstrapContext.container,
          services: sharedBootstrapContext.services,
        };
      });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    readyStateValue = 'complete';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });

    document.body.innerHTML = VISUALIZER_HTML;
    global.alert = jest.fn();
    // Use shared bootstrap fetch mock to keep services consistent
    global.fetch = sharedBootstrapContext.fetchMock;
    window.fetch = sharedBootstrapContext.fetchMock;
  });

  afterEach(() => {
    delete document.readyState;
    delete global.fetch;
    delete window.fetch;
    delete global.alert;
    document.body.innerHTML = '';
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it(
    'logs a warning when ClothingManagementService is unavailable',
    async () => {
      // Import AFTER resetModules so spies are on the same instances anatomy-visualizer.js will use
      const tokensModule = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      const { tokens } = tokensModule;

      await mockBootstrapWithSharedContext((postInitHook) => {
        if (typeof postInitHook !== 'function') {
          return postInitHook;
        }

        return async (services, container) => {
          container.setOverride(tokens.ClothingManagementService, () => {
            throw new Error(
              'Clothing service unavailable for integration coverage test.'
            );
          });
          try {
            return await postInitHook(services, container);
          } finally {
            container.clearOverride(tokens.ClothingManagementService);
          }
        };
      });

      const warnSpy = jest.spyOn(sharedBootstrapContext.services.logger, 'warn');

      const { default: AnatomyVisualizerUI } = await import(
        '../../../src/domUI/AnatomyVisualizerUI.js'
      );
      const uiInitializeSpy = jest.spyOn(
        AnatomyVisualizerUI.prototype,
        'initialize'
      );

      await import('../../../src/anatomy-visualizer.js');

      await waitForCondition(() => uiInitializeSpy.mock.calls.length > 0);
      await waitForCondition(() => warnSpy.mock.calls.length > 0);

      const warnMessages = warnSpy.mock.calls.map((call) => call[0]);
      expect(warnMessages).toContain(
        'ClothingManagementService not available - equipment panel will be disabled'
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    'handles missing back button gracefully',
    async () => {
      await mockBootstrapWithSharedContext();
      const backButton = document.getElementById('back-button');
      backButton?.remove();

      const { default: AnatomyVisualizerUI } = await import(
        '../../../src/domUI/AnatomyVisualizerUI.js'
      );
      const uiInitializeSpy = jest.spyOn(
        AnatomyVisualizerUI.prototype,
        'initialize'
      );

      await import('../../../src/anatomy-visualizer.js');

      await waitForCondition(() => uiInitializeSpy.mock.calls.length > 0);

      expect(document.getElementById('back-button')).toBeNull();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'propagates initialization failures through the fatal error handler',
    async () => {
      await mockBootstrapWithSharedContext();
      const { default: AnatomyVisualizerUI } = await import(
        '../../../src/domUI/AnatomyVisualizerUI.js'
      );
      jest
        .spyOn(AnatomyVisualizerUI.prototype, 'initialize')
        .mockImplementation(async () => {
          throw new Error('UI initialization failed');
        });

      const bootstrapperModule = await import(
        '../../../src/bootstrapper/CommonBootstrapper.js'
      );
      const { CommonBootstrapper } = bootstrapperModule;
      const fatalSpy = jest.spyOn(
        CommonBootstrapper.prototype,
        'displayFatalStartupError'
      );

      await import('../../../src/anatomy-visualizer.js');

      await waitForCondition(() => fatalSpy.mock.calls.length === 1);

      const [message, error] = fatalSpy.mock.calls[0];
      expect(message).toContain(
        'Failed to initialize anatomy visualizer: UI initialization failed'
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('UI initialization failed');
    },
    TEST_TIMEOUT_MS
  );
});
