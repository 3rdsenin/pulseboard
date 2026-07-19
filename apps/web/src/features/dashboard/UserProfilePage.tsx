import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Spinner } from '../../components/Spinner.js';

export function UserProfilePage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Query profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
  });

  useEffect(() => {
    if (profile) {
      // Populating an editable form from an async-loaded entity — a legitimate
      // re-initialize-on-load case, not state that should instead be computed during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(profile.name);
      setGithubUsername(profile.githubUsername ?? '');
    }
  }, [profile]);

  // Mutation
  const updateProfile = useMutation({
    mutationFn: (input: { name: string; githubUsername: string | null }) =>
      authApi.updateMe({
        name: input.name,
        githubUsername: input.githubUsername || null,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      alert('Profile updated successfully.');
    },
    onError: (err) => setFormError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile.mutate({ name, githubUsername });
  };

  if (isLoading) {
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
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              ← Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">User Profile</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">User Account Settings</h2>
          <p className="text-xs text-gray-500">
            Update your account details. Your linked GitHub account helps map your code commits on project dashboards.
          </p>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              disabled
              value={profile?.email || ''}
              hint="Your email address is managed by your organization administrator."
            />

            <Input
              label="Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
            />

            <Input
              label="GitHub Username"
              type="text"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="e.g. octocat"
              hint="Required to automatically map your commits to contributor scoring metrics."
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={updateProfile.isPending}>
                Save Profile
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
