// ponytail: framer-motion is dynamically imported through these wrappers.
// Direct framer-motion imports in individual components (Navbar, Cards, etc.)
// still load eagerly — converting those is a larger refactor tracked separately.
import dynamic from 'next/dynamic';

export const FadeIn = dynamic(() => import('./FadeIn'), { ssr: false });
export const SlideUp = dynamic(() => import('./SlideUp'), { ssr: false });
export const ScaleIn = dynamic(() => import('./ScaleIn'), { ssr: false });
export const StaggerContainer = dynamic(
  () => import('./StaggerContainer').then((mod) => ({ default: mod.default })),
  { ssr: false }
);
export const StaggerItem = dynamic(
  () => import('./StaggerContainer').then((mod) => ({ default: mod.StaggerItem })),
  { ssr: false }
);
