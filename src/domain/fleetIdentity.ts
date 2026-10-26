/**
 * 航司级统一机队编号。
 *
 * 机场只保存飞机当前所在位置，不拥有独立编号空间。所有初始机场配置和
 * 跨机场移交都必须使用这一格式，避免同一航司在不同机场生成P/M等孤立机队。
 */
/** 当前实际参与地图运行和72小时仿真的航司机队规模。 */
export const AIRLINE_FLEET_SIZE = 65;

/** 保留既有编号空间，以兼容已经建立的B-056跨机场流程和历史记录。 */
export const AIRLINE_FLEET_ID_CAPACITY = 65;

export function createFleetAircraftId(serial: number) {
  if (
    !Number.isSafeInteger(serial) ||
    serial < 1 ||
    serial > AIRLINE_FLEET_ID_CAPACITY
  ) {
    throw new Error(
      `航司机队序号必须为1至${AIRLINE_FLEET_ID_CAPACITY}的整数，收到${serial}。`,
    );
  }
  return `B-${String(serial).padStart(3, "0")}`;
}

export function isAirlineFleetAircraftId(aircraftId: string) {
  const match = /^B-(\d{3})$/.exec(aircraftId);
  if (!match) return false;
  const serial = Number(match[1]);
  return serial >= 1 && serial <= AIRLINE_FLEET_SIZE;
}

export const FLEET_NUMBERING = Object.freeze({
  xiaoshanRegularStart: 1,
  xiaoshanMaintenanceStart: 12,
  pudongInitialStart: 16,
  nanjingInitialStart: 48,
});

/**
 * 按三机场启用机位规模（ZSHC 125、ZSPD 275、ZSNJ 138）折算并微调。
 * 顺序经过固定打乱：既让初始停放不呈现机械编号块，又保证每次加载可复现。
 * B-056继续留在浦东，兼容已经验收的跨机场流程和历史记录。
 */
export const AIRPORT_FLEET_ALLOCATION = Object.freeze({
  ZSHC: Object.freeze({
    count: 15,
    serials: Object.freeze([7, 1, 12, 4, 10, 3, 15, 6, 9, 2, 5, 14, 8, 13, 11]),
  }),
  ZSPD: Object.freeze({
    count: 33,
    serials: Object.freeze([
      56, 32, 16, 41, 25, 47, 20, 36, 29, 44, 18,
      23, 34, 27, 46, 21, 37, 30, 43, 17, 40, 24,
      35, 28, 45, 19, 38, 22, 33, 26, 42, 31, 39,
    ]),
  }),
  ZSNJ: Object.freeze({
    count: 17,
    serials: Object.freeze([
      61, 48, 65, 52, 58, 50, 63, 54, 59,
      49, 64, 53, 57, 51, 62, 55, 60,
    ]),
  }),
});
