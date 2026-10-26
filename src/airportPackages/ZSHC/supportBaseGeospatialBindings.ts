import type { SupportBaseId } from "../../domain/groundSupport";

/**
 * 已有人工WGS84范围能够可靠承载的保障基地。
 * 其余基地必须等待用户标定，禁止由旧百分比位置反算。
 */
export const xiaoshanSupportBaseGeospatialBindings: Readonly<
  Partial<Record<SupportBaseId, string>>
> = Object.freeze({
  "GSE-W": "ZSHC-MAINTENANCE-DEPARTMENT",
  "GSE-C": "ZSHC-SUPPORT-BASE-GSE-C",
  "GSE-E": "ZSHC-SUPPORT-BASE-GSE-E",
  FUEL: "ZSHC-SUPPORT-BASE-FUEL",
  ARFF: "ZSHC-SUPPORT-BASE-ARFF",
});
