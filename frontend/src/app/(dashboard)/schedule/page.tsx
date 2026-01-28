"use client";

import { useState, useEffect } from "react";
import {
  useSchedulesQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
  parseCronExpression,
  buildCronExpression,
  formatTime,
  WEEKDAYS,
  type Schedule,
} from "@/lib/api/schedules";

// Temporary user ID until auth is implemented
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000001";

interface ScheduleFormData {
  hour: number;
  minute: number;
  daysOfWeek: string[];
  enabled: boolean;
}

function getDefaultFormData(): ScheduleFormData {
  return {
    hour: 9,
    minute: 0,
    daysOfWeek: ["1", "2", "3", "4", "5"], // Mon-Fri
    enabled: true,
  };
}

function parseScheduleToFormData(schedule: Schedule): ScheduleFormData {
  const parsed = parseCronExpression(schedule.cron_expression);
  if (!parsed) {
    return getDefaultFormData();
  }
  return {
    hour: parsed.hour,
    minute: parsed.minute,
    daysOfWeek: parsed.daysOfWeek,
    enabled: schedule.enabled,
  };
}

function ScheduleForm({
  schedule,
  onSave,
  onCancel,
  isLoading,
}: {
  schedule: Schedule | null;
  onSave: (data: ScheduleFormData) => void;
  onCancel?: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ScheduleFormData>(
    schedule ? parseScheduleToFormData(schedule) : getDefaultFormData()
  );

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Time Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Call Time
        </label>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={formData.hour}
            onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "12" : i > 12 ? i - 12 : i}
              </option>
            ))}
          </select>
          <span className="text-zinc-500">:</span>
          <select
            value={formData.minute}
            onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) })}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
          <select
            value={formData.hour >= 12 ? "PM" : "AM"}
            onChange={(e) => {
              const isPM = e.target.value === "PM";
              let newHour = formData.hour % 12;
              if (isPM) newHour += 12;
              setFormData({ ...formData, hour: newHour });
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Your standup call will be triggered at this time
        </p>
      </div>

      {/* Days of Week Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Days of Week
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                formData.daysOfWeek.includes(day.value)
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        {formData.daysOfWeek.length === 0 && (
          <p className="mt-1 text-xs text-red-500">Select at least one day</p>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Schedule Enabled
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Turn on to receive scheduled standup calls
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            formData.enabled ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
          }`}
          role="switch"
          aria-checked={formData.enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              formData.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading || formData.daysOfWeek.length === 0}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  isDeleting,
}: {
  schedule: Schedule;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const parsed = parseCronExpression(schedule.cron_expression);
  const timeDisplay = parsed ? formatTime(parsed.hour, parsed.minute) : "Invalid time";
  const daysDisplay = parsed
    ? WEEKDAYS.filter((d) => parsed.daysOfWeek.includes(d.value))
        .map((d) => d.label)
        .join(", ")
    : "Invalid days";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {timeDisplay}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                schedule.enabled
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {schedule.enabled ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{daysDisplay}</p>
          {schedule.next_run_at && schedule.enabled && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Next call: {new Date(schedule.next_run_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Edit schedule"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete schedule"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 py-12 dark:border-zinc-700">
      <svg
        className="h-12 w-12 text-zinc-400 dark:text-zinc-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
        No schedules yet
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Create a schedule to receive automated standup calls.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Schedule
      </button>
    </div>
  );
}

export default function SchedulePage() {
  const { data: schedules, isLoading } = useSchedulesQuery();
  const createMutation = useCreateScheduleMutation();
  const updateMutation = useUpdateScheduleMutation();
  const deleteMutation = useDeleteScheduleMutation();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingSchedule = editingId
    ? schedules?.find((s) => s.id === editingId) ?? null
    : null;

  const handleCreate = (data: ScheduleFormData) => {
    const cronExpression = buildCronExpression(data.hour, data.minute, data.daysOfWeek);
    createMutation.mutate(
      {
        user_id: TEMP_USER_ID,
        cron_expression: cronExpression,
        enabled: data.enabled,
      },
      {
        onSuccess: () => setIsCreating(false),
      }
    );
  };

  const handleUpdate = (data: ScheduleFormData) => {
    if (!editingId) return;
    const cronExpression = buildCronExpression(data.hour, data.minute, data.daysOfWeek);
    updateMutation.mutate(
      {
        id: editingId,
        cron_expression: cronExpression,
        enabled: data.enabled,
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Schedule
        </h1>
        {!isCreating && !editingId && schedules && schedules.length > 0 && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
        )}
      </div>

      {isCreating && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Create New Schedule
          </h2>
          <ScheduleForm
            schedule={null}
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
            isLoading={createMutation.isPending}
          />
        </div>
      )}

      {editingSchedule && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Edit Schedule
          </h2>
          <ScheduleForm
            schedule={editingSchedule}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
            isLoading={updateMutation.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : !isCreating && !editingId && schedules && schedules.length === 0 ? (
        <EmptyState onCreate={() => setIsCreating(true)} />
      ) : (
        !isCreating &&
        !editingId && (
          <div className="space-y-4">
            {schedules?.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onEdit={() => setEditingId(schedule.id)}
                onDelete={() => handleDelete(schedule.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
