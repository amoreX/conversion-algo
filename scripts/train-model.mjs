import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = join(ROOT, 'data', 'ravenstack')
const OUT_FILE = join(ROOT, 'src', 'lib', 'modelArtifact.js')
const HOLDOUT_RATE = 0.2
const SEED = 42

const FEATURE_DEFS = [
  {
    key: 'weekly_usage_events',
    label: 'WEEKLY USAGE',
    unit: 'EVT/WK',
    step: 0.1,
    hint: 'Feature-usage events per active subscription week.',
    source: 'feature_usage.usage_id aggregated by subscription duration'
  },
  {
    key: 'avg_event_minutes',
    label: 'AVG EVENT TIME',
    unit: 'MIN',
    step: 0.1,
    hint: 'Average minutes spent per usage event.',
    source: 'feature_usage.usage_duration_secs / usage events'
  },
  {
    key: 'features_used',
    label: 'FEATURES USED',
    unit: 'DISTINCT',
    step: 1,
    hint: 'Distinct RavenStack features used in the subscription.',
    source: 'count distinct feature_usage.feature_name'
  },
  {
    key: 'usage_volume',
    label: 'USAGE VOLUME',
    unit: 'COUNT',
    step: 1,
    hint: 'Total feature usage count logged for the subscription.',
    source: 'sum feature_usage.usage_count'
  },
  {
    key: 'beta_feature_events',
    label: 'BETA TOUCHES',
    unit: 'EVENTS',
    step: 1,
    hint: 'Usage events marked as beta-feature interactions.',
    source: 'count feature_usage.is_beta_feature = true'
  },
  {
    key: 'error_count',
    label: 'ERRORS',
    unit: 'COUNT',
    step: 1,
    hint: 'Logged product errors during feature usage.',
    source: 'sum feature_usage.error_count'
  },
  {
    key: 'seats',
    label: 'SEATS',
    unit: 'LICENSED',
    step: 1,
    hint: 'Licensed seats on the subscription.',
    source: 'subscriptions.seats'
  },
  {
    key: 'mrr_amount',
    label: 'MRR',
    unit: 'USD',
    step: 50,
    hint: 'Monthly recurring revenue for the subscription.',
    source: 'subscriptions.mrr_amount'
  },
  {
    key: 'tenure_days',
    label: 'TENURE',
    unit: 'DAYS',
    step: 1,
    hint: 'Days from account signup to subscription start.',
    source: 'subscriptions.start_date - accounts.signup_date'
  },
  {
    key: 'support_tickets',
    label: 'SUPPORT TICKETS',
    unit: 'COUNT',
    step: 1,
    hint: 'Support tickets linked to the account.',
    source: 'count support_tickets.ticket_id by account'
  },
  {
    key: 'annual_billing',
    label: 'ANNUAL BILLING',
    unit: '0/1',
    step: 1,
    hint: 'Whether the subscription bills annually.',
    source: 'subscriptions.billing_frequency = annual'
  },
  {
    key: 'auto_renew',
    label: 'AUTO RENEW',
    unit: '0/1',
    step: 1,
    hint: 'Whether auto-renew is enabled.',
    source: 'subscriptions.auto_renew_flag'
  }
]

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows
  return body.filter((r) => r.length === header.length).map((r) => {
    const obj = {}
    header.forEach((key, i) => {
      obj[key] = r[i]
    })
    return obj
  })
}

function readCsv(name) {
  return parseCsv(readFileSync(join(DATA_DIR, name), 'utf8'))
}

function parseDate(value) {
  if (!value) return null
  return new Date(`${value.slice(0, 10)}T00:00:00Z`)
}

function daysBetween(a, b) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function bool(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function groupBy(rows, key) {
  const map = new Map()
  for (const row of rows) {
    const id = row[key]
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(row)
  }
  return map
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdev(values) {
  const m = mean(values)
  const variance = mean(values.map((v) => (v - m) ** 2))
  return Math.sqrt(variance) || 1
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] === undefined) return sorted[base]
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function sigmoid(z) {
  const clamped = Math.max(-35, Math.min(35, z))
  return 1 / (1 + Math.exp(-clamped))
}

function auc(pairs) {
  const sorted = [...pairs].sort((a, b) => a.p - b.p)
  const positives = sorted.filter((x) => x.y === 1).length
  const negatives = sorted.length - positives
  if (!positives || !negatives) return 0
  let rankSum = 0
  sorted.forEach((x, i) => {
    if (x.y === 1) rankSum += i + 1
  })
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives)
}

function logLoss(pairs) {
  return mean(pairs.map(({ y, p }) => {
    const clipped = Math.max(1e-9, Math.min(1 - 1e-9, p))
    return -(y * Math.log(clipped) + (1 - y) * Math.log(1 - clipped))
  }))
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits))
}

