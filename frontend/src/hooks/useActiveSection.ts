import { useEffect, useState } from 'react';

/**
 * Hook that uses IntersectionObserver to track which section
 * is currently visible in the viewport.
 */
export function useActiveSection(sectionIds: string[]): {
  activeSectionId: string | null;
} {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const observers: IntersectionObserver[] = [];
    const visibleSections = new Map<string, number>();

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.set(entry.target.id, entry.intersectionRatio);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });

      // Pick the section with the highest intersection ratio
      let bestId: string | null = null;
      let bestRatio = 0;
      visibleSections.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });

      if (bestId) {
        setActiveSectionId(bestId);
      }
    };

    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '-80px 0px -50% 0px',
      threshold: [0, 0.1, 0.3, 0.5, 1],
    });

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [sectionIds]);

  return { activeSectionId };
}
