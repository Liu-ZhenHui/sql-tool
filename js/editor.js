// 编辑器初始化和基础功能

let editor;

// 初始化编辑器
function initEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('sqlEditor'), {
        mode: 'text/x-mysql',
        theme: 'material-darker',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        autofocus: true,
        extraKeys: {
            'Ctrl-Space': 'autocomplete',
            'Ctrl-/': 'toggleComment',
            'Ctrl-Shift-F': formatSQL,
            'Ctrl-Shift-C': copySQL
        },
        hintOptions: {
            tables: {}
        }
    });
    
    // 设置编辑器高度
    editor.setSize('100%', '100%');
    
    // 监听光标位置变化
    editor.on('cursorActivity', function() {
        updateCursorPosition();
        checkSyntax();
    });
    
    // 监听内容变化
    editor.on('change', function() {
        updateCharCount();
    });
    
    // 自定义自动补全
    editor.on('inputRead', function(cm, change) {
        if (change.origin !== 'complete') {
            CodeMirror.commands.autocomplete(cm, null, { completeSingle: false });
        }
    });
    
    // 更新补全列表
    updateAutocomplete();
    
    // 更新状态栏
    updateCursorPosition();
    updateCharCount();
}

// 复制SQL
function copySQL() {
    const sql = editor.getValue();
    if (!sql.trim()) {
        showToast('请先输入SQL语句', 'error');
        return;
    }
    
    navigator.clipboard.writeText(sql).then(() => {
        showToast('已复制到剪贴板');
    }).catch(err => {
        showToast('复制失败', 'error');
    });
}

// 清空编辑器
function clearEditor() {
    editor.setValue('');
    editor.focus();
    showToast('已清空');
}

// 更新光标位置
function updateCursorPosition() {
    const cursor = editor.getCursor();
    document.getElementById('cursorLine').textContent = cursor.line + 1;
    document.getElementById('cursorCol').textContent = cursor.ch + 1;
}

// 更新字符数
function updateCharCount() {
    const content = editor.getValue();
    document.getElementById('charCount').textContent = content.length;
}

// 基础语法检查
function checkSyntax() {
    const content = editor.getValue();
    const lines = content.split('\n');
    
    // 清除所有标记 - 使用正确的 CodeMirror API
    editor.getAllMarks().forEach(mark => mark.clear());
    
    // 检查括号匹配
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';
    
    lines.forEach((line, lineIndex) => {
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const prevChar = i > 0 ? line[i-1] : '';
            
            // 处理字符串
            if ((char === "'" || char === '"') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
            // 只在字符串外检查括号
            if (!inString) {
                if (char === '(') bracketCount++;
                if (char === ')') bracketCount--;
            }
        }
    });
    
    // 检查未闭合的引号
    if (inString) {
        // 标记最后一个未闭合的引号
    }
}

// 显示提示消息
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// 插入文本到编辑器
function insertText(text) {
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor);
    editor.focus();
}

// 点击字段插入编辑器
function insertField(tableName, fieldName, fieldComment) {
    const autoComma = document.getElementById('autoComma')?.checked;
    const autoNewline = document.getElementById('autoNewline')?.checked;
    const withPrefix = document.getElementById('withPrefix')?.checked;
    const withAlias = document.getElementById('withAlias')?.checked;
    const customPrefix = document.getElementById('customPrefix')?.value || '';
    
    let text = '';
    
    // 处理前缀
    if (customPrefix) {
        text += customPrefix;
    } else if (withPrefix) {
        text += tableName + '.';
    }
    
    text += fieldName;
    
    // 处理 AS 中文别名
    if (withAlias && fieldComment) {
        text += ` AS '${fieldComment}'`;
    }
    
    if (autoComma) {
        text += ',';
    }
    
    // 自动换行
    if (autoNewline) {
        text += '\n';
    }
    
    insertText(text);
}

// 点击字段名插入（不带表名前缀）
function insertFieldName(fieldName, fieldComment) {
    const autoComma = document.getElementById('autoComma')?.checked;
    const autoNewline = document.getElementById('autoNewline')?.checked;
    const withAlias = document.getElementById('withAlias')?.checked;
    
    let text = fieldName;
    
    if (withAlias && fieldComment) {
        text += ` AS '${fieldComment}'`;
    }
    
    if (autoComma) {
        text += ',';
    }
    
    if (autoNewline) {
        text += '\n';
    }
    
    insertText(text);
}

// 切换数据库类型
document.getElementById('dbType').addEventListener('change', function() {
    const dbType = this.value;
    // StarRocks兼容MySQL，使用MySQL模式
    const modeMap = {
        mysql: 'text/x-mysql',
        mariadb: 'text/x-mariadb',
        postgresql: 'text/x-pgsql',
        sql: 'text/x-sql',
        starrocks: 'text/x-mysql'
    };
    
    editor.setOption('mode', modeMap[dbType] || 'text/x-mysql');
    updateAutocomplete();
    
    const modeNames = {
        mysql: 'MySQL',
        mariadb: 'MariaDB',
        postgresql: 'PostgreSQL',
        sql: 'Standard SQL',
        starrocks: 'StarRocks'
    };
    document.getElementById('currentMode').textContent = modeNames[dbType];
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initEditor);

// 全局快捷键
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'F') {
            e.preventDefault();
            formatSQL();
        } else if (e.key === 'C') {
            e.preventDefault();
            copySQL();
        }
    }
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
    }
});

// 自定义补全渲染
CodeMirror.registerHelper('hintWords', 'sql', function() {
    return [];
});
