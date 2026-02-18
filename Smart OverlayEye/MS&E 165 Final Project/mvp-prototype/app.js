const TASKS = {
  removeBg: {
    app: 'Photoshop',
    steps: [
      { title: 'Select the subject', desc: 'Use the Object Selection tool (W) or Quick Selection (W) to select the main subject. Click and drag around the object.', hint: 'Tip: Hold Alt and click to subtract from selection' },
      { title: 'Refine the selection', desc: 'Go to Select > Select and Mask. Use the Refine Edge Brush to clean up hair or fine edges.', hint: 'Set Output to "New Layer with Layer Mask"' },
      { title: 'Create layer mask', desc: 'With the selection active, click the Add Layer Mask icon at the bottom of the Layers panel.', hint: 'The mask hides the background, revealing transparency' },
      { title: 'Verify and export', desc: 'Toggle the background layer visibility to check the result. Use File > Export > Export As for PNG with transparency.', hint: 'PNG preserves transparency for web or other apps' }
    ]
  },
  colorGrade: {
    app: 'Lightroom',
    steps: [
      { title: 'Open the Develop module', desc: 'Select your photo and switch to the Develop module (or press D).', hint: 'Develop is where all editing happens' },
      { title: 'Adjust basic sliders', desc: 'Start with Exposure, Contrast, Highlights, and Shadows. Pull Highlights down and Shadows up for a balanced look.', hint: 'Aim for detail in both bright and dark areas' },
      { title: 'Apply a preset (optional)', desc: 'In the left panel, browse Presets. Click one to preview—adjust Strength if needed.', hint: 'Presets are a quick starting point' },
      { title: 'Fine-tune with HSL', desc: 'Open the HSL/Color panel. Adjust Hue, Saturation, and Luminance per color channel to match your style.', hint: 'Orange/red for skin tones, blue for skies' }
    ]
  },
  exportFigma: {
    app: 'Figma',
    steps: [
      { title: 'Select the frame or layer', desc: 'Click the frame, component, or layer you want to export in the canvas or Layers panel.', hint: 'Frames export as whole images' },
      { title: 'Open export settings', desc: 'In the right panel, scroll to the Export section. Click the + button to add an export format.', hint: 'You can add multiple export settings' },
      { title: 'Choose format and scale', desc: 'Select PNG, JPG, SVG, or PDF. Set scale (1x, 2x, 3x) for resolution.', hint: '2x or 3x for retina/high-DPI' },
      { title: 'Export', desc: 'Click Export [name] or use the bulk Export button at the bottom. Choose save location.', hint: 'Cmd+E (Mac) or Ctrl+E (Win) for quick export' }
    ]
  }
};

let state = { phase: 'task', taskId: null, stepIdx: 0 };

function render() {
  const content = document.getElementById('content');
  if (state.phase === 'task') {
    content.innerHTML = `
      <div class="step-card">
        <div class="step-num">What do you want to do?</div>
        <div class="step-title">Tell Pear Navigator your goal</div>
        <div class="step-desc">Pick a task or type your own. The guide will appear step by step.</div>
        <div class="task-options">
          ${Object.entries(TASKS).map(([id, t]) =>
            `<div class="task-opt ${state.taskId === id ? 'selected' : ''}" data-task="${id}">${t.app}: ${id === 'removeBg' ? 'Remove background' : id === 'colorGrade' ? 'Color grade photo' : 'Export for web'}</div>`
          ).join('')}
        </div>
        <button class="btn-next" id="btnStart" ${!state.taskId ? 'disabled' : ''}>Start guide</button>
      </div>
    `;
    document.querySelectorAll('.task-opt').forEach(el => {
      el.onclick = () => { state.taskId = el.dataset.task; render(); };
    });
    document.getElementById('btnStart').onclick = () => {
      state.phase = 'steps';
      state.stepIdx = 0;
      render();
    };
  } else if (state.phase === 'steps') {
    const task = TASKS[state.taskId];
    const step = task.steps[state.stepIdx];
    const isLast = state.stepIdx === task.steps.length - 1;
    content.innerHTML = `
      <div class="step-card">
        <div class="step-num">Step ${state.stepIdx + 1} of ${task.steps.length}</div>
        <div class="step-title">${step.title}</div>
        <div class="step-desc">${step.desc}</div>
        <div class="step-hint">${step.hint}</div>
        <button class="btn-next" id="btnNext">${isLast ? 'Done' : 'Next step'}</button>
      </div>
    `;
    document.getElementById('btnNext').onclick = () => {
      if (isLast) {
        state.phase = 'done';
      } else {
        state.stepIdx++;
      }
      render();
    };
  } else {
    content.innerHTML = `
      <div class="done-screen">
        <div class="icon">✓</div>
        <h2>Task complete</h2>
        <p>You've finished the guide. Try another task or refine your result.</p>
        <button class="btn-next" style="margin-top: 32px; max-width: 200px; margin-left: auto; margin-right: auto;" id="btnReset">Start over</button>
      </div>
    `;
    document.getElementById('btnReset').onclick = () => {
      state = { phase: 'task', taskId: null, stepIdx: 0 };
      render();
    };
  }
  document.getElementById('appPreview').textContent = state.phase === 'task' ? 'Your creative app' : TASKS[state.taskId]?.app || 'Your creative app';
}

render();
