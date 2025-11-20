# Performance Monitoring

This directory contains performance analysis and monitoring tools.

## Files

### performanceDashboard.js

Performance monitoring dashboard for analyzing system performance metrics.

**Purpose**: Provides insights into system performance, bottlenecks, and optimization opportunities.

**How to Run**:
```bash
node tests/monitoring/performanceDashboard.js
```

Or use the convenience script:
```bash
npm run monitoring:performance
```

**What It Does**:
- Analyzes performance metrics across the system
- Identifies performance bottlenecks
- Provides optimization recommendations
- Generates performance reports

**When to Use**:
- During performance optimization work
- Before and after performance-related changes
- When investigating performance regressions
- For regular performance health checks

**Note**: This is an analysis tool, not an automated test. It requires review and interpretation of the results.
