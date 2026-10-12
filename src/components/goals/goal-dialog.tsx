"use client";

import { useState } from "react";
import { LockIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { validateGoalDates } from "@/lib/goal-dates";
import type { Goal, Okr } from "@/lib/types";
import { frequencyLabel } from "./goal-utils";

const NO_OKR = "__none";

type GoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set; creating otherwise. */
  goal: Goal | null;
  okrs: Okr[];
  today: string;
  defaultOkrId?: string | null;
  onSaved: () => void;
};

export function GoalDialog(props: GoalDialogProps) {
  // Remount per open so the form starts from the goal being edited.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <GoalForm {...props} />}
    </Dialog>
  );
}

function GoalForm({ onOpenChange, goal, okrs, today, defaultOkrId, onSaved }: GoalDialogProps) {
  const editing = goal !== null;
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [okrId, setOkrId] = useState<string>(goal?.okrId ?? defaultOkrId ?? NO_OKR);
  const [daysPerWeek, setDaysPerWeek] = useState("7");
  const [startDate, setStartDate] = useState(goal?.startDate ?? today);
  const [perpetual, setPerpetual] = useState(goal ? goal.endDate === null : true);
  const [endDate, setEndDate] = useState(goal?.endDate ?? "");
  const [saving, setSaving] = useState(false);

  const nextEnd = perpetual ? null : endDate || null;
  // Editing uses the same rules the server enforces: dates can grow but never rewrite the past.
  const dateError = editing
    ? validateGoalDates(goal, { startDate, endDate: nextEnd }, today)
    : nextEnd !== null && nextEnd < startDate
      ? "End must be on or after the start."
      : null;
  const datesComplete = startDate !== "" && (perpetual || endDate !== "");
  const canSave = title.trim() !== "" && !saving && datesComplete && !dateError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const linked = okrId === NO_OKR ? null : okrId;
    try {
      if (editing) {
        const datesChanged = startDate !== goal.startDate || nextEnd !== goal.endDate;
        await api.updateGoal(goal.id, {
          title: title.trim(),
          description,
          okrId: linked,
          ...(datesChanged ? { startDate, endDate: nextEnd } : {}),
        });
      } else {
        await api.createGoal({
          title: title.trim(),
          description,
          daysPerWeek: Number(daysPerWeek),
          startDate,
          endDate: perpetual ? null : endDate,
          okrId: linked,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Frequency is fixed. Dates can grow but never rewrite the past."
              : "A habit you want to hit some number of days each week."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-title">Title</Label>
          <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lift weights" autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-description">Description</Label>
          <Textarea
            id="goal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            rows={2}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
          {editing ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <LockIcon className="size-3" /> {frequencyLabel(goal.daysPerWeek)}. Frequency can&apos;t change. Start can only
              move earlier once begun; end can&apos;t move before today.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <LockIcon className="size-3" /> Frequency can&apos;t be changed after you create the goal.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label>Frequency</Label>
                <Select value={daysPerWeek} onValueChange={setDaysPerWeek}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 6, 5, 4, 3, 2, 1].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 7 ? "Every day" : `${n} day${n === 1 ? "" : "s"} a week`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-start">Start</Label>
              <Input
                id="goal-start"
                type="date"
                value={startDate}
                // Once begun, the start can only move earlier.
                max={editing && goal.startDate <= today ? goal.startDate : undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-end">End</Label>
              <Input
                id="goal-end"
                type="date"
                value={perpetual ? "" : endDate}
                min={editing ? (startDate > today ? startDate : today) : startDate}
                disabled={perpetual}
                onChange={(e) => setEndDate(e.target.value)}
                aria-invalid={dateError ? true : undefined}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={perpetual} onCheckedChange={(v) => setPerpetual(v === true)} />
            Perpetual (no end date)
          </label>
          {dateError && <p className="text-destructive text-xs">{dateError}</p>}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving && <Loader2Icon className="animate-spin" />}
            {editing ? "Save" : "Create goal"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
