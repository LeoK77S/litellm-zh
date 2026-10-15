# LiteLLMZh 术语表（强制统一）

翻译 LiteLLM 控制台界面文案时严格遵守。与同作者的 Bifrost 仪表盘汉化（`bifrost-zh`）
保持同一套译法，便于在两个网关控制台之间来回看时不串味。

## 核心术语（必须使用右列译法）

| 英文 | 译法 | 备注 |
|---|---|---|
| AI Gateway | AI 网关 | |
| Virtual Key / VK | 虚拟密钥 | |
| Key | 密钥 | |
| Key Alias | 密钥别名 | |
| Key Hash | 密钥哈希 | |
| Master Key | master key | 保留英文（配置里就是这个字面量） |
| Team | 团队 | |
| Internal User | 内部用户 | |
| Organization | 组织 | |
| Access Group | 访问组 | |
| Budget | 预算 | |
| Spend | 花费 | 名词 |
| Cost | 成本 | |
| Usage | 用量 | |
| Requests | 请求数 | 表头 |
| Tokens | Token | 计数单位保留英文 |
| Rate Limit / RPM / TPM / TPD | 速率限制 / RPM / TPM / TPD | 缩写保留 |
| Model | 模型 | |
| Model Group Alias | 模型组别名 | |
| Provider | 供应商 | |
| Endpoint | 端点 | |
| Pass-Through Endpoint | 透传端点 | |
| Deployment | 部署 | |
| Router / Routing Strategy | 路由 / 路由策略 | |
| Fallback | 回退 | |
| Retry | 重试 | |
| Timeout | 超时 | |
| Cooldown | 冷却 | |
| Guardrail | 护栏 | |
| Guardrail Garden | 护栏园地 | |
| Policy | 策略 | |
| Policy Template | 策略模板 | |
| Policy Simulator | 策略模拟器 | |
| MCP Server | MCP 服务器 | MCP 保留 |
| Toolset | 工具集 | |
| Skill / Skill Hub | 技能 / 技能中心 | |
| Agent | 智能体 | |
| Agent Hub | 智能体中心 | |
| Workflow | 工作流 | |
| Memory | 记忆 | |
| Prompt | 提示词 | |
| Prompt Caching | 提示词缓存 | |
| Response Cache | 响应缓存 | |
| Cache Hit | 缓存命中 | |
| Cache Hit Ratio | 缓存命中率 | |
| Compression | 压缩 | |
| Cost Optimization | 成本优化 | |
| Logs | 日志 | |
| Audit Logs | 审计日志 | |
| Trace / Tracing | 链路 / 链路追踪 | |
| Session | 会话 | |
| Playground | 演练场 | |
| Dashboard | 控制台 | 本脚本统一译"控制台"（`LiteLLM Dashboard` → `LiteLLM 控制台`） |
| Lens | Lens | 产品名，保留 |
| Moyai | Moyai | 产品名，保留 |
| Decisions | 决策 | **R13 口径变更**：原按「功能名保留」处理，但演练场标签页与 `Decisions 演练场` 片段因此中英混排（同一个 tab 条里只有它是英文）。实测该词只作界面标签出现（tab / aria-label / 「Decisions playground」），`/v1/decisions` 是路径、另有规则处理不译，故改为译出 |
| Alerting | 告警 | |
| Callback | 回调 | |
| SSO | SSO | 保留 |
| SCIM | SCIM | 保留 |
| Credential | 凭据 | |
| Vector Store | 向量库 | |
| Embedding | 嵌入 | |
| Attachment | 附件 | |
| Tag | 标签 | |
| Project | 项目 | |
| Overview | 概览 | |
| Leaderboard | 排行榜 | |
| Beta | Beta | 徽标，保留 |
| Enterprise Feature | 企业版功能 | |
| Auto Router | 自动路由 | R13 |
| Shadow Eval | 盲测评估 | R13：用真实流量让 LLM 评判器盲评两套答案 |
| Prompt Compression | 提示词压缩 | R13 |
| Prompt Caching | 提示词缓存 | R13 |
| Headroom | Headroom | R13：LiteLLM 原生压缩护栏的产品名，保留 |
| System 1 | System 1 | R13：LiteLLM 术语（快思考档位，与 System 2 相对）。译作「系统 1」会被读成"1 号系统"，故保留 |
| Injection Protection | 注入防护 | R13：策略模板名 |
| Topic Control / Filtering / Restriction | 话题管控 / 话题过滤 / 话题限制 | R13：策略模板名 |
| Off-Topic | 离题 | R13 |
| Finding | 发现 | R13：Lens 的调查产出 |
| Dataset | 数据集 | R13 |
| Investigation | 调查 | R13 |
| Traces | 链路 | 与 Trace 一致 |
| SCIM Tenant URL | SCIM 租户 URL | R13 |
| User Banner | 用户横幅 | R13：管理面板的公告横幅 |
| Page Visibility | 页面可见性 | R13 |
| Secret Manager | 密钥管理器 | R13 |

