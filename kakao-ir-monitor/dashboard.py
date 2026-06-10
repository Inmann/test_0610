"""
IR 요약 HTML 대시보드 생성 모듈
"""
import json
import os
from datetime import datetime
from ir_processor import IRSummary

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DASHBOARD_PATH = os.path.join(os.path.dirname(__file__), "dashboard.html")
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "summaries.json")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def load_summaries() -> list[dict]:
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_summary(summary: IRSummary) -> None:
    summaries = load_summaries()
    summaries.insert(0, summary.to_dict())  # 최신순
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=2)


def _badge(stage: str) -> str:
    colors = {
        "Seed": "#10b981", "시드": "#10b981", "Pre-Seed": "#6ee7b7",
        "Pre-A": "#3b82f6", "Series A": "#8b5cf6", "시리즈A": "#8b5cf6",
        "Series B": "#f59e0b", "시리즈B": "#f59e0b",
    }
    color = colors.get(stage, "#6b7280")
    return f'<span style="background:{color};color:#fff;padding:2px 8px;border-radius:999px;font-size:11px">{stage}</span>'


def _source_badge(source: str) -> str:
    if source == "claude":
        return '<span style="color:#8b5cf6;font-size:10px">✦ Claude 요약</span>'
    return '<span style="color:#9ca3af;font-size:10px">✦ 자동 파싱</span>'


def _card(s: dict) -> str:
    raw = "\n".join(s.get("raw_messages", []))
    raw_escaped = raw.replace("<", "&lt;").replace(">", "&gt;")
    return f"""
<div class="card" data-stage="{s.get('stage','')}" data-name="{s.get('company_name','')}">
  <div class="card-header">
    <span class="company">{s.get('company_name','미확인')}</span>
    {_badge(s.get('stage','미확인'))}
    {_source_badge(s.get('source','regex'))}
    <span class="time">{s.get('summarized_at','')}</span>
  </div>
  <p class="business">{s.get('business','')}</p>
  <div class="meta-grid">
    <div class="meta-item"><span class="label">💰 목표금액</span><span>{s.get('amount','미확인')}</span></div>
    <div class="meta-item"><span class="label">📊 주요지표</span><span>{s.get('key_metrics','')}</span></div>
    <div class="meta-item"><span class="label">📬 연락처</span><span>{s.get('contact','')}</span></div>
  </div>
  <details class="raw">
    <summary>원문 보기</summary>
    <pre>{raw_escaped}</pre>
  </details>
</div>"""


def render_dashboard(summaries: list[dict] | None = None) -> None:
    if summaries is None:
        summaries = load_summaries()

    count = len(summaries)
    updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cards_html = "\n".join(_card(s) for s in summaries) if summaries else \
        '<p style="text-align:center;color:#9ca3af;padding:60px">아직 수집된 IR이 없습니다.</p>'

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IR 모니터 대시보드</title>
<meta http-equiv="refresh" content="30">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }}
  header {{ background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }}
  header h1 {{ font-size: 20px; font-weight: 700; }}
  header .badge {{ background: #7c3aed; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 12px; }}
  .meta-bar {{ background: #1e293b; padding: 10px 24px; font-size: 12px; color: #94a3b8; border-bottom: 1px solid #334155; display: flex; gap: 20px; align-items: center; }}
  .search {{ margin: 0 0 0 auto; }}
  .search input {{ background: #0f172a; border: 1px solid #334155; color: #e2e8f0; border-radius: 6px; padding: 4px 10px; font-size: 12px; outline: none; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; padding: 20px 24px; }}
  .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; transition: border-color .2s; }}
  .card:hover {{ border-color: #7c3aed; }}
  .card-header {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }}
  .company {{ font-weight: 700; font-size: 16px; color: #f1f5f9; flex: 1 0 auto; }}
  .time {{ margin-left: auto; font-size: 11px; color: #64748b; }}
  .business {{ color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }}
  .meta-grid {{ display: grid; gap: 6px; margin-bottom: 10px; }}
  .meta-item {{ display: flex; gap: 8px; font-size: 12px; color: #94a3b8; }}
  .label {{ color: #64748b; min-width: 72px; flex-shrink: 0; }}
  details.raw summary {{ font-size: 11px; color: #64748b; cursor: pointer; }}
  details.raw pre {{ background: #0f172a; border-radius: 6px; padding: 8px; font-size: 11px; color: #94a3b8; margin-top: 6px; white-space: pre-wrap; word-break: break-all; }}
  .hidden {{ display: none !important; }}
</style>
</head>
<body>
<header>
  <span style="font-size:24px">📡</span>
  <h1>IR 모니터 대시보드</h1>
  <span class="badge">{count}건</span>
</header>
<div class="meta-bar">
  <span>마지막 갱신: {updated}</span>
  <span>자동 새로고침: 30초</span>
  <div class="search">
    <input type="text" id="q" placeholder="회사명 / 투자 단계 검색…" oninput="filter()">
  </div>
</div>
<div class="grid" id="grid">
{cards_html}
</div>
<script>
function filter() {{
  const q = document.getElementById('q').value.toLowerCase();
  document.querySelectorAll('.card').forEach(c => {{
    const text = (c.dataset.name + c.dataset.stage + c.innerText).toLowerCase();
    c.classList.toggle('hidden', q && !text.includes(q));
  }});
}}
</script>
</body>
</html>"""

    with open(DASHBOARD_PATH, "w", encoding="utf-8") as f:
        f.write(html)
