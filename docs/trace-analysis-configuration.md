# Trace Analysis Configuration

## Overview

The Living Narrative Engine includes a powerful trace analysis system that can help debug and optimize the action pipeline. This system includes three main tools:

1. **TraceAnalyzer** - Analyzes trace data to identify critical paths, bottlenecks, and performance issues
2. **TraceVisualizer** - Provides visual representations of trace hierarchies and timing information
3. **PerformanceMonitor** - Real-time monitoring with alerts and sampling capabilities

These tools are disabled by default to minimize performance overhead but can be easily enabled through configuration.

## Configuration File

The trace analysis system is configured through the `config/trace-config.json` file. This follows the same pattern as the logger configuration, providing a consistent approach to application configuration.

### Configuration Structure

```json
{
  "traceAnalysisEnabled": false,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 100,
      "criticalOperationMs": 500,
      "maxConcurrency": 10,
      "maxTotalDurationMs": 5000,
      "maxErrorRate": 5,
      "maxMemoryUsageMB": 50
    },
    "sampling": {
      "rate": 1.0,
      "strategy": "random",
      "alwaysSampleErrors": true,
      "alwaysSampleSlow": true,
      "slowThresholdMs": 1000
    }
  },
  "visualization": {
    "enabled": true,
    "options": {
      "showAttributes": true,
      "showTimings": true,
      "showErrors": true,
      "showCriticalPath": true,
      "maxDepth": 0,
      "minDuration": 0,
      "colorsEnabled": true
    }
  },
  "analysis": {
    "enabled": true,
    "bottleneckThresholdMs": 100
  }
}
```

## Enabling Trace Analysis

To enable trace analysis tools:

1. Set `"traceAnalysisEnabled": true` in `config/trace-config.json`
2. Restart the application (or reload if in development mode)
3. The tools will be automatically available on StructuredTrace instances

## Configuration Options

### Global Settings

- `traceAnalysisEnabled` (boolean): Master switch for all trace analysis tools. When false, no analysis tools are loaded.

### Performance Monitoring

Controls the PerformanceMonitor tool:

- `performanceMonitoring.enabled` (boolean): Enable/disable performance monitoring
- `performanceMonitoring.thresholds`: Define performance thresholds that trigger alerts
  - `slowOperationMs`: Operations taking longer than this are flagged as slow
  - `criticalOperationMs`: Operations taking longer than this are flagged as critical
  - `maxConcurrency`: Maximum concurrent operations before alerting
  - `maxTotalDurationMs`: Maximum total trace duration before alerting
  - `maxErrorRate`: Maximum error rate percentage before alerting
  - `maxMemoryUsageMB`: Maximum memory usage before alerting

- `performanceMonitoring.sampling`: Control trace sampling
  - `rate` (0.0-1.0): Percentage of traces to sample
  - `strategy`: Sampling strategy ("random", "adaptive", "error_biased")
  - `alwaysSampleErrors`: Always sample traces with errors
  - `alwaysSampleSlow`: Always sample slow traces
  - `slowThresholdMs`: Threshold for considering a trace "slow"

### Visualization

Controls the TraceVisualizer tool:

- `visualization.enabled` (boolean): Enable/disable visualization
- `visualization.options`: Display options
  - `showAttributes`: Show span attributes in output
  - `showTimings`: Show timing information
  - `showErrors`: Show error details
  - `showCriticalPath`: Highlight the critical path
  - `maxDepth`: Maximum hierarchy depth to display (0 = unlimited)
  - `minDuration`: Minimum duration to display spans
  - `colorsEnabled`: Enable ANSI color codes in output

### Analysis

Controls the TraceAnalyzer tool:

- `analysis.enabled` (boolean): Enable/disable analysis
- `analysis.bottleneckThresholdMs`: Minimum duration to consider an operation a bottleneck

## Using the Analysis Tools

Once enabled, the tools can be accessed through the StructuredTrace instance:

```javascript
// Get the analyzer (returns null if disabled)
const analyzer = await trace.getAnalyzer();
if (analyzer) {
  const criticalPath = analyzer.getCriticalPath();
  const bottlenecks = analyzer.getBottlenecks(100); // 100ms threshold
  const stats = analyzer.getOperationStats();
  const errors = analyzer.getErrorAnalysis();
}

// Get the visualizer (returns null if disabled)
const visualizer = await trace.getVisualizer();
if (visualizer) {
  console.log(visualizer.displayHierarchy());
  console.log(visualizer.displayWaterfall());
  console.log(visualizer.displaySummary());
}

// Get the performance monitor (returns null if disabled)
const monitor = await trace.getPerformanceMonitor();
if (monitor) {
  // Start monitoring
  const stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });

  // Get real-time metrics
  const metrics = monitor.getRealtimeMetrics();

  // Stop monitoring when done
  stopMonitoring();
}
```

## Performance Considerations

The trace analysis tools are designed to have minimal impact when disabled:

1. **Lazy Loading**: Tools are only loaded when first accessed, not at startup
2. **Configuration Check**: A simple boolean check prevents tool initialization when disabled
3. **No Overhead**: When `traceAnalysisEnabled` is false, there's virtually no performance impact

When enabled, the tools do add some overhead:

- TraceAnalyzer: Minimal overhead, performs analysis on-demand
- TraceVisualizer: Minimal overhead, formats output on-demand
- PerformanceMonitor: Can add overhead if monitoring is active with short intervals

## Development vs Production

For development, you might want more detailed analysis:

```json
{
  "traceAnalysisEnabled": true,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 50,
      "criticalOperationMs": 200
    }
  }
}
```

For production, you might want sampling and higher thresholds:

```json
{
  "traceAnalysisEnabled": true,
  "performanceMonitoring": {
    "enabled": true,
    "thresholds": {
      "slowOperationMs": 500,
      "criticalOperationMs": 2000
    },
    "sampling": {
      "rate": 0.1,
      "strategy": "error_biased",
      "alwaysSampleErrors": true
    }
  }
}
```

## Troubleshooting

### Tools Not Available

If `getAnalyzer()`, `getVisualizer()`, or `getPerformanceMonitor()` return null:

1. Check that `traceAnalysisEnabled` is `true`
2. Check that the specific tool is enabled in its section
3. Ensure the configuration file is valid JSON
4. Check the console for any configuration loading errors

### Configuration Not Loading

The configuration is loaded asynchronously during application startup. If you need to ensure it's loaded:

```javascript
import { getTraceConfiguration } from './configuration/utils/traceConfigUtils.js';

const config = getTraceConfiguration(container, tokens);
console.log('Trace analysis enabled:', config.traceAnalysisEnabled);
```

### Performance Impact

If you notice performance degradation with trace analysis enabled:

1. Increase threshold values to reduce alert frequency
2. Disable real-time monitoring in performance-critical sections
3. Use sampling to analyze only a subset of traces
4. Disable specific tools you don't need

## Integration with CI/CD

You can use different configuration files for different environments:

```bash
# Development
cp config/trace-config.dev.json config/trace-config.json

# Production
cp config/trace-config.prod.json config/trace-config.json
```

Or use environment-specific builds that include the appropriate configuration.
