const DEFAULT_RESTAURANTS = [
  {id:'saryeoni-bapsang',courseIds:['saryeoni','bijarim'],name:'교래 돌담밥상',category:'제주 가정식',distance:'차량 9분',hours:'11:00–19:30',description:'제철 나물과 제주 돼지 수육을 단정하게 내는 작은 마을 식당입니다.',menu:'돔베고기 정식',query:'제주 교래 돌담밥상',lat:33.4364,lng:126.6763},
  {id:'songdang-noodle',courseIds:['saryeoni','bijarim'],name:'송당 메밀집',category:'메밀 요리',distance:'차량 12분',hours:'10:30–18:00',description:'메밀 향이 또렷한 따뜻한 국수와 담백한 전을 맛볼 수 있습니다.',menu:'제주 메밀국수',query:'제주 송당 메밀국수',lat:33.471,lng:126.78},
  {id:'aewol-sea-table',courseIds:['aewol-handam'],name:'애월 바당식탁',category:'해산물 한식',distance:'도보 8분',hours:'11:30–20:00',description:'한담 바다 가까이에서 제철 생선과 톳 반찬을 내는 소규모 식당입니다.',menu:'옥돔구이 한상',query:'제주 애월 바당식탁',lat:33.4612,lng:126.3123},
  {id:'aewol-millet',courseIds:['aewol-handam'],name:'곽지 보리부엌',category:'보리밥',distance:'도보 12분',hours:'11:00–18:30',description:'구수한 보리밥과 직접 무친 계절 나물을 편안하게 즐기는 동네 밥집입니다.',menu:'제주 나물 보리밥',query:'제주 곽지 보리밥',lat:33.4492,lng:126.307},
  {id:'seongsan-soup',courseIds:['seongsan-run'],name:'성산 해녀국',category:'제주 향토음식',distance:'도보 7분',hours:'07:30–17:00',description:'달리기 뒤 따뜻하게 속을 채우기 좋은 성게 미역국과 보말죽을 냅니다.',menu:'성게 미역국',query:'제주 성산 성게미역국',lat:33.4682,lng:126.9312},
  {id:'seongsan-fish',courseIds:['seongsan-run'],name:'광치기 생선방',category:'생선구이',distance:'차량 6분',hours:'11:00–20:30',description:'동쪽 바다에서 난 생선을 주문 즉시 구워 주는 가족 운영 식당입니다.',menu:'갈치구이',query:'제주 광치기 생선구이',lat:33.4527,lng:126.9191},
  {id:'hamdeok-noodle',courseIds:['hamdeok-gimnyeong'],name:'함덕 고기국수집',category:'제주 국수',distance:'도보 6분',hours:'10:00–20:00',description:'진한 육수와 부드러운 돼지고기를 든든하게 담아내는 동네 국수집입니다.',menu:'고기국수',query:'제주 함덕 고기국수',lat:33.5418,lng:126.668},
  {id:'beophwan-seafood',courseIds:['olle-seven'],name:'법환 해녀밥상',category:'해산물',distance:'도보 9분',hours:'11:00–19:00',description:'법환포구 가까이에서 소라와 문어, 미역을 활용한 한 상을 만듭니다.',menu:'해녀 모둠밥상',query:'제주 법환포구 해산물',lat:33.2378,lng:126.5168}
];

let restaurants = Object.freeze(DEFAULT_RESTAURANTS.map(item => Object.freeze(item)));

export function getRestaurants() { return restaurants; }
export function restaurantById(id) { return restaurants.find(item => item.id === id) || null; }
export function restaurantsForCourse(courseId) { return restaurants.filter(item => item.courseIds.includes(courseId)); }
export function replaceRestaurants(next) {
  if (!Array.isArray(next) || !next.length || !next.every(item => item && item.id)) return;
  restaurants = Object.freeze(next.map(item => Object.freeze({ ...item, courseIds:Array.isArray(item.courseIds) ? item.courseIds.slice() : [] })));
}
