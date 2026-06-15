export type ContentKind = "video" | "pdf" | "note";

export interface ContentItem {
  id: string;
  title: string;
  kind: ContentKind;
  description: string | null;
  duration_sec: number | null;
  yt_video_id: string | null;
  file_path: string | null;
  is_published: boolean;
  topic_id: string;
  batch_id: string | null;
  course_id: string;
  created_at: string;
}

export interface Topic {
  id: string;
  name: string;
  sort_order: number;
  items: ContentItem[];
}

export interface Chapter {
  id: string;
  name: string;
  sort_order: number;
  topics: Topic[];
  item_count: number;
}

export interface Subject {
  id: string;
  name: string;
  sort_order: number;
  chapters: Chapter[];
  item_count: number;
}

export interface LibraryTree {
  subjects: Subject[];
}
