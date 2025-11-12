const { ipcRenderer } = require('electron');

// 全局错误捕获
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  alert(t('errorOccurred') + ': ' + event.error.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  alert(t('asyncOperationFailed') + ': ' + event.reason);
});

// 语言切换功能
function updateUILanguage() {
  const lang = getCurrentLanguage();
  
  // 更新标签页
  const tabs = document.querySelectorAll('.tab');
  if (tabs[0]) tabs[0].textContent = t('tabRegister');
  if (tabs[1]) tabs[1].textContent = t('tabSwitch');
  if (tabs[2]) tabs[2].textContent = t('tabFreeAccounts');
  if (tabs[3]) tabs[3].textContent = t('tabTutorial');
  if (tabs[4]) tabs[4].textContent = t('tabSettings');
  
  // 更新所有带 data-i18n 属性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  
  // 更新所有带 data-i18n-placeholder 属性的元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  
  // 更新所有带 data-i18n-html 属性的元素（支持HTML内容）
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key);
  });
  
  // 重新渲染账号列表（更新徽标文本）
  if (typeof loadAccounts === 'function') {
    loadAccounts();
  }
  if (typeof renderSwitchAccountsGrid === 'function') {
    renderSwitchAccountsGrid();
  }
  if (typeof renderUsedAccountsGrid === 'function') {
    renderUsedAccountsGrid();
  }
}

// 页面加载完成后更新语言
window.addEventListener('DOMContentLoaded', () => {
  updateUILanguage();
});

let currentConfig = {
  emailDomains: ['example.com'],
  emailConfig: null
};

// 切换账号UI的状态
let switchAccountsCache = [];
let selectedSwitchAccountId = '';
let usedAccountIds = new Set(); // 已使用账号ID集合（持久化到localStorage）
let deleteMode = false; // 账号管理-删除模式

function loadUsedAccountsFromStorage() {
  try {
    const raw = localStorage.getItem('usedAccounts');
    if (raw) {
      const arr = JSON.parse(raw);
      usedAccountIds = new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {}
}

function saveUsedAccountsToStorage() {
  try {
    localStorage.setItem('usedAccounts', JSON.stringify(Array.from(usedAccountIds)));
  } catch {}
}

// 切换标签页
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  if (tabName === 'register') {
    // 合并后：在“批量注册 / 账号管理”页刷新账号列表
    loadAccounts();
  } else if (tabName === 'switch') {
    loadAccountsForSwitch();
  } else if (tabName === 'freeAccounts') {
    // 免费账号页面，确保 iframe 加载
    const iframe = document.getElementById('freeAccountsFrame');
    if (iframe && !iframe.src) {
      iframe.src = 'http://www.crispvibe.cn/windsurf';
    }
  } else if (tabName === 'settings') {
    loadSettings();
  }
}

// 渲染“切换账号”网格（无搜索，直接展示）
function renderSwitchAccountsGrid() {
  const grid = document.getElementById('switchAccountsGrid');
  if (!grid) return;

  // 过滤掉已使用账号
  const list = (switchAccountsCache || []).filter(acc => !usedAccountIds.has(acc.id));

  if (!list || list.length === 0) {
    grid.innerHTML = `<div style="color:#999; padding:10px;">${t('noAccounts')}</div>`;
    return;
  }

  grid.innerHTML = list.map(acc => {
    const expiry = calculateExpiry(acc.createdAt);
    const selected = acc.id === selectedSwitchAccountId;
    const borderColor = selected ? '#0071e3' : 'rgba(0,0,0,0.06)';
    const bg = selected ? '#eaf3ff' : '#f5f5f7';
    const statusBadge = expiry.isExpired 
      ? `<span class="badge" style="background:#e74c3c;">${t('expired')}</span>`
      : `<span class="badge" style="background:${expiry.expiryColor};">${expiry.expiryText}</span>`;

    return `
      <div class="switch-account-card" data-id="${acc.id}" style="background:${bg}; border-color:${borderColor};">
        ${statusBadge}
        <div class="email">${acc.email}</div>
        <div class="meta">${t('expiryDate')}: ${expiry.expiryDate.toLocaleDateString()}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.switch-account-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      selectedSwitchAccountId = id;
      const selectedEl = document.getElementById('selectedSwitchAccount');
      const acc = switchAccountsCache.find(a => a.id === id);
      if (selectedEl && acc) {
        selectedEl.textContent = `${t('selectedAccount')}：${acc.email}`;
        selectedEl.removeAttribute('data-i18n');
      }
      renderSwitchAccountsGrid();
    });
  });
}

// 渲染“已使用账号”网格
function renderUsedAccountsGrid() {
  const grid = document.getElementById('usedAccountsGrid');
  if (!grid) return;
  const list = (switchAccountsCache || []).filter(acc => usedAccountIds.has(acc.id));
  if (list.length === 0) {
    grid.innerHTML = `<div style="color:#999; padding:10px;">${t('noUsedAccounts')}</div>`;
    return;
  }
  grid.innerHTML = list.map(acc => {
    const expiry = calculateExpiry(acc.createdAt);
    const statusBadge = expiry.isExpired 
      ? `<span class="badge" style="background:#e74c3c;">${t('expired')}</span>`
      : `<span class="badge" style="background:${expiry.expiryColor};">${expiry.expiryText}</span>`;
    return `
      <div class="used-account-card" data-id="${acc.id}">
        ${statusBadge}
        <div class="email">${acc.email}</div>
        <div class="meta" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${t('expiryDate')}: ${expiry.expiryDate.toLocaleDateString()}</span>
          <button class="btn" data-action="restore" style="padding:4px 8px; font-size:11px; margin:0;">${t('restore')}</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.used-account-card button[data-action="restore"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.used-account-card');
      const id = card && card.getAttribute('data-id');
      if (!id) return;
      restoreUsedAccount(id);
    });
  });
}

