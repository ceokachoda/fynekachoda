// Shared bottom-sheet selection list for every "tap to choose" field across the
// teacher forms (course/subject/chapter/topic/batch, duration, result-release,
// test date…). It's a real <Modal> that slides up from the bottom and pins to
// the safe-area edge — replacing the older patterns that mounted an
// absolute-positioned View or an inline ScrollView, both of which could be
// clipped or pushed off-screen on shorter Android devices (the "comes very low /
// doesn't show" bug). Inline styles throughout — className on Modal/list
// internals has triggered the css-interop "Maximum update depth" loop before.

import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";

export interface PickerOption {
  key: string;
  label: string;
  sublabel?: string;
}

export function PickerSheet({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
  emptyText = "No options.",
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  emptyText?: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "80%",
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View
              style={{
                width: 40,
                height: 5,
                borderRadius: 999,
                backgroundColor: "#e2e8f0",
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: "800",
                color: "#0f172a",
              }}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <X size={20} color="#475569" />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.key}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: "#f1f5f9",
                  marginLeft: 20,
                }}
              />
            )}
            ListEmptyComponent={
              <Text
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  paddingVertical: 32,
                }}
              >
                {emptyText}
              </Text>
            }
            renderItem={({ item }) => {
              const sel = item.key === selectedKey;
              return (
                <Pressable
                  onPress={() => onSelect(item.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    backgroundColor: sel ? "#eff6ff" : "transparent",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: sel ? "700" : "500",
                        color: "#0f172a",
                      }}
                    >
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text
                        style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}
                      >
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {sel ? <Check size={18} color="#2563EB" /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
