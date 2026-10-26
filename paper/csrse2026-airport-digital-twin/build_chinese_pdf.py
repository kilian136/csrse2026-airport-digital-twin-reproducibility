from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output" / "pdf" / "csrse2026_airport_digital_twin_zh.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("CN", r"C:\Windows\Fonts\Deng.ttf"))
pdfmetrics.registerFont(TTFont("CN-Bold", r"C:\Windows\Fonts\Dengb.ttf"))

PAGE = (155 * mm, 235 * mm)
LEFT = RIGHT = 16.5 * mm
TOP = BOTTOM = 18 * mm


class PaperDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=PAGE,
            leftMargin=LEFT,
            rightMargin=RIGHT,
            topMargin=TOP,
            bottomMargin=BOTTOM,
            title="Chinese Edition - Auditable 72-Hour Multi-Airport Digital-Twin Simulation",
            author="Kilian Sui",
        )
        frame = Frame(LEFT, BOTTOM, PAGE[0] - LEFT - RIGHT, PAGE[1] - TOP - BOTTOM, id="body")
        self.addPageTemplates(PageTemplate(id="paper", frames=[frame], onPage=self._decorate))

    @staticmethod
    def _decorate(canvas, doc):
        canvas.saveState()
        canvas.setFont("CN", 7.6)
        canvas.setFillColor(colors.HexColor("#555555"))
        if doc.page > 1:
            canvas.drawString(LEFT, PAGE[1] - 11 * mm, "Kilian Sui")
            canvas.drawRightString(PAGE[0] - RIGHT, PAGE[1] - 11 * mm, "可审计多机场数字孪生仿真")
        canvas.drawCentredString(PAGE[0] / 2, 9 * mm, str(doc.page))
        canvas.restoreState()


base = getSampleStyleSheet()
styles = {
    "title": ParagraphStyle("title", parent=base["Title"], fontName="CN-Bold", fontSize=15, leading=21, alignment=TA_CENTER, spaceAfter=8),
    "author": ParagraphStyle("author", parent=base["Normal"], fontName="CN", fontSize=9.5, leading=13, alignment=TA_CENTER, spaceAfter=5),
    "abstract": ParagraphStyle("abstract", parent=base["Normal"], fontName="CN", fontSize=8.5, leading=13, alignment=TA_JUSTIFY, spaceAfter=5),
    "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="CN-Bold", fontSize=12, leading=17, spaceBefore=8, spaceAfter=4, keepWithNext=True),
    "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="CN-Bold", fontSize=10.5, leading=15, spaceBefore=6, spaceAfter=3, keepWithNext=True),
    "body": ParagraphStyle("body", parent=base["BodyText"], fontName="CN", fontSize=9, leading=14, alignment=TA_JUSTIFY, firstLineIndent=18, spaceAfter=4),
    "noindent": ParagraphStyle("noindent", parent=base["BodyText"], fontName="CN", fontSize=9, leading=14, alignment=TA_JUSTIFY, firstLineIndent=0, spaceAfter=4),
    "small": ParagraphStyle("small", parent=base["BodyText"], fontName="CN", fontSize=7.5, leading=11, firstLineIndent=0),
    "caption": ParagraphStyle("caption", parent=base["Normal"], fontName="CN", fontSize=8, leading=11, alignment=TA_CENTER, spaceBefore=3, spaceAfter=3),
    "ref": ParagraphStyle("ref", parent=base["Normal"], fontName="CN", fontSize=7.5, leading=11, leftIndent=16, firstLineIndent=-16, spaceAfter=2),
}


def p(text: str, style: str = "body"):
    return Paragraph(text, styles[style])


