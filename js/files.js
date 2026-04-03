// SQL 文件管理功能

// 文件数据
let sqlFiles = {};
let currentFileId = null;
let currentSearchQuery = '';
let isSearchVisible = false;

// ========== File System Access API 相关 ==========
let directoryHandle = null;  // 文件夹句柄
let isSyncMode = false;      // 是否为同步模式

// 检查是否支持 File System Access API
function isFileSystemSupported() {
    return 'showDirectoryPicker' in window;
}

// 选择本地工作文件夹
async function selectWorkFolder() {
    if (!isFileSystemSupported()) {
        showToast('您的浏览器不支持 File System Access API，请使用 Chrome 或 Edge', 'error');
        return;
    }

    try {
        // 如果已有目录句柄，尝试请求权限
        if (directoryHandle) {
            try {
                const permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    isSyncMode = true;
                    updateSyncStatus();
                    await loadFilesFromFolder();
                    showToast('已连接到: ' + directoryHandle.name);
                    return;
                }
                // 请求权限（用户点击按钮后允许）
                const newPermission = await directoryHandle.requestPermission({ mode: 'readwrite' });
                if (newPermission === 'granted') {
                    isSyncMode = true;
                    updateSyncStatus();
                    await loadFilesFromFolder();
                    showToast('已连接到: ' + directoryHandle.name);
                    return;
                }
            } catch (e) {
                console.log('重新请求权限失败，需要重新选择文件夹');
            }
        }

        // 打开文件夹选择器
        directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        // 保存文件夹句柄到 IndexedDB（以便持久化）
        await saveDirectoryHandle(directoryHandle);

        isSyncMode = true;
        updateSyncStatus();

        // 加载文件夹中的文件（递归）
        await loadFilesFromFolder();

        showToast('已连接到: ' + directoryHandle.name);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('选择文件夹失败:', err);
            showToast('选择文件夹失败', 'error');
        }
    }
}

// 将目录句柄保存到 IndexedDB
async function saveDirectoryHandle(handle) {
    const db = await openDB();
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    await store.put(handle, 'workFolder');
}

// 从 IndexedDB 恢复目录句柄
async function restoreDirectoryHandle() {
    if (!isFileSystemSupported()) return false;
    
    try {
        const db = await openDB();
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        const handle = await new Promise((resolve, reject) => {
            const request = store.get('workFolder');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (handle) {
            // 验证权限
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                directoryHandle = handle;
                isSyncMode = true;
                return true;
            } else if (permission === 'prompt') {
                // 权限需要用户交互才能请求，保存句柄但不激活同步模式
                // 用户点击"链接到本地"时会再次检查
                directoryHandle = handle;
                isSyncMode = false;
                console.log('需要用户授权');
                return false;
            }
        }
    } catch (err) {
        console.error('恢复目录句柄失败:', err);
    }
    return false;
}

// 打开 IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SQLEditorDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
        };
    });
}

// 断开同步连接
async function disconnectWorkFolder() {
    if (directoryHandle) {
        directoryHandle = null;
        isSyncMode = false;
        sqlFiles = {};
        localStorage.removeItem('sqlEditorFolders');  // 清除文件夹缓存
        updateSyncStatus();
        renderFileList();
        showToast('已断开本地文件夹同步');
    }
}

// 更新同步状态显示
function updateSyncStatus() {
    const statusEl = document.getElementById('syncStatus');
    const folderBtn = document.getElementById('folderSyncBtn');
    const newFolderBtnText = document.getElementById('newFolderBtnText');
    
    if (!statusEl || !folderBtn) return;
    
    if (isSyncMode && directoryHandle) {
        statusEl.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="text-xs">${directoryHandle.name}</span>
        `;
        folderBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            断开
        `;
        folderBtn.title = '断开本地文件夹同步';
        folderBtn.onclick = disconnectWorkFolder;
        
        // 更新新建文件夹按钮文字
        if (newFolderBtnText) {
            newFolderBtnText.textContent = '新建目录';
        }
    } else {
        statusEl.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="text-xs">本地</span>
        `;
        folderBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            同步
        `;
        folderBtn.title = '选择本地文件夹同步';
        folderBtn.onclick = selectWorkFolder;
        
        // 恢复新建文件夹按钮文字
        if (newFolderBtnText) {
            newFolderBtnText.textContent = '文件夹';
        }
    }
}

