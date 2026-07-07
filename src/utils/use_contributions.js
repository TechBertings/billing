// utils/use_contributions.js
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

// utils/use_contributions.js
export function useContributionConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("contribution_config")
        .select("*")
        .eq("status", true)
        .maybeSingle();
      if (isMounted) {
        if (!error) setConfig(data);
        setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  return { config, loading };
}