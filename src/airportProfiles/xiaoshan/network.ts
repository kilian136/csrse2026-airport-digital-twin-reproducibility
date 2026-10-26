import {
  AIRPORT_NETWORK_VERSION,
  restrictedZones,
  taxiEdges,
  taxiNodes,
} from "../../data/airportNetwork";
import {
  serviceRoadEdges,
  serviceRoadNodes,
  supportAreaWaitingNodeIds,
  supportBaseNodeIds,
} from "../../data/serviceRoadNetwork";
import type { AirportOperationsNetwork } from "../types";

/** 不含图片和界面的萧山机场运行路网，可供Reducer、规划器和Node测试使用。 */
export const xiaoshanOperationsNetwork = {
  routing: {
    zoneExitNodeIds: {
      A: "A-EXIT",
      B: "B-EXIT",
      C: "C-EXIT",
      D: "D-EXIT",
      E: "E-EXIT",
      F: "F-EXIT",
      G: "G-EXIT",
    },
    maintenanceEntryNodeIds: {
      MA: "MA-EXIT",
      MB: "MB-EXIT",
    },
    runwayEntryNodeIds: {
      "RWY-NORTH": {
        W: "RWY-N-ENTRY-W",
        E: "RWY-N-ENTRY-E",
      },
      "RWY-SOUTH": {
        W: "RWY-S-ENTRY-W",
        E: "RWY-S-ENTRY-E",
      },
    },
  },
  taxiNetwork: {
    version: AIRPORT_NETWORK_VERSION,
    runways: [
      {
        id: "RWY-NORTH",
        name: "北跑道",
        restrictedZoneId: "RUNWAY-NORTH-RESTRICTED",
        westHoldingNodeId: "RWY-N-HOLD-W",
        eastHoldingNodeId: "RWY-N-HOLD-E",
        westEntryNodeId: "RWY-N-ENTRY-W",
        eastEntryNodeId: "RWY-N-ENTRY-E",
      },
      {
        id: "RWY-SOUTH",
        name: "南跑道",
        restrictedZoneId: "RUNWAY-SOUTH-RESTRICTED",
        westHoldingNodeId: "RWY-S-HOLD-W",
        eastHoldingNodeId: "RWY-S-HOLD-E",
        westEntryNodeId: "RWY-S-ENTRY-W",
        eastEntryNodeId: "RWY-S-ENTRY-E",
      },
    ],
    nodes: taxiNodes,
    edges: taxiEdges,
    restrictedZones,
  },
  serviceRoadNetwork: {
    nodes: serviceRoadNodes,
    edges: serviceRoadEdges,
    supportBaseNodeIds,
    supportAreaWaitingNodeIds,
  },
} satisfies AirportOperationsNetwork;
