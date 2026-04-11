import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onSelect: (symbol: string) => void;
  disabled?: boolean;
}

export default function SymbolSearch({ onSelect, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; sector?: string | null }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allSymbols, setAllSymbols] = useState<{ symbol: string; sector?: string | null }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load sp500_symbols on mount
  useEffect(() => {
    supabase.from('sp500_symbols').select('symbol, sector').eq('is_active', true)
      .order('symbol').then(({ data }) => {
        if (data) setAllSymbols(data);
      });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toUpperCase().trim();
    const filtered = allSymbols.filter(s =>
      s.symbol.startsWith(q)
    ).slice(0, 10);

    // If no match in SP500, allow custom symbol
    if (filtered.length === 0 && q.length >= 1 && q.length <= 5 && /^[A-Z]+$/.test(q)) {
      filtered.push({ symbol: q, sector: 'Custom' });
    }
    setResults(filtered);
  }, [query, allSymbols]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (symbol: string) => {
    setQuery("");
    setShowDropdown(false);
    onSelect(symbol);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim().length >= 1) {
      const q = query.toUpperCase().trim();
      if (/^[A-Z]{1,5}$/.test(q)) {
        handleSelect(q);
      }
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder="🔍 חפש מניה... (למשל AAPL, TSLA, NVDA)"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="text-sm"
        dir="ltr"
      />
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border overflow-hidden shadow-lg max-h-[300px] overflow-y-auto"
          style={{ background: 'hsl(var(--surface))', borderColor: 'hsl(var(--border))' }}
        >
          {results.map((r) => (
            <div
              key={r.symbol}
              onClick={() => handleSelect(r.symbol)}
              className={cn(
                "px-3 py-2 cursor-pointer flex justify-between items-center text-sm",
                "hover:bg-primary/10 transition-colors"
              )}
            >
              <span className="font-bold font-mono">{r.symbol}</span>
              {r.sector && (
                <span className="text-[10px] text-muted-foreground">{r.sector}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
