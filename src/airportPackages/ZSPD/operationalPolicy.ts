import {
  validateAirportOperationsPolicy,
  type AirportOperationsPolicy,
} from "../../domain/airportOperationsPolicy";

export const pudongOperationsPolicy = validateAirportOperationsPolicy({
  schemaVersion: "1.0.0",
  airportIdent: "ZSPD",
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
        activationPolicy: "automatic",
        defaultCompatibleAircraftSizes: ["small", "medium"],
      },
      maintenance: {
        activationPolicy: "automatic",
        defaultCompatibleAircraftSizes: ["small", "medium"],
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
