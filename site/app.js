const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const formatNumber = (value) => value === null || value === undefined
  ? '—' : new Intl.NumberFormat('en-AU').format(value);

const formatBytes = (value) => {
  if (value === null || value === undefined) return 'Not recorded';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(1)} ${unit}`;
};

const formatDuration = (value) => value === null || value === undefined
  ? 'Not recorded' : `${Number(value).toFixed(value % 1 ? 1 : 0)} s`;

const statusLabel = (value) => ({
  silent_data_failure: 'Silent data failure',
  pipeline_failure: 'Pipeline failure',
  awaiting_three_runs: 'Needs 3 runs',
  not_recorded: 'Not recorded',
  local_validation: 'Local oracle',
  untested: 'Untested',
}[value] || String(value).replaceAll('_', ' '));

function renderSummary(data) {
  const summary = data.summary;
  document.querySelector('#metric-runs').textContent = formatNumber(summary.platform_runs);
  document.querySelector('#metric-success').textContent = summary.platform_runs
    ? `${Math.round(summary.platform_successes / summary.platform_runs * 100)}%` : '—';
  document.querySelector('#metric-success-note').textContent =
    `${summary.platform_successes} of ${summary.platform_runs} runs reported success`;
  document.querySelector('#metric-data-fail').textContent = formatNumber(summary.validation_failures);
  document.querySelector('#metric-cases').textContent =
    `${summary.observed_scenarios}/${summary.total_scenarios}`;
  document.querySelector('#metric-cases-note').textContent =
    `${summary.total_scenarios - summary.observed_scenarios} scenarios have no platform run`;
  document.querySelector('#updated-at').textContent = `Archive refreshed ${new Date(data.generated_at).toLocaleString('en-AU')}`;
  document.querySelector('#map-summary').textContent =
    `${summary.observed_scenarios} scenario(s) observed · ${summary.platform_failures} execution failure(s) · ${summary.validation_failures} data-quality failure(s)`;
}

function renderScenarios(scenarios) {
  const grid = document.querySelector('#scenario-grid');
  const filter = document.querySelector('#scenario-filter');
  grid.innerHTML = scenarios.map((scenario) => {
    const runMeta = scenario.platform_runs
      ? `${scenario.platform_successes}/${scenario.platform_runs} platform runs reported success · ${scenario.validation_failures} validation failure(s)`
      : 'No platform outcome archived';
    return `<article class="scenario-card ${escapeHtml(scenario.capability)}">
      <div class="scenario-top"><span class="scenario-family">${escapeHtml(scenario.family)}</span>
        <span class="status-tag">${escapeHtml(statusLabel(scenario.capability))}</span></div>
      <h3>${escapeHtml(scenario.label)}</h3>
      <div class="scenario-meta">${escapeHtml(runMeta)}</div>
    </article>`;
  }).join('');
  scenarios.forEach((scenario) => {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.label;
    filter.append(option);
  });
}

function renderRuns(runs, selectedScenario = 'all') {
  const visibleRuns = selectedScenario === 'all'
    ? runs : runs.filter((run) => run.scenario_id === selectedScenario);
  const body = document.querySelector('#run-table');
  if (!visibleRuns.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">No matching reports.</td></tr>';
    return;
  }
  body.innerHTML = visibleRuns.map((run, index) => {
    const runStatus = run.run_type === 'local_validation' ? 'local_validation' : run.platform_status;
    const rowCount = run.rows_actual === null || run.rows_actual === undefined
      ? '—' : `${formatNumber(run.rows_actual)}${run.rows_expected === null || run.rows_expected === undefined ? '' : ` / ${formatNumber(run.rows_expected)}`}`;
    const failed = run.failed_checks.length ? run.failed_checks.join(', ') : '—';
    return `<tr tabindex="0" data-run-index="${index}" aria-label="Open run ${escapeHtml(run.run_id)}">
      <td><span class="run-id">${escapeHtml(run.run_id)}</span></td>
      <td>${escapeHtml(run.scenario_label)}</td>
      <td><span class="pill pill-${escapeHtml(runStatus)}">${escapeHtml(statusLabel(runStatus))}</span></td>
      <td><span class="pill pill-${escapeHtml(run.validation_status)}">${escapeHtml(statusLabel(run.validation_status))}</span></td>
      <td>${escapeHtml(rowCount)}</td><td>${escapeHtml(failed)}</td>
    </tr>`;
  }).join('');

  body.querySelectorAll('tr[data-run-index]').forEach((row) => {
    const selectRun = () => showRunDetail(visibleRuns[Number(row.dataset.runIndex)]);
    row.addEventListener('click', selectRun);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRun();
      }
    });
  });
}

function showRunDetail(run) {
  const panel = document.querySelector('#run-detail');
  const failures = run.failed_checks.length
    ? `<ul>${run.failed_checks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>No failed checks were recorded.</p>';
  panel.innerHTML = `<p class="eyebrow">${escapeHtml(run.run_type === 'platform' ? 'PLATFORM RUN' : 'LOCAL VALIDATION')}</p>
    <h3>${escapeHtml(run.scenario_label)}</h3>
    <p><strong>${escapeHtml(run.run_id)}</strong></p>
    <p>Platform: ${escapeHtml(statusLabel(run.platform_status))}<br>Validation: ${escapeHtml(statusLabel(run.validation_status))}<br>Schema: ${escapeHtml(statusLabel(run.schema_status))}</p>
    <p>Pipeline time: ${escapeHtml(formatDuration(run.pipeline_duration_seconds))}<br>Upload-to-output: ${escapeHtml(formatDuration(run.schedule_detection_seconds))}</p>
    <p>Input / output: ${escapeHtml(formatBytes(run.input_bytes))} / ${escapeHtml(formatBytes(run.output_bytes))}<br>Provider compute: not exposed</p>
    <p>Failed checks</p>${failures}`;
}

