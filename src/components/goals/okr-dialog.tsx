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
  const [startDate, setStartDate] = useState(okr?.startDate ?? "");
  const [endDate, setEndDate] = useState(okr?.endDate ?? "");
  const [milestones, setMilestones] = useState("");
  const [saving, setSaving] = useState(false);

  const rangeError = startDate && endDate && endDate < startDate ? "End must be on or after the start." : null;
  const canSave = title.trim() !== "" && !saving && !rangeError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = {
        title: title.trim(),
        description,
        timeframe: timeframe.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (editing) {
        const { movedGoals } = await api.updateOkr(okr.id, fields);
        if (movedGoals > 0) toast(`Moved ${movedGoals} goal${movedGoals === 1 ? "" : "s"} to the new dates`);
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="okr-start">Start</Label>
            <Input id="okr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="okr-end">End</Label>
            <Input
              id="okr-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={rangeError ? true : undefined}
            />
          </div>
          <p className="text-muted-foreground col-span-2 -mt-1 text-xs">
            {rangeError ? (
              <span className="text-destructive">{rangeError}</span>
            ) : editing ? (
              "Optional. Goals that end with this OKR move with it."
            ) : (
              "Optional."
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="okr-timeframe">Label</Label>
          <Input
            id="okr-timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            placeholder="Optional, e.g. Q4 2026. Defaults to the dates."
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
