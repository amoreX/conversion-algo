// Dataset rows generated from Kaggle RavenStack CSVs by scripts/train-model.mjs.

import { DATASET_COLUMNS, DATASET_ROWS } from './modelArtifact.js'
import { MODEL } from './predictor.js'

const DATASET = DATASET_ROWS.map((row) => Object.fromEntries(
  DATASET_COLUMNS.map((column, index) => [column, row[index]])
))

export function generateDataset() {
  return DATASET
}

export function datasetStats(rows) {
  return {
    n: MODEL.dataset_stats.n,
    upgradeRate: MODEL.dataset_stats.upgrade_rate,
    meanP: MODEL.dataset_stats.mean_p,
    hot: MODEL.dataset_stats.hot,
    warm: MODEL.dataset_stats.warm,
    cool: MODEL.dataset_stats.cool,
    cold: MODEL.dataset_stats.cold
  }
}
