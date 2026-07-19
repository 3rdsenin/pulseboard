import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboard.js';
import { contributorsApi } from '../../api/contributors.js';
import { shareApi } from '../../api/share.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';
import { Button } from '../../components/Button.js';

interface IssueTableProps {
  projectId?: string;
  sprintId?: string;
  shareToken?: string;
}

export function IssueTable({ projectId, sprintId: initialSprintId, shareToken }: IssueTableProps) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [sprintId, setSprintId] = useState(initialSprintId ?? '');
  const [page, setPage] = useState(1);

  // Queries
  const { data: sprints } = useQuery({
    queryKey: ['sprints', projectId || shareToken],
    queryFn: () =>
      shareToken
        ? shareApi.listSprints(shareToken)
        : dashboardApi.listSprints(projectId!),
    enabled: !!projectId || !!shareToken,
  });

  const { data: contributors } = useQuery({
    queryKey: ['contributors', projectId || shareToken],
    queryFn: () =>
      shareToken
        ? shareApi.listContributors(shareToken)
        : contributorsApi.list(projectId!),
    enabled: !!projectId || !!shareToken,
  });

  const { data: issuesData, isLoading } = useQuery({
    queryKey: ['issues', projectId || shareToken, q, status, type, priority, assigneeId, sprintId, page],
    queryFn: () =>
      shareToken
        ? shareApi.getProjectIssues(shareToken, {
            q: q || undefined,
            status: status || undefined,
            type: type || undefined,
            priority: priority || undefined,
            assigneeId: assigneeId || undefined,
            sprintId: sprintId || undefined,
            page,
            perPage: 15,
          })
        : dashboardApi.getProjectIssues(projectId!, {
            q: q || undefined,
            status: status || undefined,
            type: type || undefined,
            priority: priority || undefined,
            assigneeId: assigneeId || undefined,
            sprintId: sprintId || undefined,
            page,
            perPage: 15,
          }),
    enabled: !!projectId || !!shareToken,
  });

  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1); // Reset page on filter change
  };

  const statusBadge = (s: string) => {
    const norm = s.toUpperCase();
    if (norm === 'DONE' || norm === 'RESOLVED') return 'bg-green-50 text-green-700 border-green-200';
    if (norm === 'IN PROGRESS' || norm === 'DEVELOPMENT' || norm === 'TESTING')
      return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const priorityColor = (p: string | null) => {
    if (!p) return 'text-gray-400';
    const norm = p.toUpperCase();
    if (norm === 'HIGHEST' || norm === 'CRITICAL' || norm === 'HIGH') return 'text-red-600 font-semibold';
    if (norm === 'MEDIUM') return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getAssigneeName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return contributors?.find((c) => c.id === id)?.display_name ?? 'Unknown';
  };

  const getSprintName = (id: string | null) => {
    if (!id) return 'Backlog';
    return sprints?.find((s) => s.id === id)?.name ?? 'Unknown';
  };

  const handleExportCSV = async () => {
    try {
      const allIssues = shareToken
        ? await shareApi.getProjectIssues(shareToken, {
            q: q || undefined,
            status: status || undefined,
            type: type || undefined,
            priority: priority || undefined,
            assigneeId: assigneeId || undefined,
            sprintId: sprintId || undefined,
            page: 1,
            perPage: 1000,
          })
        : await dashboardApi.getProjectIssues(projectId!, {
            q: q || undefined,
            status: status || undefined,
            type: type || undefined,
            priority: priority || undefined,
            assigneeId: assigneeId || undefined,
            sprintId: sprintId || undefined,
            page: 1,
            perPage: 1000,
          });

      const headers = ['Key', 'Summary', 'Status', 'Type', 'Priority', 'Assignee', 'Sprint', 'Updated At'];
      const rows = (allIssues.data ?? []).map((issue) => [
        issue.key,
        `"${issue.summary.replace(/"/g, '""')}"`,
        issue.status,
        issue.type,
        issue.priority,
        getAssigneeName(issue.assigneeId),
        getSprintName(issue.sprintId),
        issue.updatedAt ? new Date(issue.updatedAt).toLocaleString() : '',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `issues_export_${projectId || 'project'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Error exporting CSV.');
    }
  };

  return (
    <div className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Synced Issues Database</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
        >
          Export CSV
        </Button>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <Input
          label="Search"
          type="text"
          value={q}
          onChange={(e) => handleFilterChange(setQ, e.target.value)}
          placeholder="Key or summary..."
          className="py-1 text-xs"
        />

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => handleFilterChange(setStatus, e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => handleFilterChange(setType, e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Types</option>
            <option value="Bug">Bug</option>
            <option value="Story">Story</option>
            <option value="Task">Task</option>
            <option value="Epic">Epic</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => handleFilterChange(setPriority, e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Priorities</option>
            <option value="Highest">Highest</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Lowest">Lowest</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Assignee</label>
          <select
            value={assigneeId}
            onChange={(e) => handleFilterChange(setAssigneeId, e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Assignees</option>
            {contributors?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Sprint</label>
          <select
            disabled={!!initialSprintId}
            value={sprintId}
            onChange={(e) => handleFilterChange(setSprintId, e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">All Sprints</option>
            <option value="NULL">Backlog (No Sprint)</option>
            {sprints?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : !issuesData?.data || issuesData.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-500">No issues found matching the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-left text-xs text-gray-500">
            <thead className="bg-gray-50 font-semibold uppercase text-gray-700 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3 w-28">Key</th>
                <th scope="col" className="px-6 py-3">Summary</th>
                <th scope="col" className="px-6 py-3 w-28">Status</th>
                <th scope="col" className="px-6 py-3 w-28">Type</th>
                <th scope="col" className="px-6 py-3 w-24">Priority</th>
                <th scope="col" className="px-6 py-3 w-40">Assignee</th>
                <th scope="col" className="px-6 py-3 w-40">Sprint</th>
                <th scope="col" className="px-6 py-3 w-28">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {issuesData.data.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-gray-900 font-mono">
                    {issue.key}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900 break-words max-w-sm">
                    {issue.summary}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={[
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        statusBadge(issue.status),
                      ].join(' ')}
                    >
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-800">{issue.type}</td>
                  <td className={['px-6 py-3', priorityColor(issue.priority)].join(' ')}>
                    {issue.priority ?? '—'}
                  </td>
                  <td className="px-6 py-3">{getAssigneeName(issue.assigneeId)}</td>
                  <td className="px-6 py-3 truncate max-w-[120px]" title={getSprintName(issue.sprintId)}>
                    {getSprintName(issue.sprintId)}
                  </td>
                  <td className="px-6 py-3 font-mono text-[10px]">
                    {issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {issuesData && issuesData.meta && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs">
          <div className="text-gray-500">
            Showing <span className="font-semibold text-gray-900">{issuesData.data.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{issuesData.meta.total}</span> issues
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!issuesData.meta.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
