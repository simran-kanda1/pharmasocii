import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = React.useState<string>("");

    React.useEffect(() => {
      if (type !== "file") return;
      const el = (typeof forwardedRef === "object" && forwardedRef?.current) ? forwardedRef.current : internalRef.current;
      if (!el) return;
      const checkVal = () => {
        if (!el.value && fileName) {
          setFileName("");
        }
      };
      const interval = setInterval(checkVal, 200);
      return () => clearInterval(interval);
    }, [type, fileName, forwardedRef]);

    if (type === "file") {
      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setFileName(file ? file.name : "");
        onChange?.(e);
      };

      return (
        <div
          onClick={() => {
            const el = (typeof forwardedRef === "object" && forwardedRef?.current) ? forwardedRef.current : internalRef.current;
            el?.click();
          }}
          className={cn(
            "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none overflow-hidden",
            className
          )}
        >
          <input
            type="file"
            className="sr-only"
            ref={(el) => {
              (internalRef as any).current = el;
              if (typeof forwardedRef === "function") {
                forwardedRef(el);
              } else if (forwardedRef && typeof forwardedRef === "object") {
                (forwardedRef as any).current = el;
              }
            }}
            onChange={handleFileChange}
            {...props}
          />
          <span className="inline-flex items-center justify-center rounded px-2.5 py-1 text-xs font-medium bg-foreground/10 text-foreground hover:bg-foreground/15 transition-colors mr-3 shrink-0">
            Choose
          </span>
          <span className={cn("text-xs truncate", fileName ? "text-foreground font-medium" : "text-muted-foreground")}>
            {fileName || "No file chosen"}
          </span>
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={forwardedRef}
        onChange={onChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
