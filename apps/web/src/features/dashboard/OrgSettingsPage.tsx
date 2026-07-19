import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi } from '../../api/orgs.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

export function OrgSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'ORG_MEMBER'>('ORG_MEMBER');
  const [inviteResult, setInviteResult] = useState<{ token: string; url: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ['org'],
    queryFn: () => orgsApi.getMyOrg(),
  });

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgsApi.listMembers(),
  });

  useEffect(() => {
    if (org) {
      // Populating an editable form from an async-loaded entity — a legitimate
      // re-initialize-on-load case, not state that should instead be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrgName(org.name);
    }
  }, [org]);

  // Mutations
  const updateOrg = useMutation({
    mutationFn: (name: string) => orgsApi.updateMyOrg(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org'] });
      alert('Organization settings updated.');
    },
    onError: (err) => setFormError(err.message),
  });

  const inviteMember = useMutation({
    mutationFn: () => orgsApi.inviteMember(inviteEmail, inviteRole),
    onSuccess: (data) => {
      const joinUrl = `${window.location.origin}/register?invite=${data.token}`;
      setInviteResult({ token: data.token, url: joinUrl });
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (err) => alert(`Error generating invite: ${err.message}`),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => orgsApi.removeMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (err) => alert(`Error removing member: ${err.message}`),
  });

  const isOrgAdmin = user?.orgRole === 'ORG_ADMIN';

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOrgAdmin) return;
    updateOrg.mutate(orgName);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOrgAdmin || !inviteEmail) return;
    inviteMember.mutate();
  };

  if (loadingOrg || loadingMembers) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              ← Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Organization Settings</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">Plan: {org?.plan}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Organization Configuration</h1>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left: General Settings */}
          <div className="md:col-span-1 space-y-4">
            <form onSubmit={handleUpdate} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">General Info</h2>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <Input
                label="Organization Name"
                type="text"
                disabled={!isOrgAdmin}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
              <Input
                label="Organization Slug"
                type="text"
                disabled
                value={org?.slug || ''}
              />
              {isOrgAdmin && (
                <Button type="submit" size="sm" loading={updateOrg.isPending}>
                  Save Changes
                </Button>
              )}
            </form>
          </div>

          {/* Right: Members List & Invites */}
          <div className="md:col-span-2 space-y-6">
            {/* Member Directory */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Organization Member Directory</h2>
              <div className="space-y-3">
                {members?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-gray-800">{m.name}</h4>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {m.role === 'ORG_ADMIN' ? 'Admin' : 'Member'}
                      </span>
                      {isOrgAdmin && m.userId !== user?.userId && (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={removeMember.isPending}
                          onClick={() => {
                            if (confirm(`Revoke organization membership for ${m.name}?`)) {
                              removeMember.mutate(m.userId);
                            }
                          }}
                        >
                          Revoke Access
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Form */}
            {isOrgAdmin && (
              <form onSubmit={handleInviteSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Invite New User</h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="colleague@yourcompany.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Organization Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'ORG_ADMIN' | 'ORG_MEMBER')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none"
                    >
                      <option value="ORG_MEMBER">Org Member (Default access)</option>
                      <option value="ORG_ADMIN">Org Admin (Full billing/settings control)</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" size="sm" loading={inviteMember.isPending}>
                  Generate Invite Link
                </Button>

                {inviteResult && (
                  <div className="pt-2 rounded bg-green-50 p-4 border border-green-200/50">
                    <span className="block text-xs font-semibold text-green-800 mb-1">
                      Invite generated successfully!
                    </span>
                    <span className="block text-[10px] text-gray-500 mb-2">
                      Send this link to the user so they can register and join your organization:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteResult.url}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-[10px] text-gray-600 shadow-sm focus:outline-none"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteResult.url);
                          alert('Copied to clipboard.');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
