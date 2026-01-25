Axis Space Analysis
Prototypes Analyzed:
108
Recommendations:
0
Confidence:
low
(?)
Confidence reflects how many independent detection methods agree: Low (0-1 methods), Medium (2 methods), High (3-4 methods).

New Axis Recommended?
MAYBE
Residual variance (15.7%) exceeds 15% threshold, indicating unexplained dimensions. However, no strong secondary signals (coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.

How is this determined?
Explained by top 4 PCs:
70.7%
(?)
Expected axis count (K):
6
(?)
Explained by top K PCs:
84.3%
(?)
Signal Sources
✗ FAIL
PCA Analysis:
1
(residual ≥15% triggered)
✓ PASS
Hub Prototypes:
0
(no connectors)
✓ PASS
Coverage Gaps:
0
(adaptive threshold)
✓ PASS
Multi-Axis Conflicts:
0
(high axis count)
Detection Logic: PCA signal triggers when residual variance >15% OR additional components >0. Either condition alone is sufficient for triggering INVESTIGATE recommendations.

Dimensionality Analysis (PCA)
Principal Component Analysis reveals whether the current axis set captures prototype variance. High residual variance suggests missing dimensions.

Residual Variance:
15.7%
(?)
Significant Components (Broken-Stick):
3
(?)
Expected Components (K):
6
(?)
Significant Beyond K:
0 *
(?)
Methodology Note: The broken-stick null hypothesis test found 0 additional significant components. This means the eigenvalue distribution matches random expectation—variance is diffuse across many small components rather than concentrated in discoverable hidden dimensions. High residual variance (15.7%) with 0 extra components suggests the unexplained variance may be noise or idiosyncratic prototype differences, not a missing axis.
Components for 80% Variance:
6
(?)
Components for 90% Variance:
8
(?)
Extreme Prototypes on Additional Component
Prototypes with highest |projection| on unexplained variance component

romantic_yearning
0.720
hope
0.710
dread
0.578
lonely_yearning
0.574
confidence
-0.544
Poorly Fitting Prototypes
Prototypes with highest reconstruction error (don't fit well in current axis space)

dread
RMSE: 0.291
hope
RMSE: 0.272
humiliation
RMSE: 0.255
confusion
RMSE: 0.247
sexual_performance_anxiety
RMSE: 0.237
Hub Prototypes
Prototypes connecting multiple clusters may indicate missing dimensions.

No hub prototypes detected.
Coverage Gaps
Behaviorally-similar prototype clusters (grouped by k-means, not dominant axis) whose weight centroids don't align well with any existing axis.

No coverage gaps detected.
Multi-Axis Conflicts
Prototypes with unusually high axis counts (statistical outliers via Tukey's fence).

No multi-axis conflicts detected.
Sign Tensions (Informational)
Note: Mixed positive/negative weights are normal for emotional prototypes. This section shows structural patterns for understanding, not defects requiring action. Sign tensions do not contribute to confidence scoring or recommendations.

calm Informational
6 active axes, 100% sign diversity
+: inhibitory_control, valence
−: arousal, threat, uncertainty
contentment Informational
5 active axes, 80% sign diversity
+: agency_control, valence
−: arousal, threat, uncertainty
release Informational
7 active axes, 86% sign diversity
+: engagement
−: arousal, inhibitory_control, threat
joy Informational
5 active axes, 80% sign diversity
+: arousal, future_expectancy, valence
−: inhibitory_control
euphoria Informational
6 active axes, 67% sign diversity
+: agency_control, arousal, engagement, valence
−: inhibitory_control, self_control
enthusiasm Informational
6 active axes, 67% sign diversity
+: arousal, engagement, future_expectancy, valence
−: inhibitory_control, self_control
amusement Informational
6 active axes, 100% sign diversity
+: arousal, engagement, valence
−: inhibitory_control, threat
awe Informational
7 active axes, 86% sign diversity
+: arousal, engagement, uncertainty, valence
−: agency_control, inhibitory_control, self_control
aesthetic_appreciation Informational
9 active axes, 67% sign diversity
+: engagement, valence
−: arousal, threat
fascination Informational
5 active axes, 80% sign diversity
+: arousal, engagement, valence
−: inhibitory_control
entranced Informational
8 active axes, 75% sign diversity
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
transfixed Informational
8 active axes, 100% sign diversity
+: arousal, engagement, uncertainty
−: agency_control, inhibitory_control, self_control, threat
quiet_absorption Informational
8 active axes, 100% sign diversity
+: engagement, inhibitory_control, self_control, valence
−: agency_control, arousal, threat, uncertainty
spellbound_absorption Informational
8 active axes, 75% sign diversity
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
focused_absorption Informational
7 active axes, 86% sign diversity
+: agency_control, engagement, inhibitory_control, self_control
−: arousal, threat, uncertainty
grief Informational
7 active axes, 86% sign diversity
+: engagement, rumination, ruminative_tendency
−: agency_control, arousal, temporal_orientation, valence
numbness Informational
6 active axes, 67% sign diversity
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
nostalgia Informational
7 active axes, 86% sign diversity
+: affiliation, engagement, valence
−: temporal_orientation, threat
apathy Informational
6 active axes, 67% sign diversity
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
unease Informational
6 active axes, 67% sign diversity
+: threat
−: valence
apprehension Informational
9 active axes, 67% sign diversity
+: inhibitory_control, self_control, temporal_orientation, threat
−: future_expectancy
stress_acute Informational
9 active axes, 67% sign diversity
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
strain_chronic Informational
9 active axes, 67% sign diversity
+: inhibitory_control, self_control, threat
−: agency_control, arousal, engagement, future_expectancy, valence
anxiety Informational
9 active axes, 89% sign diversity
+: arousal, temporal_orientation, threat, uncertainty
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
craving Informational
8 active axes, 100% sign diversity
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
thrill Informational
5 active axes, 80% sign diversity
+: arousal, threat, valence
−: inhibitory_control, self_control
fear Informational
6 active axes, 67% sign diversity
+: arousal, threat
−: agency_control, inhibitory_control, self_control, valence
terror Informational
7 active axes, 86% sign diversity
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control, valence
panic Informational
8 active axes, 75% sign diversity
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
dread Informational
11 active axes, 91% sign diversity
+: arousal, engagement, rumination, temporal_orientation, threat, uncertainty
−: agency_control, future_expectancy, valence
alarm Informational
6 active axes, 67% sign diversity
+: arousal, inhibitory_control, self_control, threat
−: agency_control, valence
freeze Informational
7 active axes, 86% sign diversity
+: engagement, inhibitory_control, self_control, threat
−: agency_control, valence
suspicion Informational
5 active axes, 80% sign diversity
+: engagement, threat, uncertainty
−: affiliation, valence
irritation Informational
5 active axes, 80% sign diversity
+: arousal
−: inhibitory_control, self_control, valence
frustration Informational
6 active axes, 67% sign diversity
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
smoldering_anger Informational
8 active axes, 75% sign diversity
+: agency_control, engagement, inhibitory_control, self_control, threat
−: affiliation, arousal, valence
protest_anger Informational
8 active axes, 75% sign diversity
+: affiliation, agency_control, arousal, engagement, threat
−: valence
rage Informational
7 active axes, 86% sign diversity
+: agency_control, arousal, threat
−: affiliation, inhibitory_control, self_control, valence
wrath Informational
9 active axes, 89% sign diversity
+: agency_control, arousal, engagement
−: affiliation, inhibitory_control, self_control, valence
resentment Informational
10 active axes, 80% sign diversity
+: arousal, engagement, inhibitory_control, rumination, ruminative_tendency, self_control
−: agency_control, self_evaluation, temporal_orientation, valence
disgust Informational
7 active axes, 86% sign diversity
+: arousal, contamination_salience, disgust_sensitivity
−: engagement, inhibitory_control, self_control, valence
embarrassment Informational
8 active axes, 75% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, inhibitory_control, self_control
−: self_evaluation, valence
awkwardness Informational
8 active axes, 100% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity
−: agency_control, self_control, valence
regret Informational
12 active axes, 67% sign diversity
+: engagement, rumination, ruminative_tendency, self_control, uncertainty
−: self_evaluation, temporal_orientation, valence
humiliation Informational
11 active axes, 91% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, threat
−: affiliation, agency_control, self_evaluation, valence
submission Informational
6 active axes, 67% sign diversity
+: engagement, inhibitory_control, self_control, threat
−: agency_control
trusting_surrender Informational
8 active axes, 75% sign diversity
+: engagement, future_expectancy, valence
−: agency_control, inhibitory_control, self_control, threat
jealousy Informational
10 active axes, 80% sign diversity
+: arousal, engagement, threat, uncertainty
−: affiliation, agency_control, inhibitory_control, self_control, self_evaluation, valence
gratitude Informational
6 active axes, 67% sign diversity
+: affiliation, self_control, valence
−: threat
empathic_distress Informational
11 active axes, 91% sign diversity
+: affective_empathy, affiliation, arousal, engagement
−: agency_control, future_expectancy, inhibitory_control, self_control, self_evaluation, valence
hatred Informational
11 active axes, 73% sign diversity
+: agency_control, arousal, engagement, threat
−: affective_empathy, affiliation, cognitive_empathy, harm_aversion, inhibitory_control, self_control, valence
surprise_startle Informational
6 active axes, 100% sign diversity
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control
confusion Informational
7 active axes, 86% sign diversity
+: engagement, inhibitory_control, uncertainty
−: agency_control
sexual_lust Informational
8 active axes, 75% sign diversity
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
passion Informational
8 active axes, 75% sign diversity
+: arousal, engagement, sexual_arousal, threat, valence
−: agency_control, inhibitory_control, self_control
sexual_sensual_pleasure Informational
7 active axes, 86% sign diversity
+: self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
sexual_playfulness Informational
8 active axes, 75% sign diversity
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
fearful_arousal Informational
7 active axes, 86% sign diversity
+: arousal, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
sexual_craving Informational
9 active axes, 89% sign diversity
+: arousal, engagement, sexual_arousal
−: agency_control, inhibitory_control, self_control, valence
erotic_thrill Informational
8 active axes, 75% sign diversity
+: arousal, engagement, sexual_arousal, threat, valence
−: inhibitory_control, self_control
sexual_performance_anxiety Informational
11 active axes, 91% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, sexual_arousal, temporal_orientation, uncertainty
−: agency_control, inhibitory_control, self_control, self_evaluation, valence
sexual_frustration Informational
8 active axes, 100% sign diversity
+: arousal, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
aroused_with_disgust Informational
8 active axes, 100% sign diversity
+: arousal, contamination_salience, disgust_sensitivity, sexual_arousal
−: inhibitory_control, self_control, self_evaluation, valence
sexual_indifference Informational
7 active axes, 86% sign diversity
+: inhibitory_control, self_control, sex_inhibition
−: arousal, engagement, threat
Axis Recommendations
No axis recommendations generated.
Candidate Axis Validation
Would adding a new axis help? Tests potential axis directions against improvement metrics.

No candidate axes analyzed (validation may be disabled).
Flagged Prototypes Analysis
Prototypes flagged by detection methods with their dominant axis weights.

romantic_yearning
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.600
engagement
+0.600
temporal_orientation
+0.500
future_expectancy
+0.400
uncertainty
+0.400
Why flagged: Projection score 0.720 on unexplained component
hope
Extreme Projection
Top Axes by Weight
future_expectancy
+0.850
temporal_orientation
+0.550
agency_control
+0.450
engagement
+0.350
uncertainty
+0.350
Why flagged: Projection score 0.710 on unexplained component
dread
Extreme Projection
Top Axes by Weight
threat
+0.800
future_expectancy
-0.800
temporal_orientation
+0.800
uncertainty
+0.550
rumination
+0.550
Why flagged: Projection score 0.578 on unexplained component
lonely_yearning
Extreme Projection
Top Axes by Weight
engagement
+0.750
affiliation
-0.650
valence
-0.550
rumination
+0.550
temporal_orientation
+0.450
Why flagged: Projection score 0.574 on unexplained component
confidence
Extreme Projection
Top Axes by Weight
threat
-0.800
agency_control
+0.800
uncertainty
-0.800
valence
+0.400
arousal
+0.200
Why flagged: Projection score -0.544 on unexplained component
suspicion
Extreme Projection
Top Axes by Weight
uncertainty
+0.600
threat
+0.500
engagement
+0.400
affiliation
-0.400
valence
-0.200
Why flagged: Projection score 0.537 on unexplained component
nostalgia
Extreme Projection
Top Axes by Weight
engagement
+1.000
temporal_orientation
-0.850
affiliation
+0.500
valence
+0.250
threat
-0.250
Why flagged: Projection score -0.441 on unexplained component
anxiety
Extreme Projection
Top Axes by Weight
threat
+0.800
uncertainty
+0.800
future_expectancy
-0.600
agency_control
-0.600
temporal_orientation
+0.500
Why flagged: Projection score 0.434 on unexplained component
confusion
Extreme Projection
Top Axes by Weight
uncertainty
+1.000
engagement
+0.350
agency_control
-0.350
inhibitory_control
+0.250
arousal
+0.150
Why flagged: Projection score 0.431 on unexplained component
sexual_performance_anxiety
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
evaluation_pressure
+0.800
uncertainty
+0.700
self_evaluation
-0.500
agency_control
-0.500
Why flagged: Projection score 0.404 on unexplained component