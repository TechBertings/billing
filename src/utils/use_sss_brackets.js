// utils/use_sss_brackets.js
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Fetches the SSS EE Bracket Table (sss_bracket_table) — the single
 * source of truth for SSS EE/ER/EC amounts, managed sa SSSTableSetup.jsx
 * page. Ginagamit ito kasabay ng computeSSS() sa kahit saang page na
 * nagko-compute ng payroll/government contributions.
 */
export function useSSSBrackets() {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBrackets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sss_bracket_table")
      .select("*")
      .order("bracket_min", { ascending: true });
    if (!error) setBrackets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBrackets();
  }, [fetchBrackets]);

  return { brackets, loading, refetch: fetchBrackets };
}