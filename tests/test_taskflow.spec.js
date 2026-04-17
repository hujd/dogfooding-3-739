const { test, expect } = require('@playwright/test');

const APP_PATH = 'file:///c:/app/dogfooding-3-739/app.html';

test.describe('TaskFlow Pro 测试套件', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_PATH);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.board', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('TC-001 初始化验证', async ({ page }) => {
    const columns = page.locator('.column');
    await expect(columns, '应该有5个列').toHaveCount(5);

    const columnTitles = ['待办', '计划中', '进行中', '审核中', '已完成'];
    for (let i = 0; i < 5; i++) {
      const col = columns.nth(i);
      const title = col.locator('.col-title');
      await expect(title, `第${i + 1}列标题应包含${columnTitles[i]}`).toContainText(columnTitles[i]);
    }

    const cards = page.locator('.card');
    await expect(cards, '应该有10条演示数据').toHaveCount(10);

    const statsBar = page.locator('#statsBar');
    await expect(statsBar, '统计栏应显示总数').toContainText('总计 10');
    await expect(statsBar, '统计栏应显示完成').toContainText('完成');
  });

  test('TC-002 新建任务', async ({ page }) => {
    await page.click('button:has-text("+ 新建任务")');

    const modal = page.locator('#taskModal');
    await expect(modal, '弹窗应该打开').toHaveClass(/active/);

    const titleInput = page.locator('#taskTitle');
    await expect(titleInput, '标题输入框应获得焦点').toBeFocused();

    await page.click('#saveTaskBtn');

    const toast = page.locator('.toast-error');
    await expect(toast, '应该显示错误Toast').toContainText('请输入任务标题');

    await page.fill('#taskTitle', '测试任务标题');
    await page.fill('#taskDesc', '这是一个测试任务描述');
    await page.selectOption('#taskPriority', 'high');

    const today = new Date();
    const futureDate = new Date(today.setDate(today.getDate() + 7));
    const dateStr = futureDate.toISOString().split('T')[0];
    await page.fill('#taskDue', dateStr);

    await page.selectOption('#taskAssignee', '张三');
    await page.fill('#taskEstimate', '8');

    await page.click('.label-option[data-label="bug"]');
    await page.click('.label-option[data-label="urgent"]');

    await page.fill('#newSubtask', '子任务1');
    await page.click('button:has-text("添加"):visible');
    await page.fill('#newSubtask', '子任务2');
    await page.click('button:has-text("添加"):visible');

    await page.click('#saveTaskBtn');

    const successToast = page.locator('.toast-success');
    await expect(successToast, '应该显示成功Toast').toContainText('创建');

    const backlogColumn = page.locator('.column[data-column="backlog"]');
    const newCard = backlogColumn.locator('.card:has-text("测试任务标题")');
    await expect(newCard, '新卡片应出现在待办列').toBeVisible();

    await expect(newCard.locator('.label-bug'), '应显示bug标签').toBeVisible();
    await expect(newCard.locator('.label-urgent'), '应显示urgent标签').toBeVisible();
    await expect(newCard.locator('.priority-high'), '应显示高优先级').toBeVisible();

    const assigneeAvatar = newCard.locator('.card-assignee');
    await expect(assigneeAvatar, '应显示负责人头像').toBeVisible();
  });

  test('TC-003 编辑任务', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.dblclick();

    const modal = page.locator('#taskModal');
    await expect(modal, '弹窗应该打开').toHaveClass(/active/);

    const modalTitle = page.locator('#modalTitle');
    await expect(modalTitle, '弹窗标题应为编辑任务').toContainText('编辑任务');

    const titleInput = page.locator('#taskTitle');
    await expect(titleInput, '标题应该有值').not.toBeEmpty();

    const currentTitle = await titleInput.inputValue();
    const newTitle = currentTitle + ' - 已编辑';
    await titleInput.fill(newTitle);

    await page.click('#saveTaskBtn');

    const successToast = page.locator('.toast-success');
    await expect(successToast, '应该显示更新成功Toast').toBeVisible();

    const updatedCard = page.locator(`.card:has-text("${newTitle}")`);
    await expect(updatedCard, '卡片标题应该已更新').toBeVisible();
  });

  test('TC-004 删除任务', async ({ page }) => {
    const initialCount = await page.locator('.card').count();

    const firstCard = page.locator('.card').first();
    await firstCard.click({ button: 'right' });

    const contextMenu = page.locator('#contextMenu');
    await expect(contextMenu, '上下文菜单应该显示').toHaveClass(/active/);

    await page.click('.context-item:has-text("删除")');

    const deleteToast = page.locator('.toast-error, .toast:has-text("删除")');
    await expect(deleteToast, '应该显示删除Toast').toBeVisible();

    await page.waitForTimeout(300);

    const newCount = await page.locator('.card').count();
    expect(newCount, '任务数量应该减少1').toBe(initialCount - 1);

    const statsBar = page.locator('#statsBar');
    await expect(statsBar, '统计栏应该更新').toContainText(`总计 ${newCount}`);
  });

  test('TC-005 拖拽排序', async ({ page }) => {
    const backlogColumn = page.locator('.column[data-column="backlog"]');
    const inProgressColumn = page.locator('.column[data-column="inprogress"]');

    const backlogCount = await backlogColumn.locator('.card').count();
    const inProgressCount = await inProgressColumn.locator('.card').count();

    const firstCard = backlogColumn.locator('.card').first();
    const cardTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.dragTo(inProgressColumn.locator('.col-body'));

    await page.waitForTimeout(500);

    const movedCard = inProgressColumn.locator(`.card:has-text("${cardTitle.trim()}")`);
    await expect(movedCard, '卡片应该出现在进行中列').toBeVisible();

    const newBacklogCount = await backlogColumn.locator('.card').count();
    const newInProgressCount = await inProgressColumn.locator('.card').count();

    expect(newBacklogCount, '待办列计数应减少').toBe(backlogCount - 1);
    expect(newInProgressCount, '进行中列计数应增加').toBe(inProgressCount + 1);

    const toast = page.locator('.toast:has-text("进行中")');
    await expect(toast, '应该显示移动Toast').toBeVisible();
  });

  test('TC-006 搜索过滤', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('虚拟滚动');

    await page.waitForTimeout(300);

    const visibleCards = page.locator('.card:visible');
    const count = await visibleCards.count();

    for (let i = 0; i < count; i++) {
      const cardText = await visibleCards.nth(i).textContent();
      expect(
        cardText.toLowerCase().includes('虚拟滚动') ||
        cardText.includes('虚拟滚动'),
        '可见卡片应该匹配搜索词'
      ).toBeTruthy();
    }

    const statsBar = page.locator('#statsBar');
    const statsText = await statsBar.textContent();
    expect(statsText, '统计栏应显示筛选信息').toMatch(/筛选显示|显示/);

    await searchInput.fill('');
    await page.waitForTimeout(300);

    const allCards = page.locator('.card');
    await expect(allCards, '清空搜索后所有卡片应恢复显示').toHaveCount(10);
  });

  test('TC-007 数据持久化', async ({ page }) => {
    await page.click('button:has-text("+ 新建任务")');
    await page.fill('#taskTitle', '持久化测试任务');
    await page.fill('#taskDesc', '测试数据持久化');
    await page.click('#saveTaskBtn');

    await expect(page.locator('.card:has-text("持久化测试任务")')).toBeVisible();

    await page.reload();
    await page.waitForSelector('.board', { timeout: 10000 });
    await page.waitForTimeout(500);

    const persistedCard = page.locator('.card:has-text("持久化测试任务")');
    await expect(persistedCard, '刷新后任务应该仍然存在').toBeVisible();
  });

  test('TC-008 撤销操作', async ({ page }) => {
    const initialCount = await page.locator('.card').count();

    const firstCard = page.locator('.card').first();
    const cardTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.click({ button: 'right' });
    await page.click('.context-item:has-text("删除")');

    await page.waitForTimeout(300);
    let newCount = await page.locator('.card').count();
    expect(newCount, '删除后数量应减少').toBe(initialCount - 1);

    await page.keyboard.press('Control+z');

    const undoToast = page.locator('.toast:has-text("撤销")');
    await expect(undoToast, '应该显示撤销Toast').toBeVisible();

    await page.waitForTimeout(300);
    newCount = await page.locator('.card').count();
    expect(newCount, '撤销后数量应恢复').toBe(initialCount);

    const restoredCard = page.locator(`.card:has-text("${cardTitle.trim()}")`);
    await expect(restoredCard, '删除的任务应该恢复').toBeVisible();
  });

  test('TC-009 子任务进度', async ({ page }) => {
    const cardWithSubtasks = page.locator('.card:has(.subtask-bar)').first();
    if (await cardWithSubtasks.count() === 0) {
      test.skip(true, '没有带子任务的卡片');
      return;
    }

    await cardWithSubtasks.dblclick();
    await page.waitForTimeout(300);

    const subtaskCheckboxes = page.locator('#subtaskList input[type="checkbox"]');
    const count = await subtaskCheckboxes.count();

    if (count > 0) {
      const firstUnchecked = subtaskCheckboxes.filter({ hasNot: page.locator('[checked]') }).first();
      if (await firstUnchecked.count() > 0) {
        await firstUnchecked.check();
      }
    }

    await page.click('#saveTaskBtn');
    await page.waitForTimeout(300);

    const progressBar = page.locator('.card:visible .subtask-fill').first();
    await expect(progressBar, '进度条应该可见').toBeVisible();
  });

  test('TC-010 计时器', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.click({ button: 'right' });

    await page.click('.context-item:has-text("计时")');

    const startToast = page.locator('.toast:has-text("计时")');
    await expect(startToast, '应该显示开始计时Toast').toBeVisible();

    await page.waitForTimeout(500);

    let timerBadge = page.locator('.timer-badge.running');
    await expect(timerBadge, '应该显示运行中的计时器徽章').toBeVisible();

    await page.waitForTimeout(2000);

    const timerText = await timerBadge.textContent();
    expect(timerText, '计时器应该显示时间').toMatch(/\d/);

    const cardWithTimer = page.locator('.card:has(.timer-badge)').first();
    await cardWithTimer.click({ button: 'right' });
    await page.click('.context-item:has-text("计时")');

    const pauseToast = page.locator('.toast:has-text("暂停")');
    await expect(pauseToast, '应该显示暂停Toast').toBeVisible();
  });

  test('TC-011 导出/导入', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("导出")')
    ]);

    expect(download, '应该触发文件下载').toBeDefined();
    expect(download.suggestedFilename(), '文件名应包含taskflow').toContain('taskflow');

    const path = await download.path();
    if (path) {
      const fs = require('fs');
      const content = fs.readFileSync(path, 'utf-8');
      const data = JSON.parse(content);

      expect(data.tasks, 'JSON应包含tasks数组').toBeDefined();
      expect(Array.isArray(data.tasks), 'tasks应该是数组').toBeTruthy();
      expect(data.tasks.length, '应该有任务数据').toBeGreaterThan(0);
    }

    const exportToast = page.locator('.toast:has-text("导出")');
    await expect(exportToast, '应该显示导出成功Toast').toBeVisible();
  });

  test('TC-012 复制任务', async ({ page }) => {
    const initialCount = await page.locator('.card').count();

    const firstCard = page.locator('.card').first();
    const cardTitle = await firstCard.locator('.card-title').textContent();

    await firstCard.click({ button: 'right' });
    await page.click('.context-item:has-text("复制")');

    const copyToast = page.locator('.toast:has-text("复制")');
    await expect(copyToast, '应该显示复制成功Toast').toBeVisible();

    await page.waitForTimeout(300);

    const newCount = await page.locator('.card').count();
    expect(newCount, '任务总数应增加1').toBe(initialCount + 1);

    const duplicatedCard = page.locator(`.card:has-text("(副本)")`);
    await expect(duplicatedCard, '应该有标题包含(副本)的卡片').toBeVisible();
  });

  test('TC-013 快捷键', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const searchInput = page.locator('#searchInput');
    await expect(searchInput, 'Ctrl+K应聚焦搜索框').toBeFocused();

    await page.click('button:has-text("+ 新建任务")');
    await page.waitForTimeout(200);

    const modal = page.locator('#taskModal');
    await expect(modal, '弹窗应打开').toHaveClass(/active/);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(modal, 'Escape应关闭弹窗').not.toHaveClass(/active/);

    await page.click('button:has-text("+ 新建任务")');
    await page.waitForTimeout(200);

    await page.fill('#newSubtask', '快捷键添加的子任务');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const subtaskItem = page.locator('#subtaskList .subtask-item:has-text("快捷键添加的子任务")');
    await expect(subtaskItem, 'Enter应添加子任务').toBeVisible();

    await page.fill('#taskTitle', '快捷键测试任务');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(300);

    const successToast = page.locator('.toast-success');
    await expect(successToast, 'Ctrl+Enter应保存任务').toBeVisible();
  });

  test('TC-014 边界测试', async ({ page }) => {
    await page.click('button:has-text("+ 新建任务")');

    const titleInput = page.locator('#taskTitle');
    const longTitle = 'A'.repeat(100);
    await titleInput.fill(longTitle);

    const inputValue = await titleInput.inputValue();
    expect(inputValue.length, '标题应在maxlength限制内').toBeLessThanOrEqual(100);

    const estimateInput = page.locator('#taskEstimate');
    await estimateInput.fill('-5');
    const estimateValue = await estimateInput.inputValue();
    expect(parseFloat(estimateValue), '工时负数应被处理').toBeLessThanOrEqual(0);

    const dueInput = page.locator('#taskDue');
    const pastDate = '2020-01-01';
    await dueInput.fill(pastDate);

    await page.fill('#taskTitle', '边界测试任务');
    await page.click('#saveTaskBtn');
    await page.waitForTimeout(300);

    const card = page.locator('.card:has-text("边界测试任务")');
    await expect(card, '任务应创建成功').toBeVisible();

    const startTime = Date.now();
    for (let i = 0; i < 20; i++) {
      await page.click('button:has-text("+ 新建任务")');
      await page.fill('#taskTitle', `批量任务 ${i + 1}`);
      await page.click('#saveTaskBtn');
      await page.waitForTimeout(50);
    }
    const endTime = Date.now();

    expect(endTime - startTime, '创建20个任务应在合理时间内完成').toBeLessThan(30000);

    const allCards = page.locator('.card');
    const finalCount = await allCards.count();
    expect(finalCount, '所有任务应创建成功').toBeGreaterThanOrEqual(30);
  });

  test('TC-015 UI一致性', async ({ page }) => {
    const columns = page.locator('.column');
    const expectedTitles = ['待办', '计划中', '进行中', '审核中', '已完成'];
    const expectedIcons = ['📋', '📌', '🚀', '🔍', '✅'];

    for (let i = 0; i < 5; i++) {
      const colTitle = columns.nth(i).locator('.col-title');
      const titleText = await colTitle.textContent();
      expect(titleText, `第${i + 1}列应包含${expectedTitles[i]}`).toContain(expectedTitles[i]);
      expect(titleText, `第${i + 1}列应包含图标${expectedIcons[i]}`).toContain(expectedIcons[i]);
    }

    const highPriority = page.locator('.priority-high').first();
    if (await highPriority.count() > 0) {
      const color = await highPriority.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(color, '高优先级应为红色').toMatch(/rgb\(\s*2?\d{2,3}/);
    }

    const bugLabel = page.locator('.label-bug').first();
    if (await bugLabel.count() > 0) {
      await expect(bugLabel, 'bug标签应可见').toBeVisible();
    }

    const featureLabel = page.locator('.label-feature').first();
    if (await featureLabel.count() > 0) {
      await expect(featureLabel, 'feature标签应可见').toBeVisible();
    }

    const assigneeAvatar = page.locator('.card-assignee').first();
    if (await assigneeAvatar.count() > 0) {
      const bgColor = await assigneeAvatar.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bgColor, '负责人头像应有背景色').toBeTruthy();
    }
  });
});
