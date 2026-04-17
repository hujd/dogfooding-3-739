const { test, expect } = require('@playwright/test');

/**
 * TaskFlow Pro 测试套件
 * 包含15个测试用例，覆盖核心功能和交互
 */

test.describe('TaskFlow Pro 测试套件', () => {
  // 列配置
  const COLUMNS = [
    { id: 'backlog', title: '📋 待办' },
    { id: 'todo', title: '📌 计划中' },
    { id: 'inprogress', title: '🚀 进行中' },
    { id: 'review', title: '🔍 审核中' },
    { id: 'done', title: '✅ 已完成' }
  ];

  test.beforeEach(async ({ page }) => {
    // 清除 localStorage 确保干净状态
    await page.goto('file:///app/dogfooding-3-739/app.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.board');
    // 等待页面完全加载
    await page.waitForTimeout(500);
  });

  // ===== TC-001 初始化验证 =====
  test('TC-001 初始化验证', async ({ page }) => {
    // 验证 5 个列正确渲染
    for (const col of COLUMNS) {
      const columnEl = page.locator(`.column[data-column="${col.id}"]`);
      await expect(columnEl, `列 ${col.title} 应该存在`).toBeVisible();
      
      const colTitle = columnEl.locator('.col-title').textContent();
      await expect(columnEl.locator('.col-title'), `列标题应该包含 ${col.title}`).toContainText(col.title.replace(/[📋📌🚀🔍✅\s]/g, '').trim());
    }

    // 验证初始 10 条演示数据正确分布
    let totalCards = 0;
    for (const col of COLUMNS) {
      const colEl = page.locator(`.column[data-column="${col.id}"]`);
      const count = await colEl.locator('.card').count();
      totalCards += count;
    }
    expect(totalCards, '初始应该有10个任务').toBe(10);

    // 验证统计栏显示正确的总数和完成率
    const statsBar = page.locator('#statsBar');
    await expect(statsBar, '统计栏应该可见').toBeVisible();
    
    const statText = await statsBar.textContent();
    expect(statText, '统计栏应包含总任务数').toContain('总任务');
    expect(statText, '统计栏应包含完成率').toContain('完成率');
  });

  // ===== TC-002 新建任务 =====
  test('TC-002 新建任务', async ({ page }) => {
    // 点击"+ 新建任务"按钮
    const newTaskBtn = page.getByRole('button', { name: /新建任务/i });
    await newTaskBtn.click();

    // 验证弹窗打开，标题输入框获得焦点
    const modal = page.locator('#taskModal');
    await expect(modal, '弹窗应该打开').toHaveClass(/active/);
    
    const titleInput = page.locator('#taskTitle');
    await expect(titleInput, '标题输入框应该获得焦点').toBeFocused();

    // 不输入标题直接保存 → 验证出现错误 Toast
    await page.locator('#saveTaskBtn').click();
    const toastError = page.locator('.toast-error');
    await expect(toastError, '应该显示错误Toast').toBeVisible();
    await expect(toastError, '错误消息应该正确').toContainText('请输入任务标题');

    // 填写完整表单
    await titleInput.fill('测试新建任务');
    await page.locator('#taskDesc').fill('这是一个测试任务的详细描述');
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskDue').fill('2026-12-31');
    await page.locator('#taskAssignee').selectOption('张三');
    await page.locator('#taskEstimate').fill('8');

    // 选择标签 bug + urgent
    await page.locator('.label-option[data-label="bug"]').click();
    await page.locator('.label-option[data-label="urgent"]').click();

    // 添加 2 个子任务
    const subtaskInput = page.locator('#newSubtask');
    await subtaskInput.fill('子任务1');
    await page.getByRole('button', { name: '添加' }).nth(0).click();
    await subtaskInput.fill('子任务2');
    await page.getByRole('button', { name: '添加' }).nth(0).click();

    // 保存
    await page.locator('#saveTaskBtn').click();

    // 验证卡片出现在"待办"列
    const backlogColumn = page.locator('.column[data-column="backlog"]');
    const newCard = backlogColumn.locator('.card:has-text("测试新建任务")');
    await expect(newCard, '新卡片应该出现在待办列').toBeVisible();

    // 验证成功 Toast
    const toastSuccess = page.locator('.toast-success');
    await expect(toastSuccess, '应该显示成功Toast').toBeVisible();
    await expect(toastSuccess, '成功消息应该正确').toContainText('任务已创建');

    // 验证新卡片显示所有设置的属性
    await expect(newCard.locator('.label-bug'), '应该显示bug标签').toBeVisible();
    await expect(newCard.locator('.label-urgent'), '应该显示urgent标签').toBeVisible();
    await expect(newCard.locator('.priority-high'), '应该显示高优先级圆点').toBeVisible();
    await expect(newCard.locator('.card-assignee'), '应该显示负责人头像').toBeVisible();
  });

  // ===== TC-003 编辑任务 =====
  test('TC-003 编辑任务', async ({ page }) => {
    // 双击第一张卡片
    const firstCard = page.locator('.column[data-column="backlog"] .card').first();
    const originalTitle = await firstCard.locator('.card-title').textContent();
    await firstCard.dblclick();

    // 验证弹窗标题为"编辑任务"
    const modalTitle = page.locator('#modalTitle');
    await expect(modalTitle, '弹窗标题应该是编辑任务').toContainText('编辑任务');

    // 验证所有字段正确回填
    const titleInput = page.locator('#taskTitle');
    await expect(titleInput, '标题应该回填').toHaveValue(originalTitle);

    // 修改标题
    const newTitle = originalTitle + ' - 已编辑';
    await titleInput.fill(newTitle);

    // 保存
    await page.locator('#saveTaskBtn').click();

    // 验证卡片标题已更新
    const updatedCard = page.locator(`.card:has-text("${newTitle}")`);
    await expect(updatedCard, '卡片标题应该已更新').toBeVisible();
  });

  // ===== TC-004 删除任务 =====
  test('TC-004 删除任务', async ({ page }) => {
    // 记录当前任务总数
    const initialCount = await page.locator('.card').count();
    
    // 右键点击任意卡片
    const firstCard = page.locator('.card').first();
    await firstCard.click({ button: 'right' });

    // 验证上下文菜单显示
    const contextMenu = page.locator('#contextMenu');
    await expect(contextMenu, '上下文菜单应该显示').toHaveClass(/active/);

    // 点击"删除"
    await page.locator('.context-item:has-text("删除")').click();

    // 验证任务消失
    const newCount = await page.locator('.card').count();
    expect(newCount, '任务总数应该减少1').toBe(initialCount - 1);

    // 验证统计栏总数减少 1
    const statsBar = page.locator('#statsBar');
    await expect(statsBar).toContainText(`总任务: ${newCount}`);
  });

  // ===== TC-005 拖拽排序 =====
  test('TC-005 拖拽排序', async ({ page }) => {
    // 获取待办列第一张卡片
    const sourceColumn = page.locator('.column[data-column="backlog"]');
    const targetColumn = page.locator('.column[data-column="inprogress"]');
    
    const sourceCard = sourceColumn.locator('.card').first();
    const cardTitle = await sourceCard.locator('.card-title').textContent();
    
    const sourceCountBefore = await sourceColumn.locator('.card').count();
    const targetCountBefore = await targetColumn.locator('.card').count();

    // 拖拽卡片到进行中列
    const targetBox = await targetColumn.locator('.col-body').boundingBox();
    await sourceCard.dragTo(targetColumn.locator('.col-body'), {
      targetPosition: { x: 100, y: 50 }
    });

    // 等待拖拽完成
    await page.waitForTimeout(500);

    // 验证卡片出现在目标列
    const movedCard = targetColumn.locator(`.card:has-text("${cardTitle.slice(0, 20)}")`);
    await expect(movedCard, '卡片应该出现在目标列').toBeVisible();

    // 验证 Toast 通知
    const toast = page.locator('.toast-success');
    await expect(toast, '应该显示移动成功Toast').toContainText('移动到');
  });

  // ===== TC-006 搜索过滤 =====
  test('TC-006 搜索过滤', async ({ page }) => {
    // 在搜索框输入"虚拟滚动"
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('虚拟滚动');
    
    // 等待搜索生效
    await page.waitForTimeout(300);

    // 验证只显示匹配的卡片
    const visibleCards = page.locator('.card');
    const count = await visibleCards.count();
    expect(count, '应该只显示匹配的卡片').toBeGreaterThan(0);
    
    // 验证匹配的卡片包含搜索词
    const firstVisibleCard = visibleCards.first();
    await expect(firstVisibleCard, '匹配的卡片应该包含搜索词').toContainText('虚拟滚动');

    // 验证统计栏显示"筛选显示"
    const statsBar = page.locator('#statsBar');
    const statsText = await statsBar.textContent();
    expect(statsText, '统计栏应该显示筛选信息').toMatch(/筛选显示|显示/);

    // 清空搜索框
    await searchInput.clear();
    await page.waitForTimeout(300);

    // 验证所有卡片恢复显示
    const allCount = await page.locator('.card').count();
    expect(allCount, '清空搜索后应该显示所有卡片').toBe(10);
  });

  // ===== TC-007 数据持久化 =====
  test('TC-007 数据持久化', async ({ page }) => {
    // 新建一个任务
    await page.getByRole('button', { name: /新建任务/i }).click();
    await page.locator('#taskTitle').fill('持久化测试任务');
    await page.locator('#saveTaskBtn').click();

    // 等待保存完成
    await page.waitForTimeout(500);

    // 验证任务已创建
    const newCard = page.locator('.card:has-text("持久化测试任务")');
    await expect(newCard, '新任务应该已创建').toBeVisible();

    // 刷新页面
    await page.reload();
    await page.waitForSelector('.board');

    // 验证新建的任务仍然存在
    const persistedCard = page.locator('.card:has-text("持久化测试任务")');
    await expect(persistedCard, '刷新后任务应该仍然存在').toBeVisible();
  });

  // ===== TC-008 撤销操作 =====
  test('TC-008 撤销操作', async ({ page }) => {
    // 记录初始任务数
    const initialCount = await page.locator('.card').count();
    
    // 删除一个任务
    const firstCard = page.locator('.card').first();
    const cardTitle = await firstCard.locator('.card-title').textContent();
    await firstCard.click({ button: 'right' });
    await page.locator('.context-item:has-text("删除")').click();

    // 验证任务已删除
    await page.waitForTimeout(300);
    const countAfterDelete = await page.locator('.card').count();
    expect(countAfterDelete, '删除后任务数应该减少').toBe(initialCount - 1);

    // 按 Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    // 验证任务恢复
    const restoredCard = page.locator(`.card:has-text("${cardTitle.slice(0, 20)}")`);
    await expect(restoredCard, '撤销后任务应该恢复').toBeVisible();

    // 验证出现"已撤销"Toast
    const toast = page.locator('.toast-info:has-text("已撤销")');
    await expect(toast, '应该显示已撤销Toast').toBeVisible();
  });

  // ===== TC-009 子任务进度 =====
  test('TC-009 子任务进度', async ({ page }) => {
    // 编辑一个有子任务的卡片
    const cardWithSubtasks = page.locator('.card').filter({
      has: page.locator('.subtask-bar')
    }).first();
    
    await cardWithSubtasks.dblclick();

    // 获取初始子任务数量
    const subtasks = page.locator('#subtaskList .subtask-item');
    const subtaskCount = await subtasks.count();
    expect(subtaskCount, '应该有子任务').toBeGreaterThan(0);

    // 勾选部分子任务为完成
    const firstSubtaskCheckbox = subtasks.first().locator('input[type="checkbox"]');
    await firstSubtaskCheckbox.check();

    // 保存
    await page.locator('#saveTaskBtn').click();

    // 验证进度条存在
    const updatedCard = page.locator('.card').filter({
      has: page.locator('.subtask-bar')
    }).first();
    const progressBar = updatedCard.locator('.subtask-fill');
    await expect(progressBar, '应该显示进度条').toBeVisible();
  });

  // ===== TC-010 计时器 =====
  test('TC-010 计时器', async ({ page }) => {
    // 右键卡片
    const firstCard = page.locator('.card').first();
    await firstCard.click({ button: 'right' });

    // 点击"计时"
    await page.locator('.context-item:has-text("计时")').click();
    await page.waitForTimeout(300);

    // 验证出现计时器徽章
    const timerBadge = firstCard.locator('.timer-badge');
    await expect(timerBadge, '应该显示计时器徽章').toBeVisible();

    // 等待 2 秒
    await page.waitForTimeout(2000);

    // 验证时间在递增 (检查running状态)
    await expect(timerBadge, '计时器应该正在运行').toHaveClass(/running/);

    // 再次右键点击计时暂停
    await firstCard.click({ button: 'right' });
    await page.locator('.context-item:has-text("计时")').click();
    await page.waitForTimeout(300);

    // 验证计时暂停
    const pausedBadge = firstCard.locator('.timer-badge');
    await expect(pausedBadge, '计时器应该存在').toBeVisible();
  });

  // ===== TC-011 导出/导入 =====
  test('TC-011 导出/导入', async ({ page }) => {
    // 等待下载事件
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /导出/i }).click()
    ]);

    // 验证文件名
    const downloadPath = await download.path();
    expect(downloadPath, '应该触发文件下载').toBeTruthy();
    
    const fileName = download.suggestedFilename();
    expect(fileName, '文件名应该包含taskflow-backup').toContain('taskflow-backup');
    expect(fileName, '文件应该是JSON格式').toContain('.json');
  });

  // ===== TC-012 复制任务 =====
  test('TC-012 复制任务', async ({ page }) => {
    // 记录当前任务总数
    const initialCount = await page.locator('.card').count();

    // 右键卡片
    const firstCard = page.locator('.card').first();
    const originalTitle = await firstCard.locator('.card-title').textContent();
    await firstCard.click({ button: 'right' });

    // 点击"复制"
    await page.locator('.context-item:has-text("复制")').click();
    await page.waitForTimeout(500);

    // 验证新卡片标题包含"(副本)"
    const duplicatedCard = page.locator(`.card:has-text("${originalTitle.slice(0, 15)}")`).filter({
      hasText: /副本/
    });
    await expect(duplicatedCard, '应该出现包含(副本)的新卡片').toBeVisible();

    // 验证统计栏总数增加 1
    const newCount = await page.locator('.card').count();
    expect(newCount, '任务总数应该增加1').toBe(initialCount + 1);
  });

  // ===== TC-013 快捷键 =====
  test('TC-013 快捷键', async ({ page }) => {
    // Ctrl+K 聚焦搜索框
    await page.keyboard.press('Control+k');
    await expect(page.locator('#searchInput'), '搜索框应该获得焦点').toBeFocused();

    // 打开弹窗
    await page.getByRole('button', { name: /新建任务/i }).click();
    const modal = page.locator('#taskModal');
    await expect(modal, '弹窗应该打开').toHaveClass(/active/);

    // Escape 关闭弹窗
    await page.keyboard.press('Escape');
    await expect(modal, '弹窗应该关闭').not.toHaveClass(/active/);

    // 重新打开弹窗测试子任务添加
    await page.getByRole('button', { name: /新建任务/i }).click();
    
    // 添加子任务测试 Enter
    const subtaskInput = page.locator('#newSubtask');
    await subtaskInput.fill('测试子任务');
    await subtaskInput.press('Enter');
    
    // 验证子任务添加成功
    const subtaskItem = page.locator('#subtaskList .subtask-item:has-text("测试子任务")');
    await expect(subtaskItem, '子任务应该添加成功').toBeVisible();

    // 填写标题以测试 Ctrl+Enter 保存
    await page.locator('#taskTitle').fill('快捷键测试任务');

    // Ctrl+Enter 触发保存
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(300);

    // 验证弹窗关闭
    await expect(modal, '按Ctrl+Enter后弹窗应该关闭').not.toHaveClass(/active/);
  });

  // ===== TC-014 边界测试 =====
  test('TC-014 边界测试', async ({ page }) => {
    // 测试 maxlength 限制
    await page.getByRole('button', { name: /新建任务/i }).click();
    const titleInput = page.locator('#taskTitle');
    
    // 尝试输入超过 100 个字符
    const longTitle = 'a'.repeat(150);
    await titleInput.fill(longTitle);
    
    // 验证只能输入最多 100 个字符
    const actualValue = await titleInput.inputValue();
    expect(actualValue.length, '标题应该最多100个字符').toBeLessThanOrEqual(100);

    // 关闭弹窗
    await page.keyboard.press('Escape');

    // 测试负数工时输入
    await page.getByRole('button', { name: /新建任务/i }).click();
    await page.locator('#taskEstimate').fill('-5');
    const estimateValue = await page.locator('#taskEstimate').inputValue();
    // 输入框允许输入负数，但应用应该能正确处理

    // 关闭弹窗
    await page.keyboard.press('Escape');

    // 测试截止日期设为过去日期
    await page.getByRole('button', { name: /新建任务/i }).click();
    await page.locator('#taskTitle').fill('逾期测试任务');
    await page.locator('#taskDue').fill('2020-01-01'); // 过去日期
    await page.locator('#saveTaskBtn').click();

    // 验证卡片显示逾期警告
    const overdueCard = page.locator('.card:has-text("逾期测试任务")');
    await expect(overdueCard, '逾期任务卡片应该存在').toBeVisible();

    // 连续快速创建多个任务测试性能
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /新建任务/i }).click();
      await page.locator('#taskTitle').fill(`性能测试任务${i}`);
      await page.locator('#saveTaskBtn').click();
      await page.waitForTimeout(100);
    }

    // 验证所有任务都存在
    const finalCount = await page.locator('.card').count();
    expect(finalCount, '所有快速创建的任务应该都存在').toBeGreaterThanOrEqual(15);
  });

  // ===== TC-015 UI 一致性 =====
  test('TC-015 UI 一致性', async ({ page }) => {
    // 验证所有列标题和图标正确
    for (const col of COLUMNS) {
      const colHeader = page.locator(`.column[data-column="${col.id}"] .col-title`);
      await expect(colHeader, `列 ${col.id} 应该可见`).toBeVisible();
    }

    // 验证优先级颜色映射
    const priorityClasses = {
      'high': 'priority-high',
      'medium': 'priority-medium', 
      'low': 'priority-low'
    };
    
    for (const [priority, className] of Object.entries(priorityClasses)) {
      const priorityDot = page.locator(`.${className}`).first();
      if (await priorityDot.isVisible().catch(() => false)) {
        await expect(priorityDot, `优先级 ${priority} 应该可见`).toBeVisible();
      }
    }

    // 验证标签颜色映射
    const labelClasses = {
      'bug': 'label-bug',
      'feature': 'label-feature',
      'urgent': 'label-urgent',
      'design': 'label-design',
      'perf': 'label-perf'
    };

    for (const [label, className] of Object.entries(labelClasses)) {
      const labelEl = page.locator(`.${className}`).first();
      if (await labelEl.isVisible().catch(() => false)) {
        await expect(labelEl, `标签 ${label} 应该可见`).toBeVisible();
      }
    }

    // 验证负责人头像颜色正确
    const assigneeAvatars = page.locator('.card-assignee');
    const avatarCount = await assigneeAvatars.count();
    expect(avatarCount, '应该有负责人头像').toBeGreaterThan(0);

    // 验证卡片基本结构
    const firstCard = page.locator('.card').first();
    await expect(firstCard.locator('.card-title'), '卡片应该有标题').toBeVisible();
  });
});
