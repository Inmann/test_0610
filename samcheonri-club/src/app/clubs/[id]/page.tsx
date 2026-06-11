import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

type ClubDetail = {
  id: string; name: string; category: string; description: string;
  long_description: string; max_member: number; meeting_schedule: string;
  location: string; founded_at: string; cover_color: string; emoji: string;
  tags: string[];
};
type ActivityItem = { id: string; title: string; description: string; activity_date: string };
type MemberItem  = { id: string; role: string; name: string; department: string };

async function fetchClub(id: string): Promise<ClubDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("*, club_tags ( tag )")
    .eq("id", id)
    .eq("is_active", true)
    .single();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    id: d.id, name: d.name, category: d.category,
    description: d.description, long_description: d.long_description,
    max_member: d.max_member, meeting_schedule: d.meeting_schedule,
    location: d.location, founded_at: d.founded_at,
    cover_color: d.cover_color, emoji: d.emoji,
    tags: (d.club_tags ?? []).map((t: { tag: string }) => t.tag),
  };
}

async function fetchActivities(clubId: string): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("id, title, description, activity_date")
    .eq("club_id", clubId)
    .order("activity_date");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id, title: d.title, description: d.description, activity_date: d.activity_date,
  }));
}

async function fetchMembers(clubId: string): Promise<MemberItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_memberships")
    .select("id, role, profiles ( name, department )")
    .eq("club_id", clubId)
    .eq("status", "승인")
    .order("created_at");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    role: d.role,
    name: d.profiles?.name ?? "알 수 없음",
    department: d.profiles?.department ?? "",
  }));
}

async function fetchMemberCount(clubId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_member_counts")
    .select("approved_count")
    .eq("club_id", clubId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.approved_count ?? 0;
}

const roleOrder: Record<string, number> = { 회장: 0, 부회장: 1, 총무: 2, 회원: 3 };
const roleBadge: Record<string, string> = {
  회장: "bg-primary text-white",
  부회장: "bg-primary-light text-white",
  총무: "bg-primary-50 text-primary",
  회원: "bg-gray-light text-gray-dark",
};

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [club, activities, members, memberCount] = await Promise.all([
    fetchClub(id),
    fetchActivities(id),
    fetchMembers(id),
    fetchMemberCount(id),
  ]);

  if (!club) notFound();

  const sortedMembers = [...members].sort(
    (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );
  const occupancyRate = Math.min(Math.round((memberCount / club.max_member) * 100), 100);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Club Banner */}
      <div className="h-48 flex items-end" style={{ backgroundColor: club.cover_color }}>
        <div className="max-w-6xl w-full mx-auto px-4 pb-5 flex items-end gap-5">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl shadow-lg">
            {club.emoji}
          </div>
          <div className="flex-1 pb-1">
            <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-2">
              {club.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white drop-shadow">
              {club.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-light p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-3">동아리 소개</h2>
              <p className="text-gray-dark leading-relaxed text-sm">
                {club.long_description || club.description}
              </p>
              {club.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {club.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-primary-50 text-primary px-3 py-1 rounded-full font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Activities */}
            <div className="bg-white rounded-2xl border border-gray-light p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">예정 활동</h2>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-dark text-center py-6">등록된 활동이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, idx) => (
                    <div key={activity.id} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-light">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{activity.title}</p>
                          <span className="text-xs font-semibold text-primary bg-primary-50 px-2.5 py-1 rounded-full shrink-0">
                            {activity.activity_date.replace(/-/g, ".")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-dark mt-1 leading-relaxed">{activity.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="bg-white rounded-2xl border border-gray-light p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">구성원</h2>
                <span className="text-sm text-gray-dark">{memberCount}명 / 최대 {club.max_member}명</span>
              </div>
              {sortedMembers.length === 0 ? (
                <p className="text-sm text-gray-dark text-center py-6">가입된 회원이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortedMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {m.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                        <p className="text-xs text-gray-dark truncate">{m.department}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${roleBadge[m.role] ?? "bg-gray-light text-gray-dark"}`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Info Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-light p-6 space-y-5 sticky top-20">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-dark font-medium">회원 현황</span>
                  <span className="font-bold text-primary">{memberCount} / {club.max_member}명</span>
                </div>
                <div className="h-2 bg-gray-light rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${occupancyRate}%` }} />
                </div>
                <p className="text-xs text-gray-dark mt-1 text-right">{occupancyRate}% 참여 중</p>
              </div>

              <div className="divide-y divide-gray-light text-sm">
                {[
                  { label: "활동 주기", value: club.meeting_schedule },
                  { label: "활동 장소", value: club.location },
                  { label: "창설일",   value: club.founded_at },
                ].map((item) => (
                  <div key={item.label} className="py-3 flex flex-col gap-0.5">
                    <span className="text-gray-dark text-xs">{item.label}</span>
                    <span className="font-medium text-gray-900">{item.value || "-"}</span>
                  </div>
                ))}
              </div>

              <button className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition-colors text-sm">
                가입 신청하기
              </button>
              <button className="w-full border border-gray-light text-gray-dark font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                문의하기
              </button>
            </div>

            <Link href="/clubs" className="block text-center text-sm text-gray-dark hover:text-primary transition-colors">
              ← 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
