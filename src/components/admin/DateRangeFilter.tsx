import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, X, ChevronDown, Check } from "lucide-react";

export interface DateRangeValue {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  month: string; // "1" - "12" or ""
  year: string; // "2026", etc. or ""
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  label?: string;
  className?: string;
}

const MONTH_NAMES = [
  { value: "1", label: "January", short: "Jan" },
  { value: "2", label: "February", short: "Feb" },
  { value: "3", label: "March", short: "Mar" },
  { value: "4", label: "April", short: "Apr" },
  { value: "5", label: "May", short: "May" },
  { value: "6", label: "June", short: "Jun" },
  { value: "7", label: "July", short: "Jul" },
  { value: "8", label: "August", short: "Aug" },
  { value: "9", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" },
];

const AVAILABLE_YEARS = ["2027", "2026", "2025", "2024", "2023"];

function formatFriendlyDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

export function DateRangeFilter({
  value,
  onChange,
  label = "Date Created",
  className = "",
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const hasFilter = Boolean(value.startDate || value.endDate || value.month || value.year);

  // Determine button display label
  let displayLabel = label;
  if (value.startDate && value.endDate) {
    if (value.startDate === value.endDate) {
      displayLabel = formatFriendlyDate(value.startDate);
    } else {
      displayLabel = `${formatFriendlyDate(value.startDate)} – ${formatFriendlyDate(value.endDate)}`;
    }
  } else if (value.startDate) {
    displayLabel = `From ${formatFriendlyDate(value.startDate)}`;
  } else if (value.endDate) {
    displayLabel = `Until ${formatFriendlyDate(value.endDate)}`;
  } else if (value.month && value.year) {
    const m = MONTH_NAMES.find((m) => m.value === value.month);
    displayLabel = `${m?.short || "Month"} ${value.year}`;
  } else if (value.month) {
    const m = MONTH_NAMES.find((m) => m.value === value.month);
    displayLabel = `${m?.label || "Month"}`;
  } else if (value.year) {
    displayLabel = `Year ${value.year}`;
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onChange({ startDate: "", endDate: "", month: "", year: "" });
  };

  const handleSelectThisMonth = () => {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString();
    const currentYear = now.getFullYear().toString();
    onChange({
      startDate: "",
      endDate: "",
      month: currentMonth,
      year: currentYear,
    });
    setIsOpen(false);
  };

  const handleSelectLastMonth = () => {
    const now = new Date();
    let prevMonth = now.getMonth(); // 0-indexed: previous month number
    let prevYear = now.getFullYear();
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    onChange({
      startDate: "",
      endDate: "",
      month: prevMonth.toString(),
      year: prevYear.toString(),
    });
    setIsOpen(false);
  };

  const handleSelectLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    onChange({
      startDate: fmt(start),
      endDate: fmt(end),
      month: "",
      year: "",
    });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-11 px-3.5 rounded-md border text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 select-none ${
          hasFilter
            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
        }`}
        title="Filter by created date range or month"
      >
        <Calendar className={`w-4 h-4 ${hasFilter ? "text-white" : "text-slate-500"}`} />
        <span className="truncate max-w-[170px]">{displayLabel}</span>
        {hasFilter ? (
          <span
            onClick={handleClear}
            className="ml-1 p-0.5 rounded-full hover:bg-slate-700 transition-colors"
            title="Clear date filter"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 sm:right-auto mt-1.5 w-[330px] sm:w-[360px] bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50 text-slate-800 animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Filter by Created Date
              </h4>
            </div>
            {hasFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="mt-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Presets
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectThisMonth}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-medium text-center transition-colors truncate"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={handleSelectLastMonth}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-medium text-center transition-colors truncate"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={handleSelectLast30Days}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 font-medium text-center transition-colors truncate"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Month & Year Selection */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Filter by Month &amp; Year
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Month</label>
                <select
                  value={value.month || ""}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    onChange({
                      ...value,
                      month: newMonth,
                      // Clear explicit date inputs if choosing month/year
                      startDate: "",
                      endDate: "",
                      year: value.year || "2026",
                    });
                  }}
                  className="w-full h-9 px-2 text-xs rounded-md border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Months</option>
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Year</label>
                <select
                  value={value.year || ""}
                  onChange={(e) => {
                    const newYear = e.target.value;
                    onChange({
                      ...value,
                      year: newYear,
                      startDate: "",
                      endDate: "",
                    });
                  }}
                  className="w-full h-9 px-2 text-xs rounded-md border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Years</option>
                  {AVAILABLE_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Or Choose Date Range
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">From Date</label>
                <input
                  type="date"
                  value={value.startDate || ""}
                  onChange={(e) => {
                    onChange({
                      ...value,
                      startDate: e.target.value,
                      // Clear month/year preset when picking specific date range
                      month: "",
                      year: "",
                    });
                  }}
                  className="w-full h-9 px-2 text-xs rounded-md border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={value.endDate || ""}
                  onChange={(e) => {
                    onChange({
                      ...value,
                      endDate: e.target.value,
                      month: "",
                      year: "",
                    });
                  }}
                  className="w-full h-9 px-2 text-xs rounded-md border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium py-1"
            >
              Reset
            </button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800 px-4"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

