/**
 * @file Discovery diagnostic tools for action discovery pipeline
 * @description Provides detailed tracing and debugging hints for action discovery issues
 */

/**
 * Diagnostic wrapper for action discovery pipeline
 * Traces every step and provides actionable debugging hints
 */
export class DiscoveryDiagnostics {
  constructor(testFixture) {
    this.testFixture = testFixture;
    this.trace = [];
    this.originalResolvers = new Map();
  }

  /**
   * Enable diagnostic mode - wraps key components with tracing
   */
  enableDiagnostics() {
    this._wrapScopeResolver();
  }

  /**
   * Disable diagnostic mode and restore original behavior
   */
  disableDiagnostics() {
    // Restore original scope resolver
    if (this.originalResolvers.has('scopeResolver')) {
      this.testFixture.testEnv.unifiedScopeResolver.resolveSync =
        this.originalResolvers.get('scopeResolver');
    }
  }

  /**
   * Discover actions with full diagnostic output
   *
   * @param {string} actorId - Actor to discover actions for
   * @param {string} [expectedActionId] - Optional action ID to look for
   * @returns {Array} Discovered actions (synchronous)
   */
  discoverWithDiagnostics(actorId, expectedActionId = null) {
    this.trace = [];

    console.log('\n' + '='.repeat(80));
    console.log(`🔍 ACTION DISCOVERY DIAGNOSTICS: ${actorId}`);
    if (expectedActionId) {
      console.log(`   Looking for: ${expectedActionId}`);
    }
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();
    const actions = this.testFixture.testEnv.getAvailableActions(actorId);
    const duration = Date.now() - startTime;

    this._printDiagnosticReport(actions, expectedActionId, duration);

    return actions;
  }

  /**
   * Wrap scope resolver to trace all resolution attempts
   */
  _wrapScopeResolver() {
    const original =
      this.testFixture.testEnv.unifiedScopeResolver.resolveSync.bind(
        this.testFixture.testEnv.unifiedScopeResolver
      );
    this.originalResolvers.set('scopeResolver', original);

    this.testFixture.testEnv.unifiedScopeResolver.resolveSync = (
      scopeName,
      context
    ) => {
      const startTime = Date.now();
      const result = original(scopeName, context);
      const duration = Date.now() - startTime;

      const traceEntry = {
        type: 'scope_resolution',
        scope: scopeName,
        context: {
          actorId: context?.actor?.id,
          targetId: context?.target?.id,
          primaryId: context?.primary?.id,
          secondaryId: context?.secondary?.id,
        },
        result: result.success
          ? {
              success: true,
              count: result.value.size,
              entities: Array.from(result.value),
            }
          : { success: false, error: result.error },
        duration,
      };

      this.trace.push(traceEntry);

      // Log immediately for real-time feedback
      console.log(`  📊 Scope: ${scopeName}`);
      console.log(`     Context: ${this._formatContext(traceEntry.context)}`);

      if (result.success) {
        const count = result.value.size;
        if (count === 0) {
          console.log(`     Result: 0 entities ❌`);
        } else {
          console.log(`     Result: ${count} entities ✅`);
          if (count <= 5) {
            // Show entities if not too many
            console.log(
              `     Entities: [${Array.from(result.value).join(', ')}]`
            );
          }
        }
      } else {
        console.log(`     Result: FAILED ❌`);
        console.log(`     Error: ${result.error || 'Unknown error'}`);
      }

      console.log(`     Time: ${duration}ms\n`);

      return result;
    };
  }

  /**
   * Format context for display
   *
   * @param context
   */
  _formatContext(context) {
    const parts = [];
    if (context.actorId) parts.push(`actor=${context.actorId}`);
    if (context.targetId) parts.push(`target=${context.targetId}`);
    if (context.primaryId) parts.push(`primary=${context.primaryId}`);
    if (context.secondaryId) parts.push(`secondary=${context.secondaryId}`);
    return parts.length > 0 ? parts.join(', ') : 'none';
  }

