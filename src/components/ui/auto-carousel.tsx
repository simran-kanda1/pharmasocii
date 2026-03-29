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
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeftPos, setScrollLeftPos] = useState(0);

    // Initial position fix for right direction
    useEffect(() => {
        if (scrollRef.current && direction === "right" && scrollRef.current.scrollLeft === 0) {
           scrollRef.current.scrollLeft = scrollRef.current.scrollWidth / 4;
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
                    scrollRef.current.scrollLeft += scrollAmount;
                } else {
                    scrollRef.current.scrollLeft -= scrollAmount;
                }
                
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
        } 
        else if (element.scrollLeft <= 0) {
            element.scrollLeft += singleWidth;
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isHovered || isDragging) {
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
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; 
        scrollRef.current.scrollLeft = scrollLeftPos - walk;
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
