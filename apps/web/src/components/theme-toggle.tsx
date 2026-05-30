import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from '@/providers/theme-provider';

export function ThemeToggle(): JSX.Element {
  const { t } = useTranslation();
  const { theme, resolved, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('themeToggle.label')}
          title={t('themeToggle.label')}
        >
          {resolved === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('themeToggle.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeItem value="light" current={theme} onSelect={setTheme}>
          <Sun className="mr-2 h-4 w-4" />
          {t('themeToggle.light')}
        </ThemeItem>
        <ThemeItem value="dark" current={theme} onSelect={setTheme}>
          <Moon className="mr-2 h-4 w-4" />
          {t('themeToggle.dark')}
        </ThemeItem>
        <ThemeItem value="system" current={theme} onSelect={setTheme}>
          <Monitor className="mr-2 h-4 w-4" />
          {t('themeToggle.system')}
        </ThemeItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ItemProps {
  value: Theme;
  current: Theme;
  onSelect: (next: Theme) => void;
  children: React.ReactNode;
}

function ThemeItem({ value, current, onSelect, children }: ItemProps): JSX.Element {
  return (
    <DropdownMenuCheckboxItem
      checked={current === value}
      onCheckedChange={(checked) => {
        if (checked) onSelect(value);
      }}
    >
      {children}
    </DropdownMenuCheckboxItem>
  );
}