function js(value) {
  return JSON.stringify(value, null, 2)
}

function buildRows() {
  const accounts = new Map(readCsv('ravenstack_accounts.csv').map((row) => [row.account_id, row]))
  const subscriptions = readCsv('ravenstack_subscriptions.csv')
  const usageBySub = groupBy(readCsv('ravenstack_feature_usage.csv'), 'subscription_id')
  const ticketsByAccount = groupBy(readCsv('ravenstack_support_tickets.csv'), 'account_id')
  const referenceDate = new Date('2025-01-31T00:00:00Z')

  return subscriptions.map((sub) => {
    const account = accounts.get(sub.account_id)
    const usage = usageBySub.get(sub.subscription_id) ?? []
    const tickets = ticketsByAccount.get(sub.account_id) ?? []
    const start = parseDate(sub.start_date)
    const end = parseDate(sub.end_date) ?? referenceDate
    const signup = parseDate(account.signup_date)
    const subscriptionDays = Math.max(1, daysBetween(start, end) + 1)
    const totalDurationSecs = usage.reduce((sum, row) => sum + number(row.usage_duration_secs), 0)
    const usageEvents = usage.length
    const usageVolume = usage.reduce((sum, row) => sum + number(row.usage_count), 0)

    return {
      id: sub.subscription_id,
      account_id: sub.account_id,
      account_name: account.account_name,
      industry: account.industry,
      country: account.country,
      plan_tier: sub.plan_tier,
      billing_frequency: sub.billing_frequency,
      upgraded: bool(sub.upgrade_flag) ? 1 : 0,
      churned: bool(sub.churn_flag) ? 1 : 0,
      weekly_usage_events: (usageEvents / subscriptionDays) * 7,
      avg_event_minutes: totalDurationSecs / Math.max(1, usageEvents) / 60,
      features_used: new Set(usage.map((row) => row.feature_name)).size,
      usage_volume: usageVolume,
      beta_feature_events: usage.filter((row) => bool(row.is_beta_feature)).length,
      error_count: usage.reduce((sum, row) => sum + number(row.error_count), 0),
      seats: number(sub.seats),
      mrr_amount: number(sub.mrr_amount),
      tenure_days: daysBetween(signup, start),
      support_tickets: tickets.length,
      annual_billing: sub.billing_frequency === 'annual' ? 1 : 0,
      auto_renew: bool(sub.auto_renew_flag) ? 1 : 0
    }
  })
}

