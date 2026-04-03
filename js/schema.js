// 表结构管理功能

// 表结构数据
let tableSchema = {};

// 从localStorage加载表结构
function loadSchemaFromStorage() {
    const saved = localStorage.getItem('sqlEditorSchema');
    if (saved) {
        try {
            tableSchema = JSON.parse(saved);
        } catch (e) {
            tableSchema = {};
        }
    }
}

// 保存表结构到localStorage
function saveSchemaToStorage() {
    localStorage.setItem('sqlEditorSchema', JSON.stringify(tableSchema));
}

// 切换表结构面板
function toggleSchemaPanel() {
    const panel = document.getElementById('schemaPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderTableList();
        renderFloatTableList();
        // 显示当前JSON
        document.getElementById('schemaJson').value = JSON.stringify(tableSchema, null, 2);
    }
}

// 关闭面板
function closeSchemaPanel(event) {
    if (event.target === event.currentTarget) {
        document.getElementById('schemaPanel').classList.add('hidden');
    }
}

// 添加新表
function addNewTable() {
    const tableName = prompt('请输入表名:');
    if (tableName && tableName.trim()) {
        const name = tableName.trim();
        // 检查是否存在（不区分大小写）
        const existingKey = Object.keys(tableSchema).find(k => k.toLowerCase() === name.toLowerCase());
        if (existingKey) {
            showToast('该表已存在', 'error');
            return;
        }
        tableSchema[name] = [];
        saveSchemaToStorage();
        renderTableList();
        renderFloatTableList();
        // 立即编辑字段
        editTableFields(name);
    }
}

// 编辑表字段
function editTableFields(tableName) {
    const tableInfo = tableSchema[tableName];
    // 支持新旧两种格式
    const fields = Array.isArray(tableInfo) ? tableInfo : (tableInfo ? tableInfo.fields : []);
    const fieldsStr = fields.join(', ');
    const input = prompt(`表 "${tableName}" 的字段 (用逗号分隔):`, fieldsStr);
    if (input !== null) {
        const newFields = input.split(',').map(f => f.trim()).filter(f => f);
        // 如果是对象格式，保留原有结构
        if (Array.isArray(tableInfo)) {
            tableSchema[tableName] = newFields;
        } else {
            tableSchema[tableName].fields = newFields;
        }
        saveSchemaToStorage();
        renderTableList();
        renderFloatTableList();
        updateAutocomplete(); // 更新补全
        showToast('已更新表结构');
    }
}

// 删除表
function deleteTable(tableName) {
    if (confirm(`确定删除表 "${tableName}" 吗?`)) {
        delete tableSchema[tableName];
        saveSchemaToStorage();
        renderTableList();
        renderFloatTableList();
        updateAutocomplete();
        showToast('已删除表');
    }
}

