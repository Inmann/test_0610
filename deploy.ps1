# samcheonri-club을 Vercel(test_0611 저장소)로 배포하는 스크립트
# 사용법: .\deploy.ps1
$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

# 배포 원격(test0611)이 없으면 추가
$remotes = git remote
if ($remotes -notcontains "test0611") {
    git remote add test0611 https://github.com/Inmann/test_0611.git
    Write-Host "원격 test0611 추가됨"
}

# 커밋 안 된 변경이 있으면 중단
$dirty = git status --porcelain samcheonri-club
if ($dirty) {
    Write-Host "samcheonri-club에 커밋되지 않은 변경이 있습니다. 먼저 커밋하세요:" -ForegroundColor Yellow
    Write-Host $dirty
    exit 1
}

Write-Host "1/2 원본 저장소(origin) 푸시..." -ForegroundColor Cyan
git push origin main

Write-Host "2/2 배포 저장소(test_0611) subtree 푸시..." -ForegroundColor Cyan
git subtree push --prefix=samcheonri-club test0611 main

Write-Host ""
Write-Host "완료! Vercel이 자동 배포를 시작합니다 (1분 내외)." -ForegroundColor Green
Write-Host "사이트: https://test-0611-omega.vercel.app"
Write-Host "대시보드: https://vercel.com/henry-s-projekt/test-0611"
