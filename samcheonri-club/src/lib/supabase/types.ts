export type ClubCategory = "스포츠" | "문화·예술" | "학습" | "봉사" | "취미";
export type MembershipRole = "회장" | "부회장" | "총무" | "회원";
export type MembershipStatus = "승인대기" | "승인" | "거절" | "탈퇴";
export type AttendanceStatus = "참가" | "불참" | "미정";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          department: string;
          employee_no: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          category: ClubCategory;
          description: string;
          long_description: string;
          max_member: number;
          meeting_schedule: string;
          location: string;
          founded_at: string;
          cover_color: string;
          emoji: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clubs"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
      };
      club_tags: {
        Row: {
          id: string;
          club_id: string;
          tag: string;
        };
        Insert: Omit<Database["public"]["Tables"]["club_tags"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["club_tags"]["Insert"]>;
      };
      club_memberships: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: MembershipRole;
          status: MembershipStatus;
          joined_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["club_memberships"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["club_memberships"]["Insert"]>;
      };
      activities: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string;
          activity_date: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activities"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
      };
      activity_attendances: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          status: AttendanceStatus;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activity_attendances"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["activity_attendances"]["Insert"]>;
      };
      notices: {
        Row: {
          id: string;
          club_id: string | null;
          title: string;
          content: string;
          author_id: string | null;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notices"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["notices"]["Insert"]>;
      };
    };
    Views: {
      club_member_counts: {
        Row: {
          club_id: string;
          approved_count: number;
          pending_count: number;
        };
      };
    };
  };
}

// 자주 쓰는 조인 결과 타입
export type ClubRow = Database["public"]["Tables"]["clubs"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["club_memberships"]["Row"];

export type ClubWithTags = ClubRow & {
  club_tags: { tag: string }[];
  club_member_counts: { approved_count: number }[] | null;
};

export type ActivityWithClub = ActivityRow & {
  clubs: Pick<ClubRow, "name" | "emoji" | "id">;
};

export type MembershipWithProfile = MembershipRow & {
  profiles: Pick<ProfileRow, "name" | "department" | "avatar_url">;
};
