import Link from 'next/link';

export function BrandFooter() {
  return (
    <footer className="border-t border-white/5 mt-12 py-6 text-xs text-zinc-500">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>VMS · Enterprise Visitor &amp; Workforce Management</span>
        </div>
        <div className="text-center md:text-right">
          Crafted by{' '}
          <Link
            href="https://thestudioinfinito.com"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            TheStudioInfinito
          </Link>{' '}
          &amp; Personify Crafters
        </div>
      </div>
    </footer>
  );
}
