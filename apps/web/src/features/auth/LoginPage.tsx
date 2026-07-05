import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@pulseboard/shared';
import { authApi } from '../../api/auth.js';
import { extractApiError } from '../../api/client.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Card, CardBody } from '../../components/Card.js';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      const result = await authApi.login(data);
      login(result.accessToken, {
        userId: result.userId,
        organizationId: result.organizationId,
        email: data.email,
        name: '',
        orgRole: 'ORG_MEMBER', // overwritten on next /orgs/me fetch
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
          Sign in to PulseBoard
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
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
                Sign in
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
