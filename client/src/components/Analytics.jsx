import React, { useState, useEffect } from 'react';
import { fetchWeeklyReport } from '../utils/api/analytics';
import './Analytics.css';

function currentWeekBounds() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun,1=Mon,...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

export default function Analytics() {
  const week = currentWeekBounds();
  const [startDate, setStartDate] = useState(week.start);
  const [endDate, setEndDate] = useState(week.end);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const loadData = async (start, end) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWeeklyReport({ start_date: start, end_date: end });
      setData(res);
    } catch (err) {
      console.error('Error fetching analytics report:', err);
      setError(err.message || 'Failed to load performance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(startDate, endDate);
  }, []);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    if (startDate && endDate) {
      loadData(startDate, endDate);
    }
  };

  if (loading && !data) {
    return (
      <div className="analytics-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading reflection analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container" style={{ padding: '24px' }}>
        <div className="card" style={{ border: '1px solid var(--accent-danger)', background: 'rgba(231, 76, 60, 0.05)', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️ Error</div>
          <div style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>{error}</div>
          <button className="btn btn-filter-apply" onClick={() => loadData(startDate, endDate)}>Retry</button>
        </div>
      </div>
    );
  }

  const { areaHours = [], sleep = {}, tasks = {}, events = {}, projects = [] } = data || {};

  const maxHours = Math.max(
    ...areaHours.flatMap(a => [a.planned_hours, a.measured_hours]),
    1
  );

  const phaseCounts = projects.reduce((acc, p) => {
    const ph = p.phase || 'Plan';
    acc[ph] = (acc[ph] || 0) + 1;
    return acc;
  }, { Plan: 0, Act: 0, Measure: 0, Learn: 0, Ignored: 0 });

  const taskCompletionPercentage = tasks.planned_due_count > 0
    ? Math.min(Math.round((tasks.completed_count / tasks.planned_due_count) * 100), 100)
    : (tasks.completed_count > 0 ? 100 : 0);

  const strokeDasharray = 188.5;
  const getDashoffset = (percent) => {
    const pct = Math.min(Math.max(percent, 0), 100);
    return strokeDasharray - (pct / 100) * strokeDasharray;
  };

  const eventEfficiency = events.planned_hours > 0
    ? Math.min(Math.round((events.measured_hours / events.planned_hours) * 100), 200)
    : (events.measured_hours > 0 ? 100 : 0);

  return (
    <div className="analytics-container">
      {/* ── Filter Bar ── */}
      <form className="analytics-filter-bar" onSubmit={handleApplyFilter}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Time Triage & Retrospective Filter</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Focus review by setting standard weekly bounds</span>
        </div>
        <div className="analytics-filter-inputs">
          <label htmlFor="startDate">From</label>
          <input
            type="date"
            id="startDate"
            className="analytics-date-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <label htmlFor="endDate">To</label>
          <input
            type="date"
            id="endDate"
            className="analytics-date-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
          <button type="submit" className="btn-filter-apply">Apply Review</button>
        </div>
      </form>

      {/* ── KPI Panels ── */}
      <div className="kpi-grid">
        {/* KPI 1: Planned vs Completed Tasks */}
        <div className="kpi-card tasks">
          <div className="kpi-details">
            <span className="kpi-title">Execution Triage</span>
            <span className="kpi-value">{tasks.completed_count} / {tasks.planned_due_count}</span>
            <span className="kpi-subtext">Tasks completed out of scheduled</span>
            <span className="kpi-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Time: <strong>{tasks.completed_hours}h</strong> done / {tasks.planned_due_hours}h est
            </span>
          </div>
          <div className="kpi-gauge-container">
            <svg width="72" height="72" className="kpi-radial-svg">
              <circle cx="36" cy="36" r="30" className="kpi-radial-bg" />
              <circle
                cx="36"
                cy="36"
                r="30"
                className="kpi-radial-fill"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={getDashoffset(taskCompletionPercentage)}
              />
              <text x="36" y="36" className="kpi-radial-text">{taskCompletionPercentage}%</text>
            </svg>
          </div>
        </div>

        {/* KPI 2: Sleep Alignment */}
        <div className="kpi-card sleep">
          <div className="kpi-details">
            <span className="kpi-title">Sleep Alignment</span>
            <span className="kpi-value">{sleep.measured}h / {sleep.planned}h</span>
            <span className="kpi-subtext">Rest actual vs plan hours</span>
            <span className="kpi-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Sleep Alignment Score: <strong>{sleep.alignment_percentage}%</strong>
            </span>
          </div>
          <div className="kpi-gauge-container">
            <svg width="72" height="72" className="kpi-radial-svg">
              <circle cx="36" cy="36" r="30" className="kpi-radial-bg" />
              <circle
                cx="36"
                cy="36"
                r="30"
                className="kpi-radial-fill"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={getDashoffset(sleep.alignment_percentage)}
              />
              <text x="36" y="36" className="kpi-radial-text">{sleep.alignment_percentage}%</text>
            </svg>
          </div>
        </div>

        {/* KPI 3: Calendar Utilisation */}
        <div className="kpi-card events">
          <div className="kpi-details">
            <span className="kpi-title">Calendar Utilisation</span>
            <span className="kpi-value">{events.measured_hours}h / {events.planned_hours}h</span>
            <span className="kpi-subtext">Measured vs planned event hours</span>
            <span className="kpi-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Utilisation: <strong>{eventEfficiency}%</strong>
            </span>
          </div>
          <div className="kpi-gauge-container">
            <svg width="72" height="72" className="kpi-radial-svg">
              <circle cx="36" cy="36" r="30" className="kpi-radial-bg" />
              <circle
                cx="36"
                cy="36"
                r="30"
                className="kpi-radial-fill"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={getDashoffset(Math.min(eventEfficiency, 100))}
              />
              <text x="36" y="36" className="kpi-radial-text">{Math.min(eventEfficiency, 100)}%</text>
            </svg>
          </div>
        </div>

        {/* KPI 4: Projects Phase Count */}
        <div className="kpi-card projects-phases">
          <div className="kpi-details">
            <span className="kpi-title">PALM Projects</span>
            <span className="kpi-value">{projects.length} Active</span>
            <span className="kpi-subtext">Progression through PALM engine</span>
          </div>
          <div className="project-phases-summary">
            <div className="phase-counter plan-phase">
              <span className="phase-counter-num">{phaseCounts.Plan}</span>
              <span className="phase-counter-label">P</span>
            </div>
            <div className="phase-counter act-phase">
              <span className="phase-counter-num">{phaseCounts.Act}</span>
              <span className="phase-counter-label">A</span>
            </div>
            <div className="phase-counter measure-phase">
              <span className="phase-counter-num">{phaseCounts.Measure}</span>
              <span className="phase-counter-label">M</span>
            </div>
            <div className="phase-counter learn-phase">
              <span className="phase-counter-num">{phaseCounts.Learn}</span>
              <span className="phase-counter-label">L</span>
            </div>
            <div className="phase-counter ignored-phase">
              <span className="phase-counter-num">{phaseCounts.Ignored}</span>
              <span className="phase-counter-label">I</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Analytics Section ── */}
      <div className="dashboard-grid">
        {/* Area Hours Comparison Chart */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Planned vs Measured Area Hours</h3>
              <p className="panel-subtitle">Weekly retrospective review of actual effort vs planning</p>
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color plan" />
                <span>Planned</span>
              </div>
              <div className="legend-item">
                <div className="legend-color measure" />
                <span>Measured</span>
              </div>
            </div>
          </div>

          {areaHours.length === 0 ? (
            <div className="no-analytics-data">
              <span className="no-data-icon">📊</span>
              <span>No scheduling data logged in this range. Expose events in your tracking calendar!</span>
            </div>
          ) : (
            <div className="custom-bar-chart">
              {areaHours.map((area) => {
                const planPercent = (area.planned_hours / maxHours) * 100;
                const measurePercent = (area.measured_hours / maxHours) * 100;

                return (
                  <div className="chart-row" key={area.area_id}>
                    <div className="chart-label">
                      <span
                        className="chart-area-dot"
                        style={{ backgroundColor: area.color_hex || 'var(--accent-primary)' }}
                      />
                      <span className="chart-area-name" title={area.area_name}>{area.area_name}</span>
                    </div>
                    <div className="chart-bars-container">
                      <div className="chart-bar-lane">
                        <div
                          className="chart-bar-fill plan"
                          style={{
                            width: `${Math.max(planPercent, 2)}%`,
                            backgroundColor: area.color_hex
                          }}
                        >
                          <span className="chart-value-tooltip">{area.planned_hours.toFixed(1)}h</span>
                        </div>
                      </div>
                      <div className="chart-bar-lane">
                        <div
                          className="chart-bar-fill measure"
                          style={{
                            width: `${Math.max(measurePercent, 2)}%`,
                            backgroundColor: area.color_hex
                          }}
                        >
                          <span className="chart-value-tooltip">{area.measured_hours.toFixed(1)}h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Project Task Progression Checklist */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Active Projects Milestones</h3>
              <p className="panel-subtitle">Current progression checklist and hours consumed</p>
            </div>
          </div>

          <div className="project-progress-list">
            {projects.length === 0 ? (
              <div className="no-analytics-data">
                <span className="no-data-icon">◆</span>
                <span>No active projects. Launch new projects in the Projects panel!</span>
              </div>
            ) : (
              projects.map((proj) => (
                <div className="project-progress-card" key={proj.id}>
                  <div className="proj-card-top">
                    <span className="proj-card-title" title={proj.title}>{proj.title}</span>
                    <span className={`proj-card-badge ${proj.phase.toLowerCase()}-phase`}>
                      Phase: {proj.phase}
                    </span>
                  </div>

                  <div className="proj-progress-stats">
                    <span>Task Milestones</span>
                    <span>{proj.completed_tasks} / {proj.total_tasks} ({proj.progress_percentage}%)</span>
                  </div>

                  <div className="proj-progress-bar-container">
                    <div
                      className="proj-progress-bar-fill"
                      style={{
                        width: `${proj.progress_percentage}%`,
                        background: `linear-gradient(90deg, var(--accent-primary) 0%, ${proj.progress_percentage === 100 ? 'var(--accent-success)' : 'var(--accent-primary)'} 100%)`
                      }}
                    />
                  </div>

                  <div className="proj-card-footer">
                    <span>Pillar: <strong>{proj.pillar}</strong></span>
                    <span>Time Spent: <strong>{proj.completed_hours}h</strong> / {proj.total_estimated_hours}h</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