  /**
   * Print comprehensive diagnostic report
   *
   * @param actions
   * @param expectedActionId
   * @param duration
   */
  _printDiagnosticReport(actions, expectedActionId, duration) {
    console.log('\n' + '-'.repeat(80));
    console.log('📋 DISCOVERY SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total time: ${duration}ms`);
    console.log(`Total actions discovered: ${actions.length}`);

    if (actions.length > 0) {
      console.log(
        `Action IDs: [${actions
          .map((a) => a.id)
          .slice(0, 10)
          .join(', ')}${actions.length > 10 ? '...' : ''}]`
      );
    }

    if (expectedActionId) {
      const found = actions.some((a) => a.id === expectedActionId);
      if (found) {
        console.log(`\n✅ Expected action '${expectedActionId}' WAS FOUND`);
        const action = actions.find((a) => a.id === expectedActionId);
        console.log(`   Targets: ${JSON.stringify(action.targets || {})}`);
      } else {
        console.log(`\n❌ Expected action '${expectedActionId}' WAS NOT FOUND`);
        console.log('\n🔍 DEBUGGING HINTS:');
        this._provideDiagnosticHints(expectedActionId);
      }
    }

    // Show scope statistics
    console.log('\n📊 SCOPE RESOLUTION STATISTICS:');
    this._printScopeStatistics();

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Provide specific debugging hints based on trace analysis
   *
   * @param expectedActionId
   */
  _provideDiagnosticHints(expectedActionId) {
    const scopeTraces = this.trace.filter((t) => t.type === 'scope_resolution');

    // Find empty scopes
    const emptyScopes = scopeTraces.filter(
      (t) => t.result.success && t.result.count === 0
    );

    if (emptyScopes.length > 0) {
      console.log(
        `\n   ⚠️  ${emptyScopes.length} scope(s) returned empty results:`
      );
      emptyScopes.forEach((t) => {
        console.log(`      - ${t.scope}`);
        console.log(`        Context: ${this._formatContext(t.context)}`);
        console.log(`        💡 Check if entities have required components`);
        console.log(`        💡 Verify entities are in correct location/state`);
      });
    }

    // Find failed scopes
    const failedScopes = scopeTraces.filter((t) => !t.result.success);
    if (failedScopes.length > 0) {
      console.log(`\n   ❌ ${failedScopes.length} scope(s) FAILED to resolve:`);
      failedScopes.forEach((t) => {
        console.log(`      - ${t.scope}`);
        console.log(`        Error: ${t.result.error || 'Unknown'}`);
        console.log(
          `        💡 Implement custom scope resolver for this scope`
        );
        console.log(
          `        💡 Check if scope is registered in test environment`
        );
      });
    }

    // Find slow scopes
    const slowScopes = scopeTraces.filter((t) => t.duration > 100);
    if (slowScopes.length > 0) {
      console.log(`\n   ⏱️  ${slowScopes.length} scope(s) were slow (>100ms):`);
      slowScopes.forEach((t) => {
        console.log(`      - ${t.scope}: ${t.duration}ms`);
      });
    }

    // General suggestions
    console.log(`\n   📖 GENERAL DEBUGGING STEPS:`);
    console.log(`      1. Check action file exists: data/mods/.../actions/`);
    console.log(`      2. Verify action ID matches: '${expectedActionId}'`);
    console.log(`      3. Check required_components on actor/targets`);
    console.log(`      4. Verify prerequisite conditions are met`);
    console.log(
      `      5. Enable MODTESTROB-001 validation to catch action definition errors`
    );
  }

  /**
   * Print scope resolution statistics
   */
  _printScopeStatistics() {
    const scopeTraces = this.trace.filter((t) => t.type === 'scope_resolution');

    if (scopeTraces.length === 0) {
      console.log('   No scope resolutions traced');
      return;
    }

    const stats = {
      total: scopeTraces.length,
      successful: scopeTraces.filter((t) => t.result.success).length,
      failed: scopeTraces.filter((t) => !t.result.success).length,
      empty: scopeTraces.filter((t) => t.result.success && t.result.count === 0)
        .length,
      nonEmpty: scopeTraces.filter(
        (t) => t.result.success && t.result.count > 0
      ).length,
      avgDuration:
        scopeTraces.reduce((sum, t) => sum + t.duration, 0) /
        scopeTraces.length,
    };

    console.log(`   Total resolutions: ${stats.total}`);
    console.log(`   Successful: ${stats.successful} ✅`);
    console.log(`   Failed: ${stats.failed} ❌`);
    console.log(
      `   Empty results: ${stats.empty} ${stats.empty > 0 ? '⚠️' : ''}`
    );
    console.log(`   Non-empty results: ${stats.nonEmpty}`);
    console.log(
      `   Average resolution time: ${stats.avgDuration.toFixed(2)}ms`
    );
  }

  /**
   * Get trace data for programmatic analysis
   */
  getTrace() {
    return [...this.trace];
  }

  /**
   * Clear trace data
   */
  clearTrace() {
    this.trace = [];
  }
}
