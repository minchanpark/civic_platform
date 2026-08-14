// Realistic high-quality images for civil complaints (Road damage, building damage, etc.)
export const REALISTIC_COMPLAINT_IMAGES = {
  pothole: [
    'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80', // Road damage & pothole
    'https://images.unsplash.com/photo-1578991624414-276ef23a534f?auto=format&fit=crop&w=800&q=80', // Severe asphalt pavement damage
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80', // Road surface damage
  ],
  building: [
    'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=800&q=80', // Large concrete wall crack
    'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80', // Damaged brick structure
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', // Aging building damage
  ],
  sidewalk: [
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80', // Damaged sidewalk pavers
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80', // Walkway subsidence
  ],
  garbage: [
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80', // Illegal dumping & trash
    'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?auto=format&fit=crop&w=800&q=80', // Abandoned street litter
  ],
  facility: [
    'https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=800&q=80', // Damaged guardrail & safety fence
    'https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=800&q=80', // Broken public streetlight
  ],
};

export const DEFAULT_ROAD_DAMAGE_IMAGE = REALISTIC_COMPLAINT_IMAGES.pothole[0];
export const DEFAULT_BUILDING_DAMAGE_IMAGE = REALISTIC_COMPLAINT_IMAGES.building[0];

export function getComplaintImageByCategory(category?: string, idSeed?: string): string {
  if (!category) {
    if (idSeed) {
      const charCodeSum = idSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const allImages = [
        ...REALISTIC_COMPLAINT_IMAGES.pothole,
        ...REALISTIC_COMPLAINT_IMAGES.building,
        ...REALISTIC_COMPLAINT_IMAGES.sidewalk,
        ...REALISTIC_COMPLAINT_IMAGES.garbage,
        ...REALISTIC_COMPLAINT_IMAGES.facility,
      ];
      return allImages[charCodeSum % allImages.length];
    }
    return DEFAULT_ROAD_DAMAGE_IMAGE;
  }

  const catLower = category.toLowerCase();
  let pool = REALISTIC_COMPLAINT_IMAGES.pothole;

  if (catLower.includes('building') || catLower.includes('건물') || catLower.includes('구조') || catLower.includes('벽')) {
    pool = REALISTIC_COMPLAINT_IMAGES.building;
  } else if (catLower.includes('road') || catLower.includes('도로') || catLower.includes('pothole') || catLower.includes('파손')) {
    pool = REALISTIC_COMPLAINT_IMAGES.pothole;
  } else if (catLower.includes('walk') || catLower.includes('보도') || catLower.includes('인도') || catLower.includes('pavement')) {
    pool = REALISTIC_COMPLAINT_IMAGES.sidewalk;
  } else if (catLower.includes('trash') || catLower.includes('garbage') || catLower.includes('환경') || catLower.includes('쓰레기')) {
    pool = REALISTIC_COMPLAINT_IMAGES.garbage;
  } else if (catLower.includes('facility') || catLower.includes('시설') || catLower.includes('가로등')) {
    pool = REALISTIC_COMPLAINT_IMAGES.facility;
  }

  if (idSeed) {
    const charCodeSum = idSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return pool[charCodeSum % pool.length];
  }

  return pool[0];
}