function markAccountUsed(id) {
  if (!id) return;
  usedAccountIds.add(id);
  saveUsedAccountsToStorage();
  // 清除已选提示（避免选中的是已使用的账号）
  if (selectedSwitchAccountId === id) {
    selectedSwitchAccountId = '';
    const selectedEl = document.getElementById('selectedSwitchAccount');
    if (selectedEl) selectedEl.textContent = '未选择账号';
  }
  renderSwitchAccountsGrid();
  renderUsedAccountsGrid();
}

function restoreUsedAccount(id) {
  if (!id) return;
  usedAccountIds.delete(id);
  saveUsedAccountsToStorage();
  renderSwitchAccountsGrid();
  renderUsedAccountsGrid();
}

// ==================== 批量注册 ====================

async function startBatchRegister() {
  const count = parseInt(document.getElementById('registerCount').value);
  
  if (!count || count < 1) {
    alert(t('invalidRegisterCount'));
    return;
  }
  
  if (!currentConfig.emailConfig) {
    alert(t('pleaseConfigureIMAP'));
    return;
  }
  
  document.getElementById('registerProgress').style.display = 'block';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressFill').textContent = '0%';
  
  const result = await ipcRenderer.invoke('batch-register', {
    count,
    ...currentConfig
  });
  
  const successCount = result.filter(r => r.success).length;
  const failedCount = result.filter(r => !r.success).length;
  const failedResults = result.filter(r => !r.success);
  
  let errorDetails = '';
  if (failedCount > 0) {
    errorDetails = '<br><br><strong>失败详情:</strong><br>';
    failedResults.forEach((r, index) => {
      errorDetails += `${index + 1}. ${r.error || '未知错误'}<br>`;
    });
  }
  
  document.getElementById('registerStatus').innerHTML = `
    <div class="status-message ${successCount > 0 ? 'status-success' : 'status-error'}">
      <strong>注册完成！</strong><br>
      成功: ${successCount} 个<br>
      失败: ${failedCount} 个
      ${errorDetails}
    </div>
  `;
}