story = [
    p("面向运行扰动实验的确定性可审计72小时多机场数字孪生仿真框架", "title"),
    p("Kilian Sui", "author"),
    p("投稿单位待确认<br/>通信邮箱待确认", "author"),
    Spacer(1, 3),
    p("<b>摘要：</b>机场数字孪生正逐步用于运行可视化和决策支持，但许多现有实现对结果可复现性、运行规则合规性以及扰动隔离能力缺少系统证据。本文提出一种面向统一航司机队的确定性、可审计72小时多机场仿真框架，覆盖杭州萧山、上海浦东和南京禄口三个机场。框架由冻结场景快照、随机种子控制的任务生成、资源约束离散事件执行、跑道/机位/飞机/地面保障资源约束、状态转换守卫、不变量审计和事件日志重放指纹构成。实验设置正常运行、严重低能见度、跑道临时关闭、地面保障设备故障和组合扰动五种工况。使用种子42至61完成20组配对实验，共获得65架飞机、每轮约320项任务下的100次正式运行。当前全部运行通过运行合法性门槛，并对首个种子完成确定性重放。与正常运行相比，天气限制使平均资源等待增加6.49小时，保障设备故障增加41.93小时，组合扰动增加59.50小时。跑道关闭平均触发66.15次跑道重分配，但在当前容量设置下未增加汇总资源等待。结果表明，地面保障资源是当前模型中的主要瓶颈，剩余跑道容量能够吸收本实验设置的跑道关闭影响。本文贡献是为后续多智能体调度与运行韧性研究提供可复现的实验底座，而非宣称当前模型已经具备真实机场预测效度。", "abstract"),
    p("<b>关键词：</b>机场数字孪生；离散事件仿真；运行扰动；确定性重放；验证与确认；地面保障设备", "abstract"),
]

story += [p("1 引言", "h1")]
story += [
    p("机场是高度耦合的社会技术系统。飞机轮转、跑道运行、停机位、维修活动以及移动保障资源受到严格的时间和安全约束，局部资源不足或运行扰动可能沿连续任务向后传播，甚至跨机场扩散。机场数字孪生研究因此由资产可视化逐步转向运行监控、仿真与决策支持。Conde等构建了用于机场过站事件管理的数字孪生概念与数据模型[1]；Postorino等采用离散事件仿真分析空侧扰动在起降和过站过程中的传播[2]。这些研究说明了综合运行模型的价值，但结果复现和软件层运行规则审计并未始终被作为一等实验产物。"),
    p("第二个问题是模型可信度。Wright和Davidson指出，对数字孪生概念的模糊使用会混淆独立模型与动态更新孪生体之间的区别[6]。Bitencourt等指出，同时采用结构化验证和确认流程的数字孪生研究仍然较少[7]。对于面向可靠性的仿真实验，结果不仅需要数值合理，还应能够追溯至版本化输入，在受控随机条件下重复，并在违反运行不变量时被明确拒绝。"),
    p("本文研究四个问题：固定多机场场景能否产生完整、合规、可确定重放的72小时运行轨迹；天气、跑道和保障设备扰动分别如何影响延误、等待和资源重分配；组合扰动是否强于任一单独扰动；在当前参数下哪类资源构成主要瓶颈。"),
    p("本文贡献包括：（1）面向一家航司统一机队的三机场场景契约；（2）确定性事件执行和重放审计链；（3）与每次实验绑定的不变量和状态转换守卫；（4）带95%置信区间和种子内标准化效应量的多种子配对扰动实验。"),
    p("研究难点并非让飞机在地图上移动，而是保证飞机轮转、机位占用、跑道间隔、维修状态与异构保障资源在整个仿真期内保持一致。视觉上合理的轨迹仍可能包含跨机场瞬移、重复占用或在关闭跑道上运行等非法转换。因此本文将扰动暴露、资源响应、性能损失和恢复过程分别记录，并在多智能体优化前先建立可执行的运行规则契约。"),
]

story += [p("2 相关工作", "h1"), p("2.1 机场数字孪生与运行仿真", "h2")]
story += [
    p("机场数字孪生研究涉及信息集成、过站管理、空中交通可视化和资源优化。Conde等通过FIWARE架构连接异构机场信息并展示面向过站运行的应用[1]。Chen等研究了用于协同空管运行的混合现实实体数字孪生，重点评价共享态势感知和人机交互[5]。上述工作强化了可视化和态势感知，而本文重点研究可重复实验执行和机器可检查的运行轨迹。"),
    p("运行扰动建模同样受到持续关注。Postorino等将起降过程与过站活动集成，以捕获连续运行中的次生影响[2]。地面保障对稀缺移动资源尤其敏感。Saggar等提出面向不确定性的实时地面保障设备预订机制[3]，Sahadevan等将到达时间预测与多飞机有限地面资源分配结合[4]。这些研究说明保障能力应被显式建模，而不能只用外生过站延误常数代替。"),
    p("2.2 数字孪生可信度与可复现性", "h2"),
    p("数字孪生同时包含模型、数据和决策过程，但术语与验证实践仍不统一。Fuller等总结了数字孪生支撑技术和开放挑战[8]；Wright和Davidson将物理实体、持续演化的数据与动态模型更新视为区别于普通模型的重要要素[6]；Bitencourt等指出结构化验证和确认实践仍然不足[7]。本文将软件验证与经验确认区分开。"),
    p("2.3 地面保障、运行韧性与可复现性", "h2"),
    p("地面保障同时受到资源稀缺、服务先后关系和机型兼容约束。已有研究分别讨论了自动化保障车队在线分配[12]、不确定航班条件下的协同车辆调度[13]、复杂过站任务调度[14]以及机位与保障车辆联合优化[15]。这些工作重点形成高质量调度方案，本文则补充不同调度方法共同需要的受控执行、规则校验和证据留存层。"),
    p("延误传播研究表明，机场网络结构与单机场运行能力会共同影响扰动后果[11]。经典计算机实验设计要求记录输入设计而非只保留孤立运行结果[19]；公共随机数适合配对比较[16]，保存种子支持精确重现[17]，计算过程还应透明、可重新执行且尽可能确定[18]。"),
]

