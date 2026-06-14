export type GameMode = 'menu' | 'setup' | 'boxing_fight' | 'slapping_duel' | 'how_to_play';

export interface PlayerCustomization {
  name: string;
  color: 'red' | 'green';
  avatarType: 'default' | 'camera';
  // Snapshots in base64
  faces: {
    normal: string | null;
    attack: string | null;
    hit: string | null;
  };
  imageUrl?: string;
}

export type PlayerAction = 'idle' | 'punch_left' | 'punch_right' | 'block' | 'hit' | 'dodge';

export interface FighterState {
  health: number;
  energy: number; // For boxing block stamina
  action: PlayerAction;
  score: number;
  lastHitType: 'left' | 'right' | 'slap' | null;
}

export interface SetupStep {
  playerIndex: 0 | 1; // 0 for Red, 1 for Green
  faceType: 'normal' | 'attack' | 'hit';
}
