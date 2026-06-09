'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getBrand } from '@/lib/brand';

interface Props {
  size?: number;
  showWordmark?: boolean;
  href?: string;
  className?: string;
}

export function Logo({ size = 36, showWordmark = true, href = '/', className = '' }: Props) {
  const brand = getBrand();
  // Gem logo is a wide wordmark+icon — render in aspect ratio with a
  // wider base and let the brand image speak for itself (no extra wordmark).
  const isWide = brand.code === 'gem';

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={brand.logoSrc}
        alt={brand.tagline}
        width={isWide ? size * 3 : size}
        height={size}
        priority
        className={isWide ? 'h-9 w-auto object-contain' : 'rounded-lg'}
        style={isWide ? { height: size } : undefined}
      />
      {showWordmark && !isWide && (
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            {brand.shortName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            {brand.tagline}
          </span>
        </span>
      )}
    </span>
  );

  if (href === '') return inner;
  return <Link href={href}>{inner}</Link>;
}