// 递归遍历目录获取文件夹结构
async function traverseDirectory(dirHandle, path = '', parentFolderId = null) {
    const folders = {};
    const files = {};
    
    for await (const entry of dirHandle.values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        
        if (entry.kind === 'directory') {
            // 跳过隐藏文件夹（以点开头）
            if (entry.name.startsWith('.')) continue;
            
            const folderId = 'fs-folder-' + entry.name;
            
            // 注册文件夹
            folders[folderId] = {
                id: folderId,
                name: entry.name,
                parentId: parentFolderId,
                expanded: true,
                isFileSystem: true
            };
            
            // 递归处理子文件夹
            const subResult = await traverseDirectory(entry, entryPath, folderId);
            Object.assign(folders, subResult.folders);
            Object.assign(files, subResult.files);
        } else if (entry.kind === 'file' && entry.name.endsWith('.sql')) {
            // 处理 SQL 文件
            try {
                // 通过目录句柄重新获取文件以确保读取最新内容
                const fileHandle = await dirHandle.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const content = await file.text();
                // 使用唯一的路径哈希作为ID
                const fileHash = entryPath.replace(/[\/\\]/g, '-').replace(/\.sql$/i, '');
                const id = 'fs-' + fileHash;
                
                files[id] = {
                    id: id,
                    name: entry.name,
                    content: content,
                    folderId: parentFolderId,
                    createdAt: file.lastModified,
                    updatedAt: file.lastModified,
                    filePath: entryPath
                };
            } catch (e) {
                console.warn('读取文件失败:', entry.name, e);
            }
        }
    }
    
    return { folders, files };
}

// 从本地文件夹加载文件列表（支持子文件夹）
async function loadFilesFromFolder() {
    if (!directoryHandle) return;
    
    try {
        sqlFiles = {};
        const fsFolders = {};
        
        // 先重新获取根目录句柄以清空缓存
        const rootHandle = await getFreshDirectoryHandle(directoryHandle.name);
        if (!rootHandle) {
            console.error('无法获取目录句柄');
            return;
        }
        
        // 递归遍历获取所有文件和文件夹
        const result = await traverseDirectory(rootHandle);
        
        // 合并数据
        Object.assign(sqlFiles, result.files);
        Object.assign(fsFolders, result.folders);
        
        // 保存文件夹到 localStorage（供渲染使用）
        localStorage.setItem('sqlEditorFolders', JSON.stringify(fsFolders));
        
        renderFileList();
        showToast(`已加载 ${Object.keys(sqlFiles).length} 个文件，${Object.keys(fsFolders).length} 个文件夹`);
    } catch (err) {
        console.error('加载文件夹文件失败:', err);
        showToast('加载文件失败', 'error');
    }
}

