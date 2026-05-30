import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from '@/providers/theme-provider';
import { tryBootstrapAuth } from '@/lib/api';
import { router } from '@/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App(): JSX.Element {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Bootstrap />
          <RouterProvider router={router} />
          <ThemedToaster />
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

function Bootstrap(): null {
  useEffect(() => {
    void tryBootstrapAuth();
  }, []);
  return null;
}

function ThemedToaster(): JSX.Element {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors closeButton position="top-right" />;
}
