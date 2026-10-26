export type ZoneId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type StandStatus = "空闲" | "占用" | "维修预留";

export type AirportZone = {
  id: ZoneId;
  shortName: string;
  name: string;
  description: string;
  anchor: {
    x: number;
    y: number;
  };
};

export type ParkingStand = {
  id: string;
  zoneId: ZoneId;
  x: number;
  y: number;
  heading: number;
  status: StandStatus;
  aircraftId: string | null;
};

export const airportZones: AirportZone[] = [
  {
    id: "A",
    shortName: "A 区",
    name: "A 区 · 西侧指廊",
    description: "西侧指廊，含顶部扇形登机口和两侧近机位。",
    anchor: { x: 37.8, y: 41.5 },
  },
  {
    id: "B",
    shortName: "B 区",
    name: "B 区 · 中左指廊",
    description: "中左侧指廊，含顶部扇形登机口和两侧近机位。",
    anchor: { x: 45.4, y: 41.5 },
  },
  {
    id: "C",
    shortName: "C 区",
    name: "C 区 · 中右指廊",
    description: "中右侧指廊，含顶部扇形登机口和两侧近机位。",
    anchor: { x: 51.8, y: 41.5 },
  },
  {
    id: "D",
    shortName: "D 区",
    name: "D 区 · 东侧上指廊",
    description: "东侧上方横向指廊和纵向指廊两侧近机位。",
    anchor: { x: 60.3, y: 22.8 },
  },
  {
    id: "E",
    shortName: "E 区",
    name: "E 区 · 东侧中指廊",
    description: "东侧中部横向指廊及其近机位。",
    anchor: { x: 56.5, y: 48.3 },
  },
  {
    id: "F",
    shortName: "F 区",
    name: "F 区 · 东侧连接段",
    description: "东侧纵向连接建筑右侧的一排连续登机口。",
    anchor: { x: 56.5, y: 60.0 },
  },
  {
    id: "G",
    shortName: "G 区",
    name: "G 区 · 卫星厅",
    description: "下方独立卫星厅及周边近机位。",
    anchor: { x: 57, y: 71 },
  },
];

type StandDraft = Omit<ParkingStand, "status" | "aircraftId">;

/*
  每个 A/B/C 指廊：
  左侧 3 个 + 右侧 3 个 + 顶部扇形 7 个 = 13 个机位。
*/
function createThreePierStands(
  zoneId: "A" | "B" | "C",
  centerX: number,
): StandDraft[] {
  const stands: StandDraft[] = [];

  // 指廊左右两侧：各 3 个机位
  [29.1, 32.8, 36.5].forEach((y, index) => {
    stands.push({
      id: `${zoneId}-${String(index * 2 + 1).padStart(2, "0")}`,
      zoneId,
      x: centerX - 1.03,
      y,
      heading: 90,
    });

    stands.push({
      id: `${zoneId}-${String(index * 2 + 2).padStart(2, "0")}`,
      zoneId,
      x: centerX + 1.03,
      y,
      heading: -90,
    });
  });

  // 顶部扇形区域：5 个机位
  const fan = [
    { x: centerX - 1.9, y: 25.1, heading: 140 },
    { x: centerX - 0.95, y: 24.25, heading: 160 },
    { x: centerX, y: 23.9, heading: 180 },
    { x: centerX + 0.95, y: 24.25, heading: 200 },
    { x: centerX + 1.9, y: 25.1, heading: 220 },
  ];

  fan.forEach((position, index) => {
    stands.push({
      id: `${zoneId}-${String(index + 7).padStart(2, "0")}`,
      zoneId,
      ...position,
    });
  });

  return stands;
}

