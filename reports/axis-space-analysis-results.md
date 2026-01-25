Axis Space Analysis [Technical Report]
Model Integrity Status
✓
Axis Registry
(?)
✓
Schema Validation
(?)
✓
Weight Ranges
(?)
✓
No Duplicates
(?)
All integrity checks passed. Prototypes validated against axis registry and schema.

Prototypes Analyzed:
110
Recommendations:
1
Confidence:
low
(?)
Confidence reflects how many independent detection methods agree: Low (0-1 methods), Medium (2 methods), High (3-4 methods).

New Axis Recommended?
MAYBE
Residual variance (17.4%) exceeds 15% threshold, indicating unexplained dimensions. However, no strong secondary signals (coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.

How is this determined?
Explained by top 4 PCs:
69.4%
(?)
Expected axis count (K):
6
(?)
Explained by top K PCs:
82.6%
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
17.4%
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
Methodology Note: The broken-stick null hypothesis test found 0 additional significant components. This means the eigenvalue distribution matches random expectation—variance is diffuse across many small components rather than concentrated in discoverable hidden dimensions. High residual variance (17.4%) with 0 extra components suggests the unexplained variance may be noise or idiosyncratic prototype differences, not a missing axis.
Components for 80% Variance:
6
(?)
Components for 90% Variance:
8
(?)
affiliationagency_controlarousalbaseline_libidoengagementfuture_expectancyinhibitory_controlruminationself_controlself_evaluationsexual_arousaltemporal_orientationthreatuncertaintyvalence
Excluded Sparse Axes (9)
Axes used by <10% of prototypes are excluded to prevent sparse axes from distorting PCA due to unbalanced variance contributions from infrequent usage.

affective_empathy
cognitive_empathy
contamination_salience
disgust_sensitivity
evaluation_pressure
evaluation_sensitivity
harm_aversion
ruminative_tendency
sex_inhibition
Unused but Defined Axes (1)
These axes are defined in the weight-axis registry but appear in zero prototype WEIGHTS. Note: They may still be used in gate conditions. Consider adding prototypes that use them in weights, or verify they are not needed in gates before removing.

sex_excitation
Used in Weights but Not in Gates (2)
These axes appear in prototype WEIGHTS but never appear in any prototype gate conditions. Consider adding gates that reference these axes, or verify they are not needed as gates.

baseline_libido
self_control
Extreme Prototypes on Additional Component
Prototypes with highest |projection| on unexplained variance component

romantic_yearning
-0.731
dread
-0.528
sexual_craving
-0.518
sexual_performance_anxiety
-0.510
hope
-0.474
Poorly Fitting Prototypes
Prototypes with highest reconstruction error (don't fit well in current axis space)

dread
RMSE: 0.302
acceptance_settling
RMSE: 0.264
regret
RMSE: 0.254
sexual_performance_anxiety
RMSE: 0.236
lonely_yearning
RMSE: 0.228
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
acceptance_settling Informational
11 active axes, 91% sign diversity
+: agency_control, engagement
−: arousal, rumination, threat, uncertainty, valence
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
10 active axes, 80% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, inhibitory_control, threat
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
sexual_lust Informational
9 active axes, 67% sign diversity
+: arousal, baseline_libido, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
passion Informational
9 active axes, 67% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat, valence
−: agency_control, inhibitory_control, self_control
sexual_sensual_pleasure Informational
8 active axes, 75% sign diversity
+: self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
submissive_arousal Informational
9 active axes, 67% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control
sexual_playfulness Informational
9 active axes, 67% sign diversity
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
fearful_arousal Informational
8 active axes, 100% sign diversity
+: arousal, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
sexual_craving Informational
10 active axes, 100% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal
−: agency_control, inhibitory_control, self_control, valence
sexual_performance_anxiety Informational
12 active axes, 83% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, sexual_arousal, temporal_orientation, uncertainty
−: agency_control, inhibitory_control, self_control, self_evaluation, valence
sexual_frustration Informational
9 active axes, 89% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
aroused_with_disgust Informational
9 active axes, 89% sign diversity
+: arousal, contamination_salience, disgust_sensitivity, sexual_arousal
−: inhibitory_control, self_control, self_evaluation, valence
sexual_indifference Informational
8 active axes, 100% sign diversity
+: inhibitory_control, self_control, sex_inhibition
−: arousal, baseline_libido, engagement, threat
Axis Polarity Coverage
Identifies axes with imbalanced positive/negative weight distributions. An axis dominated by one polarity suggests missing prototype coverage for the opposite direction.

12 imbalanced axes detected
Actionable
ruminative_tendency
100% positive
7 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "ruminative_tendency" values
contamination_salience
100% positive
3 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "contamination_salience" values
disgust_sensitivity
100% positive
3 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "disgust_sensitivity" values
evaluation_sensitivity
100% positive
5 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "evaluation_sensitivity" values
sexual_arousal
100% positive
17 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "sexual_arousal" values
baseline_libido
88% positive
15 prototypes use positive, only 2 use negative
Consider adding prototypes with negative "baseline_libido" values
engagement
87% positive
73 prototypes use positive, only 11 use negative
Consider adding prototypes with negative "engagement" values
affective_empathy
83% positive
5 prototypes use positive, only 1 use negative
Consider adding prototypes with negative "affective_empathy" values
cognitive_empathy
83% positive
5 prototypes use positive, only 1 use negative
Consider adding prototypes with negative "cognitive_empathy" values
evaluation_pressure
83% positive
5 prototypes use positive, only 1 use negative
Consider adding prototypes with negative "evaluation_pressure" values
rumination
82% positive
9 prototypes use positive, only 2 use negative
Consider adding prototypes with negative "rumination" values
harm_aversion
75% positive
3 prototypes use positive, only 1 use negative
Consider adding prototypes with negative "harm_aversion" values
⚠️ Warnings
Axis "rumination" is 82% positive: 9 prototypes use positive weights, only 2 use negative. Consider adding prototypes with negative "rumination" values.
Axis "engagement" is 87% positive: 73 prototypes use positive weights, only 11 use negative. Consider adding prototypes with negative "engagement" values.
Axis "ruminative_tendency" is 100% positive: 7 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "ruminative_tendency" values.
Axis "harm_aversion" is 75% positive: 3 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "harm_aversion" values.
Axis "affective_empathy" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "affective_empathy" values.
Axis "cognitive_empathy" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "cognitive_empathy" values.
Axis "contamination_salience" is 100% positive: 3 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "contamination_salience" values.
Axis "disgust_sensitivity" is 100% positive: 3 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "disgust_sensitivity" values.
Axis "evaluation_sensitivity" is 100% positive: 5 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "evaluation_sensitivity" values.
Axis "evaluation_pressure" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "evaluation_pressure" values.
Axis "sexual_arousal" is 100% positive: 17 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "sexual_arousal" values.
Axis "baseline_libido" is 88% positive: 15 prototypes use positive weights, only 2 use negative. Consider adding prototypes with negative "baseline_libido" values.
Prototype Complexity Analysis
Analyzes the distribution of active axes across prototypes and identifies frequently co-occurring axis bundles that may suggest composite concepts.

Prototypes Analyzed:
110
Average Axis Count:
7.81
Median:
8
Q1 / Q3:
6 / 9
Axis Count Distribution
3 1
4 6
5 10
6 15
7 16
8 16
9 24
10 11
11 7
12 3
13 1
Complexity Outliers (2)
Prototypes with unusually high axis counts (statistical outliers).

sadness
3 axes
moral_outrage
13 axes
Frequently Co-occurring Axis Bundles (20)
Axes that frequently appear together may suggest composite concepts.

arousal
valence
Appears in 95 prototypes Suggested: A_V_composite
self_control
valence
Appears in 91 prototypes Suggested: selfcontrol_V_composite
inhibitory_control
valence
Appears in 84 prototypes Suggested: inhibitorycontrol_V_composite
inhibitory_control
self_control
Appears in 83 prototypes Suggested: inhibitorycontrol_selfcontrol_composite
engagement
valence
Appears in 83 prototypes Suggested: engagement_V_composite
inhibitory_control
self_control
valence
Appears in 82 prototypes Suggested: multi_axis_bundle_3
arousal
self_control
Appears in 79 prototypes Suggested: A_selfcontrol_composite
arousal
self_control
valence
Appears in 78 prototypes Suggested: multi_axis_bundle_3
arousal
inhibitory_control
Appears in 76 prototypes Suggested: A_inhibitorycontrol_composite
agency_control
valence
Appears in 76 prototypes Suggested: agencycontrol_V_composite
arousal
inhibitory_control
valence
Appears in 75 prototypes Suggested: multi_axis_bundle_3
arousal
inhibitory_control
self_control
Appears in 74 prototypes Suggested: multi_axis_bundle_3
arousal
inhibitory_control
self_control
valence
Appears in 73 prototypes Suggested: multi_axis_bundle_4
threat
valence
Appears in 73 prototypes Suggested: threat_V_composite
arousal
engagement
Appears in 71 prototypes Suggested: A_engagement_composite
engagement
self_control
Appears in 71 prototypes Suggested: engagement_selfcontrol_composite
arousal
engagement
valence
Appears in 70 prototypes Suggested: multi_axis_bundle_3
engagement
self_control
valence
Appears in 70 prototypes Suggested: multi_axis_bundle_3
agency_control
arousal
Appears in 68 prototypes Suggested: agencycontrol_A_composite
agency_control
arousal
valence
Appears in 67 prototypes Suggested: multi_axis_bundle_3
Complexity Recommendations (10)
consider_new_axis inhibitory_control + self_control + valence 75% of prototypes (82/110) use all these axes together
consider_new_axis arousal + self_control + valence 71% of prototypes (78/110) use all these axes together
consider_new_axis arousal + inhibitory_control + valence 68% of prototypes (75/110) use all these axes together
consider_new_axis arousal + inhibitory_control + self_control 67% of prototypes (74/110) use all these axes together
consider_new_axis arousal + inhibitory_control + self_control + valence 66% of prototypes (73/110) use all these axes together
consider_new_axis arousal + engagement + valence 64% of prototypes (70/110) use all these axes together
consider_new_axis engagement + self_control + valence 64% of prototypes (70/110) use all these axes together
consider_new_axis agency_control + arousal + valence 61% of prototypes (67/110) use all these axes together
reduce_complexity moral_outrage 1 prototype(s) have unusually high axis counts (>10 axes)
balance_complexity sadness 1 prototype(s) have unusually low axis counts (<6 axes)
Axis Recommendations
low
INVESTIGATE
Residual variance exceeds threshold but broken-stick analysis found no concentrated unexplained dimensions. This suggests variance is diffuse (noise or idiosyncratic differences) rather than a discoverable hidden axis.
Residual variance: 17.4%,Threshold: 15.0%,Additional significant components (broken-stick): 0,Worst-fitting prototypes: dread, acceptance_settling, regret, sexual_performance_anxiety, lonely_yearning,Residual eigenvector top axes: sexual_arousal, temporal_orientation, uncertainty, arousal, engagement,⚠️ sexual_performance_anxiety relies 28% on excluded sparse axes (consider adjusting pcaMinAxisUsageRatio),Suggestion: Review worst-fitting prototypes for potential refinement. Consider whether these represent legitimate outliers or candidates for axis adjustment.
Candidate Axis Validation
Would adding a new axis help? Tests potential axis directions against improvement metrics.

No candidate axes to validate (extraction found 0 significant components, 0 coverage gaps, 0 hub candidates).
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
Why flagged: Projection score -0.731 on unexplained component
dread
Extreme Projection
Top Axes by Weight
threat
+0.850
future_expectancy
-0.850
temporal_orientation
+0.850
rumination
+0.600
valence
-0.600
Why flagged: Projection score -0.528 on unexplained component
sexual_craving
Extreme Projection
Top Axes by Weight
sexual_arousal
+1.000
engagement
+0.700
self_control
-0.600
inhibitory_control
-0.500
arousal
+0.400
Why flagged: Projection score -0.518 on unexplained component
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
Why flagged: Projection score -0.510 on unexplained component
hope
Extreme Projection
Top Axes by Weight
future_expectancy
+0.850
temporal_orientation
+0.550
engagement
+0.350
uncertainty
+0.350
agency_control
+0.250
Why flagged: Projection score -0.474 on unexplained component
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
Why flagged: Projection score -0.444 on unexplained component
aroused_with_shame
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
self_evaluation
-0.800
arousal
+0.400
valence
-0.300
inhibitory_control
+0.300
Why flagged: Projection score -0.441 on unexplained component
sexual_dominant_pleasure
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
agency_control
+0.800
arousal
+0.400
valence
+0.300
self_control
-0.300
Why flagged: Projection score -0.438 on unexplained component
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
Why flagged: Projection score 0.434 on unexplained component
sexual_confidence
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.850
agency_control
+0.750
uncertainty
-0.700
self_evaluation
+0.350
inhibitory_control
+0.300
Why flagged: Projection score -0.421 on unexplained component