# Rhombus AI pipeline field report

Public static host for the sanitized observability dashboard. The page contains
scenario-level outcomes and measurements only; it excludes source rows, credentials,
cloud paths, workflow identifiers, screenshots, and raw object hashes.

The private evaluation repository generates the public-safe data with
`data-validation/export_dashboard.py`. To refresh this copy after new runs, point the
exporter at `site/data/runs.json`, then commit and push that file. GitHub Pages deploys
the `site/` directory on each push to `main`.