story += [p("3 框架设计", "h1"), p("3.1 场景契约", "h2")]
story += [
    p("系统将任务表示为放行、推出、滑出、起飞、巡航、降落、滑入、保障和完成组成的有序链。每个事件包含仿真时间、优先级、确定性序号、任务标识和事件载荷；相同时间事件按照固定键排序，避免运行环境差异改变执行顺序。"),
    p("仿真输入为冻结的三机场场景快照，包含一家航司的65架飞机、逐机健康属性、停机位、正式跑道档案、地面保障车辆和路网资源。每次运行覆盖72小时。默认规划参数为：单机最多5项任务、模拟故障概率2.5%、应急事件概率1%、跑道运行间隔180秒、单次地面保障30分钟、保障并行容量6。"),
    p("每项任务引用一架飞机、始发和目的机场、起降资源以及运行事件链。在施加实验扰动之前，相同快照和随机种子产生相同的基础任务总体。"),
    p("冻结快照在一次批量实验中不可修改。天气、跑道关闭和设备故障以独立扰动适配器叠加，不直接改写基准场景。每份结果保留快照、场景、随机种子、仿真器版本和参数标识，从而防止上一工况状态泄漏到下一工况。"),
    p("3.2 资源约束事件执行", "h2"),
    p("离散事件引擎按照仿真时间和确定性并列排序键处理事件，并将跑道、机位、飞机、维修和地面保障可用性作为显式约束。当请求资源不可用时，引擎可以改配兼容资源或推迟依赖事件。状态转换只有在相关守卫规则通过后才能提交。系统同时记录计划分配和实际分配，从而区分扰动暴露与系统响应。"),
    p("资源获取按事件原子提交：全部必要资源可行时才写入预约，否则事件推迟到最早确定释放时刻，并将等待归因到对应资源类别。兼容性过滤优先于距离偏好，因此系统不会为了缩短滑行距离而分配不适配机位或跑道。"),
    p("3.3 审计与重放层", "h2"),
    p("每次运行经过三层可信度门槛：端到端验收检查任务链是否完整；不变量审计检查资源互斥、状态一致性和统计恒等关系；状态转换守卫拒绝违反运行生命周期的转换。确定性重放使用完全相同的输入、参数和种子重复执行。排序后的事件日志被归约为版本化检查点和数字指纹，只有事件顺序、检查点状态和最终指标均一致时才判定通过。"),
    p("核心不变量包括：飞机任一时刻只能具有一个互斥位置；容量为一的资源不得重叠占用；降落必须引用开放且兼容的跑道；停放飞机必须引用当前机场的兼容机位；阶段变化必须符合生命周期图；汇总统计必须与事件日志重建结果一致。任何违反都会使该次运行失效。"),
]

