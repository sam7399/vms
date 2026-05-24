import Link from 'next/link';
import { Logo } from '@/components/logo';

export function BrandFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] mt-16 py-7 text-xs text-zinc-500 bg-surface-950/60 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Logo size={26} showWordmark={false} href="" />
        <p className="text-center md:text-left">
          VMS · Enterprise Visitor &amp; Workforce Management
        </p>
        <div className="text-center md:text-right">
          Built by{' '}
          <span className="text-brand-400 font-medium">Personify Crafters</span>{' '}
          for{' '}
          <Link
            href="https://thestudioinfinito.com"
            className="text-brand-400 hover:text-brand-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Studio Infinito
          </Link>
        </div>
      </div>
    </footer>
  );
}
