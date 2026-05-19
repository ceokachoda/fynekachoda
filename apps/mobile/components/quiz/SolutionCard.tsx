import { Pressable, Text, View } from "react-native";
import { ExternalLink, PlayCircle, FileText } from "lucide-react-native";
import { useRouter } from "expo-router";
import { MathText } from "./MathText";
import { OptionRadio, type OptionStatus } from "./OptionRadio";
import { QuestionCard } from "./QuestionCard";
import type { SolutionQuestion } from "@/features/quiz/types";

interface Props {
  index: number;
  total: number;
  q: SolutionQuestion;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SolutionCard({ index, total, q }: Props) {
  const router = useRouter();
  return (
    <View style={{ marginBottom: 24 }}>
      <QuestionCard
        index={index}
        total={total}
        prompt_md={q.prompt_md}
        prompt_image_url={q.prompt_image_url}
        difficulty={q.difficulty}
      />
      <View style={{ height: 12 }} />
      {q.options.map((o, i) => {
        let status: OptionStatus = "default";
        if (o.id === q.correct_option_id) {
          status = q.your_option_id === o.id ? "correct" : "missed";
        } else if (o.id === q.your_option_id) {
          status = "wrong";
        }
        return (
          <OptionRadio
            key={o.id}
            letter={LETTERS[i] ?? String(i + 1)}
            text_md={o.text_md}
            image_url={o.image_url}
            status={status}
            disabled
          />
        );
      })}
      <View
        style={{
          backgroundColor: "#f1f5f9",
          borderRadius: 12,
          padding: 12,
          marginTop: 6,
        }}
      >
        <Text style={{ fontWeight: "700", color: "#0f172a", marginBottom: 6 }}>
          Explanation
        </Text>
        {q.explanation_md ? (
          <MathText markdown={q.explanation_md} fontSize={14} color="#1e293b" />
        ) : (
          <Text style={{ color: "#64748b", fontSize: 13 }}>
            No explanation provided.
          </Text>
        )}
        {q.related_content ? (
          <Pressable
            onPress={() => {
              if (q.related_content!.kind === "video") {
                router.push(`/video/${q.related_content!.id}` as never);
              } else {
                router.push(`/pdf/${q.related_content!.id}` as never);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: 10,
              padding: 10,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              marginTop: 10,
            }}
          >
            {q.related_content.kind === "video" ? (
              <PlayCircle size={18} color="#ef4444" />
            ) : (
              <FileText size={18} color="#059669" />
            )}
            <Text style={{ marginLeft: 8, flex: 1, color: "#0f172a", fontWeight: "600" }} numberOfLines={1}>
              Related: {q.related_content.title}
            </Text>
            <ExternalLink size={16} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
