import { resolveReportWorkerUrl } from '../../../src/domUI/expression-diagnostics/reportWorkerUrl.js';

describe('resolveReportWorkerUrl', () => {
  it('resolves worker URL from an absolute module URL', () => {
    const result = resolveReportWorkerUrl({
      moduleUrl: 'http://localhost/src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js',
      documentBaseUrl: 'http://localhost/expression-diagnostics.html',
    });

    expect(result).toEqual({
      url: 'http://localhost/src/expressionDiagnostics/workers/MonteCarloReportWorker.js',
      type: 'module',
    });
  });

  it('resolves worker URL from a relative module URL', () => {
    const result = resolveReportWorkerUrl({
      moduleUrl: 'src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js',
      documentBaseUrl: 'http://localhost/expression-diagnostics.html',
    });

    expect(result).toEqual({
      url: 'http://localhost/src/expressionDiagnostics/workers/MonteCarloReportWorker.js',
      type: 'module',
    });
  });

  it('falls back to the document base when module URL is unavailable', () => {
    const result = resolveReportWorkerUrl({
      documentBaseUrl: 'http://localhost/expression-diagnostics.html',
    });

    expect(result).toEqual({
      url: 'http://localhost/expressionDiagnostics/workers/MonteCarloReportWorker.js',
      type: 'classic',
    });
  });

  it('returns null when no usable base URL exists', () => {
    const result = resolveReportWorkerUrl({
      moduleUrl: '::not-a-url::',
      documentBaseUrl: 'not-a-url',
    });

    expect(result).toBeNull();
  });
});
