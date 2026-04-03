// SQL格式化功能

// 格式化SQL
function formatSQL() {
    const sql = editor.getValue();
    if (!sql.trim()) {
        showToast('请先输入SQL语句', 'error');
        return;
    }
    
    const dbType = document.getElementById('dbType').value;
    // StarRocks使用MySQL方言
    const formatLang = dbType === 'starrocks' ? 'mysql' : dbType;
    
    // 优先使用CDN的sqlFormatter
    if (typeof sqlFormatter !== 'undefined' && sqlFormatter.format) {
        try {
            const formatted = sqlFormatter.format(sql, {
                language: formatLang,
                tabWidth: 4,
                keywordCase: 'upper',
                linesBetweenQueries: 2,
                newlineBeforeOpenParen: false,
                newlineBeforeCloseParen: false,
                paramTypes: { named: [':', '@', '#'] }
            });
            editor.setValue(formatted);
            showToast('格式化成功');
            return;
        } catch (e) {
            console.log('sqlFormatter error, using fallback:', e);
        }
    }
    
    // 使用增强的备用格式化方案
    const formatted = enhancedFormat(sql);
    editor.setValue(formatted);
    showToast('已格式化');
}

// 增强的SQL格式化方案
function enhancedFormat(sql) {
    // 关键字列表
    const majorKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 
        'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 
        'FULL OUTER JOIN', 'FULL JOIN', 'STRAIGHT_JOIN', 'ON', 'AND', 'OR',
        'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL',
        'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'WITH', 'AS',
        'PARTITION BY', 'DISTRIBUTED BY', 'BUCKETS'];
    
    const minorKeywords = ['AS', 'ON', 'IN', 'NOT', 'LIKE', 'BETWEEN', 'IS', 'NULL', 
        'TRUE', 'FALSE', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
    
    let result = sql.trim();
    
    // 1. 移除多余空白，统一为单个空格
    result = result.replace(/\s+/g, ' ');
    
    // 2. 在符号前后添加空格
    result = result.replace(/\s*,\s*/g, ', ');
    result = result.replace(/\s*\(\s*/g, ' ( ');
    result = result.replace(/\s*\)\s*/g, ' ) ');
    
    // 3. 大写关键字
    majorKeywords.forEach(kw => {
        const regex = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi');
        result = result.replace(regex, kw.toUpperCase());
    });
    
    minorKeywords.forEach(kw => {
        const regex = new RegExp('\\b' + kw + '\\b', 'gi');
        result = result.replace(regex, kw.toUpperCase());
    });
    
    // 4. 处理换行和缩进
    const lines = [];
    let indent = 0;
    const indentStr = '    '; // 4空格缩进
    
    // 分割语句
    const statements = result.split(/;\s*/);
    
    statements.forEach((stmt, stmtIdx) => {
        if (!stmt.trim()) return;
        
        let formattedLines = [];
        let currentIndent = indent;
        
        // 检测是否需要减少缩进
        if (/\b(WHERE|HAVING|GROUP BY|ORDER BY|LIMIT|OFFSET|SET|VALUES|UNION|UNION ALL)\b/i.test(stmt)) {
            currentIndent = 0;
        }
        
        // 处理 SELECT 语句
        if (/\bSELECT\b/i.test(stmt)) {
            formattedLines = formatSelectStatement(stmt, indentStr);
        }
        // 处理 WITH (CTE) 语句
        else if (/\bWITH\b/i.test(stmt)) {
            formattedLines = formatWithStatement(stmt, indentStr);
        }
        // 处理 INSERT 语句
        else if (/\bINSERT\s+INTO\b/i.test(stmt)) {
            formattedLines = formatInsertStatement(stmt, indentStr);
        }
        // 处理 UPDATE 语句
        else if (/\bUPDATE\b/i.test(stmt)) {
            formattedLines = formatUpdateStatement(stmt, indentStr);
        }
        // 处理 DELETE 语句
        else if (/\bDELETE\s+FROM\b/i.test(stmt)) {
            formattedLines = formatDeleteStatement(stmt, indentStr);
        }
        // 其他语句
        else {
            formattedLines = formatGeneralStatement(stmt, indentStr);
        }
        
        lines.push(...formattedLines);
        
        // 语句之间添加空行
        if (stmtIdx < statements.length - 1 && formattedLines.length > 0) {
            lines.push('');
        }
    });
    
    return lines.join('\n');
}

