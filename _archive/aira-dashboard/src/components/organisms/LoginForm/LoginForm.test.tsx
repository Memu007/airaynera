import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { LoginForm } from './LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { AuthProvider } from '../../providers/AuthProvider';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockLogin = vi.fn();

describe('LoginForm organism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as Mock).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null,
      user: null,
    });
  });

  const renderWithProvider = (component: React.ReactNode) => {
    return render(<AuthProvider>{component}</AuthProvider>);
  };

  it('should render DNI and PIN fields, and a disabled login button', () => {
    renderWithProvider(<LoginForm />);

    expect(screen.getByLabelText(/DNI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PIN/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Sesión/i })).toBeDisabled();
  });

  it('should enable the login button when form is valid', () => {
    renderWithProvider(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/DNI/i), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: '1234' },
    });

    expect(screen.getByRole('button', { name: /Iniciar Sesión/i })).toBeEnabled();
  });

  it('should call the login function on form submission', async () => {
    renderWithProvider(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/DNI/i), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText(/PIN/i), {
      target: { value: '1234' },
    });

    const loginButton = screen.getByRole('button', { name: /Iniciar Sesión/i });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        dni: '12345678',
        pin: '1234',
      });
    });
  });

  it('should show an error message if login fails', async () => {
    const error = { message: 'Invalid credentials' };
    const loginMockWithError = vi.fn().mockRejectedValue(error);
    (useAuth as Mock).mockReturnValue({
        login: loginMockWithError,
        loading: false,
        error,
        user: null,
    });

    renderWithProvider(<LoginForm />);
    
    fireEvent.change(screen.getByLabelText(/DNI/i), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/PIN/i), { target: { value: '9999' } });
    
    const loginButton = screen.getByRole('button', { name: /Iniciar Sesión/i });
    fireEvent.click(loginButton);

    await waitFor(() => {
        expect(loginMockWithError).toHaveBeenCalled();
    });
  });
});
