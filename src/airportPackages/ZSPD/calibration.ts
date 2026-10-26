import {
  createAffineCoordinateConverter,
  createAirportLocalCoordinateConverter,
} from "../../domain/geo";

/**
 * 浦东浏览包没有旧PS底图。这里的0–100坐标只对应OSM快照经纬度边界，
 * 用于满足现有只读适配器的兼容接口；机场详情、路网和设施均以WGS84为准。
 */
export const pudongCoordinateConverter = createAffineCoordinateConverter([
  {
    id: "ZSPD-BOUND-NW",
    name: "OSM快照西北角",
    mapCoordinate: { x: 0, y: 0 },
    wgs84: { latitude: 31.201790226374417, longitude: 121.73677720242576 },
  },
  {
    id: "ZSPD-BOUND-NE",
    name: "OSM快照东北角",
    mapCoordinate: { x: 100, y: 0 },
    wgs84: { latitude: 31.201790226374417, longitude: 121.87322279757426 },
  },
  {
    id: "ZSPD-BOUND-SW",
    name: "OSM快照西南角",
    mapCoordinate: { x: 0, y: 100 },
    wgs84: { latitude: 31.085009773625583, longitude: 121.73677720242576 },
  },
]);

export const pudongLocalCoordinateConverter =
  createAirportLocalCoordinateConverter(pudongCoordinateConverter, {
    x: 50,
    y: 50,
  });
