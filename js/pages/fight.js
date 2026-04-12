// ============================================================
// FIGHT GOALS PAGE
// ============================================================
function syncFightOpponentSelect(selectedId = '') {
  const selectEl = document.getElementById('f-opponent-id');
  const historySelectEl = document.getElementById('fh-opponent-id');
  if (selectEl) selectEl.innerHTML = getOpponentsForSelectOptions(selectedId);
  if (historySelectEl) historySelectEl.innerHTML = getOpponentsForSelectOptions(historySelectEl.value || '');
}

function handleFightOpponentSelection(opponentId) {
  const textEl = document.getElementById('f-opponent');
  const row = opponents.find((item) => item.id === opponentId);
  if (textEl && row) textEl.value = row.name || '';
}

async function saveOpponentProfile() {
  const name = document.getElementById('o-name')?.value.trim();
  if (!name) {
    showToast('対戦相手名を入力してください', 'error');
    return;
  }
  const payload = {
    name,
    ring_name: document.getElementById('o-ring-name')?.value.trim() || '',
    gym: document.getElementById('o-gym')?.value.trim() || '',
    nationality: document.getElementById('o-nationality')?.value.trim() || '',
    stance: document.getElementById('o-stance')?.value || '',
    height_cm: Number(document.getElementById('o-height')?.value) || null,
    reach_cm: Number(document.getElementById('o-reach')?.value) || null,
    wins: Number(document.getElementById('o-wins')?.value) || 0,
    losses: Number(document.getElementById('o-losses')?.value) || 0,
    draws: Number(document.getElementById('o-draws')?.value) || 0,
    kos: Number(document.getElementById('o-kos')?.value) || 0,
    strengths: document.getElementById('o-strengths')?.value.trim() || '',
    weaknesses: document.getElementById('o-weaknesses')?.value.trim() || '',
    notes: document.getElementById('o-notes')?.value.trim() || '',
  };
  try {
    const record = await apiPost('opponents', payload);
    opponents.push(record);
    opponents.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    syncFightOpponentSelect(record.id);
    clearForm(['o-name', 'o-ring-name', 'o-gym', 'o-nationality', 'o-height', 'o-reach', 'o-wins', 'o-losses', 'o-draws', 'o-kos', 'o-strengths', 'o-weaknesses', 'o-notes']);
    const stance = document.getElementById('o-stance');
    if (stance) stance.value = OPPONENT_STANCES[0];
    showToast('対戦相手プロフィールを保存しました', 'success');
    renderFightPage();
    switchFightSectionTab('opponents');
  } catch (err) {
    console.error(err);
    showToast('対戦相手の保存に失敗しました', 'error');
  }
}

async function deleteOpponentProfile(id) {
  showModal('対戦相手を削除', 'この相手プロフィールを削除しますか？過去試合との紐付けは解除されます。', async () => {
    try {
      const relatedGoals = fightGoals.filter((goal) => goal.opponent_id === id);
      for (const goal of relatedGoals) {
        const updated = await apiPut('fight_goals', goal.id, { opponent_id: '' });
        const idx = fightGoals.findIndex((item) => item.id === goal.id);
        if (idx !== -1) fightGoals[idx] = updated;
      }
      const relatedHistory = fightHistory.filter((row) => row.opponent_id === id);
      for (const row of relatedHistory) {
        const updated = await apiPut('fight_history', row.id, { opponent_id: '' });
        const idx = fightHistory.findIndex((item) => item.id === row.id);
        if (idx !== -1) fightHistory[idx] = updated;
      }
      await apiDelete('opponents', id);
      opponents = opponents.filter((row) => row.id !== id);
      syncFightOpponentSelect();
      renderFightPage();
      showToast('対戦相手を削除しました', 'info');
    } catch (err) {
      console.error(err);
      showToast('削除に失敗しました', 'error');
    }
  });
}

