# Design Document

## Overview

Este documento presenta el diseño técnico para la **refactorización completa del frontend** de AIRA Bot, transformando el sistema actual (jQuery + Bootstrap 4 con deuda técnica masiva) en una aplicación React + TypeScript de nivel enterprise que esté a la altura del backend robusto existente.

**Principios de diseño fundamentales:**

1. **Calidad enterprise:** Arquitectura escalable y mantenible
2. **Seguridad médica:** Mantener los estándares del backend
3. **UX profesional:** Interfaz intuitiva para profesionales de salud
4. **Performance:** Carga rápida y navegación fluida
5. **Testing-first:** Cobertura de código desde el inicio

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AIRA Frontend (React + TS)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Auth      │  │  Dashboard  │  │  Patients   │        │
│  │  Module     │  │   Module    │  │   Module    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Sessions   │  │   Profile   │  │   Shared    │        │
│  │   Module    │  │   Module    │  │ Components  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                   State Management (Zustand)               │
├─────────────────────────────────────────────────────────────┤
│                   API Client (Axios + React Query)         │
├─────────────────────────────────────────────────────────────┤
│                   Security Layer (JWT + Interceptors)      │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 AIRA Backend (Express + Node.js)           │
│                    (MANTENER SIN CAMBIOS)                  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend Stack (NUEVO)

```typescript
// Core Framework
React 18.2+ con TypeScript 5.0+
Vite (build tool moderno, reemplaza Create React App)

// State Management
Zustand (simple, TypeScript-first)

// Routing
React Router v6 (navegación SPA)

// HTTP Client
Axios + TanStack Query (caching inteligente)

// UI Framework
Tailwind CSS + Headless UI (reemplaza Bootstrap)
Framer Motion (animaciones fluidas)

// Forms & Validation
React Hook Form + Zod (validación TypeScript)

// Testing
Vitest + Testing Library + Playwright (E2E)

// Development
ESLint + Prettier + Husky (calidad de código)
```

#### Integration Layer

```typescript
// API Client con interceptors para seguridad
class APIClient {
  private axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      baseURL: "/api",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor: agregar JWT token
    this.axios.interceptors.request.use((config) => {
      const token = authStore.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: manejar errores y refresh tokens
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }
}
```

## Components and Interfaces

### Component Architecture

#### 1. **Atomic Design Pattern**

```
src/
├── components/
│   ├── atoms/           # Componentes básicos reutilizables
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Badge/
│   │   └── Avatar/
│   ├── molecules/       # Combinaciones de atoms
│   │   ├── SearchBox/
│   │   ├── PatientCard/
│   │   └── SessionSummary/
│   ├── organisms/       # Secciones complejas
│   │   ├── PatientList/
│   │   ├── Dashboard/
│   │   └── Navigation/
│   └── templates/       # Layouts de página
│       ├── AuthLayout/
│       └── DashboardLayout/
```

#### 2. **Core Components**

##### Authentication Components

```typescript
// LoginForm.tsx
interface LoginFormProps {
  onSuccess: (user: User) => void;
  onError: (error: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const { mutate: login, isLoading } = useLogin();

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const handleSubmit = (data: LoginSchema) => {
    login(data, {
      onSuccess: (user) => {
        authStore.setUser(user);
        onSuccess(user);
      },
      onError: (error) => onError(error.message),
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      {/* Form implementation */}
    </form>
  );
};
```

##### Dashboard Components

```typescript
// DashboardStats.tsx
interface DashboardStatsProps {
  professionalId: string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  professionalId,
}) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", professionalId],
    queryFn: () => apiClient.getDashboardStats(professionalId),
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  if (isLoading) return <StatsLoader />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        title="Pacientes Activos"
        value={stats?.totalPatients || 0}
        icon={<UsersIcon />}
        trend={stats?.patientsTrend}
      />
      <StatCard
        title="Sesiones Este Mes"
        value={stats?.monthlySessions || 0}
        icon={<CalendarIcon />}
        trend={stats?.sessionsTrend}
      />
      <StatCard
        title="Crisis Detectadas"
        value={stats?.crisisDetected || 0}
        icon={<AlertTriangleIcon />}
        variant="warning"
      />
      <StatCard
        title="Tasa de Respuesta IA"
        value={`${stats?.aiResponseRate || 0}%`}
        icon={<BrainIcon />}
        trend={stats?.aiTrend}
      />
    </div>
  );
};
```

