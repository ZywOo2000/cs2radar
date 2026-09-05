# RADAR / CS2
中文 CS2 选手雷达图网页。粘贴 HLTV 比赛或赛事链接，优先由已连接的浏览器扩展读取，未连接时由服务器读取；两侧独立选择选手和统计范围，可比较不同选手、同一选手的不同比赛，以及不同赛事。支持单人展示、比赛指标 / HLTV 属性切换、原始数据表和 PNG 导出。

## 运行
- npm install
- npm run dev -- --hostname 0.0.0.0
- npm run build
- node --experimental-strip-types --test tests/hltv.test.mjs

## 数据边界
仅允许 HLTV HTTPS 比赛、赛事和带 event 筛选的选手统计链接。所有跳转重新验证来源。默认只显示两侧共有的有效指标；Rating 版本不同或未标注时，不比较该评分。DPR 在雷达图中反向，Swing 的 0% 位于半径中点；原值保留。火力值只读取当前范围内的官方值，不估算、不用职业生涯属性替代单场属性。

导入失败保留当前数据，并明确区分 HTTP 403、验证页、429、超时、页面结构变化等。不会使用代理绕过 HLTV 访问控制，也不会用示例替换失败请求。示例数据全部虚构，界面和导出的图片均标注来源。数据仅保留在本次页面会话，刷新后清空。

## 验证范围
单元测试使用构造的 HTML 用例，验证数据范围隔离、字段解析、缺失值、Rating 版本、刻度以及服务器的来源限制。不是 HLTV 官方接口契约测试。普通网络请求曾返回 HTTP 403，但网页服务端已成功读取并核对 Spirit vs MOUZ（IEM Cologne 2025）10 位选手及三张地图；赛事统计和选手赛事详情请求仍返回 403，其成功解析仅由构造用例验证。页面变动可能需要调整解析器。扩展现支持读取浏览器打开的 HLTV 页面；真实安装后的完整 HLTV 读取尚未验证。

未请求浏览器交互测试，未执行截图或视觉 QA。WebMCP 三个工具按需注册于 document.modelContext；当前工具环境不提供支持的 WebMCP 验证上下文，未验证其运行时契约。普通网页流程不依赖 WebMCP。

## 参考
- https://www.hltv.org/news/42485/introducing-rating-30
- https://www.hltv.org/news/39672/introducing-hltv-attributes
- https://github.com/gigobyte/HLTV （公开 HTML 选择器参考）

## 浏览器扩展
安装步骤见 extension/README.md，网站内也提供下载和说明。运行 npm run build:extension 生成 public/downloads/cs2-radar-extension.zip 后再构建网站。Chrome/Edge 安装后，须在同一浏览器打开网站。扩展仅允许 HLTV 主机和指定网站，支持进度、取消、来源校验、3 分钟验证等待。无需分享 Cookie。

## 雷达参考刻度
外圈为工具设定的参考满刻度（属性的 100 为 HLTV 量表上限），超标数值保持比例越出外圈；双方共用同一个参考半径，视野随最大数值扩展。低于中心端点时绘于中心，原值保留。图内标注每个轴的参考值与中心值，PNG 使用相同图形。
