import { useMemo, useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getAllCommunityCountries } from "@/lib/communityCountries";
import { POST_COUNTRIES_MAX } from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (countries: string[]) => void;
  max?: number;
};

export function CountryMultiSelect({ value, onChange, max = POST_COUNTRIES_MAX }: Props) {
  const allCountries = useMemo(() => getAllCommunityCountries(), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toggle = (c: string) => {
    if (value.includes(c)) {
      onChange(value.filter((x) => x !== c));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, c]);
  };

  const filtered = allCountries.filter(
    (c) => !search.trim() || c.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Label>Countries (optional, max {max})</Label>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between h-10 font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 truncate text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {value.length ? value.join(", ") : "Select Country(ies)"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="border border-foreground/10 rounded-lg p-2">
          <input
            type="search"
            placeholder="Search…"
            className="w-full text-sm px-2 py-1.5 mb-2 rounded border border-foreground/10 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtered.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5">
                <Checkbox
                  checked={value.includes(c)}
                  disabled={!value.includes(c) && value.length >= max}
                  onCheckedChange={() => toggle(c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{value.length}/{max} selected</p>
    </div>
  );
}
