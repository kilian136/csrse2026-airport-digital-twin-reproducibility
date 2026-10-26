import type {
  AirportCoordinateConverter,
  NormalizedMapCoordinate,
  Wgs84Coordinate,
} from "./affineCoordinateConverter";

export type AirportLocalCoordinate = Readonly<{
  eastMeters: number;
  northMeters: number;
}>;

export type AirportLocalCoordinateOrigin = Readonly<{
  mapCoordinate: NormalizedMapCoordinate;
  wgs84: Wgs84Coordinate;
}>;

export type AirportLocalCoordinateConverter = Readonly<{
  origin: AirportLocalCoordinateOrigin;
  mapToLocal: (
    coordinate: NormalizedMapCoordinate,
  ) => AirportLocalCoordinate;
  localToMap: (
    coordinate: AirportLocalCoordinate,
  ) => NormalizedMapCoordinate;
  wgs84ToLocal: (coordinate: Wgs84Coordinate) => AirportLocalCoordinate;
  localToWgs84: (coordinate: AirportLocalCoordinate) => Wgs84Coordinate;
}>;

const WGS84_SEMI_MAJOR_AXIS_METERS = 6_378_137;
const WGS84_FIRST_ECCENTRICITY_SQUARED = 6.694_379_990_14e-3;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

/**
 * 建立机场范围内使用的局部东—北米制坐标。
 *
 * 原点由底图百分比坐标指定；eastMeters 向东为正，northMeters 向北为正。
 * 计算采用 WGS84 椭球在原点处的局部切平面近似，适用于机场尺度的距离、
 * 速度、间隔和路径计算，不替代测绘级投影坐标。
 */
export function createAirportLocalCoordinateConverter(
  coordinateConverter: AirportCoordinateConverter,
  originMapCoordinate: NormalizedMapCoordinate,
): AirportLocalCoordinateConverter {
  const originWgs84 = coordinateConverter.mapToWgs84(originMapCoordinate);
  const originLatitudeRadians = degreesToRadians(originWgs84.latitude);
  const sineLatitude = Math.sin(originLatitudeRadians);
  const curvatureScale = Math.sqrt(
    1 -
      WGS84_FIRST_ECCENTRICITY_SQUARED *
        sineLatitude *
        sineLatitude,
  );
  const primeVerticalRadius =
    WGS84_SEMI_MAJOR_AXIS_METERS / curvatureScale;
  const meridionalRadius =
    (WGS84_SEMI_MAJOR_AXIS_METERS *
      (1 - WGS84_FIRST_ECCENTRICITY_SQUARED)) /
    curvatureScale ** 3;
  const eastMetersPerRadian =
    primeVerticalRadius * Math.cos(originLatitudeRadians);
  const northMetersPerRadian = meridionalRadius;

  function wgs84ToLocal(
    coordinate: Wgs84Coordinate,
  ): AirportLocalCoordinate {
    return {
      eastMeters:
        degreesToRadians(coordinate.longitude - originWgs84.longitude) *
        eastMetersPerRadian,
      northMeters:
        degreesToRadians(coordinate.latitude - originWgs84.latitude) *
        northMetersPerRadian,
    };
  }

  function localToWgs84(
    coordinate: AirportLocalCoordinate,
  ): Wgs84Coordinate {
    return {
      longitude:
        originWgs84.longitude +
        radiansToDegrees(coordinate.eastMeters / eastMetersPerRadian),
      latitude:
        originWgs84.latitude +
        radiansToDegrees(coordinate.northMeters / northMetersPerRadian),
    };
  }

  return Object.freeze({
    origin: Object.freeze({
      mapCoordinate: Object.freeze({ ...originMapCoordinate }),
      wgs84: Object.freeze({ ...originWgs84 }),
    }),
    mapToLocal(coordinate) {
      return wgs84ToLocal(coordinateConverter.mapToWgs84(coordinate));
    },
    localToMap(coordinate) {
      return coordinateConverter.wgs84ToMap(localToWgs84(coordinate));
    },
    wgs84ToLocal,
    localToWgs84,
  });
}
