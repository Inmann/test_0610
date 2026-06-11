export const CATEGORIES = ["PEF", "VC", "크레딧", "세컨더리", "인프라"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = [
  "미검토",
  "검토중",
  "지원예정",
  "제안서제출",
  "PT",
  "선정",
  "미선정",
  "패스",
] as const;
export type OurStatus = (typeof STATUSES)[number];

export type Program = {
  id: string;
  institution: string;
  title: string;
  category: Category;
  total_size: string;
  num_gps: string;
  announce_date: string | null; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  presentation_date: string | null; // YYYY-MM-DD
  result_date: string | null; // YYYY-MM-DD
  url: string;
  our_status: OurStatus;
  memo: string;
};
