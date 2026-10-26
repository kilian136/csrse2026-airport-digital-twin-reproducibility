function bindRange(
  runtimePrefix: string,
  featurePrefix: string,
  count: number,
  runtimeStart = 1,
  featureStart = 1,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, offset) => [
      `${runtimePrefix}-${String(runtimeStart + offset).padStart(2, "0")}`,
      `${featurePrefix}-${String(featureStart + offset).padStart(2, "0")}`,
    ]),
  );
}

/**
 * 旧运行编号到新版WGS84要素的过渡别名。
 *
 * 这里只表达已经人工确认的区域语义，不读取旧底图坐标，也不进行最近点猜测。
 * 新版运行状态完成迁移后可整体删除此表。
 */
export const xiaoshanRuntimeStandGeospatialBindings = Object.freeze({
  // 旧A/B/C区分别对应T1的A/B/C指廊。
  ...bindRange("A", "ZSHC-T1-A-GATE", 8),
  ...bindRange("B", "ZSHC-T1-B-GATE", 11),
  ...bindRange("C", "ZSHC-T1-C-GATE", 11),

  // 旧D/E/F/G区分别对应T2的A/B/C/D指廊。
  ...bindRange("D", "ZSHC-T2-A-GATE", 18),
  ...bindRange("E", "ZSHC-T2-B-GATE", 8),
  ...bindRange("F", "ZSHC-T2-C-GATE", 7),
  ...bindRange("G", "ZSHC-T2-D-GATE", 5),

  // 旧MA实际停放窄体中型机，优先映射至新版MA2。
  ...bindRange("MA", "ZSHC-MA2-STAND", 15),
  ...bindRange("MA", "ZSHC-MA1-STAND", 1, 16, 1),

  // 旧MB“小型维修区”并非新版大型机MB区，改映射至MA1剩余机位。
  ...bindRange("MB", "ZSHC-MA1-STAND", 12, 1, 2),
} satisfies Readonly<Record<string, string>>);
