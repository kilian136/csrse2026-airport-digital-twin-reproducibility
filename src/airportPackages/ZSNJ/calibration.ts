import {
  createAffineCoordinateConverter,
  createAirportLocalCoordinateConverter,
} from "../../domain/geo";

/** 南京只读快照的兼容投影边界；所有标定数据仍以WGS84为准。 */
export const nanjingCoordinateConverter = createAffineCoordinateConverter([
  {
    id: "ZSNJ-BOUND-NW",
    name: "OSM快照西北角",
    mapCoordinate: { x: 0, y: 0 },
    wgs84: { latitude: 31.800390226374418, longitude: 118.79334000176745 },
  },
  {
    id: "ZSNJ-BOUND-NE",
    name: "OSM快照东北角",
    mapCoordinate: { x: 100, y: 0 },
    wgs84: { latitude: 31.800390226374418, longitude: 118.93065999823254 },
  },
  {
    id: "ZSNJ-BOUND-SW",
    name: "OSM快照西南角",
    mapCoordinate: { x: 0, y: 100 },
    wgs84: { latitude: 31.683609773625584, longitude: 118.79334000176745 },
  },
]);

export const nanjingLocalCoordinateConverter =
  createAirportLocalCoordinateConverter(nanjingCoordinateConverter, {
    x: 50,
    y: 50,
  });
