import type {
  GroundEquipmentCategory,
  SupportBaseId,
} from "./index";

export type ServiceRoadNodeType =
  | "support_base"
  | "service_road"
  | "intersection"
  | "waiting_area";

export type ServiceRoadNode = {
  id: string;
  name: string;
  type: ServiceRoadNodeType;
  x: number;
  y: number;
  baseId: SupportBaseId | null;
  serviceAreaId: string | null;
};

export type ServiceRoadEdgeStatus =
  | "open"
  | "closed"
  | "occupied"
  | "restricted";

export type ServiceRoadEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** 路段长度，单位米；活动机场路网由局部米制坐标自动派生。 */
  distance: number;
  bidirectional: boolean;
  status: ServiceRoadEdgeStatus;
  speedLimit: number;
  requiresClearance: boolean;
  allowedCategories: GroundEquipmentCategory[];
  trafficBlockLengthMeters?: number;
  trafficFlowMode?: "single_lane" | "separated_bidirectional";
  description: string;
};
