// Logistic Regression model for free → paid upgrade prediction.
// P(upgrade) = sigmoid( beta0 + sum(beta_i * x_i) )
//
// Coefficients calibrated on a synthetic SaaS-style cohort. Each one is the
// log-odds change in upgrade probability per +1 unit of the feature.

export const FEATURES = [
  {
    key: 'weekly_sessions',
    label: 'WEEKLY SESSIONS',
    unit: '/wk',
    min: 0,
    max: 30,
    step: 1,
    beta: 0.06,
    hint: 'How often the user opens the app each week.'
  },
  {
    key: 'avg_session_min',
    label: 'AVG SESSION',
    unit: 'MIN',
    min: 0,
    max: 90,
    step: 1,
    beta: 0.018,
    hint: 'Average minutes spent per session.'
  },
  {
    key: 'features_used',
    label: 'FEATURES USED',
    unit: '/12',
    min: 0,
    max: 12,
    step: 1,
    beta: 0.18,
    hint: 'Distinct product features touched.'
  },
  {
    key: 'days_active_30',
    label: 'ACTIVE DAYS',
    unit: '/30D',
    min: 0,
    max: 30,
    step: 1,
    beta: 0.05,
    hint: 'Active days in the last 30.'
  },
  {
    key: 'content_created',
    label: 'CONTENT CREATED',
    unit: 'ITEMS',
    min: 0,
    max: 40,
    step: 1,
    beta: 0.04,
    hint: 'Documents, projects, or items created.'
  },
  {
    key: 'collaborators_invited',
    label: 'COLLABORATORS',
    unit: 'INV.',
    min: 0,
    max: 8,
    step: 1,
    beta: 0.20,
    hint: 'Teammates the user invited. High-signal.'
  },
  {
    key: 'paywall_hits',
    label: 'PAYWALL HITS',
    unit: 'HITS',
    min: 0,
    max: 15,
    step: 1,
    beta: 0.18,
    hint: 'Premium feature attempts blocked. Strong intent.'
  },
  {
    key: 'tenure_days',
    label: 'TENURE',
    unit: 'DAYS',
    min: 0,
    max: 60,
    step: 1,
    beta: 0.008,
    hint: 'Days since signup.'
  },
  {
    key: 'support_tickets',
    label: 'SUPPORT TICKETS',
    unit: 'OPEN',
    min: 0,
    max: 4,
    step: 1,
    beta: -0.20,
    hint: 'Negative signal — friction predicts churn.'
  }
]

export const INTERCEPT = -4.0

export function sigmoid(z) {
  return 1 / (1 + Math.exp(-z))
}

export function logit(input) {
  let z = INTERCEPT
  for (const f of FEATURES) {
    z += f.beta * (Number(input[f.key]) || 0)
  }
  return z
}

export function predict(input) {
  const z = logit(input)
  return sigmoid(z)
}

// Per-feature contribution to the log-odds — used for the breakdown chart.
export function contributions(input) {
  return FEATURES.map((f) => {
    const x = Number(input[f.key]) || 0
    const contrib = f.beta * x
    return {
      key: f.key,
      label: f.label,
      unit: f.unit,
      value: x,
      beta: f.beta,
      contrib,
      sign: contrib >= 0 ? 'pos' : 'neg'
    }
  }).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib))
}

export function classify(p) {
  if (p >= 0.7) return { tier: 'HOT', tone: 'accent', desc: 'CONVERSION READY' }
  if (p >= 0.4) return { tier: 'WARM', tone: 'warning', desc: 'NURTURE CANDIDATE' }
  if (p >= 0.15) return { tier: 'COOL', tone: 'neutral', desc: 'NEEDS ACTIVATION' }
  return { tier: 'COLD', tone: 'muted', desc: 'LOW INTENT' }
}

