"use client";

import { useState } from "react";
import { ChevronDownIcon, HammerIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PlusIcon, TargetIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, PanelEmpty, PanelLabel } from "@/components/workspace/panel";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { BUILD_STATUSES, BUILD_STATUS_LABELS, type BuildStatus } from "@/lib/constants";
import type { Build, Okr } from "@/lib/types";
import { BUILD_STATUS_STYLES } from "./build-status";
import { cn } from "@/lib/utils";


/** Finished groups read quieter so what's live stays on top visually. */
const SETTLED: ReadonlySet<BuildStatus> = new Set(["done", "cancelled"]);

const ALL = "__all";
const NO_OKR = "__none";

type BuildsPanelProps = {
  builds: Build[];
  okrs: Okr[];
  reload: () => Promise<void>;
  onClose: () => void;
};

export function BuildsPanel({ builds, okrs, reload, onClose }: BuildsPanelProps) {
  const okrTitle = new Map(okrs.map((o) => [o.id, o.title]));
  const [category, setCategory] = useState<string>(ALL);
  const [editor, setEditor] = useState<{ build: Build | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Build | null>(null);

  const categories = [...new Set(builds.map((b) => b.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visible = category === ALL || !categories.includes(category) ? builds : builds.filter((b) => b.category === category);

  async function setStatus(build: Build, status: BuildStatus) {
    try {
      await api.updateBuild(build.id, { status });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the status.");
    }
  }

  return (
    <Panel
      id="builds"
      width="w-[22rem]"
      onClose={onClose}
      actions={
        <Button variant="ghost" size="icon-sm" aria-label="New build" onClick={() => setEditor({ build: null })}>
          <PlusIcon />
        </Button>
      }
    >
      {builds.length === 0 ? (
        <PanelEmpty icon={HammerIcon}>
          <p>Jot down the side projects you want to make.</p>
          <Button size="sm" onClick={() => setEditor({ build: null })}>
            <PlusIcon /> New build
          </Button>
        </PanelEmpty>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {[ALL, ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                    (category === c || (c === ALL && !categories.includes(category)))
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground border-border",
                  )}
                >
                  {c === ALL ? "All" : c}
                </button>
              ))}
            </div>
          )}
          {BUILD_STATUSES.map((status) => {
            const group = visible.filter((b) => b.status === status);
            if (group.length === 0) return null;
            return (
              <section key={status} className={cn("flex flex-col gap-1", SETTLED.has(status) && "opacity-70")}>
                <PanelLabel className="flex items-center gap-1.5">
                  {BUILD_STATUS_LABELS[status]}
                  <span className="tabular-nums opacity-70">{group.length}</span>
                </PanelLabel>
                <ul className="flex flex-col">
                  {group.map((b) => (
                    <BuildRow
                      key={b.id}
                      build={b}
                      okrTitle={b.okrId ? okrTitle.get(b.okrId) : undefined}
                      onOpen={() => setEditor({ build: b })}
                      onStatus={(s) => void setStatus(b, s)}
                      onDelete={() => setPendingDelete(b)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={editor !== null} onOpenChange={(o) => !o && setEditor(null)}>
        {editor && (
          <BuildForm
            build={editor.build}
            categories={categories}
            okrs={okrs}
            onClose={() => setEditor(null)}
            onSaved={reload}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this build?"
        description={pendingDelete ? `“${pendingDelete.title}” will be permanently removed.` : null}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await api.deleteBuild(pendingDelete.id);
            await reload();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete.");
          }
        }}
      />
    </Panel>
  );
}

function BuildRow({
  build,
  okrTitle,
  onOpen,
  onStatus,
  onDelete,
}: {
  build: Build;
  /** Title of the linked OKR, if any. */
  okrTitle?: string;
  onOpen: () => void;
  onStatus: (s: BuildStatus) => void;
  onDelete: () => void;
}) {
  return (
    <li className="group/build hover:bg-muted/50 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors">
      <StatusPill status={build.status} onChange={onStatus} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left outline-none">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{build.title}</span>
          {okrTitle && (
            <span
              title={`OKR: ${okrTitle}`}
              className="text-muted-foreground border-border flex h-[18px] max-w-[45%] shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium"
            >
              <TargetIcon className="size-2.5 shrink-0" aria-hidden />
              <span className="truncate">{okrTitle}</span>
            </span>
          )}
        </span>
        {(build.category || build.description) && (
          <span className="text-muted-foreground truncate text-[11px]">
            {[build.category, build.description].filter(Boolean).join(" · ")}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${build.title}`}
            className="text-muted-foreground opacity-60 group-hover/build:opacity-100"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function StatusPill({ status, onChange }: { status: BuildStatus; onChange: (s: BuildStatus) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-5 w-[5.25rem] shrink-0 items-center justify-between gap-1 rounded-full px-2 text-[11px] font-medium transition-opacity hover:opacity-80",
            BUILD_STATUS_STYLES[status],
          )}
        >
          {BUILD_STATUS_LABELS[status]}
          <ChevronDownIcon className="size-3 no-underline" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as BuildStatus)}>
          {BUILD_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {BUILD_STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BuildForm({
  build,
  categories,
  okrs,
  onClose,
  onSaved,
}: {
  build: Build | null;
  categories: string[];
  okrs: Okr[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(build?.title ?? "");
  const [description, setDescription] = useState(build?.description ?? "");
  const [category, setCategory] = useState(build?.category ?? "");
  const [status, setStatus] = useState<BuildStatus>(build?.status ?? "idea");
  const [okrId, setOkrId] = useState<string>(build?.okrId ?? NO_OKR);
  const [saving, setSaving] = useState(false);
  const canSave = title.trim() !== "" && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description,
        category: category.trim(),
        status,
        okrId: okrId === NO_OKR ? null : okrId,
      };
      if (build) await api.updateBuild(build.id, input);
      else await api.createBuild(input);
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the build.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>{build ? "Edit build" : "New build"}</DialogTitle>
          <DialogDescription>A side project you want to make.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="build-title">Title</Label>
          <Input id="build-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Streak" autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="build-description">Description</Label>
          <Textarea id="build-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="build-category">Category</Label>
            <Input
              id="build-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. web app"
              list="build-categories"
            />
            <datalist id="build-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BuildStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BUILD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>OKR</Label>
          <Select value={okrId} onValueChange={setOkrId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OKR}>None</SelectItem>
              {okrs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving && <Loader2Icon className="animate-spin" />}
            {build ? "Save" : "Create build"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
