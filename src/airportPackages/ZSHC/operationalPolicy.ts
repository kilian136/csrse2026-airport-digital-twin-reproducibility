import {
  validateAirportOperationsPolicy,
  type AirportOperationsPolicy,
} from "../../domain/airportOperationsPolicy";

/** 萧山当前策略；机场专属机位与资源编号仍由ZSHC配置包提供。 */
export const xiaoshanOperationsPolicy = validateAirportOperationsPolicy({
  schemaVersion: "1.0.0",
  airportIdent: "ZSHC",
  standDispatch: {
    roles: {
      passenger_gate: {
        activationPolicy: "automatic",
        defaultCompatibleAircraftSizes: ["small", "medium", "large"],
      },
      remote_passenger: {
        activationPolicy: "manual_or_overflow",
        defaultCompatibleAircraftSizes: ["small", "medium", "large"],
      },
      cargo: {
        activationPolicy: "manual_or_overflow",
        defaultCompatibleAircraftSizes: ["small", "medium"],
      },
      maintenance: {
        activationPolicy: "automatic",
        defaultCompatibleAircraftSizes: ["small", "medium", "large"],
      },
    },
    missions: {
      passenger_arrival: {
        primaryRole: "passenger_gate",
        overflowRoles: ["remote_passenger"],
        requiredMovementMode: "taxi",
      },
      remote_parking: {
        primaryRole: "remote_passenger",
        overflowRoles: [],
        requiredMovementMode: "taxi",
      },
      cargo_arrival: {
        primaryRole: "cargo",
        overflowRoles: [],
        requiredMovementMode: "taxi",
      },
      maintenance_transfer: {
        primaryRole: "maintenance",
        overflowRoles: [],
        requiredMovementMode: "tow",
      },
    },
  },
} satisfies AirportOperationsPolicy);