// 渲染表列表
function renderTableList() {
    const container = document.getElementById('tableList');
    const tables = Object.keys(tableSchema).sort();
    
    if (tables.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-[var(--text-secondary)]">
                <svg class="mx-auto mb-3 w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                <p>暂无表结构</p>
                <p class="text-sm mt-1">点击上方按钮添加表</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tables.map(tableName => {
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
                    <span class="font-medium text-[var(--accent-blue)] cursor-pointer hover:text-white" onclick="toggleTableFields('${tableName}')" title="点击展开/收起字段">${tableName}</span>
                    ${comment ? `<span class="text-xs text-[var(--accent-yellow)]">(${comment})</span>` : ''}
                    <span class="text-xs text-[var(--text-secondary)]">(${fields.length} 字段)</span>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="insertText('${tableName}')" class="p-1 hover:bg-green-800/50 rounded cursor-pointer" title="插入表名">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <polyline points="19 12 12 19 5 12"/>
                        </svg>
                    </button>
                    <button onclick="editTableFields('${tableName}')" class="p-1 hover:bg-gray-600 rounded cursor-pointer" title="编辑">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button onclick="deleteTable('${tableName}')" class="p-1 hover:bg-red-900/50 rounded cursor-pointer" title="删除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f44747" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6M8,6V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2V6"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="fields-${tableName}" class="px-3 py-2 text-sm font-mono border-t border-[var(--border-color)]">
                <div class="mb-2 text-xs text-[var(--text-secondary)]">点击字段插入编辑器：</div>
                <div class="flex flex-wrap">
                    ${fields.map(f => {
                        const fieldComment = fieldComments[f] || '';
                        return `<span class="inline-flex flex-col px-2 py-1 bg-[var(--bg-secondary)] rounded mr-1 mb-1 cursor-pointer hover:bg-gray-700 transition" 
                            onclick="insertField('${tableName}', '${f}')" title="${fieldComment ? '说明: ' + fieldComment : '点击插入'}">
                            <span class="text-[var(--accent-yellow)]">${f}</span>
                            ${fieldComment ? `<span class="text-xs text-[var(--text-secondary)] font-sans">${fieldComment}</span>` : ''}
                        </span>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `}).join('');
}

// 展开/收起表字段
function toggleTableFields(tableName) {
    const el = document.getElementById('fields-' + tableName);
    if (el) {
        el.classList.toggle('hidden');
    }
}

// 导入表结构
function importSchema() {
    const jsonStr = document.getElementById('schemaJson').value.trim();
    if (!jsonStr) {
        showToast('请输入表结构JSON', 'error');
        return;
    }
    try {
        const imported = JSON.parse(jsonStr);
        // 验证格式：支持数组格式和对象格式
        for (const [table, tableInfo] of Object.entries(imported)) {
            const fields = Array.isArray(tableInfo) ? tableInfo : tableInfo.fields;
            if (!Array.isArray(fields)) {
                throw new Error(`表 "${table}" 的字段格式错误`);
            }
        }
        tableSchema = imported;
        saveSchemaToStorage();
        renderTableList();
        renderFloatTableList();
        updateAutocomplete();
        showToast(`成功导入 ${Object.keys(tableSchema).length} 个表`);
    } catch (e) {
        showToast('JSON格式错误: ' + e.message, 'error');
    }
}

// 导出表结构
function exportSchema() {
    const jsonStr = JSON.stringify(tableSchema, null, 2);
    document.getElementById('schemaJson').value = jsonStr;
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('已复制到剪贴板');
    }).catch(() => {
        showToast('已生成JSON，可手动复制');
    });
}

// 从 Excel 导入表结构
function importFromExcel(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 获取所有 Sheet 名称
            const sheetNames = workbook.SheetNames;
            
            // 查找"总体" Sheet 获取表名映射
            let tableNameMap = {};
            if (sheetNames.includes('总体')) {
                const zongtiSheet = workbook.Sheets['总体'];
                const zongtiData = XLSX.utils.sheet_to_json(zongtiSheet, { header: 1 });
                
                // 解析表名映射：第3列是中文表名，第2列是英文表名
                zongtiData.forEach(row => {
                    if (row && row.length >= 3) {
                        const chineseName = String(row[2]).trim(); // 第3列：中文表名
                        const englishName = String(row[1]).trim();  // 第2列：英文表名
                        if (chineseName && englishName && englishName !== 'NaN') {
                            tableNameMap[chineseName] = englishName;
                        }
                    }
                });
            }
            
            // 解析每个表 Sheet 获取字段（包含解释）
            const importedSchema = {};
            sheetNames.forEach(sheetName => {
                // 跳过"总体" Sheet
                if (sheetName === '总体') return;
                
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                // 获取字段列表（"名称"列是字段名，"解释"列是中文解释）
                const fields = [];
                const fieldComments = {};
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (row && row.length >= 2) {
                        const fieldName = String(row[0]).trim();    // "名称"列
                        const fieldComment = String(row[1] || '').trim(); // "解释"列
                        if (fieldName && fieldName !== '名称') {
                            fields.push(fieldName);
                            if (fieldComment && fieldComment !== 'NaN') {
                                fieldComments[fieldName] = fieldComment;
                            }
                        }
                    }
                }
                
                // 使用映射的英文名或原始 Sheet 名作为表名
                const tableName = tableNameMap[sheetName] || sheetName;
                if (fields.length > 0) {
                    importedSchema[tableName] = {
                        fields: fields,
                        comment: sheetName, // 保存中文表名作为解释
                        fieldComments: fieldComments
                    };
                }
            });
            
            // 询问用户是合并还是替换
            const hasExisting = Object.keys(tableSchema).length > 0;
            let finalSchema = importedSchema;
            
            if (hasExisting) {
                const action = confirm('检测到现有表结构。\n\n点击"确定"：合并（保留现有表，添加新表）\n点击"取消"：替换（清空现有表，使用导入的表）');
                
                if (!action) {
                    // 替换
                    finalSchema = importedSchema;
                } else {
                    // 合并
                    finalSchema = { ...tableSchema, ...importedSchema };
                }
            }
            
            tableSchema = finalSchema;
            saveSchemaToStorage();
            renderTableList();
            renderFloatTableList();
            updateAutocomplete();
            document.getElementById('schemaJson').value = JSON.stringify(tableSchema, null, 2);
            
            showToast(`成功导入 ${Object.keys(tableSchema).length} 个表`);
        } catch (err) {
            console.error('Excel 解析错误:', err);
            showToast('Excel 解析失败: ' + err.message, 'error');
        }
        
        // 清空文件输入，允许重复选择同一文件
        input.value = '';
    };
    
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
        input.value = '';
    };
    
    reader.readAsArrayBuffer(file);
}

