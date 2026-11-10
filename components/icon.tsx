// Inline icons (1.8 stroke at 17 px). To add one, paste the content of its <svg> here, with viewBox 0 0 24 24.
const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /></>,
  log: <><path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  ai: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /><path d="m6 6 1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" /></>,
  team: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.7-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><circle cx="17" cy="8" r="2.4" /><path d="M16 13.6c2.4.2 4 1.6 4.5 4" /></>,
  connector: <><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.5 12.7 4.8a4.6 4.6 0 0 1 6.5 6.5L17.5 13" /><path d="M13 17.5 11.3 19.2a4.6 4.6 0 0 1-6.5-6.5L6.5 11" /></>,
  device: <><rect x="6" y="3.5" width="12" height="6" rx="1" /><rect x="3.5" y="9.5" width="17" height="7" rx="2" /><rect x="7" y="14" width="10" height="6.5" rx="1" /></>,
  "sign-out": <><path d="M14 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" /><path d="M11 12h9M17 8.5l3.5 3.5L17 15.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  tool: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
};

export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      {PATHS[name] ?? PATHS.tool}
    </svg>
  );
}
