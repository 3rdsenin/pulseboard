import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.js';
import { useAuth } from '../hooks/useAuth.js';

// Only renders when the user belongs to more than one organisation — most users
// never see this. See AuthService.switchOrganization for why it's needed: a JWT
// is always scoped to a single org, so switching orgs means reissuing a token.
export function OrgSwitcher() {
  const { user, switchOrg } = useAuth();

  const { data: organizations } = useQuery({
    queryKey: ['auth', 'organizations'],
    queryFn: () => authApi.listOrganizations(),
    staleTime: 60_000,
  });

  if (!organizations || organizations.length < 2) {
    return null;
  }

  const handleChange = async (organizationId: string) => {
    if (organizationId === user?.organizationId) return;
    await switchOrg(organizationId);
    // Cached queries (projects, dashboard data, etc.) are all scoped to the
    // previous org — reload rather than risk stale cross-org data on screen.
    window.location.href = '/dashboard';
  };

  return (
    <select
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
      value={user?.organizationId ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Switch organisation"
    >
      {organizations.map((org) => (
        <option key={org.organizationId} value={org.organizationId}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
