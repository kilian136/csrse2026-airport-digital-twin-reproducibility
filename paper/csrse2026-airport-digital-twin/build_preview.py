from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak,
)


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output" / "pdf" / "csrse2026_airport_digital_twin_en.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE = (155 * mm, 235 * mm)
LEFT = 16.5 * mm
RIGHT = 16.5 * mm
TOP = 18 * mm
BOTTOM = 18 * mm


class PaperDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=PAGE,
            leftMargin=LEFT,
            rightMargin=RIGHT,
            topMargin=TOP,
            bottomMargin=BOTTOM,
            title="A Deterministic and Auditable 72-Hour Multi-Airport Digital-Twin Simulation Framework",
            author="Kilian Sui",
        )
        frame = Frame(LEFT, BOTTOM, PAGE[0] - LEFT - RIGHT, PAGE[1] - TOP - BOTTOM, id="body")
        self.addPageTemplates(PageTemplate(id="paper", frames=[frame], onPage=self._decorate))

    @staticmethod
    def _decorate(canvas, doc):
        canvas.saveState()
        canvas.setFont("Times-Roman", 8)
        canvas.setFillColor(colors.HexColor("#555555"))
        if doc.page > 1:
            canvas.drawString(LEFT, PAGE[1] - 11 * mm, "K. Sui")
            canvas.drawRightString(PAGE[0] - RIGHT, PAGE[1] - 11 * mm, "Auditable Multi-Airport Digital-Twin Simulation")
        canvas.drawCentredString(PAGE[0] / 2, 9 * mm, str(doc.page))
        canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="PaperTitle", parent=styles["Title"], fontName="Times-Bold", fontSize=16,
    leading=18.5, alignment=TA_CENTER, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="PaperAuthor", parent=styles["Normal"], fontName="Times-Roman", fontSize=10,
    leading=12, alignment=TA_CENTER, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="PaperAbstract", parent=styles["Normal"], fontName="Times-Roman", fontSize=9,
    leading=10.8, alignment=TA_JUSTIFY, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="PaperH1", parent=styles["Heading1"], fontName="Times-Bold", fontSize=12,
    leading=14, spaceBefore=8, spaceAfter=4, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="PaperH2", parent=styles["Heading2"], fontName="Times-Bold", fontSize=10.5,
    leading=12.5, spaceBefore=6, spaceAfter=3, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="PaperBody", parent=styles["BodyText"], fontName="Times-Roman", fontSize=9.3,
    leading=11.2, alignment=TA_JUSTIFY, firstLineIndent=4 * mm, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="PaperNoIndent", parent=styles["PaperBody"], firstLineIndent=0,
))
styles.add(ParagraphStyle(
    name="PaperSmall", parent=styles["PaperBody"], fontSize=8.2, leading=9.7, firstLineIndent=0,
))
styles.add(ParagraphStyle(
    name="PaperCaption", parent=styles["Normal"], fontName="Times-Roman", fontSize=8.2,
    leading=9.5, alignment=TA_CENTER, spaceBefore=3, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="PaperRef", parent=styles["Normal"], fontName="Times-Roman", fontSize=8,
    leading=9.5, leftIndent=5 * mm, firstLineIndent=-5 * mm, spaceAfter=2,
))


def p(text, style="PaperBody"):
    return Paragraph(text, styles[style])


