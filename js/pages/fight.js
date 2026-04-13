// ============================================================
// FIGHT GOALS PAGE
// ============================================================
function resetPendingOpponentPhoto() {
  if (pendingOpponentPhotoPreviewUrl && pendingOpponentPhotoPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(pendingOpponentPhotoPreviewUrl);
  }
  pendingOpponentPhotoFile = null;
  pendingOpponentPhotoPreviewUrl = '';
  const input = document.getElementById('opponentPhotoInput');
  if (input) input.value = '';
  renderOpponentPhotoPreview();
}

function getEditingOpponentRecord() {
  return editingOpponentId ? opponents.find((row) => row.id === editingOpponentId) || null : null;
}

function getSelectedOpponentRecord() {
  return selectedOpponentId
    ? opponents.find((row) => row.id === selectedOpponentId) || null
    : opponents[0] || null;
}

function getOpponentPhotoPreviewUrl() {
  return pendingOpponentPhotoPreviewUrl || editingOpponentPhotoUrl || '';
}

function linkifyText(value) {
  const raw = String(value ?? '');
  if (!raw) return '';
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const links = [];
  const plainText = raw.replace(urlRegex, (fullMatch) => {
    let url = fullMatch;
    while (/[),.!?;:]$/.test(url)) {
      url = url.slice(0, -1);
    }
    if (url) links.push(url);
    return '';
  }).trim();

  const sections = [];
  if (plainText) {
    sections.push(escapeHtml(plainText).replaceAll('\n', '<br>'));
  }
  if (links.length) {
    const linkLines = links.map((url, idx) => (
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">リンク${idx + 1}</a> / ${escapeHtml(url)}`
    ));
    sections.push(linkLines.join('<br>'));
  }
  return sections.join('<br>');
}

function openFightCountdownView() {
  const activeFights = fightGoals.filter((row) => row.status === '準備中' && row.fight_date);
  const nextFight = activeFights.sort((a, b) => new Date(a.fight_date) - new Date(b.fight_date))[0] || null;
  if (nextFight?.opponent_id && opponents.some((row) => row.id === nextFight.opponent_id)) {
    selectedOpponentId = nextFight.opponent_id;
  }
  currentFightSectionTab = 'opponents';
  switchPage('fight');
}

function updateOpponentFormModeUi() {
  const note = document.getElementById('opponentFormModeNote');
  const saveBtn = document.getElementById('saveOpponentBtn');
  const cancelBtn = document.getElementById('cancelOpponentEditBtn');
  const composer = document.getElementById('opponentComposerCard');
  const workspace = document.getElementById('opponentWorkspace');
  const editingRow = getEditingOpponentRecord();
  if (composer) composer.style.display = isOpponentComposerOpen ? 'block' : 'none';
  if (workspace) workspace.classList.toggle('composer-closed', !isOpponentComposerOpen);
  if (note) {
    note.textContent = editingRow
      ? `「${editingRow.name}」を編集中です。保存するとプロフィールと写真を更新します。`
      : '新規の対戦相手プロフィールを登録します。';
  }
  if (saveBtn) {
    saveBtn.innerHTML = editingRow
      ? '<i class="fas fa-save"></i> 対戦相手を更新'
      : '<i class="fas fa-save"></i> 対戦相手を保存';
  }
  if (cancelBtn) {
    cancelBtn.style.display = isOpponentComposerOpen ? 'inline-flex' : 'none';
  }
}

