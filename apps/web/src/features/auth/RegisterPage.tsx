import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterInput } from '@pulseboard/shared';
import { authApi } from '../../api/auth.js';
import { extractApiError } from '../../api/client.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Card, CardBody } from '../../components/Card.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      const result = await authApi.register(data);
      login(result.accessToken, {
        userId: result.userId,
        organizationId: result.organizationId,
        email: data.email,
        name: data.name,
        orgRole: 'ORG_ADMIN', // creator of an org is always ORG_ADMIN
      });
      navigate('/dashboard');
    } catch (error) {
      setServerError(await extractApiError(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">
          Create your account
        </h1>

        <Card>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {serverError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </p>
              )}

              <Input
                label="Your name"
                autoComplete="name"
                error={errors.name?.message}
                {...register('name')}
              />

              <Input
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                hint="Minimum 8 characters"
                error={errors.password?.message}
                {...register('password')}
              />

              <Input
                label="Organisation name"
                error={errors.organizationName?.message}
                {...register('organizationName')}
              />

              <Input
                label="Organisation slug"
                hint="Lowercase letters, numbers, and hyphens only"
                error={errors.organizationSlug?.message}
                {...register('organizationSlug')}
              />

              <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
                Create account
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