// 获取新鲜的目录句柄（避免缓存）
async function getFreshDirectoryHandle(folderName) {
    // 通过查询获取新的句柄
    try {
        // 尝试从 IndexedDB 获取并请求新权限
        const db = await openDB();
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        
        return new Promise((resolve) => {
            const request = store.get('workFolder');
            request.onsuccess = () => {
                const handle = request.result;
                if (handle) {
                    // 尝试获取新句柄
                    resolve(handle);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// 保存文件到本地文件夹
async function saveFileToFolder(fileId) {
    if (!directoryHandle || !sqlFiles[fileId]) return false;
    
    const file = sqlFiles[fileId];
    
    try {
        // 确定文件路径
        let targetDir = directoryHandle;
        if (file.folderId && file.folderId.startsWith('fs-folder-')) {
            const folderName = file.folderId.replace('fs-folder-', '');
            targetDir = await directoryHandle.getDirectoryHandle(folderName);
        }
        
        // 每次都重新获取文件句柄来写入（避免缓存问题）
        const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.content);
        await writable.close();
        
        file.updatedAt = Date.now();
        
        return true;
    } catch (err) {
        console.error('保存文件失败:', err);
        return false;
    }
}

// 在本地文件夹创建新文件
async function createFileInFolder(fileName, folderId = null) {
    if (!directoryHandle) return null;
    
    try {
        // 生成唯一ID
        const timestamp = Date.now();
        const id = 'fs-' + timestamp + '-' + fileName.replace('.sql', '');
        
        // 确定目标目录
        let targetDir = directoryHandle;
        if (folderId && folderId.startsWith('fs-folder-')) {
            const folderName = folderId.replace('fs-folder-', '');
            targetDir = await directoryHandle.getDirectoryHandle(folderName);
        }
        
        // 创建文件
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write('');
        await writable.close();
        
        sqlFiles[id] = {
            id: id,
            name: fileName,
            content: '',
            folderId: folderId,
            createdAt: timestamp,
            updatedAt: timestamp,
            filePath: folderId ? folderId.replace('fs-folder-', '') + '/' + fileName : fileName
        };
        
        // 创建后立即刷新列表
        await loadFilesFromFolder();
        
        return id;
    } catch (err) {
        console.error('创建文件失败:', err);
        return null;
    }
}

// 删除本地文件夹中的文件
async function deleteFileInFolder(fileId) {
    if (!directoryHandle || !sqlFiles[fileId]) return false;
    
    const file = sqlFiles[fileId];
    
    try {
        // 确定文件所在目录
        let targetDir = directoryHandle;
        if (file.folderId && file.folderId.startsWith('fs-folder-')) {
            const folderName = file.folderId.replace('fs-folder-', '');
            targetDir = await directoryHandle.getDirectoryHandle(folderName);
        }
        
        // 只删除文件名，不使用 filePath（因为目标目录已经确定）
        await targetDir.removeEntry(file.name);
        return true;
    } catch (err) {
        console.error('删除文件失败:', err);
        return false;
    }
}

// 创建本地子文件夹
async function createFolderInWorkFolder() {
    if (!directoryHandle) {
        showToast('请先连接本地文件夹', 'error');
        return;
    }
    
    const folderName = prompt('请输入文件夹名称:', '新文件夹');
    if (!folderName || !folderName.trim()) return;
    
    const trimmedName = folderName.trim();
    
    // 检查是否已存在
    const existingFolders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    if (existingFolders['fs-folder-' + trimmedName]) {
        showToast('文件夹已存在', 'error');
        return;
    }
    
    try {
        // 在文件系统中创建真实文件夹
        await directoryHandle.getDirectoryHandle(trimmedName, { create: true });
        
        // 更新 localStorage
        existingFolders['fs-folder-' + trimmedName] = {
            id: 'fs-folder-' + trimmedName,
            name: trimmedName,
            parentId: null,
            expanded: true,
            isFileSystem: true
        };
        localStorage.setItem('sqlEditorFolders', JSON.stringify(existingFolders));
        
        renderFileList();
        showToast('已创建文件夹: ' + trimmedName);
    } catch (err) {
        console.error('创建文件夹失败:', err);
        showToast('创建文件夹失败', 'error');
    }
}

// 删除本地子文件夹
async function deleteFolderInWorkFolder(folderId) {
    if (!directoryHandle || !folderId.startsWith('fs-folder-')) return;
    
    const folderName = folderId.replace('fs-folder-', '');
    const folder = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}')[folderId];
    
    if (!folder) return;
    
    // 检查文件夹是否有文件
    const filesInFolder = Object.values(sqlFiles).filter(f => f.folderId === folderId);
    const msg = filesInFolder.length > 0 
        ? `文件夹 "${folder.name}" 中有 ${filesInFolder.length} 个文件，删除文件夹会同时删除这些文件。\n\n确定要删除吗?`
        : `确定删除文件夹 "${folder.name}" 吗?`;
    
    if (!confirm(msg)) return;
    
    try {
        // 删除文件夹中的所有文件
        for (const file of filesInFolder) {
            await deleteFileInFolder(file.id);
            delete sqlFiles[file.id];
        }
        
        // 删除真实文件夹
        await directoryHandle.removeEntry(folderName, { recursive: true });
        
        // 更新 localStorage
        delete folder[folderId];
        const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
        delete folders[folderId];
        localStorage.setItem('sqlEditorFolders', JSON.stringify(folders));
        
        renderFileList();
        showToast('已删除文件夹');
    } catch (err) {
        console.error('删除文件夹失败:', err);
        showToast('删除文件夹失败', 'error');
    }
}

// 初始化 - 尝试恢复之前的文件夹连接
async function initFileSystem() {
    if (await restoreDirectoryHandle()) {
        await loadFilesFromFolder();
        updateSyncStatus();
        // 启动定时同步
        startPeriodicSync();
    }
}

// 同步单个文件到本地磁盘
async function syncSingleFileToDisk(fileId) {
    if (!directoryHandle || !isSyncMode) return false;
    const file = sqlFiles[fileId];
    if (!file) return false;

    try {
        let targetDir = directoryHandle;
        if (file.folderId && file.folderId.startsWith('fs-folder-')) {
            const folderName = file.folderId.replace('fs-folder-', '');
            targetDir = await directoryHandle.getDirectoryHandle(folderName);
        }

        const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.content);
        await writable.close();
        file.updatedAt = Date.now();
        return true;
    } catch (err) {
        console.error('同步文件失败:', file.name, err);
        return false;
    }
}

// 同步所有文件到本地磁盘
async function syncAllToDisk() {
    if (!directoryHandle || !isSyncMode || Object.keys(sqlFiles).length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const fileId of Object.keys(sqlFiles)) {
        const success = await syncSingleFileToDisk(fileId);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    if (failCount === 0) {
        console.log(`已同步 ${successCount} 个文件到本地`);
    } else {
        console.error(`同步完成: 成功 ${successCount}, 失败 ${failCount}`);
    }
}

// 定时同步（每30秒）
let syncTimer = null;
function startPeriodicSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(async () => {
        // 先保存当前编辑内容
        if (currentFileId && editor) {
            const content = editor.getValue();
            if (sqlFiles[currentFileId] && sqlFiles[currentFileId].content !== content) {
                sqlFiles[currentFileId].content = content;
                sqlFiles[currentFileId].updatedAt = Date.now();
                saveFilesToStorage();
            }
        }
        // 同步到本地
        await syncAllToDisk();
    }, 30000);
}

// 页面关闭时同步
window.addEventListener('beforeunload', async (e) => {
    if (isSyncMode) {
        // 保存当前编辑内容
        if (currentFileId && editor) {
            const content = editor.getValue();
            if (sqlFiles[currentFileId] && sqlFiles[currentFileId].content !== content) {
                sqlFiles[currentFileId].content = content;
                sqlFiles[currentFileId].updatedAt = Date.now();
                saveFilesToStorage();
            }
        }
        // 同步到本地
        await syncAllToDisk();
    }
});

// 生成唯一ID
function generateId() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 从localStorage加载文件
function loadFilesFromStorage() {
    const saved = localStorage.getItem('sqlEditorFiles');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            sqlFiles = data.files || {};
            // 恢复展开状态
            Object.values(data.folders || {}).forEach(folder => {
                folder.expanded = true;
            });
        } catch (e) {
            sqlFiles = {};
        }
    }
}

// 保存文件到localStorage
function saveFilesToStorage() {
    const folders = {};
    // 收集所有文件夹
    Object.values(sqlFiles).forEach(file => {
        if (file.folderId) {
            folders[file.folderId] = { id: file.folderId, expanded: true };
        }
    });
    localStorage.setItem('sqlEditorFiles', JSON.stringify({ files: sqlFiles, folders }));
}

// 创建新文件
function createNewFile(folderId = null) {
    const fileName = prompt('请输入文件名:', '未命名.sql');
    if (!fileName) return null;
    
    // 确保文件名有 .sql 后缀
    let finalName = fileName.trim();
    if (!finalName.toLowerCase().endsWith('.sql')) {
        finalName += '.sql';
    }
    
    // 检查同名文件（在同一文件夹下不能有同名文件）
    const existingFile = Object.values(sqlFiles).find(f => 
        f.folderId === folderId && 
        f.name.toLowerCase() === finalName.toLowerCase()
    );
    if (existingFile) {
        showToast('该文件夹下已存在同名文件: ' + finalName, 'error');
        return null;
    }
    
    // 如果是同步模式，在本地文件夹创建文件
    if (isSyncMode) {
        const id = createFileInFolder(finalName);
        if (id) {
            // 保存当前文件
            if (currentFileId) {
                saveCurrentFile();
            }
            openFile(id);
            showToast('已创建: ' + finalName);
            return id;
        }
        showToast('创建文件失败', 'error');
        return null;
    }
    
    const id = generateId();
    const now = Date.now();
    
    // 先保存当前文件（如果有必要）
    if (currentFileId && editor) {
        const currentContent = editor.getValue() || '';
        const currentFile = sqlFiles[currentFileId];
        if (currentFile && currentFile.content !== currentContent) {
            currentFile.content = currentContent;
            currentFile.updatedAt = Date.now();
        }
    }
    
    // 创建新文件（内容为空）
    sqlFiles[id] = {
        id: id,
        name: finalName,
        content: '',  // 新建文件从空内容开始
        folderId: folderId,
        createdAt: now,
        updatedAt: now
    };
    
    // 保存并打开新文件
    saveFilesToStorage();
    openFile(id);
    
    showToast('已创建: ' + finalName);
    return id;
}

// 创建新文件夹
function createNewFolder(parentId = null) {
    const folderName = prompt('请输入文件夹名:', '新文件夹');
    if (!folderName || !folderName.trim()) return null;
    
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    const id = generateId();
    
    folders[id] = {
        id: id,
        name: folderName.trim(),
        parentId: parentId,
        expanded: true
    };
    
    localStorage.setItem('sqlEditorFolders', JSON.stringify(folders));
    renderFileList();
    
    showToast('已创建文件夹: ' + folderName.trim());
    return id;
}

// 打开文件
async function openFile(fileId) {
    // 验证文件是否存在
    if (!sqlFiles[fileId]) {
        console.error('文件不存在:', fileId);
        return;
    }
    
    // 保存当前文件的内容（如果编辑器有内容）
    if (currentFileId && currentFileId !== fileId) {
        const oldFile = sqlFiles[currentFileId];
        if (oldFile) {
            const currentContent = editor ? editor.getValue() : '';
            if (currentContent !== oldFile.content) {
                oldFile.content = currentContent;
                oldFile.updatedAt = Date.now();
                if (isSyncMode) {
                    await saveFileToFolder(currentFileId);
                } else {
                    saveFilesToStorage();
                }
            }
        }
    }
    
    // 获取新文件
    let file = sqlFiles[fileId];
    
    // 如果是同步模式，从磁盘重新读取最新内容
    if (isSyncMode && fileId.startsWith('fs-')) {
        try {
            let targetDir = directoryHandle;
            if (file.folderId && file.folderId.startsWith('fs-folder-')) {
                const folderName = file.folderId.replace('fs-folder-', '');
                targetDir = await directoryHandle.getDirectoryHandle(folderName);
            }
            
            // 通过目录句柄重新获取文件以确保读取最新内容
            const fileHandle = await targetDir.getFileHandle(file.name);
            const diskFile = await fileHandle.getFile();
            const content = await diskFile.text();
            
            // 更新内存中的内容
            file.content = content;
            sqlFiles[fileId].content = content;
        } catch (err) {
            console.warn('读取文件最新内容失败，使用缓存:', err);
        }
    }
    
    // 更新当前文件ID
    currentFileId = fileId;
    
    console.log('打开文件:', file.name, 'ID:', fileId, 'currentFileId:', currentFileId);
    
    // 更新编辑器内容
    if (editor) {
        editor.setValue(file.content || '');
        editor.setCursor(0, 0);
    }
    
    // 更新顶部文件名标签
    const fileNameEl = document.getElementById('currentFileName');
    const fileTabEl = document.getElementById('fileTab');
    if (fileNameEl) {
        fileNameEl.textContent = file.name;
    }
    if (fileTabEl) {
        fileTabEl.classList.remove('hidden');
    }
    
    // 重新渲染文件列表（添加高亮效果）
    renderFileList();
    
    // 更新字符数统计
    if (typeof updateCharCount === 'function') {
        updateCharCount();
    }
}

// 保存当前文件
async function saveCurrentFile() {
    if (!currentFileId) {
        // 没有打开的文件，创建新文件
        createNewFile();
        return;
    }
    
    const file = sqlFiles[currentFileId];
    if (file) {
        const currentContent = editor.getValue() || '';
        // 只有内容真正变化时才更新时间戳
        if (file.content !== currentContent) {
            file.content = currentContent;
            file.updatedAt = Date.now();
            
            // 根据模式选择保存方式
            if (isSyncMode) {
                const success = await saveFileToFolder(currentFileId);
                if (success) {
                    showToast('已保存到本地: ' + file.name);
                } else {
                    showToast('保存失败', 'error');
                }
            } else {
                saveFilesToStorage();
                showToast('已保存: ' + file.name);
            }
        } else if (isSyncMode) {
            // 内容没变但可能需要同步
            await saveFileToFolder(currentFileId);
        }
        renderFileList();
    }
}

// 静默保存（不显示提示）
function saveCurrentFileSilent() {
    if (!currentFileId) return;
    
    const file = sqlFiles[currentFileId];
    if (file) {
        file.content = editor.getValue();
        file.updatedAt = Date.now();
        saveFilesToStorage();
    }
}

// 重命名文件
function renameFile(fileId) {
    const file = sqlFiles[fileId];
    if (!file) return;
    
    const newName = prompt('请输入新文件名:', file.name);
    if (!newName || !newName.trim()) return;
    
    let finalName = newName.trim();
    if (!finalName.toLowerCase().endsWith('.sql')) {
        finalName += '.sql';
    }
    
    // 检查同名文件（在同一文件夹下不能有同名文件，但允许改成大小写不同的原名）
    if (file.name.toLowerCase() !== finalName.toLowerCase()) {
        const existingFile = Object.values(sqlFiles).find(f => 
            f.id !== fileId &&
            f.folderId === file.folderId && 
            f.name.toLowerCase() === finalName.toLowerCase()
        );
        if (existingFile) {
            showToast('该文件夹下已存在同名文件: ' + finalName, 'error');
            return;
        }
    }
    
    file.name = finalName;
    file.updatedAt = Date.now();
    saveFilesToStorage();
    
    if (currentFileId === fileId) {
        document.getElementById('currentFileName').textContent = finalName;
    }
    
    renderFileList();
    showToast('已重命名为: ' + finalName);
}

// 删除文件
async function deleteFile(fileId) {
    const file = sqlFiles[fileId];
    if (!file) return;
    
    if (!confirm(`确定删除文件 "${file.name}" 吗?`)) return;
    
    // 如果是同步模式，先删除本地文件
    if (isSyncMode) {
        await deleteFileInFolder(fileId);
    }
    
    delete sqlFiles[fileId];
    
    if (currentFileId === fileId) {
        currentFileId = null;
        editor.setValue('');
        document.getElementById('fileTab').classList.add('hidden');
    }
    
    if (isSyncMode) {
        renderFileList();
    } else {
        saveFilesToStorage();
        renderFileList();
    }
    showToast('已删除: ' + file.name);
}

// 重命名文件夹
function renameFolder(folderId) {
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    const folder = folders[folderId];
    if (!folder) return;
    
    // 文件系统文件夹不支持重命名
    if (folder.isFileSystem) {
        showToast('本地文件夹不支持重命名，请在系统中操作', 'error');
        return;
    }
    
    const newName = prompt('请输入新文件夹名:', folder.name);
    if (!newName || !newName.trim()) return;
    
    folder.name = newName.trim();
    localStorage.setItem('sqlEditorFolders', JSON.stringify(folders));
    renderFileList();
    showToast('已重命名文件夹为: ' + newName.trim());
}

// 删除文件夹
async function deleteFolder(folderId) {
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    const folder = folders[folderId];
    if (!folder) return;
    
    // 检查文件夹是否有文件
    const filesInFolder = Object.values(sqlFiles).filter(f => f.folderId === folderId);
    const msg = filesInFolder.length > 0 
        ? `文件夹 "${folder.name}" 中有 ${filesInFolder.length} 个文件，删除文件夹会同时删除这些文件。\n\n确定要删除吗?`
        : `确定删除文件夹 "${folder.name}" 吗?`;
    
    if (!confirm(msg)) return;
    
    // 如果是文件系统文件夹，使用特殊删除
    if (folder.isFileSystem) {
        await deleteFolderInWorkFolder(folderId);
        return;
    }
    
    // 删除文件夹中的所有文件
    filesInFolder.forEach(f => {
        if (currentFileId === f.id) {
            currentFileId = null;
            editor.setValue('');
            document.getElementById('fileTab').classList.add('hidden');
        }
        delete sqlFiles[f.id];
    });
    
    // 删除文件夹
    delete folders[folderId];
    localStorage.setItem('sqlEditorFolders', JSON.stringify(folders));
    saveFilesToStorage();
    renderFileList();
    showToast('已删除文件夹');
}

// 切换文件夹展开/收起
function toggleFolder(folderId) {
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    if (folders[folderId]) {
        folders[folderId].expanded = !folders[folderId].expanded;
        localStorage.setItem('sqlEditorFolders', JSON.stringify(folders));
        renderFileList();
    }
}

// 移动文件到文件夹
async function moveFileToFolder(fileId, folderId) {
    const file = sqlFiles[fileId];
    if (!file) return;

    const originalFolderId = file.folderId;

    // 如果是同步模式（已连接本地文件夹），执行真实文件移动
    if (isSyncMode && directoryHandle) {
        try {
            // 1. 在新目标目录创建文件
            let targetDir = directoryHandle;
            if (folderId && folderId.startsWith('fs-folder-')) {
                const folderName = folderId.replace('fs-folder-', '');
                targetDir = await directoryHandle.getDirectoryHandle(folderName);
            }

            const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file.content);
            await writable.close();

            // 2. 删除原位置的文件
            if (originalFolderId && originalFolderId.startsWith('fs-folder-')) {
                const originalFolderName = originalFolderId.replace('fs-folder-', '');
                const originalDir = await directoryHandle.getDirectoryHandle(originalFolderName);
                await originalDir.removeEntry(file.name);
            } else if (!originalFolderId || originalFolderId === '') {
                // 文件在根目录
                await directoryHandle.removeEntry(file.name);
            }
        } catch (err) {
            console.error('移动文件失败:', err);
            // 即使失败也继续更新记录
        }
    }

    // 3. 更新元数据
    file.folderId = folderId;
    file.updatedAt = Date.now();
    saveFilesToStorage();
    renderFileList();
    showToast('已将文件移动到文件夹');
}