// 格式化 SELECT 语句
function formatSelectStatement(stmt, indent) {
    const lines = [];
    
    // 提取各个部分
    let selectMatch = stmt.match(/\bSELECT\b(.+?)\bFROM\b/i);
    let fromMatch = stmt.match(/\bFROM\b(.+?)(?=\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|\bUNION\b|$)/i);
    let whereMatch = stmt.match(/\bWHERE\b(.+?)(?=\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|\bUNION\b|$)/i);
    let groupMatch = stmt.match(/\bGROUP\s+BY\b(.+?)(?=\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|\bUNION\b|$)/i);
    let havingMatch = stmt.match(/\bHAVING\b(.+?)(?=\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|\bUNION\b|$)/i);
    let orderMatch = stmt.match(/\bORDER\s+BY\b(.+?)(?=\bLIMIT\b|\bOFFSET\b|\bUNION\b|$)/i);
    let limitMatch = stmt.match(/\bLIMIT\b(.+?)(?=\bOFFSET\b|\bUNION\b|$)/i);
    let offsetMatch = stmt.match(/\bOFFSET\b(.+?)(?=\bUNION\b|$)/i);
    
    // SELECT 部分 - 字段换行
    if (selectMatch) {
        let selectPart = selectMatch[1].trim();
        // 处理逗号分隔的字段
        const fields = splitByCommitsOutsideParens(selectPart);
        
        lines.push('SELECT');
        fields.forEach((field, idx) => {
            const isLast = idx === fields.length - 1;
            // 检查字段是否包含函数或复杂表达式
            const isComplex = /\(/.test(field) || /\bAS\b/i.test(field);
            
            if (isComplex) {
                // 复杂表达式保持原样
                lines.push(indent + field.trim() + (isLast ? '' : ','));
            } else {
                lines.push(indent + field.trim() + (isLast ? '' : ','));
            }
        });
    }
    
    // FROM 部分
    if (fromMatch) {
        let fromPart = fromMatch[1].trim();
        // 处理 JOIN 语句
        const fromLines = formatFromClause(fromPart, indent);
        lines.push(...fromLines);
    }
    
    // WHERE 部分
    if (whereMatch) {
        let wherePart = whereMatch[1].trim();
        lines.push('WHERE');
        const whereLines = formatWhereClause(wherePart, indent);
        lines.push(...whereLines);
    }
    
    // GROUP BY 部分
    if (groupMatch) {
        lines.push('GROUP BY');
        const groupPart = groupMatch[1].trim();
        const groupFields = splitByCommitsOutsideParens(groupPart);
        groupFields.forEach((f, idx) => {
            lines.push(indent + f.trim() + (idx < groupFields.length - 1 ? ',' : ''));
        });
    }
    
    // HAVING 部分
    if (havingMatch) {
        lines.push('HAVING');
        const havingLines = formatWhereClause(havingMatch[1].trim(), indent);
        lines.push(...havingLines);
    }
    
    // ORDER BY 部分
    if (orderMatch) {
        lines.push('ORDER BY');
        const orderPart = orderMatch[1].trim();
        const orderFields = splitByCommitsOutsideParens(orderPart);
        orderFields.forEach((f, idx) => {
            lines.push(indent + f.trim() + (idx < orderFields.length - 1 ? ',' : ''));
        });
    }
    
    // LIMIT 部分
    if (limitMatch) {
        lines.push('LIMIT ' + limitMatch[1].trim());
    }
    
    // OFFSET 部分
    if (offsetMatch) {
        lines.push('OFFSET ' + offsetMatch[1].trim());
    }
    
    return lines;
}

// 格式化 FROM 子句（处理 JOIN）
function formatFromClause(fromPart, indent) {
    const lines = [];
    
    // 分割主表和 JOIN
    const joinPattern = /\b(LEFT|RIGHT|INNER|OUTER|CROSS|FULL|STRAIGHT)?\s*JOIN\b/i;
    const parts = fromPart.split(joinPattern);
    
    if (parts.length > 1) {
        // 有 JOIN
        let currentTable = '';
        parts.forEach((part, idx) => {
            const trimmed = part.trim();
            if (!trimmed) return;
            
            if (/JOIN$/i.test(trimmed)) {
                // 这是 JOIN 关键字前的部分
                if (currentTable) {
                    lines.push('FROM ' + currentTable);
                    currentTable = '';
                }
                lines.push(trimmed + ' ');
            } else if (/\bON\b/i.test(trimmed)) {
                // 处理 ON 条件
                const onMatch = trimmed.match(/^(.+?)\bON\b(.+)$/i);
                if (onMatch) {
                    lines.push(lines.length === 0 ? 'FROM ' + onMatch[1].trim() : indent + onMatch[1].trim());
                    lines.push(indent + 'ON ' + onMatch[2].trim());
                } else {
                    lines.push(lines.length === 0 ? 'FROM ' + trimmed : indent + trimmed);
                }
            } else if (lines.length === 0) {
                lines.push('FROM ' + trimmed);
            } else {
                lines.push(indent + trimmed);
            }
        });
    } else {
        // 没有 JOIN
        lines.push('FROM ' + fromPart);
    }
    
    return lines;
}

// 格式化 WHERE 子句
function formatWhereClause(wherePart, indent) {
    const lines = [];
    
    // 分割 AND/OR（但要忽略括号内的）
    const conditions = splitByAndOr(wherePart);
    
    conditions.forEach((cond, idx) => {
        const trimmed = cond.trim();
        if (!trimmed) return;
        
        // 检测是否以 AND/OR 开头
        const andOrMatch = trimmed.match(/^(\bAND\b|\bOR\b)\s*(.+)$/i);
        if (andOrMatch) {
            lines.push(indent + andOrMatch[1].toUpperCase() + ' ' + andOrMatch[2].trim());
        } else {
            lines.push(indent + trimmed);
        }
    });
    
    return lines;
}

// 格式化 WITH 语句
function formatWithStatement(stmt, indent) {
    const lines = [];
    
    // 提取 CTE 定义
    const cteMatch = stmt.match(/\bWITH\b(.+?)\bSELECT\b/i);
    if (cteMatch) {
        const ctePart = cteMatch[1].trim();
        const ctes = ctePart.split(/,(?=\s*\w+\s+AS\s+\()/i);
        
        lines.push('WITH');
        ctes.forEach((cte, idx) => {
            lines.push(indent + cte.trim() + (idx < ctes.length - 1 ? ',' : ''));
        });
    }
    
    // 添加剩余的 SELECT 部分
    const selectMatch = stmt.match(/\bSELECT\b.+$/i);
    if (selectMatch) {
        const selectLines = formatSelectStatement(stmt, indent);
        // 合并，避免重复
        const existingSelect = selectLines.findIndex(l => l.startsWith('SELECT'));
        if (existingSelect === -1) {
            lines.push(...selectLines);
        } else {
            // 只添加 SELECT 之后的部分
            for (let i = existingSelect; i < selectLines.length; i++) {
                lines.push(selectLines[i]);
            }
        }
    }
    
    return lines;
}

// 格式化 INSERT 语句
function formatInsertStatement(stmt, indent) {
    const lines = [];
    
    const insertMatch = stmt.match(/\bINSERT\s+INTO\b\s+(.+?)\s*\((.+?)\)\s*VALUES\s*\((.+)\)/i);
    if (insertMatch) {
        lines.push('INSERT INTO ' + insertMatch[1].trim());
        lines.push('(' + insertMatch[2].trim() + ')');
        lines.push('VALUES');
        lines.push('(' + insertMatch[3].trim() + ');');
    } else {
        // 简单处理
        lines.push(stmt.replace(/\s+/g, ' '));
    }
    
    return lines;
}

// 格式化 UPDATE 语句
function formatUpdateStatement(stmt, indent) {
    const lines = [];
    
    const updateMatch = stmt.match(/\bUPDATE\b\s+(\S+)\s+SET\b(.+?)(?=\bWHERE\b|$)/i);
    const whereMatch = stmt.match(/\bWHERE\b(.+)$/i);
    
    if (updateMatch) {
        lines.push('UPDATE ' + updateMatch[1]);
        lines.push('SET');
        
        const setPart = updateMatch[2].trim();
        const setFields = splitByCommitsOutsideParens(setPart);
        setFields.forEach((f, idx) => {
            lines.push(indent + f.trim() + (idx < setFields.length - 1 ? ',' : ''));
        });
        
        if (whereMatch) {
            lines.push('WHERE');
            const whereLines = formatWhereClause(whereMatch[1].trim(), indent);
            lines.push(...whereLines);
        }
    } else {
        lines.push(stmt.replace(/\s+/g, ' '));
    }
    
    return lines;
}

// 格式化 DELETE 语句
function formatDeleteStatement(stmt, indent) {
    const lines = [];
    
    const deleteMatch = stmt.match(/\bDELETE\s+FROM\b\s+(\S+)(?:\s+WHERE\b(.*))?/i);
    
    if (deleteMatch) {
        lines.push('DELETE FROM ' + deleteMatch[1]);
        
        if (deleteMatch[2]) {
            lines.push('WHERE');
            const whereLines = formatWhereClause(deleteMatch[2].trim(), indent);
            lines.push(...whereLines);
        }
    } else {
        lines.push(stmt.replace(/\s+/g, ' '));
    }
    
    return lines;
}

// 通用语句格式化
function formatGeneralStatement(stmt, indent) {
    return [stmt.replace(/\s+/g, ' ').replace(/\s*;\s*$/, '')];
}

// 在括号外按逗号分割
function splitByCommitsOutsideParens(str) {
    const fields = [];
    let current = '';
    let parenDepth = 0;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        
        if (char === '(') {
            parenDepth++;
            current += char;
        } else if (char === ')') {
            parenDepth--;
            current += char;
        } else if (char === ',' && parenDepth === 0) {
            if (current.trim()) {
                fields.push(current.trim());
            }
            current = '';
        } else {
            current += char;
        }
    }
    
    if (current.trim()) {
        fields.push(current.trim());
    }
    
    return fields;
}

// 按 AND/OR 分割（括号外）
function splitByAndOr(str) {
    const conditions = [];
    
    // 预处理：把 AND/OR 作为分隔符
    const pattern = /\b(AND|OR)\b(?!\s*\()/gi;
    let lastIndex = 0;
    let match;
    
    const tempStr = str;
    const matches = [];
    while ((match = pattern.exec(tempStr)) !== null) {
        // 检查这个 AND/OR 是否在括号外
        let beforeAndOr = tempStr.substring(lastIndex, match.index);
        let parenCheck = 0;
        for (let i = 0; i < beforeAndOr.length; i++) {
            if (beforeAndOr[i] === '(') parenCheck++;
            if (beforeAndOr[i] === ')') parenCheck--;
        }
        
        if (parenCheck === 0) {
            matches.push({
                index: match.index,
                keyword: match[0],
                fullMatch: match[0]
            });
            lastIndex = match.index + match[0].length;
        }
    }
    
    // 重新分割
    if (matches.length === 0) {
        return [str.trim()];
    }
    
    lastIndex = 0;
    for (const m of matches) {
        const segment = str.substring(lastIndex, m.index).trim();
        if (segment) {
            conditions.push(segment);
        }
        lastIndex = m.index + m.keyword.length;
    }
    
    const lastSegment = str.substring(lastIndex).trim();
    if (lastSegment) {
        conditions.push(lastSegment);
    }
    
    return conditions.length > 0 ? conditions : [str.trim()];
}

// 旧的简单格式化（保留作为备用）
function simpleFormat(sql) {
    let result = sql.trim();
    result = result.replace(/\s+/g, ' ');
    
    // 统一大写关键字
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 
        'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 
        'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'UNION', 'UNION ALL', 'WITH', 'AS'];
    
    keywords.forEach(kw => {
        const regex = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi');
        result = result.replace(regex, kw.toUpperCase());
    });
    
    // 基础换行处理
    result = result
        .replace(/\bSELECT\b\s*/gi, 'SELECT\n    ')
        .replace(/\bFROM\b\s*/gi, '\nFROM ')
        .replace(/\bWHERE\b\s*/gi, '\nWHERE ')
        .replace(/\bAND\b\s+/gi, '\n    AND ')
        .replace(/\bOR\b\s+/gi, '\n    OR ')
        .replace(/\bJOIN\b\s+/gi, '\nJOIN ')
        .replace(/\bLEFT\s+JOIN\b\s*/gi, '\nLEFT JOIN ')
        .replace(/\bRIGHT\s+JOIN\b\s*/gi, '\nRIGHT JOIN ')
        .replace(/\bINNER\s+JOIN\b\s*/gi, '\nINNER JOIN ')
        .replace(/\bCROSS\s+JOIN\b\s*/gi, '\nCROSS JOIN ')
        .replace(/\bGROUP\s+BY\b\s*/gi, '\nGROUP BY ')
        .replace(/\bHAVING\b\s*/gi, '\nHAVING ')
        .replace(/\bORDER\s+BY\b\s*/gi, '\nORDER BY ')
        .replace(/\bLIMIT\b\s*/gi, '\nLIMIT ')
        .replace(/\bSET\b\s*/gi, '\nSET ')
        .replace(/\bVALUES\b\s*/gi, '\nVALUES ');
    
    return result.trim();
}
