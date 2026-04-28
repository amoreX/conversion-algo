# Upgrade Predictor

A React/Vite webapp that predicts whether a RavenStack SaaS subscription is
likely to have an `upgrade_flag`, using a logistic regression trained from the
Kaggle RavenStack CSV dataset.

The important change from the original prototype: the cohort, coefficients,
slider ranges, and prediction labels now come from data files in
`data/ravenstack`. They are not hand-calibrated in the UI.

Dataset source:
<https://www.kaggle.com/datasets/rivalytics/saas-subscription-and-churn-analytics-dataset>

---

## What The App Does

The page shows a live upgrade-propensity score for one subscription profile.
Move the sliders and the app recomputes:

- `P(upgrade)` from the trained logistic regression.
- Tier bucket: `HOT`, `WARM`, `COOL`, or `COLD`.
- Standardized log-odds contribution for each feature.
- Segment counts across all 5,000 subscription rows.
- Top 12 dataset rows, sortable by probability, usage, MRR, or tenure.

Clicking a row loads that real transformed subscription record into the sliders.

---

## Dataset

The repo includes the public Kaggle RavenStack files:

```text
data/ravenstack/
├── README.md
├── ravenstack_accounts.csv
├── ravenstack_churn_events.csv
├── ravenstack_feature_usage.csv
├── ravenstack_subscriptions.csv
└── ravenstack_support_tickets.csv
```

The dataset itself is synthetic, but it is an external dataset with a fixed CSV
schema and rows. The app no longer invents archetypes, fake users, fake paywall
hits, or fake coefficients.

Training target:

```text
subscriptions.upgrade_flag
```

Current dataset size after aggregation:

- `5,000` subscription-level training rows
- `10.58%` upgrade-positive rows
- `4,000` train rows
- `1,000` holdout rows

Current model metrics:

- Train AUC: `0.5519`
- Test AUC: `0.5348`
- Train log loss: `0.3429`
- Test log loss: `0.3104`

The AUC is weak. That is a property of this dataset/target relationship, not a
UI bug. The app intentionally shows the trained model as-is instead of inflating
probabilities.

---

## Feature Engineering

`scripts/train-model.mjs` joins the relational CSVs and creates one row per
subscription. These are the current model inputs:

| Slider | Source |
|---|---|
| `weekly_usage_events` | usage events per subscription week |
| `avg_event_minutes` | average `usage_duration_secs` per usage event |
| `features_used` | distinct `feature_name` count |
| `usage_volume` | total `usage_count` |
| `beta_feature_events` | count of `is_beta_feature = true` events |
| `error_count` | total logged usage errors |
| `seats` | `subscriptions.seats` |
| `mrr_amount` | `subscriptions.mrr_amount` |
| `tenure_days` | subscription start minus account signup date |
| `support_tickets` | count of account support tickets |
| `annual_billing` | `billing_frequency = annual` |
| `auto_renew` | `auto_renew_flag` |

Slider max values are derived from the dataset using the 99th percentile, except
binary fields which use `0–1`.

---

## Model

The model is standard logistic regression:

```text
P(upgrade) = σ(β₀ + Σ βᵢ · zscore(xᵢ))
σ(z) = 1 / (1 + e^-z)
```

Features are standardized using training-set mean and standard deviation before
applying the learned coefficients. The contribution chart shows each feature's
standardized log-odds contribution.

Tiers are also dataset-derived:

- `HOT`: top 10% of predicted probabilities
- `WARM`: next 20%
- `COOL`: next 30%
- `COLD`: lower 40%

Current tier thresholds are generated into `src/lib/modelArtifact.js`.

---

## Project Structure

```text
upgrade-predictor/
├── data/ravenstack/             # Kaggle source CSVs
├── scripts/train-model.mjs      # Aggregates CSVs and trains logistic regression
├── src/
│   ├── App.jsx                  # React UI
│   ├── styles.css               # App styling
│   └── lib/
│       ├── dataset.js           # Dataset stats wrapper
│       ├── modelArtifact.js     # Generated model + transformed rows
│       └── predictor.js         # Runtime prediction helpers
├── README.md
├── README-for-real.md
└── package.json
```

Do not edit `src/lib/modelArtifact.js` by hand. Regenerate it from the CSVs.

---

## Commands

```bash
npm install
npm run train:model  # regenerate modelArtifact.js from data/ravenstack
npm run dev          # local dev server
npm run build        # production build
npm run preview      # preview production build
```

The production app is still fully client-side. Training happens ahead of time in
Node, and the browser only evaluates the generated model artifact.