function renderConsistency(data) {
  const list = document.querySelector('#consistency-list');
  if (!data.consistency.length) {
    list.innerHTML = '<p class="empty-state">No pipeline configuration has three comparable outputs yet.</p>';
  } else {
    list.innerHTML = data.consistency.map((group) => `
      <div class="consistency-card">
        <strong>${escapeHtml(group.scenario_label)} / ${escapeHtml(group.pipeline_version)}</strong>
        <span class="status-tag">${escapeHtml(statusLabel(group.status))}</span>
        <small>${formatNumber(group.runs)} of ${formatNumber(group.required_runs)} unique outputs</small>
      </div>`).join('');
  }
  const count = data.summary.uncomparable_runs;
  document.querySelector('#consistency-note').textContent = count
    ? `${count} observed run(s) lack a recorded pipeline version or matching output hash; they cannot support a determinism claim.`
    : 'Consistency is only claimed after three outputs from the same input and configuration.';
}

function renderTiming(data) {
  const timed = data.runs.filter((run) => run.run_type === 'platform'
    && run.pipeline_duration_seconds !== null);
  const chart = document.querySelector('#timing-chart');
  if (!timed.length) {
    chart.innerHTML = '<p class="empty-state">No pipeline start-to-completion durations are recorded.</p>';
  } else {
    const max = Math.max(...timed.map((run) => run.pipeline_duration_seconds), 1);
    chart.innerHTML = timed.slice(0, 6).map((run) => `
      <div class="bar-row"><span>${escapeHtml(run.scenario_label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${run.pipeline_duration_seconds / max * 100}%"></div></div>
        <span>${escapeHtml(formatDuration(run.pipeline_duration_seconds))}</span></div>`).join('');
  }

  const measured = data.runs.filter((run) => run.run_type === 'platform');
  const inputSizes = measured.map((run) => run.input_bytes).filter(Number.isFinite);
  const outputSizes = measured.map((run) => run.output_bytes).filter(Number.isFinite);
  const average = (values) => values.length
    ? formatBytes(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length))
    : 'Not recorded';
  document.querySelector('#resource-summary').innerHTML = `
    <div class="resource-stat"><span>Mean input</span><strong>${escapeHtml(average(inputSizes))}</strong></div>
    <div class="resource-stat"><span>Mean output</span><strong>${escapeHtml(average(outputSizes))}</strong></div>
    <div class="resource-stat"><span>Compute / credits</span><strong>Not exposed</strong></div>`;
  document.querySelector('#resource-note').textContent = data.measurement_notes.provider_resources;
}

async function loadDashboard() {
  try {
    const response = await fetch('./data/runs.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Run archive returned ${response.status}`);
    const data = await response.json();
    renderSummary(data);
    renderScenarios(data.scenarios);
    renderConsistency(data);
    renderTiming(data);
    renderRuns(data.runs);
    document.querySelector('#scenario-filter').addEventListener('change', (event) => {
      renderRuns(data.runs, event.target.value);
    });
    if (data.runs.length) showRunDetail(data.runs[0]);
  } catch (error) {
    document.querySelector('#run-table').innerHTML = `<tr><td colspan="6" class="empty-state">Could not load the run archive: ${escapeHtml(error.message)}</td></tr>`;
    document.querySelector('#map-summary').textContent = 'Run archive unavailable.';
  }
}

loadDashboard();