// 监听注册进度
ipcRenderer.on('registration-progress', (event, progress) => {
  const percent = Math.round((progress.current / progress.total) * 100);
  document.getElementById('progressFill').style.width = percent + '%';
  const progressText = document.getElementById('progressText');
  if (progressText) {
    progressText.textContent = `${progress.current} / ${progress.total} (${percent}%)`;
  }
});

// 监听实时日志
ipcRenderer.on('registration-log', (event, log) => {
  const statusEl = document.getElementById('registerStatus');
  const currentContent = statusEl.innerHTML;
  
  // 如果是新的开始标记,清空之前的内容
  if (log.includes('========== 开始注册第')) {
    statusEl.innerHTML = `
      <div class="status-message status-info" style="max-height:400px; overflow-y:auto; text-align:left; font-family:monospace; font-size:12px; line-height:1.6;">
        ${log}<br>
      </div>
    `;
  } else {
    // 追加日志
    const messageDiv = statusEl.querySelector('.status-message');
    if (messageDiv) {
      messageDiv.innerHTML += log + '<br>';
      // 自动滚动到底部
      messageDiv.scrollTop = messageDiv.scrollHeight;
    } else {
      statusEl.innerHTML = `
        <div class="status-message status-info" style="max-height:400px; overflow-y:auto; text-align:left; font-family:monospace; font-size:12px; line-height:1.6;">
          ${log}<br>
        </div>
      `;
    }
  }
});

// ==================== 账号管理 ====================

/**
 * 计算账号到期信息
 * Pro试用期为13天
 */
function calculateExpiry(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  const expiryDate = new Date(created);
  expiryDate.setDate(expiryDate.getDate() + 13); // 13天后到期
  
  const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  
  return {
    expiryDate,
    daysLeft,
    isExpired,
    expiryText: isExpired ? t('expired') : `${t('daysLeft')}${daysLeft}${t('days')}`,
    expiryColor: isExpired ? '#e74c3c' : (daysLeft <= 3 ? '#ff9500' : '#007aff')
  };
}

async function loadAccounts() {
  const accounts = await ipcRenderer.invoke('get-accounts');
  const listEl = document.getElementById('accountsList');
  
  if (accounts.length === 0) {
    listEl.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:#999; padding:20px;">${t('noAccounts')}</p>`;
    document.getElementById('accountStats').style.display = 'none';
    return;
  }
  
  // 统计信息
  let totalCount = accounts.length;
  let activeCount = 0;
  let warningCount = 0;
  let expiredCount = 0;
  
  listEl.innerHTML = accounts.map(acc => {
    const expiry = calculateExpiry(acc.createdAt);
    
    // 统计分类
    if (expiry.isExpired) {
      expiredCount++;
    } else if (expiry.daysLeft <= 3) {
      warningCount++;
      activeCount++;
    } else {
      activeCount++;
    }
    
    const statusBadge = expiry.isExpired 
      ? '<span class="badge" style="background:#e74c3c;">已到期</span>'
      : `<span class="badge" style="background:${expiry.expiryColor};">${expiry.expiryText}</span>`;

    return `
      <div class="account-card" data-id="${acc.id}" data-email="${acc.email}" data-password="${acc.password}">
        ${statusBadge}
        <div class="email">${acc.email}</div>
        <div class="meta">到期: ${expiry.expiryDate.toLocaleDateString()}</div>
      </div>
    `;
  }).join('');
  
  // 更新统计信息
  document.getElementById('accountStats').style.display = 'block';
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('activeCount').textContent = activeCount;
  document.getElementById('warningCount').textContent = warningCount;
  document.getElementById('expiredCount').textContent = expiredCount;

  // 绑定卡片点击：删除模式->删除；否则->复制
  Array.from(listEl.querySelectorAll('.account-card')).forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.getAttribute('data-id');
      const email = card.getAttribute('data-email');
      const password = card.getAttribute('data-password');
      if (deleteMode) {
        if (!confirm(`确定删除账号：${email} 吗？`)) return;
        const result = await ipcRenderer.invoke('delete-account', id);
        if (result.success) {
          loadAccounts();
        } else {
          alert(t('deleteFailed') + ': ' + result.error);
        }
      } else {
        copyAccount(email, password);
      }
    });
  });
}

