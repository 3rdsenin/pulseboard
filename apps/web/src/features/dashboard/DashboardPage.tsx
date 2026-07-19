import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Card, CardBody, CardHeader } from '../../components/Card.js';
import { Spinner } from '../../components/Spinner.js';
import { Button } from '../../components/Button.js';
import { OrgSwitcher } from '../../components/OrgSwitcher.js';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user, logout } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    // Projects are stable between syncs — no need to refetch on window focus
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">PulseBoard</h1>
          <div className="flex items-center gap-4">
            <OrgSwitcher />
            <Link to="/settings/profile" className="text-sm font-medium text-brand-600 hover:underline">
              My Profile
            </Link>
            <Link to="/settings/org" className="text-sm font-medium text-brand-600 hover:underline">
              Org Settings
            </Link>
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your projects</h2>
          <Link to="/projects/new">
            <Button size="sm">New project</Button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && projects?.length === 0 && (
          <Card>
            <CardBody>
              <p className="py-8 text-center text-sm text-gray-500">
                No projects yet.{' '}
                <Link to="/projects/new" className="font-medium text-brand-600 hover:underline">
                  Create your first project
                </Link>{' '}
                to get started.
              </p>
            </CardBody>
          </Card>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects!.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">{project.slug}</p>
                  </CardHeader>
                  <CardBody>
                    <p className="text-sm text-gray-500">
                      {project.lastSyncedAt
                        ? `Last synced ${new Date(project.lastSyncedAt).toLocaleDateString()}`
                        : 'Never synced'}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
