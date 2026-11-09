import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // Delay in milliseconds for staggered item groups
  duration?: number; // Duration in milliseconds
  direction?: 'up' | 'none';
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delay = 0,
  duration = 650,
  direction = 'up',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect user's accessibility reduced motion preferences
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target); // Trigger once; avoid repetitive flickering
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, []);

  const transformStyle =
    direction === 'up' && !isVisible ? 'translateY(24px)' : 'translateY(0)';

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: transformStyle,
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delay}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      }}
      className={className}
    >
      {children}
    </div>
  );
};
