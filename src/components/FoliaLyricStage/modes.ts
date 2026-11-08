// Folia 内建可视化模式列表（与 fusion-music 的 BUILTIN_VISUALIZER_MODES 保持一致）
export const FOLIA_VISUALIZER_MODES = [
  'classic',
  'cadenza',
  'cappella',
  'claddagh',
  'diorama',
  'nebbia',
  'fume',
  'hanabi',
  'lumiere',
  'machi',
  'monet',
  'partita',
  'pendolo',
  'sonnet',
  'still',
  'tempera',
  'tilt',
] as const

export type FoliaVisualizerMode = typeof FOLIA_VISUALIZER_MODES[number]

export const DEFAULT_FOLIA_VISUALIZER_MODE: FoliaVisualizerMode = 'classic'

export const isFoliaVisualizerMode = (mode: string): mode is FoliaVisualizerMode =>
  (FOLIA_VISUALIZER_MODES as readonly string[]).includes(mode)

/** 每个模式在设置弹窗里的 i18n 键（三语 json 里都有同名键）。 */
export const FOLIA_MODE_LABEL_KEYS: Record<FoliaVisualizerMode, string> = {
  classic: 'play_detail_setting_folia_mode_classic',
  cadenza: 'play_detail_setting_folia_mode_cadenza',
  cappella: 'play_detail_setting_folia_mode_cappella',
  claddagh: 'play_detail_setting_folia_mode_claddagh',
  diorama: 'play_detail_setting_folia_mode_diorama',
  nebbia: 'play_detail_setting_folia_mode_nebbia',
  fume: 'play_detail_setting_folia_mode_fume',
  hanabi: 'play_detail_setting_folia_mode_hanabi',
  lumiere: 'play_detail_setting_folia_mode_lumiere',
  machi: 'play_detail_setting_folia_mode_machi',
  monet: 'play_detail_setting_folia_mode_monet',
  partita: 'play_detail_setting_folia_mode_partita',
  pendolo: 'play_detail_setting_folia_mode_pendolo',
  sonnet: 'play_detail_setting_folia_mode_sonnet',
  still: 'play_detail_setting_folia_mode_still',
  tempera: 'play_detail_setting_folia_mode_tempera',
  tilt: 'play_detail_setting_folia_mode_tilt',
}
