import { defineMeta, skin, upgrade } from '../define';

export default defineMeta({
  id: 'hill-rider',
  title: 'Hill Rider',
  tagline: 'Gas, brake, balance. Don’t flip, don’t run dry.',
  description:
    'A physics driving game over endless rolling hills. Balance your ride with gas and brake, grab fuel cans before the tank runs dry and don’t land on your roof. Upgrade the engine, tank and suspension, or buy a monster truck.',
  howToPlay: [
    'Hold GAS (right side / →) and BRAKE (left side / ←). In the air they tilt your car.',
    'Pick up fuel cans — when the tank is empty, the run is over.',
    'Landing on your roof ends the run. Coins pay for new rides.',
  ],
  categories: ['racing', 'physics', 'endless'],
  tags: ['cars', 'hill climb', 'driving', 'fuel', 'monster truck', 'balance'],
  difficulty: 'medium',
  controls: { desktop: '→ / D gas · ← / A brake', touch: 'Hold right side for gas, left side to brake' },
  score: { label: 'Meters', format: 'points' },
  medals: { bronze: 400, silver: 1000, gold: 2000 },
  theme: { from: '#65a30d', to: '#0c4a6e', accent: '#a3e635' },
  sessionLength: '1–4 min',
  orientation: 'any',
  realtime: true,
  popularity: 89,
  addedAt: '2026-09-26',
  shop: {
    title: 'Garage',
    icon: '🚙',
    skinLabel: 'Vehicles',
    upgrades: [
      upgrade('engine', 'Engine', '⚙️', '+10% power per level', 6, 80),
      upgrade('tank', 'Fuel tank', '⛽', '+20% fuel capacity per level', 5, 70),
      upgrade('suspension', 'Suspension', '🔩', 'Softer landings, better balance', 4, 90),
      upgrade('tires', 'Tyres', '🛞', '+12% grip per level', 5, 75),
    ],
    skins: [
      skin('jeep', 'Jeep', 0, ['#dc2626', '#7f1d1d', '#fecaca'], { icon: '🚙' }),
      skin('buggy', 'Dune Buggy', 450, ['#f59e0b', '#78350f', '#fde68a'], {
        icon: '🏜️',
        perk: 'Light & quick',
      }),
      skin('rally', 'Rally Car', 800, ['#2563eb', '#1e3a8a', '#bfdbfe'], {
        icon: '🏎️',
        perk: '+grip, +speed',
      }),
      skin('monster', 'Monster Truck', 1500, ['#16a34a', '#14532d', '#bbf7d0'], {
        icon: '🛻',
        perk: 'Huge wheels',
      }),
      skin('rover', 'Moon Rover', 0, ['#e5e7eb', '#475569', '#93c5fd'], {
        icon: '🌙',
        perk: 'Low gravity',
        adUnlock: 3,
      }),
    ],
  },
});
