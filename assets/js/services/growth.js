export function getRoomGrowth(records, totalDistance) {
  const count = records.length;
  return {
    level:Math.max(1, Math.floor(totalDistance / 10) + 1),
    traveler:count >= 5 ? '😎🏃' : count >= 1 ? '🙂🏃' : '🙂',
    dol:count >= 5 ? '🗿✨' : count >= 1 ? '🗿' : '🪨',
    dolLabel:count >= 5 ? '반짝이는 돌하르방' : count >= 1 ? '깨어난 돌하르방' : '첫 완주를 기다리는 돌',
    tree:totalDistance >= 30 ? '🍊🌳' : totalDistance >= 10 ? '🌳' : totalDistance > 0 ? '🌱' : '🌰',
    treeLabel:totalDistance >= 30 ? '귤이 열린 나무' : totalDistance >= 10 ? '자라는 나무' : totalDistance > 0 ? '새싹' : '아직 심지 않은 씨앗'
  };
}
