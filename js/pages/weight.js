// ============================================================
// WEIGHT PAGE
// ============================================================
function resetPendingWeightPhotos() {
  pendingWeightPhotoFiles = [];
  const input = document.getElementById('weightPhotoInput');
  if (input) input.value = '';
  renderPendingWeightPhotoPreview();
}

function getActiveWeightPhotoRecordId() {
  return editingWeightId || selectedWeightRecordId || '';
}

function getEditingWeightPhotos() {
  if (!editingWeightId) return [];
  return getWeightPhotosByLogId(editingWeightId);
}

async function renderWeightPhotoGallery(weightLogId = getActiveWeightPhotoRecordId()) {
  const gallery = document.getElementById('weightPhotoGallery');
  const hint = document.getElementById('weightPhotoHint');
  if (!gallery || !hint) return;

  if (!weightLogId) {
    gallery.innerHTML = '';
    hint.textContent = canUseCloudMedia()
      ? '保存後にこの記録へ最大3枚まで写真を追加できます。'
      : '写真アップロードは Supabase ログイン時のみ利用できます。';
    return;
  }

  const photos = getWeightPhotosByLogId(weightLogId);
  if (!photos.length) {
    gallery.innerHTML = '';
    hint.textContent = canUseCloudMedia()
      ? 'この記録にはまだ写真がありません。'
      : '写真はクラウドログイン時のみ追加できます。';
    return;
  }

  hint.textContent = `この記録の写真 ${photos.length} / ${WEIGHT_PHOTO_MAX_FILES}`;
  const cards = await Promise.all(photos.map(async (photo) => {
    const url = await getWeightPhotoSignedUrl(photo.storage_path);
    return `
      <div class="media-thumb-card">
        ${url ? `<img src="${escapeHtml(url)}" alt="体重写真">` : '<div class="media-thumb-fallback"><i class="fas fa-image"></i></div>'}
        <div class="media-thumb-meta">
          <strong>${escapeHtml(getWeightSlotLabel(weightLogs.find((w) => w.id === weightLogId)?.slot))}</strong>
          <span>${escapeHtml(photo.file_name || 'photo.jpg')}</span>
        </div>
        <button type="button" class="btn btn-sm btn-danger media-thumb-delete" onclick="removeWeightPhoto('${photo.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
  }));
  gallery.innerHTML = cards.join('');
}

function renderPendingWeightPhotoPreview() {
  const preview = document.getElementById('weightPhotoPending');
  const count = document.getElementById('weightPhotoCount');
  if (!preview || !count) return;
  count.textContent = `${pendingWeightPhotoFiles.length}/${WEIGHT_PHOTO_MAX_FILES}`;
  if (!pendingWeightPhotoFiles.length) {
    preview.innerHTML = '';
    return;
  }
  preview.innerHTML = pendingWeightPhotoFiles.map((file, index) => `
    <div class="media-chip">
      <span><i class="fas fa-image"></i> ${escapeHtml(file.name)}</span>
      <button type="button" class="btn-icon" onclick="removePendingWeightPhoto(${index})" aria-label="削除"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

function removePendingWeightPhoto(index) {
  pendingWeightPhotoFiles.splice(index, 1);
  renderPendingWeightPhotoPreview();
}

function handleWeightPhotoInput(event) {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
  if (!canUseCloudMedia()) {
    showToast('写真アップロードはクラウドログイン時のみ利用できます', 'info');
    event.target.value = '';
    return;
  }
  const remain = Math.max(0, WEIGHT_PHOTO_MAX_FILES - getEditingWeightPhotos().length - pendingWeightPhotoFiles.length);
  if (!remain) {
    showToast(`写真は最大 ${WEIGHT_PHOTO_MAX_FILES} 枚までです`, 'info');
    event.target.value = '';
    return;
  }
  pendingWeightPhotoFiles.push(...files.slice(0, remain));
  renderPendingWeightPhotoPreview();
  event.target.value = '';
}

async function removeWeightPhoto(photoId) {
  showModal('写真を削除', 'この体重写真を削除しますか？', async () => {
    try {
      await deleteWeightPhoto(photoId);
      await renderWeightPhotoGallery();
      renderWeightPage();
      showToast('写真を削除しました', 'info');
    } catch (err) {
      console.error(err);
      showToast('写真削除に失敗しました', 'error');
    }
  });
}

async function saveWeight() {
  const date   = document.getElementById('w-date').value;
  const slot = getWeightSlotMeta(document.getElementById('w-slot')?.value).value;
  const heightRaw = document.getElementById('w-height').value.trim();
  const weightRaw = document.getElementById('w-weight').value;
  const fatRaw    = document.getElementById('w-fat').value.trim();
  const muscleRaw = document.getElementById('w-muscle').value.trim();
  const targetRaw = document.getElementById('w-target').value.trim();
  const note   = document.getElementById('w-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }

  const wChk = parseRequiredBounded(weightRaw, INPUT_BOUNDS.weightKg, '体重');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const weight = wChk.value;

  let height = getLatestKnownHeightCm();
  if (heightRaw) {
    const hChk = parseRequiredBounded(heightRaw, INPUT_BOUNDS.heightCm, '身長');
    if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
    height = hChk.value;
  }

  let fat = null;
  if (fatRaw) {
    const fChk = parseRequiredBounded(fatRaw, INPUT_BOUNDS.bodyFatPct, '体脂肪率');
    if (!fChk.ok) { showToast(fChk.msg, 'error'); return; }
    fat = fChk.value;
  }

  let muscle = null;
  if (muscleRaw) {
    const mChk = parseRequiredBounded(muscleRaw, INPUT_BOUNDS.muscleKg, '筋肉量');
    if (!mChk.ok) { showToast(mChk.msg, 'error'); return; }
    muscle = mChk.value;
  }

  let target = null;
  if (targetRaw) {
    const tChk = parseRequiredBounded(targetRaw, INPUT_BOUNDS.targetWeightKg, '目標体重');
    if (!tChk.ok) { showToast(tChk.msg, 'error'); return; }
    target = tChk.value;
  }

  const payload = { date, slot, height_cm: height, weight, body_fat: fat, muscle_mass: muscle, target_weight: target, note };

  try {
    const sameSlotRecord = findWeightLogByDateAndSlot(date, slot);
    if (editingWeightId && sameSlotRecord?.id && sameSlotRecord.id !== editingWeightId) {
      showToast(`${formatDate(date)} の${getWeightSlotLabel(slot)}はすでに記録済みです。既存データを選択して更新してください`, 'info');
      return;
    }
    const targetId = editingWeightId || sameSlotRecord?.id || '';
    const uploadQueueSeed = pendingWeightPhotoFiles.slice();
    let targetWeightLog = null;
    if (targetId) {
      editingWeightId = targetId;
      const updated = await apiPut('weight_logs', editingWeightId, payload);
      const ix = weightLogs.findIndex(w => w.id === editingWeightId);
      if (ix !== -1) weightLogs[ix] = normalizeWeightLogRecord({ ...weightLogs[ix], ...updated });
      sortWeightLogsInPlace();
      targetWeightLog = weightLogs.find((item) => item.id === editingWeightId) || null;
      showToast(`✅ ${date} ${getWeightSlotLabel(slot)} の記録を更新しました (${weight}kg)`, 'success');
    } else {
      const record = await apiPost('weight_logs', payload);
      weightLogs.push(normalizeWeightLogRecord(record));
      sortWeightLogsInPlace();
      targetWeightLog = weightLogs.find((item) => item.id === record.id) || weightLogs[weightLogs.length - 1] || null;
      showToast(`✅ ${getWeightSlotLabel(slot)} の体重 ${weight}kg を記録しました`, 'success');
      clearForm(['w-weight','w-fat','w-muscle','w-note']);
    }
    if (uploadQueueSeed.length && targetWeightLog) {
      const currentCount = targetWeightLog ? getWeightPhotosByLogId(targetWeightLog.id).length : 0;
      const uploadQueue = uploadQueueSeed.slice(0, Math.max(0, WEIGHT_PHOTO_MAX_FILES - currentCount));
      for (let i = 0; i < uploadQueue.length; i++) {
        const photoMeta = await uploadWeightPhotoFile(uploadQueue[i], targetWeightLog.id, currentCount + i);
        weightLogPhotos.push(photoMeta);
      }
      resetPendingWeightPhotos();
      showToast('写真をアップロードしました', 'success');
    }
    selectedWeightRecordId = targetWeightLog?.id || targetId || selectedWeightRecordId;
    if (editingWeightId) {
      cancelEditWeight();
    } else {
      updateWeightEditUI();
      renderPendingWeightPhotoPreview();
    }
    renderWeightPage();
    renderDashboard();
    await renderWeightPhotoGallery(selectedWeightRecordId);
  } catch(e) {
    console.error(e);
    showToast('保存に失敗しました', 'error');
  }
}

async function quickSaveWeight() {
  const slot = getWeightSlotMeta(document.getElementById('quickWeightSlot')?.value).value;
  const heightRaw = document.getElementById('quickHeight').value.trim();
  const weightRaw = document.getElementById('quickWeight').value;
  const fatRaw    = document.getElementById('quickBodyFat').value.trim();
  const note   = document.getElementById('quickNote').value.trim();

  const wChk = parseRequiredBounded(weightRaw, INPUT_BOUNDS.weightKg, '体重');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const weight = wChk.value;

  let height = getLatestKnownHeightCm();
  if (heightRaw) {
    const hChk = parseRequiredBounded(heightRaw, INPUT_BOUNDS.heightCm, '身長');
    if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
    height = hChk.value;
  }

  let fat = null;
  if (fatRaw) {
    const fChk = parseRequiredBounded(fatRaw, INPUT_BOUNDS.bodyFatPct, '体脂肪率');
    if (!fChk.ok) { showToast(fChk.msg, 'error'); return; }
    fat = fChk.value;
  }

  let target_weight = null;
  if (appSettings.targetWeight) {
    const twChk = parseRequiredBounded(String(appSettings.targetWeight), INPUT_BOUNDS.targetWeightKg, '設定の目標体重');
    if (twChk.ok) target_weight = twChk.value;
  }

  try {
    const date = TODAY();
    const payload = {
      date,
      slot,
      height_cm: height,
      weight,
      body_fat: fat,
      target_weight,
      note
    };
    const existing = findWeightLogByDateAndSlot(date, slot);
    if (existing?.id) {
      const updated = await apiPut('weight_logs', existing.id, payload);
      const ix = weightLogs.findIndex((w) => w.id === existing.id);
      if (ix !== -1) weightLogs[ix] = normalizeWeightLogRecord({ ...weightLogs[ix], ...updated });
      showToast(`✅ 今日の${getWeightSlotLabel(slot)}の体重を更新しました`, 'success');
    } else {
      const record = await apiPost('weight_logs', payload);
      weightLogs.push(normalizeWeightLogRecord(record));
      showToast(`✅ 今日の${getWeightSlotLabel(slot)}の体重 ${weight}kg を記録しました`, 'success');
    }
    sortWeightLogsInPlace();
    clearForm(['quickWeight','quickBodyFat','quickNote']);
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

function updateWeightEditUI() {
  const banner = document.getElementById('weightEditBanner');
  const btn = document.getElementById('weightSaveBtn');
  const on = Boolean(editingWeightId);
  if (banner) banner.style.display = on ? 'flex' : 'none';
  if (btn) {
    btn.innerHTML = on
      ? '<i class="fas fa-save"></i> 変更を保存'
      : '<i class="fas fa-save"></i> 体重を保存';
  }
}

function cancelEditWeight() {
  editingWeightId = null;
  const today = TODAY();
  const g = (id) => document.getElementById(id);
  if (g('w-date')) g('w-date').value = today;
  if (g('w-slot')) g('w-slot').value = 'morning';
  if (g('w-height')) {
    const h = getLatestKnownHeightCm();
    g('w-height').value = h != null ? String(h) : '';
  }
  clearForm(['w-weight','w-fat','w-muscle','w-note']);
  if (g('w-target')) g('w-target').value = '';
  resetPendingWeightPhotos();
  updateWeightEditUI();
  void renderWeightPhotoGallery();
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
}

function startEditWeight(id) {
  const w = weightLogs.find(x => x.id === id);
  if (!w) return;
  editingWeightId = id;
  const d = w.date ? w.date.slice(0, 10) : TODAY();
  const g = (x) => document.getElementById(x);
  g('w-date').value = d;
  g('w-slot').value = getWeightSlotMeta(w.slot).value;
  g('w-height').value = w.height_cm != null && w.height_cm !== '' ? w.height_cm : '';
  g('w-weight').value = w.weight != null ? w.weight : '';
  g('w-fat').value = w.body_fat != null && w.body_fat !== '' ? w.body_fat : '';
  g('w-muscle').value = w.muscle_mass != null && w.muscle_mass !== '' ? w.muscle_mass : '';
  g('w-target').value = w.target_weight != null && w.target_weight !== '' ? w.target_weight : '';
  g('w-note').value = w.note || '';
  resetPendingWeightPhotos();
  updateWeightEditUI();
  void renderWeightPhotoGallery(id);
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
  switchPage('weight');
  window.setTimeout(() => {
    document.getElementById('page-weight')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

async function deleteWeightLog(id) {
  showModal('体重記録を削除', 'この記録を削除しますか？', async () => {
    try {
      const relatedPhotos = getWeightPhotosByLogId(id);
      for (const photo of relatedPhotos) {
        await deleteWeightPhoto(photo.id);
      }
      await apiDelete('weight_logs', id);
      weightLogs = weightLogs.filter(w => w.id !== id);
      if (selectedWeightRecordId === id) selectedWeightRecordId = '';
      if (editingWeightId === id) cancelEditWeight();
      showToast('削除しました', 'info');
      renderWeightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

async function clearWeightLogs() {
  showModal('全データを削除', '体重記録をすべて削除しますか？この操作は元に戻せません。', async () => {
    try {
      for (const photo of [...weightLogPhotos]) {
        await deleteWeightPhoto(photo.id);
      }
      await Promise.all(weightLogs.map(w => apiDelete('weight_logs', w.id)));
      weightLogs = [];
      editingWeightId = null;
      selectedWeightRecordId = '';
      updateWeightEditUI();
      showToast('全記録を削除しました', 'info');
      renderWeightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function handleWeightRecordSelection(id) {
  selectedWeightRecordId = id || '';
  const selectEl = document.getElementById('weightRecordSelect');
  if (selectEl && selectEl.value !== selectedWeightRecordId) selectEl.value = selectedWeightRecordId;
  const rows = document.querySelectorAll('#weightTableBody tr[data-weight-id]');
  rows.forEach((row) => {
    row.classList.toggle('data-row-selected', row.dataset.weightId === selectedWeightRecordId);
  });
  void renderWeightPhotoGallery(selectedWeightRecordId);
}

function editSelectedWeightLog() {
  if (!selectedWeightRecordId) {
    showToast('編集する体重記録を選択してください', 'info');
    return;
  }
  startEditWeight(selectedWeightRecordId);
}

function deleteSelectedWeightLog() {
  if (!selectedWeightRecordId) {
    showToast('削除する体重記録を選択してください', 'info');
    return;
  }
  deleteWeightLog(selectedWeightRecordId);
}

function renderWeightPage() {
  sortWeightLogsInPlace();
  // Stats
  const latest = weightLogs.length ? weightLogs[weightLogs.length-1] : null;
  const latestHeight = latest?.height_cm || getLatestKnownHeightCm();
  const bmi = latest ? calculateBMI(latest.weight, latestHeight) : null;
  document.getElementById('latest-weight').textContent = latest ? `${latest.weight} kg` : '-- kg';
  document.getElementById('latest-fat').textContent    = latest?.body_fat ? `${latest.body_fat} %` : '-- %';
  document.getElementById('ringFatVal').textContent = latest?.body_fat ? `${latest.body_fat} %` : '--%';
  document.getElementById('ringMuscleVal').textContent = latest?.muscle_mass ? `${latest.muscle_mass} kg` : '-- kg';
  document.getElementById('bmi-display').textContent = bmi ? bmi.toFixed(1) : '--';
  document.getElementById('bmi-badge-display').innerHTML = getBmiBadgeHtml(bmi);

  const fatPct = latest?.body_fat ? Math.min(100, latest.body_fat) : 0;
  const musclePct = latest?.muscle_mass && latest?.weight ? Math.min(100, Math.round((latest.muscle_mass / latest.weight) * 100)) : 0;
  document.getElementById('ringFatFill').style.strokeDashoffset = `${226 - (226 * fatPct / 100)}`;
  document.getElementById('ringMuscleFill').style.strokeDashoffset = `${226 - (226 * musclePct / 100)}`;

  const lastTarget = [...weightLogs].reverse().find(w => w.target_weight);
  const targetW = lastTarget?.target_weight;
  document.getElementById('target-weight-display').textContent = targetW ? `${targetW} kg` : '-- kg';

  if (latest && targetW) {
    const remain = (latest.weight - targetW).toFixed(1);
    document.getElementById('weight-remain').textContent = `${remain > 0 ? '-' : '+'}${Math.abs(remain)} kg`;

    // Progress: assume starting from heaviest logged weight
    const maxW = Math.max(...weightLogs.map(w => w.weight));
    const pct = maxW > targetW ? Math.min(100, Math.round(((maxW - latest.weight) / (maxW - targetW)) * 100)) : 100;
    document.getElementById('weight-progress-pct').textContent = `${pct}%`;
    document.getElementById('weightProgressFill').style.width = `${pct}%`;
  }

  // Table
  const selectEl = document.getElementById('weightRecordSelect');
  if (selectEl) {
    const options = ['<option value="">記録を選択</option>'].concat(
      [...weightLogs].reverse().map((w) => `<option value="${w.id}">${formatDate(w.date)} / ${getWeightSlotLabel(w.slot)} / ${w.weight}kg</option>`)
    );
    selectEl.innerHTML = options.join('');
    if (selectedWeightRecordId && !weightLogs.some((w) => w.id === selectedWeightRecordId)) {
      selectedWeightRecordId = '';
    }
    selectEl.value = selectedWeightRecordId;
  }
  const tbody = document.getElementById('weightTableBody');
  const photoCountMap = new Map();
  weightLogPhotos.forEach((photo) => {
    photoCountMap.set(photo.weight_log_id, (photoCountMap.get(photo.weight_log_id) || 0) + 1);
  });
  if (!weightLogs.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">データなし</td></tr>';
  } else {
    tbody.innerHTML = [...weightLogs].reverse().map(w => `
      <tr class="data-row-selectable ${selectedWeightRecordId === w.id ? 'data-row-selected' : ''}" data-weight-id="${w.id}" onclick="handleWeightRecordSelection('${w.id}')">
        <td>${formatDate(w.date)}</td>
        <td><span class="badge">${getWeightSlotLabel(w.slot)}</span></td>
        <td><strong>${w.weight} kg</strong></td>
        <td>${calculateBMI(w.weight, w.height_cm || latestHeight)?.toFixed(1) || '--'}</td>
        <td>${w.body_fat ? w.body_fat + ' %' : '--'}</td>
        <td>${w.muscle_mass ? w.muscle_mass + ' kg' : '--'}</td>
        <td>${w.target_weight ? w.target_weight + ' kg' : '--'}</td>
        <td>${w.note || '--'}${photoCountMap.get(w.id) ? `<div class="table-subnote">📷 ${photoCountMap.get(w.id)}枚</div>` : ''}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); handleWeightRecordSelection('${w.id}'); startEditWeight('${w.id}')" title="編集"><i class="fas fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" onclick="event.stopPropagation(); handleWeightRecordSelection('${w.id}'); deleteWeightLog('${w.id}')" title="削除"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  updateWeightEditUI();
  renderPendingWeightPhotoPreview();
  void renderWeightPhotoGallery();

  // Chart
  renderWeightDetailChart(7);
}

let currentWeightRange = 7;
function setWeightRange(days, btn) {
  currentWeightRange = days;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWeightDetailChart(days);
}

function renderWeightDetailChart(days) {
  const ctx = document.getElementById('weightDetailChart').getContext('2d');
  const data = days > 0 ? weightLogs.slice(-days) : weightLogs;
  const weights = data.map(w => w.weight);
  const bodyFatValues = data.map(w => Number(w.body_fat)).filter(Number.isFinite);
  const latest = data[data.length - 1];
  const first = data[0];
  const avgWeight = average(weights);
  const delta = latest && first ? latest.weight - first.weight : null;
  const gap = latest?.target_weight ? latest.weight - latest.target_weight : null;
  const hasBodyFat = bodyFatValues.length > 0;
  const fatMin = hasBodyFat ? Math.max(0, Math.floor(Math.min(...bodyFatValues) - 1)) : 0;
  const fatMax = hasBodyFat ? Math.ceil(Math.max(...bodyFatValues) + 1) : 10;
  const weightPointRadius = data.map((_, index) => {
    if (index === data.length - 1) return 6;
    return data.length <= 7 ? 4 : 0;
  });

  setText('weightDetailLatest', latest ? `${latest.weight} kg` : '-- kg');
  setText('weightDetailAvg', avgWeight ? `${avgWeight.toFixed(1)} kg` : '-- kg');
  setText('weightDetailDelta', delta !== null ? formatSignedKg(delta) : '-- kg');
  setText('weightDetailGap', gap !== null ? formatSignedKg(gap) : '-- kg');
  setClassByState('weightDetailDelta', delta !== null ? (delta <= 0 ? 'pos' : 'neg') : '');
  setClassByState('weightDetailGap', gap !== null ? (gap <= 0 ? 'pos' : 'neg') : '');

  if (weightDetailChartInst) weightDetailChartInst.destroy();
  weightDetailChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(w => {
        const dateLabel = w.date ? w.date.slice(5) : '';
        return `${dateLabel} ${getWeightSlotMeta(w.slot).shortLabel}`;
      }),
      datasets: [
        {
          label: '体重 (kg)',
          data: data.map(w => w.weight),
          borderColor: '#e54a4a',
          backgroundColor: createLineGradient(ctx, '#e54a4a'),
          fill: true, tension: 0.4,
          borderWidth: 2.5,
          glowBlur: 18,
          pointBackgroundColor: '#e54a4a',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 7,
          pointHoverBorderWidth: 2,
          pointRadius: weightPointRadius,
          hitRadius: 18,
        },
        {
          label: '目標体重 (kg)',
          data: data.map(w => w.target_weight || null),
          borderColor: '#f5c842',
          borderDash: [6,3],
          backgroundColor: 'transparent',
          borderWidth: 2,
          glowBlur: 10,
          tension: 0, pointRadius: 0,
        },
        {
          label: '体脂肪率 (%)',
          data: data.map(w => w.body_fat || null),
          borderColor: '#a78bfa',
          backgroundColor: 'transparent',
          borderWidth: 2,
          glowBlur: 12,
          tension: 0.35, pointRadius: hasBodyFat ? 3 : 0,
          yAxisID: 'y1',
          hidden: !hasBodyFat,
        },
      ],
    },
    options: {
      ...chartOptions('kg'),
      scales: {
        x: {
          border: { display: false },
          grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
          ticks: { color: '#7d869d', font:{size:11, weight:'600'} }
        },
        y: {
          border: { display: false },
          grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
          ticks: { color: '#7d869d', font:{size:11, weight:'600'} },
          position: 'left',
        },
        y1: {
          display: hasBodyFat,
          min: fatMin,
          max: fatMax,
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#b69cff',
            font:{size:11, weight:'700'},
            callback: (value) => `${value}%`
          },
          position: 'right'
        },
      },
    },
  });
}

