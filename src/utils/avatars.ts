// Custom inline SVGs or stylish gradients for default fighter heads if camera is skipped.

export interface DefaultAvatarPreset {
  id: string;
  name: string;
  color: 'red' | 'green' | 'yellow';
  emoji: string;
  gradient: string;
  border: string;
  avatarSvg: string; // Background visual pattern emoji or visual representation
  imageUrl?: string; // High quality human image portrait instead of emoji
}

export const RED_PRESETS: DefaultAvatarPreset[] = [
  {
    id: 'red_beast',
    name: 'Red Rage',
    color: 'red',
    emoji: '😡',
    gradient: 'from-rose-605 via-red-700 to-crimson-900',
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
    name: 'Slayer Tyson (Bot)',
    color: 'yellow',
    emoji: '🥊',
    gradient: 'from-amber-600 via-rose-800 to-amber-955',
    border: 'border-amber-450',
    avatarSvg: '⚡',
    imageUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'bot_chad',
    name: 'Mega-Giga-Chad (Bot)',
    color: 'yellow',
    emoji: '🗿',
    gradient: 'from-slate-700 via-zinc-800 to-slate-950',
    border: 'border-amber-500',
    avatarSvg: '🔩',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'bot_phantom',
    name: 'Ali Phantom (Bot)',
    color: 'yellow',
    emoji: '⚡',
    gradient: 'from-indigo-600 to-purple-950',
    border: 'border-indigo-400',
    avatarSvg: '⭐',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'bot_rocky',
    name: 'Rocky Stallone (Bot)',
    color: 'yellow',
    emoji: '👑',
    gradient: 'from-red-600 via-rose-850 to-stone-900',
    border: 'border-red-400',
    avatarSvg: '🥇',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80'
  }
];
