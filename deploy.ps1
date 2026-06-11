# samcheonri-club을 Vercel CLI로 프로덕션 배포하는 스크립트
# 사용법: .\deploy.ps1
$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

# 커밋 안 된 변경이 있으면 중단 (git을 소스 오브 트루스로 유지)
$dirty = git status --porcelain samcheonri-club
if ($dirty) {
    Write-Host "samcheonri-club에 커밋되지 않은 변경이 있습니다. 먼저 커밋하세요:" -ForegroundColor Yellow
    Write-Host $dirty
    exit 1
}

Write-Host "1/2 원본 저장소(origin) 푸시..." -ForegroundColor Cyan
git push origin main

Write-Host "2/2 Vercel 프로덕션 배포..." -ForegroundColor Cyan
Set-Location "$repoRoot\samcheonri-club"
vercel deploy --prod --yes

Write-Host ""
Write-Host "완료!" -ForegroundColor Green
Write-Host "사이트: https://test-0611-omega.vercel.app"
Write-Host "대시보드: https://vercel.com/henry-s-projekt/test-0611"
Set-Location $repoRoot
