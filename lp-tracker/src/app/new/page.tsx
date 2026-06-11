"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrograms } from "@/lib/store";
import { CATEGORIES, STATUSES, type Category, type OurStatus } from "@/lib/types";

type FormState = {
  institution: string;
  title: string;
  category: Category;
  total_size: string;
  num_gps: string;
  announce_date: string;
  deadline: string;
  presentation_date: string;
  result_date: string;
  url: string;
  our_status: OurStatus;
  memo: string;
};

const INITIAL_FORM: FormState = {
  institution: "",
  title: "",
  category: "PEF",
  total_size: "",
  num_gps: "",
  announce_date: "",
  deadline: "",
  presentation_date: "",
  result_date: "",
  url: "",
  our_status: "미검토",
  memo: "",
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-sm font-semibold text-slate-700";

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewProgramPage() {
  const router = useRouter();
  const { addProgram } = usePrograms();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addProgram({
        institution: form.institution.trim(),
        title: form.title.trim(),
        category: form.category,
        total_size: form.total_size.trim(),
        num_gps: form.num_gps.trim(),
        announce_date: form.announce_date || null,
        deadline: form.deadline,
        presentation_date: form.presentation_date || null,
        result_date: form.result_date || null,
        url: form.url.trim(),
        our_status: form.our_status,
        memo: form.memo.trim(),
      });
      router.push("/");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">공고 등록</h1>
        <p className="mt-1 text-sm text-slate-500">
          새 출자사업 공고 정보를 입력하세요.
        </p>
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          오류: {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="institution" label="출자기관" required>
            <input
              id="institution"
              className={inputCls}
              required
              placeholder="예: 한국성장금융"
              value={form.institution}
              onChange={(e) => set("institution", e.target.value)}
            />
          </Field>
          <Field id="category" label="분야" required>
            <select
              id="category"
              className={inputCls}
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="title" label="사업명" required>
          <input
            id="title"
            className={inputCls}
            required
            placeholder="예: 2026년 1차 정시 출자사업"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="total_size" label="총 출자규모">
            <input
              id="total_size"
              className={inputCls}
              placeholder="예: 6,000억원"
              value={form.total_size}
              onChange={(e) => set("total_size", e.target.value)}
            />
          </Field>
          <Field id="num_gps" label="선정 운용사 수">
            <input
              id="num_gps"
              className={inputCls}
              placeholder="예: 8개사 내외"
              value={form.num_gps}
              onChange={(e) => set("num_gps", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="announce_date" label="공고일">
            <input
              id="announce_date"
              type="date"
              className={inputCls}
              value={form.announce_date}
              onChange={(e) => set("announce_date", e.target.value)}
            />
          </Field>
          <Field id="deadline" label="접수 마감일" required>
            <input
              id="deadline"
              type="date"
              className={inputCls}
              required
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </Field>
          <Field id="presentation_date" label="PT 예정일">
            <input
              id="presentation_date"
              type="date"
              className={inputCls}
              value={form.presentation_date}
              onChange={(e) => set("presentation_date", e.target.value)}
            />
          </Field>
          <Field id="result_date" label="선정 발표 예정일">
            <input
              id="result_date"
              type="date"
              className={inputCls}
              value={form.result_date}
              onChange={(e) => set("result_date", e.target.value)}
            />
          </Field>
        </div>

        <Field id="url" label="공고 원문 링크">
          <input
            id="url"
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>

        <Field id="our_status" label="진행상태">
          <select
            id="our_status"
            className={inputCls}
            value={form.our_status}
            onChange={(e) => set("our_status", e.target.value as OurStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field id="memo" label="내부 메모">
          <textarea
            id="memo"
            className={`${inputCls} min-h-24 resize-y`}
            placeholder="검토 의견, 담당자, 준비 사항 등"
            value={form.memo}
            onChange={(e) => set("memo", e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={submitting}
            onClick={() => router.push("/")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {submitting ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
