// LiteLLMZh 回归测试（零依赖，node tests/test_translate.mjs）
//
// 直接 require 主脚本（脚本尾部有自测钩子，只在 Node 下暴露内部函数），
// 所以测的是**真实实现**，不是复制品。锁住三类曾经踩过的问题：
//   ① translate() 必须返回 {v, keepWs} 对象（返回字符串会让 placeholder 变 [object Object]）
//   ② 片段键（含首尾空格）必须命中（查表前 trim 过一次，导致全部失效）
//   ③ 数据/大写渲染值必须不译（CSS text-transform 的坑）

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// 默认测交付脚本；LITELLMZH_SCRIPT 可指向副本，用于"注 bug 反验"测试本身有效性
const SCRIPT = process.env.LITELLMZH_SCRIPT
  ? path.resolve(process.env.LITELLMZH_SCRIPT)
  : path.join(here, "..", "litellm-zh.user.js");

// —— 最小 DOM 桩：让 IIFE 能加载但不真正启动（readyState=loading 时不跑 boot）——
globalThis.document = {
  readyState: "loading",
  addEventListener() {},
  documentElement: {},
  body: {},
  title: "",
  querySelector: () => null,
};
globalThis.window = { addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.NodeFilter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

const require = createRequire(import.meta.url);

// —— 网络 API 陷阱：脚本"加载期"若发生任何网络调用都会被记下（第 ⑨ 节断言为空）——
// 必须在 require 之前装好，才能覆盖模块顶层代码。
const netCalls = [];
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) {
  globalThis[name] = function () {
    netCalls.push(name);
    throw new Error("禁止网络调用: " + name);
  };
}

const mod = require(SCRIPT);
const { translate, DICT, RULES, SENT, HERE } = mod;
// 旧版脚本没有这两个导出。用兜底值而不是直接解构，这样「注回旧版脚本」验红时
// 得到的是断言失败，而不是整个套件在调用处崩掉。
const ctxText = mod.ctxText || (() => null);
const CTX = mod.CTX || [];

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : (fail++, console.error("  ✗ " + msg)); };
const eq = (got, want, msg) => ok(got === want, `${msg}\n      得到 ${JSON.stringify(got)}\n      期望 ${JSON.stringify(want)}`);
const tr = (s) => { const r = translate(s); return r === null ? null : r.v; };

console.log(`词典 ${Object.keys(DICT).length} 条 / 动态规则 ${RULES.length} 条 / 整句规则 ${SENT.length} 条 / here 规则 ${HERE.length} 条\n`);

// ① 返回结构：非 null 时必须是 {v:string, keepWs:boolean}
console.log("[1] translate() 返回结构（防 [object Object] 回归）");
for (const s of ["Settings", " tokens", "by ", "Routing Strategy", "Page ", "New Key", "spend"]) {
  const r = translate(s);
  ok(r === null || (typeof r === "object" && typeof r.v === "string" && typeof r.keepWs === "boolean"),
     `translate(${JSON.stringify(s)}) 返回结构不合法: ${JSON.stringify(r)}`);
}
ok(Object.values(DICT).every((v) => typeof v === "string" && !v.includes("object Object")),
   "词典值里出现非字符串或 [object Object]");

// ② 常规整串
console.log("[2] 常规整串");
eq(tr("Settings"), "设置", "Settings");
eq(tr("Virtual Keys"), "虚拟密钥", "Virtual Keys");
eq(tr("Save Changes"), "保存更改", "Save Changes");
eq(tr("  Home  "), "首页", "首尾空白应被保留处理（值本身不含空白）");

// ③ 片段键（含首尾空格，必须按原样命中）
console.log("[3] 片段键（防 trim 导致全部失效）");
eq(tr(" tokens"), " 个 Token", '" tokens" 片段');
eq(tr("by "), "来自 ", '"by " 片段');
eq(tr(" of "), " / ", '" of " 片段');
eq(tr(" servers"), " 台服务器", '" servers" 片段');
const frag = translate(" tokens");
eq(frag.keepWs, false, "片段键应整体替换（keepWs=false，值自带精确空格）");
eq(translate("Settings").keepWs, false, "无首尾空白时无需保留（keepWs=false）");
eq(translate("  Settings  ").keepWs, true, "有首尾空白时按去空白查并保留空白（keepWs=true）");
eq(tr("  Settings  "), "设置", "带首尾空白的常规键仍应命中");

// ④ 大小写：按 DOM 值（Title Case）建键；渲染成大写的不该命中
console.log("[4] 大小写（CSS text-transform 坑）");
eq(tr("Routing Strategy"), "路由策略", "DOM 值 Title Case");
eq(tr("Allowed Fails"), "允许失败次数", "DOM 值 Title Case");
eq(tr("ROUTING STRATEGY"), null, "渲染出来的大写不应命中（DOM 里不存在这种键）");
eq(tr("TIMEOUT"), null, "同上");

// ⑤ 数据必须不译
console.log("[5] 数据/标识符不译");
for (const s of ["openai/gpt-4o", "anthropic/claude-3-5-sonnet", "my_custom_key_name",
                 "default_user_id", "v1.106.0", "simple-shuffle", "2.3K", "$0.00", "100.0%",
                 "05fa04c202f64f431231e5dfa7f142653c042b43461f1c6138ff972b1adda027",
                 "277b3a5a-329e-44a5-86ce-7e2ab1e602aa", "tag_routing_prefix",
                 "https://docs.litellm.ai/docs/proxy/caching", "user@example.com",
                 "api.example.com/v1", "sk-abc123"]) {
  eq(tr(s), null, `不应翻译：${s}`);
}

