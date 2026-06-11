"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Program } from "@/lib/types";

type ProgramsContextValue = {
  programs: Program[];
  loading: boolean;
  error: string | null;
  getProgram: (id: string) => Program | undefined;
  updateProgram: (id: string, patch: Partial<Omit<Program, "id">>) => Promise<void>;
  addProgram: (input: Omit<Program, "id">) => Promise<string>;
};

const ProgramsContext = createContext<ProgramsContextValue | null>(null);

export function ProgramsProvider({ children }: { children: React.ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const supabase = createClient();

    supabase
      .from("programs")
      .select("*")
      .order("deadline", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled.current) return;
        if (err) {
          setError(err.message);
        } else {
          setPrograms((data ?? []) as Program[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled.current = true;
    };
  }, []);

  const getProgram = useCallback(
    (id: string) => programs.find((p) => p.id === id),
    [programs]
  );

  const updateProgram = useCallback(
    async (id: string, patch: Partial<Omit<Program, "id">>) => {
      // 낙관적 업데이트 — 화면 반응을 즉시 보여주기 위해 DB 응답 전에 먼저 상태 갱신
      setPrograms((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );

      const supabase = createClient();
      const { error: err } = await supabase
        .from("programs")
        .update(patch)
        .eq("id", id);

      if (err) {
        // 실패 시 DB에서 최신 데이터를 다시 불러와 복원
        const { data } = await supabase
          .from("programs")
          .select("*")
          .order("deadline", { ascending: true });
        if (data) setPrograms(data as Program[]);
        throw new Error(err.message);
      }
    },
    []
  );

  const addProgram = useCallback(
    async (input: Omit<Program, "id">): Promise<string> => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("programs")
        .insert(input)
        .select()
        .single();

      if (err) throw new Error(err.message);

      const newProgram = data as Program;
      setPrograms((prev) => [...prev, newProgram]);
      return newProgram.id;
    },
    []
  );

  return (
    <ProgramsContext.Provider
      value={{ programs, loading, error, getProgram, updateProgram, addProgram }}
    >
      {children}
    </ProgramsContext.Provider>
  );
}

export function usePrograms(): ProgramsContextValue {
  const ctx = useContext(ProgramsContext);
  if (!ctx) {
    throw new Error("usePrograms는 ProgramsProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}
