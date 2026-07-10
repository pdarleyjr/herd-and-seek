export interface ShotPoint {
  worldX: number;
  worldY: number;
}

export interface ShotTargetContext {
  showTouchControls: boolean;
  aimTarget: ShotPoint | null;
  mouseTarget: ShotPoint;
  localPos: { x: number; y: number };
  aimAngle: number;
}

export function resolveShotTarget({
  showTouchControls,
  aimTarget,
  mouseTarget,
  localPos,
  aimAngle,
}: ShotTargetContext): ShotPoint {
  if (showTouchControls && aimTarget) {
    return aimTarget;
  }

  if (!showTouchControls && (mouseTarget.worldX !== 0 || mouseTarget.worldY !== 0)) {
    return mouseTarget;
  }

  return {
    worldX: localPos.x + Math.cos(aimAngle) * 600,
    worldY: localPos.y + Math.sin(aimAngle) * 600,
  };
}
