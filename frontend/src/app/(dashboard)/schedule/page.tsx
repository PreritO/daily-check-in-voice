"use client";

import { useState } from "react";
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
        <label className="block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
          Call Time
        </label>
        <div className="mt-3 flex items-center gap-3">
          <select
            value={formData.hour}
            onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
            className="rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "12" : i > 12 ? i - 12 : i}
              </option>
            ))}
          </select>
          <span className="text-lg text-[#A89B86]">:</span>
          <select
            value={formData.minute}
            onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) })}
            className="rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
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
            className="rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
          Your wellness call will be triggered at this time
        </p>
      </div>

      {/* Days of Week Selection */}
      <div>
        <label className="block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
          Days of Week
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`rounded-xl px-4 py-3 text-base font-medium shadow-sm transition-all duration-200 ${
                formData.daysOfWeek.includes(day.value)
                  ? "bg-[#E8A0BF] text-white hover:bg-[#D88FAE]"
                  : "bg-[#E8E5EB] text-[#4A4543] hover:bg-[#DEDDDB] dark:bg-[#3D3935] dark:text-[#B8A99A] dark:hover:bg-[#4A4543]"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        {formData.daysOfWeek.length === 0 && (
          <p className="mt-2 text-sm text-[#F5A9A9]">Select at least one day</p>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-[#DEDDDB] bg-[#FDFBF7] p-5 shadow-sm dark:border-[#3D3935] dark:bg-[#3D3935]">
        <div>
          <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Schedule Enabled
          </h3>
          <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Turn on to receive scheduled wellness calls
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:ring-offset-2 dark:focus:ring-offset-[#363230] ${
            formData.enabled ? "bg-[#E8A0BF]" : "bg-[#E8E5EB] dark:bg-[#4A4543]"
          }`}
          role="switch"
          aria-checked={formData.enabled}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              formData.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isLoading || formData.daysOfWeek.length === 0}
          className="flex-1 rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#DEDDDB] px-6 py-3 text-base font-medium text-[#4A4543] shadow-sm transition-all duration-200 hover:bg-[#E8E5EB] hover:shadow-md dark:border-[#3D3935] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
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
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              {timeDisplay}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                schedule.enabled
                  ? "bg-[#E8F5E9] text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]"
                  : "bg-[#E8E5EB] text-[#A89B86] dark:bg-[#3D3935] dark:text-[#B8A99A]"
              }`}
            >
              {schedule.enabled ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">{daysDisplay}</p>
          {schedule.next_run_at && schedule.enabled && (
            <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
              Next call: {new Date(schedule.next_run_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="rounded-xl p-3 text-[#A89B86] transition-all duration-200 hover:bg-[#E8E5EB] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0]"
            aria-label="Edit schedule"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-xl p-3 text-[#A89B86] transition-all duration-200 hover:bg-[#F5A9A9]/20 hover:text-[#C77070] disabled:opacity-50 dark:text-[#B8A99A] dark:hover:bg-[#F5A9A9]/10 dark:hover:text-[#F5A9A9]"
            aria-label="Delete schedule"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <div className="space-y-5">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-24 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="h-6 w-20 rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]" />
              </div>
              <div className="h-5 w-40 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="h-10 w-10 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DEDDDB] py-16 dark:border-[#3D3935]">
      <svg
        className="h-14 w-14 text-[#A89B86] dark:text-[#B8A99A]"
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
      <h3 className="mt-5 font-serif text-xl font-medium text-[#4A4543] dark:text-[#F5F3F0]">
        No schedules yet
      </h3>
      <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Create a schedule to receive automated wellness calls.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md"
      >
        <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Schedule
        </h1>
        {!isCreating && !editingId && schedules && schedules.length > 0 && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center rounded-xl bg-[#E8A0BF] px-5 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
        )}
      </div>

      {isCreating && (
        <div className="rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
          <h2 className="mb-5 font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
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
        <div className="rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
          <h2 className="mb-5 font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
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
          <div className="space-y-5">
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