story = []
story += [
    p("A Deterministic and Auditable 72-Hour Multi-Airport Digital-Twin Simulation Framework for Operational Disruption Experiments", "PaperTitle"),
    p("Kilian Sui", "PaperAuthor"),
    p("Affiliation to be confirmed for submission<br/>Corresponding email to be confirmed", "PaperAuthor"),
    Spacer(1, 3),
    p("<b>Abstract.</b> Airport digital twins are increasingly used for visualization and operational decision support, yet many implementations provide limited evidence on repeatability, rule compliance, and disturbance-isolation capability. This paper presents a deterministic and auditable 72-hour multi-airport simulation framework for a unified airline fleet operating across Hangzhou Xiaoshan, Shanghai Pudong, and Nanjing Lukou airports. The framework combines a frozen scenario snapshot, seed-controlled task generation, resource-constrained discrete-event execution, explicit runway, stand, aircraft, and ground-support constraints, transition guards, invariant audits, and event-log replay fingerprints. A paired five-condition experiment is conducted under normal operation, severe low visibility, temporary runway closure, ground-support-equipment outage, and combined disruption. Twenty seeds (42-61) yield 100 formal runs for a 65-aircraft fleet and approximately 320 missions per run. All runs satisfy the current operational-validity gates and the first seed is deterministically replayed. Relative to normal operation, weather restrictions increase mean resource waiting time by 6.49 h, equipment outages by 41.93 h, and combined disruptions by 59.50 h. Runway closure triggers an average of 66.15 runway reassignments without increasing aggregate resource waiting in the tested capacity regime. The contribution is a reproducible experimental substrate for subsequent multi-agent scheduling and resilience studies, rather than a claim of real-airport predictive validity.", "PaperAbstract"),
    p("<b>Keywords:</b> Airport digital twin; discrete-event simulation; operational disruption; deterministic replay; verification and validation; ground support equipment.", "PaperAbstract"),
]

story += [p("1 Introduction", "PaperH1")]
story += [
    p("Airports are tightly coupled sociotechnical systems in which aircraft rotations, runway movements, stands, maintenance activities, and mobile ground-support resources interact under strict temporal and safety constraints. A local shortage or disruption may propagate through successive missions and across airports. Digital-twin research has therefore moved beyond asset visualization toward operational monitoring, simulation, and decision support. Conde et al. proposed an airport digital-twin conceptualization and data model for turnaround-event management [1]. Postorino et al. used discrete-event simulation to evaluate how airside disruptions propagate across landing, take-off, and turnaround processes [2]. These studies demonstrate the value of integrated operational models, but reproducibility and explicit software-level rule auditing are not always treated as first-class experimental outputs."),
    p("A second gap concerns credibility. Wright and Davidson warn that vague use of the term digital twin can blur the distinction between a model and a dynamically updated twin [6]. Bitencourt et al. reported that relatively few digital-twin studies perform both verification and validation using a structured procedure [7]. For simulation-based reliability research, a result should not only be numerically plausible; it should also be traceable to a versioned input, repeatable under controlled randomness, and rejected when operational invariants are violated."),
    p("This paper develops a 72-hour, three-airport operational simulation framework with deterministic replay and automated rule auditing. Four questions are studied: whether the scenario produces complete, rule-compliant and replayable traces; how isolated weather, runway, and equipment disruptions affect delay and reassignment; whether combined disruption is stronger than individual disruptions; and which modeled resource is the dominant bottleneck."),
    p("The contributions are: (1) a unified three-airport scenario contract for one airline fleet; (2) deterministic event execution and replay auditing; (3) invariant and transition-guard checks coupled to every run; and (4) a paired multi-seed experiment with confidence intervals and standardized within-seed effects."),
    p("The practical difficulty is not merely to animate aircraft. A credible experiment must keep aircraft rotations, stand occupancy, runway separation, maintenance state, and heterogeneous ground-service resources mutually consistent for the entire horizon. A visually plausible trace may still contain an impossible transition. Conversely, a disruption may trigger valid substitution but no aggregate delay when spare capacity exists. Exposure, response mechanism, performance loss, and recovery must therefore be recorded separately [10]."),
    p("This distinction matters before learning or multi-agent control is introduced. An optimizer can exploit an incorrect transition, an unbounded resource, or an inconsistent reset rule and still report an apparently superior objective. The simulator must first act as an executable operational contract within which policies may change assignments and timing but may not bypass physical and lifecycle constraints."),
]

