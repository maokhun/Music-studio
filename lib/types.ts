export interface Track {
  id: string;
  groupId: string; // pairs Version 1 and Version 2
  version: 1 | 2;
  title: string;
  lyrics: string;
  style: string;
  model: 'V4.0' | 'V5.5 HQ' | 'Custom Pro';
  duration: number; // in seconds
  audioUrl: string;
  wavUrl?: string;
  videoUrl?: string;
  coverUrl: string;
  status: 'generating' | 'ready' | 'error';
  progress?: number;
  createdAt: string;
  isFavorite?: boolean;
  isInstrumental?: boolean;
  tags?: string[];
}

export interface PresetStyle {
  id: string;
  nameKh: string;
  nameEn: string;
  emoji: string;
  category: 'khmer' | 'modern' | 'lofi' | 'energetic';
  stylePrompt: string;
  suggestedPrompt: string;
}

export interface GenerateParams {
  title?: string;
  lyrics: string;
  style: string;
  model: 'V4.0' | 'V5.5 HQ' | 'Custom Pro';
  isInstrumental: boolean;
  customMode: boolean;
  vocalGender?: 'female' | 'male' | 'duet' | 'auto';
  styleInfluence?: number; // 0-100
}
