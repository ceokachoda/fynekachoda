import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarPlus, ChevronDown, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
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

function nextRoundedHour(): Date {
  const now = new Date();
  const ms = now.getTime();
  const fifteenMin = 15 * 60 * 1000;
  const rounded = new Date(Math.ceil(ms / fifteenMin) * fifteenMin);
  return rounded;
}

function formatTimeIst(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdhocSheet({
  visible,
  onClose,
  batches,
  onCreated,
}: Props): React.ReactElement {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    batches[0]?.batch_id ?? null,
  );
  const [durationMin, setDurationMin] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBatchPicker, setShowBatchPicker] = useState(false);

  // Recompute the start time every time the sheet opens so the "next 15-min
  // mark" is current, not stale from the first mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => nextRoundedHour(), [visible]);
  const end = useMemo(
    () => new Date(start.getTime() + durationMin * 60 * 1000),
    [start, durationMin],
  );

  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId);

  const reset = () => {
    setError(null);
    setSubmitting(false);
    setShowBatchPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
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
            : "Couldn't create ad-hoc class."),
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
          : "Couldn't create ad-hoc class.",
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
                New ad-hoc class
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close">
              <X size={22} color="#475569" />
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-slate-500 mb-4">
            One-off session in one of your assigned batches.
          </Text>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
            Batch
          </Text>
          <TouchableOpacity
            onPress={() => setShowBatchPicker((v) => !v)}
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

          {showBatchPicker ? (
            <ScrollView
              className="mt-2 border border-slate-100 rounded-2xl bg-white"
              style={{ maxHeight: 180 }}
            >
              {batches.map((b) => (
                <TouchableOpacity
                  key={b.batch_id}
                  onPress={() => {
                    setSelectedBatchId(b.batch_id);
                    setShowBatchPicker(false);
                  }}
                  className="px-4 py-3 border-b border-slate-50"
                >
                  <Text className="text-sm font-semibold text-slate-900">
                    {b.batch_name}
                  </Text>
                  <Text className="text-[11px] text-slate-500 mt-0.5">
                    {b.course_code} · {b.course_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

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
              Starts
            </Text>
            <Text className="text-sm font-bold text-slate-900 mt-0.5">
              {formatTimeIst(start)} — {formatTimeIst(end)} (IST)
            </Text>
            <Text className="text-[11px] text-slate-400 mt-1">
              Starts at the next 15-minute mark. Adjust duration above.
            </Text>
          </View>

          {error ? (
            <Text className="text-red-600 text-xs mt-3">{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !selectedBatchId}
            className={`mt-5 rounded-2xl py-3.5 items-center justify-center ${
              submitting || !selectedBatchId ? "bg-slate-300" : "bg-blue-600"
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
    </Modal>
  );
}
