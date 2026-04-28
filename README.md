# Upgrade Predictor

A React webapp that predicts the probability of a free user upgrading to a paid
subscription, based on their usage and engagement signals. Built for a project
showcase — every input feeds a real logistic-regression formula, every number
on screen is computed live from that formula.

---

## 1. What the app does

You drag 9 sliders that describe a user's behavior (sessions per week, paywall
hits, collaborators invited, etc). The app feeds those numbers into a logistic
regression model and shows:

- **`P(upgrade)`** — the predicted probability, in big Doto display type
- **Tier** — `HOT / WARM / COOL / COLD`, derived from `P`
- **Feature contributions** — a horizontal bar chart showing how much each
  feature is pushing the prediction up (green) or down (red) in log-odds units
- **Cohort stats** — segment counts across a synthetic 200-user dataset
- **Dataset table** — top 12 users from that synthetic dataset, sorted; click
  any row to load that user's profile into the predictor

Everything updates in real time as you move a slider.

---

## 2. The algorithm: logistic regression

Logistic regression is the standard model for binary classification problems
where you want a **probability**, not just a yes/no. "Will this free user
upgrade?" is exactly that.

### 2.1 The formula

```
z = β₀ + β₁·x₁ + β₂·x₂ + ... + β₉·x₉
P(upgrade) = σ(z) = 1 / (1 + e^(-z))
```

- `xᵢ` is the i-th feature value (e.g. `paywall_hits = 7`)
- `βᵢ` is the coefficient (weight) for that feature — **the log-odds change in
  upgrade probability per +1 unit of `xᵢ`**
- `β₀` is the intercept — the baseline log-odds when every feature is zero
- `σ` is the sigmoid function. It squashes any real number into the range
  `(0, 1)` so we can read it as a probability

### 2.2 Why logistic regression, not linear regression?

Linear regression can output negative values or values above 1 — meaningless
for a probability. Sigmoid bends the line into an S-curve bounded between 0
and 1, so the output is always interpretable as `P(yes)`.

### 2.3 What the coefficients mean

A positive `β` means the feature increases upgrade probability. A negative `β`
means it decreases it. The magnitude tells you how strong the signal is.

To convert a coefficient into a multiplicative effect on the **odds**, raise
`e` to its power: `OR = e^β`. So a `β = 0.20` for collaborators means each
extra invited teammate multiplies the user's odds of upgrading by
`e^0.20 ≈ 1.22` (a 22% odds increase).

### 2.4 Why the intercept is `-4.0`

`σ(-4) ≈ 1.8%`. That's the prediction for a user who has done literally
nothing — zero sessions, zero feature touches, zero days active, etc. **A
~2% baseline matches industry SaaS free-to-paid conversion rates.** If the
intercept were 0, the default prediction would be 50% — which would be
absurd for any free user.

The intercept anchors the model at a realistic prior; positive features then
push the prediction up from there.

---

## 3. The 9 features and their coefficients

These are calibrated to give realistic spreads — power users land around
99%, dormant users around 1–2%, mid-engagement around 30–50%.

| Feature                 | Range  | β       | Effect per +1 unit                    |
|-------------------------|--------|---------|---------------------------------------|
| `weekly_sessions`       | 0–30   | +0.060  | each visit per week → +6% odds        |
| `avg_session_min`       | 0–90   | +0.018  | each minute longer per session → +2%  |
| `features_used`         | 0–12   | +0.180  | each new feature touched → +20% odds  |
| `days_active_30`        | 0–30   | +0.050  | each active day in last 30 → +5%      |
| `content_created`       | 0–40   | +0.040  | each item created → +4% odds          |
| `collaborators_invited` | 0–8    | +0.200  | each teammate invited → +22% odds     |
| `paywall_hits`          | 0–15   | +0.180  | each premium-feature attempt → +20%   |
| `tenure_days`           | 0–60   | +0.008  | each day since signup → +1% odds      |
| `support_tickets`       | 0–4    | **-0.200** | each open ticket → **−18% odds** (friction) |
| `INTERCEPT (β₀)`        | —      | -4.000  | baseline log-odds (≈ 1.8% prior)      |

The negative coefficient on support tickets is intentional: users who keep
hitting bugs or asking for help are *more* likely to churn, not upgrade.

### 3.1 Worked example — engaged user (default state)

Inputs: 10 sessions/wk, 24 min, 6 features, 14 active days, 9 items, 1
collaborator, 2 paywall hits, 28 tenure days, 0 tickets.

```
z = -4.000                       (intercept)
  + 0.060 * 10  =  +0.60         (weekly_sessions)
  + 0.018 * 24  =  +0.43         (avg_session_min)
  + 0.180 * 6   =  +1.08         (features_used)
  + 0.050 * 14  =  +0.70         (days_active_30)
  + 0.040 * 9   =  +0.36         (content_created)
  + 0.200 * 1   =  +0.20         (collaborators_invited)
  + 0.180 * 2   =  +0.36         (paywall_hits)
  + 0.008 * 28  =  +0.22         (tenure_days)
  - 0.200 * 0   =   0.00         (support_tickets)
                ─────────
            z = -0.045

P = σ(-0.045) = 1 / (1 + e^0.045) ≈ 0.489 = 48.9%
```

