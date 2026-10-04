import { cn } from "@/lib/utils";

/**
 * Horizontal inset shared by every row in a goals surface: list items (goals,
 * milestones), section headers and the OKR header. Using one token keeps left
 * and right edges lined up without per-element padding tweaks.
 */
export const ROW_INSET = "px-2";

/** A labelled section with a fixed-height header row, so side-by-side sections align. */
export function Section({
  label,
  action,
  children,
  className,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className={cn("flex h-7 items-center justify-between", ROW_INSET)}>
        <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Inline "value label" chip for header stats; one line tall so it never stretches its row. */
export function StatChip({ value, label, style, className }: {
  value: React.ReactNode;
  label: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span className="bg-muted/60 flex h-7 items-baseline gap-1 rounded-full px-2.5 leading-7">
      <span style={style} className={cn("tabular text-[13px] font-semibold", className)}>
        {value}
      </span>
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </span>
  );
}