story += [p("4 实验方法", "h1"), p("4.1 配对实验设计", "h2")]
story += [p("实验设置四项假设：H1要求每次正式运行同时通过验收、不变量与状态转换门槛；H2要求各扰动激活预期机制指标；H3预期天气和设备故障相对基准增加等待；H4预期组合扰动产生最大退化。由于备用跑道可能吸收关闭影响，本文不预设跑道关闭一定增加等待。")]
conditions = [
    [p("工况", "small"), p("扰动定义", "small")],
    [p("正常运行", "small"), p("不注入天气、跑道或外部设备扰动。", "small")],
    [p("天气限制", "small"), p("三个机场从第0至18小时处于严重低能见度；跑道容量系数0.60，地面速度系数0.65。", "small")],
    [p("跑道关闭", "small"), p("每个机场较短的正式跑道在第4至14小时因检查关闭。", "small")],
    [p("设备故障", "small"), p("每个机场各保障类别编号最前的可用设备在第0至14小时不可用。", "small")],
    [p("组合扰动", "small"), p("天气限制、跑道关闭和保障设备故障同时发生。", "small")],
]
cond_table = Table(conditions, colWidths=[28 * mm, 92 * mm], repeatRows=1)
cond_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, 0), "CN-Bold"), ("FONTNAME", (0, 1), (-1, -1), "CN"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EDF3")),
    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#777777")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3), ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [KeepTogether([p("表1  实验工况", "caption"), cond_table]), Spacer(1, 4)]
story += [
    p("实验使用种子42至61，共20个种子。同一种子下，五种工况共享完全相同的快照、规划参数和基础任务随机性，因此扰动工况和正常工况之间形成种子内配对。正式实验包含20×5=100次运行。种子42额外重复执行以验证确定性重放，重放不作为独立统计样本。"),
    p("4.2 指标与统计方法", "h2"),
    p("主要结果指标包括任务完成率、运行延误率、资源等待总时长、平均和95分位资源等待时间、机队利用率。作用机制指标包括受天气影响任务数、跑道重分配次数和设备重分配次数。只有端到端验收为accepted、不变量状态为passed、转换守卫状态为passed的运行才被视为有效。"),
    p("对结果y，扰动工况c在种子s下的配对差值为 d(c,s)=y(c,s)-y(0,s)。实验报告配对差值均值、基于Student-t分布的95%置信区间，以及标准化配对效应量 dz=mean(d)/SD(d)。"),
    p("相同种子下五种工况共享任务生成和健康事件随机流，扰动适配器则由场景与仿真时间确定。因此工况差异主要来自声明的扰动，而不是不同的任务样本。资源重分配表示系统采取了适应动作，资源等待表示适应后的剩余性能损失，两者不能相互替代。"),
    p("4.3 实验产物与来源记录", "h2"),
    p("实验包包含可执行批量入口、扰动与统计模块、JSON/CSV机器可读结果，以及重放、不变量、状态守卫和扰动隔离测试。正式批量产物记录模式版本1.0、场景SIM-72H-1792713600000、种子42至61、五种工况、100次运行、三个机场、65架飞机、逐次合法性字段、检查点数量和事件指纹。重新执行后，批量JSON与CSV逐字节一致；SHA-256及单种子JSON因新增空审计字段产生的模式差异均记录在证据清单中。"),
]

story += [p("5 实验结果", "h1")]
results = [
    [p("工况", "small"), p("延误率", "small"), p("等待/h", "small"), p("95%区间", "small"), p("差值/h", "small"), p("dz", "small")],
    ["正常运行", "0.3398", "113.70", "93.42-133.99", "0.00", "0.00"],
    ["天气限制", "0.3566", "120.19", "99.67-140.71", "6.49", "1.73"],
    ["跑道关闭", "0.3398", "113.70", "93.42-133.99", "0.00", "0.00"],
    ["设备故障", "0.3894", "155.63", "133.02-178.24", "41.93", "3.37"],
    ["组合扰动", "0.4142", "173.20", "149.99-196.41", "59.50", "4.31"],
]
res_table = Table(results, colWidths=[26 * mm, 17 * mm, 18 * mm, 31 * mm, 18 * mm, 10 * mm], repeatRows=1)
res_table.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, 0), "CN-Bold"), ("FONTNAME", (0, 1), (-1, -1), "CN"),
    ("FONTSIZE", (0, 0), (-1, -1), 7.2), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EDF3")),
    ("LINEABOVE", (0, 0), (-1, 0), 0.7, colors.black), ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black),
    ("LINEBELOW", (0, -1), (-1, -1), 0.7, colors.black), ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [
    p("100次正式运行均通过当前运行合法性门槛，种子42的五种工况均完成确定性重放。每轮计划任务约320项，全部工况的平均完成率均为1.00。"),
    KeepTogether([p("表2  20个配对种子的主要结果", "caption"), res_table]), Spacer(1, 4),
    p("天气限制平均影响91.75项任务，相对配对基准使资源等待增加6.49小时（95%置信区间4.73至8.25）。设备故障平均引起271.85次设备重分配，使等待增加41.93小时（95%置信区间36.10至47.76）。组合扰动影响最大，等待增加59.50小时（95%置信区间53.03至65.96），运行延误率达到0.4142。"),
    p("跑道关闭平均引起66.15次跑道重分配，但汇总等待时间没有增加。这不能解释为跑道关闭没有运行意义，而应解释为扰动机制确实被触发，但当前模型中的剩余跑道容量能够吸收该关闭影响。因此必须同时报告作用机制指标和结果指标。"),
    p("在当前试验空间内，H1得到支持；三类独立扰动均仅激活相应机制指标，组合工况激活全部三类指标，因而H2得到支持。天气与设备故障的配对等待置信区间均不包含零，支持H3。组合工况具有最高延误率和等待时间，描述性支持H4，但本文不据此宣称已经识别稳定的非线性交互。"),
]