story += [p("2 Related Work", "PaperH1"), p("2.1 Airport Digital Twins and Operational Simulation", "PaperH2")]
story += [
    p("Airport digital-twin work covers information integration, turnaround management, air-traffic visualization, and resource optimization. Conde et al. connected heterogeneous airport information through a FIWARE-based architecture [1]. Chen et al. investigated a tangible mixed-reality digital twin for collaborative air-traffic-management operations [5]. Those studies strengthen visualization and situational awareness; the present study instead emphasizes repeatable experiment execution and machine-checkable operational traces."),
    p("Disruption modeling has also received sustained attention. Postorino et al. integrated landing and take-off processes with turnaround activities to capture knock-on effects [2]. Ground handling is sensitive to scarce mobile resources. Saggar et al. proposed a real-time booking mechanism for ground-support equipment under uncertainty [3], while Sahadevan et al. combined arrival-time prediction with allocation of limited ground resources [4]. These findings motivate explicit ground-support capacity rather than an exogenous turnaround-delay scalar."),
    p("2.2 Digital-Twin Credibility and Reproducibility", "PaperH2"),
    p("Digital twins integrate models, data, and decision processes, but terminology and validation practice remain inconsistent. Fuller et al. surveyed enabling technologies and open challenges [8]. Wright and Davidson identify a physical entity, evolving data, and dynamic model updating as distinguishing elements of a twin [6]. Bitencourt et al. highlighted the scarcity of structured verification and validation practice [7]. This work separates software verification from empirical validation. Replay, invariants, and transition guards support internal credibility; real operational calibration remains future work."),
    p("The broader literature describes a progression from digital models and shadows toward synchronized, lifecycle-connected representations. Jones et al. showed that inconsistent terminology complicates comparison between implementations [9]. We therefore use the term digital-twin simulation framework conservatively: the system shares operational entities, maps, resources, state transitions, and scenario execution, but is not yet continuously synchronized with live airport feeds."),
    p("2.3 Ground Handling, Resilience, and Reproducibility", "PaperH2"),
    p("Ground handling combines scarce mobile resources with precedence and compatibility constraints. Tabares et al. formulated online fleet assignment for automated ground handling [12]; Zhu et al. considered cooperative vehicle scheduling under flight-time uncertainty [13]; Zhang et al. represented heterogeneous flights, operators, temporal restrictions, and service patterns [14]; and Yao et al. coupled stand allocation with support-vehicle scheduling [15]. These works offer capable schedulers, whereas this study constructs the controlled execution and evidence layer on which competing schedulers can later be compared."),
    p("Network-scale studies show that delay propagation depends jointly on topology and airport performance [11]. Classical computer-experiment design requires documented inputs rather than isolated executions [19]. Common random numbers support paired comparison [16], seed preservation enables exact reruns [17], and transparent deterministic computation supports reproducibility [18]. Trace alignment offers a route toward physical-digital fidelity assessment [20]."),
]

story += [p("3 Framework Design", "PaperH1"), p("3.1 Scenario Contract", "PaperH2")]
story += [
    p("Let A denote airports, F the airline fleet, R the runways, S compatible stands, and G the available ground-support resources. A mission is an ordered chain of release, pushback, taxi-out, take-off, cruise, landing, taxi-in, service, and completion. An event contains simulation time, priority, a deterministic sequence key, mission identity, and payload; lexicographic ordering eliminates implementation-dependent ordering when timestamps coincide."),
    p("The simulation accepts a frozen scenario snapshot containing three airports, a single 65-aircraft fleet, aircraft health attributes, stands, runway profiles, ground-support vehicles, and route resources. Each run covers 72 hours. The default planner limits each aircraft to five missions, uses a simulated fault probability of 0.025 and emergency probability of 0.01, enforces 180-s runway separation, assumes 30-min ground-support service, and permits six parallel support teams."),
    p("Every mission references one aircraft, origin and destination airports, departure and arrival resources, and an operational event sequence. The same snapshot and seed generate the same base mission population before experimental disturbances are applied."),
    p("The snapshot is immutable during a batch and carries an identifier derived from serialized content. Disturbances are separate adapters that overlay capacity multipliers, closure intervals, or availability masks. Generated artifacts retain snapshot, scenario, seed, simulator version, and parameter identifiers, preventing state leakage between conditions."),
    p("3.2 Resource-Constrained Execution", "PaperH2"),
    p("A discrete-event engine orders events by simulation time and deterministic tie-breaking keys. Runway, stand, aircraft, maintenance, and ground-support availability are explicit constraints. When a requested resource is unavailable, the engine may reassign a compatible resource or delay the dependent event. A state transition is committed only after its guard rules pass. Intended and realized assignments are both retained, so exposure and response can be distinguished."),
    p("Resource acquisition is atomic at event level. If all required resources are feasible, reservations are committed; otherwise the event is rescheduled to the earliest deterministic release and waiting is attributed to the responsible category. Compatibility is evaluated before proximity, so a near but infeasible stand or runway can never be selected merely to reduce travel distance."),
    p("3.3 Audit and Replay Layers", "PaperH2"),
    p("Each run passes three credibility gates: end-to-end acceptance checks complete mission chains; invariant auditing checks resource exclusivity, state consistency and accounting identities; transition guarding rejects lifecycle violations. For deterministic replay, the same input and seed are executed twice. Ordered event logs are reduced to versioned checkpoints and a fingerprint. Replay passes only when event sequence, checkpoint states and final metrics agree."),
    p("The principal invariants require one mutually exclusive aircraft location, no overlapping reservation of capacity-one resources, use of open and compatible runways, use of compatible stands at the current airport, legal lifecycle transitions, and equality between summary counts and event-log reconstruction. A violation invalidates a run rather than merely issuing a warning."),
]

