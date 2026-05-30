import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface PublicConfig {
  brand: {
    name: string;
    domain: string;
    telegramUrl: string;
    telegramHandle: string;
  };
  owner: {
    fio: string;
    ogrnip: string;
    inn: string;
    address: string;
  };
  contact: {
    email: string;
    telegram: string;
  };
  analytics: {
    yandexMetrikaId: string | null;
  };
  consentVersions: {
    privacy: string;
    offer: string;
    cookie: string;
  };
}

/**
 * Публичный конфиг сайта. Один fetch на сессию, кэшируется надолго.
 */
export function usePublicConfig() {
  return useQuery({
    queryKey: ['config', 'public'],
    queryFn: () =>
      apiRequest<PublicConfig>('/config/public', { auth: false, skipCredentials: true }),
    staleTime: 60 * 60 * 1000, // 1 час
    gcTime: 24 * 60 * 60 * 1000,
  });
}
