import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton } from './ConnectButton';

interface Props {
  hideLinks?: boolean;
}

export function Nav({ hideLinks }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-sentinel-gray-2 bg-sentinel-black/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-mark.svg"
            alt="Sentinel shield mark"
            width={24}
            height={24}
          />
          <span className="font-mono font-bold tracking-widest text-sm text-sentinel-white uppercase">
            SENTINEL
          </span>
        </Link>

        {!hideLinks && (
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/watch"
              className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors tracking-wide uppercase"
            >
              Watch
            </Link>
            <Link
              href="/leaderboard"
              className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors tracking-wide uppercase"
            >
              Leaderboard
            </Link>
            <a
              href="https://github.com/zaxcoraider/sentinel-mantle"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors tracking-wide uppercase"
            >
              Docs
            </a>
          </nav>
        )}

        <ConnectButton />
      </div>
    </header>
  );
}