const standDrafts: StandDraft[] = [
  ...createThreePierStands("A", 37.8),
  ...createThreePierStands("B", 45.4),
  ...createThreePierStands("C", 51.8),

  // D 区：横向指廊南侧机位
  { id: "D-01", zoneId: "D", x: 57.6, y: 26.1, heading: 180 },
  { id: "D-02", zoneId: "D", x: 58.6, y: 26.1, heading: 180 },
  { id: "D-03", zoneId: "D", x: 59.6, y: 26.1, heading: 180 },
  { id: "D-04", zoneId: "D", x: 60.6, y: 26.1, heading: 180 },
  { id: "D-05", zoneId: "D", x: 61.8, y: 27.2, heading: -90 },

  // D 区：纵向指廊左侧外缘
  { id: "D-06", zoneId: "D", x: 56.55, y: 29.4, heading: 90 },
  { id: "D-07", zoneId: "D", x: 56.55, y: 31.6, heading: 90 },
  { id: "D-08", zoneId: "D", x: 56.55, y: 33.8, heading: 90 },
  { id: "D-09", zoneId: "D", x: 56.55, y: 36.0, heading: 90 },
  { id: "D-10", zoneId: "D", x: 56.55, y: 38.2, heading: 90 },

  // D 区：纵向指廊右侧外缘，进一步向下移动
  { id: "D-11", zoneId: "D", x: 58.0, y: 34.2, heading: -90 },
  { id: "D-12", zoneId: "D", x: 58.0, y: 36.8, heading: -90 },
  { id: "D-13", zoneId: "D", x: 58.0, y: 39.4, heading: -90 },
  { id: "D-14", zoneId: "D", x: 58.0, y: 42.0, heading: -90 },

  // D 区：横向指廊另一侧机位，位于 D-01～D-05 的下方
  // 横坐标严格位于 D-05（63.6）和 D-11（59.25）之间
  { id: "D-15", zoneId: "D", x: 59.0, y: 31.8, heading: 0 },
  { id: "D-16", zoneId: "D", x: 60.1, y: 31.8, heading: 0 },
  { id: "D-17", zoneId: "D", x: 61.2, y: 31.8, heading: 0 },
  { id: "D-18", zoneId: "D", x: 61.8, y: 29.5, heading: 0 },

  // E 区：东侧中指廊
  { id: "E-01", zoneId: "E", x: 58.0, y: 45.8, heading: 180 },
  { id: "E-02", zoneId: "E", x: 59.0, y: 45.8, heading: 180 },
  { id: "E-03", zoneId: "E", x: 60.0, y: 45.8, heading: 180 },
  { id: "E-04", zoneId: "E", x: 61.0, y: 45.8, heading: 180 },
  { id: "E-05", zoneId: "E", x: 61.8, y: 47.7, heading: -90 },
  { id: "E-06", zoneId: "E", x: 61.5, y: 49.9, heading: -90 },
  { id: "E-07", zoneId: "E", x: 60.0, y: 50.6, heading: 0 },
  { id: "E-08", zoneId: "E", x: 59.0, y: 50.6, heading: 0 },

  // F 区：只保留右侧的一排机位
  { id: "F-01", zoneId: "F", x: 58.0, y: 52.8, heading: -90 },
  { id: "F-02", zoneId: "F", x: 58.0, y: 55.5, heading: -90 },
  { id: "F-03", zoneId: "F", x: 58.0, y: 58.2, heading: -90 },
  { id: "F-04", zoneId: "F", x: 58.0, y: 60.9, heading: -90 },
  { id: "F-05", zoneId: "F", x: 58.0, y: 63.6, heading: -90 },
  { id: "F-06", zoneId: "F", x: 58.0, y: 66.3, heading: -90 },
  { id: "F-07", zoneId: "F", x: 58.0, y: 69.0, heading: -90 },

  // G 区：所有飞机机头指向 G 标识中心 x:57、y:71
  { id: "G-01", zoneId: "G", x: 54.85, y: 74.95, heading: -61 },
  { id: "G-02", zoneId: "G", x: 55.89, y: 75.36, heading: -76 },
  { id: "G-03", zoneId: "G", x: 57.0, y: 75.5, heading: -90 },
  { id: "G-04", zoneId: "G", x: 58.11, y: 75.36, heading: -104 },
  { id: "G-05", zoneId: "G", x: 59.15, y: 74.95, heading: -119 },
];

const occupiedStandIds = new Set([
  "A-01",
  "A-07",
  "B-04",
  "C-01",
  "C-07",
  "D-04",
  "E-01",
  "E-04",
  "F-01",
  "F-04",
  "G-01",
]);

const reservedStandIds = new Set([
  "A-11",
  "B-11",
  "C-11",
  "D-10",
  "E-08",
  "F-05",
  "G-05",
]);

const xiaoshanRegularAircraftSerials =
  AIRPORT_FLEET_ALLOCATION.ZSHC.serials.slice(0, 11);
let aircraftIndex = 0;

export const parkingStands: ParkingStand[] = standDrafts.map((stand) => {
  if (occupiedStandIds.has(stand.id)) {
    const aircraftId = `B-${String(
      xiaoshanRegularAircraftSerials[aircraftIndex],
    ).padStart(3, "0")}`;
    aircraftIndex += 1;

    return {
      ...stand,
      status: "占用",
      aircraftId,
    };
  }

  if (reservedStandIds.has(stand.id)) {
    return {
      ...stand,
      status: "维修预留",
      aircraftId: null,
    };
  }

  return {
    ...stand,
    status: "空闲",
    aircraftId: null,
  };
});
import { AIRPORT_FLEET_ALLOCATION } from "../domain/fleetIdentity";

