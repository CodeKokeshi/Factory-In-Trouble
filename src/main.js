import Phaser from 'phaser';
import './style.css';
import BootScene from './scenes/BootScene';
import MainMenuScene from './scenes/MainMenuScene';
import LevelSelectScene from './scenes/LevelSelectScene';
import GameScene from './scenes/GameScene';
import LoadingScene from './scenes/LoadingScene';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0b1020',
  parent: 'game-container',
  input: {
    gamepad: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MainMenuScene, LevelSelectScene, LoadingScene, GameScene]
};

new Phaser.Game(config);
