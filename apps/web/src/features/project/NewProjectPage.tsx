import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateProjectSchema, type CreateProjectInput } from '@pulseboard/shared';
import { projectsApi } from '../../api/projects.js';
import { extractApiError } from '../../api/client.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Card, CardBody } from '../../components/Card.js';

export function NewProjectPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
  });

  const onSubmit = async (data: CreateProjectInput) => {
    setServerError(null);
    try {
      const project = await projectsApi.create(data);
      navigate(`/projects/${project.id}`);
    } catch (error) {
      setServerError(await extractApiError(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">New project</h1>

        <Card>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {serverError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </p>
              )}

              <Input
                label="Project name"
                hint="How this project will appear in your dashboard and reports"
                error={errors.name?.message}
                {...register('name')}
              />

              <Input
                label="Project slug"
                hint="Lowercase letters, numbers, and hyphens only — used in the project's URL"
                error={errors.slug?.message}
                {...register('slug')}
              />

              <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
                Create project
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/dashboard" className="font-medium text-brand-600 hover:underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
