import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { X, Play } from "lucide-react";

export type OptimizationMode = 'server' | 'local';

interface Props {
  onSelect: (symbol: string) => void;
  onRunQueue?: (symbols: string[]) => void;
  onAddToQueue?: (symbols: string[]) => void;
  disabled?: boolean;
  isRunning?: boolean;
  mode?: OptimizationMode;
  onModeChange?: (mode: OptimizationMode) => void;
}

export default function SymbolSearch({ onSelect, onRunQueue, onAddToQueue, disabled, isRunning, mode = 'server', onModeChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; sector?: string | null }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allSymbols, setAllSymbols] = useState<{ symbol: string; sector?: string | null }[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('sp500_symbols').select('symbol, sector').eq('is_active', true)
      .order('symbol').then(({ data }) => {
        if (data) setAllSymbols(data);
      });
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toUpperCase().trim();
    const filtered = allSymbols.filter(s => s.symbol.startsWith(q)).slice(0, 10);
    if (filtered.length === 0 && q.length >= 1 && q.length <= 5 && /^[A-Z]+$/.test(q)) {
      filtered.push({ symbol: q, sector: 'Custom' });
    }
    setResults(filtered);
  }, [query, allSymbols]);

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
    if (selectedSymbols.includes(symbol)) return;
    setSelectedSymbols(prev => [...prev, symbol]);
    setQuery("");
    setShowDropdown(false);
  };

  const handleRemove = (symbol: string) => {
    setSelectedSymbols(prev => prev.filter(s => s !== symbol));
  };

  const handleRun = () => {
    if (selectedSymbols.length === 0) return;
    if (isRunning && onAddToQueue) {
      onAddToQueue(selectedSymbols);
      setSelectedSymbols([]);
      return;
    }
    if (selectedSymbols.length === 1) {
      onSelect(selectedSymbols[0]);
    } else if (onRunQueue) {
      onRunQueue(selectedSymbols);
    } else {
      onSelect(selectedSymbols[0]);
    }
    setSelectedSymbols([]);
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
    <div className="space-y-2">
      {/* Mode toggle */}
      {onModeChange && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">מנוע:</span>
          <button
            onClick={() => onModeChange('server')}
            className={cn(
              "px-2 py-0.5 rounded transition-colors",
              mode === 'server' ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={isRunning}
          >
            🖥️ שרת
          </button>
          <button
            onClick={() => onModeChange('local')}
            className={cn(
              "px-2 py-0.5 rounded transition-colors",
              mode === 'local' ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={isRunning}
          >
            💻 מקומי
          </button>
          <span className="text-[10px] text-muted-foreground/60">
            {mode === 'server' ? '(Railway — ריצות ארוכות)' : '(דפדפן — מהירות מקסימלית)'}
          </span>
        </div>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="🔍 חפש מניה... (למשל AAPL, TSLA, NVDA)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
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
                  "hover:bg-primary/10 transition-colors",
                  selectedSymbols.includes(r.symbol) && "opacity-50"
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

      {selectedSymbols.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap flex-1">
            {selectedSymbols.map(s => (
              <Badge key={s} variant="secondary" className="gap-1 text-xs font-mono">
                {s}
                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemove(s)} />
              </Badge>
            ))}
          </div>
          <Button size="sm" onClick={handleRun} className="gap-1.5 shrink-0">
            <Play className="w-3.5 h-3.5" />
            {isRunning ? `הוסף ${selectedSymbols.length} לתור` : `הרץ ${selectedSymbols.length} מניות`}
          </Button>
        </div>
      )}
    </div>
  );
}