// 更新自动补全（集成表名和字段名）
function updateAutocomplete() {
    const dbType = document.getElementById('dbType').value;
    const keywords = SQL_KEYWORDS[dbType] || SQL_KEYWORDS.mysql;
    
    // 收集所有表名（保留原始大小写）
    const tableNames = Object.keys(tableSchema);
    
    // 收集所有字段名（带表名前缀和注释，保留原始大小写）
    const fieldCompletions = [];
    for (const [table, tableInfo] of Object.entries(tableSchema)) {
        const fields = Array.isArray(tableInfo) ? tableInfo : (tableInfo.fields || []);
        const fieldComments = !Array.isArray(tableInfo) && tableInfo.fieldComments ? tableInfo.fieldComments : {};
        fields.forEach(field => {
            const comment = fieldComments[field] || '';
            fieldCompletions.push({
                text: `${table}.${field}`,
                displayText: comment ? `${table}.${field} - ${comment}` : `${table}.${field}`,
                type: 'field',
                comment: comment
            });
            // 同时添加不带表名的字段（保留原始大小写）
            fieldCompletions.push({
                text: field,
                displayText: comment ? `${field} - ${comment}` : field,
                type: 'field',
                comment: comment
            });
        });
    }
    
    // 合并补全列表
    const completionList = [
        ...keywords.map(k => ({ text: k, displayText: k, type: 'keyword' })),
        ...tableNames.map(t => ({ text: t, displayText: t, type: 'table' })),
        ...fieldCompletions
    ];
    
    CodeMirror.registerHelper('hint', 'sql', function(cm) {
        const cursor = cm.getCursor();
        const token = cm.getTokenAt(cursor);
        const line = cm.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        
        let word = token.string;
        let start = token.start;
        let end = cursor.ch;
        
        // 检测当前输入的词是否可能是一个关键字的前缀
        const currentWord = word.toUpperCase();
        const isTypingKeyword = currentWord.length > 0 && 
            SQL_KEYWORDS[dbType].some(kw => kw.toUpperCase().startsWith(currentWord));
        
        // 过滤匹配项
        let filtered = completionList.filter(item => 
            item.text.toUpperCase().startsWith(word.toUpperCase())
        );
        
        // 简单上下文检测
        const isAfterFrom = /\bFROM\s+[\w,\s]*$/i.test(beforeCursor);
        const isAfterJoin = /\bJOIN\s+[\w]*$/i.test(beforeCursor);
        const isAfterSelect = /\bSELECT\s+[\w,\s]*$/i.test(beforeCursor) && !isAfterFrom && !isAfterJoin;
        
        // 优先显示关键字（只要正在输入关键字前缀）
        if (isTypingKeyword && filtered.length > 0) {
            // 把关键字排到前面
            const keywords2 = filtered.filter(item => item.type === 'keyword');
            const others = filtered.filter(item => item.type !== 'keyword');
            filtered = [...keywords2, ...others];
        } else if (isAfterFrom || isAfterJoin) {
            // FROM/JOIN后优先显示表名
            const tables = filtered.filter(item => item.type === 'table');
            if (tables.length > 0) filtered = tables;
        } else if (isAfterSelect) {
            // SELECT后优先显示字段和表名
            const fields = filtered.filter(item => item.type === 'field' || item.type === 'table');
            if (fields.length > 0) filtered = fields;
        }
        
        return {
            list: filtered.slice(0, 20),
            from: CodeMirror.Pos(cursor.line, start),
            to: CodeMirror.Pos(cursor.line, end)
        };
    });
}

