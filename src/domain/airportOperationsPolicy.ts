export type AircraftSizeCategory = "small" | "medium" | "large";

export type AirportStandOperationalRole =
  | "passenger_gate"
  | "remote_passenger"
  | "cargo"
  | "maintenance";

export type AirportStandDispatchMission =
  | "passenger_arrival"
  | "remote_parking"
  | "cargo_arrival"
  | "maintenance_transfer";

export type AirportStandMovementMode = "taxi" | "tow" | "service_vehicle";

export type AirportOperationsPolicy = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  standDispatch: Readonly<{
    roles: Readonly<
      Record<
        AirportStandOperationalRole,
        Readonly<{
          activationPolicy: "automatic" | "manual_or_overflow";
          defaultCompatibleAircraftSizes: readonly AircraftSizeCategory[];
        }>
      >
    >;
    missions: Readonly<
      Record<
        AirportStandDispatchMission,
        Readonly<{
          primaryRole: AirportStandOperationalRole;
          overflowRoles: readonly AirportStandOperationalRole[];
          requiredMovementMode: "taxi" | "tow";
        }>
      >
    >;
  }>;
}>;

export function validateAirportOperationsPolicy(
  policy: AirportOperationsPolicy,
) {
  if (policy.schemaVersion !== "1.0.0" || !policy.airportIdent.trim()) {
    throw new Error("机场运行策略契约无效。");
  }
  const roles: readonly AirportStandOperationalRole[] = [
    "passenger_gate",
    "remote_passenger",
    "cargo",
    "maintenance",
  ];
  roles.forEach((role) => {
    const rolePolicy = policy.standDispatch.roles[role];
    if (!rolePolicy || rolePolicy.defaultCompatibleAircraftSizes.length === 0) {
      throw new Error(`${policy.airportIdent}缺少${role}机位策略。`);
    }
  });
  const missions: readonly AirportStandDispatchMission[] = [
    "passenger_arrival",
    "remote_parking",
    "cargo_arrival",
    "maintenance_transfer",
  ];
  missions.forEach((mission) => {
    if (!policy.standDispatch.missions[mission]) {
      throw new Error(`${policy.airportIdent}缺少${mission}任务策略。`);
    }
  });
  return policy;
}
