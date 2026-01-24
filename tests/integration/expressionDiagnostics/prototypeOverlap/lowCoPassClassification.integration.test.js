/**
 * @file Integration tests for low co-pass classification using global correlation
 * @see specs/prototype-analysis-global-correlation-enhancement.md
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

const createTestHarness = async (prototypes) => {
  const dom = new JSDOM(
    `
      <!DOCTYPE html>
      <html>
        <body></body>
      </html>
    `,
    {
      url: 'http://localhost',
      pretendToBeVisual: true,
    }
  );

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;

  const bootstrapper = new CommonBootstrapper();
  const result = await bootstrapper.bootstrap({
    containerConfigType: 'minimal',
    worldName: 'default',
    skipModLoading: true,
    postInitHook: async (services, c) => {
      registerExpressionServices(c);
      registerExpressionDiagnosticsServices(c);
      c.setOverride(diagnosticsTokens.ISharedContextPoolGenerator, null);

      const dataRegistry = c.resolve(tokens.IDataRegistry);
      dataRegistry.store('lookups', 'core:emotion_prototypes', {
        entries: prototypes,
      });
      dataRegistry.store('lookups', 'core:sexual_prototypes', {
        entries: {},
      });
    },
  });

  if (!result?.container) {
    throw new Error('Bootstrap failed - container is undefined');
  }

  const container = result.container;
  const analyzer = container.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer);

  return {
    analyzer,
    cleanup: () => {
      if (container?.cleanup) {
        container.cleanup();
      }
      dom.window.close();
      delete global.window;
      delete global.document;
      delete global.navigator;
    },
  };
};

describe('PrototypeOverlapAnalyzer - Low Co-Pass Classification', () => {
  let harness;

  afterEach(() => {
    if (harness?.cleanup) {
      harness.cleanup();
    }
    harness = null;
  });

  it('detects merge with low co-pass ratio using combined correlation', async () => {
    const prototypes = {
      narrow_valence_a: {
        weights: { valence: 0.8, arousal: 0.2 },
        gates: ['valence >= 0.85'],
      },
      narrow_valence_b: {
        weights: { valence: 0.81, arousal: 0.19 },
        gates: ['valence >= 0.85'],
      },
    };

    harness = await createTestHarness(prototypes);

    const result = await harness.analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 4000,
    });

    const mergeRecs = result.recommendations.filter(
      (rec) => rec.type === 'prototype_merge_suggestion'
    );
    expect(mergeRecs.length).toBeGreaterThan(0);

    const closestPair = result.metadata?.summaryInsight?.closestPair;
    if (closestPair) {
      expect(closestPair.correlationSource).toBe('combined');
      expect(closestPair.correlationConfidence).toBe('medium');
    }
  });

  it('avoids merge when selection bias lowers global correlation', async () => {
    const prototypes = {
      bias_a: {
        weights: { valence: 0.7, arousal: 0.1 },
        gates: ['valence >= 0.70'],
      },
      bias_b: {
        weights: { valence: 0.69, arousal: 0.12 },
        gates: ['valence >= 0.60'],
      },
    };

    harness = await createTestHarness(prototypes);

    const result = await harness.analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 4000,
    });

    const mergeRecs = result.recommendations.filter(
      (rec) => rec.type === 'prototype_merge_suggestion'
    );
    expect(mergeRecs.length).toBe(0);

    const closestPair = result.metadata?.summaryInsight?.closestPair;
    if (
      closestPair &&
      Number.isFinite(closestPair.correlation) &&
      Number.isFinite(closestPair.globalOutputCorrelation)
    ) {
      expect(closestPair.correlation).toBeGreaterThan(
        closestPair.globalOutputCorrelation
      );
    }
  });

  it('surfaces correlation source metadata for emotion-like prototypes', async () => {
    const prototypes = {
      calm_like: {
        weights: { valence: 0.5, arousal: -0.7, threat: -0.6 },
        gates: ['threat <= 0.20'],
      },
      content_like: {
        weights: { valence: 0.55, arousal: -0.65, threat: -0.55 },
        gates: ['threat <= 0.20'],
      },
    };

    harness = await createTestHarness(prototypes);

    const result = await harness.analyzer.analyze({
      prototypeFamily: 'emotion',
      sampleCount: 3000,
    });

    const closestPair = result.metadata?.summaryInsight?.closestPair;
    if (closestPair) {
      expect(closestPair.correlationSource).toBeDefined();
      expect(closestPair.correlationConfidence).toBeDefined();
    }
  });
});
