import Link from "next/link";
import ClubCard, { type ClubCardData } from "@/components/ClubCard";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

async function getClubs(): Promise<ClubCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(`
      id, name, category, description, max_member, cover_color, emoji,
      club_tags ( tag ),
      club_member_counts ( approved_count )
    `)
    .eq("is_active", true)
    .order("created_at");

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    description: c.description,
    max_member: c.max_member,
    cover_color: c.cover_color,
    emoji: c.emoji,
    tags: (c.club_tags ?? []).map((t: { tag: string }) => t.tag),
    member_count: c.club_member_counts?.[0]?.approved_count ?? 0,
  }));
}

async function getUpcomingActivities() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("activities")
    .select(`id, title, description, activity_date, clubs ( id, name, emoji )`)
    .gte("activity_date", today)
    .order("activity_date")
    .limit(4);

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any[];
}

export default async function HomePage() {
  const [clubs, upcomingActivities] = await Promise.all([
    getClubs(),
    getUpcomingActivities(),
  ]);

  const totalMembers = clubs.reduce((s, c) => s + c.member_count, 0);
  const statItems = [
    { label: "운영 동아리", value: clubs.length, unit: "개" },
    { label: "전체 회원 수", value: totalMembers, unit: "명" },
    { label: "예정 활동", value: upcomingActivities.length, unit: "건" },
    { label: "동아리 분야", value: 5, unit: "개" },
  ];

  const popularClubs = [...clubs]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 3);

  return (
    <main>
      {/* Hero */}
      <section className="bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-xl">
            <p className="text-primary-100 text-sm font-semibold uppercase tracking-widest mb-4">
              삼천리 임직원 전용
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-5">
              함께 성장하는<br />
              <span className="text-white">동아리 커뮤니티</span>
            </h1>
            <p className="text-primary-100 text-base md:text-lg leading-relaxed mb-8">
              스포츠, 문화, 학습, 봉사 등 다양한 동아리에 참여하여<br />
              동료들과 함께 즐거운 회사생활을 만들어 보세요.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/clubs"
                className="bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary-50 transition-colors"
              >
                동아리 둘러보기
              </Link>
              <Link
                href="/clubs"
                className="border border-white/40 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                동아리 신청하기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {statItems.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-3xl font-extrabold text-white">
                  {item.value}
                  <span className="text-lg font-semibold text-primary-100 ml-1">{item.unit}</span>
                </p>
                <p className="text-primary-100 text-sm mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-14">
        {/* Popular Clubs */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">인기 동아리</h2>
              <p className="text-gray-dark text-sm mt-1">회원이 많은 동아리를 먼저 만나보세요</p>
            </div>
            <Link href="/clubs" className="text-primary text-sm font-semibold hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularClubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        </section>

        {/* Upcoming Activities */}
        {upcomingActivities.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">다가오는 활동</h2>
              <p className="text-gray-dark text-sm mt-1">곧 시작되는 동아리 활동 일정을 확인하세요</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingActivities.map((activity) => {
                const club = activity.clubs as { id: string; name: string; emoji: string } | null;
                return (
                  <Link
                    key={activity.id}
                    href={`/clubs/${club?.id ?? ""}`}
                    className="flex gap-4 bg-white border border-gray-light rounded-xl p-4 hover:shadow-sm hover:border-primary/30 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl shrink-0">
                      {club?.emoji ?? "📅"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary font-semibold mb-0.5">{club?.name}</p>
                      <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-primary transition-colors">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-dark mt-1 truncate">{activity.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-gray-dark">
                        {activity.activity_date.replace(/-/g, ".")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* All Clubs */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">분야별 동아리</h2>
            <p className="text-gray-dark text-sm mt-1">관심 분야의 동아리를 찾아보세요</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        </section>
      </div>

      {/* CTA Banner */}
      <section className="bg-primary-50 border-t border-primary/20">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <p className="text-2xl font-bold text-gray-900 mb-3">아직 동아리가 없으신가요?</p>
          <p className="text-gray-dark mb-6">뜻이 맞는 동료들과 함께 새로운 동아리를 만들어 보세요.</p>
          <Link
            href="/clubs"
            className="bg-primary text-white font-semibold px-8 py-3 rounded-xl hover:bg-primary-dark transition-colors inline-block"
          >
            동아리 개설 신청
          </Link>
        </div>
      </section>
    </main>
  );
}
