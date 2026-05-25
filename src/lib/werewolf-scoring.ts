export function calcPoints({
  isWin,
  team,
  playerCount,
}: {
  isWin: boolean;
  team: string;
  playerCount: number;
}): number {
  const base = isWin ? 10 : 2;

  const roomBonus = playerCount >= 15 ? 5 : playerCount >= 11 ? 2 : 0;

  let roleBonus = 0;
  if (isWin) {
    if (team === "indy") roleBonus = 15;
    else if (team === "wolf") roleBonus = 3;
    else if (team === "vampire") roleBonus = 5;
    // village = +0
  }

  return base + roomBonus + roleBonus;
}

// Determine action type from role
export function actionTypeForRole(role: string): string {
  if (
    role.includes("Werewolf") ||
    role.includes("หมาป่า") ||
    role.includes("Wolf") ||
    role.includes("Minion") ||
    role.includes("สมุนหมาป่า") ||
    role.includes("Serial Killer") ||
    role.includes("บล็อบจอมเขมือบ") ||
    role.includes("Bloody Mary") ||
    role.includes("แมรี่กระหายเลือด") ||
    role.includes("Vampire") ||
    role.includes("แวมไพร์")
  ) return "kill";

  if (
    role.includes("Bodyguard") ||
    role.includes("บอดี้การ์ด") ||
    role.includes("Priest") ||
    role.includes("นักบวช")
  ) return "protect";

  if (
    role.includes("Seer") ||
    role.includes("เทพพยากรณ์") ||
    role.includes("Oracle") ||
    role.includes("Aura") ||
    role.includes("ญาณทิพย์") ||
    role.includes("Paranormal") ||
    role.includes("นักสืบ")
  ) return "check";

  return "action";
}