async function saveFightHistoryEntry() {
  const fightDate = document.getElementById('fh-date')?.value;
  if (!isIsoDateString(fightDate)) {
    showToast('試合日を正しく選択してください', 'error');
    return;
  }
  const opponentId = document.getElementById('fh-opponent-id')?.value || '';
  const opponentName = getOpponentNameById(opponentId, document.getElementById('fh-opponent-name')?.value.trim() || '');
  if (!opponentName) {
    showToast('対戦相手を入力または選択してください', 'error');
    return;
  }
  const payload = {
    fight_date: fightDate,
    opponent_id: opponentId,
    opponent_name: opponentName,
    result: document.getElementById('fh-result')?.value || '',
    method: document.getElementById('fh-method')?.value || '',
    event_name: document.getElementById('fh-event')?.value.trim() || '',
    venue: document.getElementById('fh-venue')?.value.trim() || '',
    weight_class: document.getElementById('fh-class')?.value.trim() || '',
    round: Number(document.getElementById('fh-round')?.value) || null,
    memo: document.getElementById('fh-memo')?.value.trim() || '',
    video_url: document.getElementById('fh-video')?.value.trim() || '',
  };
  try {
    const record = await apiPost('fight_history', payload);
    fightHistory.push(record);
    fightHistory.sort((a, b) => new Date(a.fight_date) - new Date(b.fight_date));
    clearForm(['fh-date', 'fh-opponent-name', 'fh-event', 'fh-venue', 'fh-class', 'fh-round', 'fh-memo', 'fh-video']);
    const opponentSelect = document.getElementById('fh-opponent-id');
    if (opponentSelect) opponentSelect.value = '';
    const resultEl = document.getElementById('fh-result');
    if (resultEl) resultEl.value = FIGHT_RESULTS[0];
    const methodEl = document.getElementById('fh-method');
    if (methodEl) methodEl.value = FIGHT_METHODS[0];
    showToast('過去試合を保存しました', 'success');
    renderFightPage();
    switchFightSectionTab('history');
  } catch (err) {
    console.error(err);
    showToast('過去試合の保存に失敗しました', 'error');
  }
}

async function deleteFightHistoryEntry(id) {
  showModal('過去試合を削除', 'この過去試合データを削除しますか？', async () => {
    try {
      await apiDelete('fight_history', id);
      fightHistory = fightHistory.filter((row) => row.id !== id);
      renderFightPage();
      showToast('過去試合を削除しました', 'info');
    } catch (err) {
      console.error(err);
      showToast('削除に失敗しました', 'error');
    }
  });
}