// ⑥ 幂等：译文再查一次应为 null（否则会反复改写）
console.log("[6] 幂等性");
for (const s of ["Settings", "Virtual Keys", "Save Changes", "Routing Strategy", " tokens", "by "]) {
  const once = tr(s);
  if (once !== null) eq(tr(once), null, `幂等：${JSON.stringify(s)} → ${JSON.stringify(once)}`);
}

// ⑦ 动态规则
console.log("[7] 动态规则");
eq(tr("Page 1 of 1"), "第 1 页 / 共 1 页",
   "整串分页有规则命中；被拆成多个文本节点的场景由 doPagination 兜底（两者互补）");
eq(tr("5 days ago"), "5 天前", "相对时间");
eq(tr("Showing 1-2 of 2"), "显示第 1-2 条，共 2 条", "分页文案");
eq(tr("100.0% success rate"), "成功率 100.0%", "成功率");
eq(tr("High Complexity"), "高复杂度", "复杂度");
eq(tr("Reset budget_alert_ttl"), "重置 budget_alert_ttl", "重置按钮 aria");
eq(tr("Refresh"), "刷新", "普通词");

// ⑧ 词典自身完整性
console.log("[8] 词典完整性");
ok(Object.keys(DICT).every((k) => k.length > 0), "存在空键");
ok(Object.keys(DICT).every((k) => k.trim().length > 0), "存在纯空白键");
ok(Object.entries(DICT).every(([k, v]) => k !== v), "存在恒等映射（应在生成时剔除）");
ok(Object.values(DICT).every((v) => !/\bundefined\b/.test(v)), "词典值里出现 undefined");
ok(RULES.every(([re, rep]) => re instanceof RegExp && typeof rep === "string"),
   "RULES 结构不合法");

