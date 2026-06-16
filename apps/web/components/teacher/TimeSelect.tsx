"use client";

// 12-hour start-time picker backed by a native <select> (see NativeSelect for
// why native). Value is 24-hour "HH:MM"; options are the 15-minute grid in
// 12-hour labels. If the bound value isn't on the grid (e.g. an exam saved at
// an arbitrary minute before this picker existed) it's added as its own option
// so the field still shows the right time instead of going blank.

import { NativeSelect } from "@/components/ui/native-select";
import { TIME_SLOTS_15, format12h } from "@/features/teacher/time-options";

interface TimeSelectProps {
  value: string; // "HH:MM" 24-hour, or "" when unset
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export function TimeSelect({
  value,
  onChange,
  id,
  className,
  "aria-label": ariaLabel,
}: TimeSelectProps) {
  const onGrid = TIME_SLOTS_15.some((s) => s.value === value);

  return (
    <NativeSelect
      id={id}
      className={className}
      aria-label={ariaLabel ?? "Start time"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {value === "" ? <option value="">Select time</option> : null}
      {!onGrid && value !== "" ? (
        <option value={value}>{format12h(value)}</option>
      ) : null}
      {TIME_SLOTS_15.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </NativeSelect>
  );
}