##### Patient Management Components

```typescript
// PatientList.tsx
export const PatientList: React.FC = () => {
  const [filters, setFilters] = useState<PatientFilters>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });

  const { data, isLoading, error } = useInfiniteQuery({
    queryKey: ["patients", filters],
    queryFn: ({ pageParam = 1 }) =>
      apiClient.getPatients({
        ...filters,
        page: pageParam,
        limit: pagination.limit,
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const patients = data?.pages.flatMap((page) => page.patients) || [];

  return (
    <div className="space-y-6">
      <PatientFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            onClick={() => navigate(`/patients/${patient.id}`)}
          />
        ))}
      </div>

      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Cargando..." : "Cargar más"}
        </Button>
      )}
    </div>
  );
};
```

### State Management Architecture

#### Zustand Store Structure

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("aira_token"),
  isAuthenticated: false,

  login: async (credentials) => {
    try {
      const response = await apiClient.login(credentials);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
      localStorage.setItem("aira_token", response.token);
    } catch (error) {
      throw new Error("Login failed");
    }
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
    localStorage.removeItem("aira_token");
    queryClient.clear(); // Limpiar cache de React Query
  },
}));

// stores/appStore.ts
interface AppState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  notifications: Notification[];
  toggleSidebar: () => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}
```

## Data Models

### TypeScript Interfaces

#### Core Domain Models

```typescript
// types/user.ts
export interface User {
  id: string;
  dni: string;
  nombre: string;
  especialidad: string;
  matricula: string;
  email?: string;
  telefono?: string;
  createdAt: Date;
  lastLogin: Date;
}

// types/patient.ts
export interface Patient {
  id: string;
  nombre: string;
  dni: string;
  obraSocial?: string;
  telefono?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  lastSession?: Date;
  totalSessions: number;
  crisisCount: number;
}

// types/session.ts
export interface Session {
  id: string;
  patientId: string;
  patientName: string;
  observaciones: string;
  resumen?: string;
  moodScore?: number;
  sessionType: "regular" | "crisis" | "followup";
  crisisDetected: boolean;
  crisisSeverity?: "low" | "medium" | "high";
  durationMinutes?: number;
  createdAt: Date;
  createdVia: "whatsapp" | "web";
}