story += [p("6 讨论", "h1"), p("6.1 研究问题回答", "h2")]
story += [
    p("对于RQ1，当前实现能够生成完整72小时轨迹，通过现有规则门槛，并完成确定性重放。这证明内部实验一致性，但不等于真实预测效度。对于RQ2，三类单一扰动呈现不同影响特征：天气降低容量和速度，跑道关闭触发替代资源，设备故障造成高频保障资源重分配及显著等待。对于RQ3，组合扰动具有最高延误率和等待时间，但在声称非线性交互之前仍需完整析因实验。对于RQ4，地面保障可用性是当前参数下的主要瓶颈。"),
    p("6.2 可靠性研究意义", "h2"),
    p("该框架一方面表示外部压力并追踪其在资源约束任务链中的影响，另一方面将仿真器本身视为需要可信证据的软件系统。实验结果与场景标识、种子、事件指纹、规则审计结果和配对统计共同保存，使可视化演示转化为可复现实验。"),
    p("该框架也是后续多智能体优化的前提。未来智能体可以提出跑道、机位、维修或保障决策，而现有转换守卫和不变量将构成可行性与安全边界。当前结果因此是引入智能体策略之前的受控实验基线。"),
    p("6.3 对多智能体实验的意义", "h2"),
    p("系统将智能体建议与仿真器最终执行权分离。智能体可以提出机位、跑道、维修或保障资源请求，但必须通过兼容性、互斥性、关闭状态与生命周期检查。候选策略应在相同任务与扰动下比较完成率、延误、等待、恢复时间、违规次数和计算时间；依靠非法状态转换取得的性能提升不会被纳入比较。"),
]

story += [p("7 有效性威胁", "h1")]
story += [
    p("<b>构念效度：</b>资源等待和运行延误只表示部分韧性维度，尚未包含旅客影响、机组合法性、燃油、排放和经济损失。", "noindent"),
    p("<b>内部效度：</b>配对种子设计能够在固定实现下隔离扰动，但当前组合实验不是完整析因设计，尚不能严格识别统计交互作用。", "noindent"),
    p("仿真器与审计代码位于同一项目，仍可能出现共同模式错误。后续需要加入独立参考轨迹、故意破坏不变量的变异测试以及跨实现重放。", "noindent"),
    p("<b>外部效度：</b>扰动数据为合成数据，模型尚未使用三机场历史运行记录标定，结果不能作为真实机场运行预测。", "noindent"),
    p("<b>模型范围：</b>外部航班流量、空管决策、旅客衔接、机组轮换和详细车辆路径冲突仍在实验范围之外。", "noindent"),
    p("<b>统计结论效度：</b>20组配对种子可形成初步会议论文证据，但还需更大参数扫描和更多种子完成敏感性分析。", "noindent"),
]

story += [p("8 结论与后续工作", "h1")]
story += [
    p("本文提出一种确定性、可审计的72小时多机场数字孪生仿真框架，在三个机场、65架飞机、五种配对工况和20个种子下开展实验。结果显示，天气造成中等程度延误，当前容量下跑道关闭被资源重分配吸收，设备故障构成最显著的单一资源瓶颈，组合扰动产生最大的总体影响。"),
    p("后续工作将增加分机场传播指标、恢复时间指标，并加入先到先服务、静态分配和规则动态重分配等对照策略；随后使用历史或半实物数据完成参数标定。多智能体策略将基于相同冻结快照、配对种子和审计门槛进行评价。"),
    p("<b>生成式人工智能使用声明：</b>论文准备过程中使用生成式人工智能辅助语言润色、结构草拟和文档代码整理。作者对全部内容进行了审阅和修改，核验实验数值与引用来源，并对论文承担最终责任。文中实验数据来自所述仿真器，而非语言模型生成。", "noindent"),
    p("参考文献", "h1"),
]

