// utils/govt_contributions.js

/**
 * Computes the SSS contribution (EE, ER, EC) by looking up the salary
 * directly in the SSS EE Bracket Table (sss_bracket_table).
 *
 * SSS is fully managed sa hiwalay na page/table na ito (see
 * SSSTableSetup.jsx) — bawat bracket row ay meron nang naka-store na
 * ee_amount, er_amount, at ec_amount, kaya hindi na kailangan ng
 * separate percentage/rate config dito.
 *
 * brackets: array of { bracket_min, bracket_max, msc, ee_amount, er_amount, ec_amount }
 *   - bracket_max === null means "open-ended" (topmost bracket, e.g. 34,750 and up)
 *   - rows don't need to be pre-sorted; this sorts by bracket_min internally
 */
export function computeSSS(salary, brackets = []) {
  const s = Number(salary) || 0;

  if (!brackets || brackets.length === 0) {
    return { ee: 0, er: 0, ec: 0, total: 0, msc: 0 };
  }

  const sorted = [...brackets].sort((a, b) => a.bracket_min - b.bracket_min);
  const match = sorted.find((b) => {
    const min = Number(b.bracket_min);
    const max =
      b.bracket_max === null || b.bracket_max === undefined
        ? Infinity
        : Number(b.bracket_max);
    return s >= min && s <= max;
  });

  if (!match) return { ee: 0, er: 0, ec: 0, total: 0, msc: 0 };

  const ee = Number(match.ee_amount) || 0;
  const er = Number(match.er_amount) || 0;
  const ec = Number(match.ec_amount) || 0;

  return { ee, er, ec, total: ee + er + ec, msc: Number(match.msc) || 0 };
}

export function computePHIC(salary, cfg) {
  if (!cfg) return { ee: 0, er: 0, total: 0 };
  const s = Number(salary) || 0;
  const base = Math.min(Math.max(s, cfg.phic_floor), cfg.phic_ceiling);
  const total = base * cfg.phic_rate;
  return { ee: total / 2, er: total / 2, total };
}

export function computeHDMF(salary, cfg) {
  if (!cfg) return { ee: 0, er: 0, total: 0 };
  const s = Number(salary) || 0;
  const base = Math.min(s, cfg.hdmf_cap_salary);
  const eeRate = base <= cfg.hdmf_low_threshold ? cfg.hdmf_ee_rate_low : cfg.hdmf_ee_rate_high;
  const ee = base * eeRate;
  const er = base * cfg.hdmf_er_rate;
  return { ee, er, total: ee + er };
}