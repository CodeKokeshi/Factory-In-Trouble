export function createVictoryOverlay(scene, config) {
  const {
    levelName,
    acceptedCount,
    levelQuota,
    score,
    maxCombo,
    jamCount,
    finishTime,
    hasNextLevel,
    onNextLevel,
    onLevelSelect,
    fonts = {}
  } = config;

  const displayFont = fonts.display || "'Lilita One', 'Bebas Neue', 'Segoe UI', sans-serif";
  const uiFont = fonts.ui || "'Nunito', 'Rajdhani', 'Segoe UI', sans-serif";

  const overlay = scene.add
    .rectangle(640, 360, 1280, 720, 0x1b0905, 0.74)
    .setDepth(380)
    .setInteractive();
  overlay.on('pointerdown', (_pointer, _x, _y, event) => {
    event?.stopPropagation();
  });

  const panelContainer = scene.add.container(0, 0).setDepth(390).setAlpha(0);

  const panelWidth = 660;
  const panelHeight = hasNextLevel ? 588 : 530;
  const panelRadius = 28;
  const panelX = 640;
  const panelY = 360;
  const panelTop = panelY - panelHeight * 0.5;
  const panelLeft = panelX - panelWidth * 0.5;

  const panelShadow = scene.add.graphics();
  panelShadow.fillStyle(0x1b0905, 0.52);
  panelShadow.fillRoundedRect(panelLeft, panelTop + 10, panelWidth, panelHeight, panelRadius);

  const panel = scene.add.graphics();
  panel.fillStyle(0x4a2012, 0.97);
  panel.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);
  panel.lineStyle(2, 0xf0bd85, 1);
  panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);

  const topStrip = scene.add.graphics();
  topStrip.fillStyle(0xffffff, 0.14);
  topStrip.fillRoundedRect(panelX - 276, panelTop + 34, 552, 36, 12);

  const titleText = scene.add
    .text(panelX, panelTop + 66, 'SHIFT CLEAR', {
      fontFamily: displayFont,
      fontSize: '56px',
      color: '#fff0d9',
      align: 'center'
    })
    .setOrigin(0.5)
    .setLetterSpacing(1.2)
    .setShadow(0, 3, '#000000', 10);

  const levelNameText = scene.add
    .text(panelX, panelTop + 128, levelName, {
      fontFamily: uiFont,
      fontSize: '28px',
      color: '#ffd9b3',
      align: 'center'
    })
    .setOrigin(0.5)
    .setLetterSpacing(0.8);

  const summaryText = scene.add
    .text(panelX, panelTop + 172, `BOX ${acceptedCount}/${levelQuota}   SCORE ${score}`, {
      fontFamily: uiFont,
      fontSize: '22px',
      color: '#ffe7cc',
      align: 'center'
    })
    .setOrigin(0.5)
    .setLetterSpacing(0.6);

  const topDivider = scene.add.rectangle(panelX, panelTop + 206, panelWidth - 120, 2, 0xf0bd85, 0.32);

  const statEntries = [
    { label: 'Maximum Combo', value: `x${maxCombo}` },
    { label: 'Number of Jams', value: `${jamCount}` },
    { label: 'Time to Finish', value: finishTime }
  ];

  const statsHeader = scene.add
    .text(panelLeft + 78, panelTop + 228, 'RUN BREAKDOWN', {
      fontFamily: displayFont,
      fontSize: '28px',
      color: '#ffe2c5'
    })
    .setOrigin(0, 0)
    .setLetterSpacing(1);

  const statTexts = statEntries.flatMap((entry, index) => {
    const y = panelTop + 274 + index * 46;
    const labelText = scene.add
      .text(panelLeft + 78, y, entry.label, {
        fontFamily: uiFont,
        fontSize: '24px',
        color: '#ffe7cc'
      })
      .setOrigin(0, 0.5)
      .setLetterSpacing(0.6);

    const valueText = scene.add
      .text(panelLeft + panelWidth - 78, y, entry.value, {
        fontFamily: displayFont,
        fontSize: '30px',
        color: '#fff6e8'
      })
      .setOrigin(1, 0.5)
      .setLetterSpacing(0.8)
      .setShadow(0, 2, '#5b2b17', 4);

    return [labelText, valueText];
  });

  const bottomDividerY = panelTop + (hasNextLevel ? 432 : 398);
  const bottomDivider = scene.add.rectangle(panelX, bottomDividerY, panelWidth - 120, 2, 0xf0bd85, 0.32);

  panelContainer.add([
    panelShadow,
    panel,
    topStrip,
    titleText,
    levelNameText,
    summaryText,
    topDivider,
    statsHeader,
    ...statTexts,
    bottomDivider
  ]);

  let resultLocked = false;
  const createResultButton = (label, y, accentColor, onSelect) => {
    const entry = scene.add.container(640, y);

    const shadowMid = scene.add.rectangle(0, 6, 304, 56, 0x1b0905, 0.44);
    const shadowLeft = scene.add.circle(-152, 6, 28, 0x1b0905, 0.44);
    const shadowRight = scene.add.circle(152, 6, 28, 0x1b0905, 0.44);

    const bodyMid = scene.add.rectangle(0, 0, 304, 56, 0x7a4327, 1);
    const bodyLeft = scene.add.circle(-152, 0, 28, 0x7a4327, 1);
    const bodyRight = scene.add.circle(152, 0, 28, 0x7a4327, 1);
    const glossMid = scene.add.rectangle(0, -11, 278, 15, 0xffffff, 0.14);
    const glossLeft = scene.add.circle(-139, -11, 8, 0xffffff, 0.14);
    const glossRight = scene.add.circle(139, -11, 8, 0xffffff, 0.14);
    const accentDot = scene.add.circle(-126, 0, 6, accentColor, 1);

    const labelText = scene.add
      .text(0, 0, label, {
        fontFamily: displayFont,
        fontSize: '32px',
        color: '#fff5ea',
        align: 'center'
      })
      .setOrigin(0.5)
      .setLetterSpacing(1)
      .setShadow(0, 2, '#6b3418', 4);

    const hitArea = scene.add.zone(0, 0, 360, 72).setInteractive({ useHandCursor: true });

    const setHighlighted = (highlighted) => {
      const fill = highlighted ? 0x915131 : 0x7a4327;
      bodyMid.setFillStyle(fill, 1);
      bodyLeft.setFillStyle(fill, 1);
      bodyRight.setFillStyle(fill, 1);
      accentDot.setScale(highlighted ? 1.2 : 1);
      labelText.setScale(highlighted ? 1.02 : 1);
    };

    hitArea.on('pointerover', () => {
      if (resultLocked) {
        return;
      }
      setHighlighted(true);
    });

    hitArea.on('pointerout', () => {
      setHighlighted(false);
    });

    hitArea.on('pointerdown', (_pointer, _x, _y, event) => {
      event?.stopPropagation();
      if (resultLocked) {
        return;
      }

      resultLocked = true;
      scene.tweens.killTweensOf(entry);
      scene.tweens.add({
        targets: entry,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 85,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          onSelect();
        }
      });
    });

    entry.add([
      shadowMid,
      shadowLeft,
      shadowRight,
      bodyMid,
      bodyLeft,
      bodyRight,
      glossMid,
      glossLeft,
      glossRight,
      accentDot,
      labelText,
      hitArea
    ]);

    panelContainer.add(entry);
    return entry;
  };

  if (hasNextLevel) {
    createResultButton('Next Shift', panelTop + 486, 0x34d399, onNextLevel);
    createResultButton('Level Select', panelTop + 548, 0xf59e0b, onLevelSelect);
  } else {
    createResultButton('Level Select', panelTop + 470, 0x34d399, onLevelSelect);
  }

  panelContainer.setScale(0.98);
  scene.tweens.add({
    targets: panelContainer,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 240,
    ease: 'Back.Out'
  });

  return {
    overlay,
    panelContainer,
    levelNameText
  };
}
