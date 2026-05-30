import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { changeLocale, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';

const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'RU',
  en: 'EN',
};

export function LanguageSwitcher(): JSX.Element {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage as Locale | undefined) ?? 'ru';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label={t('lang.label')}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wider">{LOCALE_LABELS[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('lang.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((loc) => (
          <DropdownMenuCheckboxItem
            key={loc}
            checked={current === loc}
            onCheckedChange={(checked) => {
              if (checked) changeLocale(loc);
            }}
          >
            {t(`lang.${loc}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
