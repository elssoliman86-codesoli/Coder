'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { cn } from '@lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'always' | 'hover' | 'scroll';
  scrollHideDelay?: number;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, type = 'scroll', scrollHideDelay = 1000, style, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollbarXRef = useRef<HTMLDivElement>(null);
    const scrollbarYRef = useRef<HTMLDivElement>(null);
    const [showScrollbarX, setShowScrollbarX] = useState(false);
    const [showScrollbarY, setShowScrollbarY] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout>();

    useImperativeHandle(ref, () => ({
      scrollTo: (options: ScrollToOptions) => {
        containerRef.current?.scrollTo(options);
      },
      scrollTop: () => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      },
      scrollBottom: () => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      },
    }));

    const updateScrollbars = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;

      const { scrollWidth, clientWidth, scrollHeight, clientHeight, scrollLeft, scrollTop } = container;

      // Horizontal scrollbar
      if (scrollWidth > clientWidth) {
        const thumbWidth = (clientWidth / scrollWidth) * clientWidth;
        const thumbLeft = (scrollLeft / scrollWidth) * clientWidth;
        if (scrollbarXRef.current) {
          scrollbarXRef.current.style.width = `${thumbWidth}px`;
          scrollbarXRef.current.style.transform = `translateX(${thumbLeft}px)`;
        }
        setShowScrollbarX(true);
      } else {
        setShowScrollbarX(false);
      }

      // Vertical scrollbar
      if (scrollHeight > clientHeight) {
        const thumbHeight = (clientHeight / scrollHeight) * clientHeight;
        const thumbTop = (scrollTop / scrollHeight) * clientHeight;
        if (scrollbarYRef.current) {
          scrollbarYRef.current.style.height = `${thumbHeight}px`;
          scrollbarYRef.current.style.transform = `translateY(${thumbTop}px)`;
        }
        setShowScrollbarY(true);
      } else {
        setShowScrollbarY(false);
      }
    };

    const handleScroll = () => {
      updateScrollbars();
      if (type === 'scroll' || type === 'hover') {
        setShowScrollbarX(true);
        setShowScrollbarY(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (type === 'scroll') {
            setShowScrollbarX(false);
            setShowScrollbarY(false);
          }
        }, scrollHideDelay);
      }
    };

    const handleMouseEnter = () => {
      if (type === 'hover' || type === 'scroll') {
        setShowScrollbarX(true);
        setShowScrollbarY(true);
      }
    };

    const handleMouseLeave = () => {
      if (type === 'hover') {
        setShowScrollbarX(false);
        setShowScrollbarY(false);
      }
    };

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(updateScrollbars);
      resizeObserver.observe(container);
      resizeObserver.observe(contentRef.current!);

      container.addEventListener('scroll', handleScroll, { passive: true });
      updateScrollbars();

      return () => {
        resizeObserver.disconnect();
        container.removeEventListener('scroll', handleScroll);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      };
    }, [type, scrollHideDelay]);

    return (
      <div
        ref={containerRef}
        className={cn('relative overflow-hidden', className)}
        style={style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <div
          ref={contentRef}
          className="h-full w-full"
          tabIndex={-1}
        >
          {children}
        </div>

        {/* Vertical Scrollbar */}
        <div
          className={cn(
            'absolute right-0 top-0 h-full w-1.5 transition-opacity duration-200 pointer-events-none',
            showScrollbarY ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        >
          <div
            ref={scrollbarYRef}
            className="absolute right-0 w-1.5 rounded-full bg-border/50 hover:bg-border transition-colors duration-100"
            style={{ minHeight: '30px' }}
          />
        </div>

        {/* Horizontal Scrollbar */}
        <div
          className={cn(
            'absolute bottom-0 left-0 w-full h-1.5 transition-opacity duration-200 pointer-events-none',
            showScrollbarX ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        >
          <div
            ref={scrollbarXRef}
            className="absolute bottom-0 h-1.5 rounded-full bg-border/50 hover:bg-border transition-colors duration-100"
            style={{ minWidth: '30px' }}
          />
        </div>

        {/* Corner */}
        <div
          className={cn(
            'absolute bottom-0 right-0 w-1.5 h-1.5 transition-opacity duration-200 pointer-events-none',
            (showScrollbarX || showScrollbarY) ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
        >
          <div className="w-full h-full bg-border/50 rounded-br-lg" />
        </div>
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';