function renderOpponentPhotoPreview(photoUrl = getOpponentPhotoPreviewUrl()) {
  const preview = document.getElementById('opponentPhotoPreview');
  const meta = document.getElementById('opponentPhotoMeta');
  if (!preview || !meta) return;

  preview.innerHTML = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="対戦相手プロフィール写真" onerror="this.closest('.opponent-photo-preview').innerHTML='<div class=&quot;opponent-photo-fallback&quot;><i class=&quot;fas fa-user&quot;></i></div>'">`
    : '<div class="opponent-photo-fallback"><i class="fas fa-user"></i></div>';

  if (pendingOpponentPhotoFile) {
    meta.innerHTML = `
      <div class="media-chip">
        <span><i class="fas fa-image"></i> ${escapeHtml(pendingOpponentPhotoFile.name)}</span>
        <button type="button" class="btn-icon" onclick="resetPendingOpponentPhoto()" aria-label="削除"><i class="fas fa-times"></i></button>
      </div>
    `;
    return;
  }

  meta.innerHTML = editingOpponentPhotoStoragePath
    ? `
      <div class="media-chip">
        <span><i class="fas fa-cloud"></i> 保存済みプロフィール写真</span>
      </div>
    `
    : '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('画像ファイルを読み込めませんでした'));
    reader.readAsDataURL(file);
  });
}

async function handleOpponentPhotoInput(event) {
  const [file] = Array.from(event.target.files || []).filter((row) => row.type.startsWith('image/'));
  if (!file) {
    resetPendingOpponentPhoto();
    return;
  }
  if (!canUseCloudMedia()) {
    showToast('対戦相手写真はクラウドログイン時のみ保存できます', 'info');
    event.target.value = '';
    return;
  }
  if (pendingOpponentPhotoPreviewUrl) {
    if (pendingOpponentPhotoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pendingOpponentPhotoPreviewUrl);
    }
  }
  try {
    pendingOpponentPhotoFile = file;
    pendingOpponentPhotoPreviewUrl = await readFileAsDataUrl(file);
    renderOpponentPhotoPreview();
  } catch (err) {
    console.error(err);
    pendingOpponentPhotoFile = null;
    pendingOpponentPhotoPreviewUrl = '';
    event.target.value = '';
    renderOpponentPhotoPreview();
    showToast('画像プレビューの生成に失敗しました。別の画像で再度お試しください', 'error');
  }
}

async function populateOpponentFormForEdit(id) {
  const row = opponents.find((item) => item.id === id);
  if (!row) {
    showToast('対戦相手データが見つかりません', 'error');
    return;
  }
  selectedOpponentId = row.id;
  editingOpponentId = row.id;
  isOpponentComposerOpen = true;
  editingOpponentPhotoStoragePath = row.photo_storage_path || '';
  editingOpponentPhotoUrl = row.photo_storage_path ? await getOpponentPhotoSignedUrl(row.photo_storage_path) : '';

  const fieldMap = {
    'o-name': row.name || '',
    'o-ring-name': row.ring_name || '',
    'o-gym': row.gym || '',
    'o-nationality': row.nationality || '',
    'o-height': row.height_cm ?? '',
    'o-reach': row.reach_cm ?? '',
    'o-wins': row.wins ?? 0,
    'o-losses': row.losses ?? 0,
    'o-draws': row.draws ?? 0,
    'o-kos': row.kos ?? 0,
    'o-strengths': row.strengths || '',
    'o-weaknesses': row.weaknesses || '',
    'o-notes': row.notes || '',
  };
  Object.entries(fieldMap).forEach(([fieldId, value]) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = value;
  });
  const stance = document.getElementById('o-stance');
  if (stance) stance.value = row.stance || OPPONENT_STANCES[0];

  resetPendingOpponentPhoto();
  updateOpponentFormModeUi();
  switchFightSectionTab('opponents', true);
  document.getElementById('o-name')?.focus();
}

function resetOpponentForm() {
  clearForm(['o-name', 'o-ring-name', 'o-gym', 'o-nationality', 'o-height', 'o-reach', 'o-wins', 'o-losses', 'o-draws', 'o-kos', 'o-strengths', 'o-weaknesses', 'o-notes']);
  const stance = document.getElementById('o-stance');
  if (stance) stance.value = OPPONENT_STANCES[0];
  editingOpponentId = null;
  editingOpponentPhotoStoragePath = '';
  editingOpponentPhotoUrl = '';
  resetPendingOpponentPhoto();
  updateOpponentFormModeUi();
}

function closeOpponentComposer() {
  editingOpponentId = null;
  isOpponentComposerOpen = false;
  editingOpponentPhotoStoragePath = '';
  editingOpponentPhotoUrl = '';
  resetPendingOpponentPhoto();
  updateOpponentFormModeUi();
}

function openNewOpponentComposer() {
  resetOpponentForm();
  isOpponentComposerOpen = true;
  updateOpponentFormModeUi();
  document.getElementById('o-name')?.focus();
}

function selectOpponentProfile(id) {
  selectedOpponentId = id || '';
  void renderFightPage();
}

function editSelectedOpponentProfile() {
  if (!selectedOpponentId) {
    showToast('編集する対戦相手を選択してください', 'info');
    return;
  }
  void populateOpponentFormForEdit(selectedOpponentId);
}

function deleteSelectedOpponentProfile() {
  if (!selectedOpponentId) {
    showToast('削除する対戦相手を選択してください', 'info');
    return;
  }
  void deleteOpponentProfile(selectedOpponentId);
}

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
  if (row?.id) selectedOpponentId = row.id;
}

async function saveOpponentProfile() {
  const name = document.getElementById('o-name')?.value.trim();
  if (!name) {
    showToast('対戦相手名を入力してください', 'error');
    return;
  }

  const heightChk = parseOptionalBounded(document.getElementById('o-height')?.value, INPUT_BOUNDS.heightCm, '身長');
  if (!heightChk.ok) {
    showToast(heightChk.msg, 'error');
    return;
  }
  const reachChk = parseOptionalBounded(document.getElementById('o-reach')?.value, INPUT_BOUNDS.reachCm, 'リーチ');
  if (!reachChk.ok) {
    showToast(reachChk.msg, 'error');
    return;
  }
  const winsChk = parseOptionalIntBounded(document.getElementById('o-wins')?.value, INPUT_BOUNDS.opponentRecordCount, '勝利数');
  if (!winsChk.ok) {
    showToast(winsChk.msg, 'error');
    return;
  }
  const lossesChk = parseOptionalIntBounded(document.getElementById('o-losses')?.value, INPUT_BOUNDS.opponentRecordCount, '敗戦数');
  if (!lossesChk.ok) {
    showToast(lossesChk.msg, 'error');
    return;
  }
  const drawsChk = parseOptionalIntBounded(document.getElementById('o-draws')?.value, INPUT_BOUNDS.opponentRecordCount, '引き分け数');
  if (!drawsChk.ok) {
    showToast(drawsChk.msg, 'error');
    return;
  }
  const kosChk = parseOptionalIntBounded(document.getElementById('o-kos')?.value, INPUT_BOUNDS.opponentRecordCount, 'KO数');
  if (!kosChk.ok) {
    showToast(kosChk.msg, 'error');
    return;
  }

  const payload = {
    name,
    ring_name: document.getElementById('o-ring-name')?.value.trim() || '',
    gym: document.getElementById('o-gym')?.value.trim() || '',
    nationality: document.getElementById('o-nationality')?.value.trim() || '',
    stance: document.getElementById('o-stance')?.value || '',
    height_cm: heightChk.value,
    reach_cm: reachChk.value,
    wins: winsChk.value ?? 0,
    losses: lossesChk.value ?? 0,
    draws: drawsChk.value ?? 0,
    kos: kosChk.value ?? 0,
    strengths: document.getElementById('o-strengths')?.value.trim() || '',
    weaknesses: document.getElementById('o-weaknesses')?.value.trim() || '',
    notes: document.getElementById('o-notes')?.value.trim() || '',
  };
  try {
    const wasEditing = !!editingOpponentId;
    const previousPhotoPath = editingOpponentPhotoStoragePath;
    let record = wasEditing
      ? await apiPut('opponents', editingOpponentId, payload)
      : await apiPost('opponents', payload);
    if (pendingOpponentPhotoFile) {
      try {
        const photoMeta = await uploadOpponentPhotoFile(pendingOpponentPhotoFile, record.id);
        if (wasEditing && previousPhotoPath && previousPhotoPath !== photoMeta.storage_path) {
          await deleteOpponentPhotoStorage(previousPhotoPath);
        }
        record = await apiPut('opponents', record.id, {
          photo_storage_path: photoMeta.storage_path,
          photo_file_name: photoMeta.file_name,
          photo_content_type: photoMeta.content_type,
          photo_file_size: photoMeta.file_size,
        });
      } catch (photoErr) {
        console.error(photoErr);
        showToast('プロフィールは保存しましたが、写真の保存に失敗しました', 'info');
      }
    }
    const existingIdx = opponents.findIndex((row) => row.id === record.id);
    if (existingIdx === -1) opponents.push(record);
    else opponents[existingIdx] = record;
    opponents.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    selectedOpponentId = record.id;
    syncFightOpponentSelect(record.id);
    editingOpponentId = record.id;
    editingOpponentPhotoStoragePath = record.photo_storage_path || '';
    editingOpponentPhotoUrl = record.photo_storage_path ? await getOpponentPhotoSignedUrl(record.photo_storage_path) : '';
    resetPendingOpponentPhoto();
    isOpponentComposerOpen = false;
    updateOpponentFormModeUi();
    showToast(wasEditing ? '対戦相手プロフィールを更新しました' : '対戦相手プロフィールを保存しました', 'success');
    await renderFightPage();
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
      const opponentRow = opponents.find((row) => row.id === id);
      if (opponentRow?.photo_storage_path) {
        await deleteOpponentPhotoStorage(opponentRow.photo_storage_path);
      }
      await apiDelete('opponents', id);
      opponents = opponents.filter((row) => row.id !== id);
      if (selectedOpponentId === id) selectedOpponentId = '';
      if (editingOpponentId === id) {
        editingOpponentId = null;
        editingOpponentPhotoStoragePath = '';
        editingOpponentPhotoUrl = '';
        isOpponentComposerOpen = false;
        resetPendingOpponentPhoto();
        updateOpponentFormModeUi();
      }
      syncFightOpponentSelect();
      await renderFightPage();
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
    await renderFightPage();
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
      await renderFightPage();
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
    await renderFightPage();
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
      await renderFightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

async function renderFightPage() {
  if (typeof refreshCuttingPlanRows === 'function') refreshCuttingPlanRows();
  switchFightSectionTab(currentFightSectionTab, false);
  syncFightOpponentSelect(document.getElementById('f-opponent-id')?.value || '');
  updateOpponentFormModeUi();
  renderOpponentPhotoPreview();
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

  if (!selectedOpponentId && nextFight?.opponent_id && opponents.some((row) => row.id === nextFight.opponent_id)) {
    selectedOpponentId = nextFight.opponent_id;
  } else if (!selectedOpponentId && opponents.length) {
    selectedOpponentId = opponents[0].id;
  }

  const selectedOpponent = getSelectedOpponentRecord();
  const selectedEmpty = document.getElementById('opponentSelectedEmpty');
  const selectedContent = document.getElementById('opponentSelectedContent');
  const selectedStats = document.getElementById('selectedOpponentStats');
  const selectedPhoto = document.getElementById('selectedOpponentPhoto');
  if (selectedOpponent) {
    if (selectedEmpty) selectedEmpty.style.display = 'none';
    if (selectedContent) selectedContent.style.display = 'block';
    setText('selectedOpponentSubline', selectedOpponent.gym || '所属未設定');
    setText('selectedOpponentName', selectedOpponent.name || '--');
    setText('selectedOpponentMeta', [selectedOpponent.ring_name, selectedOpponent.nationality].filter(Boolean).join(' / ') || 'リングネーム・国籍未設定');
    setText('selectedOpponentStance', selectedOpponent.stance || '構え未設定');
    const notesHtml = [
      selectedOpponent.strengths ? `<strong>強み:</strong> ${linkifyText(selectedOpponent.strengths)}` : '',
      selectedOpponent.weaknesses ? `<strong>弱み:</strong> ${linkifyText(selectedOpponent.weaknesses)}` : '',
      selectedOpponent.notes ? linkifyText(selectedOpponent.notes) : '',
    ].filter(Boolean).join(' / ');
    setHtml('selectedOpponentNotes', notesHtml || 'メモはありません。');
    if (selectedStats) {
      selectedStats.innerHTML = `
        <div class="opponent-card-stat"><span>身長</span><strong>${selectedOpponent.height_cm || '--'} cm</strong></div>
        <div class="opponent-card-stat"><span>リーチ</span><strong>${selectedOpponent.reach_cm || '--'} cm</strong></div>
        <div class="opponent-card-stat"><span>戦績</span><strong>${selectedOpponent.wins || 0}-${selectedOpponent.losses || 0}-${selectedOpponent.draws || 0}</strong></div>
        <div class="opponent-card-stat"><span>KO</span><strong>${selectedOpponent.kos || 0}</strong></div>
      `;
    }
    if (selectedPhoto) {
      const photoUrl = selectedOpponent.photo_storage_path ? await getOpponentPhotoSignedUrl(selectedOpponent.photo_storage_path) : '';
      selectedPhoto.innerHTML = photoUrl
        ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(selectedOpponent.name || '対戦相手')}">`
        : '<div class="opponent-photo-fallback"><i class="fas fa-user"></i></div>';
    }
  } else {
    if (selectedEmpty) selectedEmpty.style.display = 'block';
    if (selectedContent) selectedContent.style.display = 'none';
  }

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
            ${f.note ? `<br>📝 ${linkifyText(f.note)}` : ''}
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
      const cards = await Promise.all(opponents.slice().reverse().map(async (op) => {
        const photoUrl = op.photo_storage_path ? await getOpponentPhotoSignedUrl(op.photo_storage_path) : '';
        return `
        <div class="opponent-card">
          <div class="opponent-card-head">
            <div>
              <strong>${escapeHtml(op.name)}</strong>
              <div class="table-subnote">${escapeHtml(op.ring_name || 'リングネーム未設定')}</div>
            </div>
            <div class="opponent-chip-row">
              <button type="button" class="btn btn-sm btn-secondary" onclick="selectOpponentProfile('${op.id}')"><i class="fas fa-eye"></i> 表示</button>
              <button type="button" class="btn btn-sm btn-danger" onclick="deleteOpponentProfile('${op.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="opponent-card-body">
            <div class="opponent-card-photo">
              ${photoUrl
                ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(op.name)}">`
                : '<div class="opponent-photo-fallback"><i class="fas fa-user"></i></div>'}
            </div>
            <div class="opponent-card-main">
              <div class="opponent-chip-row">
                <span class="badge">${escapeHtml(op.gym || '所属未設定')}</span>
                <span class="badge">${escapeHtml(op.nationality || '国籍未設定')}</span>
                <span class="badge">${escapeHtml(op.stance || '構え未設定')}</span>
              </div>
              <div class="opponent-card-summary">
                <div class="opponent-card-stat"><span>身長</span><strong>${op.height_cm || '--'} cm</strong></div>
                <div class="opponent-card-stat"><span>リーチ</span><strong>${op.reach_cm || '--'} cm</strong></div>
                <div class="opponent-card-stat"><span>戦績</span><strong>${op.wins || 0}-${op.losses || 0}-${op.draws || 0}</strong></div>
                <div class="opponent-card-stat"><span>KO</span><strong>${op.kos || 0}</strong></div>
              </div>
            </div>
          </div>
          ${op.strengths ? `<p class="settings-note"><strong>強み:</strong> ${linkifyText(op.strengths)}</p>` : ''}
          ${op.weaknesses ? `<p class="settings-note"><strong>弱み:</strong> ${linkifyText(op.weaknesses)}</p>` : ''}
          ${op.notes ? `<p class="settings-note">${linkifyText(op.notes)}</p>` : ''}
        </div>
      `;
      }));
      opponentContainer.innerHTML = cards.join('');
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
            ${row.memo ? `📝 ${linkifyText(row.memo)}` : ''}
          </div>
          <div class="fight-card-actions">
            <button class="btn btn-sm btn-danger" onclick="deleteFightHistoryEntry('${row.id}')"><i class="fas fa-trash"></i> 削除</button>
          </div>
        </div>
      `).join('');
    }
  }
}

