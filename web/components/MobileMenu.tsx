'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
  external: boolean;
  accent?: boolean;
}

const LINKS: readonly NavLink[] = [
  { href: '/watch', label: 'Watch', external: false },
  { href: '/playground', label: 'AI Demo', external: false, accent: true },
  { href: '/leaderboard', label: 'Leaderboard', external: false },
  {
    href: 'https://github.com/zaxcoraider/sentinel-mantle',
    label: 'Docs',
    external: true,
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
      >
        <span className="relative block h-3.5 w-5">
          <span
            className={`absolute left-0 top-0 h-px w-full bg-current transition-transform ${
              open ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] h-px w-full bg-current transition-opacity ${
              open ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-[14px] h-px w-full bg-current transition-transform ${
              open ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <nav className="fixed left-0 right-0 top-14 z-40 border-b border-sentinel-gray-2 bg-sentinel-black/95 backdrop-blur-sm">
          <div className="flex flex-col px-4 py-2">
            {LINKS.map(({ href, label, external, accent }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="font-mono text-sm text-sentinel-gray-1 hover:text-sentinel-white transition-colors tracking-wide uppercase py-3 border-b border-sentinel-gray-2/60 last:border-0"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`font-mono text-sm transition-colors tracking-wide uppercase py-3 border-b border-sentinel-gray-2/60 last:border-0 ${
                    accent
                      ? 'text-sentinel-cyan/80 hover:text-sentinel-cyan'
                      : 'text-sentinel-gray-1 hover:text-sentinel-white'
                  }`}
                >
                  {label}
                </Link>
              ),
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
