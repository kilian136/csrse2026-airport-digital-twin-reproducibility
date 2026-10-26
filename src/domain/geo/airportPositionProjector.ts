import type { AirportGeoreferencedPoint } from "../../types/airport";
import type {
  AirportCoordinateConverter,
  NormalizedMapCoordinate,
  Wgs84Coordinate,
} from "./affineCoordinateConverter";
import type { AirportLocalCoordinateConverter } from "./localCoordinateConverter";
import type { AirportLocalCoordinate } from "./localCoordinateConverter";
import {
  createAirportOperationalPosition,
  type OperationalPositionAuthority,
} from "./operationalPosition";

export type AirportPositionProjector = Readonly<{
  projectMapPoint: (
    coordinate: NormalizedMapCoordinate,
  ) => AirportGeoreferencedPoint;
  projectWgs84: (
    coordinate: Wgs84Coordinate,
    authority?: Exclude<OperationalPositionAuthority, "legacy_projection">,
  ) => AirportGeoreferencedPoint;
  projectLocal: (
    coordinate: AirportLocalCoordinate,
    authority?: Exclude<OperationalPositionAuthority, "legacy_projection">,
  ) => AirportGeoreferencedPoint;
}>;

/** 将一个底图点一次性投影为百分比、WGS84和局部米制坐标。 */
export function createAirportPositionProjector(
  coordinateConverter: AirportCoordinateConverter,
  localCoordinateConverter: AirportLocalCoordinateConverter,
): AirportPositionProjector {
  return Object.freeze({
    projectMapPoint(coordinate) {
      const wgs84 = coordinateConverter.mapToWgs84(coordinate);
      const local = localCoordinateConverter.mapToLocal(coordinate);
      return {
        x: coordinate.x,
        y: coordinate.y,
        latitude: wgs84.latitude,
        longitude: wgs84.longitude,
        eastMeters: local.eastMeters,
        northMeters: local.northMeters,
        operationalPosition: createAirportOperationalPosition({
          longitude: wgs84.longitude,
          latitude: wgs84.latitude,
          eastMeters: local.eastMeters,
          northMeters: local.northMeters,
          authority: "legacy_projection",
        }),
      };
    },
    projectWgs84(coordinate, authority = "local_simulation") {
      const map = coordinateConverter.wgs84ToMap(coordinate);
      const local = localCoordinateConverter.wgs84ToLocal(coordinate);
      return {
        x: map.x,
        y: map.y,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        eastMeters: local.eastMeters,
        northMeters: local.northMeters,
        operationalPosition: createAirportOperationalPosition({
          longitude: coordinate.longitude,
          latitude: coordinate.latitude,
          eastMeters: local.eastMeters,
          northMeters: local.northMeters,
          authority,
        }),
      };
    },
    projectLocal(coordinate, authority = "local_simulation") {
      const wgs84 = localCoordinateConverter.localToWgs84(coordinate);
      const map = coordinateConverter.wgs84ToMap(wgs84);
      return {
        x: map.x,
        y: map.y,
        latitude: wgs84.latitude,
        longitude: wgs84.longitude,
        eastMeters: coordinate.eastMeters,
        northMeters: coordinate.northMeters,
        operationalPosition: createAirportOperationalPosition({
          longitude: wgs84.longitude,
          latitude: wgs84.latitude,
          eastMeters: coordinate.eastMeters,
          northMeters: coordinate.northMeters,
          authority,
        }),
      };
    },
  });
}