// ⑨ 离线自足：翻译完全在本地完成，运行时不得有任何第三方调用
//
// 用户口径（2026-10-14）："汉化翻译是你本地做的，实际使用时不应该有调用第三方的情况"。
// 这一节把该口径固化成断言，防止后续改动（尤其是新增远程字体/词典接口）悄悄引入外呼。
console.log("[9] 离线自足（零第三方调用）");
{
  const src = fs.readFileSync(SCRIPT, "utf8");
  const META_END = "==/UserScript==";
  const metaEnd = src.indexOf(META_END);
  ok(metaEnd > 0, "找不到 UserScript 元数据块结尾");
  const meta = src.slice(0, metaEnd);
  const body = src.slice(metaEnd);

  // 9.1 元数据不得声明任何会拉取外部资源的能力
  for (const key of ["@require", "@connect", "@resource", "@updateURL",
                     "@downloadURL", "@icon", "@iconURL"]) {
    ok(!meta.includes(key), `元数据不得包含 ${key}（会引入外部依赖或外呼）`);
  }
  // 9.2 注入契约：无特权沙箱、页面最早期注入
  ok(/@grant\s+none/.test(meta), "@grant 必须为 none（不申请任何特权 API）");
  ok(/@run-at\s+document-start/.test(meta), "@run-at 必须为 document-start");

  // 9.3 代码体不得出现网络 API（连"引用"都不允许，避免动态拼接绕过）
  for (const tok of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource",
                     "sendBeacon", "navigator.connection", "beacon"]) {
    ok(!body.includes(tok), `代码体不得出现网络 API：${tok}`);
  }
  // 9.4 不得动态加载代码（import()/require()/eval/new Function 都可能拉远程脚本）
  for (const tok of ["import(", "require(", "eval(", "new Function("]) {
    ok(!body.includes(tok), `代码体不得动态加载/求值：${tok}`);
  }

  // 9.5 每一个 http(s):// 都必须落在元数据行或词典数据行里，
  //     不得出现在可执行语句中（否则就是运行时外呼地址）
  const urlRe = /https?:\/\/[^\s"'`,)]+/g;
  const offenders = [];
  const seen = [];
  body.split("\n").forEach((line, i) => {
    const hits = line.match(urlRe);
    if (!hits) return;
    hits.forEach((u) => seen.push(u));
    // 允许的形态：词典/规则条目的字符串字面量行（缩进后以引号开头）
    if (!/^\s*["']/.test(line)) offenders.push(`第 ${i + 1} 行: ${line.trim().slice(0, 90)}`);
  });
  ok(offenders.length === 0,
     "可执行语句里出现 URL（应是运行时外呼地址）:\n      " + offenders.join("\n      "));

  // 9.6 元数据里的 URL 只能指向本仓库（namespace / homepageURL / supportURL）
  const metaUrls = meta.match(urlRe) || [];
  const allowed = metaUrls.every((u) => u.startsWith("https://github.com/LeoK77S/"));
  ok(allowed, `元数据 URL 越界：${JSON.stringify(metaUrls)}`);

  // 9.7 注入的字体/样式 CSS 不得引用远程资源（@import / url() / @font-face 都会外呼）
  for (const tok of ["@import", "url(", "@font-face"]) {
    ok(!body.includes(tok), `注入的 CSS 不得引用远程资源：${tok}`);
  }

  // 9.8 加载期运行陷阱：模块顶层代码没有发起任何网络调用
  ok(netCalls.length === 0, `加载期发生了网络调用：${JSON.stringify(netCalls)}`);

  // 9.9 附记证据：整份脚本里 URL 的实际分布（打印出来便于人工复核）
  console.log(`      代码体内 URL 出现 ${seen.length} 处（全部位于词典数据行）：` +
              JSON.stringify([...new Set(seen)]));
}

// ⑩ 句子被 JSX 拆成多节点时的片段键（R1 回归）
//
// 上游 JSX `{A} {B} across your gateway` 会渲染成多个文本节点，
// 词典里的**整句键**永远不等于任一节点 ⇒ 死键，句子里的英文片段全部漏译。
// 而行级残留判据（整行等于英文原文）会被"英文与中文拼在同一行"绕过，闸门看不见。
// 这三条锁住补上的片段键，防止被当成"冗余键"清理掉。
console.log("[10] 片段键（句子被拆成多节点，整句键命不中）");
eq(tr(" or "), " 或 ", "decisions 句中间的 or（整句键命不中，只译了片段）");
eq(tr(" across your gateway"), "（网关总计）", "model-insights 图表描述句尾");
eq(tr("Enable tag-based routing to route requests based on tags"),
   "启用基于标签的路由，按标签转发请求",
   "tag routing 字段描述（Learn more 是另一个节点，不能并进这个键）");
ok(tr(" 或 ") === null, "幂等：片段译文再查应为 null");

// ⑪ 标点规范：中文译文一律用 `…`（U+2026），不得用英文 `...`（R2 回归）
//
// 词典是分批建的，早期批次直接照搬了英文的 `...`，实测 16 条用 `...`、14 条用 `…`，
// 还有直接冲突对（`Search model names...` 与 `Search model names…` 两种写法并存），
// 导致同一个搜索框在不同页面显示不一致。这里锁成不变量，防止后续批次再混进来。
// 注意：**键**必须保持英文原文（两种省略号是不同的键），只约束**值**。
console.log("[11] 标点规范（省略号）");
{
  const bad = Object.entries(DICT).filter(([, v]) => v.includes("..."));
  ok(bad.length === 0,
     `词典值里出现英文省略号 ...（应作 …）：${bad.slice(0, 5).map(([k]) => k).join(" / ")}`);
  ok(Object.values(DICT).filter((v) => v.includes("…")).length >= 20,
     "含 … 的值少于 20 条，疑似省略号被批量清掉");
  eq(tr("Loading..."), "加载中…", "Loading... 的省略号应转成中文省略号");
  eq(tr("Search model names..."), "搜索模型名称…", "占位符省略号");
  eq(tr("Type your message... (Shift+Enter for new line)"), "输入消息…（Shift+Enter 换行）",
     "带全角括号的占位符，省略号也要转");
}

// ⑫ 交互态文案（tab / 下拉 / 折叠面板）——R3 回归
//
// 采集面从"静态 39 路由"（inner_text 首屏可见文本）扩到交互态后，发现整批漏译：
// 这些节点在 DOM 里存在、点开 tab 就可见，但不在首屏可见文本里，`inner_text` 抓不到，
// 于是从未被扫过也从未被译过。这里抽查各类代表，防止后续又退回"只看首屏"。
console.log("[12] 交互态文案（tab / 下拉 / 折叠面板）");
eq(tr("Last Minute"), "最近 1 分钟", "时间范围下拉项（同一下拉里「最近 24 小时」已译，其余漏译）");
eq(tr("Test Connect"), "测试连接", "添加模型面板的按钮");
eq(tr("Need Help?"), "需要帮助？", "折叠区标题");
eq(tr("Access & Permissions"), "访问与权限", "默认团队设置的分节标题");
eq(tr(" - Applies only to specific teams"), " - 仅对指定团队生效", "附件作用范围说明（带前导空格）");
eq(tr("✨ Enterprise Feature."), "✨ 企业版功能。", "带 emoji 的提示");
eq(tr("API Keys → Edit Key → MCP Servers"), "虚拟密钥 → 编辑密钥 → MCP 服务器",
   "路径提示按侧边栏实际入口名译（英文原文写 API Keys，侧边栏显示「虚拟密钥」）");
ok(tr("企业版功能提示") === null, "幂等：交互态译文再查应为 null");

// ⑬ models-and-endpoints 面板（R4 回归）
//
// R3 把采集面扩到交互态后，该路由仍剩 111 个未译节点（tab 面板里的标签、说明、空状态）。
// 这里抽查各 tab 的代表条目。
console.log("[13] models-and-endpoints 面板");
eq(tr("LiteLLM Model Name(s)"), "LiteLLM 模型名（可多个）", "添加模型：字段标签");
eq(tr("Model Mappings"), "模型映射", "添加模型：分节标题");
eq(tr("Add a pass-through endpoint to route custom paths."), "添加透传端点，用于转发自定义路径。",
   "透传端点：空状态说明");
eq(tr("Auto routers sit above your deployments and pick a model per request. "
   + "They are called like any other model, so clients keep using a single model name."),
   "自动路由位于各部署之上，按请求挑选模型。调用方式与普通模型相同，客户端始终只用同一个模型名。",
   "自动路由：长说明（R10 把「被调用」改成主动表述）");
eq(tr("No rows match your search or filters."), "没有符合搜索或筛选条件的行。", "空状态");
eq(tr("Global Retry Policy"), "全局重试策略", "模型重试设置");
eq(tr("Manage model pricing data and configure automatic reload schedules"),
   "管理模型定价数据，并配置自动重载计划", "重载价格数据");
eq(tr("Hide New Feature Indicators"), "隐藏新功能提示", "顶部显示选项菜单");
eq(tr("Logout"), "退出登录", "账户菜单");
ok(tr("没有符合搜索或筛选条件的行。") === null, "幂等：R4 译文再查应为 null");

// ⑭ 交互态**属性**侧（R4 回归）
//
// 属性闸门此前只比对"不点 tab"采集的 pages_en / pages_zh，于是只在 tab 面板里出现的
// placeholder / aria-label 从未被看过 —— 实测「添加模型」里的
// `<input placeholder="Select a provider">` 一直是英文，而闸门报「属性侧真残留 0」。
console.log("[14] 交互态属性侧（placeholder / aria-label）");
eq(tr("Select a provider"), "选择供应商", "添加模型：供应商下拉的 placeholder");
eq(tr("Select or search for existing credentials"), "选择或搜索已有凭据", "凭据选择 placeholder");
eq(tr("e.g., gpt-4o"), "例如 gpt-4o", "别名输入框 placeholder");
eq(tr("RateLimitError (429) retry count"), "RateLimitError (429) 的重试次数",
   "重试次数输入框的 aria-label（错误类名保留英文）");
eq(tr("Select all rows"), "全选", "表格表头复选框的 aria-label");
eq(tr("AIM Guardrail logo"), "AIM Guardrail 图标",
   "厂商目录图片 alt：品牌名保留英文，`logo` 作「图标」（动态规则）");
eq(tr("openai logo"), "openai 图标", "同上（小写品牌名）");

// ⑮ mcp-servers 面板（R5 回归）
console.log("[15] mcp-servers 面板");
eq(tr("MCP Toolsets"), "MCP 工具集", "工具集 tab");
eq(tr("Semantic Tool Filtering"), "语义工具过滤", "语义过滤 tab");
eq(tr("Private IP Ranges"), "私有 IP 段", "网络设置 tab");
eq(tr("Submission Rules"), "提交规则", "已提交的 MCP tab");
eq(tr("Each MCP client supports different transports. Refer to your client documentation "
   + "to determine the appropriate transport method."),
   "各 MCP 客户端支持的传输方式不同。请查阅客户端文档，确定该用哪种传输方式。", "连接 tab 长说明");
eq(tr("Your current IP:"), "当前 IP：", "带全角冒号的短标签");
eq(tr("(Mac) or"), "（Mac）或", "快捷键说明片段（半角括号转全角）");
eq(tr("). Connect an AI client to the gateway to see it here."),
   "）。把 AI 客户端接入网关后即可在此查看。", "实时连接空状态片段（以「)」开头）");

// ⑯ logging-and-alerts 面板（R6 回归）
console.log("[16] logging-and-alerts 面板");
eq(tr("Email Notifications"), "邮件通知", "邮件告警 tab");
eq(tr("Microsoft Teams Alerting Settings"), "Microsoft Teams 告警设置", "MS Teams 告警 tab");
eq(tr("Budget Alerts (API Keys, Users)"), "预算告警（API 密钥、用户）", "告警类型");
eq(tr("Receive an email notification when soft  budget  crossed"),
   "软预算超限时发送邮件通知", "含双空格的复选框标签（原 DOM 里 <b> 两侧各一个空格）");
eq(tr("No CloudZero Integration Found"), "未找到 CloudZero 集成", "CloudZero tab 空状态");
eq(tr("LiteLLM Docs: email alerts"), "LiteLLM 文档：邮件告警", "文档链接");

// ⑰ policies 面板（R7 回归）
console.log("[17] policies 面板");
eq(tr("About Policy Attachments"), "关于策略附件", "附件 tab");
eq(tr("Attachment Scopes:"), "附件作用范围：", "作用范围标签");
eq(tr("- Applies to all requests"), "- 适用于所有请求", "作用范围说明（带前导连字符）");
eq(tr("Global (*)"), "全局（*）", "全局作用域");
eq(tr("No simulation run yet"), "尚未运行模拟", "模拟器空状态");
eq(tr("No attachments found"), "未找到附件", "附件空状态");

// ⑱ teams 面板（R8 回归）
console.log("[18] teams 面板（默认团队设置）");
eq(tr("Team Member Permissions"), "团队成员权限", "分节标题");
eq(tr("Budget Duration"), "预算周期", "字段标签");
eq(tr("RPM Limit"), "RPM 限制", "限流字段（缩写保留）");
eq(tr("Maximum tokens per minute allowed across all models."),
   "所有模型合计每分钟允许的最大 Token 数。", "限流说明");
eq(tr("Not set"), "未设置", "未设置占位");
eq(tr("Members"), "成员", "列菜单");

// ⑲ logs 面板（R9 回归）
console.log("[19] logs 面板（审计日志 / 已删除密钥 / 已删除团队）");
eq(tr("Coming soon to Enterprise"), "企业版即将推出", "审计日志占位");
eq(tr("Here's a preview of what Audit Logs offer:"), "以下是审计日志提供的功能预览：", "预览引导");
eq(tr("This is a LiteLLM Enterprise feature, and requires a valid key to use."),
   "这是 LiteLLM 企业版功能，需要有效密钥才能使用。", "企业版提示");
eq(tr("Keys deleted from this proxy will show up here."), "从此代理删除的密钥会显示在这里。", "空状态");
eq(tr("No deleted teams found"), "未找到已删除的团队", "空状态");

// ⑳ 本轮自己引入的机翻腔回归（R10）
//
// 自审发现：R3–R9 补的译文里有一批英文客服/营销腔直译 —— 我们 / 你 / 如果 / 会被 / 可以 / 此，
// audit_tone.py 命中数从起点 16 涨到 42。逐条判过后修掉 12 条真问题，
// 并收紧检测器判据（`其他` / `第一个` / `一个或多个` 是正常中文，属误报）。
console.log("[20] 机翻腔回归修正（R10）");
ok(!Object.values(DICT).some((v) => /我们/.test(v)), "词典值里仍有「我们」");
ok(!Object.values(DICT).some((v) => /[你您]/.test(v)), "词典值里仍有第二人称");
eq(tr("Your Private Network Ranges"), "私有网络段", "去掉「你的」");
eq(tr("Connect to your MCP client"), "接入 MCP 客户端", "去掉「你的」");
eq(tr("You"), "本人", "下拉选项指当前登录用户，不译作「你」");
ok(tr("此处占位") === null, "幂等：R10 译文再查应为 null");

// ㉑ 日期本地化（R11）
//
// 界面上的日期原样是英文（`Oct 14, 2026` / `Oct 14, 23:46:40` / `8 Oct, 02:51 - 15 Oct, 02:51`），
// 属真实的本地化缺口 —— 中文界面应作 `2026 年 10 月 14 日`。月份名映射只能放在 JS 里
// （正则无法把 `Oct` 映射成 `10`），所以这里同时锁住映射表与四种格式。
console.log("[21] 日期本地化（R11）");
eq(tr("Oct 14, 2026"), "2026 年 10 月 14 日", "完整日期");
eq(tr("Oct 14"), "10 月 14 日", "月-日");
eq(tr("Oct 7"), "10 月 7 日", "个位数日");
eq(tr("Oct 14, 23:46:40"), "10 月 14 日 23:46:40", "月-日 + 时刻");
eq(tr("8 Oct, 02:51 - 15 Oct, 02:51"), "10 月 8 日 02:51 - 10 月 15 日 02:51", "时间范围");
eq(tr("Jan 1, 2027"), "2027 年 1 月 1 日", "跨月（验证 12 个月映射都在）");
eq(tr("Dec 31"), "12 月 31 日", "十二月");
// 反例：不能把普通英文单词/标识符当日期吃掉
eq(tr("May be required"), null, "`May` 开头的普通句子不能被当成日期");
eq(tr("Mar 3x"), null, "月名 + 非数字不匹配");
ok(tr("2026 年 10 月 14 日") === null, "幂等：日期译文再查应为 null");

// ㉒ policies / guardrails 目录（R11 口径变更）
//
// 旧口径把这两个目录整块列为「有意保留英文」（见 VERIFY.md §5），R11 改为
// 「描述性名称 / 分类 / 说明译成中文，厂商产品名与法律缩写保留英文」。
// 保留英文的判据是「专有名词」而非「懒得译」，所以这里的断言同时锁住两侧。
console.log("[22] policies / guardrails 目录（R11 口径变更）");
eq(tr("Financial Services"), "金融服务", "policies：行业分类名");
eq(tr("Healthcare"), "医疗", "policies：行业分类名");
eq(tr("UAE"), "阿联酋", "policies：地区分类名");
eq(tr("Baseline PII Protection"), "基础 PII 防护", "policies：模板名（PII 缩写保留）");
eq(tr("Singapore MAS — AI Risk Management for Financial Institutions"),
   "新加坡 MAS — 金融机构 AI 风险管理", "policies：模板名（法律缩写 MAS 保留）");
eq(tr("Guardrail Testing Playground"), "护栏测试演练场", "guardrails：页面标题");
eq(tr("LiteLLM Content Filter"), "LiteLLM 内容过滤", "guardrails：内置护栏名");
eq(tr("Bias: Gender"), "偏见：性别", "guardrails：内置护栏名（全角冒号）");
eq(tr("Denied Financial Advice"), "拒绝：财务建议", "guardrails：内置护栏名");
// 厂商产品名与法律缩写必须原样保留
for (const s of ["Amazon Bedrock", "Vertex AI Search", "Milvus", "MongoDB (BETA)",
                 "FIPPA", "PIPEDA", "GDPR", "MAS", "PDPA", "Streamable HTTP",
                 "simple-shuffle", "least-busy", "cost-based-routing", "acompletion",
                 "RateLimitError (429)", "Ctrl K"]) {
  eq(tr(s), null, `保留英文（专有名词/标识符）：${s}`);
}

// ㉓ 片段键的空格变体（R11）
//
// React 把 ` or ` 拆成两个文本节点：" or" + " "。此前片段键只登记了带两侧空格的
// `' or '`，于是只带一侧空格的节点永远命不中 —— 页面上就是「Cmd+S or Ctrl+S」
// 这种英文黏在中文里的半译残留。现在 translate() 会依次试 无空格/前置/后置/两侧 四种。
console.log("[23] 片段键的空格变体（R11）");
eq(tr(" or"), " 或", "只带前导空格的片段键");
// 返回的是**值**，节点自己的空白由调用方按原样回填（keepWs），
// 所以这里断言值本身；渲染出来的结果由 [10] 之外的实机验证兜住。
eq(tr("or "), " 或", "只带后置空格的片段键");
eq(tr(" or "), " 或 ", "两侧都带空格（原有键，仍命中）");
eq(tr("across your gateway"), "（网关总计）", "无空格的片段键也能命中（后置变体）");
ok(tr("或") === null, "幂等：空格变体译文再查应为 null");

// ㉔ 上下文覆盖（R11）
//
// 词典是「全局唯一值」，给不了随控件而变的意思：`Log` 在侧边栏是「日志」，
// 在图表刻度的单选组里是「对数」。按词典译会**自信地译错**（闸门只查"译没译"，
// 查不出这个）。CTX 用祖先选择器把这一处覆盖掉，这里锁住它的行为与作用范围。
console.log("[24] 上下文覆盖 CTX（R11）");
eq(tr("Log"), "日志", "默认（词典）：Log = 日志");
eq(tr("log"), "对数", "小写 log 是刻度档位");
eq(tr("Linear"), "线性", "刻度档位");
eq(tr("linear"), "线性", "刻度档位（小写）");
{
  const inScale = { nodeValue: "Log", parentElement: { closest: () => ({}) } };
  eq(ctxText(inScale), "对数", "刻度单选组里 Log → 对数");
  const outScale = { nodeValue: "Log", parentElement: { closest: () => null } };
  ok(ctxText(outScale) === null, "不在刻度控件里时不覆盖（回到词典）");
  const other = { nodeValue: "Logs", parentElement: { closest: () => ({}) } };
  ok(ctxText(other) === null, "刻度控件里的别的词不受影响");
  ok(CTX.length >= 1 && /Scale|刻度/.test(CTX[0].sel), "CTX 判据是中英双写的祖先选择器");
}

// ㉕ 半译残留（R11）
//
// 「闸门报 0」只说明**它看过的样本**里没问题。这一批都是英文黏在已译中文里的残留，
// 而它们各自只在某个 tab/下拉里出现 —— 采集面不扩到那儿就永远看不见。
console.log("[25] 半译残留（R11）");
eq(tr("Endpoints"), "端点", "usage 页卡片标题");
eq(tr("endpoint"), "个端点", "`1 endpoint` 的片段（数字是相邻节点）");
eq(tr("header"), "请求头", "「通过传入 x-mcp-servers header」的后半截");
eq(tr("Requests/"), "请求数/", "表头 `Requests/月` 的前半截");
eq(tr("EU"), "欧盟", "policies 页地区分类（同组其他地区名已译）");
eq(tr("results"), "个结果", "`0 results` 的片段");
eq(tr("Select 05fa04c202f64f431231e5dfa7f142653c042b43461f1c6138ff972b1adda027"),
   "选择 05fa04c202f64f431231e5dfa7f142653c042b43461f1c6138ff972b1adda027",
   "行复选框 aria-label：前缀译出、行 id 原样");
ok(tr("Select a team") === null, "规则收窄到 sha256，不套普通 Select 短语");
eq(tr("Cloud Coding Agent"), "云端编码智能体", "视图切换器里的另一个视图名");

// ㉖ 规则不该把正常短语吞成半译（R11 重扫所得）
//
// `^Reset ([A-Za-z_][\w.]*)$` -> `重置 $1` 本意是匹配 aria-label="Reset <setting_key>"，
// 但上游源码里 `Reset Budget` / `Reset Password` / `Reset all` / `Reset spend` 也被它命中，
// 于是页面出现 `重置 Budget` 这种半译 —— **规则本身看不出错**，是"中英混排重扫"扫出来的。
// 现在规则只匹配小写 snake_case 标识符，那 4 个短语改为显式条目。
console.log("[26] 规则边界：不把正常短语吞成半译（R11）");
eq(tr("Reset budget_alert_ttl"), "重置 budget_alert_ttl", "标识符形状仍走规则");
eq(tr("Reset Budget"), "重置预算", "正常短语走显式条目");
eq(tr("Reset Password"), "重置密码", "同上");
eq(tr("Reset all"), "重置全部", "同上");
eq(tr("Reset spend"), "重置花费", "同上");
ok(tr("重置预算") === null, "幂等：再查应为 null");

// ㉗ 顶栏通知下拉（R12）
//
// 这一面此前**从未被任何闸门看过**：采集器的下拉触发器列表带了 `.filter(x => x.text)`，
// 把纯图标触发器整个滤掉 —— 顶栏铃铛没有文字，于是通知面板里的文案一直是英文，
// 而闸门报「待修 0」。用户在界面上直接看到了它（截图见 docs/shots/r11-home-notify-*）。
console.log("[27] 顶栏通知下拉（R12）");
eq(tr("LiteLLM Auto Router"), "LiteLLM 自动路由", "通知标题（与侧边栏「自动路由」一致）");
eq(tr("Route every request to the cheapest model that can handle it, no prompt changes needed."),
   "把每个请求路由到能处理它的最便宜模型，无需修改提示词。", "通知正文");
eq(tr("Read the docs"), "阅读文档", "通知里的按钮");
eq(tr("Mark as read"), "标记为已读", "通知里的按钮");
ok(tr("标记为已读") === null, "幂等：再查应为 null");

// ㉘ 弹窗 / 表单面板（R12）
//
// 这一面此前**从未被采过**：`dump_nodes_interactive.py` 只点 tab 与下拉触发器，
// 弹窗要点「+ 新建…」才会出现。补上采集面后一次扫出 60+ 条漏译。
console.log("[28] 弹窗 / 表单面板（R12）");
// 邀请用户
eq(tr("Create a User who can own keys"), "创建可拥有密钥的用户", "邀请用户：说明");
eq(tr("Email invitations"), "邮件邀请", "邀请用户：分节");
eq(tr("Personal Key Creation"), "个人密钥创建", "邀请用户：分节");
eq(tr("Send invitation email"), "发送邀请邮件", "邀请用户：按钮");
eq(tr("Enter metadata as JSON"), "以 JSON 输入元数据", "邀请用户：placeholder");
// 批量邀请（CSV）
eq(tr("Template Column Names"), "模板列名", "批量邀请：列名说明");
eq(tr('User\'s email address (required)'), "用户邮箱地址（必填）", "批量邀请：列说明");
eq(tr("Only CSV files (.csv) are supported"), "仅支持 CSV 文件（.csv）", "批量邀请：提示");
// 添加 MCP 服务器
eq(tr("Add MCP Server"), "添加 MCP 服务器", "MCP：标题");
eq(tr("+ Custom Server"), "+ 自定义服务器", "MCP：按钮");
eq(tr("Cloud"), "云端", "MCP：卡片分类标签");
eq(tr("Web & Browser"), "网页与浏览器", "MCP：卡片分类标签");
// 配置模型回退
eq(tr("Configure Model Fallbacks"), "配置模型回退", "回退：标题");
eq(tr("IF FAILS, TRY..."), "失败则尝试…", "回退：分节");
eq(tr("Manage multiple fallback chains for different models (up to 5 groups at a time)"),
   "为不同模型管理多条回退链（一次最多 5 组）", "回退：长说明");
// 新建策略 / 新建标签
eq(tr("Flow Builder"), "流程编排器", "策略：模式名");
eq(tr("Define steps, conditions, and error responses."), "定义步骤、条件与错误响应。", "策略：说明");
eq(tr("Budget & Rate Limits (Optional)"), "预算与限流（可选）", "标签：分节");
// 密钥类型
eq(tr("Agent"), "智能体", "密钥类型（与侧边栏「智能体」一致）");
// 保留英文的：MCP 服务器产品名、CSV 模板列名、通用缩写
for (const s of ["GitHub", "Slack", "PostgreSQL", "Microsoft 365 (Graph)",
                 "Atlassian (Jira & Confluence)", "user_email", "user_role", "teams",
                 "AI API"]) {
  eq(tr(s), null, `保留英文（产品名/列名/缩写）：${s}`);
}
ok(tr("创建可拥有密钥的用户") === null, "幂等：再查应为 null");

// ㉙ 全 40 路由逐页核验（R13）
//
// 起因：用户口径「对所有页面进行验证，页面包括二级菜单、通知栏等位置」。
// 补齐路由表（20→40）后，管理面板 / 成本优化 / 演练场 / Lens / 技能中心 / 搜索工具
// 这些**此前从未被任何闸门看过**的页面一次扫出 396 条漏译。
// 同轮还修了闸门粒度：默认视图此前取 inner_text 行、属性侧取 btn/th/option 的
// 元素级 textContent，而行与元素正文是渲染拼接产物（`Amazon Bedrock` + `▼`），
// 脚本按文本节点查表，这类候选永远译不掉。
console.log("[29] 全 40 路由逐页核验（R13）");
// admin-panel（管理面板）
eq(tr("Add Plugin"), "添加插件", "管理面板：插件");
eq(tr("Add SSO"), "添加 SSO", "管理面板：SSO");
eq(tr("Allowed IPs"), "允许的 IP", "管理面板：安全");
eq(tr("Create SCIM Token"), "创建 SCIM 令牌", "管理面板：SCIM");
eq(tr("Configure Page Visibility"), "配置页面可见性", "管理面板：界面设置");
eq(tr("Publish user banner"), "发布用户横幅", "管理面板：用户横幅");
eq(tr("Max Agentic Loops"), "最大智能体循环次数", "管理面板：联网搜索拦截");
eq(tr("Spend Logs Cleanup Batch Size (Optional)"), "花费日志清理批大小（可选）", "管理面板：日志设置");
// cost-optimization（成本优化）
eq(tr("Actual auto-router spend"), "自动路由实际花费", "成本优化：自动路由");
eq(tr("Uncached input tokens"), "未缓存输入令牌", "成本优化：缓存");
eq(tr("Headroom prompt compression"), "Headroom 提示词压缩", "成本优化：提示词压缩");
eq(tr("Shadow Evals"), "盲测评估", "成本优化：盲测");
eq(tr("previous turn → same tier"), "上一轮 → 同一档位", "成本优化：分桶说明");
// playground（演练场）
eq(tr("Agent Builder"), "智能体构建器", "演练场：实验特性");
eq(tr("Topic Blocking"), "话题屏蔽", "演练场：合规分类");
eq(tr("Biometric Categorisation of Sensitive Traits"), "敏感特质生物特征分类", "演练场：EU AI Act 分类");
eq(tr("Canadian PII (PIPEDA)"), "加拿大个人信息（PIPEDA）", "演练场：法规名（缩写保留）");
eq(tr("EU AI Act"), "欧盟 AI 法案", "演练场：法规名");
eq(tr("Valid payload"), "载荷有效", "演练场：表单校验");
eq(tr("Simulate ("), "模拟（", "演练场：片段键（后接计数）");
// lens / model-hub-table / skills / search-tools / old-usage 等
eq(tr("Signals are off"), "信号已关闭", "Lens");
eq(tr("Where your agents send runs so Lens can read them."),
   "智能体把运行数据发到这里，Lens 才能读取。", "Lens：长说明");
eq(tr("Total Skills"), "技能总数", "AI 中心");
eq(tr("workflows"), "工作流", "技能表单：分类示例值");
eq(tr("Your Name or Organization"), "姓名或组织", "技能表单：去掉「你的」");
eq(tr("Enter your API key"), "输入 API 密钥", "搜索工具：去掉「你的」");
eq(tr("Search Tool Name"), "搜索工具名称", "搜索工具");
eq(tr("Spend Per Tag"), "每标签花费", "旧版用量");
eq(tr("Copy User ID"), "复制用户 ID", "连接页");
eq(tr("Success & Failure"), "成功与失败", "日志与告警");
eq(tr("healthy"), "健康", "端点健康态");
eq(tr("Staging"), "预发", "环境名");
// 计算值格式（数字会变，只能给规则）
eq(tr("($0.00 / 1K turns)"), "（$0.00 / 1K 轮次）", "成本优化：零值");
eq(tr("($12.34 / 1K turns)"), "（$12.34 / 1K 轮次）", "成本优化：非零值（规则要带捕获组）");
eq(tr("· 0 sessions"), "· 0 个会话", "Lens：会话数");
eq(tr("· 1 session"), "· 1 个会话", "Lens：单数形式");
// 日期：成本优化页的日期范围是 `Sep 15 – Oct 15`（en dash、无年份与时刻）
eq(tr("Sep 15 – Oct 15"), "9 月 15 日 - 10 月 15 日", "日期：月日范围（en dash）");
eq(tr("Sep 15 - Oct 15"), "9 月 15 日 - 10 月 15 日", "日期：月日范围（半角连字符）");
ok(tr("9 月 15 日 - 10 月 15 日") === null, "幂等：日期范围译文再查应为 null");
// 保留英文：厂商产品名 / 法规缩写 / 通用缩写 / HTTP 头 / 模型名 / 示例值
for (const s of ["Hashicorp Vault", "CyberArk Conjur", "GDPR", "SCIM", "URL", "CSV", "cURL",
                 "User-Agent", "Shift+Enter", "TimeoutError: 408",
                 "deepseek", "zai", "deepseek-v4.1-flash", "glm-5.3-flash",
                 "global:glm-5.3-flash", "global:deepseek-v4.1-flash",
                 "author@example.com", "product@berri.ai", "litellm-...", "litellm_...",
                 "LangChain（Python）", "LlamaIndex", "OpenAI Python SDK", "search, web, api"]) {
  eq(tr(s), null, `保留英文（产品名/缩写/数据）：${s}`);
}
// 半译回归：规则把 `$1` 嵌进译文时，不能把英文原样留在译文里
ok(!Object.values(DICT).some((v) => /1K turns/.test(v)), "不得把英文原样留在译文里");
ok(!Object.values(DICT).some((v) => /我们|[你您]/.test(v)), "R13 新增译文不得引入第一/第二人称");

// ㉚ 被闸门长度上限藏起来的样本（R13 收尾）
//
// 闸门原本把长度 > 400 字符的候选**静默丢掉**。policies 页 4 条模板长描述
// （445~523 字符）因此长期不在闸门视野里 —— 闸门报"待修 0"，用户却看得见英文。
// 上限改为共享常量（keep_r11.MAX_CAND_LEN）并显式报出丢弃量；这里锁住这批长译文。
console.log("[30] 长描述（曾被长度上限藏起来）");
eq(tr("Topic Control"), "话题管控", "模板名：话题管控");
eq(tr("Injection Protection"), "注入防护", "模板名：注入防护");
eq(tr("Airline Off-Topic Restriction"), "航空离题限制", "模板名：航空离题限制");
eq(tr("Detects and blocks prompt injection attacks, SQL injection attempts, code injection, and " +
      "jailbreak attempts. Protects against adversarial inputs that try to override system " +
      "instructions or extract sensitive information."),
   "检测并拦截提示词注入、SQL 注入、代码注入与越狱尝试。" +
   "防御试图覆盖系统指令或套取敏感信息的对抗性输入。", "模板描述：注入防护（219 字符）");
ok(Object.keys(DICT).some((k) => k.length > 400 && k.startsWith("Monetary Authority of Singapore")),
   "500+ 字符的模板描述必须已进词典（否则就是被长度上限丢掉了）");
// 片段键：`Decisions 演练场` 里的 Decisions 是演练场标签，要译
eq(tr(", or try them in the Decisions playground."), " 调用，或在决策演练场里试用。",
   "片段：Decisions 演练场（与演练场的「决策」标签页一致）");

// ㉛ 站点指纹门禁（宽匹配下只对 LiteLLM 控制台生效）
//
// @match 从写死的内网地址改为宽匹配 `*://*/ui/*` 后，覆盖面变大，代价是别的站点
// 若也有 /ui 路径会被注入。因此运行时必须再确认一次「这确实是 LiteLLM 控制台」。
// 这里锁住判据的两条腿，以及指纹判错时的逃生口。
console.log("[31] 站点指纹门禁（宽匹配下只对 LiteLLM 控制台生效）");
{
  const doc = globalThis.document;
  const savedTitle = doc.title;
  const savedQS = doc.querySelector;

  doc.title = "LiteLLM Dashboard";
  ok(mod.isLiteLLMConsole() === true, "title 含 LiteLLM ⇒ 判定为控制台");
  doc.title = "Virtual Keys";
  doc.querySelector = () => ({});
  ok(mod.isLiteLLMConsole() === true, "title 不含但存在 litellm-asset-prefix 资源 ⇒ 判定为控制台");
  doc.querySelector = () => null;
  ok(mod.isLiteLLMConsole() === false, "两条判据都不满足 ⇒ 不是控制台（静默退出）");

  // 逃生口：指纹判错时可由用户强制启用
  const savedLS = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (k === "litellm-i18n-force" ? "1" : null), setItem() {} };
  ok(mod.forceEnabled() === true, "localStorage 强制开关生效");
  globalThis.localStorage = savedLS;
  ok(mod.forceEnabled() === false, "无强制开关时不启用");

  doc.title = savedTitle;
  doc.querySelector = savedQS;
}

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