story += [p("4 Experimental Method", "PaperH1"), p("4.1 Paired Design", "PaperH2")]
story += [p("Four hypotheses are evaluated. H1 requires every formal run to satisfy acceptance, invariant, and transition gates. H2 requires each disturbance adapter to activate its intended mechanism indicator. H3 predicts that weather and equipment outage increase waiting relative to paired baselines. H4 predicts that the combined condition produces the largest degradation. No directional delay hypothesis is imposed on runway closure because compatible spare capacity may absorb it.")]
conditions = [
    [p("Condition", "PaperSmall"), p("Disturbance definition", "PaperSmall")],
    [p("Baseline", "PaperSmall"), p("No injected weather, runway, or external equipment disruption.", "PaperSmall")],
    [p("Weather only", "PaperSmall"), p("Severe low visibility at all airports from hour 0 to 18; runway-capacity factor 0.60 and ground-speed factor 0.65.", "PaperSmall")],
    [p("Runway closure", "PaperSmall"), p("Shorter formal runway at each airport closed from hour 4 to 14 for inspection.", "PaperSmall")],
    [p("Equipment outage", "PaperSmall"), p("First available unit in each support category at each airport unavailable from hour 0 to 14.", "PaperSmall")],
    [p("Combined", "PaperSmall"), p("Weather, runway closure, and equipment outage occur together.", "PaperSmall")],
]
table = Table(conditions, colWidths=[32 * mm, 88 * mm], repeatRows=1)
table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EDF3")),
    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#777777")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [KeepTogether([p("Table 1. Experimental conditions.", "PaperCaption"), table]), Spacer(1, 4)]
story += [
    p("Twenty seeds (42-61) are used. Within each seed, all five conditions share the same snapshot, planning parameters, and base task-generation randomness. Differences from baseline are paired within seed. The experiment contains 100 formal runs. Seed 42 is additionally repeated for deterministic replay and replay runs are not counted as independent samples."),
    p("The same random stream controls task generation and stochastic health events within a seed. Disturbance adapters are deterministic functions of scenario and time. Thus paired differences primarily reflect the declared disturbance rather than a different mission population; seeds are replications, while conditions within a seed are not independent observations."),
    p("4.2 Measures and Analysis", "PaperH2"),
    p("Primary outcomes are mission completion rate, operational delay rate, total resource waiting hours, average and 95th-percentile resource wait, and fleet utilization. Mechanism indicators include weather-affected missions, runway reassignments, and equipment reassignments. A run is valid only when acceptance is accepted, invariant status is passed, and transition-guard status is passed."),
    p("For outcome <i>y</i>, the within-seed effect is <i>d</i><sub>c,s</sub> = <i>y</i><sub>c,s</sub> - <i>y</i><sub>0,s</sub>. We report the mean difference, a Student-<i>t</i> 95% confidence interval, and the paired standardized effect <i>d</i><sub>z</sub> = mean(<i>d</i>)/SD(<i>d</i>)."),
    p("Operational delay is recorded when a realized milestone exceeds its planned value. Resource waiting is accumulated from requested to granted acquisition times, while reassignment records a difference between intended and realized compatible resources. The measures are separated because reassignment describes adaptation activity and waiting describes its residual performance consequence."),
    p("4.3 Artifact and Provenance Record", "PaperH2"),
    p("The experiment package contains the executable batch entry point, simulation modules, machine-readable JSON and CSV outputs, and tests for replay, invariants, guards, and disruption isolation. The formal artifact records schema version 1.0, scenario SIM-72H-1792713600000, seeds 42-61, five conditions, 100 runs, three airports, 65 aircraft, validity fields, checkpoint counts, and event fingerprints. A fresh execution reproduced the batch JSON and CSV byte-for-byte; SHA-256 values and the one audit-schema-only difference in the single-seed JSON are documented in the evidence manifest."),
]

