import { z } from 'zod';

export const loginSchema = z.object({
  dni: z.string()
    .min(7, 'DNI debe tener al menos 7 dígitos')
    .max(8, 'DNI debe tener máximo 8 dígitos')
    .regex(/^\d+$/, 'DNI debe contener solo números'),
  pin: z.string()
    .min(4, 'PIN debe tener al menos 4 dígitos')
    .max(8, 'PIN debe tener máximo 8 dígitos')
    .regex(/^\d+$/, 'PIN debe contener solo números'),
});

export type LoginSchema = z.infer<typeof loginSchema>;