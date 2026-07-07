// utils/govt_contributions.js

export function computeSSS(salary, cfg) {
  if (!cfg) return { ee: 0, er: 0, ec: 0, total: 0 };

  const s = Number(salary) || 0;
  const msc = Math.min(
    Math.max(Math.round(s / cfg.sss_msc_step) * cfg.sss_msc_step, cfg.sss_msc_min),
    cfg.sss_msc_max
  );
  const ee = msc * cfg.sss_ee_rate;
  const er = msc * cfg.sss_er_rate;
  const ec = msc >= cfg.sss_ec_threshold ? cfg.sss_ec_high : cfg.sss_ec_low;
  return { ee, er, ec, total: ee + er + ec };
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