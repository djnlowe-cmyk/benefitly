'use client';

import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, isDesktop: true });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBp({
        isMobile: w < 640,
        isTablet: w >= 640 && w < 1024,
        isDesktop: w >= 1024,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return bp;
}

export function rGrid(bp: { isMobile: boolean; isTablet: boolean; isDesktop: boolean }, desktopCols = 2): string {
  if (bp.isMobile) return '1fr';
  if (bp.isTablet) return desktopCols > 2 ? 'repeat(2, 1fr)' : '1fr';
  return `repeat(${desktopCols}, 1fr)`;
}
