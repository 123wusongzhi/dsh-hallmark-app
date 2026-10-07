"""Render A.1 documentation diagrams from one editable node/relationship model.

Creates SVG, DOT, and Mermaid; PNG is a browser rasterization of the same SVG.
This script documents a target flow. It never invokes DSH or business services.
"""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parent
FONT = "'Microsoft YaHei','Segoe UI',sans-serif"
INK, MUTED, BLUE = '#14243d', '#5f718c', '#1769e8'

def text(x, y, lines, size=22, fill=INK, weight=400, anchor='start'):
    if isinstance(lines, str):
        lines = [lines]
    return '\n'.join(f'<text x="{x}" y="{y+i*(size+12)}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{escape(line)}</text>' for i, line in enumerate(lines))

def start(width, height, title, subtitle):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}">',
        '<defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#5278ae"/></marker><marker id="loop" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#bd7e18"/></marker></defs>',
        f'<rect width="{width}" height="{height}" fill="#f6f9fe"/>', text(64, 64, title, 32, weight=700), text(64, 104, subtitle, 21, MUTED)]

def path(d, dashed=False, color='#5278ae', arrow='arrow'):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.7" {"stroke-dasharray='8 6'" if dashed else ""} marker-end="url(#{arrow})"/>'

def card(node):
    x,y,w,h = node['box']
    fill, border = node.get('fill', '#ffffff'), node.get('border', '#ccd9ed')
    return [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{border}" stroke-width="1.6"/>',
        text(x+24,y+43,node['title'],26,weight=700), text(x+24,y+85,node['lines'],21,MUTED)]

NODES = [
    dict(id='A',title='1  原输入框 @应用',lines=['任意已有会话；保留正文与附件','引用不自动发送；用户原方式发送'],box=(72,210,480,150)),
    dict(id='B',title='2  真实会话 / 连接绑定',lines=['Host 核实 sessionId + appId','Runtime 激活明确 connectionId'],box=(600,210,480,150)),
    dict(id='C',title='3  同一个原 DSH Agent',lines=['消费原发送；发现已有能力工具','使用原文件 / 命令工具'],box=(1128,210,480,150)),
    dict(id='D',title='4  独立可编辑工作副本',lines=['新建 / 复制模板，或 saved checkout','旧构建、旧保存版本保持可读'],box=(1128,425,480,150)),
    dict(id='E',title='5  编辑源码与只读绑定',lines=['普通 React / TSX / CSS / 资源 / 依赖','appId + connectionId + bindingId'],box=(600,425,480,150)),
    dict(id='F',title='6  构建同一份 dist',lines=['源文件 + 锁文件 + dist 内容快照','构建失败保留旧可用视图'],box=(72,425,480,150)),
    dict(id='G',title='7  真实预览与验证反馈',lines=['同份 dist：截图 / 运行错误 / 交互','报告匹配 buildId；失败继续修改'],box=(72,650,480,150),fill='#fffaf0',border='#ebd098'),
    dict(id='H',title='8  登记不可变构建',lines=['capture / open_source_component','Runtime 事务更新草稿和引用'],box=(600,650,480,150),fill='#eef6ff',border='#a7c8f3'),
    dict(id='I',title='9  本会话 viewId 展示',lines=['新 frameInstanceId 握手与加载检查','只改应用 / 右侧组件；尚未正式保存'],box=(1128,650,480,150),fill='#eef8f4',border='#a6d5bf'),
    dict(id='J',title='10  原聊天继续提出修改',lines=['保持 sessionId / viewId 与工作目录','反馈回到同一 Agent，重复构建验证','无需独立聊天标签'],box=(72,900,600,200),fill='#eef6ff',border='#a7c8f3'),
    dict(id='K',title='11  用户明确保存',lines=['save_as：新 componentId','update：componentId','+ expectedRevision','冲突保留工作副本'],box=(742,900,420,200)),
    dict(id='L',title='12  组件库版本资产',lines=['保存 revision；历史版本保留','另一会话打开 → 新 view / checkout','刷新只更新数据，不改设计'],box=(1220,900,420,200),fill='#eef8f4',border='#a6d5bf'),
]
EDGES = [('A','B','核实引用与绑定'),('B','C','用户原发送后消费'),('C','D','创建或打开副本'),('D','E','源码修改'),('E','F','构建'),('F','G','实际预览'),('G','E','不合格：反馈修改'),('G','H','验证通过'),('H','I','加载当前构建'),('I','J','继续反馈'),('J','C','下一轮原发送'),('I','K','明确保存'),('K','L','CAS 更新 / 另存'),('L','D','打开保存版：新副本')]

def render_flow():
    out=start(1720,1230,'FIG-13  原聊天中创建、编辑与保存组件','A.1 目标流程 · 任意原会话 @应用 · 保留 DSH 原聊天与导航，仅改插件区域')
    out += [text(72,184,'引用与原发送',22,BLUE,700),text(600,184,'绑定与唯一写入者',22,BLUE,700),text(1128,184,'已有 Agent 与已有工具',22,BLUE,700)]
    for node in NODES:
        out += card(node)
    out += [path('M552 285 H600'),path('M1080 285 H1128'),path('M1368 360 V425'),
        path('M1128 500 H1080'),path('M600 500 H552'),path('M312 575 V650'),
        path('M552 725 H600'),text(560,704,'通过',17,BLUE),path('M1080 725 H1128'),
        path('M312 650 V612 H840 V575',True,'#bd7e18','loop'),text(438,607,'不合格：反馈后继续修改',18,'#996917'),
        path('M1368 800 V850 H372 V900'),path('M1368 850 H952 V900'),
        path('M1162 990 H1220'),
        path('M72 995 H28 V145 H1368 V210',True),text(824,144,'下一轮原聊天 → 同一 Agent',19,BLUE),
        path('M1640 990 H1688 V500 H1608',True),text(1450,866,'保存版打开 → 新副本',18,BLUE)]
    out += [f'<rect x="72" y="1117" width="1568" height="76" rx="12" fill="#eaf0f9"/>',
        text(92,1145,'边界：本地筛选 / 排序 / 勾选不调用模型；“附加到聊天”产生原生附件，等待用户手动发送。',20),
        text(92,1176,'此图是架构目标，不是部署证明。@ 接线与 v2 真实预览反馈需验证；requestAgent 是另一条可选路径。',19,MUTED)]
    out.append('</svg>')
    (ROOT/'FIG-13.svg').write_text('\n'.join(out),encoding='utf-8')
    dot=['digraph FIG13 {','  graph [rankdir=TB, fontname="Microsoft YaHei", label="FIG-13 原聊天组件创作闭环 / A.1 目标"];','  node [shape=box, style="rounded,filled", fillcolor="#eef6ff", fontname="Microsoft YaHei"];','  edge [fontname="Microsoft YaHei"];']
    for n in NODES:
        dot.append(f'  {n["id"]} [label={json.dumps(n["title"]+chr(10)+chr(10).join(n["lines"]),ensure_ascii=False)}];')
    for a,b,label in EDGES:
        dashed=', style=dashed' if (a,b) in [('G','E'),('J','C'),('L','D')] else ''
        dot.append(f'  {a} -> {b} [label={json.dumps(label,ensure_ascii=False)}{dashed}];')
    dot.append('}')
    (ROOT/'FIG-13.dot').write_text('\n'.join(dot)+'\n',encoding='utf-8')
    mmd=['flowchart TB','  %% A.1 target. @ reference, Runtime binding, and original manual send are distinct.']
    for n in NODES:
        label='<br/>'.join([n['title']]+n['lines'])
        mmd.append(f'  {n["id"]}["{label}"]')
    for a,b,label in EDGES:
        arr='-.->' if (a,b) in [('G','E'),('J','C'),('L','D')] else '-->'
        mmd.append(f'  {a} {arr}|"{label}"| {b}')
    (ROOT/'FIG-13.mmd').write_text('\n'.join(mmd)+'\n',encoding='utf-8')

ACTORS = [('U','用户'),('N','原输入框 / Host'),('A','原 DSH Agent'),('W','工程 / 真实预览'),('R','P2 Runtime'),('V','组件 frame / Client')]
MESSAGES = [
 ('U','N','@ 选择应用：保留原会话 / 正文 / 附件'),
 ('N','R','核实真实 sessionId，绑定 appId + connectionId'),
 ('R','N','真实绑定结果；失败或多连接时明确说明'),
 ('U','N','用户手动发送创建 / 编辑要求'),
 ('N','A','DSH 正式输入：正文 / 应用引用 / 原附件'),
 ('A','R','可选：open_component(componentId, revision?)'),
 ('R','A','本会话新 view 与独立 checkout 目录'),
 ('A','W','新建 / 修改 TSX、CSS、绑定与依赖；实际构建'),
 ('W','A','同份 dist 的截图、运行错误与交互报告'),
 ('A','W','不合格：继续修改、构建和预览；取消则停止'),
 ('A','R','通过：open_source_component(directory, viewId?)'),
 ('R','N','capture 成功后事务更新 build / view / 引用'),
 ('N','V','当前 session + view + build + 新 frame 握手加载'),
 ('V','N','实际展示检查：显示成功或保留最后可用版'),
 ('U','N','原聊天继续反馈；或明确“保存到组件库”'),
 ('N','A','消费下一次原手动发送；修改回到步骤 8'),
 ('A','R','仅明确保存：save_as 或 update + expectedRevision'),
 ('R','A','新 componentId / revision；或 COMPONENT_CONFLICT'),
]

def render_sequence():
    width,height=1870,1950
    centers=[155,465,775,1085,1395,1705]
    ids={actor[0]:i for i,actor in enumerate(ACTORS)}
    out=start(width,height,'FIG-14  原聊天组件创作顺序与失败处理','A.1 目标顺序 · 原会话手动发送为默认路径 · 可选 requestAgent 另见 FIG-08')
    for i,(_,label) in enumerate(ACTORS):
        x=centers[i]
        out.append(f'<rect x="{x-136}" y="138" width="272" height="74" rx="12" fill="#eaf2ff" stroke="#b6cdec"/>')
        out.append(text(x,182,label,24,INK,700,'middle'))
        out.append(f'<line x1="{x}" y1="212" x2="{x}" y2="1695" stroke="#bdc9da" stroke-dasharray="6 7"/>')
    for i,(a,b,label) in enumerate(MESSAGES):
        y=270+i*78
        x1,x2=centers[ids[a]],centers[ids[b]]
        out.append(path(f'M{x1} {y} H{x2}',dashed=i in [2,6,8,11,13,17]))
        align='start' if x1<x2 else 'end'
        label_x=min(x1,x2)+14 if align=='start' else max(x1,x2)-14
        # Long messages span enough lanes; labels remain above their respective arrows.
        out.append(text(label_x,y-14,f'{i+1:02d}  {label}',20,INK,500,align))
        out.append(f'<circle cx="{x1}" cy="{y}" r="4.5" fill="{BLUE}"/>')
    out.append(f'<rect x="64" y="1710" width="1742" height="181" rx="16" fill="#fffaf0" stroke="#e4cf9e"/>')
    out.append(text(90,1748,'失败与身份边界',24,weight=700))
    out.append(text(90,1788,[
        '构建 / 预览失败或取消：保留工作副本与旧可用视图，不自动登记 / 保存；事务已完成则如实报告。',
        'frame 或会话切换：迟到结果无效。更新保存版须 CAS；冲突保留修改，可另存或重新打开最新版本。',
        '刷新只更新数据与 freshness；本地筛选 / 勾选不唤醒模型。原生附件成功仍要等用户手动发送。'],21,MUTED))
    out.append('</svg>')
    (ROOT/'FIG-14.svg').write_text('\n'.join(out),encoding='utf-8')
    mmd=['sequenceDiagram','  autonumber']+[f'  participant {a} as {label}' for a,label in ACTORS]
    for i,(a,b,label) in enumerate(MESSAGES):
        if i==5:
            mmd.append('  opt 打开保存组件以继续编辑')
        if i==7:
            mmd += ['  end','  loop 工作副本创作：直到验证通过或用户取消']
        if i==9:
            mmd.append('  opt 验证不合格且用户未取消')
        if i==10:
            mmd += ['  end','  end','  opt 本轮验证通过且未取消']
        if i==14:
            mmd.append('  end')
        if i==16:
            mmd.append('  opt 用户明确保存而非仅修改 / 展示')
        arrow='-->>' if i in [2,6,8,11,13,17] else '->>'
        mmd.append(f'  {a}{arrow}{b}: {label}')
    mmd.append('  end')
    mmd += ['  Note over U,V: 新建/编辑是原手动聊天；取消/失败保留旧视图；明确保存才进入组件库。','  Note over A,R: expectedRevision 只用于保存 CAS；datasetRevision/contextRevision/buildId 不是同一个版本。']
    (ROOT/'FIG-14.mmd').write_text('\n'.join(mmd)+'\n',encoding='utf-8')
    dot=['digraph FIG14 {','  graph [rankdir=TB, fontname="Microsoft YaHei", label="FIG-14 原聊天创作顺序 / A.1 目标"];','  node [shape=box, style="rounded,filled", fillcolor="#eef6ff", fontname="Microsoft YaHei"];','  edge [fontname="Microsoft YaHei"];']
    for i,(a,b,label) in enumerate(MESSAGES):
        caption=f'{i+1:02d} {dict(ACTORS)[a]} → {dict(ACTORS)[b]}\n{label}'
        dot.append(f'  S{i+1} [label={json.dumps(caption,ensure_ascii=False)}];')
        if i:
            dot.append(f'  S{i} -> S{i+1} [label="顺序 / 非重复调用保证"];')
    dot += ['  S10 -> S8 [style=dashed,label="不合格：新一轮修改 / 验证"];','  S16 -> S8 [style=dashed,label="原聊天反馈要求修改"];','}']
    (ROOT/'FIG-14.dot').write_text('\n'.join(dot)+'\n',encoding='utf-8')

if __name__ == '__main__':
    render_flow()
    render_sequence()
    print('Created FIG-13 and FIG-14: SVG, DOT, Mermaid. PNG must rasterize these SVGs.')