refs = [
    "[1] Conde, J., et al. Applying digital twins for the management of information in turnaround event operations in commercial airports. Advanced Engineering Informatics, 54:101723, 2022. doi:10.1016/j.aei.2022.101723.",
    "[2] Postorino, M.N., et al. A methodological framework to evaluate the impact of disruptions on airport turnaround operations: A case study. Case Studies on Transport Policy, 8(2):429-439, 2020. doi:10.1016/j.cstp.2020.03.007.",
    "[3] Saggar, S., Tomasella, M., Cattaneo, G., Matta, A. Enhanced operational management of airport ground support equipment for better aircraft turnaround performance. Winter Simulation Conference, 2021.",
    "[4] Sahadevan, D., et al. Optimising airport ground resource allocation for multiple aircraft using machine learning-based arrival time prediction. Aerospace, 10(6):509, 2023. doi:10.3390/aerospace10060509.",
    "[5] Chen, K., et al. Tangible digital twin with shared visualization for collaborative air traffic management operations. Transportation Research Part C, 162:104546, 2024. doi:10.1016/j.trc.2024.104546.",
    "[6] Wright, L., Davidson, S. How to tell the difference between a model and a digital twin. Advanced Modeling and Simulation in Engineering Sciences, 7:13, 2020. doi:10.1186/s40323-020-00147-4.",
    "[7] Bitencourt, J., Wooley, A., Harris, G. Verification and validation of digital twins: A systematic literature review for manufacturing applications. International Journal of Production Research, 63(1):342-370, 2025. doi:10.1080/00207543.2024.2357741.",
    "[8] Fuller, A., Fan, Z., Day, C., Barlow, C. Digital twin: Enabling technologies, challenges and open research. IEEE Access, 8:108952-108971, 2020. doi:10.1109/ACCESS.2020.2998358.",
    "[9] Jones, D., et al. Characterising the digital twin: A systematic literature review. CIRP Journal of Manufacturing Science and Technology, 29:36-52, 2020. doi:10.1016/j.cirpj.2020.02.002.",
    "[10] Mantecchini, L., et al. A comprehensive approach to assess transportation system resilience towards disruptive events. Transport Policy, 139:109-122, 2023. doi:10.1016/j.tranpol.2023.05.011.",
    "[11] Zhang, H., et al. Simulation analysis on flight delay propagation under different network configurations. IEEE Access, 8:103236-103244, 2020. doi:10.1109/ACCESS.2020.2999098.",
    "[12] Tabares, D.A., et al. A multi-time scale management structure for airport ground handling automation. Journal of Air Transport Management, 90:101959, 2021.",
    "[13] Zhu, S., Sun, H., Guo, X. Cooperative scheduling optimization for ground-handling vehicles by considering flights' uncertainty. Computers and Industrial Engineering, 169:108092, 2022.",
    "[14] Zhang, S., et al. Optimising the flight turnaround schedules. Computers and Operations Research, 161:106433, 2024.",
    "[15] Yao, M., et al. A two-stage optimization model for airport stand allocation and ground support vehicle scheduling. Applied Sciences, 14(23):11407, 2024.",
    "[16] Heikes, R.G., et al. Using common random numbers in simulation experiments. SIMULATION, 27(3):81-85, 1976.",
    "[17] Morris, T.P., et al. Using simulation studies to evaluate statistical methods. Statistics in Medicine, 38(11):2074-2102, 2019.",
    "[18] Fehr, J., et al. Learning from reproducing computational results. Philosophical Transactions of the Royal Society A, 379:20200069, 2021.",
    "[19] Sacks, J., et al. Design and analysis of computer experiments. Statistical Science, 4(4):409-423, 1989.",
    "[20] Munoz, P., et al. Measuring the fidelity of a physical and a digital twin using trace alignments. IEEE Transactions on Software Engineering, 50(12):3122-3145, 2024.",
]
story += [p(ref, "ref") for ref in refs]

PaperDoc(str(OUTPUT)).build(story)
print(OUTPUT)