// 渲染文件列表
function renderFileList() {
    const container = document.getElementById('fileList');
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    const searchQuery = currentSearchQuery.toLowerCase();
    
    console.log('renderFileList called, currentFileId:', currentFileId, 'searchQuery:', searchQuery);
    
    // 收集根目录文件和文件夹
    const rootFiles = Object.values(sqlFiles)
        .filter(f => !f.folderId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    
    const rootFolders = Object.values(folders)
        .filter(f => !f.parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    // 过滤搜索结果（但确保当前打开的文件始终显示）
    function filterFiles(files) {
        if (!searchQuery) return files;
        return files.filter(f => {
            // 始终显示当前打开的文件
            if (f.id === currentFileId) return true;
            const nameMatch = f.name.toLowerCase().includes(searchQuery);
            const contentMatch = f.content && f.content.toLowerCase().includes(searchQuery);
            return nameMatch || contentMatch;
        });
    }
    
    // 格式化时间
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        return date.toLocaleDateString();
    }
    
    // 渲染文件项
    function renderFileItem(file) {
        const isActive = currentFileId === file.id;
        let displayName = file.name;
        let displayMeta = formatTime(file.updatedAt);
        
        // 搜索高亮
        if (searchQuery) {
            if (file.name.toLowerCase().includes(searchQuery)) {
                displayName = highlightMatch(file.name, searchQuery);
            }
        }
        
        return `
            <div class="file-item ${isActive ? 'active' : ''}" onclick="openFile('${file.id}')" draggable="true" 
                 ondragstart="handleFileDragStart(event, '${file.id}')"
                 ondragover="handleFileDragOver(event)"
                 ondrop="handleFileDrop(event, '${file.id}')">
                <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <div class="file-info">
                    <div class="file-name">${displayName}</div>
                    <div class="file-meta">${displayMeta}</div>
                </div>
                <div class="file-actions">
                    <button onclick="event.stopPropagation(); renameFile('${file.id}')" class="file-action-btn" title="重命名">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="file-action-btn" title="删除">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f44747" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6M8,6V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2V6"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }
    
    // 渲染文件夹
    function renderFolder(folder) {
        const folderFiles = Object.values(sqlFiles)
            .filter(f => f.folderId === folder.id)
            .sort((a, b) => b.updatedAt - a.updatedAt);
        
        const filteredFolderFiles = filterFiles(folderFiles);
        
        // 搜索模式下，如果文件夹内没有匹配的文件，也隐藏文件夹
        // 但如果当前打开的文件在这个文件夹里，就不能隐藏
        const hasCurrentFile = folderFiles.some(f => f.id === currentFileId);
        if (searchQuery && filteredFolderFiles.length === 0 && !hasCurrentFile) {
            // 检查文件夹名是否匹配
            if (!folder.name.toLowerCase().includes(searchQuery)) {
                return '';
            }
        }
        
        let displayName = folder.name;
        if (searchQuery && folder.name.toLowerCase().includes(searchQuery)) {
            displayName = highlightMatch(folder.name, searchQuery);
        }
        
        const expanded = folder.expanded !== false;
        
        return `
            <div class="folder-item">
                <div class="folder-header" onclick="toggleFolder('${folder.id}')" 
                     ondragover="handleFileDragOver(event)"
                     ondrop="handleFolderDrop(event, '${folder.id}')">
                    <svg class="folder-icon ${expanded ? 'expanded' : ''}" viewBox="0 0 24 24" fill="none" stroke="#dcdcaa" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="#dcdcaa" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="folder-name">${displayName}</span>
                    <span class="text-xs text-[var(--text-secondary)] ml-1">(${folderFiles.length})</span>
                    <div class="folder-actions">
                        <button onclick="event.stopPropagation(); showMoveFileDialog('${folder.id}')" class="file-action-btn" title="移动文件到此处">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                        </button>
                        <button onclick="event.stopPropagation(); renameFolder('${folder.id}')" class="file-action-btn" title="重命名">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button onclick="event.stopPropagation(); deleteFolder('${folder.id}')" class="file-action-btn" title="删除">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f44747" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6M8,6V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2V6"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="folder-content ${expanded ? '' : 'collapsed'}">
                    ${filteredFolderFiles.map(f => renderFileItem(f)).join('')}
                </div>
            </div>
        `;
    }
    
    // 构建HTML
    let html = '';
    
    // 渲染根目录文件夹
    rootFolders.forEach(folder => {
        html += renderFolder(folder);
    });
    
    // 渲染根目录文件
    const filteredRootFiles = filterFiles(rootFiles);
    filteredRootFiles.forEach(file => {
        html += renderFileItem(file);
    });
    
    // 空状态
    if (!html) {
        html = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <p>${searchQuery ? '没有找到匹配的文件' : '暂无保存的文件'}</p>
                <p class="text-xs mt-1">${searchQuery ? '尝试其他关键词' : '点击上方"新建"按钮保存当前SQL'}</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// 高亮搜索匹配
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-match">$1</span>');
}

// 搜索文件
function searchFiles() {
    const input = document.getElementById('fileSearchInput');
    currentSearchQuery = input.value.trim();
    renderFileList();
}

// 切换搜索面板
function toggleSearchPanel() {
    isSearchVisible = !isSearchVisible;
    const container = document.getElementById('fileSearchContainer');
    container.classList.toggle('hidden', !isSearchVisible);
    
    if (isSearchVisible) {
        document.getElementById('fileSearchInput').focus();
    } else {
        currentSearchQuery = '';
        document.getElementById('fileSearchInput').value = '';
        renderFileList();
    }
}

// 显示新建文件对话框
function showNewFileDialog() {
    createNewFile();
}

// 显示新建文件夹对话框
function showNewFolderDialog() {
    // 如果是同步模式，调用文件系统版本
    if (isSyncMode) {
        createFolderInWorkFolder();
    } else {
        createNewFolder();
    }
}

// 显示移动文件对话框
async function showMoveFileDialog(targetFolderId) {
    const folders = JSON.parse(localStorage.getItem('sqlEditorFolders') || '{}');
    const folderList = Object.values(folders);
    
    if (folderList.length === 0) {
        showToast('还没有文件夹', 'error');
        return;
    }
    
    const options = folderList.map(f => f.name).join('\n');
    const folderName = prompt(`移动到哪个文件夹?\n\n可用文件夹:\n${options}\n\n输入文件夹名:`, folders[targetFolderId]?.name || '');
    
    if (!folderName) return;
    
    const targetFolder = folderList.find(f => f.name === folderName);
    if (!targetFolder) {
        showToast('未找到该文件夹', 'error');
        return;
    }
    
    // 移动当前文件到目标文件夹
    if (currentFileId) {
        await moveFileToFolder(currentFileId, targetFolder.id);
    }
}

// 文件拖拽相关
let draggedFileId = null;

function handleFileDragStart(event, fileId) {
    draggedFileId = fileId;
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
}

function handleFileDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

function handleFileDrop(event, targetFileId) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    if (draggedFileId && draggedFileId !== targetFileId) {
        // 获取目标文件的文件夹
        const targetFile = sqlFiles[targetFileId];
        if (targetFile) {
            moveFileToFolder(draggedFileId, targetFile.folderId);
        }
    }

    draggedFileId = null;
    event.target.style.opacity = '1';
}

function handleFolderDrop(event, folderId) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    if (draggedFileId) {
        moveFileToFolder(draggedFileId, folderId);
    }

    draggedFileId = null;
}
