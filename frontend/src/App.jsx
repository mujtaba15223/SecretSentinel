import React, { useEffect, useMemo, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "https://secret-leak-detector-idzg.onrender.com")
).replace(/\/+$/, "");

const LAST_SCAN_KEY = "secretsentinel:last-scan";

const iconPaths = {
  activity: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  alert: (
    <>
      <path d="m12 3 9 16H3L12 3Z" />
      <path d="M12 9v4m0 3h.01" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  code: (
    <>
      <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6m-11 5h6m-6 4h6" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10m-7 6h4" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="5" />
      <path d="m11.5 11.5 8-8L22 6l-2 2 2 2-3 3-2-2-3.5 3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6" />
    </>
  ),
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

async function fetchJson(url, options = {}, action = "Request", onResponse) {
  const response = await fetch(url, options);
  onResponse?.();
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { detail: responseText };
    }
  }

  if (!response.ok) {
    const detail = data.detail
      ? typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail)
      : "";

    throw new Error(
      `${action} failed (HTTP ${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return data;
}

function getConnectionError(error) {
  if (error instanceof TypeError) {
    return `Could not reach ${API}. Check that the backend is running and its CORS settings allow this frontend.`;
  }

  return error instanceof Error ? error.message : String(error);
}

function StatCard({ label, value, detail, icon, tone = "neutral" }) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

function App() {
  const [metrics, setMetrics] = useState({
    total_scans: 0,
    total_findings: 0,
    critical_findings: 0,
    high_findings: 0,
    medium_findings: 0,
    clean_scans: 0,
  });
  const [findings, setFindings] = useState([]);
  const [directory, setDirectory] = useState("tests/sample_secrets");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("neutral");
  const [apiStatus, setApiStatus] = useState("checking");
  const [isScanning, setIsScanning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [findingsPage, setFindingsPage] = useState(1);
  const [lastScan, setLastScan] = useState(() =>
    window.localStorage.getItem(LAST_SCAN_KEY)
  );

  async function loadDashboard() {
    setApiStatus("checking");

    try {
      const [metricsData, findingsData] = await Promise.all([
        fetchJson(
          `${API}/metrics/`,
          {},
          "Loading metrics",
          () => setApiStatus("online")
        ),
        fetchJson(
          `${API}/findings/`,
          {},
          "Loading findings",
          () => setApiStatus("online")
        ),
      ]);

      setMetrics(metricsData);
      setFindings(findingsData.findings || []);
      setApiStatus("online");
    } catch (error) {
      if (error instanceof TypeError) {
        setApiStatus("offline");
      }
      setMessage(`❌ ${getConnectionError(error)}`);
      setMessageTone("error");
    }
  }

  async function runScan(event) {
    event.preventDefault();
    setIsScanning(true);
    setMessage("Scanning repository for exposed credentials…");
    setMessageTone("neutral");

    try {
      const data = await fetchJson(
        `${API}/scan/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directory,
          }),
        },
        "Scan",
        () => setApiStatus("online")
      );

      setApiStatus("online");
      const scannedAt = new Date().toISOString();
      window.localStorage.setItem(LAST_SCAN_KEY, scannedAt);
      setLastScan(scannedAt);
      setFindingsPage(1);

      if (data.total_findings === 0) {
        setMessage("Scan complete. No secrets were detected.");
        setMessageTone("success");
      } else {
        setMessage(
          `Scan complete. ${data.total_findings} potential secret${data.total_findings === 1 ? "" : "s"} detected.`
        );
        setMessageTone("error");
      }

      await loadDashboard();
    } catch (error) {
      if (error instanceof TypeError) {
        setApiStatus("offline");
      }
      setMessage(getConnectionError(error));
      setMessageTone("error");
    } finally {
      setIsScanning(false);
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm(
      "Are you sure you want to clear all scan history?"
    );

    if (!confirmed) {
      return;
    }

    setIsClearing(true);
    try {
      await fetchJson(
        `${API}/metrics/clear`,
        {
          method: "DELETE",
        },
        "Clearing scan history",
        () => setApiStatus("online")
      );

      setMessage("Scan history cleared successfully.");
      setMessageTone("success");
      await loadDashboard();
    } catch (error) {
      if (error instanceof TypeError) {
        setApiStatus("offline");
      }
      setMessage(getConnectionError(error));
      setMessageTone("error");
    } finally {
      setIsClearing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const detectionStats = useMemo(() => {
    const counts = findings.reduce((result, finding) => {
      const type = finding.type || "Other";
      result[type] = (result[type] || 0) + 1;
      return result;
    }, {});

    return Object.entries(counts)
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5);
  }, [findings]);

  const riskStats = [
    {
      label: "Critical",
      count: metrics.critical_findings,
      tone: "critical",
    },
    { label: "High", count: metrics.high_findings, tone: "high" },
    { label: "Medium", count: metrics.medium_findings, tone: "medium" },
    {
      label: "Low",
      count: Math.max(
        0,
        metrics.total_findings -
          metrics.critical_findings -
          metrics.high_findings -
          metrics.medium_findings
      ),
      tone: "low",
    },
  ];
  const riskTotal = riskStats.reduce((total, risk) => total + risk.count, 0);
  let riskOffset = 0;
  const riskSegments = riskStats
    .map((risk) => {
      const start = riskOffset;
      riskOffset += riskTotal ? (risk.count / riskTotal) * 100 : 0;
      return `var(--${risk.tone}) ${start}% ${riskOffset}%`;
    })
    .join(", ");
  const riskChart = riskTotal
    ? `conic-gradient(${riskSegments})`
    : "conic-gradient(var(--border-strong) 0% 100%)";

  const filteredFindings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return findings.filter((finding) => {
      const matchesSeverity =
        severityFilter === "all" ||
        finding.severity?.toLowerCase() === severityFilter;
      const matchesSearch =
        !query ||
        [finding.file, finding.type, finding.detection, finding.severity]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));

      return matchesSeverity && matchesSearch;
    });
  }, [findings, searchTerm, severityFilter]);
  const findingsPageSize = 10;
  const findingsPageCount = Math.max(
    1,
    Math.ceil(filteredFindings.length / findingsPageSize)
  );
  const visibleFindings = filteredFindings.slice(
    (findingsPage - 1) * findingsPageSize,
    findingsPage * findingsPageSize
  );

  const uniqueFindingFiles = new Set(findings.map((finding) => finding.file))
    .size;
  const lastScanLabel = lastScan
    ? new Date(lastScan).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No scan recorded";
  const overallStatus =
    apiStatus !== "online"
      ? "unknown"
      : metrics.critical_findings > 0
        ? "critical"
        : metrics.total_findings > 0
          ? "warning"
          : "secure";
  const scanState =
    isScanning
      ? { tone: "active", label: "SCAN IN PROGRESS", status: "checking" }
      : apiStatus === "online"
        ? { tone: "ready", label: "READY TO SCAN", status: "online" }
        : apiStatus === "checking"
          ? { tone: "checking", label: "CHECKING API", status: "checking" }
          : { tone: "offline", label: "API OFFLINE", status: "offline" };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="SecretSentinel home">
          <span className="brand-mark">
            <Icon name="shield" size={23} />
          </span>
          <span className="brand-copy">
            <strong>SECRET<span> SENTINEL</span></strong>
            <small>DEVELOPER SECURITY</small>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard sections">
          <a className="nav-link nav-link-active" href="#overview">
            <Icon name="activity" />
            <span>Overview</span>
          </a>
          <a className="nav-link" href="#scanner">
            <Icon name="code" />
            <span>Repository scan</span>
          </a>
          <a className="nav-link" href="#findings">
            <Icon name="alert" />
            <span>Security findings</span>
            {metrics.total_findings > 0 && (
              <span className="nav-count">{metrics.total_findings}</span>
            )}
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-callout">
          <span className="callout-icon">
            <Icon name="key" size={17} />
          </span>
          <strong>Keep credentials out of code.</strong>
          <p>Scan early. Remediate quickly.</p>
        </div>
        <div className="sidebar-footer">
          <span className={`status-dot status-dot-${apiStatus}`} />
          <span>API {apiStatus}</span>
          <span className="footer-separator">·</span>
          <span>v1.0</span>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Security overview</strong>
          </div>
          <div className={`connection-state connection-${apiStatus}`}>
            <span className={`status-dot status-dot-${apiStatus}`} />
            {apiStatus === "online"
              ? "SYSTEM OPERATIONAL"
              : apiStatus === "checking"
                ? "CONNECTING"
                : "API OFFLINE"}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                SECURITY OPERATIONS
              </div>
              <h1>Security overview</h1>
              <p>
                Monitor exposed credentials and protect your codebase.
              </p>
            </div>
            <div className={`posture posture-${overallStatus}`}>
              <span className="posture-icon">
                <Icon
                  name={
                    overallStatus === "secure"
                      ? "check"
                      : overallStatus === "unknown"
                        ? "activity"
                        : "alert"
                  }
                  size={17}
                />
              </span>
              <span>
                <small>SECURITY POSTURE</small>
                <strong>
                  {overallStatus === "secure"
                    ? "All clear"
                    : overallStatus === "critical"
                      ? "Critical exposure"
                      : overallStatus === "warning"
                        ? "Review required"
                        : "Status unavailable"}
                </strong>
              </span>
            </div>
          </section>

          <section className="stats-grid" aria-label="Security metrics">
            <StatCard
              label="Total scans"
              value={metrics.total_scans}
              detail="Repositories analyzed"
              icon="folder"
              tone="neutral"
            />
            <StatCard
              label="Files with findings"
              value={uniqueFindingFiles}
              detail="Unique files represented"
              icon="file"
              tone="neutral"
            />
            <StatCard
              label="Secrets detected"
              value={metrics.total_findings}
              detail="Across scan history"
              icon="key"
              tone={metrics.total_findings ? "high" : "secure"}
            />
            <StatCard
              label="Critical findings"
              value={metrics.critical_findings}
              detail="Immediate action required"
              icon="alert"
              tone={metrics.critical_findings ? "critical" : "secure"}
            />
            <StatCard
              label="High risk"
              value={metrics.high_findings}
              detail="Credentials at risk"
              icon="shield"
              tone={metrics.high_findings ? "high" : "secure"}
            />
            <StatCard
              label="Clean scans"
              value={metrics.clean_scans}
              detail="No secrets detected"
              icon="check"
              tone="secure"
            />
          </section>

          <section className="panel scan-panel" id="scanner">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="panel-icon panel-icon-accent">
                  <Icon name="code" />
                </span>
                <div>
                  <h2>Repository scan</h2>
                  <p>Inspect source code for exposed secrets and tokens.</p>
                </div>
              </div>
              <div className={`scan-state scan-state-${scanState.tone}`}>
                <span className={`status-dot status-dot-${scanState.status}`} />
                {scanState.label}
              </div>
            </div>

            <form className="scan-form" onSubmit={runScan}>
              <label className="visually-hidden" htmlFor="scan-target">
                Directory path or GitHub repository URL
              </label>
              <div className="scan-input-wrap">
                <Icon name="search" size={18} />
                <input
                  id="scan-target"
                  value={directory}
                  onChange={(event) => setDirectory(event.target.value)}
                  placeholder="Backend-local path or public GitHub repository URL"
                  autoComplete="off"
                  required
                  disabled={isScanning}
                />
              </div>
              <button
                className={`scan-button ${isScanning ? "is-scanning" : ""}`}
                type="submit"
                disabled={isScanning || !directory.trim()}
              >
                <Icon name="activity" size={18} />
                {isScanning ? "Scanning…" : "Run security scan"}
                {!isScanning && <Icon name="arrow" size={17} />}
              </button>
            </form>

            <div className="scan-meta">
              <span>
                <Icon name="shield" size={15} />
                Regex &amp; entropy detection
              </span>
              <span className="scan-meta-divider" />
              <span>
                <Icon name="clock" size={15} />
                Last scan: {lastScanLabel}
              </span>
            </div>

            {message && (
              <div className={`notice notice-${messageTone}`} role="status">
                <Icon
                  name={
                    messageTone === "success"
                      ? "check"
                      : messageTone === "error"
                        ? "alert"
                        : "activity"
                  }
                  size={17}
                />
                <span>{message}</span>
              </div>
            )}
          </section>

          <section className="insights-grid" aria-label="Detection analytics">
            <article className="panel insight-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <h2>Detection statistics</h2>
                  <p>Most common finding types in scan history.</p>
                </div>
                <span className="subtle-tag">BY TYPE</span>
              </div>
              {detectionStats.length ? (
                <div className="detection-list">
                  {detectionStats.map(([type, count], index) => (
                    <div className="detection-row" key={type}>
                      <div className="detection-label">
                        <span className={`detection-marker detection-marker-${index}`} />
                        <span>{type}</span>
                        <strong>{count}</strong>
                      </div>
                      <div
                        className="bar-track"
                        role="img"
                        aria-label={`${type}: ${count} findings`}
                      >
                        <span
                          className={`bar-fill bar-fill-${index}`}
                          style={{
                            width: `${Math.max(
                              5,
                              (count / detectionStats[0][1]) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="chart-empty">
                  <span className="chart-empty-icon">
                    <Icon name="activity" size={21} />
                  </span>
                  <strong>Waiting for scan data</strong>
                  <span>Detection types appear here after a scan.</span>
                </div>
              )}
            </article>

            <article className="panel insight-panel risk-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <h2>Risk distribution</h2>
                  <p>Findings grouped by severity.</p>
                </div>
                <span className="subtle-tag">SEVERITY</span>
              </div>
              <div className="risk-content">
                <div
                  className="risk-donut"
                  style={{ "--risk-chart": riskChart }}
                  role="img"
                  aria-label={`${riskTotal} findings by severity`}
                >
                  <div className="risk-donut-center">
                    <strong>{riskTotal}</strong>
                    <span>FINDINGS</span>
                  </div>
                </div>
                <div className="risk-legend">
                  {riskStats.map((risk) => (
                    <div className="risk-legend-row" key={risk.label}>
                      <span className={`risk-key risk-key-${risk.tone}`} />
                      <span>{risk.label}</span>
                      <strong>{risk.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="panel findings-panel" id="findings">
            <div className="panel-heading findings-heading">
              <div className="panel-title-group">
                <span className="panel-icon panel-icon-alert">
                  <Icon name="alert" />
                </span>
                <div>
                  <h2>Security findings</h2>
                  <p>
                    {findings.length} finding{findings.length === 1 ? "" : "s"}{" "}
                    across scan history
                  </p>
                </div>
              </div>
              <button
                className="button button-subtle"
                type="button"
                onClick={clearHistory}
                disabled={isClearing || isScanning}
              >
                <Icon name="trash" size={16} />
                {isClearing ? "Clearing…" : "Clear history"}
              </button>
            </div>

            <div className="findings-toolbar">
              <label className="findings-search">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setFindingsPage(1);
                  }}
                  placeholder="Search files or finding types"
                  aria-label="Search findings"
                />
              </label>
              <label className="filter-select">
                <Icon name="filter" size={16} />
                <span className="visually-hidden">Filter by severity</span>
                <select
                  value={severityFilter}
                  onChange={(event) => {
                    setSeverityFilter(event.target.value);
                    setFindingsPage(1);
                  }}
                  aria-label="Filter by severity"
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>

            {filteredFindings.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">File &amp; location</th>
                      <th scope="col">Finding type</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Detection</th>
                      <th scope="col">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFindings.map((finding) => (
                      <tr key={finding.id}>
                        <td>
                          <div className="file-cell">
                            <span className="file-cell-icon">
                              <Icon name="file" size={16} />
                            </span>
                            <span className="file-cell-copy">
                              <strong title={finding.file}>{finding.file}</strong>
                              <small>LINE {finding.line}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="finding-type">{finding.type}</span>
                        </td>
                        <td>
                          <span
                            className={`severity-badge severity-${(finding.severity || "low").toLowerCase()}`}
                          >
                            <span />
                            {finding.severity}
                          </span>
                        </td>
                        <td>
                          <span className="detection-method">
                            {finding.detection}
                          </span>
                        </td>
                        <td>
                          <span className="confidence-value">
                            <span className="confidence-track">
                              <span
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, finding.confidence * 100)
                                  )}%`,
                                }}
                              />
                            </span>
                            {(finding.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-mark">
                  <Icon
                    name={findings.length ? "search" : "shield"}
                    size={24}
                  />
                </span>
                <strong>
                  {findings.length ? "No matching findings" : "No secrets detected"}
                </strong>
                <p>
                  {findings.length
                    ? "Adjust the search or severity filter and try again."
                    : "Run a repository scan to check for exposed credentials."}
                </p>
              </div>
            )}
            <div className="findings-footer">
              <span>
                {filteredFindings.length
                  ? `Showing ${(Math.min(findingsPage, findingsPageCount) - 1) * findingsPageSize + 1}–${Math.min(
                      Math.min(findingsPage, findingsPageCount) *
                        findingsPageSize,
                      filteredFindings.length
                    )} of ${filteredFindings.length}`
                  : "No findings to display"}
              </span>
              <div className="pagination" aria-label="Findings pages">
                <button
                  className="pagination-button"
                  type="button"
                  aria-label="Previous findings page"
                  disabled={findingsPage <= 1}
                  onClick={() =>
                    setFindingsPage((page) => Math.max(1, page - 1))
                  }
                >
                  Previous
                </button>
                <span>
                  {findingsPage} / {findingsPageCount}
                </span>
                <button
                  className="pagination-button"
                  type="button"
                  aria-label="Next findings page"
                  disabled={findingsPage >= findingsPageCount}
                  onClick={() =>
                    setFindingsPage((page) =>
                      Math.min(findingsPageCount, page + 1)
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <footer className="page-footer">
            <span>SECRETSENTINEL SECURITY CONSOLE</span>
            <span>Protecting source, one scan at a time.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