async function saveFightGoal() {
  const date     = document.getElementById('f-date').value;
  const opponentId = document.getElementById('f-opponent-id')?.value || '';
  const opponent = getOpponentNameById(opponentId, document.getElementById('f-opponent').value.trim());
  const wclass   = document.getElementById('f-class').value;
  const targetRaw = document.getElementById('f-target').value.trim();
  const venue    = document.getElementById('f-venue').value.trim();
  const status   = document.getElementById('f-status').value;
  const note     = document.getElementById('f-note').value.trim();

  if (!isIsoDateString(date)) { showToast('試合日を正しく選択してください', 'error'); return; }

  let target = null;
  if (targetRaw) {
    const tChk = parseRequiredBounded(targetRaw, INPUT_BOUNDS.targetWeightKg, '減量目標体重');
    if (!tChk.ok) { showToast(tChk.msg, 'error'); return; }
    target = tChk.value;
  }

  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length-1]?.weight : null;

  try {
    const record = await apiPost('fight_goals', {
      fight_date: date, opponent_id: opponentId, opponent, weight_class: wclass, target_weight: target,
      current_weight: latestWeight, venue, status, note
    });
    fightGoals.push(record);
    fightGoals.sort((a,b) => new Date(a.fight_date) - new Date(b.fight_date));
    showToast(`✅ 試合目標を登録しました！`, 'success');
    clearForm(['f-opponent','f-target','f-venue','f-note']);
    const opponentSelect = document.getElementById('f-opponent-id');
    if (opponentSelect) opponentSelect.value = '';
    renderFightPage();
    renderDashboard();
    switchFightSectionTab('next');
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

async function deleteFightGoal(id) {
  showModal('試合目標を削除', 'この試合目標を削除しますか？', async () => {
    try {
      await apiDelete('fight_goals', id);
      fightGoals = fightGoals.filter(f => f.id !== id);
      showToast('削除しました', 'info');
      renderFightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function renderFightPage() {
  switchFightSectionTab(currentFightSectionTab, false);
  syncFightOpponentSelect(document.getElementById('f-opponent-id')?.value || '');
  const activeFights = fightGoals.filter(f => f.status === '準備中' && f.fight_date);
  const nextFight = activeFights.sort((a,b) => new Date(a.fight_date)-new Date(b.fight_date))[0];

  if (nextFight) {
    const days = getDaysUntil(nextFight.fight_date);
    document.getElementById('countdown-days').textContent = days;
    document.getElementById('fi-opponent').textContent = `vs ${getOpponentNameById(nextFight.opponent_id, nextFight.opponent) || '相手未定'}`;
    document.getElementById('fi-date').textContent = formatDateJP(nextFight.fight_date);
    document.getElementById('fi-venue').textContent = nextFight.venue || '--';
    document.getElementById('fi-target').textContent = `目標体重: ${nextFight.target_weight || '--'} kg`;

    // Weight cut progress
    const latest = weightLogs.length ? weightLogs[weightLogs.length-1].weight : null;
    const target = nextFight.target_weight;
    document.getElementById('wcp-current').textContent = `現在: ${latest || '--'} kg`;
    document.getElementById('wcp-target').textContent = `目標: ${target || '--'} kg`;

    if (latest && target) {
      const startW = nextFight.current_weight || latest;
      const remain = (latest - target).toFixed(1);
      const totalCut = startW - target;
      const pct = totalCut > 0 ? Math.min(100, Math.round(((startW - latest) / totalCut) * 100)) : 100;
      const safeWeeklyCut = latest * 0.01;
      const safeDailyGrams = Math.round((safeWeeklyCut / 7) * 1000);
      const weeksLeft = Math.max(0, Math.ceil(days / 7));
      const trainDays = Math.max(0, days - Math.floor(days / 7));
      const cutPerWeek = days > 0 ? (latest - target) / Math.max(days / 7, 1) : 0;
      const cutPerDayGrams = days > 0 ? Math.round(((latest - target) / days) * 1000) : 0;
      const status = cutPerWeek <= safeWeeklyCut ? '安全圏' : cutPerWeek <= safeWeeklyCut * 1.5 ? '注意' : '危険';
      document.getElementById('fightWeightProgressFill').style.width = `${pct}%`;
      document.getElementById('wcp-remain').textContent = remain > 0 ? `残り -${remain} kg` : '目標達成！';
      setText('fdWeeks', String(weeksLeft));
      setText('fdTrainDays', String(trainDays));
      setText('fdCutPerDay', String(cutPerDayGrams > 0 ? cutPerDayGrams : 0));
      setText('cutPerWeek', `${cutPerWeek > 0 ? cutPerWeek.toFixed(2) : '0.00'} kg`);
      setText('cutPerDay', `${cutPerDayGrams > 0 ? cutPerDayGrams : 0} g`);
      setText('safeCutLimit', `${safeWeeklyCut.toFixed(2)} kg`);
      setText('weightCutStatus', status);
      setText('weightCutPlanNote', status === '安全圏'
        ? '現在のペースは一般的な安全圏です。水分・睡眠・回復も合わせて管理してください。'
        : status === '注意'
          ? 'やや速い減量ペースです。食事制限だけでなく水分・疲労管理も厳密に確認してください。'
          : '危険寄りの減量ペースです。コンディション悪化のリスクが高いため、計画の見直し推奨です。');
      const badge = document.getElementById('weightCutWarningBadge');
      if (badge) {
        badge.classList.remove('up', 'down', 'flat');
        badge.classList.add(status === '安全圏' ? 'up' : status === '注意' ? 'flat' : 'down');
        badge.textContent = status;
      }
      renderWeightCutCauseAlerts(nextFight, latest, target, days, cutPerWeek, safeWeeklyCut, status);
    } else {
      hideWeightCutCauseAlerts();
      setText('cutPerWeek', '-- kg');
      setText('cutPerDay', '-- g');
      setText('safeCutLimit', '-- kg');
      setText('weightCutStatus', '--');
      setText('weightCutPlanNote', '目標体重と最新体重が揃うと安全な減量計画を計算します。');
      const badge = document.getElementById('weightCutWarningBadge');
      if (badge) {
        badge.classList.remove('up', 'down', 'flat');
        badge.textContent = '判定待ち';
      }
    }
  } else {
    document.getElementById('countdown-days').textContent = '--';
    document.getElementById('fi-opponent').textContent = '-- vs --';
    document.getElementById('fi-date').textContent = '----/--/--';
    document.getElementById('fi-venue').textContent = '--';
    document.getElementById('fi-target').textContent = '目標体重: -- kg';
    document.getElementById('wcp-current').textContent = '現在: -- kg';
    document.getElementById('wcp-target').textContent = '目標: -- kg';
    document.getElementById('wcp-remain').textContent = '残り -- kg';
    document.getElementById('fightWeightProgressFill').style.width = '0%';
    setText('fdWeeks', '--');
    setText('fdTrainDays', '--');
    setText('fdCutPerDay', '--');
    setText('cutPerWeek', '-- kg');
    setText('cutPerDay', '-- g');
    setText('safeCutLimit', '-- kg');
    setText('weightCutStatus', '--');
    setText('weightCutPlanNote', '試合目標を登録すると減量ペースの警告が表示されます。');
    const badge = document.getElementById('weightCutWarningBadge');
    if (badge) {
      badge.classList.remove('up', 'down', 'flat');
      badge.textContent = '判定待ち';
    }
    hideWeightCutCauseAlerts();
  }

  renderCuttingPlanSection();
  renderFightPlanComparison(nextFight);

  // Fight cards list
  const container = document.getElementById('fightCardsList');
  if (!fightGoals.length) {
    container.innerHTML = '<div class="empty-state">試合目標が登録されていません</div>';
  } else {
    container.innerHTML = [...fightGoals].reverse().map(f => {
      const days = getDaysUntil(f.fight_date);
      return `
        <div class="fight-card">
          <div class="fight-card-header">
            <div class="fight-card-date">${formatDate(f.fight_date)}</div>
            <span class="fight-card-status status-${f.status}">${f.status}</span>
          </div>
          <div class="fight-card-info">
            ${(f.opponent || f.opponent_id) ? `🥊 vs <strong>${escapeHtml(getOpponentNameById(f.opponent_id, f.opponent))}</strong><br>` : ''}
            ${f.weight_class ? `⚖️ ${f.weight_class}<br>` : ''}
            ${f.target_weight ? `🎯 目標体重: <strong>${f.target_weight} kg</strong><br>` : ''}
            ${f.venue ? `📍 ${f.venue}<br>` : ''}
            ${f.status === '準備中' && days !== null ? `⏱️ <strong style="color:var(--red-light)">${days}日後</strong>` : ''}
            ${f.note ? `<br>📝 ${f.note}` : ''}
          </div>
          <div class="fight-card-actions">
            <button class="btn btn-sm btn-danger" onclick="deleteFightGoal('${f.id}')">
              <i class="fas fa-trash"></i> 削除
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const opponentContainer = document.getElementById('opponentCardsList');
  if (opponentContainer) {
    if (!opponents.length) {
      opponentContainer.innerHTML = '<div class="empty-state">対戦相手プロフィールがまだありません</div>';
    } else {
      opponentContainer.innerHTML = opponents.slice().reverse().map((op) => `
        <div class="opponent-card">
          <div class="opponent-card-head">
            <div>
              <strong>${escapeHtml(op.name)}</strong>
              <div class="table-subnote">${escapeHtml(op.gym || '所属未設定')} / ${escapeHtml(op.stance || '構え未設定')}</div>
            </div>
            <button type="button" class="btn btn-sm btn-danger" onclick="deleteOpponentProfile('${op.id}')"><i class="fas fa-trash"></i></button>
          </div>
          <div class="opponent-chip-row">
            <span class="badge">${escapeHtml(op.nationality || '国籍未設定')}</span>
            <span class="badge">身長 ${op.height_cm || '--'} cm</span>
            <span class="badge">リーチ ${op.reach_cm || '--'} cm</span>
            <span class="badge">${op.wins || 0}-${op.losses || 0}-${op.draws || 0} / KO ${op.kos || 0}</span>
          </div>
          ${op.strengths ? `<p class="settings-note"><strong>強み:</strong> ${escapeHtml(op.strengths)}</p>` : ''}
          ${op.weaknesses ? `<p class="settings-note"><strong>弱み:</strong> ${escapeHtml(op.weaknesses)}</p>` : ''}
          ${op.notes ? `<p class="settings-note">${escapeHtml(op.notes)}</p>` : ''}
        </div>
      `).join('');
    }
  }

  const fightHistoryContainer = document.getElementById('fightHistoryList');
  if (fightHistoryContainer) {
    if (!fightHistory.length) {
      fightHistoryContainer.innerHTML = '<div class="empty-state">過去試合データがまだありません</div>';
    } else {
      fightHistoryContainer.innerHTML = fightHistory.slice().reverse().map((row) => `
        <div class="fight-history-card">
          <div class="fight-card-header">
            <div class="fight-card-date">${formatDate(row.fight_date)}</div>
            <span class="fight-card-status status-${row.result || '準備中'}">${escapeHtml(row.result || '未設定')}</span>
          </div>
          <div class="fight-card-info">
            🥊 <strong>${escapeHtml(getOpponentNameById(row.opponent_id, row.opponent_name))}</strong><br>
            ${row.method ? `🏁 ${escapeHtml(row.method)}${row.round ? ` / ${row.round}R` : ''}<br>` : ''}
            ${row.weight_class ? `⚖️ ${escapeHtml(row.weight_class)}<br>` : ''}
            ${row.event_name ? `🎫 ${escapeHtml(row.event_name)}<br>` : ''}
            ${row.venue ? `📍 ${escapeHtml(row.venue)}<br>` : ''}
            ${row.video_url ? `🎥 <a href="${escapeHtml(row.video_url)}" target="_blank" rel="noopener noreferrer">映像リンク</a><br>` : ''}
            ${row.memo ? `📝 ${escapeHtml(row.memo)}` : ''}
          </div>
          <div class="fight-card-actions">
            <button class="btn btn-sm btn-danger" onclick="deleteFightHistoryEntry('${row.id}')"><i class="fas fa-trash"></i> 削除</button>
          </div>
        </div>
      `).join('');
    }
  }
}

function switchFightSectionTab(tabName, shouldScroll = false) {
  currentFightSectionTab = ['next', 'opponents', 'history'].includes(tabName) ? tabName : 'next';

  const tabs = [
    { button: document.getElementById('fightSectionTabNext'), panel: document.getElementById('fightSectionPanelNext'), name: 'next' },
    { button: document.getElementById('fightSectionTabOpponents'), panel: document.getElementById('fightSectionPanelOpponents'), name: 'opponents' },
    { button: document.getElementById('fightSectionTabHistory'), panel: document.getElementById('fightSectionPanelHistory'), name: 'history' },
  ];

  tabs.forEach(({ button, panel, name }) => {
    const isActive = name === currentFightSectionTab;
    if (button) {
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    if (panel) panel.classList.toggle('active', isActive);
  });

  if (shouldScroll) {
    const activePanel = tabs.find(({ name }) => name === currentFightSectionTab)?.panel;
    activePanel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderCuttingPlanSection() {
  const summaryEl = document.getElementById('cutPlanSummary');
  const todayCard = document.getElementById('todayCutPlanCard');
  const tbody = document.getElementById('cutPlanTableBody');
  if (!summaryEl || !todayCard || !tbody) return;

  if (!cuttingPlanRows.length) {
    summaryEl.textContent = 'データ未読込';
    todayCard.innerHTML = '<div class="empty-state">プランデータを読み込めませんでした</div>';
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">プランデータなし</td></tr>';
    return;
  }

  const today = TODAY();
  const upcoming = cuttingPlanRows.find(row => row.date >= today) || cuttingPlanRows[cuttingPlanRows.length - 1];
  summaryEl.textContent = `${formatDate(cuttingPlanRows[0].date)} - ${formatDate(cuttingPlanRows[cuttingPlanRows.length - 1].date)} / ${cuttingPlanRows.length}日分`;

  todayCard.innerHTML = `
    <div class="cut-plan-phase"><i class="fas fa-flag-checkered"></i>${upcoming.phase}</div>
    <div>
      <div class="stat-label">対象日</div>
      <div class="cut-plan-target">${formatDate(upcoming.date)}</div>
      <div class="stat-sub">目標朝体重 ${upcoming.targetMorningWeight}</div>
    </div>
    <div class="health-kpi-grid" style="padding:0">
      <div class="health-kpi"><span>KCAL</span><strong>${upcoming.totalKcalTarget}</strong></div>
      <div class="health-kpi"><span>P</span><strong>${upcoming.protein}g</strong></div>
      <div class="health-kpi"><span>F</span><strong>${upcoming.fat}g</strong></div>
      <div class="health-kpi"><span>C</span><strong>${upcoming.carbs}g</strong></div>
    </div>
    <div class="cut-plan-meal"><span>朝</span><strong>${upcoming.breakfast}</strong></div>
    <div class="cut-plan-meal"><span>昼</span><strong>${upcoming.lunch}</strong></div>
    <div class="cut-plan-meal"><span>夜</span><strong>${upcoming.dinner}</strong></div>
    <div class="cut-plan-meal"><span>補食</span><strong>${upcoming.snack || 'なし'}</strong></div>
    <div class="cut-plan-notes">
      <div><strong style="color:var(--tx-1)">水分メモ:</strong> ${upcoming.hydrationMemo || '--'}</div>
      <div><strong style="color:var(--tx-1)">体調メモ:</strong> ${upcoming.conditionMemo || '--'}</div>
    </div>
  `;

  tbody.innerHTML = cuttingPlanRows.map(row => `
    <tr>
      <td>${formatDate(row.date)}</td>
      <td>${row.phase}</td>
      <td>${row.targetMorningWeight}</td>
      <td>${row.totalKcalTarget || '--'}</td>
      <td>${row.protein || '--'}</td>
      <td>${row.fat || '--'}</td>
      <td>${row.carbs || '--'}</td>
      <td>
        <strong>朝</strong> ${row.breakfast}<br>
        <strong>昼</strong> ${row.lunch}<br>
        <strong>夜</strong> ${row.dinner}<br>
        <strong>補</strong> ${row.snack || 'なし'}
      </td>
      <td>${row.hydrationMemo}<br>${row.conditionMemo}</td>
    </tr>
  `).join('');

  switchCutPlanTab(currentCutPlanTab, false);
}

function switchCutPlanTab(tabName, shouldScroll = false) {
  currentCutPlanTab = tabName;

  const cardTab = document.getElementById('cutPlanTabCard');
  const tableTab = document.getElementById('cutPlanTabTable');
  const cardPanel = document.getElementById('cutPlanPanelCard');
  const tablePanel = document.getElementById('cutPlanPanelTable');

  if (!cardTab || !tableTab || !cardPanel || !tablePanel) return;

  const isCard = tabName === 'card';
  cardTab.classList.toggle('active', isCard);
  tableTab.classList.toggle('active', !isCard);
  cardPanel.classList.toggle('active', isCard);
  tablePanel.classList.toggle('active', !isCard);

  if (shouldScroll) {
    (isCard ? cardPanel : tablePanel).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
