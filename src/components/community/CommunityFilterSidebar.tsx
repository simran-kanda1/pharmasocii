import { useMemo, useState } from "react";
import { MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { CommunityCategoryDoc } from "@/lib/communityTypes";
import { buildFilterKeys } from "@/lib/community";
import { getAllCommunityCountries } from "@/lib/communityCountries";
import { cn } from "@/lib/utils";

export type FilterSelection = {
  countries: string[];
  filterKeys: string[];
};

type Props = {
  categoryDoc: CommunityCategoryDoc;
  selectedCountries: string[];
  selectedFilterKeys: string[];
  onCountriesChange: (countries: string[]) => void;
  onFilterKeysChange: (keys: string[]) => void;
  locked?: boolean;
};

function keyMainSub(main: string, sub: string) {
  return `${main}|||${sub}`;
}

export function CommunityFilterSidebar({
  categoryDoc,
  selectedCountries,
  selectedFilterKeys,
  onCountriesChange,
  onFilterKeysChange,
  locked = false,
}: Props) {
  const allCountries = useMemo(() => getAllCommunityCountries(), []);
  const [expandedMains, setExpandedMains] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const toggleCountry = (c: string) => {
    if (locked) return;
    onCountriesChange(
      selectedCountries.includes(c)
        ? selectedCountries.filter((x) => x !== c)
        : [...selectedCountries, c],
    );
  };

  const toggleFilterKey = (key: string, checked: boolean) => {
    if (locked) return;
    if (checked) {
      if (!selectedFilterKeys.includes(key)) {
        onFilterKeysChange([...selectedFilterKeys, key]);
      }
    } else {
      onFilterKeysChange(selectedFilterKeys.filter((k) => k !== key));
    }
  };

  const setFilterKeys = (next: string[]) => {
    onFilterKeysChange([...new Set(next)]);
  };

  const onMainCheck = (mainLabel: string, checked: boolean) => {
    const key = `main:${mainLabel}`;
    if (checked) {
      const prefix = `sub:${mainLabel}:`;
      const ssPrefix = `ss:${mainLabel}:`;
      const next = selectedFilterKeys.filter(
        (k) => k !== key && !k.startsWith(prefix) && !k.startsWith(ssPrefix),
      );
      setFilterKeys([...next, key]);
    } else {
      toggleFilterKey(key, false);
    }
  };

  const onSubCheck = (mainLabel: string, subLabel: string, checked: boolean) => {
    const key = `sub:${mainLabel}:${subLabel}`;
    const mainKey = `main:${mainLabel}`;
    if (checked) {
      const next = selectedFilterKeys.filter((k) => k !== mainKey);
      if (!next.includes(key)) next.push(key);
      setFilterKeys(next);
      setExpandedMains((prev) => new Set(prev).add(mainLabel));
    } else {
      toggleFilterKey(key, false);
    }
  };

  const onSubSubCheck = (mainLabel: string, subLabel: string, subSubLabel: string, checked: boolean) => {
    const key = `ss:${mainLabel}:${subSubLabel}`;
    const mainKey = `main:${mainLabel}`;
    const subKey = `sub:${mainLabel}:${subLabel}`;
    if (checked) {
      let next = selectedFilterKeys.filter((k) => k !== mainKey && k !== subKey);
      if (!next.includes(key)) next.push(key);
      setFilterKeys(next);
      setExpandedMains((prev) => new Set(prev).add(mainLabel));
      setExpandedSubs((prev) => new Set(prev).add(keyMainSub(mainLabel, subLabel)));
    } else {
      toggleFilterKey(key, false);
    }
  };

  const toggleMainExpand = (label: string) => {
    setExpandedMains((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleSubExpand = (msKey: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(msKey)) next.delete(msKey);
      else next.add(msKey);
      return next;
    });
  };

  return (
    <div className={cn("space-y-4", locked && "opacity-60 pointer-events-none select-none")}>
      {locked && (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          Sign in and set up your member profile to use filters.
        </p>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
        <Button
          variant="outline"
          className="w-full justify-between h-10 font-normal text-left"
          type="button"
          onClick={() => setCountryOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 truncate text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            {selectedCountries.length
              ? selectedCountries.length > 2
                ? `${selectedCountries.length} countries`
                : selectedCountries.join(", ")
              : "Select Country(ies)"}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", countryOpen && "rotate-180")} />
        </Button>
        {countryOpen && (
          <div className="mt-2 border border-slate-200 rounded-lg p-2 dark:border-foreground/15">
            <input
              type="search"
              placeholder="Search Countries…"
              className="w-full text-sm px-2 py-1.5 mb-2 rounded border border-slate-200 dark:border-foreground/15 bg-background"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {allCountries
                .filter((c) => !countrySearch.trim() || c.toLowerCase().includes(countrySearch.toLowerCase()))
                .map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedCountries.includes(c)}
                      onCheckedChange={() => toggleCountry(c)}
                    />
                    <span>{c}</span>
                  </label>
                ))}
            </div>
          </div>
        )}
        {selectedCountries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 px-2 text-xs"
            onClick={() => onCountriesChange([])}
          >
            Clear Countries
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/15 dark:bg-card">
        <p className="text-sm font-semibold mb-3">Categories</p>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto space-y-1 pr-1">
          {(categoryDoc.mains ?? []).map((main) => {
            const hasSubs = (main.subs?.length ?? 0) > 0;
            const mainKey = `main:${main.label}`;
            const mainExpanded = expandedMains.has(main.label);
            const mainChecked = selectedFilterKeys.includes(mainKey);
            return (
              <div key={main.id}>
                <div className="flex items-start gap-1">
                  {hasSubs ? (
                    <button
                      type="button"
                      className="p-1 mt-0.5 shrink-0"
                      onClick={() => toggleMainExpand(main.label)}
                      aria-label={mainExpanded ? "Collapse" : "Expand"}
                    >
                      {mainExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-5 shrink-0" />
                  )}
                  <label className="flex items-start gap-2 text-sm cursor-pointer flex-1 py-0.5">
                    <Checkbox
                      className="mt-0.5"
                      checked={mainChecked}
                      onCheckedChange={(v) => onMainCheck(main.label, v === true)}
                    />
                    <span className="leading-snug">{main.label}</span>
                  </label>
                </div>
                {hasSubs && mainExpanded && (
                  <div className="ml-6 space-y-1 border-l border-slate-100 pl-2 dark:border-foreground/10">
                    {(main.subs ?? []).map((sub) => {
                      const msKey = keyMainSub(main.label, sub.label);
                      const hasSubSubs = (sub.subSubs?.length ?? 0) > 0;
                      const subExpanded = expandedSubs.has(msKey);
                      const subKey = `sub:${main.label}:${sub.label}`;
                      const subChecked = selectedFilterKeys.includes(subKey);
                      return (
                        <div key={sub.id}>
                          <div className="flex items-start gap-1">
                            {hasSubSubs ? (
                              <button
                                type="button"
                                className="p-1 mt-0.5 shrink-0"
                                onClick={() => toggleSubExpand(msKey)}
                              >
                                {subExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <label className="flex items-start gap-2 text-sm cursor-pointer flex-1">
                              <Checkbox
                                className="mt-0.5"
                                checked={subChecked}
                                onCheckedChange={(v) => onSubCheck(main.label, sub.label, v === true)}
                              />
                              <span className="text-muted-foreground leading-snug">{sub.label}</span>
                            </label>
                          </div>
                          {hasSubSubs && subExpanded && (
                            <div className="ml-5 space-y-1">
                              {(sub.subSubs ?? []).map((ss) => {
                                const ssKey = `ss:${main.label}:${ss.label}`;
                                const ssChecked = selectedFilterKeys.includes(ssKey);
                                return (
                                  <label
                                    key={ss.id}
                                    className="flex items-start gap-2 text-xs cursor-pointer pl-1"
                                  >
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={ssChecked}
                                      onCheckedChange={(v) =>
                                        onSubSubCheck(main.label, sub.label, ss.label, v === true)
                                      }
                                    />
                                    <span className="text-muted-foreground">{ss.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selectedFilterKeys.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("mt-3 h-8 px-2 text-xs")}
            onClick={() => onFilterKeysChange([])}
          >
            Clear categories
          </Button>
        )}
      </div>
    </div>
  );
}

/** Selected filter keys for client-side post matching. */
export function filterKeysFromSelection(selectedFilterKeys: string[]): string[] {
  return selectedFilterKeys;
}

export { buildFilterKeys };
