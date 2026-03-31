import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AutoCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
    speed?: number; // pixels per second
    direction?: "left" | "right";
    innerClassName?: string;
    children: React.ReactNode;
}

export function AutoCarousel({ speed = 50, direction = "left", innerClassName, children, className, ...props }: AutoCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollPosRef = useRef(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeftPos, setScrollLeftPos] = useState(0);

    // Initial position fix for right direction
    useEffect(() => {
        if (scrollRef.current) {
            const initialPos = direction === "right" ? scrollRef.current.scrollWidth / 4 : 0;
            scrollRef.current.scrollLeft = initialPos;
            scrollPosRef.current = initialPos;
        }
    }, [direction, children]);

    useEffect(() => {
        let animationId: number;
        let lastTime = performance.now();

        const animate = (time: number) => {
            if (!isHovered && !isDragging && scrollRef.current) {
                const deltaTime = time - lastTime;
                // Cap to avoid huge jumps on inactive tabs
                const safeDelta = Math.min(deltaTime, 50);
                const scrollAmount = (speed * safeDelta) / 1000;
                
                if (direction === "left") {
                    scrollPosRef.current += scrollAmount;
                } else {
                    scrollPosRef.current -= scrollAmount;
                }
                
                scrollRef.current.scrollLeft = scrollPosRef.current;
                checkWrap(scrollRef.current);
            }
            lastTime = time;
            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [isHovered, isDragging, speed, direction]);

    const checkWrap = (element: HTMLDivElement) => {
        if (!element) return;
        
        const singleWidth = element.scrollWidth / 4;
        if (element.scrollLeft >= singleWidth * 2) {
            element.scrollLeft -= singleWidth;
            scrollPosRef.current = element.scrollLeft;
        } 
        else if (element.scrollLeft <= 0) {
            element.scrollLeft += singleWidth;
            scrollPosRef.current = element.scrollLeft;
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        // Sync our internal position whenever the user scrolls via other means
        if (isHovered || isDragging) {
            scrollPosRef.current = e.currentTarget.scrollLeft;
            checkWrap(e.currentTarget);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
        setScrollLeftPos(scrollRef.current?.scrollLeft || 0);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        // Sync one last time on release
        if (scrollRef.current) {
            scrollPosRef.current = scrollRef.current.scrollLeft;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; 
        scrollRef.current.scrollLeft = scrollLeftPos - walk;
        scrollPosRef.current = scrollRef.current.scrollLeft;
    };

    return (
        <div 
            ref={scrollRef}
            className={cn("flex overflow-x-auto w-full overscroll-x-none cursor-grab active:cursor-grabbing hide-scrollbar pb-4 -mb-4", className)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
            }}
            {...props}
        >
            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            {[...Array(4)].map((_, i) => (
                <div key={i} className={cn("flex shrink-0", innerClassName)}>
                    {children}
                </div>
            ))}
        </div>
    );
}
