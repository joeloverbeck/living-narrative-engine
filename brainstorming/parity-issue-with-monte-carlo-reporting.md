# Parity issue with Monte Carlo reporting

For the expression nervous_arousal.expression.json, we get a non-report output in the expression-diagnostics.html 'Top Blockers' like this:

Top Blockers
Rank	Clause	Fail %	Last-Mile	Recommendation	Severity
▼	1	AND of 18 conditions	100.00%	
100.00%
Decisive blocker but values are far from threshold - adjust prototypes
critical
Violation
worst Δ: 59.82 (moodAxes.threat >= 20)
most tunable: sexualArousal >= 0.35 (6.54%)

Note that it mentions that the most tunable is sexualArousal >= 0.35. From there it would follow that if we go to the 'Global Expression Sensitivity', sexualArousal should be there. But it isn't:

🎯 Global Expression Sensitivity
Shows how adjusting thresholds affects the entire expression trigger rate, not just individual clause pass rates.

⚠️
All sensitivity analyses have fewer than 5 baseline expression hits. Results may not be statistically meaningful.
emotions.awkwardness >= [threshold]
Threshold	Trigger Rate	Change	Samples
0.15	0%	0%	10.000
0.20	0%	0%	10.000
0.25	0%	0%	10.000
0.30	0%	0%	10.000
0.35	0%	baseline	10.000
0.40	0%	0%	10.000
0.45	0%	0%	10.000
0.50	0%	0%	10.000
0.55	0%	0%	10.000
emotions.freeze >= [threshold]
Threshold	Trigger Rate	Change	Samples
0.00	0%	0%	10.000
0.05	0%	0%	10.000
0.10	0%	0%	10.000
0.15	0%	0%	10.000
0.20	0%	baseline	10.000
0.25	0%	0%	10.000
0.30	0%	0%	10.000
0.35	0%	0%	10.000
0.40	0%	0%	10.000
emotions.anxiety >= [threshold]
Threshold	Trigger Rate	Change	Samples
0.15	0%	0%	10.000
0.20	0%	0%	10.000
0.25	0%	0%	10.000
0.30	0%	0%	10.000
0.35	0%	baseline	10.000
0.40	0%	0%	10.000
0.45	0%	0%	10.000
0.50	0%	0%	10.000
0.55	0%	0%	10.000

## Likely problem

I suspect that the 'Global Expression Sensitivity' section only handles the values in the emotions lookup file in data/mods/core/lookups/ , not the sexual_state lookup nor the sexualArousal value (sexualArousal is calculated independently of the other values.) This should be thoroughly investigated so that there is a parity with how the 'Global Expression Sensitivity' (both in the report and non-report versions; take opportunity to refactor the code if possible to avoid any duplication) offers information about sensitivity for emotions, sexual states, and sexualArousal.

