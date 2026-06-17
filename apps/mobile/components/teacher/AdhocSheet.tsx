import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarPlus, ChevronDown, Clock, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import { ClassDateTimePicker, round15 } from "@/components/teacher/ClassDateTimePicker";
import { PickerSheet } from "@/components/ui/PickerSheet";
import type { AssignedBatch } from "@/features/org/useAssignedBatches";

interface Props {
  visible: boolean;
  onClose: () => void;
  batches: AssignedBatch[];
  onCreated: (sessionId: string) => void;
}

interface CreateResponse {
  session_id?: string;
  error?: string;
}

const DURATION_OPTIONS_MIN = [30, 45, 60, 90];
const TITLE_MAX = 120;

function formatStart(d: Date): string {
  const day = d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} · ${time}`;
}

function formatTimeIst(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AdhocSheet({
  visible,
  onClose,
  batches,
  onCreated,
}: Props): React.ReactElement {
  const [title, setTitle] = useState("");
  const [pickedBatchId, setPickedBatchId] = useState<string | null>(null);
  // `batches` arrives async (useAssignedBatches), so initialising state from
  // batches[0] once misses the first batch. Fall back to the first batch until
  // the teacher explicitly picks one, so the pre-selected UX always holds
  // (mirrors ScheduleLiveSheet).
  const selectedBatchId = pickedBatchId ?? batches[0]?.batch_id ?? null;
  const setSelectedBatchId = setPickedBatchId;
  const [start, setStart] = useState<Date>(() => round15(new Date()));
  const [durationMin, setDurationMin] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setStart(round15(new Date()));
      setDurationMin(60);
      setError(null);
      setShowBatchPicker(false);
      setShowDatePicker(false);
    }
  }, [visible]);

  const end = useMemo(
    () => new Date(start.getTime() + durationMin * 60 * 1000),
    [start, durationMin],
  );

  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  const handleClose = () => {
    setError(null);
    setSubmitting(false);
    setShowBatchPicker(false);
    setShowDatePicker(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Give the class a name.");
      return;
    }
    if (!selectedBatchId) {
      setError("Pick a batch first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await withTimeout(
        supabase.functions.invoke<CreateResponse>("session-create-ad-hoc", {
          body: {
            batch_id: selectedBatchId,
            title: title.trim(),
            scheduled_start: start.toISOString(),
            scheduled_end: end.toISOString(),
            is_live_class: false,
          },
        }),
      );
      if (invokeErr) {
        const status = (invokeErr as { context?: { status?: number } }).context
          ?.status;
        setError(
          data?.error ?? (status === 403
            ? "You're not assigned to this batch."
            : status === 409
              ? "There's already a class for this batch at that time. Pick a different start time."
              : "Couldn't create offline class."),
        );
        setSubmitting(false);
        return;
      }
      if (!data?.session_id) {
        setError("Server returned an unexpected response.");
        setSubmitting(false);
        return;
      }
      onCreated(data.session_id);
      handleClose();
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't create offline class.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-[28px] px-6 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center">
              <CalendarPlus size={20} color="#2563eb" style={{ marginRight: 8 }} />
              <Text className="text-lg font-extrabold text-slate-900">
                New offline class
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close">
              <X size={22} color="#475569" />
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-slate-500 mb-4">
            One-off session — take attendance by QR or mark students manually.
          </Text>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
            Class name
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            placeholder="e.g. Chemistry — Mole concept revision"
            placeholderTextColor="#94a3b8"
            className="border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white mb-4"
          />

          <Text className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
            Batch
          </Text>
          <TouchableOpacity
            onPress={() => setShowBatchPicker(true)}
            className="border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center justify-between bg-slate-50"
          >
            <Text
              className="text-sm font-semibold text-slate-900 flex-1"
              numberOfLines={1}
            >
              {selectedBatch
                ? `${selectedBatch.course_code} · ${selectedBatch.batch_name}`
                : "Select a batch"}
            </Text>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mt-4 mb-1.5">
            Starts
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center justify-between bg-slate-50"
          >
            <Text className="text-sm font-semibold text-slate-900">
              {formatStart(start)}
            </Text>
            <Clock size={16} color="#64748b" />
          </TouchableOpacity>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mt-4 mb-1.5">
            Duration
          </Text>
          <View className="flex-row">
            {DURATION_OPTIONS_MIN.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDurationMin(d)}
                className={`px-3 py-2 rounded-full border mr-2 ${
                  d === durationMin
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    d === durationMin ? "text-white" : "text-slate-700"
                  }`}
                >
                  {d} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-4 bg-slate-50 rounded-2xl p-4">
            <Text className="text-[11px] uppercase font-bold text-slate-500">
              Class window
            </Text>
            <Text className="text-sm font-bold text-slate-900 mt-0.5">
              {formatTimeIst(start)} — {formatTimeIst(end)} (IST)
            </Text>
            <Text className="text-[11px] text-slate-400 mt-1">
              Students can be scanned (or marked manually) from 15 min before start.
            </Text>
          </View>

          {error ? (
            <Text className="text-red-600 text-xs mt-3">{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !selectedBatchId || !title.trim()}
            className={`mt-5 rounded-2xl py-3.5 items-center justify-center ${
              submitting || !selectedBatchId || !title.trim() ? "bg-slate-300" : "bg-blue-600"
            }`}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">
                Create class
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <PickerSheet
        visible={showBatchPicker}
        title="Choose batch"
        options={batches.map((b) => ({
          key: b.batch_id,
          label: b.batch_name,
          sublabel: `${b.course_code} · ${b.course_name}`,
        }))}
        selectedKey={selectedBatchId}
        onSelect={(k) => {
          setSelectedBatchId(k);
          setShowBatchPicker(false);
        }}
        onClose={() => setShowBatchPicker(false)}
      />

      <ClassDateTimePicker
        visible={showDatePicker}
        startsAt={start.toISOString()}
        onClose={() => setShowDatePicker(false)}
        onChange={(iso) => {
          setStart(new Date(iso));
          setShowDatePicker(false);
        }}
      />
    </Modal>
  );
}
