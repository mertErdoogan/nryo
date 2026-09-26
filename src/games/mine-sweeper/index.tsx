import { defineGame } from '../define';
import { MineSweeper, saveSpec } from './MineSweeper';

export default defineGame({ Component: MineSweeper, save: saveSpec });
