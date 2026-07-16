import { COURSE_ROUTES, calculateRouteDistanceKm } from './course-routes.js';

export const PHOTO_URLS = Object.freeze({
  FOREST: 'https://images.unsplash.com/photo-1670983245322-212a4b009cb9?auto=format&fit=crop&w=1400&q=80',
  OLD_FOREST: 'https://images.unsplash.com/photo-1662564882361-6fe6eabb8da2?auto=format&fit=crop&w=1400&q=80',
  COAST: 'https://images.unsplash.com/photo-1562680802-9cf8b15f419d?auto=format&fit=crop&w=1400&q=80'
});

export const ART_ASSETS = Object.freeze({ HERO: './static/assets/hondigil-jeju-hero.webp' });

function routeData(id) {
  const route = COURSE_ROUTES[id];
  return {
    distance: calculateRouteDistanceKm(route),
    start: route[0],
    end: route[route.length - 1],
    route
  };
}

const DEFAULT_COURSES = [
  {
    id:'saryeoni', name:'사려니숲 초보길', type:'walk', typeLabel:'걷기', durationMin:55,
    difficulty:'쉬움', region:'제주시 조천읍',
    description:'삼나무 향을 따라 완만한 숲길을 걷는 입문 코스입니다. 그늘이 많아 천천히 걷기 좋습니다.',
    image:PHOTO_URLS.FOREST, imageAlt:'나무가 우거진 제주 사려니숲의 흙길',
    startName:'사려니숲길 붉은오름 입구', endName:'사려니숲길 북쪽 쉼터',
    ...routeData('saryeoni'),
    caution:'비 온 뒤에는 흙길이 미끄러울 수 있습니다. 입장 가능 시간과 통제 여부를 현장에서 확인해 주세요.',
    supplies:['미끄럼 방지 운동화','물 500mL 이상','얇은 겉옷']
  },
  {
    id:'aewol-handam', name:'애월 한담 바다산책', type:'walk', typeLabel:'걷기', durationMin:35,
    difficulty:'쉬움', region:'제주시 애월읍',
    description:'곽지에서 한담까지 검은 현무암 해안과 푸른 바다를 가까이 보는 편안한 산책길입니다.',
    image:PHOTO_URLS.COAST, imageAlt:'제주의 검은 현무암과 푸른 바다가 보이는 해안',
    startName:'곽지해수욕장 동쪽', endName:'한담해안산책로 전망대',
    ...routeData('aewol-handam'),
    caution:'파도가 높은 날에는 해안 가까운 구간을 피하고, 젖은 현무암 위로 내려가지 마세요.',
    supplies:['바람막이','햇빛 가리개','물']
  },
  {
    id:'seongsan-run', name:'성산 해맞이 러닝', type:'run', typeLabel:'러닝', durationMin:25,
    difficulty:'보통', region:'서귀포시 성산읍',
    description:'성산일출봉과 바다를 바라보며 달리는 평지 중심 코스입니다. 이른 아침에 특히 여유롭습니다.',
    image:PHOTO_URLS.COAST, imageAlt:'성산일출봉 주변의 바다와 해안 절벽',
    startName:'성산포항 공영주차장', endName:'광치기해변 북쪽',
    ...routeData('seongsan-run'),
    caution:'관광객과 차량이 많은 시간에는 속도를 줄이고, 해안도로 횡단 시 신호를 확인해 주세요.',
    supplies:['러닝화','반사 소재 의류','휴대용 물']
  },
  {
    id:'bijarim', name:'비자림 숨고르기길', type:'walk', typeLabel:'걷기', durationMin:50,
    difficulty:'쉬움', region:'제주시 구좌읍',
    description:'오래된 비자나무 사이를 천천히 걸으며 호흡을 고르는 짧은 숲 코스입니다.',
    image:PHOTO_URLS.OLD_FOREST, imageAlt:'햇빛이 스며드는 제주의 오래된 숲',
    startName:'비자림 매표소 앞', endName:'새천년 비자나무 쉼터',
    ...routeData('bijarim'),
    caution:'관람로 밖으로 벗어나지 말고, 숲 보호를 위해 음식물은 지정 장소에서만 드세요.',
    supplies:['편한 운동화','작은 물병','우천 시 우산']
  },
  {
    id:'hamdeok-gimnyeong', name:'함덕 바다빛 러닝', type:'run', typeLabel:'러닝', durationMin:30,
    difficulty:'보통', region:'제주시 조천읍',
    description:'함덕의 밝은 바다와 낮은 해안도로를 따라 북촌포구까지 이어지는 러닝 코스입니다. 중간 쉼터가 충분합니다.',
    image:PHOTO_URLS.COAST, imageAlt:'제주 동쪽 해안의 푸른 바다 풍경',
    startName:'함덕해수욕장 서우봉 입구', endName:'북촌포구 방파제 앞',
    ...routeData('hamdeok-gimnyeong'),
    caution:'일부 구간은 보행자와 함께 사용합니다. 야간에는 조명이 약한 곳이 있어 밝은 옷을 권합니다.',
    supplies:['쿠션 좋은 러닝화','반사 밴드','물']
  },
  {
    id:'olle-seven', name:'올레 7코스 맛보기', type:'walk', typeLabel:'걷기', durationMin:70,
    difficulty:'보통', region:'서귀포시',
    description:'외돌개에서 법환포구까지 바다와 마을을 번갈아 만나는 올레길 핵심 구간입니다.',
    image:PHOTO_URLS.COAST, imageAlt:'제주 서귀포의 바다와 바위 절벽',
    startName:'외돌개 주차장', endName:'법환포구',
    ...routeData('olle-seven'),
    caution:'돌길과 계단이 섞여 있습니다. 해가 지기 전에 도착할 수 있도록 충분한 시간을 잡아 주세요.',
    supplies:['발목을 잡아주는 신발','물 1L','간단한 간식']
  }
];

let courses = Object.freeze(DEFAULT_COURSES.map(course => Object.freeze(course)));

export function getCourses() { return courses; }
export function courseById(id) { return courses.find(course => course.id === id) || null; }
export function replaceCourses(next) {
  if (!Array.isArray(next) || !next.length || !next.every(course => course && course.id)) return;
  courses = Object.freeze(next.map(course => Object.freeze({
    ...course,
    start:Array.isArray(course.start) ? course.start.slice(0, 2) : [],
    end:Array.isArray(course.end) ? course.end.slice(0, 2) : [],
    route:Array.isArray(course.route) ? course.route.map(point => Array.isArray(point) ? point.slice(0, 2) : point) : [],
    supplies:Array.isArray(course.supplies) ? course.supplies.slice() : []
  })));
}
