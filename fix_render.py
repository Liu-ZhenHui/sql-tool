# -*- coding: utf-8 -*-

# 读取文件
with open('c:/Users/Administrator/CodeBuddy/sql工具/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 从文件中直接提取需要替换的部分
start = content.find('container.innerHTML = tables.map')
end = content.find('// 导入表结构', start)
old_snippet = content[start:end]

# 新的代码
new_snippet = '''container.innerHTML = tables.map(tableName => {
                const tableInfo = tableSchema[tableName];
                const fields = Array.isArray(tableInfo) ? tableInfo : tableInfo.fields;
                const comment = !Array.isArray(tableInfo) && tableInfo.comment ? tableInfo.comment : '';
                const fieldComments = !Array.isArray(tableInfo) && tableInfo.fieldComments ? tableInfo.fieldComments : {};
                return `
                <div class="bg-[var(--bg-tertiary)] rounded-lg overflow-hidden border border-[var(--border-color)]">
                    <div class="flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)]/50">
                        <div class="flex items-center gap-2 flex-wrap">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <line x1="3" y1="9" x2="21" y2="9"/>
                            </svg>
                            <span class="font-medium text-[var(--accent-blue)]">${tableName}</span>
                            ${comment ? `<span class="text-xs text-[var(--accent-yellow)]">(${comment})</span>` : ''}
                            <span class="text-xs text-[var(--text-secondary)]">(${fields.length} 字段)</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="editTableFields('${tableName}')" class="p-1 hover:bg-[var(--bg-secondary)] rounded" title="编辑">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button onclick="deleteTable('${tableName}')" class="p-1 hover:bg-[var(--accent-red)]/20 rounded" title="删除">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"/>
                                    <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6M8,6V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2V6"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="px-3 py-2 text-sm font-mono">
                        ${fields.map(f => {
                            const fieldComment = fieldComments[f];
                            return `<span class="inline-flex flex-col px-2 py-1 bg-[var(--bg-secondary)] rounded mr-1 mb-1" title="${fieldComment || ''}">
                                <span class="text-[var(--accent-yellow)]">${f}</span>
                                ${fieldComment ? `<span class="text-xs text-[var(--text-secondary)] font-sans">${fieldComment}</span>` : ''}
                            </span>`;
                        }).join('')}
                    </div>
                </div>
            `}).join('');
        }

        // 导入表结构'''

# 替换
if old_snippet in content:
    content = content.replace(old_snippet, new_snippet)
    with open('c:/Users/Administrator/CodeBuddy/sql工具/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('替换成功!')
else:
    print('未找到匹配的字符串')
    print('Old snippet length:', len(old_snippet))
    print('Old snippet preview:', repr(old_snippet[:200]))
