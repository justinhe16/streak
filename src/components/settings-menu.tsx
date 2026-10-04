"use client";

import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  CheckIcon,
  DownloadIcon,
  MonitorIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
  UploadIcon,
} from "lucide-react";

import { usePalette } from "@/components/palette-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { PALETTES } from "@/lib/palettes";

const MODES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground px-0.5 text-[11px] font-medium tracking-wide uppercase">{children}</p>;
}

export function SettingsMenu() {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const fileRef = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(false);

  function pickBackup(replaceAll: boolean) {
    if (
      replaceAll &&
      !window.confirm("Replace everything with the backup? All current goals, check-ins, OKRs and reflections are wiped first.")
    ) {
      return;
    }
    setReplace(replaceAll);
    fileRef.current?.click();
  }

  async function importFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/import${replace ? "?mode=replace" : ""}`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      const added = Object.values(body.inserted as Record<string, number>).reduce((a, b) => a + b, 0);
      toast.success(`Imported ${added} row${added === 1 ? "" : "s"}`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Appearance settings"
          title="Settings"
          className="text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <Settings2Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-3 p-3">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Mode</SectionLabel>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => {
              if (v) setTheme(v);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Color mode"
            className="bg-background dark:bg-input/20 w-full"
          >
            {MODES.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground flex-1 gap-1.5 text-xs"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Theme</SectionLabel>
          <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-0.5">
            {PALETTES.map((p) => {
              const active = p.id === palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPalette(p.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none",
                    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  {/* The swatch re-scopes the palette tokens, so it previews the real colors in the current mode. */}
                  <span
                    data-palette={p.id}
                    aria-hidden
                    className="bg-background border-border flex h-8 w-11 shrink-0 items-center justify-between rounded-md border px-1.5"
                  >
                    <span className="font-heading text-foreground text-[13px] leading-none font-semibold">Aa</span>
                    <span className="bg-primary size-2.5 rounded-full" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground text-[13px] leading-5 font-medium">{p.label}</span>
                    <span className="text-muted-foreground truncate text-[11px] leading-4">{p.description}</span>
                  </span>
                  <CheckIcon className={cn("text-foreground size-3.5 shrink-0", !active && "invisible")} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Data</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <Button asChild variant="outline" size="sm">
              <a href="/api/export" download>
                <DownloadIcon /> Export
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => pickBackup(false)}>
              <UploadIcon /> Import
            </Button>
          </div>
          <button
            type="button"
            onClick={() => pickBackup(true)}
            className="text-muted-foreground hover:text-destructive self-start px-0.5 text-[11px] underline-offset-2 hover:underline"
          >
            Restore from backup (replace all)…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
