import { createClient } from "@/lib/supabase/server";
import ClubsClient from "@/components/ClubsClient";
import type { ClubCardData } from "@/components/ClubCard";

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

export default async function ClubsPage() {
  const clubs = await getClubs();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-10">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-extrabold mb-2">동아리 목록</h1>
          <p className="text-primary-100">삼천리의 다양한 동아리를 탐색하고 가입해 보세요.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <ClubsClient clubs={clubs} />
      </div>
    </main>
  );
}
