/**
 * Autonomous Growth OS — Durable PostgreSQL Worker & Queue View
 *
 * Implements Section 5 of Master Remediation Plan:
 * - Live queue metrics: depth, running leases, dead letter count, oldest queued age
 * - Worker heartbeat & liveness monitor (alerts if worker is offline)
 * - Real-time job stream with cancel actions for pending jobs
 * - Zero simulated metrics: strictly displays live data from /api/v1/queue/
 */

import { useState, useEffect } from 'react';

interface QueueMetrics {
  queued: number;
  running: number;
  failed: number;
  dead_lettered: number;
  oldest_queued_at: string | null;
  worker_alive: boolean;
  last_heartbeat: string | null;
}

interface JobItem {
  id: string;
  job_type: string;
  workspace_id: string;
  brand_id: string | null;
  payload: Record<string, unknown>;
  priority: number;
  status: string;
  worker_id: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result_summary: Record<string, unknown> | null;
}

export function DurableQueueView() {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, jobsRes] = await Promise.all([
        fetch('/api/v1/queue/metrics'),
        fetch(`/api/v1/queue/jobs${filterStatus !== 'all' ? `?status=${filterStatus}` : ''}`),
      ]);

      const metricsData = await metricsRes.json();
      const jobsData = await jobsRes.json();

      if (metricsData.success) {
        setMetrics(metricsData.data);
      }
      if (jobsData.success) {
        setJobs(jobsData.data);
      }
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Failed to refresh queue metrics: ${(err as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 15-second refresh interval
    return () => clearInterval(interval);
  }, [filterStatus]);

  const handleCancelJob = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      const res = await fetch(`/api/v1/queue/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: '00000000-0000-0000-0000-000000000001' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Job ${jobId.substring(0, 8)}... cancelled.` });
        fetchData();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Cancel failed.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: (err as Error).message });
    } finally {
      setCancellingId(null);
    }
  };

  const formatAge = (timestamp: string | null) => {
    if (!timestamp) return 'None';
    const ageMs = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(ageMs / 60000);
    const secs = Math.floor((ageMs % 60000) / 1000);
    if (mins === 0) return `${secs}s ago`;
    return `${mins}m ${secs}s ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Durable Job Queue & Worker Health
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            PostgreSQL-backed durable job queue (<code className="text-indigo-400 font-mono">FOR UPDATE SKIP LOCKED</code>).
            Survived restarts, bounded execution, lease heartbeats, and dead-letter recovery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs text-gray-500">Refreshed: {lastRefreshedAt}</span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-600 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span>{loading ? '⏳' : '🔄'}</span> Refresh
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-600 text-emerald-200'
              : 'bg-rose-950/70 border border-rose-600 text-rose-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-white ml-3 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Worker Liveness Alert Banner */}
      {metrics && !metrics.worker_alive && (
        <div className="p-4 rounded-lg bg-amber-950/60 border border-amber-600/80 text-amber-200 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <h4 className="font-semibold text-amber-100">Worker Process Heartbeat Stale</h4>
            <p className="text-xs text-amber-300/90 mt-1">
              No worker heartbeat received in the last 10 minutes (last seen:{' '}
              {formatAge(metrics.last_heartbeat)}). Vercel cron triggers every 5 minutes at{' '}
              <code className="text-amber-200 bg-amber-900/50 px-1 rounded">
                POST /api/v1/crawler/worker/process-next
              </code>
              . Jobs will queue durably and resume immediately when the worker ticks.
            </p>
          </div>
        </div>
      )}

      {/* Metrics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Worker Status Card */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Worker Status</span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                metrics?.worker_alive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span
              className={`text-sm font-semibold ${
                metrics?.worker_alive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics?.worker_alive ? 'Online' : 'Offline'}
            </span>
          </div>
          <span className="text-xs text-gray-500 mt-1">
            HB: {formatAge(metrics?.last_heartbeat ?? null)}
          </span>
        </div>

        {/* Queued Jobs */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Queued</span>
          <span className="text-2xl font-bold text-sky-400 mt-1">{metrics?.queued ?? 0}</span>
          <span className="text-xs text-gray-500 mt-1">Pending claims</span>
        </div>

        {/* Running Jobs */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Active Leases</span>
          <span className="text-2xl font-bold text-indigo-400 mt-1">{metrics?.running ?? 0}</span>
          <span className="text-xs text-gray-500 mt-1">Under execution</span>
        </div>

        {/* Failed / Retrying */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Failed</span>
          <span className="text-2xl font-bold text-amber-400 mt-1">{metrics?.failed ?? 0}</span>
          <span className="text-xs text-gray-500 mt-1">May auto-retry</span>
        </div>

        {/* Dead Lettered */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Dead Lettered</span>
          <span className="text-2xl font-bold text-rose-400 mt-1">
            {metrics?.dead_lettered ?? 0}
          </span>
          <span className="text-xs text-gray-500 mt-1">Exceeded retries</span>
        </div>

        {/* Oldest Pending */}
        <div className="p-4 rounded-lg bg-gray-800/80 border border-gray-700/80 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-400">Oldest Queued</span>
          <span className="text-sm font-semibold text-gray-200 mt-2">
            {formatAge(metrics?.oldest_queued_at ?? null)}
          </span>
          <span className="text-xs text-gray-500 mt-1">Queue latency</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <span className="text-xs text-gray-400 font-medium mr-2">Filter by Status:</span>
        {['all', 'queued', 'running', 'succeeded', 'failed', 'dead_lettered'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filterStatus === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {status === 'all' ? 'All Jobs' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="rounded-lg bg-gray-900/80 border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/60 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Job ID / Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority / Attempts</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Result / Error</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                    No jobs found in the queue matching filter "{filterStatus}".
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-indigo-300">
                        {job.id.substring(0, 8)}...
                      </div>
                      <div className="text-xs font-medium text-gray-200 mt-0.5">
                        {job.job_type}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          job.status === 'succeeded'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : job.status === 'running'
                            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800 animate-pulse'
                            : job.status === 'queued'
                            ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                            : job.status === 'dead_lettered'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      <div>Priority: {job.priority}</div>
                      <div className="text-gray-500">
                        Attempts: {job.attempts}/{job.max_attempts}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {formatAge(job.created_at)}
                    </td>
                    <td className="py-3 px-4 text-xs max-w-xs truncate">
                      {job.last_error ? (
                        <span className="text-rose-400 font-mono" title={job.last_error}>
                          {job.last_error.substring(0, 50)}...
                        </span>
                      ) : job.result_summary ? (
                        <span className="text-gray-300 font-mono">
                          {JSON.stringify(job.result_summary).substring(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {job.status === 'queued' || job.status === 'retrying' ? (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          disabled={cancellingId === job.id}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/50 hover:bg-rose-900 border border-rose-700/50 text-rose-200 transition-colors disabled:opacity-50"
                        >
                          {cancellingId === job.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
