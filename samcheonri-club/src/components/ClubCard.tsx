import Link from "next/link";

export interface ClubCardData {
  id: string;
  name: string;
  category: string;
  description: string;
  max_member: number;
  cover_color: string;
  emoji: string;
  tags: string[];
  member_count: number;
}

const categoryColors: Record<string, string> = {
  "스포츠": "bg-green-100 text-green-700",
  "문화·예술": "bg-purple-100 text-purple-700",
  "학습": "bg-blue-100 text-blue-700",
  "봉사": "bg-red-100 text-red-700",
  "취미": "bg-orange-100 text-orange-700",
};

export default function ClubCard({ club }: { club: ClubCardData }) {
  const occupancyRate = Math.round((club.member_count / club.max_member) * 100);

  return (
    <Link
      href={`/clubs/${club.id}`}
      className="group bg-white rounded-2xl shadow-sm border border-gray-light hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div
        className="h-36 flex items-center justify-center relative"
        style={{ backgroundColor: club.cover_color }}
      >
        <span className="text-5xl">{club.emoji}</span>
        <span
          className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[club.category] ?? "bg-gray-100 text-gray-700"}`}
        >
          {club.category}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 text-base mb-1.5 group-hover:text-primary transition-colors">
          {club.name}
        </h3>
        <p className="text-gray-dark text-sm leading-relaxed mb-4 flex-1 line-clamp-2">
          {club.description}
        </p>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-dark">회원 현황</span>
              <span className="font-semibold text-primary">
                {club.member_count} / {club.max_member}명
              </span>
            </div>
            <div className="h-1.5 bg-gray-light rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(occupancyRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {club.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
