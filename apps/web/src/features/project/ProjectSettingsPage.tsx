import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects.js';
import { orgsApi } from '../../api/orgs.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [syncCron, setSyncCron] = useState('');
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'PROJECT_ADMIN' | 'PROJECT_VIEWER'>('PROJECT_VIEWER');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsApi.listMembers(projectId!),
    enabled: !!projectId,
  });

  const { data: orgMembers } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.listMembers(),
  });

  useEffect(() => {
    if (project) {
      // Populating an editable form from an async-loaded entity — a legitimate
      // re-initialize-on-load case, not state that should instead be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name);
      setSyncCron(project.syncCron);
    }
  }, [project]);

  // Mutations
  const updateProject = useMutation({
    mutationFn: (input: { name: string; syncCron: string }) =>
      projectsApi.update(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      alert('Project settings updated.');
    },
    onError: (err) => setFormError(err.message),
  });

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER' }) =>
      projectsApi.addMember(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      setSelectedMemberUserId('');
    },
    onError: (err) => alert(`Error adding member: ${err.message}`),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(projectId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
    },
    onError: (err) => alert(`Error removing member: ${err.message}`),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'PROJECT_ADMIN' | 'PROJECT_VIEWER' }) =>
      projectsApi.updateMemberRole(projectId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
    },
    onError: (err) => alert(`Error updating role: ${err.message}`),
  });

  const deleteProject = useMutation({
    mutationFn: () => projectsApi.delete(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/dashboard');
    },
    onError: (err) => alert(`Error deleting project: ${err.message}`),
  });

  // Access check
  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';
  const member = members?.find((m) => m.userId === user?.userId);
  const isProjectAdmin = isOrgAdmin || member?.role === 'PROJECT_ADMIN';

  // Filter organization members who are not yet project members
  const availableOrgMembers = orgMembers?.filter(
    (om) => !members?.some((pm) => pm.userId === om.userId)
  ) ?? [];

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProjectAdmin) return;
    updateProject.mutate({ name, syncCron });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProjectAdmin || !selectedMemberUserId) return;
    addMember.mutate({ userId: selectedMemberUserId, role: memberRole });
  };

  if (loadingProject || loadingMembers) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
      {/* Breadcrumbs */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-xs text-gray-500">
          <li>
            <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
              Dashboard
            </Link>
          </li>
          <li>
            <span className="mx-1">/</span>
          </li>
          <li className="font-semibold text-gray-900">Project Settings</li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Project Settings</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left: Project Metadata */}
        <div className="md:col-span-1 space-y-6">
          <form onSubmit={handleUpdate} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">General Info</h2>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <Input
              label="Project Name"
              type="text"
              disabled={!isProjectAdmin}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Sync Schedule (Cron)"
              type="text"
              disabled={!isProjectAdmin}
              value={syncCron}
              onChange={(e) => setSyncCron(e.target.value)}
              required
            />
            <span className="text-[10px] text-gray-400 block -mt-2">
              Default is nightly (0 2 * * *).
            </span>
            {isProjectAdmin && (
              <Button type="submit" size="sm" loading={updateProject.isPending}>
                Save Changes
              </Button>
            )}
          </form>

          {isProjectAdmin && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-red-800">Danger Zone</h3>
              <p className="text-[10px] text-gray-500">
                Permanently delete this project, all integrations, historical metrics, and qualitative score tables. This action is irreversible.
              </p>
              <Button
                variant="danger"
                size="sm"
                loading={deleteProject.isPending}
                onClick={() => {
                  if (confirm('Are you absolutely sure you want to delete this project? ALL sync records and developer scores will be permanently wiped.')) {
                    deleteProject.mutate();
                  }
                }}
              >
                Delete Project
              </Button>
            </div>
          )}
        </div>

        {/* Right: Project Members & Access controls */}
        <div className="md:col-span-2 space-y-6">
          {/* Members List */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Project Members</h2>
            <div className="space-y-3">
              {members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-gray-800">{m.name}</span>
                    <span className="text-[10px] text-gray-400">({m.email})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isProjectAdmin && m.userId !== user?.userId ? (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => updateRole.mutate({ userId: m.userId, role: e.target.value as 'PROJECT_ADMIN' | 'PROJECT_VIEWER' })}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none"
                        >
                          <option value="PROJECT_ADMIN">Admin</option>
                          <option value="PROJECT_VIEWER">Viewer</option>
                        </select>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={removeMember.isPending}
                          onClick={() => {
                            if (confirm(`Remove ${m.name} from project access?`)) {
                              removeMember.mutate(m.userId);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Viewer'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add member section */}
          {isProjectAdmin && availableOrgMembers.length > 0 && (
            <form onSubmit={handleAddMember} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Add Project Member</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Select Org Member</label>
                  <select
                    value={selectedMemberUserId}
                    onChange={(e) => setSelectedMemberUserId(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Choose member...</option>
                    {availableOrgMembers.map((om) => (
                      <option key={om.id} value={om.userId}>
                        {om.name} ({om.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Project Role</label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as 'PROJECT_ADMIN' | 'PROJECT_VIEWER')}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="PROJECT_VIEWER">Viewer (Read-only)</option>
                    <option value="PROJECT_ADMIN">Admin (Full edit / settings)</option>
                  </select>
                </div>
              </div>
              <Button type="submit" size="sm" loading={addMember.isPending}>
                Add Member
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