// types/api.ts
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  nextPage?: number;
}
```

#### Form Schemas (Zod)

```typescript
// schemas/auth.ts
export const loginSchema = z.object({
  dni: z
    .string()
    .min(7, "DNI debe tener al menos 7 dígitos")
    .max(8, "DNI debe tener máximo 8 dígitos")
    .regex(/^\d+$/, "DNI debe contener solo números"),
  pin: z
    .string()
    .min(4, "PIN debe tener al menos 4 dígitos")
    .max(8, "PIN debe tener máximo 8 dígitos")
    .regex(/^\d+$/, "PIN debe contener solo números"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

// schemas/patient.ts
export const patientSchema = z.object({
  nombre: z
    .string()
    .min(2, "Nombre debe tener al menos 2 caracteres")
    .max(100, "Nombre muy largo"),
  dni: z
    .string()
    .length(8, "DNI debe tener exactamente 8 dígitos")
    .regex(/^\d+$/, "DNI debe contener solo números"),
  obraSocial: z.string().optional(),
  telefono: z
    .string()
    .regex(/^[\+]?[0-9\s\-\(\)]{8,20}$/, "Formato de teléfono inválido")
    .optional(),
});

export type PatientSchema = z.infer<typeof patientSchema>;
```

## Error Handling

### Comprehensive Error Strategy

#### 1. **Error Boundary Components**

```typescript
// components/ErrorBoundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    logger.error("React Error Boundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <AlertTriangleIcon className="h-8 w-8 text-red-500 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Error Inesperado
              </h1>
            </div>
            <p className="text-gray-600 mb-4">
              Ha ocurrido un error inesperado. Por favor, recarga la página o
              contacta al soporte.
            </p>
            <div className="flex space-x-3">
              <Button onClick={() => window.location.reload()}>
                Recargar Página
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
              >
                Ir al Inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 2. **API Error Handling**

```typescript
// utils/errorHandler.ts
export class APIError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "APIError";
  }
}

export const handleAPIError = (error: unknown): APIError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Error de conexión";
    const code = error.response?.data?.code;

    return new APIError(message, status, code);
  }

  if (error instanceof Error) {
    return new APIError(error.message, 500);
  }

  return new APIError("Error desconocido", 500);
};

// hooks/useErrorHandler.ts
export const useErrorHandler = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  return useCallback(
    (error: unknown) => {
      const apiError = handleAPIError(error);

      // Log error for monitoring
      logger.error("Application error", {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
      });

      // Show user-friendly notification
      addNotification({
        id: Date.now().toString(),
        type: "error",
        title: "Error",
        message: getUserFriendlyErrorMessage(apiError),
        duration: 5000,
      });
    },
    [addNotification]
  );
};
```

## Testing Strategy

### Multi-Layer Testing Approach

#### 1. **Unit Tests (Vitest + Testing Library)**

```typescript
// __tests__/components/LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LoginForm } from "../LoginForm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("LoginForm", () => {
  it("should validate DNI format", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    render(<LoginForm onSuccess={onSuccess} onError={onError} />, {
      wrapper: createWrapper(),
    });

    const dniInput = screen.getByLabelText(/dni/i);
    const submitButton = screen.getByRole("button", {
      name: /iniciar sesión/i,
    });

    fireEvent.change(dniInput, { target: { value: "123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/dni debe tener al menos 7 dígitos/i)
      ).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("should call onSuccess when login is successful", async () => {
    // Mock API response
    vi.mocked(apiClient.login).mockResolvedValue({
      user: { id: "1", dni: "12345678", nombre: "Dr. Test" },
      token: "mock-token",
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    render(<LoginForm onSuccess={onSuccess} onError={onError} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/dni/i), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText(/pin/i), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        id: "1",
        dni: "12345678",
        nombre: "Dr. Test",
      });
    });
  });
});
```

#### 2. **Integration Tests**

```typescript
// __tests__/integration/patientFlow.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { server } from "../mocks/server";

describe("Patient Management Flow", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("should allow creating and viewing a patient", async () => {
    render(
      <MemoryRouter initialEntries={["/patients"]}>
        <App />
      </MemoryRouter>
    );

    // Login first
    await loginAsTestUser();

    // Navigate to patients
    fireEvent.click(screen.getByText(/pacientes/i));

    // Create new patient
    fireEvent.click(screen.getByText(/nuevo paciente/i));

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText(/dni/i), {
      target: { value: "12345678" },
    });

    fireEvent.click(screen.getByText(/guardar/i));

    // Verify patient appears in list
    await waitFor(() => {
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    });
  });
});
```

#### 3. **E2E Tests (Playwright)**

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Login
    await page.fill('[data-testid="dni-input"]', "12345678");
    await page.fill('[data-testid="pin-input"]', "1234");
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test("should display dashboard stats", async ({ page }) => {
    await expect(page.locator('[data-testid="patients-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="sessions-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="crisis-count"]')).toBeVisible();
  });

  test("should navigate to patients section", async ({ page }) => {
    await page.click('[data-testid="patients-nav"]');
    await expect(page).toHaveURL("/patients");
    await expect(page.locator('[data-testid="patients-list"]')).toBeVisible();
  });

  test("should handle network errors gracefully", async ({ page }) => {
    // Simulate network failure
    await page.route("/api/**", (route) => route.abort());

    await page.reload();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});
```

## Security Implementation

### Frontend Security Measures

#### 1. **Authentication & Authorization**

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const { user, token, login, logout } = useAuthStore();

  const isAuthenticated = useMemo(() => {
    if (!token || !user) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }, [token, user]);

  return {
    user,
    isAuthenticated,
    login,
    logout,
  };
};

// components/ProtectedRoute.tsx
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
```

#### 2. **Input Sanitization & Validation**

```typescript
// utils/sanitization.ts
import DOMPurify from "dompurify";

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: [],
  });
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// hooks/useSafeForm.ts
export const useSafeForm = <T extends Record<string, any>>(
  schema: z.ZodSchema<T>
) => {
  const form = useForm<T>({
    resolver: zodResolver(schema),
  });

  const safeSubmit = (handler: (data: T) => void) => {
    return form.handleSubmit((data) => {
      // Sanitize all string fields
      const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = typeof value === "string" ? sanitizeInput(value) : value;
        return acc;
      }, {} as T);

      handler(sanitizedData);
    });
  };

  return { ...form, safeSubmit };
};
```

#### 3. **CSP and Security Headers**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    // Security headers plugin
    {
      name: "security-headers",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-Frame-Options", "DENY");
          res.setHeader("X-XSS-Protection", "1; mode=block");
          res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
          res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' /api/*;"
          );
          next();
        });
      },
    },
  ],
});
```

## Performance Optimization

### Loading and Caching Strategy

#### 1. **Code Splitting & Lazy Loading**

```typescript
// App.tsx
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Profile = lazy(() => import("./pages/Profile"));

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="patients"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <Patients />
              </Suspense>
            }
          />
          <Route
            path="sessions"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <Sessions />
              </Suspense>
            }
          />
          <Route
            path="profile"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <Profile />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
};
```

#### 2. **React Query Caching Strategy**

```typescript
// config/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (
          error instanceof APIError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// hooks/usePatients.ts