function showAddAccountForm() {
  const modal = document.getElementById('addAccountModal');
  if (modal) modal.classList.add('active');
}

function hideAddAccountForm() {
  const modal = document.getElementById('addAccountModal');
  if (modal) modal.classList.remove('active');
  // 清空输入框
  document.getElementById('manualEmail').value = '';
  document.getElementById('manualPassword').value = '';
}

async function addManualAccount() {
  const email = document.getElementById('manualEmail').value;
  const password = document.getElementById('manualPassword').value;
  
  if (!email || !password) {
    alert(t('pleaseCompleteInfo'));
    return;
  }
  
  const result = await ipcRenderer.invoke('add-account', { email, password });
  
  if (result.success) {
    alert(t('addSuccess'));
    hideAddAccountForm();
    loadAccounts();
  } else {
    alert(t('addFailed') + ': ' + result.error);
  }
}

// ==================== 导入账号 ====================

function showImportAccountForm() {
  const modal = document.getElementById('importAccountModal');
  if (modal) modal.classList.add('active');
  
  // 重置表单
  document.getElementById('importFile').value = '';
  document.getElementById('importPreview').value = '';
  document.getElementById('importResult').innerHTML = '';
  
  // 监听文件选择
  const fileInput = document.getElementById('importFile');
  fileInput.onchange = handleFileSelect;
}

function hideImportAccountForm() {
  const modal = document.getElementById('importAccountModal');
  if (modal) modal.classList.remove('active');
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // 检查文件类型
  if (!file.name.endsWith('.txt')) {
    alert('仅支持 .txt 文件！');
    event.target.value = '';
    return;
  }
  
  // 读取文件内容
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    document.getElementById('importPreview').value = content;
  };
  reader.readAsText(file, 'utf-8');
}

async function importAccounts() {
  const content = document.getElementById('importPreview').value.trim();
  
  if (!content) {
    alert('请先选择文件！');
    return;
  }
  
  // 解析账号
  const lines = content.split('\n').filter(line => line.trim());
  const accounts = [];
  const errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const parts = line.split(/\s+/); // 按空格分割
    
    if (parts.length < 2) {
      errors.push(`第 ${i + 1} 行格式错误：${line}`);
      continue;
    }
    
    const email = parts[0];
    const password = parts.slice(1).join(' '); // 密码可能包含空格
    
    // 简单的邮箱验证
    if (!email.includes('@')) {
      errors.push(`第 ${i + 1} 行邮箱格式错误：${email}`);
      continue;
    }
    
    accounts.push({ email, password });
  }
  
  if (accounts.length === 0) {
    alert('没有有效的账号数据！');
    return;
  }
  
  // 显示确认信息
  const confirmMsg = `准备导入 ${accounts.length} 个账号` + 
    (errors.length > 0 ? `\n跳过 ${errors.length} 个错误行` : '') +
    '\n\n确定要导入吗？';
  
  if (!confirm(confirmMsg)) return;
  
  // 批量导入
  const resultEl = document.getElementById('importResult');
  resultEl.innerHTML = '<div class="status-message status-info">正在导入...</div>';
  
  let successCount = 0;
  let failCount = 0;
  const failDetails = [];
  
  for (const account of accounts) {
    const result = await ipcRenderer.invoke('add-account', account);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failDetails.push(`${account.email}: ${result.error}`);
    }
  }
  
  // 显示结果
  let resultHtml = `<div class="status-message ${failCount === 0 ? 'status-success' : 'status-info'}">`;
  resultHtml += `<strong>导入完成！</strong><br>`;
  resultHtml += `成功: ${successCount} 个<br>`;
  resultHtml += `失败: ${failCount} 个`;
  
  if (errors.length > 0) {
    resultHtml += `<br>格式错误: ${errors.length} 行`;
  }
  
  if (failDetails.length > 0) {
    resultHtml += `<br><br><details><summary>查看失败详情</summary><div style="margin-top:8px; font-size:11px;">`;
    failDetails.forEach(detail => {
      resultHtml += `• ${detail}<br>`;
    });
    resultHtml += `</div></details>`;
  }
  
  resultHtml += `</div>`;
  resultEl.innerHTML = resultHtml;
  
  // 刷新账号列表
  if (successCount > 0) {
    loadAccounts();
  }
}