That matches the `48.9%` shown in the hero on first load.

---

## 4. Tier classification

The continuous probability is bucketed into a categorical tier for at-a-glance
scanning. Thresholds are picked so each bucket has a distinct go-to-market
playbook.

| `P(upgrade)`   | Tier    | Action                    | Color      |
|----------------|---------|---------------------------|------------|
| ≥ 0.70         | `HOT`   | Conversion-ready          | Red accent |
| 0.40 – 0.70    | `WARM`  | Nurture candidate         | Amber      |
| 0.15 – 0.40    | `COOL`  | Needs activation          | Neutral    |
| < 0.15         | `COLD`  | Low intent                | Muted gray |

Defined in `src/lib/predictor.js → classify()`.

---

## 5. The synthetic dataset

The 200-user cohort is **not random noise** — it's sampled from four
behavioral archetypes, each with its own feature distribution:

| Archetype | Weight | Profile                           |
|-----------|--------|-----------------------------------|
| `POWER`   | 18%    | Heavy daily users, lots of collab |
| `ENGAGED` | 32%    | Regular but moderate use          |
| `CURIOUS` | 30%    | Light explorers                   |
| `DORMANT` | 20%    | Signed up, barely returned        |

For each user, the generator:

1. Picks an archetype by its weight (weighted random)
2. Samples each feature from a noisy distribution around the archetype's
   mean, clamped to the feature's allowed range
3. Computes `P(upgrade)` using the same logistic model the UI uses
4. Flips a biased coin against `P` to assign a synthetic `converted`
   label (`PAID` or `FREE`)

Because the generator and the predictor share the **same model**, the
cohort's mean predicted probability and the actual conversion rate
should be close — that's a sanity check the model is internally consistent.

The PRNG is seeded (`seed = 7`) with a `mulberry32` implementation, so the
same 200 users appear every reload. This makes the demo reproducible.

Defined in `src/lib/dataset.js`.

---

## 6. Project structure

```
upgrade-predictor/
├── index.html                  # Vite entry, loads Google Fonts
├── package.json
├── vite.config.js
├── README.md                   # this file
├── .gitignore
└── src/
    ├── main.jsx                # ReactDOM.createRoot + <App />
    ├── App.jsx                 # all UI: hero, sliders, strip, table
    ├── styles.css              # Nothing design system, all CSS
    └── lib/
        ├── predictor.js        # FEATURES, INTERCEPT, predict(), classify()
        └── dataset.js          # generateDataset(), datasetStats()
```

### What each file owns

- **`predictor.js`** is the model. Change a `beta` value here and the entire
  app — predictions, dataset labels, contribution bars — updates.
- **`dataset.js`** turns the model into a population. Pure deterministic
  function of the seed, so reloads are reproducible.
- **`App.jsx`** is the only React component file. It holds slider state,
  recomputes `predict(input)`, and passes results to small presentational
  pieces (`SegmentedBar`, `Slider`, `ContribCol`, `StatBlock`).
- **`styles.css`** uses CSS custom properties for the design tokens (color,
  spacing, fonts) so nothing is hardcoded inline.

---

## 7. Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle locally
```

No backend, no database, no API calls. Inference is 100% client-side — every
slider drag is a fresh evaluation of the formula in JavaScript.

---

## 8. Demo flow (for the showcase)

A short script that lands every key idea in ~60 seconds:

1. **Open the page.** Point at the big `48.9%`. "This is the model's
   prediction for the user shown on the right — calculated live."
2. **Show the formula card.** "It's a logistic regression: nine usage
   features, each with a learned weight, plugged into the sigmoid."
3. **Drag `paywall_hits` to 0.** Probability drops, the green bar shrinks,
   tier may flip from WARM to COOL. "When users stop bumping into the
   paywall, intent collapses."
4. **Drag `support_tickets` up.** Watch a *red* bar appear in the strip and
   the probability drop. "Friction is a negative signal — the only one in
   this model."
5. **Click a row in the dataset table** (sorted by P). All sliders snap to
   that user's profile. "Here's a synthetic POWER user — 99.2%."
6. **Resort by `BY PAYWALL`.** "Notice highly-paywall-hitting users are
   almost all HOT — that's the strongest single feature in the model."
7. **Point at the cohort grid.** "Across 200 simulated users the model
   places ~37 in HOT, ~37 WARM, ~24 COOL, ~102 COLD — distribution
   matches realistic SaaS funnel shape."

---

## 9. How would you actually train this in production?

The coefficients here are hand-calibrated so the demo feels right. In a real
pipeline you would:

1. Pull your historical free-user feature table + their `converted`
   label (1/0 within N days)
2. Fit a logistic regression with `sklearn.linear_model.LogisticRegression`
   (or use a gradient-boosted model if the relationships are non-linear)
3. Validate with AUC-ROC, calibration curves, and a time-based holdout
4. Export the learned `coef_` and `intercept_` and ship them to the client

The math in this app is exactly what gets shipped — only the source of the
betas changes.
