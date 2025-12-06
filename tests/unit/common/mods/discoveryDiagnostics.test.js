import { describe, it, expect, beforeEach } from '@jest/globals';
import { DiscoveryDiagnostics } from '../../../common/mods/discoveryDiagnostics.js';

describe('DiscoveryDiagnostics - Trace Collection', () => {
  let mockTestFixture;
  let diagnostics;

  beforeEach(() => {
    mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(['entity1']),
          })),
        },
        getAvailableActions: jest.fn((actorId) => {
          // Simulate the discovery pipeline calling scope resolution
          mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
            'test:scope',
            { actor: { id: actorId } }
          );
          return [{ id: 'test:action1' }, { id: 'test:action2' }];
        }),
      },
    };

    diagnostics = new DiscoveryDiagnostics(mockTestFixture);
  });

  it('should enable and disable diagnostics', () => {
    const original = mockTestFixture.testEnv.unifiedScopeResolver.resolveSync;

    diagnostics.enableDiagnostics();
    const wrapped = mockTestFixture.testEnv.unifiedScopeResolver.resolveSync;
    expect(wrapped).not.toBe(original);

    diagnostics.disableDiagnostics();
    const restored = mockTestFixture.testEnv.unifiedScopeResolver.resolveSync;

    // Should restore to a bound version of the original
    // The implementation uses .bind() so we can't use === comparison
    // Instead verify it still works correctly by calling it
    const result = restored('test:scope', { actor: { id: 'test' } });
    expect(result).toEqual({ success: true, value: new Set(['entity1']) });
  });

  it('should collect trace data during scope resolution', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
    });

    const trace = diagnostics.getTrace();
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      type: 'scope_resolution',
      scope: 'test:scope',
      context: { actorId: 'actor1' },
    });
  });

  it('should track empty scope results', () => {
    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync = jest.fn(() => ({
      success: true,
      value: new Set(), // Empty result
    }));

    diagnostics.enableDiagnostics();
    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:empty_scope',
      {
        actor: { id: 'actor1' },
      }
    );

    const trace = diagnostics.getTrace();
    expect(trace[0].result).toMatchObject({
      success: true,
      count: 0,
      entities: [],
    });
  });

  it('should track failed scope resolutions', () => {
    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync = jest.fn(() => ({
      success: false,
      error: 'Scope not found',
    }));

    diagnostics.enableDiagnostics();
    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:failed_scope',
      {
        actor: { id: 'actor1' },
      }
    );

    const trace = diagnostics.getTrace();
    expect(trace[0].result).toMatchObject({
      success: false,
      error: 'Scope not found',
    });
  });

  it('should track duration for each scope resolution', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
    });

    const trace = diagnostics.getTrace();
    expect(trace[0]).toHaveProperty('duration');
    expect(typeof trace[0].duration).toBe('number');
    expect(trace[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('should clear trace data', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
    });

    expect(diagnostics.getTrace()).toHaveLength(1);

    diagnostics.clearTrace();
    expect(diagnostics.getTrace()).toHaveLength(0);
  });
});

describe('DiscoveryDiagnostics - Diagnostic Output', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should identify empty scopes in hints', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(),
          })),
        },
        getAvailableActions: jest.fn((actorId) => {
          // Simulate discovery calling scope resolution
          mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
            'test:empty_scope',
            { actor: { id: actorId } }
          );
          return [];
        }),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1', 'test:missing_action');

    // Verify debugging hints were printed
    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('returned empty results');
    expect(output).toContain('Check if entities have required components');
  });

  it('should report when expected action is found', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(['entity1']),
          })),
        },
        getAvailableActions: jest.fn(() => [
          { id: 'test:found_action', targets: {} },
        ]),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1', 'test:found_action');

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('WAS FOUND');
    expect(output).not.toContain('WAS NOT FOUND');
  });

  it('should report when expected action is not found', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(['entity1']),
          })),
        },
        getAvailableActions: jest.fn(() => [{ id: 'test:different_action' }]),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1', 'test:missing_action');

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('WAS NOT FOUND');
    expect(output).toContain('DEBUGGING HINTS');
  });

  it('should provide scope resolution statistics', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(['entity1']),
          })),
        },
        getAvailableActions: jest.fn((actorId) => {
          // Simulate discovery calling scope resolution
          mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
            'test:scope',
            { actor: { id: actorId } }
          );
          return [];
        }),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1');

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('SCOPE RESOLUTION STATISTICS');
    expect(output).toContain('Total resolutions');
    expect(output).toContain('Average resolution time');
  });

  it('should identify failed scope resolutions in hints', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: false,
            error: 'Scope not registered',
          })),
        },
        getAvailableActions: jest.fn((actorId) => {
          // Simulate discovery calling scope resolution
          mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
            'test:failed_scope',
            { actor: { id: actorId } }
          );
          return [];
        }),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1', 'test:action');

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('FAILED to resolve');
    expect(output).toContain('Implement custom scope resolver');
  });

  it('should identify slow scope resolutions', () => {
    const mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => {
            // Simulate slow resolution
            const start = Date.now();
            while (Date.now() - start < 101) {
              // Busy wait
            }
            return {
              success: true,
              value: new Set(['entity1']),
            };
          }),
        },
        getAvailableActions: jest.fn((actorId) => {
          // Simulate discovery calling scope resolution
          mockTestFixture.testEnv.unifiedScopeResolver.resolveSync(
            'test:slow_scope',
            { actor: { id: actorId } }
          );
          return [];
        }),
      },
    };

    const diagnostics = new DiscoveryDiagnostics(mockTestFixture);
    diagnostics.enableDiagnostics();

    diagnostics.discoverWithDiagnostics('actor1', 'test:action');

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('were slow');
  });
});

describe('DiscoveryDiagnostics - Context Formatting', () => {
  let mockTestFixture;
  let diagnostics;
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockTestFixture = {
      testEnv: {
        unifiedScopeResolver: {
          resolveSync: jest.fn(() => ({
            success: true,
            value: new Set(['entity1']),
          })),
        },
        getAvailableActions: jest.fn(() => []),
      },
    };

    diagnostics = new DiscoveryDiagnostics(mockTestFixture);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should format context with actor only', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
    });

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('actor=actor1');
  });

  it('should format context with actor and target', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
      target: { id: 'target1' },
    });

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('actor=actor1');
    expect(output).toContain('target=target1');
  });

  it('should format context with all fields', () => {
    diagnostics.enableDiagnostics();

    mockTestFixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {
      actor: { id: 'actor1' },
      target: { id: 'target1' },
      primary: { id: 'primary1' },
      secondary: { id: 'secondary1' },
    });

    const output = consoleSpy.mock.calls
      .map((call) => call.join(' '))
      .join('\n');

    expect(output).toContain('actor=actor1');
    expect(output).toContain('target=target1');
    expect(output).toContain('primary=primary1');
    expect(output).toContain('secondary=secondary1');
  });
});
