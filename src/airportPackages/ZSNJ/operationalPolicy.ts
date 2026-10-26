import {
  validateAirportOperationsPolicy,
  type AirportOperationsPolicy,
} from "../../domain/airportOperationsPolicy";

/** 南京受控运行的统一机位分配策略。 */
export const nanjingOperationsPolicy = validateAirportOperationsPolicy({
  schemaVersion: "1.0.0",
  airportIdent: "ZSNJ",
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
        defaultCompatibleAircraftSizes: ["small", "medium", "large"],
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