function train(rows) {
  const rand = mulberry32(SEED)
  const shuffled = rows.map((row, index) => ({ row, index, r: rand() })).sort((a, b) => a.r - b.r)
  const testSize = Math.round(rows.length * HOLDOUT_RATE)
  const testIds = new Set(shuffled.slice(0, testSize).map((x) => x.index))
  const trainRows = rows.filter((_, index) => !testIds.has(index))
  const testRows = rows.filter((_, index) => testIds.has(index))

  const stats = FEATURE_DEFS.map((feature) => {
    const values = trainRows.map((row) => row[feature.key])
    return {
      key: feature.key,
      mean: mean(values),
      scale: stdev(values)
    }
  })

  const x = (row) => stats.map((s) => (row[s.key] - s.mean) / s.scale)
  const positiveRate = mean(trainRows.map((row) => row.upgraded))
  let intercept = Math.log(positiveRate / (1 - positiveRate))
  const weights = FEATURE_DEFS.map(() => 0)
  const learningRate = 0.08
  const regularization = 0.01
  const epochs = 2500

  for (let epoch = 0; epoch < epochs; epoch++) {
    let interceptGradient = 0
    const gradients = weights.map(() => 0)

    for (const row of trainRows) {
      const xs = x(row)
      const p = sigmoid(intercept + weights.reduce((sum, w, i) => sum + w * xs[i], 0))
      const error = p - row.upgraded
      interceptGradient += error
      xs.forEach((value, i) => {
        gradients[i] += error * value
      })
    }

    intercept -= learningRate * (interceptGradient / trainRows.length)
    weights.forEach((weight, i) => {
      weights[i] = weight - learningRate * ((gradients[i] / trainRows.length) + regularization * weight)
    })
  }

  const predict = (row) => sigmoid(intercept + weights.reduce((sum, w, i) => {
    const s = stats[i]
    return sum + w * ((row[s.key] - s.mean) / s.scale)
  }, 0))

  const scoredRows = rows.map((row) => ({
    ...row,
    probability: predict(row)
  }))
  const trainPairs = trainRows.map((row) => ({ y: row.upgraded, p: predict(row) }))
  const testPairs = testRows.map((row) => ({ y: row.upgraded, p: predict(row) }))
  const allProbabilities = scoredRows.map((row) => row.probability)
  const hotThreshold = quantile(allProbabilities, 0.9)
  const warmThreshold = quantile(allProbabilities, 0.7)
  const coolThreshold = quantile(allProbabilities, 0.4)

  return {
    rows: scoredRows,
    features: FEATURE_DEFS.map((feature, i) => {
      const values = rows.map((row) => row[feature.key])
      const sliderMax = feature.step < 1 ? quantile(values, 0.99) : Math.ceil(quantile(values, 0.99))
      return {
        ...feature,
        min: 0,
        max: feature.key === 'annual_billing' || feature.key === 'auto_renew' ? 1 : Math.max(feature.step, sliderMax),
        mean: round(stats[i].mean),
        scale: round(stats[i].scale),
        beta: round(weights[i]),
        raw_beta: round(weights[i] / stats[i].scale)
      }
    }),
    model: {
      target: 'subscriptions.upgrade_flag',
      dataset_rows: rows.length,
      intercept: round(intercept),
      train_rows: trainRows.length,
      test_rows: testRows.length,
      positive_rate: round(mean(rows.map((row) => row.upgraded))),
      train_auc: round(auc(trainPairs), 4),
      test_auc: round(auc(testPairs), 4),
      train_log_loss: round(logLoss(trainPairs), 4),
      test_log_loss: round(logLoss(testPairs), 4),
      tier_thresholds: {
        hot: round(hotThreshold),
        warm: round(warmThreshold),
        cool: round(coolThreshold)
      },
      dataset_stats: {
        n: rows.length,
        upgrade_rate: round(mean(rows.map((row) => row.upgraded))),
        mean_p: round(mean(allProbabilities)),
        hot: scoredRows.filter((row) => row.probability >= hotThreshold).length,
        warm: scoredRows.filter((row) => row.probability >= warmThreshold && row.probability < hotThreshold).length,
        cool: scoredRows.filter((row) => row.probability >= coolThreshold && row.probability < warmThreshold).length,
        cold: scoredRows.filter((row) => row.probability < coolThreshold).length
      },
      source: {
        name: 'RavenStack: Synthetic SaaS Dataset',
        kaggle_ref: 'rivalytics/saas-subscription-and-churn-analytics-dataset',
        license: 'MIT',
        files: [
          'ravenstack_accounts.csv',
          'ravenstack_subscriptions.csv',
          'ravenstack_feature_usage.csv',
          'ravenstack_support_tickets.csv',
          'ravenstack_churn_events.csv'
        ]
      }
    }
  }
}

const rows = buildRows()
const artifact = train(rows)
const datasetColumns = [
  'id',
  'account',
  'industry',
  'country',
  'plan_tier',
  'billing_frequency',
  'probability',
  'upgraded',
  'churned',
  ...FEATURE_DEFS.map((feature) => feature.key)
]

const displayRows = []
const displayIds = new Set()
for (const sortKey of ['probability', 'usage_volume', 'mrr_amount', 'tenure_days']) {
  for (const row of [...artifact.rows].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 50)) {
    if (displayIds.has(row.id)) continue
    displayIds.add(row.id)
    displayRows.push(row)
  }
}

const compactRows = displayRows.map((row) => datasetColumns.map((column) => {
  if (column === 'account') return row.account_name
  if (column === 'probability') return round(row.probability)
  const feature = FEATURE_DEFS.find((item) => item.key === column)
  if (feature) return round(row[column], feature.step < 1 ? 2 : 0)
  return row[column]
}))

const medianInput = Object.fromEntries(artifact.features.map((feature) => {
  const values = rows.map((row) => row[feature.key])
  const digits = feature.step < 1 ? 1 : 0
  return [feature.key, round(quantile(values, 0.5), digits)]
}))

const output = `// Generated by scripts/train-model.mjs from data/ravenstack CSV files.
// Do not edit coefficients by hand; run \`npm run train:model\` after changing data.

export const MODEL = ${js(artifact.model)}

export const FEATURES = ${js(artifact.features)}

export const DEFAULT_INPUT = ${js(medianInput)}

export const DATASET_COLUMNS = ${js(datasetColumns)}

export const DATASET_ROWS = ${js(compactRows)}
`

writeFileSync(OUT_FILE, output)

console.log(`Wrote ${OUT_FILE}`)
console.log(`Rows: ${rows.length}`)
console.log(`Positive rate: ${(artifact.model.positive_rate * 100).toFixed(2)}%`)
console.log(`Train AUC: ${artifact.model.train_auc}`)
console.log(`Test AUC: ${artifact.model.test_auc}`)