async function deleteAccount(id) {
  if (!confirm('确定要删除这个账号吗？')) return;
  
  const result = await ipcRenderer.invoke('delete-account', id);
  
  if (result.success) {
    loadAccounts();
  } else {
    alert(t('deleteFailed') + ': ' + result.error);
  }
}

function toggleDeleteMode() {
  deleteMode = !deleteMode;
  const btn = document.getElementById('deleteModeBtn');
  if (btn) {
    btn.textContent = deleteMode ? t('deleteModeOn') : t('deleteModeOff');
    btn.className = deleteMode ? 'btn btn-danger' : 'btn btn-warning';
    btn.setAttribute('data-i18n', deleteMode ? 'deleteModeOn' : 'deleteModeOff');
  }
}

function copyAccount(email, password) {
  const text = `${t('email')}: ${email}\n${t('password')}: ${password}`;
  navigator.clipboard.writeText(text);
  alert(t('accountCopied'));
}

// ==================== 切换账号 ====================

async function loadAccountsForSwitch() {
  const accounts = await ipcRenderer.invoke('get-accounts');
  switchAccountsCache = accounts || [];

  // 初始不选择
  selectedSwitchAccountId = '';
  const selectedEl = document.getElementById('selectedSwitchAccount');
  if (selectedEl) selectedEl.textContent = '未选择账号';

  // 渲染网格
  renderSwitchAccountsGrid();
  renderUsedAccountsGrid();

  // 检测Windsurf配置路径
  await detectWindsurfPaths();
}

// 检测Windsurf配置路径
async function detectWindsurfPaths() {
  const paths = await ipcRenderer.invoke('detect-windsurf-paths');
  
  let html = '<div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:6px;">';
  html += '<h4>Windsurf配置路径检测</h4>';
  html += '<div style="font-size:12px; margin-top:10px;">';
  
  for (const key in paths) {
    const item = paths[key];
    const status = item.exists ? '✓' : '✗';
    const color = item.exists ? '#27ae60' : '#999';
    html += `<div style="margin:5px 0; color:${color};">${status} ${key}: ${item.path}</div>`;
  }
  
  html += '</div></div>';
  
  const statusEl = document.getElementById('switchStatus');
  if (statusEl.innerHTML === '') {
    statusEl.innerHTML = html;
  }
}

// 监听切换进度
ipcRenderer.on('switch-progress', (event, progress) => {
  const statusEl = document.getElementById('switchStatus');
  const logDiv = statusEl.querySelector('.log-container');
  
  if (logDiv) {
    // 如果已有日志容器，只更新进度
    const progressDiv = statusEl.querySelector('.progress-info');
    if (progressDiv) {
      progressDiv.innerHTML = `<strong>步骤 ${progress.step}/5:</strong> ${progress.message}`;
    }
  } else {
    // 首次显示，创建完整结构
    statusEl.innerHTML = `
      <div class="status-message status-info">
        <div class="progress-info">
          <strong>步骤 ${progress.step}/5:</strong> ${progress.message}
        </div>
        <div class="log-container" style="margin-top:15px; max-height:600px; overflow-y:auto; background:#f5f5f5; padding:10px; border-radius:4px; font-family:monospace; font-size:12px; line-height:1.6;">
          <div class="log-content"></div>
        </div>
      </div>
    `;
  }
});

