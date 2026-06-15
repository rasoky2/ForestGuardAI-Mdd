export const madreDeDiosCenter: [number, number] = [-12.5933, -70.0402];

export const SECTOR_RISK_COORDS: Record<string, [number, number]> = {
  "Tambopata - Las Piedras": [-12.5933, -69.0402],
  "Tahuamanu - Iberia":     [-11.4133, -69.4902],
  "Manu - Fitzcarrald":     [-12.0833, -70.3502],
};

export function getRiskColor(level: string): string {
  switch (level.toUpperCase()) {
    case 'ALTO':  return '#dc2626';
    case 'MEDIO': return '#ea580c';
    default:      return '#047857';
  }
}

export function getRiskRadius(risk: number): number {
  return 40000 + risk * 300;
}

export function getGridColor(level: string): string {
  switch (level.toUpperCase()) {
    case 'ALTO':  return '#dc2626';
    case 'MEDIO': return '#ea580c';
    default:      return '#16a34a';
  }
}

export function getGridOpacity(level: string): number {
  if (level.toUpperCase() === 'ALTO') return 0.6;
  if (level.toUpperCase() === 'MEDIO') return 0.35;
  return 0.18;
}

export function getRiskTextColor(level: string): string {
  if (level.toUpperCase() === 'ALTO') return 'text-red-600';
  if (level.toUpperCase() === 'MEDIO') return 'text-orange-600';
  return 'text-emerald-700';
}

export function getRiskBadgeClass(level: string): string {
  if (level.toUpperCase() === 'ALTO') return 'bg-red-50 text-red-700 border-red-100';
  if (level.toUpperCase() === 'MEDIO') return 'bg-orange-50 text-orange-700 border-orange-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

export function getHexagonPoints(lat: number, lon: number, sizeDeg: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 6; // Pointy-topped hexagon
    const ptLat = lat + sizeDeg * Math.sin(angle);
    const ptLon = lon + sizeDeg * Math.cos(angle);
    points.push([ptLat, ptLon]);
  }
  return points;
}

export const INTEROCEANIC_HIGHWAY_BRANCHES: [number, number][][] = [
  // Rama Sur (Hacia Cusco/Puno)
  [
    [-12.5, -69.0],
    [-12.6, -69.5],
    [-12.7, -70.0],
    [-12.8, -70.5]
  ],
  // Rama Norte (Hacia Iberia/Iñapari)
  [
    [-12.5, -69.0],
    [-11.4, -69.5],
    [-11.2, -69.6]
  ]
];

