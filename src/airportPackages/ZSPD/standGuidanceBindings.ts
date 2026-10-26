/**
 * 浦东T1-A北端两座相邻机位的人工语义绑定。
 * G01对应OSM 64号引导线，G02对应62号引导线；运行内核不得按全局最近距离串位。
 */
export const pudongStandGuidanceBindings = Object.freeze({
  "ZSPD-T1-A-GATE-01": Object.freeze(["64"]),
  "ZSPD-T1-A-GATE-02": Object.freeze(["62"]),
} satisfies Readonly<Partial<Record<string, readonly string[]>>>);
