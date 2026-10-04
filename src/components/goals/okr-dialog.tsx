"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { Okr } from "@/lib/types";

type OkrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  okr: Okr | null;
  onSaved: () => void;
};

export function OkrDialog(props: OkrDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <OkrForm {...props} />}
    </Dialog>
  );
}

function OkrForm({ onOpenChange, okr, onSaved }: OkrDialogProps) {
  const editing = okr !== null;
  const [title, setTitle] = useState(okr?.title ?? "");
  const [description, setDescription] = useState(okr?.description ?? "");
  const [timeframe, setTimeframe] = useState(okr?.timeframe ?? "");
  const [milestones, setMilestones] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() !== "" && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = { title: title.trim(), description, timeframe: timeframe.trim() || null };
      if (editing) {
        await api.updateOkr(okr.id, fields);
      } else {
        await api.createOkr({
          ...fields,
          milestones: milestones
            .split("\n")
            .map((m) => m.trim())
            .filter(Boolean),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the OKR.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit OKR" : "New OKR"}</DialogTitle>
          <DialogDescription>An objective you work toward through one or more goals.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="okr-title">Title</Label>
          <Input id="okr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Get strong" autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="okr-description">Description</Label>
          <Textarea id="okr-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="okr-timeframe">Timeframe</Label>
          <Input
            id="okr-timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            placeholder="Optional, e.g. 2026"
          />
        </div>

        {!editing && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="okr-milestones">Milestones</Label>
            <Textarea
              id="okr-milestones"
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              placeholder={"One per line, e.g.\nBench press 225 lb\nRun a sub-25 5k"}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving && <Loader2Icon className="animate-spin" />}
            {editing ? "Save" : "Create OKR"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
