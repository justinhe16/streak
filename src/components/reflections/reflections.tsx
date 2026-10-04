"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2Icon, NotebookPenIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Panel, PanelEmpty } from "@/components/workspace/panel";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/dates";
import type { Reflection } from "@/lib/types";

export type ReflectionModal = { mode: "read"; id: string } | { mode: "edit"; reflection: Reflection | null } | null;

type ReflectionsPanelProps = {
  reflections: Reflection[];
  onOpen: (modal: ReflectionModal) => void;
  onClose: () => void;
};

export function ReflectionsPanel({ reflections, onOpen, onClose }: ReflectionsPanelProps) {
  return (
    <Panel
      id="reflections"
      width="w-[20rem]"
      onClose={onClose}
      actions={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New reflection"
          onClick={() => onOpen({ mode: "edit", reflection: null })}
        >
          <PlusIcon />
        </Button>
      }
    >
      {reflections.length === 0 ? (
        <PanelEmpty icon={NotebookPenIcon}>
          <p className="max-w-56">Every so often, write down how it&apos;s going. The day gets a dot on the grid.</p>
          <Button size="sm" onClick={() => onOpen({ mode: "edit", reflection: null })}>
            <PlusIcon /> New reflection
          </Button>
        </PanelEmpty>
      ) : (
        <ul className="flex flex-col px-3 pb-3">
          {reflections.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen({ mode: "read", id: r.id })}
                className="hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors outline-none"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.title}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {formatDay(r.writtenOn, { year: true })}
                  </span>
                </span>
                {firstLine(r.body) && (
                  <span className="text-muted-foreground truncate text-[11px]">{firstLine(r.body)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type ReflectionDialogsProps = {
  reflections: Reflection[];
  today: string;
  modal: ReflectionModal;
  onModal: (modal: ReflectionModal) => void;
  reload: () => Promise<void>;
};

/** Reader, editor and delete confirm. Mounted by the workspace so any panel can open them. */
export function ReflectionDialogs({ reflections, today, modal, onModal, reload }: ReflectionDialogsProps) {
  const [pendingDelete, setPendingDelete] = useState<Reflection | null>(null);
  const open = modal?.mode === "read" ? (reflections.find((r) => r.id === modal.id) ?? null) : null;
  const close = () => onModal(null);

  return (
    <>
      <Dialog open={open !== null} onOpenChange={(o) => !o && close()}>
        {open && (
          <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg">{open.title}</DialogTitle>
              <DialogDescription>{formatDay(open.writtenOn, { weekday: true, year: true })}</DialogDescription>
            </DialogHeader>
            <div className="md overflow-y-auto pr-1">
              {open.body.trim() ? (
                <ReactMarkdown>{open.body}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Nothing written.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="destructive" size="sm" onClick={() => setPendingDelete(open)} className="sm:mr-auto">
                <Trash2Icon /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => onModal({ mode: "edit", reflection: open })}>
                <PencilIcon /> Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={modal?.mode === "edit"} onOpenChange={(o) => !o && close()}>
        {modal?.mode === "edit" && (
          <ReflectionForm
            reflection={modal.reflection}
            today={today}
            onClose={close}
            onSaved={async (r) => {
              await reload();
              onModal({ mode: "read", id: r.id });
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this reflection?"
        description={pendingDelete ? `“${pendingDelete.title}” will be permanently removed.` : null}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await api.deleteReflection(pendingDelete.id);
            close();
            await reload();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not delete.");
          }
        }}
      />
    </>
  );
}

function ReflectionForm({
  reflection,
  today,
  onClose,
  onSaved,
}: {
  reflection: Reflection | null;
  today: string;
  onClose: () => void;
  onSaved: (r: Reflection) => Promise<void>;
}) {
  const [title, setTitle] = useState(reflection?.title ?? "");
  const [writtenOn, setWrittenOn] = useState(reflection?.writtenOn ?? today);
  const [body, setBody] = useState(reflection?.body ?? "");
  const [saving, setSaving] = useState(false);
  const canSave = title.trim() !== "" && writtenOn !== "" && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const input = { title: title.trim(), writtenOn, body };
      const saved = reflection ? await api.updateReflection(reflection.id, input) : await api.createReflection(input);
      onClose();
      await onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the reflection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-2xl">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>{reflection ? "Edit reflection" : "New reflection"}</DialogTitle>
          <DialogDescription>Markdown is supported.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reflection-title">Title</Label>
            <Input
              id="reflection-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q3 2026 check-in"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reflection-date">Written on</Label>
            <Input id="reflection-date" type="date" value={writtenOn} onChange={(e) => setWrittenOn(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="write">
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder={"## What went well\n\n## What didn't\n\n## Next quarter"}
              className="min-h-64 font-mono text-[13px]"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="md min-h-64 rounded-lg border px-3 py-2">
              {body.trim() ? <ReactMarkdown>{body}</ReactMarkdown> : <p className="text-muted-foreground">Nothing yet.</p>}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function firstLine(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").trim())
    .find(Boolean);
  return line ?? "";
}
