import type { ExtendedStocksOptimizationConfig } from './types';

export const NNE_PRESET_CONFIG: ExtendedStocksOptimizationConfig = {
  strategyType: 'stocks',
  bars_between_trades: { min: 0, max: 2, step: 1 },
  cooldown_after_loss_bars: { min: 0, max: 3, step: 1 },
  allow_flip_L2S: true, allow_flip_S2L: true, signals_on_close: true,

  // Trade management — long
  stop_distance_percent_long: { min: 8, max: 20, step: 3 },
  be_trigger_pct_long: { min: 4, max: 12, step: 2 },
  trail_rsi_pct_input_long: { min: 10, max: 22, step: 3 },
  tp_percent_long: { min: 3, max: 10, step: 1 },
  tp_trail_distance_long: { min: 1, max: 3, step: 1 },
  rsi_long_entry_min: { min: 40, max: 55, step: 3 },
  rsi_trail_long: { min: 60, max: 75, step: 3 },

  // Trade management — short
  stop_distance_percent_short: { min: 6, max: 15, step: 3 },
  be_trigger_pct_short: { min: 15, max: 30, step: 5 },
  trail_rsi_pct_input_short: { min: 10, max: 22, step: 3 },
  tp_percent_short: { min: 1, max: 5, step: 1 },
  tp_trail_distance_short: { min: 1, max: 3, step: 1 },
  rsi_short_entry_max: { min: 38, max: 52, step: 3 },
  rsi_trail_short: { min: 25, max: 38, step: 3 },

  ma_len: { min: 30, max: 70, step: 10 },
  non_regress_stop: false, prefer_tp_priority: false, close_only_trail: false, stop_on_close_only: false,
  avoid_opening_bar: false, block_close_bar: true,

  // Filters
  use_big_bar_filter: true, big_bar_atr_mult: { min: 1.5, max: 3, step: 0.5 },
  use_dist_filter: true, max_dist_from_ema50_pc: { min: 10, max: 20, step: 2.5 },
  use_post_trail_tighten: false, post_trail_tighten_pct: { min: 3, max: 6, step: 1 },
  use_min_bars_post_trail: false, min_bars_post_trail: { min: 8, max: 16, step: 4 },
  exit_all_now: false, block_new_entries: false,

  // VIX
  use_vix_range_filter: false, vix_normal_min: { min: 10, max: 10, step: 1 }, vix_normal_max: { min: 30, max: 30, step: 1 },
  use_vix_exit_long: false, use_vix_exit_short: false,
  use_vix_freeze: true, vix_lookback_bars: { min: 1, max: 1, step: 1 }, vix_spike_pct: { min: 5, max: 12, step: 3 }, vix_freeze_bars: { min: 1, max: 3, step: 1 },

  // ATR stops
  use_atr_sl: true, atr_mult_long: { min: 2, max: 4, step: 0.5 }, atr_mult_short: { min: 2.5, max: 5, step: 0.5 },

  // RSI exit
  enable_strat1: true, enable_rsi_exit: true,
  rsi_exit_long: { min: 60, max: 75, step: 5 }, rsi_exit_short: { min: 35, max: 50, step: 5 },
  min_bars_in_trade_exit: { min: 1, max: 4, step: 1 },

  // Strategy 1 — EMA + RSI + ATR + ADX + BB
  s1_ema_fast_len: { min: 5, max: 13, step: 2 }, s1_ema_mid_len: { min: 15, max: 25, step: 3 },
  s1_ema_trend_len: { min: 40, max: 60, step: 10 }, s1_rsi_len: { min: 10, max: 18, step: 2 },
  s1_atr_len: { min: 12, max: 20, step: 2 }, s1_atr_ma_len: { min: 8, max: 16, step: 2 },
  s1_atr_hi_mult: { min: 0.6, max: 1.2, step: 0.15 }, s1_adx_len: { min: 8, max: 14, step: 3 },
  s1_adx_strong: { min: 14, max: 24, step: 3 }, s1_bb_len: { min: 16, max: 24, step: 4 },
  s1_bb_mult: { min: 1.8, max: 2.6, step: 0.2 }, s1_far_from_bb_pc: { min: 1, max: 4, step: 1 },
  s1_vol_len: { min: 12, max: 20, step: 4 }, s1_hi_vol_mult: { min: 1, max: 2, step: 0.5 },
  s1_min_conds: { min: 2, max: 4, step: 1 },

  // Strategy 2 — BB mean reversion
  enable_strat2: true, bb2_use_trend_filter: true,
  bb2_ma_len: { min: 40, max: 80, step: 10 }, bb2_adx_max: { min: 35, max: 60, step: 5 },
  bb2_adx_len: { min: 8, max: 14, step: 3 }, bb2_rsi_long_max: { min: 30, max: 45, step: 5 },
  bb2_rsi_short_min: { min: 12, max: 25, step: 4 }, bb2_bb_len: { min: 16, max: 24, step: 4 },
  bb2_bb_mult: { min: 1.8, max: 2.6, step: 0.2 },

  // Strategy 3 — Breakout
  enable_strat3: true, s3_breakout_len: { min: 10, max: 20, step: 2 }, s3_adx_min: { min: 16, max: 28, step: 3 },
  s3_use_vol_filter: true, s3_vol_mult: { min: 2, max: 4, step: 0.5 },
  s3_rsi_long_min: { min: 52, max: 65, step: 3 }, s3_rsi_short_max: { min: 35, max: 48, step: 3 },

  // Strategy 4 — Inside bar
  enable_strat4: true, s4_use_trend_filter: false,
  s4_min_inside_range_pc: { min: 0, max: 0.5, step: 0.1 }, s4_rsi_long_min: { min: 45, max: 58, step: 3 },
  s4_rsi_short_max: { min: 0, max: 0, step: 1 },

  // Strategy 5 — Squeeze
  enable_strat5: true, s5_squeeze_len: { min: 1, max: 3, step: 1 },
  s5_atr_mult_low: { min: 1, max: 1.8, step: 0.2 }, s5_range_len: { min: 16, max: 28, step: 3 },
  s5_use_vol_filter: true, s5_vol_mult: { min: 1.2, max: 2.2, step: 0.3 },
  s5_rsi_long_min: { min: 50, max: 62, step: 3 }, s5_rsi_short_max: { min: 35, max: 48, step: 3 },
};

export const PRESET_CONFIGS = { NNE: NNE_PRESET_CONFIG };
export const EXTENDED_OPTIMIZATION_CONFIG = NNE_PRESET_CONFIG;
