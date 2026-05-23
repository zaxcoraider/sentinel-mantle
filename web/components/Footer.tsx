export function Footer() {
  return (
    <footer className="border-t border-sentinel-gray-2 py-8 mt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-mono text-xs text-sentinel-gray-1 tracking-widest uppercase">
          SENTINEL
        </span>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/zaxcoraider/sentinel-mantle"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
          >
            X
          </a>
          <a
            href="https://github.com/zaxcoraider/sentinel-mantle"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
          >
            Docs
          </a>
        </div>
        <span className="font-mono text-xs text-sentinel-gray-1">
          Built on Mantle
        </span>
      </div>
    </footer>
  );
}
