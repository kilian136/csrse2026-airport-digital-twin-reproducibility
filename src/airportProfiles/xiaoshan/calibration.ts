import {
  createAffineCoordinateConverter,
  createAirportLocalCoordinateConverter,
  type GeoCalibrationPoint,
} from "../../domain/geo";

/**
 * 萧山机场底图人工控制点。
 * 当前六个点覆盖底图中部、左下、右上和右下区域，用于初步仿射转换和继续采点，
 * 不能作为测绘成果。
 */
export const xiaoshanGeoCalibrationPoints = [
  {
    id: "ZSHC-CAL-001",
    name: "点一",
    mapCoordinate: { x: 10.96, y: 29.09 },
    wgs84: {
      latitude: 30.2313327,
      longitude: 120.4056301,
    },
  },
  {
    id: "ZSHC-CAL-002",
    name: "点二",
    mapCoordinate: { x: 47.73, y: 64.07 },
    wgs84: {
      latitude: 30.234111111111,
      longitude: 120.428861111111,
    },
  },
  {
    id: "ZSHC-CAL-003",
    name: "点三",
    mapCoordinate: { x: 50.34, y: 64.89 },
    wgs84: {
      latitude: 30.234666666667,
      longitude: 120.430333333333,
    },
  },
  {
    id: "ZSHC-CAL-004",
    name: "点四",
    mapCoordinate: { x: 20.45, y: 82.66 },
    wgs84: {
      latitude: 30.2245013,
      longitude: 120.4162369,
    },
  },
  {
    id: "ZSHC-CAL-005",
    name: "点五",
    mapCoordinate: { x: 81.53, y: 2.57 },
    wgs84: {
      latitude: 30.2525736,
      longitude: 120.4407375,
    },
  },
  {
    id: "ZSHC-CAL-006",
    name: "点六",
    mapCoordinate: { x: 68.98, y: 70.8 },
    wgs84: {
      latitude: 30.2380849,
      longitude: 120.4408537,
    },
  },
] as const satisfies readonly GeoCalibrationPoint[];

/**
 * 不参与转换器拟合的独立验证点，用于防止后续调整导致精度回退。
 */
export const xiaoshanGeoValidationPoints = [
  {
    id: "ZSHC-VAL-002",
    name: "验证点二",
    mapCoordinate: { x: 43.94, y: 54.67 },
    wgs84: {
      latitude: 30.2348584,
      longitude: 120.4258578,
    },
  },
  {
    id: "ZSHC-VAL-003",
    name: "验证点三",
    mapCoordinate: { x: 75.63, y: 82.62 },
    wgs84: {
      latitude: 30.2376983,
      longitude: 120.4455858,
    },
  },
] as const satisfies readonly GeoCalibrationPoint[];

export const xiaoshanCoordinateConverter =
  createAffineCoordinateConverter(xiaoshanGeoCalibrationPoints);

export const xiaoshanLocalCoordinateOrigin = {
  x: 50,
  y: 50,
} as const;

export const xiaoshanLocalCoordinateConverter =
  createAirportLocalCoordinateConverter(
    xiaoshanCoordinateConverter,
    xiaoshanLocalCoordinateOrigin,
  );
