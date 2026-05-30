export interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/pricing', labelKey: 'nav.pricing' },
  { to: '/guides', labelKey: 'nav.guides' },
];
