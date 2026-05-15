import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, GraduationCap, User as UserIcon } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

interface BatchDetail {
  id: string;
  name: string;
  course_code: string;
  course_name: string;
  students: { user_id: string; full_name: string }[];
}

interface RawBatchDetail {
  id: string;
  name: string;
  courses: { code: string; name: string } | null;
  students:
    | { user_id: string; app_users: { full_name: string } | null }[]
    | null;
}

export default function TeacherBatchDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const batchId = params.id ?? "";

  const [data, setData] = useState<BatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!batchId) {
      setError("Missing batch id");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: row, error: dbErr } = await withTimeout(
        supabase
          .from("batches")
          .select(
            "id, name, courses(code, name), students(user_id, app_users!user_id(full_name))",
          )
          .eq("id", batchId)
          .maybeSingle(),
      );
      if (dbErr) {
        setError(dbErr.message);
        setData(null);
        return;
      }
      if (!row) {
        setData(null);
        setError("Batch not found, or you don't have access.");
        return;
      }
      const r = row as unknown as RawBatchDetail;
      const students = (r.students ?? [])
        .map((s) => ({
          user_id: s.user_id,
          full_name: s.app_users?.full_name ?? "—",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
      setData({
        id: r.id,
        name: r.name,
        course_code: r.courses?.code ?? "—",
        course_name: r.courses?.name ?? "—",
        students,
      });
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load batch.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const studentCount = data?.students.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="w-10 h-10 items-center justify-center rounded-full"
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text className="ml-2 text-base font-bold text-slate-900">Batch</Text>
      </View>

      <FlatList
        data={data?.students ?? []}
        keyExtractor={(s) => s.user_id}
        renderItem={({ item }) => <StudentRow name={item.full_name} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#2563EB" />
        }
        ListHeaderComponent={
          <View>
            <View className="bg-white mx-6 mt-2 mb-4 p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50">
              {isLoading && !data ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : error ? (
                <Text className="text-sm font-medium text-red-700">{error}</Text>
              ) : data ? (
                <>
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    {data.course_code}
                  </Text>
                  <Text className="mt-1 text-xl font-extrabold text-slate-900">
                    {data.name}
                  </Text>
                  <Text className="text-sm font-medium text-slate-500 mt-0.5">
                    {data.course_name}
                  </Text>

                  <View className="mt-4 flex-row items-center">
                    <View className="w-10 h-10 bg-blue-50 rounded-2xl items-center justify-center mr-3">
                      <GraduationCap size={20} color="#2563EB" />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold uppercase text-slate-500 tracking-wide">
                        Roster
                      </Text>
                      <Text className="text-base font-bold text-slate-900">
                        {studentCount} student{studentCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>

            {data && (
              <View className="px-6 pb-2 flex-row items-end justify-between">
                <Text className="text-lg font-bold text-slate-900">Students</Text>
                <Text className="text-xs font-medium text-slate-500">Read-only</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          data && !isLoading && !error ? (
            <View className="mx-6 mt-2 bg-white rounded-3xl border border-slate-100 p-6 items-center shadow-sm shadow-slate-200/50">
              <UserIcon size={32} color="#94a3b8" />
              <Text className="mt-3 text-sm font-bold text-slate-900 text-center">
                No students in this batch yet
              </Text>
              <Text className="mt-1 text-xs text-slate-500 text-center leading-4">
                Ask your admin to add students to this batch.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function StudentRow({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View className="mx-6 mt-2 bg-white rounded-2xl border border-slate-100 p-4 flex-row items-center shadow-sm shadow-slate-200/50">
      <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center mr-3">
        <Text className="text-xs font-bold text-slate-700">{initials || "?"}</Text>
      </View>
      <Text className="flex-1 text-sm font-semibold text-slate-800" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