story += [p("5 Results", "PaperH1")]
results = [
    [p("Condition", "PaperSmall"), p("Delay", "PaperSmall"), p("Wait h", "PaperSmall"), p("95% CI", "PaperSmall"), p("Delta h", "PaperSmall"), p("dz", "PaperSmall")],
    ["Baseline", "0.3398", "113.70", "93.42-133.99", "0.00", "0.00"],
    ["Weather only", "0.3566", "120.19", "99.67-140.71", "6.49", "1.73"],
    ["Runway closure", "0.3398", "113.70", "93.42-133.99", "0.00", "0.00"],
    ["Equipment outage", "0.3894", "155.63", "133.02-178.24", "41.93", "3.37"],
    ["Combined", "0.4142", "173.20", "149.99-196.41", "59.50", "4.31"],
]
res_table = Table(results, colWidths=[30 * mm, 16 * mm, 17 * mm, 30 * mm, 16 * mm, 11 * mm], repeatRows=1)
res_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
    ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
    ("FONTSIZE", (0, 0), (-1, -1), 7.6),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EDF3")),
    ("LINEABOVE", (0, 0), (-1, 0), 0.7, colors.black),
    ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black),
    ("LINEBELOW", (0, -1), (-1, -1), 0.7, colors.black),
    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [
    p("All 100 formal runs passed the implemented operational-validity gates, and the five conditions for seed 42 were deterministically replayed. Each run planned approximately 320 missions and mean completion was 1.00 under all conditions."),
    KeepTogether([p("Table 2. Results across 20 paired seeds.", "PaperCaption"), res_table]),
    Spacer(1, 4),
    p("Weather restrictions affect a mean of 91.75 missions and increase resource waiting by 6.49 h relative to paired baselines (95% CI 4.73-8.25). Equipment outages produce 271.85 equipment reassignments on average and increase waiting by 41.93 h (95% CI 36.10-47.76). Combined disruption has the largest observed effect: a 59.50-h increase (95% CI 53.03-65.96) and an operational delay rate of 0.4142."),
    p("Runway closure yields 66.15 runway reassignments per run but no aggregate waiting-time increase. This does not imply operational irrelevance. The closure mechanism is activated while modeled spare capacity absorbs the selected closure, illustrating why mechanism and outcome indicators must be reported together."),
    p("H1 is supported in the implemented test space because no formal run was retained with a failed lifecycle, accounting, or capacity invariant. H2 is supported because each isolated condition activates only its intended indicator and the combined condition activates all three. H3 is supported for weather and equipment outage because paired confidence intervals exclude zero. H4 is supported descriptively, while a factorial interaction claim is deliberately withheld."),
]

story += [p("6 Discussion", "PaperH1"), p("6.1 Answers to the Research Questions", "PaperH2")]
story += [
    p("For RQ1, the implementation produces complete 72-hour traces that pass the current rule gates and can be deterministically replayed. This establishes internal consistency, not real-world predictive validity. For RQ2, isolated disturbances produce different signatures: weather reduces capacity and speed; runway closure causes substitution; and equipment outage creates repeated support-resource reassignment and substantial waiting. For RQ3, combined disruption has the highest delay rate and waiting time, although a full factorial design is required before claiming nonlinear interaction. For RQ4, ground-support availability is the dominant modeled bottleneck under the selected parameters."),
    p("6.2 Reliability Significance", "PaperH2"),
    p("The framework represents external stressors and traces their effects through constrained mission chains. It also treats the simulator as a system requiring credibility evidence. A result is retained together with its scenario identifier, seed, event fingerprint, rule-audit outcome, and paired statistics. This converts a visual demonstration into a reproducible experiment."),
    p("The framework is also a precondition for later multi-agent optimization. Future agents can propose runway, stand, maintenance, or support decisions, while existing guards and invariants define a feasibility envelope. The present results are therefore a controlled baseline before agent policies are introduced."),
    p("Three findings are practically instructive. First, support-equipment loss has the largest isolated effect, showing that runway capacity alone is an incomplete proxy for resilience. Second, a closure can be operationally active yet performance-neutral under surplus capacity. Third, the combined increase exceeds either single effect, but the current design cannot determine whether this is a stable interaction or a consequence of the particular joint rule set."),
    p("6.3 Implications for Multi-Agent Evaluation", "PaperH2"),
    p("The framework separates an agent proposal from simulator authority. An agent may request a stand, runway, maintenance action, or support allocation, but compatibility, exclusivity, closure state, and lifecycle legality are checked before commitment. Candidate policies should receive identical tasks and disturbances and be evaluated on completion, delay, waiting, recovery, violations, and computation time. A policy that improves delay by exploiting an invalid transition is excluded by the validity gate."),
]