// 监听实时日志
ipcRenderer.on('switch-log', (event, log) => {
  const statusEl = document.getElementById('switchStatus');
  let logContent = statusEl.querySelector('.log-content');
  
  if (!logContent) {
    // 如果没有日志容器，创建一个
    statusEl.innerHTML = `
      <div class="status-message status-info">
        <div class="log-container" style="max-height:600px; overflow-y:auto; background:#f5f5f5; padding:10px; border-radius:4px; font-family:monospace; font-size:12px; line-height:1.6;">
          <div class="log-content"></div>
        </div>
      </div>
    `;
    logContent = statusEl.querySelector('.log-content');
  }
  
  // 添加日志
  const logLine = document.createElement('div');
  logLine.textContent = log;
  logLine.style.marginBottom = '2px';
  
  // 根据日志内容设置颜色
  if (log.includes('✓') || log.includes('✅') || log.includes('成功')) {
    logLine.style.color = '#27ae60';
  } else if (log.includes('✗') || log.includes('❌') || log.includes('失败') || log.includes('错误')) {
    logLine.style.color = '#e74c3c';
  } else if (log.includes('⚠️') || log.includes('警告')) {
    logLine.style.color = '#f39c12';
  } else if (log.includes('步骤') || log.includes('【') || log.includes('=====')) {
    logLine.style.color = '#3498db';
    logLine.style.fontWeight = 'bold';
  } else if (log.includes('💡')) {
    logLine.style.color = '#f39c12';
  }
  
  logContent.appendChild(logLine);
  
  // 自动滚动到底部
  const logContainer = logContent.parentElement;
  if (logContainer) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
});

// 监听错误
ipcRenderer.on('switch-error', (event, error) => {
  console.error('收到切换错误:', error);
  const statusEl = document.getElementById('switchStatus');
  if (statusEl) {
    statusEl.innerHTML = `
      <div class="status-message status-error">
        <strong>切换失败：</strong>${error.message}<br><br>
        <details>
          <summary>查看详细错误信息</summary>
          <pre style="margin-top:10px; padding:10px; background:#f5f5f5; border-radius:4px; overflow-x:auto;">${error.stack || error.message}</pre>
        </details>
      </div>
    `;
  }
});

async function switchAccount() {
  const accountId = selectedSwitchAccountId;
  
  if (!accountId) {
    alert(t('pleaseSelectAccount'));
    return;
  }
  
  if (!confirm(t('confirmSwitch'))) return;
  
  const accounts = await ipcRenderer.invoke('get-accounts');
  const account = accounts.find(acc => acc.id === accountId);
  
  const result = await ipcRenderer.invoke('switch-account', account);
  
  const statusEl = document.getElementById('switchStatus');
  if (result.success) {
    // 标记为已使用
    markAccountUsed(accountId);
    statusEl.innerHTML = `
      <div class="status-message status-success">
        <strong>切换成功！</strong><br>
        ${result.message}<br><br>
        <strong>账号信息：</strong><br>
        邮箱: ${result.account.email}<br>
        密码: ${result.account.password}
      </div>
    `;
  } else {
    statusEl.innerHTML = `
      <div class="status-message status-error">
        <strong>切换失败：</strong>${result.error}
      </div>
    `;
  }
}

// 防止重复执行的标志
let isAutoSwitching = false;