if (typeof window !== 'undefined') {
  window.populateOpponentFormForEdit = populateOpponentFormForEdit;
  window.resetOpponentForm = resetOpponentForm;
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
  const sourceLabel = cuttingPlanRows[0]?.autoGenerated ? ' / 自動生成' : '';
  summaryEl.textContent = `${formatDate(cuttingPlanRows[0].date)} - ${formatDate(cuttingPlanRows[cuttingPlanRows.length - 1].date)} / ${cuttingPlanRows.length}日分${sourceLabel}`;

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

function toggleCollapseSection(sectionId, buttonEl) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const collapsed = section.classList.toggle('is-collapsed');
  setCollapseToggleIcon(buttonEl, collapsed);
}

function setCollapseToggleIcon(buttonEl, collapsed) {
  if (!buttonEl) return;
  const isCollapsed = !!collapsed;
  const icon = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';
  buttonEl.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
  buttonEl.setAttribute('aria-label', isCollapsed ? '開く' : '折りたたむ');
}

function initCollapseToggleButtons() {
  const buttons = Array.from(document.querySelectorAll('.collapse-toggle'));
  buttons.forEach((buttonEl) => {
    const onclick = buttonEl.getAttribute('onclick') || '';
    const match = onclick.match(/toggleCollapseSection\('([^']+)'/);
    const sectionId = match?.[1];
    const section = sectionId ? document.getElementById(sectionId) : null;
    const collapsed = !!section?.classList.contains('is-collapsed');
    setCollapseToggleIcon(buttonEl, collapsed);
  });
}

if (typeof window !== 'undefined') {
  window.toggleCollapseSection = toggleCollapseSection;
  window.initCollapseToggleButtons = initCollapseToggleButtons;
  window.openNewOpponentComposer = openNewOpponentComposer;
  window.closeOpponentComposer = closeOpponentComposer;
  window.selectOpponentProfile = selectOpponentProfile;
  window.editSelectedOpponentProfile = editSelectedOpponentProfile;
  window.deleteSelectedOpponentProfile = deleteSelectedOpponentProfile;
  window.openFightCountdownView = openFightCountdownView;
}