story += [p("7 Threats to Validity", "PaperH1")]
story += [
    p("<b>Construct validity.</b> Waiting and delay represent selected resilience dimensions but exclude passenger impact, crew legality, fuel, emissions, and financial loss.", "PaperNoIndent"),
    p("<b>Internal validity.</b> The paired-seed design isolates disturbances under a fixed implementation. The combined experiment is not a full factorial design, so statistical interaction is not yet identified.", "PaperNoIndent"),
    p("The simulator and audit code are developed in the same project, creating common-mode-error risk. Independent reference traces, mutation tests that deliberately violate invariants, and cross-implementation replay would strengthen verification.", "PaperNoIndent"),
    p("<b>External validity.</b> Disturbances are synthetic and the model is not calibrated against historical records from the three airports. Results are not forecasts of actual airport performance.", "PaperNoIndent"),
    p("<b>Model scope.</b> External traffic, air-traffic-control decisions, passenger connections, crew rotations, and detailed vehicle-routing conflicts remain outside the experiment.", "PaperNoIndent"),
    p("<b>Statistical conclusion validity.</b> Twenty paired seeds provide initial conference-scale evidence, but broader parameter sweeps and more seeds are required for sensitivity analysis.", "PaperNoIndent"),
]

story += [p("8 Conclusion and Future Work", "PaperH1")]
story += [
    p("This paper presented a deterministic and auditable 72-hour multi-airport digital-twin simulation framework. A 65-aircraft fleet was simulated across three airports under five paired conditions and 20 seeds. Weather increases delay moderately, runway closure is absorbed through reassignment in the tested capacity regime, equipment outage creates the largest single-resource bottleneck, and combined disruptions have the strongest overall effect."),
    p("Future work will add per-airport propagation metrics, recovery-time measures, and comparison policies such as first-come-first-served, static assignment, and rule-based dynamic reassignment. Historical or semi-physical data will be used for calibration. Multi-agent policies can then be evaluated against the same frozen snapshots, paired seeds, and audit gates."),
    p("<b>Declaration on Generative AI.</b> A generative-AI tool assisted language editing, structural drafting, and code-oriented document preparation. The author reviewed the manuscript, verified the experimental values and cited sources, and remains responsible for the content. Reported experimental data were produced by the simulator rather than the language model.", "PaperNoIndent"),
]