async function fullAutoSwitch() {
  // 防止重复执行
  if (isAutoSwitching) {
    alert(t('switchInProgress'));
    return;
  }
  
  const accountId = selectedSwitchAccountId;
  
  if (!accountId) {
    alert(t('pleaseSelectAccount'));
    return;
  }
  
  if (!confirm(t('confirmSwitch'))) {
    return;
  }
  
  isAutoSwitching = true;
  
  const accounts = await ipcRenderer.invoke('get-accounts');
  const account = accounts.find(acc => acc.id === accountId);
  
  const statusEl = document.getElementById('switchStatus');
  statusEl.innerHTML = `
    <div class="status-message status-info">
      <strong>正在启动完整自动化流程...</strong>
    </div>
  `;
  
  const result = await ipcRenderer.invoke('full-auto-switch', account);
  
  // 执行完成，重置标志
  isAutoSwitching = false;
  
  // 获取现有的日志容器
  let logContent = statusEl.querySelector('.log-content');
  
  if (result.success) {
    // 标记为已使用
    markAccountUsed(accountId);
    // 如果有日志容器，追加成功信息到日志中
    if (logContent) {
      const successLine = document.createElement('div');
      successLine.innerHTML = `
        <br><div style="color:#27ae60; font-weight:bold; border-top:2px solid #27ae60; padding-top:10px; margin-top:10px;">
          ✅ 完整自动化切换成功！<br>
          ${result.message}<br><br>
          <strong>账号信息：</strong><br>
          📧 邮箱: ${result.account.email}<br>
          🔑 密码: ${result.account.password}<br><br>
          💡 提示：请在浏览器中确认登录是否成功
        </div>
      `;
      logContent.appendChild(successLine);
      
      // 自动滚动到底部
      const logContainer = logContent.parentElement;
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    } else {
      // 如果没有日志容器，直接显示成功信息
      statusEl.innerHTML = `
        <div class="status-message status-success">
          <strong>完整自动化切换成功！</strong><br>
          ${result.message}<br><br>
          <strong>账号信息：</strong><br>
          邮箱: ${result.account.email}<br>
          密码: ${result.account.password}<br><br>
          <strong>提示：</strong>请在浏览器中确认登录是否成功
        </div>
      `;
    }
  } else {
    // 如果有日志容器，追加失败信息到日志中
    if (logContent) {
      const errorLine = document.createElement('div');
      errorLine.innerHTML = `
        <br><div style="color:#e74c3c; font-weight:bold; border-top:2px solid #e74c3c; padding-top:10px; margin-top:10px;">
          ❌ 完整自动化切换失败：${result.error}<br><br>
          💡 提示：可能需要手动完成部分步骤
        </div>
      `;
      logContent.appendChild(errorLine);
      
      // 自动滚动到底部
      const logContainer = logContent.parentElement;
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    } else {
      // 如果没有日志容器，直接显示失败信息
      statusEl.innerHTML = `
        <div class="status-message status-error">
          <strong>完整自动化切换失败：</strong>${result.error}<br><br>
          <strong>提示：</strong>可能需要手动完成部分步骤
        </div>
      `;
    }
  }
}

async function clearWindsurf() {
  if (!confirm('确定要清除Windsurf配置吗？')) return;
  
  const result = await ipcRenderer.invoke('clear-windsurf');
  
  const statusEl = document.getElementById('switchStatus');
  if (result.success) {
    statusEl.innerHTML = `
      <div class="status-message status-success">
        ${result.message}
      </div>
    `;
  } else {
    statusEl.innerHTML = `
      <div class="status-message status-error">
        清除失败: ${result.error}
      </div>
    `;
  }
}

// ==================== 配置 ====================

function loadSettings() {
  // 加载域名列表
  const domainListEl = document.getElementById('domainList');
  domainListEl.innerHTML = currentConfig.emailDomains.map(domain => `
    <div class="domain-tag">
      ${domain}
      <button onclick="removeDomain('${domain}')">×</button>
    </div>
  `).join('');
  
  // 加载IMAP配置
  if (currentConfig.emailConfig) {
    document.getElementById('imapHost').value = currentConfig.emailConfig.host || '';
    document.getElementById('imapPort').value = currentConfig.emailConfig.port || 993;
    document.getElementById('imapUser').value = currentConfig.emailConfig.user || '';
    document.getElementById('imapPassword').value = currentConfig.emailConfig.password || '';
  }
  
  // 加载语言设置
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = getCurrentLanguage();
  }
}

// 切换语言
async function changeLanguage() {
  const languageSelect = document.getElementById('languageSelect');
  const newLang = languageSelect.value;
  
  // 保存到 localStorage
  setLanguage(newLang);
  
  // 通过 IPC 保存到文件
  try {
    await ipcRenderer.invoke('save-language', newLang);
  } catch (err) {
    console.error('保存语言设置失败:', err);
  }
  
  // 更新UI
  updateUILanguage();
}

