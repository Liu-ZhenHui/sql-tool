# -*- coding: utf-8 -*-

# 读取文件
with open('c:/Users/Administrator/CodeBuddy/sql工具/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 打印从 map 开始到函数结束的部分
start = content.find('container.innerHTML = tables.map')
if start >= 0:
    end = content.find('// 导入表结构', start)
    if end >= 0:
        snippet = content[start:end]
        print('=== Content to replace ===')
        print('Length:', len(snippet))
        # 打印十六进制来表示特殊字符
        for i, c in enumerate(snippet):
            if ord(c) < 32 or c in '"\'`\\':
                print(f'Position {i}: {repr(c)} (ord={ord(c)})')
        print()
        print('=== Full repr ===')
        print(repr(snippet[:500]))
