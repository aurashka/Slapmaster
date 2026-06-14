// Custom inline SVGs or stylish gradients for default fighter heads if camera is skipped.

export interface DefaultAvatarPreset {
  id: string;
  name: string;
  color: 'red' | 'green' | 'yellow';
  emoji: string;
  gradient: string;
  border: string;
  avatarSvg: string; // Background visual pattern emoji or visual representation
}

export const RED_PRESETS: DefaultAvatarPreset[] = [
  {
    id: 'red_beast',
    name: 'Red Rage',
    color: 'red',
    emoji: '😡',
    gradient: 'from-rose-600 via-red-700 to-crimson-900',
    border: 'border-red-500',
    avatarSvg: '🤖'
  },
  {
    id: 'crimson_helmet',
    name: 'Giga Fighter P1',
    color: 'red',
    emoji: '🤠',
    gradient: 'from-red-500 to-amber-950',
    border: 'border-rose-450',
    avatarSvg: '👾'
  },
  {
    id: 'lava_lord',
    name: 'Lava Wrestler',
    color: 'red',
    emoji: '👹',
    gradient: 'from-orange-600 to-purple-950',
    border: 'border-orange-500',
    avatarSvg: '🔥'
  }
];

export const GREEN_PRESETS: DefaultAvatarPreset[] = [
  {
    id: 'green_slime',
    name: 'Slap Saur',
    color: 'green',
    emoji: '👽',
    gradient: 'from-emerald-500 via-teal-600 to-green-950',
    border: 'border-emerald-500',
    avatarSvg: '🦠'
  },
  {
    id: 'toxic_giant',
    name: 'Zombie Slapper',
    color: 'green',
    emoji: '🧟',
    gradient: 'from-green-600 to-yellow-950',
    border: 'border-green-400',
    avatarSvg: '🥬'
  },
  {
    id: 'jade_dragon',
    name: 'Jade Hulk',
    color: 'green',
    emoji: '🐲',
    gradient: 'from-teal-500 to-emerald-950',
    border: 'border-teal-400',
    avatarSvg: '🍀'
  }
];

export const BOT_PRESETS: DefaultAvatarPreset[] = [
  {
    id: 'bot_slapper',
    name: 'SlapBot-5000',
    color: 'yellow',
    emoji: '🤖',
    gradient: 'from-amber-500 via-yellow-600 to-amber-950',
    border: 'border-yellow-400',
    avatarSvg: '⚡'
  },
  {
    id: 'bot_chad',
    name: 'Mega-Giga-Chad',
    color: 'yellow',
    emoji: '🗿',
    gradient: 'from-gray-700 to-slate-950',
    border: 'border-slate-400',
    avatarSvg: '🔩'
  }
];