story += [p("References", "PaperH1")]
refs = [
    "[1] Conde, J., et al.: Applying digital twins for the management of information in turnaround event operations in commercial airports. Advanced Engineering Informatics 54, 101723 (2022). doi:10.1016/j.aei.2022.101723.",
    "[2] Postorino, M.N., Mantecchini, L., Malandri, C., Paganelli, F.: A methodological framework to evaluate the impact of disruptions on airport turnaround operations: A case study. Case Studies on Transport Policy 8(2), 429-439 (2020). doi:10.1016/j.cstp.2020.03.007.",
    "[3] Saggar, S., Tomasella, M., Cattaneo, G., Matta, A.: Enhanced operational management of airport ground support equipment for better aircraft turnaround performance. Winter Simulation Conference (2021).",
    "[4] Sahadevan, D., Al Ali, H., Notman, D., Mukandavire, Z.: Optimising airport ground resource allocation for multiple aircraft using machine learning-based arrival time prediction. Aerospace 10(6), 509 (2023). doi:10.3390/aerospace10060509.",
    "[5] Chen, K., Nadirsha, T.N.M., Lilith, N., Alam, S., Svensson, A.: Tangible digital twin with shared visualization for collaborative air traffic management operations. Transportation Research Part C 162, 104546 (2024). doi:10.1016/j.trc.2024.104546.",
    "[6] Wright, L., Davidson, S.: How to tell the difference between a model and a digital twin. Advanced Modeling and Simulation in Engineering Sciences 7, 13 (2020). doi:10.1186/s40323-020-00147-4.",
    "[7] Bitencourt, J., Wooley, A., Harris, G.: Verification and validation of digital twins: A systematic literature review for manufacturing applications. International Journal of Production Research 63(1), 342-370 (2025). doi:10.1080/00207543.2024.2357741.",
    "[8] Fuller, A., Fan, Z., Day, C., Barlow, C.: Digital twin: Enabling technologies, challenges and open research. IEEE Access 8, 108952-108971 (2020). doi:10.1109/ACCESS.2020.2998358.",
    "[9] Jones, D., Snider, C., Nassehi, A., Yon, J., Hicks, B.: Characterising the digital twin: A systematic literature review. CIRP Journal of Manufacturing Science and Technology 29, 36-52 (2020). doi:10.1016/j.cirpj.2020.02.002.",
    "[10] Mantecchini, L., Paganelli, F., Postorino, M.N.: A comprehensive approach to assess transportation system resilience towards disruptive events: Case study on airside airport systems. Transport Policy 139, 109-122 (2023). doi:10.1016/j.tranpol.2023.05.011.",
    "[11] Zhang, H., Wu, W., Zhang, S., Witlox, F.: Simulation analysis on flight delay propagation under different network configurations. IEEE Access 8, 103236-103244 (2020). doi:10.1109/ACCESS.2020.2999098.",
    "[12] Tabares, D.A., Mora-Camino, F., Drouin, A.: A multi-time scale management structure for airport ground handling automation. Journal of Air Transport Management 90, 101959 (2021). doi:10.1016/j.jairtraman.2020.101959.",
    "[13] Zhu, S., Sun, H., Guo, X.: Cooperative scheduling optimization for ground-handling vehicles by considering flights' uncertainty. Computers and Industrial Engineering 169, 108092 (2022). doi:10.1016/j.cie.2022.108092.",
    "[14] Zhang, S., Li, X., Yuan, X., Liu, J., Peng, J., Li, D.: Optimising the flight turnaround schedules: An improved sliding time windows approach based on MILP and CP models. Computers and Operations Research 161, 106433 (2024). doi:10.1016/j.cor.2023.106433.",
    "[15] Yao, M., Hu, M., Yin, J., Su, J., Yin, M.: A two-stage optimization model for airport stand allocation and ground support vehicle scheduling. Applied Sciences 14(23), 11407 (2024). doi:10.3390/app142311407.",
    "[16] Heikes, R.G., Montgomery, D.C., Rardin, R.L.: Using common random numbers in simulation experiments. SIMULATION 27(3), 81-85 (1976). doi:10.1177/003754977602700301.",
    "[17] Morris, T.P., White, I.R., Crowther, M.J.: Using simulation studies to evaluate statistical methods. Statistics in Medicine 38(11), 2074-2102 (2019). doi:10.1002/sim.8086.",
    "[18] Fehr, J., Heiland, J., Himpe, C., Saak, J.: Learning from reproducing computational results. Philosophical Transactions of the Royal Society A 379, 20200069 (2021). doi:10.1098/rsta.2020.0069.",
    "[19] Sacks, J., Welch, W.J., Mitchell, T.J., Wynn, H.P.: Design and analysis of computer experiments. Statistical Science 4(4), 409-423 (1989). doi:10.1214/ss/1177012413.",
    "[20] Munoz, P., Wimmer, M., Troya, J., Vallecillo, A.: Measuring the fidelity of a physical and a digital twin using trace alignments. IEEE Transactions on Software Engineering 50(12), 3122-3145 (2024). doi:10.1109/TSE.2024.3462978.",
]
story += [p(ref, "PaperRef") for ref in refs]

doc = PaperDoc(str(OUTPUT))
doc.build(story)
print(OUTPUT)

