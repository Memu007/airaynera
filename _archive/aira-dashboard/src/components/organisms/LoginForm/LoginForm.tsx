import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../atoms/Button';
import { Input } from '../../atoms/Input';
import { loginSchema, type LoginSchema } from '../../../schemas/auth';
import { useAuth } from '../../../hooks/useAuth';
// TODO: Investigate heroicons import issue with Vite
// import { UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../../atoms/LoadingSpinner';

export function LoginForm() {
  const { login, isLoading, error: authError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const dniValue = watch('dni');
  const pinValue = watch('pin');

  const onSubmit = async (data: LoginSchema) => {
    await login(data);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence>
        {authError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
          >
            <p className="text-sm text-red-600">{authError.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          id="dni"
          label="DNI"
          placeholder="Ej: 12345678"
          register={register('dni')}
          error={errors.dni?.message}
        />
        <Input
          id="pin"
          type="password"
          label="PIN"
          placeholder="Ingresá tu PIN"
          register={register('pin')}
          error={errors.pin?.message}
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!dniValue || !pinValue || isLoading}
        >
          {isLoading ? <LoadingSpinner /> : 'Iniciar Sesión'}
        </Button>
      </form>
    </div>
  );
}