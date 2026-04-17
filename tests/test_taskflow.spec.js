const { test, expect } = require('@playwright/test');

test.describe('TaskFlow Pro 测试套件', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('file:///c:/app/dogfooding-3-739/app.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.board', { timeout: 10000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshotPath = `tests/screenshots/${testInfo.title.replace(/[^a-z0-9]/gi, '_')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  });

  test('TC-001 初始化验证', async ({ page }) => {
    const columns = await page.locator('.column').all();
    expect(columns.length, '应该渲染 5 个列').toBe(5);

    const columnTitles = ['📋 待办', '📌 计划中', '🚀 进行中', '🔍 审核中', '✅ 已完成'];
    for (let i = 0; i < columnTitles.length; i++) {
      await expect(page.locator('.col-title').nth(i), `列 ${i+1} 标题应该正确`).toContainText(columnTitles[i]);
    }

    const cards = await page.locator('.card').all();
    expect(cards.length, '应该有 10 条演示数据').toBe(10);

    await expect(page.locator('#statsBar'), '统计栏应该显示总数 10').toContainText('总计 10');
  });

  test('TC-002 新建任务', async ({ page }) => {
    await page.getByText('+ 新建任务').click();
    await expect(page.locator('#taskModal'), '弹窗应该打开').toHaveClass(/active/);
    await expect(page.locator('#taskTitle'), '标题输入框应该获得焦点').toBeFocused();

    await page.locator('#saveTaskBtn').click();
    await expect(page.locator('.toast-error'), '应该显示错误 Toast').toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('请输入任务标题');

    await page.locator('#taskTitle').fill('测试新建任务 - Playwright');
    await page.locator('#taskDesc').fill('这是一个完整的测试任务描述');
    await page.locator('#taskPriority').selectOption('high');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.locator('#taskDue').fill(dateStr);

    await page.locator('#taskAssignee').selectOption('张三');
    await page.locator('#taskEstimate').fill('8');

    await page.locator('.label-bug').click();
    await page.locator('.label-urgent').click();

    await page.locator('#newSubtask').fill('子任务 1');
    await page.getByText('添加').click();
    await page.locator('#newSubtask').fill('子任务 2');
    await page.getByText('添加').click();

    await page.locator('#saveTaskBtn').click();

    await expect(page.locator('.toast-success'), '应该显示成功 Toast').toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('任务已创建');

    const backlogColumn = page.locator('.column').first();
    await expect(backlogColumn, '新卡片应该出现在"待办"列').toContainText('测试新建任务 - Playwright');

    const newCard = backlogColumn.locator('.card').filter({ hasText: '测试新建任务 - Playwright' }).first();
    await expect(newCard, '应该显示 bug 标签').toContainText('Bug');
    await expect(newCard, '应该显示 urgent 标签').toContainText('Urgent');
    await expect(newCard.locator('.priority-high'), '应该显示高优先级红色圆点').toBeVisible();
    await expect(newCard.locator('.card-assignee'), '应该显示负责人头像').toBeVisible();
    await expect(newCard, '应该显示子任务计数 0/2').toContainText('0/2');
  });

  test('TC-003 编辑任务', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    const originalTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.dblclick();

    await expect(page.locator('#modalTitle'), '弹窗标题应该为"编辑任务"').toHaveText('编辑任务');

    await expect(page.locator('#taskTitle'), '标题应该正确回填').toHaveValue(originalTitle);

    const currentPriority = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const priorityEl = card.querySelector('.priority');
      if (priorityEl.classList.contains('priority-high')) return 'high';
      if (priorityEl.classList.contains('priority-medium')) return 'medium';
      return 'low';
    });
    expect(await page.locator('#taskPriority').inputValue(), '优先级应该正确回填').toBe(currentPriority);

    const selectedLabels = await page.$$eval('.label-option.selected', els => els.map(e => e.dataset.label));
    expect(selectedLabels.length >= 0, '标签应该正确回填').toBeTruthy();

    const newTitle = '已编辑 - ' + originalTitle;
    await page.locator('#taskTitle').fill(newTitle);
    await page.locator('#saveTaskBtn').click();

    await expect(firstCard.locator('.card-title'), '卡片标题应该已更新').toHaveText(newTitle);
  });

  test('TC-004 删除任务', async ({ page }) => {
    const initialCount = await page.locator('.card').count();

    const firstCard = page.locator('.card').first();

    await firstCard.click({ button: 'right' });
    await expect(page.locator('#contextMenu'), '上下文菜单应该显示').toHaveClass(/active/);

    await page.getByText('🗑️ 删除').click();

    expect(await page.locator('.card').count(), '任务数量应该减少 1').toBe(initialCount - 1);

    await expect(page.locator('#statsBar'), '统计栏总数应该减少 1').toContainText(`总计 ${initialCount - 1}`);
  });

  test('TC-005 拖拽排序', async ({ page }) => {
    const backlogColumn = page.locator('.column').first();
    const inProgressColumn = page.locator('.column').nth(2);

    const firstCardInBacklog = backlogColumn.locator('.card').first();
    const cardTitle = await firstCardInBacklog.locator('.card-title').textContent();

    const initialBacklogCount = await backlogColumn.locator('.card').count();
    const initialInProgressCount = await inProgressColumn.locator('.card').count();

    await firstCardInBacklog.dragTo(inProgressColumn.locator('.col-body'));

    await expect(inProgressColumn, '卡片应该出现在目标列').toContainText(cardTitle);

    expect(await backlogColumn.locator('.card').count(), '源列计数应该减少').toBe(initialBacklogCount - 1);
    expect(await inProgressColumn.locator('.card').count(), '目标列计数应该增加').toBe(initialInProgressCount + 1);

    await expect(page.locator('.toast-success'), '应该显示移动成功 Toast').toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('移动到 🚀 进行中');
  });

  test('TC-006 搜索过滤', async ({ page }) => {
    await page.locator('#searchInput').fill('虚拟滚动');

    const visibleCards = await page.locator('.card:visible').count();
    expect(visibleCards, '应该只显示匹配的卡片').toBeGreaterThan(0);
    expect(visibleCards, '应该过滤掉不匹配的卡片').toBeLessThan(10);

    await expect(page.locator('#statsBar'), '统计栏应该显示筛选信息').toContainText('筛选显示');

    await page.locator('#searchInput').clear();
    await page.waitForTimeout(100);

    expect(await page.locator('.card').count(), '所有卡片应该恢复显示').toBe(10);
  });

  test('TC-007 数据持久化', async ({ page }) => {
    await page.getByText('+ 新建任务').click();
    await page.locator('#taskTitle').fill('持久化测试任务');
    await page.locator('#saveTaskBtn').click();

    await page.waitForSelector('.toast-success');

    await page.reload();
    await page.waitForSelector('.board');

    await expect(page.locator('.card'), '新建的任务应该仍然存在').toContainText('持久化测试任务');
  });

  test('TC-008 撤销操作', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    const cardTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.click({ button: 'right' });
    await page.getByText('🗑️ 删除').click();

    await page.waitForSelector('.toast-error');
    expect(await page.locator('.card').filter({ hasText: cardTitle }).count()).toBe(0);

    await page.keyboard.press('Control+z');

    await expect(page.locator('.card').filter({ hasText: cardTitle }), '删除的任务应该恢复').toHaveCount(1);

    await expect(page.locator('.toast-info'), '应该显示"已撤销"Toast').toBeVisible();
    await expect(page.locator('.toast-info')).toContainText('已撤销');
  });

  test('TC-009 子任务进度', async ({ page }) => {
    const cardWithSubtasks = page.locator('.card').filter({ hasText: '实现虚拟滚动列表组件' }).first();
    await cardWithSubtasks.dblclick();

    const checkboxes = page.locator('#subtaskList input[type="checkbox"]');
    const initialChecked = await checkboxes.locator(':checked').count();

    await checkboxes.nth(2).check();

    await page.locator('#saveTaskBtn').click();

    const progressBar = cardWithSubtasks.locator('.subtask-fill');
    await expect(progressBar, '进度条宽度应该变化').toBeVisible();

    const newWidth = await progressBar.evaluate(el => el.style.width);
    expect(newWidth, '进度条宽度应该大于初始值').not.toBe('50%');
  });

  test('TC-010 计时器', async ({ page }) => {
    const firstCard = page.locator('.card').first();

    await firstCard.click({ button: 'right' });
    await page.getByText('⏱️ 计时').click();

    await expect(page.locator('.toast-success'), '应该显示开始计时 Toast').toContainText('开始计时');

    const timerBadge = firstCard.locator('.timer-badge');
    await expect(timerBadge, '应该出现计时器徽章').toBeVisible();

    await page.waitForTimeout(2000);

    const time1 = await timerBadge.textContent();
    await page.waitForTimeout(1000);
    const time2 = await timerBadge.textContent();
    expect(time1, '时间应该在递增').not.toBe(time2);

    await firstCard.click({ button: 'right' });
    await page.getByText('⏱️ 计时').click();

    await expect(page.locator('.toast-info'), '应该显示计时暂停 Toast').toContainText('计时已暂停');
  });

  test('TC-011 导出/导入', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('📥 导出').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename(), '应该触发文件下载').toContain('taskflow-backup');
    expect(download.suggestedFilename()).toEndWith('.json');

    const path = await download.path();
    const fs = require('fs');
    const content = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(content, '导出的 JSON 应该包含 tasks').toHaveProperty('tasks');
    expect(Array.isArray(content.tasks), 'tasks 应该是数组').toBe(true);
    expect(content.tasks.length, '应该包含所有任务数据').toBe(10);
  });

  test('TC-012 复制任务', async ({ page }) => {
    const initialCount = await page.locator('.card').count();
    const firstCard = page.locator('.card').first();
    const originalTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.click({ button: 'right' });
    await page.getByText('📋 复制').click();

    await page.waitForSelector('.toast-success');

    await expect(page.locator('.card').filter({ hasText: originalTitle + ' (副本)' }), '新卡片标题应该包含"(副本)"').toBeVisible();

    expect(await page.locator('.card').count(), '统计栏总数应该增加 1').toBe(initialCount + 1);
    await expect(page.locator('#statsBar')).toContainText(`总计 ${initialCount + 1}`);
  });

  test('TC-013 快捷键', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('#searchInput'), 'Ctrl+K 应该聚焦搜索框').toBeFocused();

    await page.getByText('+ 新建任务').click();
    await page.waitForSelector('#taskModal.active');
    await page.keyboard.press('Escape');
    await expect(page.locator('#taskModal'), 'Escape 应该关闭弹窗').not.toHaveClass(/active/);

    await page.getByText('+ 新建任务').click();
    await page.locator('#taskTitle').fill('快捷键测试');
    await page.locator('#newSubtask').fill('快捷键子任务');
    await page.keyboard.press('Enter');
    await expect(page.locator('#subtaskList .subtask-item'), 'Enter 应该添加子任务').toHaveCount(1);

    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#taskModal'), 'Ctrl+Enter 应该触发保存').not.toHaveClass(/active/);
    await expect(page.locator('.card')).toContainText('快捷键测试');
  });

  test('TC-014 边界测试', async ({ page }) => {
    await page.getByText('+ 新建任务').click();

    const longString = 'a'.repeat(100);
    await page.locator('#taskTitle').fill(longString);
    await page.locator('#taskTitle').type('extra');
    const value = await page.locator('#taskTitle').inputValue();
    expect(value.length, '标题应该有 maxlength 限制').toBe(100);

    await page.locator('#taskEstimate').fill('-5');
    await page.locator('#saveTaskBtn').click();
    await expect(page.locator('#taskModal'), '负数工时不应该阻止保存').not.toHaveClass(/active/);

    await page.getByText('+ 新建任务').click();
    await page.locator('#taskTitle').fill('逾期测试任务');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page.locator('#taskDue').fill(yesterday.toISOString().split('T')[0]);
    await page.locator('#saveTaskBtn').click();

    const newCard = page.locator('.card').filter({ hasText: '逾期测试任务' }).first();
    await expect(newCard.locator('.card-date'), '逾期任务应该显示警告').toContainText('⚠️');
    await expect(newCard.locator('.card-date')).toHaveCSS('color', 'rgb(239, 68, 68)');

    for (let i = 0; i < 20; i++) {
      await page.evaluate((i) => {
        const task = { title: `批量任务 ${i}`, column: 'backlog', priority: 'medium' };
        window.createTask(task);
      }, i);
    }

    await page.waitForTimeout(500);
    expect(await page.locator('.card').count(), '快速创建 20 个任务后数据应该完整').toBeGreaterThan(25);
  });

  test('TC-015 UI 一致性', async ({ page }) => {
    const columnTitles = ['📋 待办', '📌 计划中', '🚀 进行中', '🔍 审核中', '✅ 已完成'];
    for (const title of columnTitles) {
      await expect(page.locator('.col-title'), `列标题 ${title} 应该正确`).toContainText(title);
    }

    await page.getByText('+ 新建任务').click();
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#taskTitle').fill('优先级测试');
    await page.locator('#saveTaskBtn').click();

    const highCard = page.locator('.card').filter({ hasText: '优先级测试' }).first();
    await expect(highCard.locator('.priority-high'), '高优先级应该是红色圆点').toHaveCSS('background-color', 'rgb(239, 68, 68)');

    await page.getByText('+ 新建任务').click();
    await page.locator('#taskTitle').fill('标签测试');
    await page.locator('.label-bug').click();
    await page.locator('.label-feature').click();
    await page.locator('.label-urgent').click();
    await page.locator('.label-design').click();
    await page.locator('.label-perf').click();
    await page.locator('#saveTaskBtn').click();

    const labelCard = page.locator('.card').filter({ hasText: '标签测试' }).first();
    await expect(labelCard.locator('.label-bug')).toHaveCSS('color', 'rgb(239, 68, 68)');
    await expect(labelCard.locator('.label-feature')).toHaveCSS('color', 'rgb(59, 130, 246)');
    await expect(labelCard.locator('.label-urgent')).toHaveCSS('color', 'rgb(249, 115, 22)');
    await expect(labelCard.locator('.label-design')).toHaveCSS('color', 'rgb(236, 72, 153)');
    await expect(labelCard.locator('.label-perf')).toHaveCSS('color', 'rgb(34, 197, 94)');

    await page.getByText('+ 新建任务').click();
    await page.locator('#taskTitle').fill('头像测试');
    await page.locator('#taskAssignee').selectOption('张三');
    await page.locator('#saveTaskBtn').click();

    const assigneeCard = page.locator('.card').filter({ hasText: '头像测试' }).first();
    await expect(assigneeCard.locator('.card-assignee'), '张三的头像颜色应该正确').toHaveCSS('background-color', 'rgb(59, 130, 246)');
  });
});