// 重置语言选择
function resetLanguageSelection() {
  if (confirm(t('resetLanguageTip') + '\n\n' + (getCurrentLanguage() === 'zh-CN' ? '确定要重新选择语言吗？' : 'Are you sure you want to reset language selection?'))) {
    // 清除 localStorage
    localStorage.removeItem('app_language');
    
    // 重新加载到语言选择页面
    window.location.href = 'language-selector.html';
  }
}

function addDomain() {
  const domain = document.getElementById('newDomain').value.trim();
  
  if (!domain) {
    alert(t('pleaseEnterDomain'));
    return;
  }
  
  if (currentConfig.emailDomains.includes(domain)) {
    alert(t('domainExists'));
    return;
  }
  
  currentConfig.emailDomains.push(domain);
  document.getElementById('newDomain').value = '';
  loadSettings();
}

function removeDomain(domain) {
  currentConfig.emailDomains = currentConfig.emailDomains.filter(d => d !== domain);
  loadSettings();
}

async function testImap() {
  const config = {
    host: document.getElementById('imapHost').value,
    port: parseInt(document.getElementById('imapPort').value),
    user: document.getElementById('imapUser').value,
    password: document.getElementById('imapPassword').value
  };
  
  if (!config.host || !config.user || !config.password) {
    alert(t('pleaseCompleteIMAPConfig'));
    return;
  }
  
  document.getElementById('settingsStatus').innerHTML = `
    <div class="status-message status-info">
      正在测试IMAP连接...
    </div>
  `;
  
  const result = await ipcRenderer.invoke('test-imap', config);
  
  if (result.success) {
    document.getElementById('settingsStatus').innerHTML = `
      <div class="status-message status-success">
        ${result.message}
      </div>
    `;
  } else {
    document.getElementById('settingsStatus').innerHTML = `
      <div class="status-message status-error">
        ${result.message}
      </div>
    `;
  }
}

async function saveSettings() {
  currentConfig.emailConfig = {
    host: document.getElementById('imapHost').value,
    port: parseInt(document.getElementById('imapPort').value),
    user: document.getElementById('imapUser').value,
    password: document.getElementById('imapPassword').value
  };
  
  // 保存到本地存储
  localStorage.setItem('windsurfConfig', JSON.stringify(currentConfig));
  
  document.getElementById('settingsStatus').innerHTML = `
    <div class="status-message status-success">
      配置已保存！
    </div>
  `;
  
  setTimeout(() => {
    document.getElementById('settingsStatus').innerHTML = '';
  }, 3000);
}

// 初始化加载配置
window.addEventListener('DOMContentLoaded', () => {
  // 加载“已使用账号”持久化记录
  loadUsedAccountsFromStorage();
  const saved = localStorage.getItem('windsurfConfig');
  if (saved) {
    currentConfig = JSON.parse(saved);
  }
  loadAccounts();
  
  // 处理外部链接，在系统默认浏览器中打开
  const { shell } = require('electron');
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a[target="_blank"]');
    if (target && target.href) {
      e.preventDefault();
      shell.openExternal(target.href);
    }
  });
  
  // 监听免费账号 iframe 加载
  const freeAccountsFrame = document.getElementById('freeAccountsFrame');
  if (freeAccountsFrame) {
    freeAccountsFrame.addEventListener('load', () => {
      console.log('免费账号页面加载成功');
    });
    
    freeAccountsFrame.addEventListener('error', (e) => {
      console.error('免费账号页面加载失败:', e);
      const container = freeAccountsFrame.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-size: 16px; color: #1d1d1f; margin-bottom: 8px; font-weight: 500;">页面加载失败</div>
            <div style="font-size: 13px; color: #86868b; margin-bottom: 20px;">请检查网络连接或稍后重试</div>
            <button class="btn btn-primary" onclick="location.reload()">重新加载</button>
          </div>
        `;
      }
    });
  }
});