// 切换常驻浮窗
function toggleSchemaFloat() {
    const panel = document.getElementById('schemaFloat');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderFloatTableList();
    }
}

// 过滤表列表
function filterTableList() {
    renderFloatTableList();
}

// 渲染常驻浮窗的表列表
function renderFloatTableList() {
    const container = document.getElementById('floatTableList');
    const searchQuery = document.getElementById('tableSearch')?.value?.toLowerCase() || '';
    let tables = Object.keys(tableSchema).sort();
    
    if (tables.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-xs text-[#808080]">
                暂无表结构<br>请先从表结构管理导入
            </div>
        `;
        return;
    }
    
    // 过滤表
    const filteredTables = tables.map(tableName => {
        const tableInfo = tableSchema[tableName];
        const fields = Array.isArray(tableInfo) ? tableInfo : tableInfo.fields;
        const comment = !Array.isArray(tableInfo) && tableInfo.comment ? tableInfo.comment : '';
        const fieldComments = !Array.isArray(tableInfo) && tableInfo.fieldComments ? tableInfo.fieldComments : {};
        
        return {
            tableName,
            fields,
            comment,
            fieldComments
        };
    }).filter(t => {
        // 只过滤表
        if (searchQuery) {
            const tableMatch = t.tableName.toLowerCase().includes(searchQuery);
            const commentMatch = t.comment.toLowerCase().includes(searchQuery);
            return tableMatch || commentMatch;
        }
        return true;
    });
    
    if (filteredTables.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-xs text-[#808080]">
                没有找到匹配的表
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTables.map(({tableName, fields, comment, fieldComments}) => {
        return `
        <div class="bg-[#2d2d2d] rounded p-2">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-[#3c3c3c]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
                <span class="text-sm font-medium text-[#569cd6]">${tableName}</span>
                ${comment ? `<span class="text-xs text-[#dcdcaa]">(${comment})</span>` : ''}
            </div>
            <div class="flex flex-wrap">
                ${fields.map(f => {
                    const fieldComment = (fieldComments[f] || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
                    return `<span class="inline-flex flex-col px-2 py-1 bg-[#1e1e1e] rounded mr-1 mb-1 cursor-pointer hover:bg-[#3c3c3c] transition" 
                        onclick="insertField('${tableName}', '${f}', '${fieldComment}')" title="${fieldComment ? '说明: ' + fieldComment : '点击插入'}">
                        <span class="text-[#dcdcaa] text-xs">${f}</span>
                        ${fieldComment ? `<span class="text-[10px] text-[#808080]">${fieldComment}</span>` : ''}
                    </span>`;
                }).join('')}
            </div>
        </div>
    `}).join('');
}
