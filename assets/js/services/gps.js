export function distanceInMeters(first, second) {
  const radius = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(second.latitude - first.latitude);
  const dLng = toRad(second.longitude - first.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(first.latitude)) * Math.cos(toRad(second.latitude)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function locationErrorMessage(error) {
  if (error?.code === 1) return '위치 권한이 거부됐어요. 브라우저 설정에서 위치 접근을 허용해 주세요.';
  if (error?.code === 2) return '현재 위치를 확인할 수 없어요. 하늘이 보이는 곳에서 다시 시도해 주세요.';
  if (error?.code === 3) return '위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.';
  return '현재 위치를 확인하지 못했습니다.';
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('UNSUPPORTED')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:15000, maximumAge:3000 });
  });
}
