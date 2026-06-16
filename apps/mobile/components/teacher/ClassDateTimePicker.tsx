// Reusable "pick a start date + time" modal for the create-class sheets.
// Mirrors the exam-builder StartDatePicker (ScrollViews of buttons — no native
// datetime module dep). 15-min slots; horizon = today + 30 days. Times are
// device-local wall clock labelled IST (the institute runs on IST, same
// convention as exam-builder).

import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { time12h } from "@/lib/time";

export function round15(d: Date): Date {
  const fifteen = 15 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / fifteen) * fifteen);
}

export function ClassDateTimePicker({
  visible,
  startsAt,
  onClose,
  onChange,
}: {
  visible: boolean;
  startsAt: string;
  onClose: () => void;
  onChange: (iso: string) => void;
}): React.ReactElement {
  const [pickedDate, setPickedDate] = useState<Date>(() => new Date(startsAt));

  useEffect(() => {
    if (visible) setPickedDate(new Date(startsAt));
  }, [startsAt, visible]);

  const days = Array.from({ length: 31 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0);
    return d;
  });
  const times: { h: number; m: number }[] = [];
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) times.push({ h, m });

  const setDayPart = (d: Date) => {
    const nd = new Date(pickedDate);
    nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setPickedDate(nd);
  };
  const setTimePart = (h: number, m: number) => {
    const nd = new Date(pickedDate);
    nd.setHours(h, m, 0, 0);
    setPickedDate(nd);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "#fff", borderRadius: 18, padding: 16, maxHeight: "85%" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 }}>
            Pick start date + time
          </Text>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {days.map((d, i) => {
              const isSel = d.toDateString() === pickedDate.toDateString();
              return (
                <Pressable
                  key={i}
                  onPress={() => setDayPart(d)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 6,
                    borderRadius: 12,
                    backgroundColor: isSel ? "#2563EB" : "#f1f5f9",
                  }}
                >
                  <Text
                    style={{
                      color: isSel ? "#ffffff" : "#0f172a",
                      fontWeight: "700",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {d.toLocaleDateString("en-IN", { weekday: "short" })}
                  </Text>
                  <Text
                    style={{
                      color: isSel ? "#ffffff" : "#0f172a",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
            Time (IST)
          </Text>
          <ScrollView style={{ maxHeight: 260 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {times.map(({ h, m }) => {
                const isSel = pickedDate.getHours() === h && pickedDate.getMinutes() === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => setTimePart(h, m)}
                    style={{
                      width: "30%",
                      marginHorizontal: "1.5%",
                      marginVertical: 4,
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: isSel ? "#2563EB" : "#f1f5f9",
                    }}
                  >
                    <Text
                      style={{
                        color: isSel ? "#ffffff" : "#0f172a",
                        fontWeight: "700",
                        fontSize: 13,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {time12h(h, m)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable
            onPress={() => onChange(pickedDate.toISOString())}
            style={{
              marginTop: 14,
              backgroundColor: "#2563EB",
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Use this time</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
