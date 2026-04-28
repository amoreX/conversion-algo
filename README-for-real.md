# README for real

Use this version when explaining the project out loud.

---

## One Sentence

> "It predicts whether a SaaS subscription is likely to show an upgrade event,
> using logistic regression trained on the Kaggle RavenStack subscription
> dataset."

Longer version:

> "I downloaded a public Kaggle SaaS dataset with subscriptions, feature usage,
> support tickets, accounts, and churn events. I aggregate it to subscription
> rows, train a logistic regression on `upgrade_flag`, and expose the model in a
> React UI where the sliders are real engineered dataset fields."

---

## Be Honest About The Data

The dataset is not private production data. It is a public Kaggle dataset called
`SaaS Subscription & Churn Analytics Dataset` by Rivalytics/River.

It is synthetic, but it is not invented inside this app anymore. The CSVs are in
`data/ravenstack`, and the model artifact is regenerated from those files with:

```bash
npm run train:model
```

Do not say the model is highly accurate. Current holdout AUC is about `0.535`,
which is weak. The useful thing this project demonstrates is the full pipeline:
CSV joins, feature engineering, logistic regression, client-side inference, and
explainable feature contributions.

---

## What Is On Screen

- Big number: model-predicted `P(upgrade)`.
- Tier pill: percentile bucket from the model score distribution.
- Sliders: real engineered fields from RavenStack subscriptions.
- Contribution bars: how each standardized feature moves log-odds.
- Cohort stats: counts across all 5,000 subscription records.
- Dataset table: real transformed rows from the Kaggle CSVs.

Click any table row and the sliders load that subscription's values.

---

## The Sliders

| Slider | Meaning |
|---|---|
| Weekly usage | Feature-usage events per subscription week |
| Avg event time | Average minutes per usage event |
| Features used | Distinct product features touched |
| Usage volume | Total usage count |
| Beta touches | Beta-feature events |
| Errors | Logged product errors |
| Seats | Licensed seats |
| MRR | Monthly recurring revenue |
| Tenure | Days from signup to subscription start |
| Support tickets | Account support ticket count |
| Annual billing | `1` if annual, `0` if monthly |
| Auto renew | `1` if enabled, `0` otherwise |

Some coefficients are counterintuitive because this dataset's `upgrade_flag`
does not have strong behavioral separation. That is why the app shows model
metrics instead of pretending the model is perfect.

---

## If Someone Asks About The Old Fake Values

Say:

> "The first version used hand-tuned demo coefficients and generated users. I
> replaced that with the Kaggle RavenStack dataset and a reproducible training
> script, so the current coefficients and slider ranges are generated from CSVs."

---

## Demo Flow

1. Point to the big probability and say it is live client-side inference.
2. Point to the model card: logistic regression, trained from RavenStack CSVs,
   test AUC shown on screen.
3. Move `USAGE VOLUME`, `MRR`, or `ERRORS` and show the probability/contribution
   bars update.
4. Click a top table row and show the sliders snap to that subscription.
5. Sort by `BY MRR` or `BY USAGE` to show the same model against different real
   dataset slices.

Keep the claim tight: dataset-backed and explainable, not magically accurate.
