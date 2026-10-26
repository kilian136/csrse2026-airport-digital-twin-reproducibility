export type NormalizedMapCoordinate = Readonly<{
  x: number;
  y: number;
}>;

export type Wgs84Coordinate = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type GeoCalibrationPoint = Readonly<{
  id: string;
  name: string;
  mapCoordinate: NormalizedMapCoordinate;
  wgs84: Wgs84Coordinate;
}>;

export type AirportCoordinateConverter = Readonly<{
  mapToWgs84: (coordinate: NormalizedMapCoordinate) => Wgs84Coordinate;
  wgs84ToMap: (coordinate: Wgs84Coordinate) => NormalizedMapCoordinate;
}>;

type AffineCoefficients = Readonly<{
  x: number;
  y: number;
  offset: number;
}>;

function solveThreeByThree(
  sourceMatrix: readonly (readonly number[])[],
  sourceVector: readonly number[],
): [number, number, number] {
  const augmented = sourceMatrix.map((row, rowIndex) => [
    ...row,
    sourceVector[rowIndex],
  ]);

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let bestRowIndex = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < 3; rowIndex += 1) {
      if (
        Math.abs(augmented[rowIndex][pivotIndex]) >
        Math.abs(augmented[bestRowIndex][pivotIndex])
      ) {
        bestRowIndex = rowIndex;
      }
    }

    [augmented[pivotIndex], augmented[bestRowIndex]] = [
      augmented[bestRowIndex],
      augmented[pivotIndex],
    ];

    const pivot = augmented[pivotIndex][pivotIndex];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("坐标标定点共线或过于接近，无法建立仿射转换。");
    }

    for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;
      const factor = augmented[rowIndex][pivotIndex];
      for (
        let columnIndex = pivotIndex;
        columnIndex < 4;
        columnIndex += 1
      ) {
        augmented[rowIndex][columnIndex] -=
          factor * augmented[pivotIndex][columnIndex];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

function fitAffineCoefficients(
  points: readonly GeoCalibrationPoint[],
  selectValue: (point: GeoCalibrationPoint) => number,
): AffineCoefficients {
  const normalMatrix = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const normalVector = [0, 0, 0];

  points.forEach((point) => {
    const row = [point.mapCoordinate.x, point.mapCoordinate.y, 1];
    const value = selectValue(point);
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      normalVector[rowIndex] += row[rowIndex] * value;
      for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
        normalMatrix[rowIndex][columnIndex] +=
          row[rowIndex] * row[columnIndex];
      }
    }
  });

  const [x, y, offset] = solveThreeByThree(normalMatrix, normalVector);
  return { x, y, offset };
}

/**
 * 通过至少三个不共线控制点建立二维仿射转换。
 * 三个点时精确通过控制点；增加点后自动采用最小二乘拟合。
 */
export function createAffineCoordinateConverter(
  points: readonly GeoCalibrationPoint[],
): AirportCoordinateConverter {
  if (points.length < 3) {
    throw new Error("建立仿射坐标转换至少需要三个控制点。");
  }

  const longitude = fitAffineCoefficients(
    points,
    (point) => point.wgs84.longitude,
  );
  const latitude = fitAffineCoefficients(
    points,
    (point) => point.wgs84.latitude,
  );
  const determinant = longitude.x * latitude.y - longitude.y * latitude.x;

  if (Math.abs(determinant) < 1e-12) {
    throw new Error("经纬度转换矩阵不可逆，请检查控制点数据。");
  }

  return Object.freeze({
    mapToWgs84(coordinate) {
      return {
        longitude:
          longitude.x * coordinate.x +
          longitude.y * coordinate.y +
          longitude.offset,
        latitude:
          latitude.x * coordinate.x +
          latitude.y * coordinate.y +
          latitude.offset,
      };
    },
    wgs84ToMap(coordinate) {
      const longitudeDelta = coordinate.longitude - longitude.offset;
      const latitudeDelta = coordinate.latitude - latitude.offset;
      return {
        x:
          (longitudeDelta * latitude.y -
            longitude.y * latitudeDelta) /
          determinant,
        y:
          (longitude.x * latitudeDelta -
            latitude.x * longitudeDelta) /
          determinant,
      };
    },
  });
}