export const usePatients = (filters: PatientFilters = {}) => {
  return useQuery({
    queryKey: ["patients", filters],
    queryFn: () => apiClient.getPatients(filters),
    keepPreviousData: true, // Smooth transitions between pages
    staleTime: 2 * 60 * 1000, // 2 minutes for patient data
  });
};

export const usePatientSessions = (patientId: string) => {
  return useQuery({
    queryKey: ["patient-sessions", patientId],
    queryFn: () => apiClient.getPatientSessions(patientId),
    enabled: !!patientId,
    staleTime: 1 * 60 * 1000, // 1 minute for session data
  });
};
```

#### 3. **Virtual Scrolling for Large Lists**

```typescript
// components/VirtualPatientList.tsx
import { FixedSizeList as List } from "react-window";

interface VirtualPatientListProps {
  patients: Patient[];
  onPatientClick: (patient: Patient) => void;
}

export const VirtualPatientList: React.FC<VirtualPatientListProps> = ({
  patients,
  onPatientClick,
}) => {
  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => (
    <div style={style}>
      <PatientCard
        patient={patients[index]}
        onClick={() => onPatientClick(patients[index])}
      />
    </div>
  );

  return (
    <List height={600} itemCount={patients.length} itemSize={120} width="100%">
      {Row}
    </List>
  );
};
```

## Deployment Strategy

### Build and Deployment Configuration

#### 1. **Vite Build Configuration**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          ui: ["@headlessui/react", "framer-motion"],
          utils: ["axios", "@tanstack/react-query", "zustand"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

#### 2. **Express Integration**

```typescript
// server.js (modificación mínima al backend existente)
const express = require("express");
const path = require("path");

const app = express();

// API routes (mantener existentes)
app.use("/api", apiRoutes);

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  // Catch-all handler: enviar index.html para rutas SPA
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AIRA Server running on port ${PORT}`);
});
```

#### 3. **Environment Configuration**

```typescript
// .env.development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=AIRA Dashboard
VITE_APP_VERSION=2.0.0

// .env.production
VITE_API_BASE_URL=/api
VITE_APP_NAME=AIRA Dashboard
VITE_APP_VERSION=2.0.0

// src/config/env.ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  appName: import.meta.env.VITE_APP_NAME,
  appVersion: import.meta.env.VITE_APP_VERSION,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
```

Este diseño técnico proporciona una base sólida para transformar el frontend actual en una aplicación React + TypeScript de nivel enterprise, manteniendo la compatibilidad con el backend robusto existente y asegurando la calidad, seguridad y performance necesarias para un producto médico profesional.
