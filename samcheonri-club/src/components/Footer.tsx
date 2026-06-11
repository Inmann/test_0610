export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-mid mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="text-white font-bold">삼천리 동아리 커뮤니티</span>
            </div>
            <p className="text-sm text-gray-mid leading-relaxed max-w-xs">
              삼천리 임직원들의 다양한 관심사와 열정을<br />
              하나로 모으는 사내 동아리 플랫폼입니다.
            </p>
          </div>

          <div className="flex gap-10 text-sm">
            <div>
              <p className="text-white font-semibold mb-3">바로가기</p>
              <ul className="space-y-2 text-gray-mid">
                <li><a href="/clubs" className="hover:text-white transition-colors">동아리 목록</a></li>
                <li><a href="/notices" className="hover:text-white transition-colors">공지사항</a></li>
                <li><a href="/mypage" className="hover:text-white transition-colors">마이페이지</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">문의</p>
              <ul className="space-y-2 text-gray-mid text-sm">
                <li>인사팀 동아리 담당</li>
                <li>내선 02-3271-XXXX</li>
                <li>club@samcheonri.com</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-5 text-xs text-gray-dark text-center">
          © 2026 삼천리 주식회사. All rights reserved. | 본 사이트는 임직원 전용 플랫폼입니다.
        </div>
      </div>
    </footer>
  );
}
