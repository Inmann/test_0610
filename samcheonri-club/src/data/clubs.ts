export type Category = "스포츠" | "문화·예술" | "학습" | "봉사" | "취미";

export interface Activity {
  id: number;
  title: string;
  date: string;
  description: string;
}

export interface Member {
  id: number;
  name: string;
  department: string;
  role: "회장" | "부회장" | "총무" | "회원";
  joinedAt: string;
}

export interface Club {
  id: number;
  name: string;
  category: Category;
  description: string;
  longDescription: string;
  memberCount: number;
  maxMember: number;
  meetingSchedule: string;
  location: string;
  founded: string;
  coverColor: string;
  emoji: string;
  activities: Activity[];
  members: Member[];
  tags: string[];
}

export const CATEGORIES: Category[] = ["스포츠", "문화·예술", "학습", "봉사", "취미"];

export const clubs: Club[] = [
  {
    id: 1,
    name: "정상 등산 동아리",
    category: "스포츠",
    description: "매월 전국 명산을 함께 오르며 건강과 우정을 쌓는 동아리입니다.",
    longDescription:
      "삼천리 임직원의 건강 증진과 자연과의 교감을 목표로 2018년에 창설되었습니다. 매월 한 번씩 전국 명산을 함께 오르며, 계절마다 달라지는 자연의 아름다움을 만끽합니다. 초보자도 부담 없이 참여할 수 있는 코스부터 도전적인 코스까지 다양하게 준비되어 있으며, 경험 많은 선배 산악인들의 안전 가이드 아래 즐겁고 안전하게 산행할 수 있습니다.",
    memberCount: 42,
    maxMember: 50,
    meetingSchedule: "매월 셋째 주 토요일",
    location: "본사 1층 로비 집결",
    founded: "2018년 3월",
    coverColor: "#2d6a4f",
    emoji: "⛰️",
    tags: ["건강", "자연", "팀빌딩", "주말활동"],
    activities: [
      { id: 1, title: "북한산 정기 산행", date: "2026-06-21", description: "북한산 백운대 코스 (약 5시간, 난이도 중상)" },
      { id: 2, title: "지리산 1박 2일 종주", date: "2026-07-19", description: "천왕봉 종주 특별 산행 (1박 2일, 사전 신청 필수)" },
      { id: 3, title: "관악산 신입 歡迎 산행", date: "2026-08-16", description: "신규 회원 환영 산행 - 연주암 코스 (약 3시간, 초보 환영)" },
    ],
    members: [
      { id: 1, name: "김민준", department: "에너지사업부", role: "회장", joinedAt: "2018-03" },
      { id: 2, name: "이수진", department: "경영지원팀", role: "부회장", joinedAt: "2019-05" },
      { id: 3, name: "박재현", department: "IT기획팀", role: "총무", joinedAt: "2020-09" },
      { id: 4, name: "최유나", department: "마케팅팀", role: "회원", joinedAt: "2022-03" },
      { id: 5, name: "정호준", department: "안전관리부", role: "회원", joinedAt: "2023-01" },
    ],
  },
  {
    id: 2,
    name: "책 읽는 삼천리",
    category: "학습",
    description: "매달 선정한 책을 함께 읽고 나누는 독서 토론 동아리입니다.",
    longDescription:
      "독서를 통해 지식을 넓히고 서로의 생각을 나누는 독서 토론 동아리입니다. 매월 한 권의 책을 선정하여 자유롭게 읽은 뒤, 월례 모임에서 활발한 토론을 펼칩니다. 경영서, 인문학, 소설, 자기계발서 등 다양한 장르를 아우르며 임직원 개인의 성장과 회사 발전에 도움이 되는 독서 문화를 만들어 나가고 있습니다.",
    memberCount: 28,
    maxMember: 40,
    meetingSchedule: "매월 넷째 주 수요일 오후 6시",
    location: "본사 4층 회의실 C",
    founded: "2019년 1월",
    coverColor: "#7b4f12",
    emoji: "📚",
    tags: ["독서", "토론", "자기계발", "평일저녁"],
    activities: [
      { id: 1, title: "6월 선정도서 토론: 《82년생 김지영》", date: "2026-06-24", description: "사회적 이슈와 공감에 관한 심층 토론" },
      { id: 2, title: "7월 선정도서 토론: 《원칙》 - 레이 달리오", date: "2026-07-22", description: "경영 원칙과 인생 철학에 대한 토론" },
      { id: 3, title: "하반기 독서 목록 선정 투표", date: "2026-08-05", description: "회원들의 추천 도서로 하반기 독서 목록 결정" },
    ],
    members: [
      { id: 1, name: "서지원", department: "전략기획팀", role: "회장", joinedAt: "2019-01" },
      { id: 2, name: "윤채원", department: "인사팀", role: "부회장", joinedAt: "2020-03" },
      { id: 3, name: "강도현", department: "재무팀", role: "총무", joinedAt: "2021-06" },
      { id: 4, name: "임지수", department: "법무팀", role: "회원", joinedAt: "2023-01" },
    ],
  },
  {
    id: 3,
    name: "렌즈 사진 동아리",
    category: "문화·예술",
    description: "카메라를 들고 일상과 여행 속 아름다운 순간을 포착하는 동아리입니다.",
    longDescription:
      "사진에 관심 있는 임직원들이 모여 촬영 기술을 나누고 서로의 작품을 감상하는 동아리입니다. 스마트폰 사진부터 DSLR, 미러리스까지 장비에 상관없이 누구나 참여할 수 있습니다. 정기적인 출사와 포토워크숍, 사내 사진전 개최 등 다양한 활동을 통해 예술적 감수성과 창의력을 키워갑니다.",
    memberCount: 19,
    maxMember: 30,
    meetingSchedule: "격주 토요일 오전 10시",
    location: "매번 다른 출사지",
    founded: "2020년 6월",
    coverColor: "#1a1a2e",
    emoji: "📸",
    tags: ["사진", "예술", "출사", "전시"],
    activities: [
      { id: 1, title: "서울 야경 출사 - 남산타워", date: "2026-06-13", description: "야경 촬영 기법 실습 및 단체 출사" },
      { id: 2, title: "여름 해돋이 출사 - 강릉", date: "2026-07-05", description: "정동진 일출 출사 (1박 2일)" },
      { id: 3, title: "2026 상반기 사내 사진전 개최", date: "2026-08-01", description: "본사 1층 갤러리에서 작품 전시" },
    ],
    members: [
      { id: 1, name: "한예슬", department: "홍보팀", role: "회장", joinedAt: "2020-06" },
      { id: 2, name: "오준혁", department: "IT기획팀", role: "부회장", joinedAt: "2021-01" },
      { id: 3, name: "신민서", department: "마케팅팀", role: "총무", joinedAt: "2022-06" },
    ],
  },
  {
    id: 4,
    name: "나눔 봉사 동아리",
    category: "봉사",
    description: "지역사회와 함께 성장하는 삼천리의 나눔 문화를 실천하는 봉사 동아리입니다.",
    longDescription:
      "삼천리의 나눔 경영 정신을 실천하는 봉사 동아리로, 지역사회와 함께 더 나은 세상을 만들어 가고 있습니다. 정기적인 사회복지관 봉사, 독거노인 방문, 환경정화 활동 등 다양한 봉사 활동을 통해 임직원들이 사회적 가치를 몸소 실천합니다. 봉사를 통해 얻는 보람과 감동이 회사생활의 활력이 됩니다.",
    memberCount: 56,
    maxMember: 80,
    meetingSchedule: "매월 첫째, 셋째 주 토요일",
    location: "활동지 별도 공지",
    founded: "2017년 5월",
    coverColor: "#c1121f",
    emoji: "🤝",
    tags: ["봉사", "나눔", "지역사회", "ESG"],
    activities: [
      { id: 1, title: "마포구 독거노인 반찬 봉사", date: "2026-06-06", description: "반찬 만들기 및 어르신 댁 방문 배달" },
      { id: 2, title: "한강 환경정화 활동", date: "2026-06-20", description: "한강 공원 일대 쓰레기 수거 및 환경정화" },
      { id: 3, title: "영도 아동센터 교육 봉사", date: "2026-07-04", description: "취약계층 아동 대상 학습 지원 봉사" },
    ],
    members: [
      { id: 1, name: "박서연", department: "CSR팀", role: "회장", joinedAt: "2017-05" },
      { id: 2, name: "조민국", department: "안전관리부", role: "부회장", joinedAt: "2018-09" },
      { id: 3, name: "김하늘", department: "경영지원팀", role: "총무", joinedAt: "2019-03" },
      { id: 4, name: "이정우", department: "에너지사업부", role: "회원", joinedAt: "2021-01" },
      { id: 5, name: "최수아", department: "인사팀", role: "회원", joinedAt: "2022-06" },
    ],
  },
  {
    id: 5,
    name: "그린 FC 축구 동아리",
    category: "스포츠",
    description: "열정과 팀워크로 그라운드를 누비는 축구 동아리입니다. 실력 무관 환영!",
    longDescription:
      "삼천리 그린 FC는 2016년 창설된 이래로 꾸준히 사내 스포츠 문화를 이끌어온 축구 동아리입니다. 매주 정기 훈련과 주기적인 친선 경기를 통해 팀워크와 체력을 키웁니다. 초보자도 걱정 없이 참여할 수 있으며, 타사 기업팀과의 친선전 등 대외 활동도 활발히 진행하고 있습니다.",
    memberCount: 34,
    maxMember: 40,
    meetingSchedule: "매주 화요일, 목요일 저녁 7시 / 주말 경기",
    location: "강남구민체육관 풋살장",
    founded: "2016년 3월",
    coverColor: "#1b4332",
    emoji: "⚽",
    tags: ["축구", "팀워크", "건강", "경기"],
    activities: [
      { id: 1, title: "6월 정기 친선전 vs 한화 FC", date: "2026-06-14", description: "한화그룹 FC와의 친선 경기 (강남구민체육관)" },
      { id: 2, title: "신입 회원 입회식 & 포지션 훈련", date: "2026-06-17", description: "신규 회원 환영 및 포지션별 기초 훈련" },
      { id: 3, title: "하계 사내 축구 리그전", date: "2026-07-11", description: "부서별 팀 구성 사내 리그 (4주 진행)" },
    ],
    members: [
      { id: 1, name: "유준서", department: "영업1팀", role: "회장", joinedAt: "2016-03" },
      { id: 2, name: "노태양", department: "에너지사업부", role: "부회장", joinedAt: "2017-06" },
      { id: 3, name: "문지현", department: "IT기획팀", role: "총무", joinedAt: "2020-03" },
      { id: 4, name: "배소현", department: "마케팅팀", role: "회원", joinedAt: "2022-09" },
    ],
  },
  {
    id: 6,
    name: "삼천리 키친",
    category: "취미",
    description: "요리를 통해 소통하고, 맛있는 음식으로 행복을 나누는 요리 동아리입니다.",
    longDescription:
      "요리에 관심 있는 임직원들이 함께 모여 다양한 음식을 만들고 나누는 동아리입니다. 매달 테마를 정해 한식, 양식, 일식, 베이킹 등 다채로운 요리를 직접 만들어 봅니다. 전문 셰프를 초청한 특별 클래스도 진행되며, 명절이나 특별한 날에는 사내 음식 나눔 행사도 개최합니다. 요리 초보자도 언제든지 환영합니다!",
    memberCount: 23,
    maxMember: 30,
    meetingSchedule: "매월 둘째 주 토요일 오전 11시",
    location: "본사 6층 교육장 (조리실 겸용)",
    founded: "2021년 9월",
    coverColor: "#e76f51",
    emoji: "🍳",
    tags: ["요리", "베이킹", "맛집", "나눔"],
    activities: [
      { id: 1, title: "6월 테마: 여름 냉파스타 & 샐러드", date: "2026-06-13", description: "청량한 여름 요리 만들기 + 시식" },
      { id: 2, title: "특별 클래스: 초청 셰프 한식 코스요리", date: "2026-07-11", description: "유명 한식당 셰프 초청 코스요리 실습" },
      { id: 3, title: "추석 맞이 전통 음식 만들기", date: "2026-09-19", description: "송편, 잡채, 나물 등 추석 전통 음식 만들기" },
    ],
    members: [
      { id: 1, name: "정미래", department: "경영지원팀", role: "회장", joinedAt: "2021-09" },
      { id: 2, name: "김건우", department: "재무팀", role: "부회장", joinedAt: "2021-10" },
      { id: 3, name: "이보람", department: "홍보팀", role: "총무", joinedAt: "2022-01" },
      { id: 4, name: "차준영", department: "안전관리부", role: "회원", joinedAt: "2023-03" },
    ],
  },
];

export const stats = {
  totalClubs: clubs.length,
  totalMembers: clubs.reduce((sum, c) => sum + c.memberCount, 0),
  totalActivities: clubs.reduce((sum, c) => sum + c.activities.length, 0),
  categories: CATEGORIES.length,
};