## 通用 UI 用语

| 英文 | 译法 |
|---|---|
| Save / Save Changes | 保存 / 保存更改 |
| Cancel | 取消 |
| Delete | 删除 |
| Edit | 编辑 |
| Add | 添加 |
| Create | 创建 |
| Update | 更新 |
| Remove | 移除 |
| Close | 关闭 |
| Back | 返回 |
| Search | 搜索 |
| Filters | 筛选 |
| Reset Filters | 重置筛选 |
| Clear | 清除 |
| Copy | 复制 |
| Export CSV | 导出 CSV |
| Import from JSON | 从 JSON 导入 |
| Download / Upload | 下载 / 上传 |
| Refresh | 刷新 |
| Apply | 应用 |
| Confirm | 确认 |
| Enabled / Disabled | 启用 / 已禁用 |
| Enable / Disable | 启用 / 禁用 |
| Required | 必填 |
| Optional | 可选 |
| Default | 默认 |
| Coming soon | 即将推出 |
| No results | 无结果 |
| No data for this period | 该时间段无数据 |
| Learn more | 了解更多 |
| Loading... | 加载中… |
| Failed / Successful | 失败 / 成功 |
| Active | 启用 |
| Rejected | 已拒绝 |
| Pending Review | 待审核 |
| All | 全部 |
| None | 无 |
| Not Set | 未设置 |
| Unlimited | 无限制 |
| Yes / No | 是 / 否 |
| Status | 状态 |
| Name | 名称 |
| Description | 描述 |
| Type | 类型 |
| Value | 值 |
| Actions | 操作 |
| Select | 选择 |
| None selected | 未选择 |
| Rows per page | 每页行数 |
| Page N of M | 第 N 页 / 共 M 页 |
| Showing A-B of C | 显示第 A-B 条，共 C 条 |

## 格式要求

- **键必须与页面上的英文原文逐字节一致**：含大小写、标点、前导/尾随空格、
  省略号 `…`（U+2026）与 `...`（三个点）是**两个不同的键**、弯引号 `’` `“ ”`、破折号 `—`。
  （这条约束的是**键**——英文原文怎么写就怎么建键。）
- **值里的省略号一律用 `…`（U+2026），不得用英文 `...`**：中文排版不用三个半角点，
  且同一功能在不同页面会显示成 `搜索模型名称...` / `搜索密钥…` 两种写法。
  该不变量由 `tests/test_translate.mjs` §11 把关。
- 值不要包含英文引号；需要引号时用中文引号 `“ ”` 或直角引号 `「」`。
- 保留英文的技术标识符不译：环境变量名、配置键（`tag_routing_prefix`）、
  请求头、协议名（`Streamable HTTP`）、语言名（`python` / `cURL`）、
  厂商与产品名（OpenAI / Anthropic / Redis / Hashicorp Vault / LlamaIndex …）。
- 数字、货币、百分比、UUID、哈希一律不译。
- **日期要译**（R11 起）：`Oct 14, 2026` → `2026 年 10 月 14 日`；`Oct 14` → `10 月 14 日`；
  `Oct 14, 23:46:40` → `10 月 14 日 23:46:40`；`8 Oct, 02:51 - 15 Oct, 02:51` →
  `10 月 8 日 02:51 - 10 月 15 日 02:51`。由脚本的 `zhDate()` 处理，**不要**往词典里逐条加日期。
- 已是中文的条目原样返回。
- 句子翻译自然、简洁，符合中文技术文档习惯；问句保留问号。
- 界面上的**全大写**标签多数是 CSS `text-transform: uppercase` 的渲染效果，
  词典键要用 **DOM 里的真实大小写**（通常是 Title Case），不是看到的大写。
